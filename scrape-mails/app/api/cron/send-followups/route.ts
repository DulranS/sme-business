// app/api/cron/send-followups/route.ts - Cron endpoint (runs daily 9am)
import { NextResponse } from 'next/server';
import { FollowUpScheduler } from '@/lib/follow-up-scheduler';

export async function GET() {
  try {
    console.log('📅 Starting follow-up scheduler cron job');
    
    // Verify this is a cron request (add your security logic here)
    const authHeader = process.env.CRON_SECRET;
    if (authHeader && authHeader !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize follow-up scheduler
    const scheduler = new FollowUpScheduler('system');

    // Process all follow-ups due today
    await scheduler.processDueFollowUps();

    // Get follow-up queue for dashboard
    const queue = await scheduler.getFollowUpQueue();
    
    // Get hot leads
    const hotLeads = await scheduler.getHotLeads();
    
    // Get statistics
    const stats = await scheduler.getConversationStats();

    console.log(`✨ Follow-up scheduler completed: ${queue.length} in queue, ${hotLeads.length} hot leads`);

    return NextResponse.json({
      success: true,
      followUpQueue: queue.length,
      hotLeads: hotLeads.length,
      stats: stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Follow-up scheduler cron job failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Support POST requests for testing
export async function POST() {
  return GET();
}
