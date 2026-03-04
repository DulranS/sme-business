import OpenAI from 'openai';
import { google } from 'googleapis';
import { supabaseAdmin } from './supabaseClient';

const openaiApiKey = process.env.OPENAI_API_KEY;
const calendlyLink = process.env.CALENDLY_LINK || '';

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

function decodeBase64Url(data) {
  if (!data) return '';
  return Buffer.from(
    data.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  ).toString('utf8');
}

function extractPlainTextFromMessage(message) {
  if (!message || !message.payload) return '';
  const payload = message.payload;

  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }

  const parts = payload.parts || [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      return decodeBase64Url(part.body.data);
    }
  }

  // Fallback to snippet if nothing else is available
  return message.snippet || '';
}

async function classifyIntent(replyBody, lead) {
  if (!openai) {
    return {
      intent: 'needs_info',
      explanation: 'OPENAI_API_KEY not configured, defaulting to needs_info',
      needs_followup: true,
      suggested_reply: null,
      followup_days: 3,
      ooo_return_date: null,
    };
  }

  const system =
    'You classify inbound email replies for sales outreach. Return ONLY JSON with keys: intent, explanation, needs_followup, suggested_reply, followup_days, ooo_return_date.';

  const user = `
Lead business: ${lead?.business_name || ''}
Lead email: ${lead?.email || ''}

Reply:
"""
${replyBody}
"""

Valid intents: interested, not_interested, needs_info, out_of_office, unsubscribe.
If unsubscribe-like language appears, use "unsubscribe".
If clearly rejecting, use "not_interested".
If asking questions or details, use "needs_info".
If auto-responder, vacation, or out-of-office, use "out_of_office".
Otherwise, choose the closest.
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    return JSON.parse(completion.choices[0].message.content || '{}');
  } catch {
    return {
      intent: 'needs_info',
      explanation: 'Failed to parse JSON from model, defaulting to needs_info',
      needs_followup: true,
      suggested_reply: null,
      followup_days: 3,
      ooo_return_date: null,
    };
  }
}

async function generateReplyForIntent(intent, replyBody, lead, originalSubject) {
  if (!openai) return null;

  const businessName =
    lead?.business_name ||
    (lead?.email ? lead.email.split('@')[0] : '') ||
    'there';

  let prompt;

  if (intent === 'interested') {
    prompt = `
The lead replied and is interested.

Business: ${businessName}
Lead reply:
"""
${replyBody}
"""

Write a warm, concise reply that:
- acknowledges their interest
- briefly restates how we help (web dev, AI tools, ongoing ops)
- proposes a next step
- includes this Calendly link exactly once: ${calendlyLink}

Max 180 words. Plain text only.`;
  } else if (intent === 'needs_info') {
    prompt = `
The lead replied asking for more information or clarification.

Business: ${businessName}
Lead reply:
"""
${replyBody}
"""

Write a clear, specific reply that:
- directly answers their questions based on what a dev/automation agency can reasonably offer
- suggests a simple next step (reply, share details, or quick call)

Max 200 words. Plain text only.`;
  } else if (intent === 'out_of_office') {
    prompt = `
This is an out-of-office reply.

Business: ${businessName}
OOO message:
"""
${replyBody}
"""

1. Extract their return date if present.
2. Write a very short acknowledgement saying you'll follow up after they're back.
3. Keep it under 80 words.

Plain text only.`;
  } else {
    return null;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are a concise, practical B2B email assistant. Respond with plain text only.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const text = (completion.choices[0].message.content || '').trim();
  if (!text) return null;

  const subject =
    (originalSubject && originalSubject.startsWith('Re:'))
      ? originalSubject
      : `Re: ${originalSubject || ''}`.trim();

  return { subject, body: text };
}

async function sendThreadReply({ gmail, threadId, messageId, to, subject, body }) {
  const raw = Buffer.from(
    [
      `To: ${to}`,
      `Subject: ${subject}`,
      messageId ? `In-Reply-To: ${messageId}` : '',
      messageId ? `References: ${messageId}` : '',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ]
      .filter(Boolean)
      .join('\r\n')
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId },
  });
}

/**
 * Handle an incoming Gmail reply for a known lead/thread.
 * - Classify intent
 * - Optionally send a GPT-4o reply using existing Gmail OAuth credentials
 * - Update Supabase (leads, ai_responses, email_threads, follow_up_schedule)
 */
export async function handleIncomingReply({ lead, gmail, message, threadRow }) {
  if (!supabaseAdmin) {
    console.warn('[ai-responder] Supabase admin client not configured.');
    return null;
  }

  const replyBody = extractPlainTextFromMessage(message);
  if (!replyBody.trim()) return null;

  const intentResult = await classifyIntent(replyBody, lead);
  const intent = intentResult.intent || 'needs_info';

  let aiReplyText = null;
  let sentAt = null;

  // Never reply to unsubscribe / not_interested
  if (intent === 'interested' || intent === 'needs_info' || intent === 'out_of_office') {
    try {
      const generated = await generateReplyForIntent(
        intent,
        replyBody,
        lead,
        threadRow.subject
      );

      if (generated && lead.email) {
        const sendRes = await sendThreadReply({
          gmail,
          threadId: threadRow.gmail_thread_id,
          messageId: message.id,
          to: lead.email,
          subject: generated.subject,
          body: generated.body,
        });

        aiReplyText = generated.body;
        sentAt = new Date().toISOString();

        // Log the AI reply as a sent email in email_threads
        const gmailMessageId = sendRes.data && sendRes.data.id;
        try {
          await supabaseAdmin.from('email_threads').insert({
            lead_id: lead.id,
            gmail_thread_id: threadRow.gmail_thread_id,
            gmail_message_id: gmailMessageId || null,
            subject: generated.subject,
            direction: 'sent',
            body: generated.body,
            sent_at: sentAt,
          });
        } catch (insertErr) {
          console.error('[ai-responder] Failed to insert AI reply into email_threads', insertErr);
        }
      }
    } catch (e) {
      console.error('[ai-responder] Failed to send AI reply', e);
    }
  }

  // Save AI response metadata
  try {
    await supabaseAdmin.from('ai_responses').insert({
      lead_id: lead.id,
      thread_id: threadRow.id || null,
      intent,
      ai_reply: aiReplyText,
      sent_at: sentAt,
    });
  } catch (e) {
    console.error('[ai-responder] Failed to insert ai_responses row', e);
  }

  // State transitions in leads + follow_up_schedule
  try {
    if (intent === 'interested') {
      await supabaseAdmin.from('leads').update({ status: 'hot' }).eq('id', lead.id);
      await supabaseAdmin
        .from('follow_up_schedule')
        .update({ status: 'cancelled' })
        .eq('lead_id', lead.id)
        .eq('status', 'pending');
    } else if (intent === 'needs_info' || intent === 'out_of_office') {
      await supabaseAdmin.from('leads').update({ status: 'warm' }).eq('id', lead.id);

      if (intent === 'out_of_office') {
        const maybeDate = intentResult.ooo_return_date;
        let target = null;
        if (maybeDate) {
          const parsed = new Date(maybeDate);
          if (!Number.isNaN(parsed.getTime())) {
            target = parsed;
          }
        }
        if (!target && intentResult.followup_days) {
          target = new Date();
          target.setDate(target.getDate() + Number(intentResult.followup_days || 3));
        }
        if (target) {
          const dateOnly = target.toISOString().slice(0, 10);
          await supabaseAdmin.from('follow_up_schedule').insert({
            lead_id: lead.id,
            scheduled_date: dateOnly,
            follow_up_number: 1,
            status: 'pending',
          });
        }
      }
    } else if (intent === 'not_interested' || intent === 'unsubscribe') {
      await supabaseAdmin.from('leads').update({ status: 'closed' }).eq('id', lead.id);
      await supabaseAdmin
        .from('follow_up_schedule')
        .update({ status: 'cancelled' })
        .eq('lead_id', lead.id)
        .eq('status', 'pending');
    }
  } catch (stateErr) {
    console.error('[ai-responder] Failed to update lead/follow_up_schedule state', stateErr);
  }

  return { intent, aiReplyText, sentAt };
}

