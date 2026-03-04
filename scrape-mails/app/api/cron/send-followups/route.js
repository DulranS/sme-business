import { google } from 'googleapis';
import OpenAI from 'openai';
import { supabaseAdmin } from '../../../../lib/supabaseClient';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

function getOAuthClient() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth or refresh token env vars missing for cron/send-followups');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

async function buildFollowupBody({ lead, followUpNumber }) {
  if (!openai) {
    const business = lead.business_name || lead.email || 'there';
    return `Hi ${business},

Just following up to see if our dev/automation support could still be useful for you.

If it’s not a fit right now, no problem—just let me know.`;
  }

  const business = lead.business_name || lead.email || 'there';

  const prompt = `
You are writing follow-up #${followUpNumber} in a cold email sequence from a small dev/automation agency.

Business name: ${business}
Context: We help with web dev, AI tooling, automations, and ongoing ops. Keep it down-to-earth, not hypey.

Write a short, personalized follow-up email (<= 180 words) that:
- references ${business} by name
- briefly reminds what we do
- acknowledges this is follow-up #${followUpNumber}
- has one clear, soft CTA (reply or book a short call)

Plain text only.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You write concise, respectful B2B follow-up emails.' },
      { role: 'user', content: prompt },
    ],
  });

  return (completion.choices[0].message.content || '').trim();
}

export async function GET() {
  if (!supabaseAdmin) {
    return Response.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1) Fetch follow-ups that are due today and still pending
    const { data: due, error } = await supabaseAdmin
      .from('follow_up_schedule')
      .select('id, lead_id, follow_up_number, status')
      .eq('scheduled_date', today)
      .eq('status', 'pending');
    if (error) throw error;
    if (!due || due.length === 0) {
      return Response.json({ sent: 0 });
    }

    const leadIds = Array.from(
      new Set(due.map((d) => d.lead_id).filter(Boolean))
    );
    const { data: leads, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('*')
      .in('id', leadIds);
    if (leadErr) throw leadErr;

    const leadById = {};
    (leads || []).forEach((l) => {
      leadById[l.id] = l;
    });

    const oauth2Client = getOAuthClient();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let sentCount = 0;

    // 2) For each due follow-up, send email unless lead is already warm/hot/closed
    for (const item of due) {
      const lead = leadById[item.lead_id];
      if (!lead || !lead.email) {
        // Nothing to send, cancel schedule
        try {
          await supabaseAdmin
            .from('follow_up_schedule')
            .update({ status: 'cancelled' })
            .eq('id', item.id);
        } catch (err) {
          console.error('[cron/send-followups] Failed to cancel follow-up without lead/email', err);
        }
        continue;
      }

      // Skip if warm/hot/closed (already replied / engaged)
      if (['warm', 'hot', 'closed'].includes(lead.status)) {
        try {
          await supabaseAdmin
            .from('follow_up_schedule')
            .update({ status: 'cancelled' })
            .eq('id', item.id);
        } catch (err) {
          console.error('[cron/send-followups] Failed to cancel follow-up for warm/hot/closed lead', err);
        }
        continue;
      }

      try {
        const body = await buildFollowupBody({
          lead,
          followUpNumber: item.follow_up_number,
        });
        const subject = `Quick follow-up for ${lead.business_name || 'you'}`;

        const raw = Buffer.from(
          [
            `To: ${lead.email}`,
            `Subject: ${subject}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            body,
          ].join('\r\n')
        )
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const res = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw },
        });

        const gmailThreadId = res.data && res.data.threadId;
        const gmailMessageId = res.data && res.data.id;
        const sentAtIso = new Date().toISOString();

        // Log this follow-up in email_threads
        try {
          await supabaseAdmin.from('email_threads').insert({
            lead_id: lead.id,
            gmail_thread_id: gmailThreadId || null,
            gmail_message_id: gmailMessageId || null,
            subject,
            direction: 'sent',
            body,
            sent_at: sentAtIso,
          });
        } catch (threadErr) {
          console.error('[cron/send-followups] Failed to insert email_threads row', threadErr);
        }

        // Update schedule status -> sent
        try {
          await supabaseAdmin
            .from('follow_up_schedule')
            .update({ status: 'sent' })
            .eq('id', item.id);
        } catch (statusErr) {
          console.error('[cron/send-followups] Failed to update follow_up_schedule status', statusErr);
        }

        sentCount += 1;
      } catch (sendErr) {
        console.error(
          '[cron/send-followups] Failed to send follow-up for lead',
          lead.email,
          sendErr
        );
        // Do not crash the entire cron run
      }
    }

    return Response.json({ sent: sentCount });
  } catch (error) {
    console.error('[cron/send-followups] Fatal error', error);
    return Response.json(
      { error: error.message || 'send-followups failed' },
      { status: 500 }
    );
  }
}

