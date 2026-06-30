/**
 * Property-based tests for the Lifecycle_Runner.
 *
 * Three properties are covered:
 *   - Property 17: Follow-up scheduling matches the tenant plan (Req 10.1).
 *     `scheduleFollowUps` creates exactly one pending action per plan step, with
 *     `scheduled_for = closedAt + delayDays`, and is idempotent — re-running for
 *     the same close event creates no duplicates (ON CONFLICT DO NOTHING).
 *   - Property 18: Lifecycle sending is idempotent (Req 10.2, 10.4). Running
 *     `runDueFollowUps` once sends each due action exactly once and marks it
 *     completed; running it again sends nothing more (the `status = 'pending'`
 *     guard prevents re-sending).
 *   - Property 19: Consent and opt-out gate follow-ups (Req 18.2, 18.4). Only
 *     customers with `consent_granted = true` AND `opted_out = false` receive a
 *     follow-up; all others are skipped and counted in `skipped`.
 *
 * Hermetic: no database, no network. The tenant module's `withTenantContext` is
 * mocked to run the runner's callbacks against an in-memory `follow_up_actions`
 * store that models the three SQL statements the code issues:
 *   - INSERT ... ON CONFLICT (close_event_id, action_type) DO NOTHING RETURNING
 *   - the due-actions SELECT (joined with close_events for the phone number)
 *   - UPDATE ... SET status='completed' ... WHERE id=$1 AND status='pending'
 * The consent, send, and credential dependencies are supplied through the
 * injectable `deps` argument, so no real consent read, network send, or
 * credential read happens.
 *
 * Feature: respond-leadz
 * Validates: Requirements 10.1, 10.2, 10.4, 18.2, 18.4
 */

import fc from 'fast-check'

/** Milliseconds in one day; mirrors the constant in lifecycle.ts. */
const DAY_MS = 24 * 60 * 60 * 1000

/** Silence structured logging emitted by the runner during the test runs. */
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

