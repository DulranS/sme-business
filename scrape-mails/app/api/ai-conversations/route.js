import { supabaseAdmin } from '../../../lib/supabaseClient';

export async function GET() {
  if (!supabaseAdmin) {
    return Response.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    const [aiRes, followups, hot] = await Promise.all([
      supabaseAdmin
        .from('ai_responses')
        .select('id, intent, ai_reply, sent_at, leads(id, business_name, email, status)')
        .order('sent_at', { ascending: false }),
      supabaseAdmin
        .from('follow_up_schedule')
        .select('id, follow_up_number, status, scheduled_date, leads(id, business_name, email, status)')
        .eq('scheduled_date', today)
        .eq('status', 'pending'),
      supabaseAdmin
        .from('leads')
        .select('id, business_name, email, status')
        .eq('status', 'hot'),
    ]);

    if (aiRes.error) throw aiRes.error;
    if (followups.error) throw followups.error;
    if (hot.error) throw hot.error;

    const responses = aiRes.data || [];
    const followupToday = followups.data || [];
    const hotLeads = hot.data || [];

    const totalReplies = responses.length;
    const interestedCount = responses.filter(
      (r) => r.intent === 'interested'
    ).length;
    const resolvedCount = responses.filter((r) =>
      ['interested', 'not_interested', 'unsubscribe'].includes(r.intent)
    ).length;
    const aiResolutionRate = totalReplies
      ? Math.round((resolvedCount / totalReplies) * 100)
      : 0;

    const { count: followupsSentCount } = await supabaseAdmin
      .from('follow_up_schedule')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');

    return Response.json({
      leadsWithReplies: responses,
      hotLeads,
      followupToday,
      stats: {
        totalReplies,
        interestedCount,
        aiResolutionRate,
        followupsSent: followupsSentCount || 0,
      },
    });
  } catch (error) {
    console.error('[api/ai-conversations] Failed', error);
    return Response.json(
      { error: error.message || 'Failed to load AI conversations' },
      { status: 500 }
    );
  }
}

