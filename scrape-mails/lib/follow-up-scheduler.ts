// lib/follow-up-scheduler.ts - Follow-up queue management
import { supabaseAdmin } from './supabaseClient';
import { AIResponder } from './ai-responder';
import OpenAI from 'openai';
import { google } from 'googleapis';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface FollowUpLead {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  industry?: string;
  pain_point?: string;
  original_outreach_subject: string;
  original_outreach_body: string;
  calendly_link?: string;
  follow_up_count: number;
  status: string;
}

export class FollowUpScheduler {
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
   * Schedule initial follow-ups for a new lead
   */
  async scheduleFollowUps(leadId: string): Promise<void> {
    try {
      const followUpDays = [3, 5, 7]; // Day 3, 5, 7 from first contact
      
      for (let i = 0; i < followUpDays.length; i++) {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + followUpDays[i]);
        
        await supabaseAdmin
          .from('follow_up_schedule')
          .insert({
            lead_id: leadId,
            scheduled_for: scheduledDate.toISOString(),
            follow_up_number: i + 1,
            status: 'scheduled',
            ai_generated: true,
          });
      }

      console.log(`Scheduled follow-ups for lead ${leadId}`);
    } catch (error) {
      console.error('Error scheduling follow-ups:', error);
      throw error;
    }
  }

  /**
   * Process all follow-ups due today
   */
  async processDueFollowUps(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get all follow-ups due today that are still scheduled
      const { data: followUps, error } = await supabaseAdmin
        .from('follow_up_schedule')
        .select(`
          *,
          leads:lead_id (
            id,
            company_name,
            contact_name,
            email,
            industry,
            pain_point,
            status,
            calendly_link
          )
        `)
        .eq('status', 'scheduled')
        .lte('scheduled_for', new Date().toISOString())
        .eq('leads.ai_conversation_active', true);

      if (error) {
        console.error('Error fetching due follow-ups:', error);
        return;
      }

      if (!followUps || followUps.length === 0) {
        console.log('No follow-ups due today');
        return;
      }

      console.log(`Processing ${followUps.length} follow-ups due today`);

      for (const followUp of followUps) {
        try {
          await this.sendFollowUp(followUp);
        } catch (error) {
          console.error(`Error sending follow-up for lead ${followUp.lead_id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error processing due follow-ups:', error);
      throw error;
    }
  }

  /**
   * Send a single follow-up
   */
  private async sendFollowUp(followUp: any): Promise<void> {
    try {
      const lead = followUp.leads;
      
      // Check if lead is still eligible for follow-ups
      if (lead.status === 'closed' || lead.status === 'unsubscribed') {
        await this.cancelFollowUp(followUp.id);
        return;
      }

      // Generate personalized follow-up content
      const emailContent = await this.generateFollowUpContent(lead, followUp.follow_up_number);
      
      // Create email message
      const email = [
        `To: ${lead.email}`,
        `From: ${process.env.GMAIL_SENDER_ADDRESS}`,
        `Subject: ${emailContent.subject}`,
        '',
        emailContent.body,
      ].join('\n');

      // Send via Gmail API
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(email).toString('base64'),
        },
      });

      // Store the follow-up in conversations
      await supabaseAdmin
        .from('lead_conversations')
        .insert({
          lead_id: lead.id,
          thread_id: response.data.threadId || `followup_${followUp.id}`,
          message_id: response.data.id,
          from_email: process.env.GMAIL_SENDER_ADDRESS!,
          to_email: lead.email,
          subject: emailContent.subject,
          body: emailContent.body,
          message_type: 'outbound',
          intent_classification: 'follow_up',
        });

      // Update follow-up schedule
      await supabaseAdmin
        .from('follow_up_schedule')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          email_content: emailContent.body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', followUp.id);

      // Update lead
      await supabaseAdmin
        .from('leads')
        .update({
          follow_up_count: lead.follow_up_count + 1,
          last_contacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      console.log(`Follow-up ${followUp.follow_up_number} sent to ${lead.email}`);

    } catch (error) {
      console.error('Error sending follow-up:', error);
      
      // Mark as failed but don't cancel - might retry later
      await supabaseAdmin
        .from('follow_up_schedule')
        .update({
          status: 'scheduled', // Keep as scheduled to retry
          updated_at: new Date().toISOString(),
        })
        .eq('id', followUp.id);
      
      throw error;
    }
  }

  /**
   * Generate personalized follow-up content using GPT-4o
   */
  private async generateFollowUpContent(lead: any, followUpNumber: number): Promise<{ subject: string; body: string }> {
    try {
      // Get conversation history for context
      const { data: conversations } = await supabaseAdmin
        .from('lead_conversations')
        .select('subject, body, message_type, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      const conversationContext = conversations?.slice(0, 3).map(c => 
            `${c.message_type}: ${c.subject}\n${c.body}`
          ).join('\n\n') || '';

      const prompt = `
Generate a personalized follow-up email for a B2B lead.

Lead Information:
- Company: ${lead.company_name}
- Contact: ${lead.contact_name}
- Industry: ${lead.industry || 'Unknown'}
- Pain point: ${lead.pain_point || 'Business growth'}
- Follow-up number: ${followUpNumber} (of 3 total)

Previous conversation context:
${conversationContext}

Requirements:
1. Reference their company and industry specifically
2. Mention something relevant about ${lead.pain_point || 'their business challenges'}
3. Be conversational but professional
4. Include a specific reason for following up
5. Include Calendly link: ${lead.calendly_link || 'https://calendly.com/your-link'}
6. Keep it under 120 words
7. Generate both subject and body
8. Make it sound fresh, not like a template

Follow-up approach:
- Follow-up 1: Gentle reminder with new insight
- Follow-up 2: Different angle or value proposition
- Follow-up 3: Last attempt, break-up tone

Generate in this format:
SUBJECT: [subject line]
BODY: [email body]
`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      
      // Parse the response
      const subjectMatch = content.match(/SUBJECT:\s*(.+)/i);
      const bodyMatch = content.match(/BODY:\s*([\s\S]+)/i);
      
      const subject = subjectMatch ? subjectMatch[1].trim() : `Following up on ${lead.company_name}`;
      const body = bodyMatch ? bodyMatch[1].trim() : this.generateFallbackFollowUp(lead, followUpNumber);

      return { subject, body };

    } catch (error) {
      console.error('Error generating follow-up content:', error);
      return {
        subject: `Following up on ${lead.company_name}`,
        body: this.generateFallbackFollowUp(lead, followUpNumber),
      };
    }
  }

  /**
   * Fallback follow-up generation
   */
  private generateFallbackFollowUp(lead: any, followUpNumber: number): string {
    const followUps = [
      // Follow-up 1
      `Hi ${lead.contact_name},

Just wanted to follow up on my previous email about helping ${lead.company_name} with ${lead.pain_point || 'growth challenges'}.

I noticed many ${lead.industry || 'companies'} in your space are focusing on this right now. Would you be open to a quick 10-minute chat to explore if we can help?

Book here: ${lead.calendly_link || 'https://calendly.com/your-link'}

Best regards`,

      // Follow-up 2  
      `Hi ${lead.contact_name},

Following up again - I know how busy things get.

For ${lead.industry || 'companies'} like ${lead.company_name}, we typically see significant results when addressing ${lead.pain_point || 'these challenges'} systematically.

If the timing isn't right, just let me know. Otherwise, here's my calendar: ${lead.calendly_link || 'https://calendly.com/your-link'}

Best regards`,

      // Follow-up 3 (Break-up)
      `Hi ${lead.contact_name},

I've reached out a couple times about helping with ${lead.pain_point || 'your business challenges'} but haven't heard back.

Assuming this isn't a priority right now, I'll close your file.

If things change or you'd like to revisit in the future, feel free to reach out.

Best regards`,
    ];

    return followUps[followUpNumber - 1] || followUps[2];
  }

  /**
   * Cancel a specific follow-up
   */
  private async cancelFollowUp(followUpId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('follow_up_schedule')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', followUpId);
    } catch (error) {
      console.error('Error cancelling follow-up:', error);
    }
  }

  /**
   * Cancel all follow-ups for a lead
   */
  async cancelAllFollowUps(leadId: string): Promise<void> {
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
      console.error('Error cancelling all follow-ups:', error);
    }
  }

  /**
   * Get follow-up queue for dashboard
   */
  async getFollowUpQueue(): Promise<any[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('follow_up_schedule')
        .select(`
          *,
          leads:lead_id (
            company_name,
            contact_name,
            email,
            status
          )
        `)
        .eq('status', 'scheduled')
        .order('scheduled_for', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error fetching follow-up queue:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting follow-up queue:', error);
      return [];
    }
  }

  /**
   * Get hot leads (those who replied with interest)
   */
  async getHotLeads(): Promise<any[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select(`
          *,
          lead_conversations (
            intent_classification,
            created_at,
            ai_response_sent
          )
        `)
        .eq('status', 'hot')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching hot leads:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting hot leads:', error);
      return [];
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(): Promise<any> {
    try {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('status, total_replies, follow_up_count')
        .eq('ai_conversation_active', true);

      if (error) {
        console.error('Error fetching conversation stats:', error);
        return {
          totalLeads: 0,
          interestedReplies: 0,
          totalReplies: 0,
          averageFollowUps: 0,
        };
      }

      const leads = data || [];
      const totalLeads = leads.length;
      const interestedReplies = leads.filter(l => l.status === 'hot').length;
      const totalReplies = leads.reduce((sum, l) => sum + (l.total_replies || 0), 0);
      const averageFollowUps = leads.length > 0 
        ? leads.reduce((sum, l) => sum + (l.follow_up_count || 0), 0) / leads.length 
        : 0;

      return {
        totalLeads,
        interestedReplies,
        totalReplies,
        averageFollowUps: Math.round(averageFollowUps * 10) / 10,
      };
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return {
        totalLeads: 0,
        interestedReplies: 0,
        totalReplies: 0,
        averageFollowUps: 0,
      };
    }
  }
}
