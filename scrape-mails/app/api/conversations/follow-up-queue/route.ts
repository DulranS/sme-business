// app/api/conversations/follow-up-queue/route.ts - Follow-up queue API endpoint
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get follow-up queue for today
    const today = new Date().toISOString().split('T')[0];
    
    const { data: queue, error } = await supabaseAdmin
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
      .lte('scheduled_for', new Date().toISOString())
      .eq('leads.ai_conversation_active', true)
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('Error fetching follow-up queue:', error);
      return NextResponse.json({ error: 'Failed to fetch follow-up queue' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      queue: queue || [],
    });

  } catch (error) {
    console.error('Follow-up queue API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
