import { google } from 'googleapis';
import { supabaseAdmin } from '../../../../lib/supabaseClient';
import { handleIncomingReply } from '../../../../lib/ai-responder';

function getOAuthClient() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth or refresh token env vars missing for cron/check-replies');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export async function GET() {
  if (!supabaseAdmin) {
    return Response.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    const oauth2Client = getOAuthClient();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get all sent threads we know about in Supabase
    const { data: sentThreads, error: sentErr } = await supabaseAdmin
      .from('email_threads')
      .select('id, lead_id, gmail_thread_id, subject, direction')
      .eq('direction', 'sent');

    if (sentErr) throw sentErr;
    if (!sentThreads || sentThreads.length === 0) {
      return Response.json({ processedReplies: 0 });
    }

    // Fetch leads for these threads
    const leadIds = Array.from(
      new Set(sentThreads.map((t) => t.lead_id).filter(Boolean))
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

    // Known gmail_message_ids so we don't process the same message twice
    const { data: allMsgs, error: msgErr } = await supabaseAdmin
      .from('email_threads')
      .select('gmail_message_id');
    if (msgErr) throw msgErr;

    const seenMessageIds = new Set(
      (allMsgs || [])
        .map((m) => m.gmail_message_id)
        .filter((id) => !!id)
    );

    let processedReplies = 0;

    // Iterate over known threads; fail-soft per thread
    for (const threadRow of sentThreads) {
      const lead = leadById[threadRow.lead_id];
      if (!lead || !threadRow.gmail_thread_id) continue;

      try {
        const thread = await gmail.users.threads.get({
          userId: 'me',
          id: threadRow.gmail_thread_id,
          format: 'full',
        });

        const messages = thread.data.messages || [];

        for (const message of messages) {
          if (!message || !message.id) continue;
          if (seenMessageIds.has(message.id)) continue;

          const headers = (message.payload && message.payload.headers) || [];
          const fromHeader = headers.find((h) => h.name === 'From');
          const toHeader = headers.find((h) => h.name === 'To');
          const from = (fromHeader && fromHeader.value) || '';
          const to = (toHeader && toHeader.value) || '';

          // Very simple heuristic: if FROM is not our Gmail and TO looks like our address, treat as inbound reply
          const isInbound =
            from &&
            !from.toLowerCase().includes('me') &&
            !from.toLowerCase().includes('@gmail.com') &&
            to &&
            to.toLowerCase().includes('@');

          if (!isInbound) {
            continue;
          }

          const snippet = message.snippet || '';

          // Log the inbound email in email_threads
          try {
            await supabaseAdmin.from('email_threads').insert({
              lead_id: lead.id,
              gmail_thread_id: threadRow.gmail_thread_id,
              gmail_message_id: message.id,
              subject: threadRow.subject || '',
              direction: 'received',
              body: snippet,
              sent_at: new Date(
                message.internalDate ? Number(message.internalDate) : Date.now()
              ).toISOString(),
            });
            seenMessageIds.add(message.id);
          } catch (insertErr) {
            console.error(
              '[cron/check-replies] Failed to insert inbound email into email_threads',
              insertErr
            );
          }

          // Cancel any pending follow-ups for this lead
          try {
            await supabaseAdmin
              .from('follow_up_schedule')
              .update({ status: 'cancelled' })
              .eq('lead_id', lead.id)
              .eq('status', 'pending');
          } catch (fuErr) {
            console.error(
              '[cron/check-replies] Failed to cancel follow-ups',
              fuErr
            );
          }

          // Delegate to AI responder (intent classification + optional reply)
          try {
            await handleIncomingReply({ lead, gmail, message, threadRow });
          } catch (aiErr) {
            console.error(
              '[cron/check-replies] handleIncomingReply failed',
              aiErr
            );
          }

          processedReplies += 1;
        }
      } catch (threadErr) {
        console.error(
          '[cron/check-replies] Failed to process thread',
          threadRow.gmail_thread_id,
          threadErr
        );
      }
    }

    return Response.json({ processedReplies });
  } catch (error) {
    console.error('[cron/check-replies] Fatal error', error);
    return Response.json(
      { error: error.message || 'check-replies failed' },
      { status: 500 }
    );
  }
}

