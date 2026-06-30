/**
 * RateLimiter / Queue — burst queuing and spaced draining for the canonical
 * RespondLeadz pipeline.
 *
 * Two concerns are implemented here:
 *
 *  1. **Burst queuing (Requirements 14.1, 15.3).** Inbound volume is tracked per
 *     phone number over a sliding 60-second window. While at most
 *     {@link BURST_LIMIT} (50) messages have arrived from a single phone number
 *     within any 60-second window, messages are processed immediately. The
 *     excess — every message beyond 50 in the window — is deferred to the
 *     `inbound_queue` table instead of being processed inline. Excess messages
 *     are never dropped; they are enqueued for deferred processing (Requirement
 *     15.3).
 *
 *  2. **Spaced draining (Requirement 14.4).** Queued messages for a single phone
 *     number are released with a minimum spacing of {@link MIN_SEND_SPACING_MS}
 *     (5s) between consecutive sends. The spacing is encoded in the
 *     `inbound_queue.process_after` timestamp at enqueue time: each newly
 *     enqueued message for a phone number is stamped at least 5 seconds after
 *     the latest already-pending message for that same phone number. The drainer
 *     then releases only messages whose `process_after` has elapsed, so
 *     consecutive sends to one phone number are always at least 5 seconds apart.
 *
 * The per-phone volume window is in-memory and per-instance: it is a cheap guard
 * that decides immediate-vs-deferred for a single serverless invocation. The
 * durable queue (`inbound_queue`) is the source of truth for deferred work and
 * survives across invocations. All queue reads and writes run inside
 * {@link withTenantContext} so rows are scoped to the owning tenant by RLS
 * (Requirements 12.1, 12.2).
 *
 * Feature: respond-leadz
 * Requirements: 14.1, 14.4, 15.3
 */

import { withTenantContext } from './tenant'
import { logger } from '../logger'

/**
 * Maximum number of inbound messages from a single phone number that are
 * processed immediately within any {@link BURST_WINDOW_MS} window. Messages
 * beyond this count in the window are deferred to the queue (Requirement 14.1).
 */
export const BURST_LIMIT = 50

/** Length of the sliding burst window, in milliseconds (60 seconds, Requirement 14.1). */
export const BURST_WINDOW_MS = 60_000

/**
 * Minimum spacing between consecutive queued sends to a single phone number, in
 * milliseconds (5 seconds, Requirement 14.4).
 */
export const MIN_SEND_SPACING_MS = 5_000

/** A reference to an inbound message to be deferred. */
export interface InboundMessageRef {
  /** Sender phone number. */
  phoneNumber: string
  /** WhatsApp message id (also the Idempotency_Key). */
  messageId: string
  /** The deferred message payload, persisted as JSONB for later processing. */
  payload: unknown
}

/** A row drained from the `inbound_queue` table. */
export interface QueuedInbound {
  id: string
  tenant_id: string
  phone_number: string
  message_id: string
  payload: unknown
  enqueued_at: string
  process_after: string
  status: 'pending' | 'done'
}

/** The outcome of registering an inbound arrival against the burst window. */
export interface ArrivalDecision {
  /** Count of arrivals from this phone number within the current 60s window (incl. this one). */
  windowCount: number
  /**
   * True when this message exceeds the burst limit and must be deferred to the
   * queue rather than processed immediately (Requirements 14.1, 15.3).
   */
  defer: boolean
}

/**
 * Per-phone sliding window of arrival timestamps (ms since epoch). Keyed by
 * `${tenantId}:${phoneNumber}`. In-memory and per-instance — a fast guard for
 * deciding immediate-vs-deferred, not a durable store.
 */
const arrivalWindows = new Map<string, number[]>()

function windowKey(tenantId: string, phoneNumber: string): string {
  return `${tenantId}:${phoneNumber}`
}

/**
 * Record an inbound arrival from a phone number and decide whether it must be
 * deferred. Prunes arrivals older than {@link BURST_WINDOW_MS} from the window,
 * appends the current arrival, and defers when more than {@link BURST_LIMIT}
 * messages have arrived within the window (Requirements 14.1, 15.3).
 *
 * The first {@link BURST_LIMIT} messages within any 60-second window are
 * processed immediately; every message beyond that is deferred.
 *
 * @param tenantId    The owning tenant's UUID.
 * @param phoneNumber The sender phone number.
 * @param now         Current time in ms since epoch (injectable for tests).
 * @returns The window count and whether this message must be deferred.
 */
export function registerArrival(
  tenantId: string,
  phoneNumber: string,
  now: number = Date.now()
): ArrivalDecision {
  const key = windowKey(tenantId, phoneNumber)
  const cutoff = now - BURST_WINDOW_MS

  const existing = arrivalWindows.get(key)
  // Keep only timestamps within the trailing 60s window, then add this arrival.
  const pruned = existing ? existing.filter((ts) => ts > cutoff) : []
  pruned.push(now)
  arrivalWindows.set(key, pruned)

  const windowCount = pruned.length
  const defer = windowCount > BURST_LIMIT

  if (defer) {
    logger.warn('Inbound burst threshold exceeded; deferring message to queue', {
      type: 'rate_limit',
      tenant: tenantId,
      phone: phoneNumber,
      windowCount,
      limit: BURST_LIMIT,
    })
  }

  return { windowCount, defer }
}

