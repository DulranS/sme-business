/**
 * Lifecycle_Runner — post-close follow-up scheduling and idempotent sending for
 * the canonical RespondLeadz pipeline.
 *
 * When a Close_Event has been recorded, the Lifecycle_Runner schedules the
 * post-close follow-up actions defined for the owning tenant: exactly one
 * pending {@link FollowUpAction} per tenant-defined step (Requirement 10.1).
 * Scheduling is idempotent — the `follow_up_actions_event_step_key` unique
 * constraint on `(close_event_id, action_type)` plus an `ON CONFLICT DO NOTHING`
 * write mean re-scheduling the same Close_Event never creates duplicate actions.
 *
 * A daily cron drains due actions: for each pending action whose `scheduled_for`
 * has arrived, it sends the follow-up message via the Outbound_Sender
 * (Requirement 10.2) and marks the action completed so it is never sent again
 * (Requirement 10.4). Marking completed is guarded by `status = 'pending'`, so
 * running the runner two or more times sends each due action exactly once
 * (idempotent sending). The cron is scheduled at most once per day per job to
 * respect Vercel Hobby limits (Requirements 10.3, 14.5).
 *
 * Consent gates every send: a customer who has not granted consent or who has
 * opted out is skipped and receives zero follow-up messages (Requirements 18.2,
 * 18.4). The action stays pending (never sent) rather than being marked
 * completed, so it is simply re-evaluated and skipped again on later runs.
 *
 * All tenant-scoped reads and writes run through {@link withTenantContext} so
 * Row Level Security scopes them to the owning tenant; per-tenant WhatsApp
 * credentials are read only within the owning context via
 * {@link getTenantCredentials} (Requirements 12.2, 13.4).
 *
 * Feature: respond-leadz
 * Requirements: 10.1, 10.2, 10.3, 10.4, 14.5, 18.2, 18.4
 */

import type { FollowUpAction, Tenant } from './types'
import { withTenantContext, getTenantCredentials, listTenantIds } from './tenant'
import { getConsent as defaultGetConsent, type CustomerConsent } from './consent'
import { send as defaultSend } from './outbound-sender'
import { logger } from '../logger'

/** Milliseconds in one day, used to offset a step's due time from the close. */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * One step in a tenant's post-close follow-up plan. Each step becomes exactly
 * one pending {@link FollowUpAction} when a Close_Event is scheduled
 * (Requirement 10.1). `actionType` is the tenant-defined step identifier (also
 * the conflict key that keeps scheduling idempotent); `delayDays` offsets the
 * step's due time from the close; `message` is the plain-text body delivered to
 * the customer when the step is due.
 */
export interface FollowUpStep {
  /** Tenant-defined step identifier; unique within a plan. */
  actionType: string
  /** Days after the close at which this step becomes due. */
  delayDays: number
  /** Plain-text message body sent when the step is due. */
  message: string
}

/**
 * The default post-close follow-up plan applied when a tenant has not defined a
 * custom plan. Modeled on the existing post-close lifecycle stages: confirm the
 * purchase immediately, check delivery, ask for a review, nudge a reorder, then
 * a win-back. Each step is sent at most once.
 */
export const DEFAULT_FOLLOW_UP_PLAN: readonly FollowUpStep[] = [
  {
    actionType: 'pending_delivery',
    delayDays: 0,
    message:
      'Thanks for your order! We are getting it ready and will keep you posted on delivery.',
  },
  {
    actionType: 'delivery_check',
    delayDays: 3,
    message: 'Just checking in — did your order arrive safely and as expected?',
  },
  {
    actionType: 'review_ask',
    delayDays: 4,
    message:
      'We hope you are enjoying your purchase. Would you mind sharing a quick review of your experience?',
  },
  {
    actionType: 'reorder_nudge',
    delayDays: 21,
    message: 'Running low or need anything else? Reply here and we will sort you out.',
  },
  {
    actionType: 'winback_monitor',
    delayDays: 60,
    message: 'It has been a while! We would love to help with your next order whenever you are ready.',
  },
] as const

/** Injectable dependencies for the runner, primarily for testability. */
export interface LifecycleDeps {
  /** Reads a customer's consent state; defaults to the consent module. */
  getConsent?: (tenantId: string, phone: string) => Promise<CustomerConsent | null>
  /** Sends a WhatsApp message; defaults to the Outbound_Sender. */
  send?: (tenant: Tenant, to: string, body: string, replyTo?: string) => Promise<void>
  /** Loads the owning tenant's credentials; defaults to the Tenant_Manager. */
  getTenantCredentials?: (tenantId: string) => Promise<Tenant>
  /** The "now" used to decide which actions are due; defaults to the wall clock. */
  now?: Date
  /** The follow-up plan supplying message bodies; defaults to {@link DEFAULT_FOLLOW_UP_PLAN}. */
  plan?: readonly FollowUpStep[]
}

