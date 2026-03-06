// lib/ai-responder.ts - GPT-4o intent classification + response generation
import { supabaseAdmin } from './supabaseClient';
import OpenAI from 'openai';
import { google } from 'googleapis';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface LeadContext {
  id: string;
  company_name: string;
  contact_name: string;
  industry?: string;
  pain_point?: string;
  original_outreach_subject: string;
  original_outreach_body: string;
  calendly_link?: string;
}

interface ReplyContext {
  fromEmail: string;
  subject: string;
  body: string;
  intent: 'interested' | 'not_interested' | 'needs_more_info' | 'out_of_office' | 'unsubscribe';
}

export class AIResponder {
  private gmail: any;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    
    // Initialize Gmail API
    const auth = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
    );

    auth.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    });

    this.gmail = google.gmail({ version: 'v1', auth });
  }

  /**
   * Generate and send AI response based on reply intent
   */
  async handleReply(leadId: string, replyContext: ReplyContext): Promise<void> {
    try {
      // Get lead context
      const leadContext = await this.getLeadContext(leadId);
      if (!leadContext) {
        console.error(`No context found for lead ${leadId}`);
        return;
      }

      // Generate response based on intent
      let response: string | null = null;
      let shouldStopFollowUps = false;

      switch (replyContext.intent) {
        case 'interested':
          response = await this.generateInterestedResponse(leadContext, replyContext);
          await this.updateLeadStatus(leadId, 'hot');
          break;

        case 'needs_more_info':
          response = await this.generateMoreInfoResponse(leadContext, replyContext);
          await this.updateLeadStatus(leadId, 'warm');
          break;

        case 'not_interested':
          await this.sendNotInterestedResponse(leadId, replyContext);
          shouldStopFollowUps = true;
          await this.updateLeadStatus(leadId, 'closed');
          break;

        case 'unsubscribe':
          await this.sendUnsubscribeConfirmation(leadId, replyContext);
          shouldStopFollowUps = true;
          await this.updateLeadStatus(leadId, 'unsubscribed');
          break;

        case 'out_of_office':
          // Don't respond, just reschedule follow-ups
          await this.handleOutOfOffice(leadId, replyContext);
          return;

        default:
          console.log(`Unknown intent ${replyContext.intent} for lead ${leadId}`);
          return;
      }

      // Send response if generated
      if (response) {
        await this.sendAIResponse(leadId, replyContext, response);
      }

      // Stop follow-ups if needed
      if (shouldStopFollowUps) {
        await this.cancelAllFollowUps(leadId);
      }

    } catch (error) {
      console.error(`Error handling reply for lead ${leadId}:`, error);
      throw error;
    }
  }

  /**
   * Generate personalized response for interested leads
   */
  private async generateInterestedResponse(lead: LeadContext, reply: ReplyContext): Promise<string> {
    const prompt = `
Generate a personalized email response to a B2B lead who expressed interest in our outreach.

Context:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name}
- Industry: ${lead.industry || 'Unknown'}
- Original subject: ${lead.original_outreach_subject}
- Original outreach: ${lead.original_outreach_body}
- Their reply: ${reply.body}
- Calendly link: ${lead.calendly_link || 'https://calendly.com/your-link'}

Requirements:
1. Reference their specific reply and company
2. Express enthusiasm about their interest
3. Include the Calendly booking link for a 10-minute call
4. Keep it conversational and professional
5. Maximum 150 words
6. Include timezone note

Generate only the email body (no subject line).
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }

  /**
   * Generate response for leads needing more information
   */
  private async generateMoreInfoResponse(lead: LeadContext, reply: ReplyContext): Promise<string> {
    const prompt = `
Generate a personalized email response answering questions from a B2B lead who needs more information.

Context:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name}
- Industry: ${lead.industry || 'Unknown'}
- Pain point addressed: ${lead.pain_point || 'Growth challenges'}
- Original subject: ${lead.original_outreach_subject}
- Original outreach: ${lead.original_outreach_body}
- Their questions: ${reply.body}

Requirements:
1. Answer their specific questions intelligently
2. Reference their company and industry
3. Provide relevant information about how we help with ${lead.pain_point || 'their challenges'}
4. Include Calendly link if appropriate for a deeper discussion
5. Keep it professional and helpful
6. Maximum 200 words

