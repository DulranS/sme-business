// app/api/cron/check-replies/route.ts - Cron endpoint (runs every 15 min)
import { NextResponse } from 'next/server';
import { ReplyHandler } from '@/lib/reply-handler';
import { AIResponder } from '@/lib/ai-responder';

export async function GET() {
  try {
    console.log('🔄 Starting reply check cron job');
    
    // Verify this is a cron request (add your security logic here)
    const authHeader = process.env.CRON_SECRET;
    if (authHeader && authHeader !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize handlers
    const replyHandler = new ReplyHandler('system'); // Use system user for cron
    const aiResponder = new AIResponder('system');

    // Poll for new replies
    const replies = await replyHandler.pollForReplies();
    console.log(`📧 Found ${replies.length} new replies`);

    let processedCount = 0;
    let errorCount = 0;

    // Process each reply
    for (const reply of replies) {
      try {
        console.log(`🤖 Processing reply from ${reply.fromEmail} (intent: ${reply.intent})`);
        
        // Generate and send AI response
        await aiResponder.handleReply(reply.leadId, {
          fromEmail: reply.fromEmail,
          subject: reply.subject,
          body: reply.body,
          intent: reply.intent as 'interested' | 'not_interested' | 'needs_more_info' | 'out_of_office' | 'unsubscribe',
        });

        processedCount++;
        console.log(`✅ Processed reply from ${reply.fromEmail}`);

      } catch (error) {
        console.error(`❌ Error processing reply from ${reply.fromEmail}:`, error);
        errorCount++;
      }
    }

    console.log(`✨ Reply check completed: ${processedCount} processed, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      processed: processedCount,
      errors: errorCount,
      totalFound: replies.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Reply check cron job failed:', error);
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
