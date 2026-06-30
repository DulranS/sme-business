/**
 * Health-check endpoint.
 *
 * Reports whether RespondLeadz can reach its two external dependencies: the
 * database and the WhatsApp Business Cloud API (Requirement 17.4). Each
 * dependency is probed independently; the overall status is `healthy` only when
 * both are reachable, otherwise `degraded`.
 *
 * Status codes:
 *  - 200 when every dependency is reachable (`status: "healthy"`).
 *  - 503 when one or more dependencies are unreachable (`status: "degraded"`),
 *    so external uptime monitors treat the instance as not-ready.
 *
 * The response contains only non-sensitive diagnostics (reachability booleans,
 * measured latencies, and HTTP status codes). No credentials, tokens, URLs with
 * embedded secrets, or environment values are ever included in the payload.
 *
 * Feature: respond-leadz
 * Requirements: 17.4
 */

import { NextResponse } from 'next/server'
import { Config } from '@/lib/config'
import { logger } from '@/lib/logger'
import { pingDatabase } from '@/lib/pipeline/tenant'

/** This route performs live network/database probes; never statically optimized. */
export const dynamic = 'force-dynamic'

/** Maximum time to wait for the WhatsApp API reachability probe. */
const WHATSAPP_PROBE_TIMEOUT_MS = 3000

/** Reachability outcome for a single dependency. */
interface DependencyCheck {
  /** True when the dependency responded; false when unreachable. */
  reachable: boolean
  /** Round-trip time of the probe in milliseconds. */
  latencyMs: number
  /** HTTP status observed from the dependency, when applicable. */
  httpStatus?: number
}

/**
 * Probe WhatsApp Business Cloud API reachability.
 *
 * Issues a short, timeout-bounded GET to the Graph API base host. Any HTTP
 * response — including 4xx — means the API host is reachable over the network,
 * which is what this check reports; only a transport error or timeout counts as
 * unreachable. No credentials are sent or returned, so no secret can leak.
 */
async function pingWhatsApp(): Promise<DependencyCheck> {
  const startedAt = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WHATSAPP_PROBE_TIMEOUT_MS)

  try {
    const response = await fetch(Config.whatsapp.apiUrl, {
      method: 'GET',
      signal: controller.signal,
    })
    // Drain the body so the connection can be reused/released.
    await response.text().catch(() => undefined)
    return {
      reachable: true,
      latencyMs: Date.now() - startedAt,
      httpStatus: response.status,
    }
  } catch (error) {
    logger.error(
      'Health check: WhatsApp Business Cloud API is not reachable',
      { type: 'health' },
      error as Error
    )
    return { reachable: false, latencyMs: Date.now() - startedAt }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * GET /api/health — report database and WhatsApp reachability.
 *
 * Returns HTTP 200 with `status: "healthy"` when both dependencies are
 * reachable, or HTTP 503 with `status: "degraded"` otherwise.
 */
export async function GET(): Promise<NextResponse> {
  const [database, whatsapp] = await Promise.all([pingDatabase(), pingWhatsApp()])

  const healthy = database.reachable && whatsapp.reachable

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      checks: {
        database: {
          status: database.reachable ? 'up' : 'down',
          latencyMs: database.latencyMs,
        },
        whatsapp: {
          status: whatsapp.reachable ? 'up' : 'down',
          latencyMs: whatsapp.latencyMs,
          ...(whatsapp.httpStatus !== undefined ? { httpStatus: whatsapp.httpStatus } : {}),
        },
      },
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  )
}