/** Outcome of draining due follow-up actions for one tenant. */
export interface RunResult {
  /** The tenant whose actions were processed. */
  tenantId: string
  /** Number of due actions considered. */
  processed: number
  /** Number of follow-up messages sent and marked completed. */
  sent: number
  /** Number skipped because the customer lacked consent or had opted out. */
  skipped: number
  /** Number whose send failed (left pending for a later run). */
  failed: number
}

/** A follow-up action row as returned by the database. */
interface FollowUpActionRow {
  id: string
  tenant_id: string
  close_event_id: string
  action_type: string
  scheduled_for: string
  status: 'pending' | 'completed'
  sent_at: string | null
}

/** A due action joined with the customer phone number from its close event. */
interface DueActionRow {
  id: string
  action_type: string
  close_event_id: string
  phone_number: string
}

function toFollowUpAction(row: FollowUpActionRow): FollowUpAction {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    close_event_id: row.close_event_id,
    action_type: row.action_type,
    scheduled_for: row.scheduled_for,
    status: row.status,
    sent_at: row.sent_at,
  }
}

/** Resolve a close timestamp argument to a Date, throwing on an invalid value. */
function toDate(closedAt: string | Date): Date {
  const date = closedAt instanceof Date ? closedAt : new Date(closedAt)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('A valid close timestamp is required to schedule follow-ups')
  }
  return date
}

/**
 * Schedule the post-close follow-up actions for a recorded Close_Event:
 * exactly one pending {@link FollowUpAction} per step in the tenant's plan
 * (Requirement 10.1). Each action's `scheduled_for` is the close time offset by
 * the step's `delayDays`.
 *
 * Scheduling is idempotent: the `(close_event_id, action_type)` unique
 * constraint with `ON CONFLICT DO NOTHING` means scheduling the same Close_Event
 * again creates no duplicate actions. The returned array contains only the
 * actions newly created by this call (empty when all already existed).
 *
 * The write runs inside {@link withTenantContext}, so each row is scoped to the
 * owning tenant by RLS (Requirements 12.1, 12.2).
 *
 * @param tenantId     The owning tenant's UUID; establishes the RLS context.
 * @param closeEventId The Close_Event the follow-ups belong to.
 * @param closedAt     The close timestamp the schedule is offset from.
 * @param plan         The tenant follow-up plan; defaults to {@link DEFAULT_FOLLOW_UP_PLAN}.
 * @returns The follow-up actions newly created by this call.
 */
export async function scheduleFollowUps(
  tenantId: string,
  closeEventId: string,
  closedAt: string | Date,
  plan: readonly FollowUpStep[] = DEFAULT_FOLLOW_UP_PLAN
): Promise<FollowUpAction[]> {
  const base = toDate(closedAt)

  return withTenantContext(tenantId, async (ctx) => {
    const created: FollowUpAction[] = []
    for (const step of plan) {
      const scheduledFor = new Date(base.getTime() + step.delayDays * DAY_MS).toISOString()
      const result = await ctx.query<FollowUpActionRow>(
        `INSERT INTO follow_up_actions
                (tenant_id, close_event_id, action_type, scheduled_for, status)
         VALUES ($1, $2, $3, $4, 'pending')
         ON CONFLICT (close_event_id, action_type) DO NOTHING
         RETURNING id, tenant_id, close_event_id, action_type, scheduled_for, status, sent_at`,
        [tenantId, closeEventId, step.actionType, scheduledFor]
      )
      if ((result.rowCount ?? 0) > 0) {
        created.push(toFollowUpAction(result.rows[0]))
      }
    }

    logger.info('Scheduled post-close follow-up actions', {
      type: 'lifecycle',
      tenantId,
      closeEventId,
      planSteps: plan.length,
      created: created.length,
    })

    return created
  })
}

/** Find the message body for a due action from the plan, with a safe fallback. */
function messageForAction(actionType: string, plan: readonly FollowUpStep[]): string {
  const step = plan.find((s) => s.actionType === actionType)
  return step?.message ?? 'Thanks again for your business — we are here if you need anything.'
}

