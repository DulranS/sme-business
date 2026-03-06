// app/api/enterprise/health/route.ts - Enterprise health monitoring API
import { NextResponse } from 'next/server';
import { monitoring } from '@/lib/enterprise-monitoring';
import { rateLimiter } from '@/lib/enterprise-rate-limiter';

export async function GET() {
  try {
    // Rate limiting for health checks
    const rateLimit = await rateLimiter.checkLimit('health-check', 'system');
    if (!rateLimit.allowed) {
      return NextResponse.json({
        status: 'rate_limited',
        retryAfter: rateLimit.retryAfter
      }, { status: 429 });
    }

    // Get system health
    const health = await monitoring.getSystemHealth();

    return NextResponse.json({
      success: true,
      health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health check API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