// Mock the tenant module so the runner's `withTenantContext` callbacks run
// against an in-memory `follow_up_actions` store. The fake `query` dispatches on
// the SQL text to model the three statements the Lifecycle_Runner issues:
//
//   1. INSERT INTO follow_up_actions (...) ON CONFLICT (close_event_id,
//      action_type) DO NOTHING RETURNING ...  — first write for a
//      (close_event_id, action_type) pair returns the row (rowCount 1); any
//      later write for the same pair returns rowCount 0 and no rows.
//   2. SELECT fa.*, ce.phone_number ... WHERE status='pending' AND
//      scheduled_for <= $1 ORDER BY scheduled_for ASC — returns the seeded due
//      pending rows (phone joined from close_events, modeled on the row itself).
//   3. UPDATE follow_up_actions SET status='completed', sent_at=NOW()
//      WHERE id=$1 AND status='pending' — flips a still-pending row to
//      completed (rowCount 1); a no-op (rowCount 0) once already completed.
//
// Helper exports let the tests seed due rows, inspect the store, and reset it.
jest.mock('@/lib/pipeline/tenant', () => {
  type Row = {
    id: string
    tenant_id: unknown
    close_event_id: string
    action_type: string
    scheduled_for: string
    status: 'pending' | 'completed'
    sent_at: string | null
    phone_number: string | null
  }
  const store = new Map<string, Row>()
  const phoneByEvent = new Map<string, string>()
  let idSeq = 0

  const keyFor = (closeEventId: unknown, actionType: unknown): string =>
    `${String(closeEventId)}::${String(actionType)}`

  return {
    __store: store,
    __phoneByEvent: phoneByEvent,
    __reset: () => {
      store.clear()
      phoneByEvent.clear()
      idSeq = 0
    },
    /** Directly seed a pending due follow-up action (with its customer phone). */
    __seedDue: (row: {
      close_event_id: string
      action_type: string
      scheduled_for: string
      phone_number: string
      tenant_id?: string
    }) => {
      const id = `act-${++idSeq}`
      store.set(keyFor(row.close_event_id, row.action_type), {
        id,
        tenant_id: row.tenant_id ?? null,
        close_event_id: row.close_event_id,
        action_type: row.action_type,
        scheduled_for: row.scheduled_for,
        status: 'pending',
        sent_at: null,
        phone_number: row.phone_number,
      })
      return id
    },
    getTenantCredentials: jest.fn(),
    listTenantIds: jest.fn(),
    withTenantContext: jest.fn(
      async (tenantId: string, fn: (ctx: unknown) => Promise<unknown>) =>
        fn({
          tenantId,
          query: async (text: string, params: ReadonlyArray<unknown> = []) => {
            const sql = text.trim()

            // 1. INSERT ... ON CONFLICT (close_event_id, action_type) DO NOTHING
            if (/^INSERT\s+INTO\s+follow_up_actions/i.test(sql)) {
              const [tenant_id, close_event_id, action_type, scheduled_for] = params
              const key = keyFor(close_event_id, action_type)
              if (store.has(key)) {
                return { rows: [], rowCount: 0 }
              }
              const row: Row = {
                id: `act-${++idSeq}`,
                tenant_id,
                close_event_id: String(close_event_id),
                action_type: String(action_type),
                scheduled_for: String(scheduled_for),
                status: 'pending',
                sent_at: null,
                phone_number: phoneByEvent.get(String(close_event_id)) ?? null,
              }
              store.set(key, row)
              return { rows: [row], rowCount: 1 }
            }

            // 3. UPDATE ... SET status='completed' WHERE id=$1 AND status='pending'
            if (/^UPDATE\s+follow_up_actions/i.test(sql)) {
              const [id] = params
              const row = [...store.values()].find((r) => r.id === id)
              if (row && row.status === 'pending') {
                row.status = 'completed'
                row.sent_at = new Date().toISOString()
                return { rows: [], rowCount: 1 }
              }
              return { rows: [], rowCount: 0 }
            }

            // 2. SELECT due pending actions joined with close_events for phone.
            if (/^SELECT[\s\S]*FROM\s+follow_up_actions/i.test(sql)) {
              const nowIso = String(params[0])
              const due = [...store.values()]
                .filter((r) => r.status === 'pending' && r.scheduled_for <= nowIso)
                .sort((a, b) =>
                  a.scheduled_for < b.scheduled_for
                    ? -1
                    : a.scheduled_for > b.scheduled_for
                      ? 1
                      : 0
                )
                .map((r) => ({
                  id: r.id,
                  action_type: r.action_type,
                  close_event_id: r.close_event_id,
                  phone_number: r.phone_number,
                }))
              return { rows: due, rowCount: due.length }
            }

            return { rows: [], rowCount: 0 }
          },
        })
    ),
  }
})

import {
  scheduleFollowUps,
  runDueFollowUps,
  type FollowUpStep,
  type LifecycleDeps,
} from '@/lib/pipeline/lifecycle'
import * as tenantModule from '@/lib/pipeline/tenant'
import type { Tenant } from '@/lib/pipeline/types'
import type { CustomerConsent } from '@/lib/pipeline/consent'

/** Access the mock's in-memory store helpers. */
const mockTenant = tenantModule as unknown as {
  __store: Map<string, { status: string; scheduled_for: string; tenant_id: unknown; close_event_id: string; action_type: string }>
  __phoneByEvent: Map<string, string>
  __reset: () => void
  __seedDue: (row: {
    close_event_id: string
    action_type: string
    scheduled_for: string
    phone_number: string
    tenant_id?: string
  }) => string
}

/** Run a healthy number of generated cases per property (>= 100). */
const RUNS = { numRuns: 150 }

/** A minimal fake tenant returned by the injected credential loader. */
const fakeTenant: Tenant = {
  id: '00000000-0000-4000-8000-000000000000',
  name: 'Acme',
  whatsapp_phone_number_id: 'pnid-1',
  whatsapp_access_token: 'tok',
  whatsapp_app_secret: 'sec',
  whatsapp_verify_token: 'vt',
  llm_provider: 'claude',
  llm_api_key: 'key',
  default_currency: 'USD',
}