/** Parse a Postgres timestamptz string to ms since epoch. */
function toEpochMs(timestamp: string): number {
  return new Date(timestamp).getTime()
}

/**
 * Enqueue an inbound message for deferred processing, stamping it with a
 * `process_after` that maintains at least {@link MIN_SEND_SPACING_MS} between
 * consecutive queued messages to the same phone number (Requirement 14.4).
 *
 * The `process_after` is computed as the later of `now` and 5 seconds after the
 * latest already-pending message's `process_after` for the same
 * `(tenant, phone_number)`. The read and the insert run in a single tenant
 * transaction so sequential enqueues for one phone number produce a strictly
 * spaced schedule. The message is never dropped (Requirement 15.3).
 *
 * @param tenantId The owning tenant's UUID.
 * @param message  The inbound message reference to defer.
 * @param now      Current time in ms since epoch (injectable for tests).
 * @returns The persisted queue row.
 */
export async function enqueueInbound(
  tenantId: string,
  message: InboundMessageRef,
  now: number = Date.now()
): Promise<QueuedInbound> {
  return withTenantContext(tenantId, async (ctx) => {
    // Find the latest scheduled send for this phone number among pending items
    // so the new message is spaced at least 5s after it (Requirement 14.4).
    const last = await ctx.query<{ process_after: string }>(
      `SELECT process_after
         FROM inbound_queue
        WHERE tenant_id = $1
          AND phone_number = $2
          AND status = 'pending'
        ORDER BY process_after DESC
        LIMIT 1`,
      [tenantId, message.phoneNumber]
    )

    let processAfterMs = now
    if (last.rowCount && last.rowCount > 0) {
      const lastMs = toEpochMs(last.rows[0].process_after)
      processAfterMs = Math.max(now, lastMs + MIN_SEND_SPACING_MS)
    }

    const processAfter = new Date(processAfterMs).toISOString()

    const inserted = await ctx.query<QueuedInbound>(
      `INSERT INTO inbound_queue
              (tenant_id, phone_number, message_id, payload, process_after, status)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'pending')
       RETURNING id, tenant_id, phone_number, message_id, payload,
                 enqueued_at, process_after, status`,
      [
        tenantId,
        message.phoneNumber,
        message.messageId,
        JSON.stringify(message.payload ?? null),
        processAfter,
      ]
    )

    const row = inserted.rows[0]
    logger.info('Inbound message enqueued for deferred processing', {
      type: 'rate_limit',
      tenant: tenantId,
      phone: message.phoneNumber,
      messageId: message.messageId,
      processAfter: row.process_after,
    })
    return row
  })
}

/**
 * The result of a single queue drain pass.
 */
export interface DrainResult {
  /** Number of queued messages released and marked done in this pass. */
  drained: number
  /** Number of released messages whose handler failed (left pending for retry). */
  failed: number
}

/**
 * Drain due queued messages and release them through `handler`, respecting the
 * 5-second spacing encoded in `process_after` (Requirement 14.4).
 *
 * Only messages whose `process_after` has elapsed (`<= now`) are released, in
 * ascending `process_after` order per phone number, so consecutive sends to a
 * single phone number are at least {@link MIN_SEND_SPACING_MS} apart. Each
 * successfully handled message is marked `done`; if a handler throws, the
 * message is left `pending` so it can be retried on a later drain (it is never
 * dropped, Requirement 15.3).
 *
 * @param tenantId The owning tenant's UUID.
 * @param handler  Callback that performs the deferred send for one message.
 * @param now      Current time in ms since epoch (injectable for tests).
 * @returns Counts of drained and failed messages.
 */
export async function drainDueInbound(
  tenantId: string,
  handler: (item: QueuedInbound) => Promise<void>,
  now: number = Date.now()
): Promise<DrainResult> {
  const nowIso = new Date(now).toISOString()

  const due = await withTenantContext(tenantId, async (ctx) => {
    const result = await ctx.query<QueuedInbound>(
      `SELECT id, tenant_id, phone_number, message_id, payload,
              enqueued_at, process_after, status
         FROM inbound_queue
        WHERE tenant_id = $1
          AND status = 'pending'
          AND process_after <= $2
        ORDER BY phone_number ASC, process_after ASC`,
      [tenantId, nowIso]
    )
    return result.rows
  })

  let drained = 0
  let failed = 0

  for (const item of due) {
    try {
      await handler(item)
    } catch (error) {
      failed += 1
      logger.error(
        'Draining queued inbound message failed; leaving it pending for retry',
        {
          type: 'rate_limit',
          tenant: tenantId,
          phone: item.phone_number,
          messageId: item.message_id,
        },
        error as Error
      )
      continue
    }

    await withTenantContext(tenantId, async (ctx) => {
      await ctx.query(
        `UPDATE inbound_queue SET status = 'done' WHERE id = $1 AND tenant_id = $2`,
        [item.id, tenantId]
      )
    })
    drained += 1
  }

  if (drained > 0 || failed > 0) {
    logger.info('Inbound queue drain completed', {
      type: 'rate_limit',
      tenant: tenantId,
      drained,
      failed,
    })
  }

  return { drained, failed }
}

/**
 * Clear the in-memory burst windows. Intended for tests that exercise burst
 * deferral deterministically.
 */
export function __resetWindowsForTesting(): void {
  arrivalWindows.clear()
}
