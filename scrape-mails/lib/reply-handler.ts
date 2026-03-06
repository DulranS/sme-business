// lib/reply-handler.ts - Gmail polling, reply parsing, thread matching
import { google } from 'googleapis';
import { supabaseAdmin } from './supabaseClient';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GmailMessage {
  id: string;
  threadId: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: Array<any>;
    }>;
    body?: { data?: string };
  };
  internalDate: string;
  snippet: string;
}

interface ProcessedReply {
  leadId: string;
  threadId: string;
  messageId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  intent: 'interested' | 'not_interested' | 'needs_more_info' | 'out_of_office' | 'unsubscribe' | 'unknown';
  originalOutreachId?: string;
}

export class ReplyHandler {
  private gmail: any;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    
    // Initialize Gmail API with OAuth2
    const auth = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
    );

    // Set credentials (you'll need to store refresh tokens in Supabase)
    auth.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN, // Store this securely
    });

    this.gmail = google.gmail({ version: 'v1', auth });
  }

  /**
   * Poll Gmail for new replies to outbound emails
   */
  async pollForReplies(): Promise<ProcessedReply[]> {
    try {
      // Get all threads with replies from the last 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const query = `after:${fifteenMinutesAgo.getTime() / 1000} -from:me`;

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      });

      if (!response.data.messages) {
        return [];
      }

      const processedReplies: ProcessedReply[] = [];

      for (const messageRef of response.data.messages) {
        try {
          const message = await this.gmail.users.messages.get({
            userId: 'me',
            id: messageRef.id,
            format: 'full',
          });

          const processedReply = await this.processMessage(message.data);
          if (processedReply) {
            processedReplies.push(processedReply);
          }
        } catch (error) {
          console.error(`Error processing message ${messageRef.id}:`, error);
        }
      }

      return processedReplies;
    } catch (error) {
      console.error('Error polling Gmail for replies:', error);
      throw error;
    }
  }

  /**
   * Process a single Gmail message
   */
  private async processMessage(message: GmailMessage): Promise<ProcessedReply | null> {
    try {
      const headers = message.payload.headers;
      const subject = this.getHeader(headers, 'Subject') || '';
      const fromEmail = this.extractEmail(this.getHeader(headers, 'From') || '');
      const toEmail = this.extractEmail(this.getHeader(headers, 'To') || '');
      const body = this.extractBody(message.payload);
      const threadId = message.threadId;
      const messageId = message.id;

      // Skip if this is an outbound message we sent
      if (await this.isOutboundMessage(messageId)) {
        return null;
      }

      // Match to original lead using thread
      const leadId = await this.findLeadByThread(threadId);
      if (!leadId) {
        console.log(`No lead found for thread ${threadId}`);
        return null;
      }

      // Classify intent using GPT-4o
      const intent = await this.classifyIntent(subject, body);

      // Store the conversation
      await this.storeConversation({
        leadId,
        threadId,
        messageId,
        fromEmail,
        toEmail,
        subject,
        body,
        messageType: 'inbound',
        intent,
      });

      // Update lead status
      await this.updateLeadStatus(leadId, intent);

      return {
        leadId,
        threadId,
        messageId,
        fromEmail,
        toEmail,
        subject,
        body,
        intent,
      };
    } catch (error) {
      console.error('Error processing message:', error);
      return null;
    }
  }

  /**
   * Classify reply intent using GPT-4o
   */
  private async classifyIntent(subject: string, body: string): Promise<ProcessedReply['intent']> {
    try {
      const prompt = `
Classify the intent of this email reply to a B2B sales outreach:

Subject: ${subject}
Body: ${body}

Possible intents:
- interested: They expressed interest, want to learn more, or asked for a call/meeting
- not_interested: They explicitly said they're not interested, asked to be removed, or rejected the offer
- needs_more_info: They asked questions, want clarification, or need additional details
- out_of_office: Auto-responder with out of office message and return date
- unsubscribe: They asked to unsubscribe or opt out
- unknown: Cannot determine intent

Respond with only the intent name (e.g., "interested").
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0,
      });

      const intent = response.choices[0]?.message?.content?.trim().toLowerCase();
      
      const validIntents: ProcessedReply['intent'][] = ['interested', 'not_interested', 'needs_more_info', 'out_of_office', 'unsubscribe', 'unknown'];
      return validIntents.includes(intent as any) ? intent as ProcessedReply['intent'] : 'unknown';
    } catch (error) {
      console.error('Error classifying intent:', error);
      return 'unknown';
    }
  }

  /**
   * Store conversation in database
   */
  private async storeConversation(conversation: {
    leadId: string;
    threadId: string;
    messageId: string;
    fromEmail: string;
    toEmail: string;
    subject: string;
    body: string;
    messageType: string;
    intent: string;
  }): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('lead_conversations')
        .insert({
          lead_id: conversation.leadId,
          thread_id: conversation.threadId,
          message_id: conversation.messageId,
          from_email: conversation.fromEmail,
          to_email: conversation.toEmail,
          subject: conversation.subject,
          body: conversation.body,
          message_type: conversation.messageType,
          intent_classification: conversation.intent,
        });

      if (error) {
        console.error('Error storing conversation:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error storing conversation:', error);
      throw error;
    }
  }

  /**
   * Update lead status based on reply intent
   */
  private async updateLeadStatus(leadId: string, intent: ProcessedReply['intent']): Promise<void> {
    try {
      const updates: any = {
        last_reply_intent: intent,
        last_contacted_at: new Date().toISOString(),
        total_replies: supabaseAdmin.rpc('increment', { x: 1 }),
      };

      // Update status based on intent
      switch (intent) {
        case 'interested':
          updates.status = 'hot';
          break;
        case 'needs_more_info':
          updates.status = 'warm';
          break;
        case 'not_interested':
          updates.status = 'closed';
          updates.ai_conversation_active = false;
          break;
        case 'unsubscribe':
          updates.status = 'unsubscribed';
          updates.ai_conversation_active = false;
          break;
        case 'out_of_office':
          // Extract return date and set out_of_office_until
          const returnDate = this.extractOutOfOfficeDate(updates.body || '');
          if (returnDate) {
            updates.out_of_office_until = returnDate;
          }
          break;
      }

      const { error } = await supabaseAdmin
        .from('leads')
        .update(updates)
        .eq('id', leadId);

      if (error) {
        console.error('Error updating lead status:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error updating lead status:', error);
      throw error;
    }
  }

  /**
   * Find lead by Gmail thread ID
   */
  private async findLeadByThread(threadId: string): Promise<string | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('lead_conversations')
        .select('lead_id')
        .eq('thread_id', threadId)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error finding lead by thread:', error);
        return null;
      }

      return data?.lead_id || null;
    } catch (error) {
      console.error('Error finding lead by thread:', error);
      return null;
    }
  }

  /**
   * Check if message was sent by us (outbound)
   */
  private async isOutboundMessage(messageId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('lead_conversations')
        .select('id')
        .eq('message_id', messageId)
        .eq('message_type', 'outbound')
        .limit(1)
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract header value from Gmail headers
   */
  private getHeader(headers: Array<{ name: string; value: string }>, name: string): string | null {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || null;
  }

  /**
   * Extract email address from header value
   */
  private extractEmail(headerValue: string): string {
    const match = headerValue.match(/<([^>]+)>/);
    return match ? match[1] : headerValue.trim();
  }

  /**
   * Extract body content from Gmail message payload
   */
  private extractBody(payload: any): string {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
        if (part.parts) {
          const body = this.extractBody(part);
          if (body) return body;
        }
      }
    }

    return '';
  }

  /**
   * Extract return date from out-of-office message
   */
  private extractOutOfOfficeDate(body: string): string | null {
    const patterns = [
      /back on (\w+ \d{1,2},? \d{4})/i,
      /return (\w+ \d{1,2},? \d{4})/i,
      /until (\w+ \d{1,2},? \d{4})/i,
      /back (\d{1,2}\/\d{1,2}\/\d{4})/i,
      /return (\d{1,2}\/\d{1,2}\/\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }

    return null;
  }
}
