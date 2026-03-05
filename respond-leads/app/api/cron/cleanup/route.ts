import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// Cleanup endpoint for Vercel cron jobs
// Runs daily to clean up old data and optimize performance

export async function POST() {
  try {
    const supabase = createSupabaseServerClient()
    
    // Clean up old conversation history (keep last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { error: conversationError } = await supabase
      .from('conversations')
      .update({ 
        history: '', // Reset very old conversations
        updated_at: new Date().toISOString()
      })
      .lt('updated_at', thirtyDaysAgo.toISOString())
      .eq('history', '') // Only update conversations that haven't been updated recently
    
    if (conversationError) {
      logger.error('Failed to cleanup old conversations', { error: conversationError })
    }

    // Clean up orphaned data (if any)
    const { error: cleanupError } = await supabase
      .rpc('optimize_database', {})
    
    if (cleanupError) {
      logger.error('Failed to optimize database', { error: cleanupError })
    }

    // Get statistics for monitoring
    const { count: inventoryCount } = await supabase
      .from('inventory')
      .select('*', { count: 'exact' })
      .single()
    
    const { count: conversationCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact' })
      .single()

    logger.info('Cron cleanup completed', {
      inventoryItems: inventoryCount || 0,
      conversations: conversationCount || 0,
      cleanedConversations: conversationError ? 'failed' : 'success'
    })

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed successfully',
      stats: {
        inventoryItems: inventoryCount || 0,
        conversations: conversationCount || 0,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    logger.error('Cron cleanup failed', { error }, error as Error)
    return NextResponse.json({
      success: false,
      message: 'Cleanup failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
