/**
 * Daily post-close lifecycle cron endpoint.
 *
 * Drains due post-close follow-up actions across all tenants: each due action
 * is sent via the Outbound_Sender and marked completed idempotently, while
 * customers without consent or who have opted out are skipped (Requirements
 * 10.2, 10.4, 18.2, 18.4). This job is scheduled at most once per day (see
 * `vercel.json`) to respect Vercel Hobby limits (Requirements 10.3, 14.5).
 *
 * Authentication: Vercel Cron attaches `Authorization: Bearer <CRON_SECRET>`
 * when the `CRON_SECRET` environment variable is configured. This endpoint
 * sends customer-facing messages, so when `CRON_SECRET` is set the header is
 * required and mismatches are rejected with HTTP 401. When `CRON_SECRET` is not
 * configured the endpoint runs unauthenticated and logs a warning — set
 * `CRON_SECRET` in production to prevent the lifecycle from being triggered by
 * arbitrary callers.
 *
 * Feature: respond-leadz
 * Requirements: 10.2, 10.3, 10.4, 14.5, 18.2, 18.4
 */

import { NextResponse } from 'next/server'
import { runDueFollowUpsForAllTenants } from '@/lib/pipeline/lifecycle'
import { logger } from '@/lib/logger'

/** This route performs database and network work; never statically optimized. */
export const dynamic = 'force-dynamic'

/**
 * Verify the cron request is authorized. Returns true when authorized, false
 * when a configured `CRON_SECRET` does not match the request's bearer token.
 * When no `CRON_SECRET` is configured, returns true but logs a warning that the
 * endpoint is unauthenticated.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.trim() === '') {
    logger.warn('Lifecycle cron is running without CRON_SECRET configured; endpoint is unauthenticated', {
      type: 'lifecycle',
    })
    return true
  }
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

async function handle(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    logger.warn('Rejected unauthorized lifecycle cron request', { type: 'lifecycle' })
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runDueFollowUpsForAllTenants()

    const totals = results.reduce(
      (acc, r) => ({
        processed: acc.processed + r.processed,
        sent: acc.sent + r.sent,
        skipped: acc.skipped + r.skipped,
        failed: acc.failed + r.failed,
      }),
      { processed: 0, sent: 0, skipped: 0, failed: 0 }
    )

    logger.info('Lifecycle cron completed', {
      type: 'lifecycle',
      tenants: results.length,
      ...totals,
    })

    return NextResponse.json({
      success: true,
      tenants: results.length,
      totals,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Lifecycle cron failed', { type: 'lifecycle' }, error as Error)
    return NextResponse.json(
      {
        success: false,
        message: 'Lifecycle run failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/** Vercel Cron issues GET requests to scheduled endpoints. */
export async function GET(request: Request): Promise<NextResponse> {
  return handle(request)
}

/** Allow POST for manual/administrative triggering with the same auth guard. */
export async function POST(request: Request): Promise<NextResponse> {
  return handle(request)
}
