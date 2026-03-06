// app/api/conversations/stats/route.ts - Conversation statistics API endpoint
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get conversation statistics
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('status, total_replies, follow_up_count')
      .eq('user_id', userId)
      .eq('ai_conversation_active', true);

    if (error) {
      console.error('Error fetching conversation stats:', error);
      return NextResponse.json({ error: 'Failed to fetch conversation stats' }, { status: 500 });
    }

    const leadsData = leads || [];
    const totalLeads = leadsData.length;
    const interestedReplies = leadsData.filter(l => l.status === 'hot').length;
    const totalReplies = leadsData.reduce((sum, l) => sum + (l.total_replies || 0), 0);
    const averageFollowUps = leadsData.length > 0 
      ? leadsData.reduce((sum, l) => sum + (l.follow_up_count || 0), 0) / leadsData.length 
      : 0;

    const stats = {
      totalLeads,
      interestedReplies,
      totalReplies,
      averageFollowUps: Math.round(averageFollowUps * 10) / 10,
    };

    return NextResponse.json({
      success: true,
      stats,
    });

  } catch (error) {
    console.error('Conversation stats API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
