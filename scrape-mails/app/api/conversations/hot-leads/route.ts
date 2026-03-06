// app/api/conversations/hot-leads/route.ts - Hot leads API endpoint
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get hot leads (status = 'hot')
    const { data: hotLeads, error } = await supabaseAdmin
      .from('leads')
      .select(`
        id,
        company_name,
        contact_name,
        email,
        status,
        last_reply_intent,
        total_replies,
        follow_up_count,
        last_contacted_at,
        lead_conversations (
          message_type,
          subject,
          body,
          intent_classification,
          ai_response_sent,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'hot')
      .eq('ai_conversation_active', true)
      .order('last_contacted_at', { ascending: false });

    if (error) {
      console.error('Error fetching hot leads:', error);
      return NextResponse.json({ error: 'Failed to fetch hot leads' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hotLeads: hotLeads || [],
    });

  } catch (error) {
    console.error('Hot leads API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
