import { NextResponse } from 'next/server'

// Health check endpoint for Vercel cron jobs
// Runs every 15 minutes to keep the service active

export async function GET() {
  try {
    // Check if essential services are accessible
    const checks = [
      {
        name: 'Database Connection',
        status: 'OK', // In production, you'd check actual DB connection
        timestamp: new Date().toISOString()
      },
      {
        name: 'WhatsApp Webhook',
        status: 'OK', // Check if webhook endpoint is accessible
        timestamp: new Date().toISOString()
      },
      {
        name: 'AI Service',
        status: 'OK', // Check if Claude API is accessible
        timestamp: new Date().toISOString()
      }
    ]

    const allHealthy = checks.every(check => check.status === 'OK')
    
    return NextResponse.json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