Generate only the email body (no subject line).
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.6,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }

  /**
   * Send polite response to not interested leads
   */
  private async sendNotInterestedResponse(leadId: string, reply: ReplyContext): Promise<void> {
    const response = `Thank you for your response. I understand this isn't a priority right now and appreciate your time. 

If your needs change in the future, please don't hesitate to reach out. I'll be sure to keep you off our follow-up list.

Best regards`;

    await this.sendAIResponse(leadId, reply, response);
  }

  /**
   * Send unsubscribe confirmation
   */
  private async sendUnsubscribeConfirmation(leadId: string, reply: ReplyContext): Promise<void> {
    const response = `You've been successfully unsubscribed from all future communications. 

We apologize for any inconvenience and have removed you from our mailing list immediately.

Best regards`;

    await this.sendAIResponse(leadId, reply, response);
  }

  /**
   * Handle out-of-office replies by rescheduling follow-ups
   */
  private async handleOutOfOffice(leadId: string, reply: ReplyContext): Promise<void> {
    try {
      // Extract return date from the out-of-office message
      const returnDate = this.extractReturnDate(reply.body);
      
      if (returnDate) {
        // Reschedule all pending follow-ups to after their return
        const { data: followUps } = await supabaseAdmin
          .from('follow_up_schedule')
          .select('*')
          .eq('lead_id', leadId)
          .eq('status', 'scheduled');

        if (followUps) {
          for (const followUp of followUps) {
            const originalDate = new Date(followUp.scheduled_for);
            const daysToAdd = Math.max(1, Math.ceil((returnDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24)));
            
            const newDate = new Date(returnDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
            
            await supabaseAdmin
              .from('follow_up_schedule')
              .update({
                scheduled_for: newDate.toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', followUp.id);
          }
        }

        // Update lead record
        await supabaseAdmin
          .from('leads')
          .update({
            out_of_office_until: returnDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId);
      }
    } catch (error) {
      console.error('Error handling out-of-office:', error);
    }
  }

  /**
   * Send AI-generated response via Gmail
   */
  private async sendAIResponse(leadId: string, reply: ReplyContext, body: string): Promise<void> {
    try {
      // Get thread ID for reply
      const { data: conversation } = await supabaseAdmin
        .from('lead_conversations')
        .select('thread_id')
        .eq('lead_id', leadId)
        .eq('message_id', reply.body.includes(reply.subject) ? 'match' : 'any') // Simplified matching
        .limit(1)
        .single();

      if (!conversation) {
        console.error(`No conversation found for lead ${leadId}`);
        return;
      }

      // Create email message
      const email = [
        `To: ${reply.fromEmail}`,
        `From: ${process.env.GMAIL_SENDER_ADDRESS}`,
        `Subject: Re: ${reply.subject}`,
        '',
        body,
      ].join('\n');

      // Send via Gmail API
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(email).toString('base64'),
          threadId: conversation.thread_id,
        },
      });

      // Store AI response in database
      await supabaseAdmin
        .from('lead_conversations')
        .insert({
          lead_id: leadId,
          thread_id: conversation.thread_id,
          message_id: response.data.id,
          from_email: process.env.GMAIL_SENDER_ADDRESS!,
          to_email: reply.fromEmail,
          subject: `Re: ${reply.subject}`,
          body: body,
          message_type: 'ai_reply',
          intent_classification: reply.intent,
          ai_response_generated: true,
          ai_response_sent: true,
        });

      // Update lead record
      await supabaseAdmin
        .from('leads')
        .update({
          last_ai_response_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      console.log(`AI response sent to ${reply.fromEmail} for lead ${leadId}`);

    } catch (error) {
      console.error('Error sending AI response:', error);
      throw error;
    }
  }

  /**
   * Get lead context for response generation
   */
  private async getLeadContext(leadId: string): Promise<LeadContext | null> {
    try {
      const { data: lead, error } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error || !lead) {
        return null;
      }

      // Get original outbound message
      const { data: outbound } = await supabaseAdmin
        .from('lead_conversations')
        .select('subject, body')
        .eq('lead_id', leadId)
        .eq('message_type', 'outbound')
        .limit(1)
        .single();

      return {
        id: lead.id,
        company_name: lead.company_name || lead.business_name || 'Unknown',
        contact_name: lead.contact_name || lead.name || 'Unknown',
        industry: lead.industry,
        pain_point: lead.pain_point,
        original_outreach_subject: outbound?.subject || '',
        original_outreach_body: outbound?.body || '',
        calendly_link: lead.calendly_link,
      };
    } catch (error) {
      console.error('Error getting lead context:', error);
      return null;
    }
  }

  /**
   * Update lead status
   */
  private async updateLeadStatus(leadId: string, status: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('leads')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  }

  /**
   * Cancel all scheduled follow-ups for a lead
   */
  private async cancelAllFollowUps(leadId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('follow_up_schedule')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('lead_id', leadId)
        .eq('status', 'scheduled');
    } catch (error) {
      console.error('Error cancelling follow-ups:', error);
    }
  }

  /**
   * Extract return date from out-of-office message
   */
  private extractReturnDate(body: string): Date | null {
    const patterns = [
      /back on (\w+ \d{1,2},? \d{4})/i,
      /return (\w+ \d{1,2},? \d{4})/i,
      /until (\w+ \d{1,2},? \d{4})/i,
      /back (\d{1,2}\/\d{1,2}\/\d{4})/i,
      /return (\d{1,2}\/\d{1,2}\/\d{4})/i,
      /back (\w+ \d{1,2})/i, // If no year, assume current year
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        const dateStr = match[1];
        const date = new Date(dateStr);
        
        // If no year specified, add current year
        if (isNaN(date.getTime()) && !dateStr.match(/\d{4}/)) {
          const currentYear = new Date().getFullYear();
          const dateWithYear = `${dateStr}, ${currentYear}`;
          const dateWithYearObj = new Date(dateWithYear);
          if (!isNaN(dateWithYearObj.getTime())) {
            return dateWithYearObj;
          }
        }
        
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return null;
  }
}