/**
 * Send all due follow-up actions for a single tenant and mark each completed,
 * idempotently. A due action is a `pending` action whose `scheduled_for` has
 * arrived (Requirement 10.2). For each one:
 *
 *  - the customer's consent is checked first; a customer with no consent record,
 *    with consent not granted, or who has opted out is skipped and sent nothing
 *    (Requirements 18.2, 18.4);
 *  - otherwise the follow-up message is delivered via the Outbound_Sender, and
 *    the action is marked `completed` with a `sent_at` timestamp, guarded by
 *    `status = 'pending'` so a repeated run sends it exactly once (Requirement
 *    10.4);
 *  - a send failure leaves the action pending so a later run can retry it.
 *
 * Tenant credentials are loaded within the owning context (Requirement 13.4),
 * and reads/writes are RLS-scoped to the tenant (Requirement 12.2).
 *
 * @param tenantId The tenant whose due actions to drain.
 * @param deps     Optional injected dependencies (consent, send, clock, plan).
 * @returns Counts of processed/sent/skipped/failed actions.
 */
export async function runDueFollowUps(
  tenantId: string,
  deps: LifecycleDeps = {}
): Promise<RunResult> {
  const now = deps.now ?? new Date()
  const getConsent = deps.getConsent ?? defaultGetConsent
  const send = deps.send ?? defaultSend
  const loadTenant = deps.getTenantCredentials ?? getTenantCredentials
  const plan = deps.plan ?? DEFAULT_FOLLOW_UP_PLAN

  // Phase 1: read the due actions (with customer phone) in a short transaction.
  const due = await withTenantContext(tenantId, async (ctx) => {
    const result = await ctx.query<DueActionRow>(
      `SELECT fa.id, fa.action_type, fa.close_event_id, ce.phone_number
         FROM follow_up_actions fa
         JOIN close_events ce ON ce.id = fa.close_event_id
        WHERE fa.status = 'pending'
          AND fa.scheduled_for <= $1
        ORDER BY fa.scheduled_for ASC`,
      [now.toISOString()]
    )
    return result.rows
  })

  const summary: RunResult = { tenantId, processed: due.length, sent: 0, skipped: 0, failed: 0 }
  if (due.length === 0) {
    return summary
  }

  // Credentials are read only within the owning tenant's context (Req 13.4).
  const tenant = await loadTenant(tenantId)

  for (const action of due) {
    // Consent gate: never message a customer without consent or who opted out
    // (Requirements 18.2, 18.4). Leave the action pending; do not mark it sent.
    const consent = await getConsent(tenantId, action.phone_number)
    if (!consent || consent.consent_granted !== true || consent.opted_out === true) {
      summary.skipped++
      logger.info('Skipped follow-up: customer lacks consent or has opted out', {
        type: 'lifecycle',
        tenantId,
        phone: action.phone_number,
        actionType: action.action_type,
        hasConsentRecord: consent !== null,
      })
      continue
    }

    const body = messageForAction(action.action_type, plan)
    try {
      await send(tenant, action.phone_number, body)
    } catch (error) {
      // Send failed: leave the action pending so a later run can retry it.
      summary.failed++
      logger.error(
        'Follow-up send failed; action left pending for retry',
        {
          type: 'lifecycle',
          tenantId,
          phone: action.phone_number,
          actionType: action.action_type,
        },
        error as Error
      )
      continue
    }

    // Mark completed idempotently: the `status = 'pending'` guard ensures a
    // repeated run cannot send or re-complete the same action (Requirement 10.4).
    await withTenantContext(tenantId, async (ctx) => {
      await ctx.query(
        `UPDATE follow_up_actions
            SET status = 'completed', sent_at = NOW()
          WHERE id = $1 AND status = 'pending'`,
        [action.id]
      )
    })
    summary.sent++
    logger.info('Sent follow-up and marked completed', {
      type: 'lifecycle',
      tenantId,
      phone: action.phone_number,
      actionType: action.action_type,
    })
  }

  return summary
}

/**
 * Drain due follow-up actions for every tenant. Used by the daily cron, which
 * runs at most once per day per job under Vercel Hobby limits (Requirements
 * 10.3, 14.5). A failure processing one tenant is logged and does not prevent
 * the remaining tenants from being processed.
 *
 * @param deps Optional injected dependencies forwarded to {@link runDueFollowUps}.
 * @returns The per-tenant {@link RunResult} for every tenant processed.
 */
export async function runDueFollowUpsForAllTenants(
  deps: LifecycleDeps = {}
): Promise<RunResult[]> {
  const tenantIds = await listTenantIds()
  const results: RunResult[] = []

  for (const tenantId of tenantIds) {
    try {
      results.push(await runDueFollowUps(tenantId, deps))
    } catch (error) {
      logger.error(
        'Lifecycle run failed for tenant; continuing with remaining tenants',
        { type: 'lifecycle', tenantId },
        error as Error
      )
      results.push({ tenantId, processed: 0, sent: 0, skipped: 0, failed: 0 })
    }
  }

  return results
}