/** A non-empty E.164-ish phone number. */
const phoneArb = (): fc.Arbitrary<string> =>
  fc.integer({ min: 1_000_000, max: 999_999_999 }).map((n) => `+${n}`)

describe('Lifecycle_Runner', () => {
  beforeEach(() => {
    mockTenant.__reset()
  })

  // Feature: respond-leadz, Property 17: Follow-up scheduling matches the tenant plan
  describe('Property 17: Follow-up scheduling matches the tenant plan (Req 10.1)', () => {
    /** A plan: one or more steps with unique actionType, varied delay/message. */
    const planArb = (): fc.Arbitrary<FollowUpStep[]> =>
      fc.uniqueArray(
        fc.record({
          actionType: fc.string({ minLength: 1, maxLength: 24 }),
          delayDays: fc.integer({ min: 0, max: 120 }),
          message: fc.string({ maxLength: 200 }),
        }),
        { minLength: 1, maxLength: 8, selector: (s) => s.actionType }
      )

    it('creates exactly one pending action per step at closedAt + delayDays, idempotently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.date({ min: new Date('2000-01-01T00:00:00.000Z'), max: new Date('2100-01-01T00:00:00.000Z') }),
          planArb(),
          async (tenantId, closeEventId, closedAt, plan) => {
            mockTenant.__reset()

            const created = await scheduleFollowUps(tenantId, closeEventId, closedAt, plan)

            // One action created per plan step, all stored as pending.
            expect(created).toHaveLength(plan.length)
            expect(mockTenant.__store.size).toBe(plan.length)

            for (const step of plan) {
              const row = mockTenant.__store.get(`${closeEventId}::${step.actionType}`)
              expect(row).toBeDefined()
              expect(row!.status).toBe('pending')
              expect(row!.tenant_id).toBe(tenantId)
              expect(row!.close_event_id).toBe(closeEventId)
              const expected = new Date(closedAt.getTime() + step.delayDays * DAY_MS).toISOString()
              expect(row!.scheduled_for).toBe(expected)
            }

            // Re-running for the same close event creates no duplicates.
            const createdAgain = await scheduleFollowUps(tenantId, closeEventId, closedAt, plan)
            expect(createdAgain).toHaveLength(0)
            expect(mockTenant.__store.size).toBe(plan.length)
          }
        ),
        RUNS
      )
    })
  })

  // Feature: respond-leadz, Property 18: Lifecycle sending is idempotent
  describe('Property 18: Lifecycle sending is idempotent (Req 10.2, 10.4)', () => {
    const NOW = new Date('2025-06-01T00:00:00.000Z')

    /** A set of due pending actions (unique close events) to drain. */
    const dueActionsArb = () =>
      fc.uniqueArray(
        fc.record({ closeEventId: fc.uuid(), phone: phoneArb() }),
        { minLength: 1, maxLength: 8, selector: (a) => a.closeEventId }
      )

    it('sends each due action exactly once across repeated runs (no double-send)', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), dueActionsArb(), async (tenantId, actions) => {
          mockTenant.__reset()

          // Seed each generated action as a due (past) pending follow-up.
          const pastIso = new Date(NOW.getTime() - 60_000).toISOString()
          for (const a of actions) {
            mockTenant.__seedDue({
              close_event_id: a.closeEventId,
              action_type: 'delivery_check',
              scheduled_for: pastIso,
              phone_number: a.phone,
              tenant_id: tenantId,
            })
          }

          const send = jest.fn(async () => {})
          const deps: LifecycleDeps = {
            now: NOW,
            getConsent: async (tid, phone): Promise<CustomerConsent> => ({
              tenant_id: tid,
              phone_number: phone,
              consent_granted: true,
              opted_out: false,
            }),
            send,
            getTenantCredentials: async () => fakeTenant,
          }

          // First run: every due action is sent once and marked completed.
          const first = await runDueFollowUps(tenantId, deps)
          expect(first.processed).toBe(actions.length)
          expect(first.sent).toBe(actions.length)
          expect(first.skipped).toBe(0)
          expect(first.failed).toBe(0)
          expect(send).toHaveBeenCalledTimes(actions.length)

          // Second run: nothing is due (all completed); no further sends.
          const second = await runDueFollowUps(tenantId, deps)
          expect(second.processed).toBe(0)
          expect(second.sent).toBe(0)

          // Total sends across both runs equals the number of due actions.
          expect(send).toHaveBeenCalledTimes(actions.length)
        }),
        RUNS
      )
    })
  })

  // Feature: respond-leadz, Property 19: Consent and opt-out gate follow-ups
  describe('Property 19: Consent and opt-out gate follow-ups (Req 18.2, 18.4)', () => {
    const NOW = new Date('2025-06-01T00:00:00.000Z')

    type ConsentCategory = 'none' | 'denied' | 'optedout' | 'granted'

    /** Due actions, each tied to a distinct phone and a consent category. */
    const customersArb = () =>
      fc.uniqueArray(
        fc.record({
          phone: phoneArb(),
          category: fc.constantFrom<ConsentCategory>('none', 'denied', 'optedout', 'granted'),
        }),
        { minLength: 1, maxLength: 10, selector: (c) => c.phone }
      )

    /** Only granted + not-opted-out customers may be messaged. */
    const isAllowed = (category: ConsentCategory): boolean => category === 'granted'

    const consentFor = (
      tenantId: string,
      phone: string,
      category: ConsentCategory
    ): CustomerConsent | null => {
      switch (category) {
        case 'none':
          return null
        case 'denied':
          return { tenant_id: tenantId, phone_number: phone, consent_granted: false, opted_out: false }
        case 'optedout':
          return { tenant_id: tenantId, phone_number: phone, consent_granted: true, opted_out: true }
        case 'granted':
          return { tenant_id: tenantId, phone_number: phone, consent_granted: true, opted_out: false }
      }
    }

    it('sends only to consented, non-opted-out customers and skips the rest', async () => {
      await fc.assert(
        fc.asyncProperty(fc.uuid(), customersArb(), async (tenantId, customers) => {
          mockTenant.__reset()

          const pastIso = new Date(NOW.getTime() - 60_000).toISOString()
          const categoryByPhone = new Map<string, ConsentCategory>()
          customers.forEach((c, i) => {
            categoryByPhone.set(c.phone, c.category)
            mockTenant.__seedDue({
              close_event_id: `evt-${i}`,
              action_type: 'review_ask',
              scheduled_for: pastIso,
              phone_number: c.phone,
              tenant_id: tenantId,
            })
          })

          const sentPhones: string[] = []
          const send = jest.fn(async (_tenant: Tenant, to: string) => {
            sentPhones.push(to)
          })
          const deps: LifecycleDeps = {
            now: NOW,
            getConsent: async (tid, phone) => consentFor(tid, phone, categoryByPhone.get(phone)!),
            send,
            getTenantCredentials: async () => fakeTenant,
          }

          const allowed = customers.filter((c) => isAllowed(c.category))
          const blocked = customers.filter((c) => !isAllowed(c.category))

          const result = await runDueFollowUps(tenantId, deps)

          expect(result.processed).toBe(customers.length)
          expect(result.sent).toBe(allowed.length)
          expect(result.skipped).toBe(blocked.length)
          expect(result.failed).toBe(0)

          // Sends went only to allowed customers, exactly once each.
          expect(send).toHaveBeenCalledTimes(allowed.length)
          expect(sentPhones.sort()).toEqual(allowed.map((c) => c.phone).sort())

          // No blocked customer was ever messaged.
          for (const b of blocked) {
            expect(sentPhones).not.toContain(b.phone)
          }
        }),
        RUNS
      )
    })
  })
})
