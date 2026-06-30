/**
 * Property-based tests for the RateLimiter / Queue.
 *
 * Two concerns are exercised:
 *   - burst queuing: at most BURST_LIMIT (50) arrivals from a single phone
 *     within any 60s window are processed immediately; every excess arrival is
 *     deferred and enqueued, never dropped (Property 27);
 *   - spaced draining: consecutive queued sends to a single phone number are
 *     stamped at least MIN_SEND_SPACING_MS (5s) apart via `process_after`
 *     (Property 28).
 *
 * `registerArrival` is a pure in-memory guard and is tested directly, resetting
 * the window map before each test. `enqueueInbound` / `drainDueInbound` run
 * inside `withTenantContext`, which is mocked here with a module-level in-memory
 * model of the `inbound_queue` table so the tests are fully hermetic (no
 * database, no network). Explicit `now` values are passed throughout to keep
 * arrivals inside one window and to make the spacing schedule deterministic.
 *
 * Feature: respond-leadz
 * Validates: Requirements 14.1, 14.4, 15.3
 */

import fc from 'fast-check'

// In-memory model of the `inbound_queue` table behind a mocked
// withTenantContext. Everything lives inside the factory so jest's
// out-of-scope-variable guard is satisfied; reset/read helpers are exported on
// the mocked module for the tests to drive.
jest.mock('@/lib/pipeline/tenant', () => {
  interface Row {
    id: string
    tenant_id: string
    phone_number: string
    message_id: string
    payload: unknown
    enqueued_at: string
    process_after: string
    status: 'pending' | 'done'
  }

  const queue: Row[] = []
  let nextId = 1

  const fakeCtx = {
    tenantId: '',
    async query(text: string, params: ReadonlyArray<unknown> = []) {
      // INSERT a new pending row, assigning an id and echoing it back.
      if (text.includes('INSERT INTO inbound_queue')) {
        const [tenantId, phoneNumber, messageId, payload, processAfter] = params as [
          string,
          string,
          string,
          string,
          string,
        ]
        const row: Row = {
          id: String(nextId++),
          tenant_id: tenantId,
          phone_number: phoneNumber,
          message_id: messageId,
          payload,
          enqueued_at: processAfter,
          process_after: processAfter,
          status: 'pending',
        }
        queue.push(row)
        return { rowCount: 1, rows: [row] }
      }

      // UPDATE a row to done.
      if (text.includes('UPDATE inbound_queue')) {
        const [id, tenantId] = params as [string, string]
        const row = queue.find((r) => r.id === id && r.tenant_id === tenantId)
        if (row) row.status = 'done'
        return { rowCount: row ? 1 : 0, rows: [] }
      }

      // SELECT of due rows: pending AND process_after <= now, ordered by phone
      // then process_after.
      if (text.includes('process_after <= $2')) {
        const [tenantId, nowIso] = params as [string, string]
        const rows = queue
          .filter(
            (r) =>
              r.tenant_id === tenantId &&
              r.status === 'pending' &&
              new Date(r.process_after).getTime() <= new Date(nowIso).getTime()
          )
          .sort((a, b) =>
            a.phone_number === b.phone_number
              ? new Date(a.process_after).getTime() - new Date(b.process_after).getTime()
              : a.phone_number < b.phone_number
                ? -1
                : 1
          )
        return { rowCount: rows.length, rows }
      }

      // SELECT of the latest pending process_after for a (tenant, phone).
      const [tenantId, phoneNumber] = params as [string, string]
      const candidates = queue
        .filter(
          (r) =>
            r.tenant_id === tenantId &&
            r.phone_number === phoneNumber &&
            r.status === 'pending'
        )
        .sort((a, b) => new Date(b.process_after).getTime() - new Date(a.process_after).getTime())
      const latest = candidates[0]
      return {
        rowCount: latest ? 1 : 0,
        rows: latest ? [{ process_after: latest.process_after }] : [],
      }
    },
  }

  return {
    withTenantContext: jest.fn(async (tenantId: string, fn: (ctx: typeof fakeCtx) => unknown) => {
      fakeCtx.tenantId = tenantId
      return fn(fakeCtx)
    }),
    __queue: queue,
    __resetQueue() {
      queue.length = 0
      nextId = 1
    },
  }
})

import {
  registerArrival,
  enqueueInbound,
  drainDueInbound,
  BURST_LIMIT,
  BURST_WINDOW_MS,
  MIN_SEND_SPACING_MS,
  __resetWindowsForTesting,
  type QueuedInbound,
} from '@/lib/pipeline/rate-limiter'

import * as tenantModule from '@/lib/pipeline/tenant'

// Access the in-memory queue model exposed by the mock above.
const mockedTenant = tenantModule as unknown as {
  __queue: QueuedInbound[]
  __resetQueue: () => void
}

const TENANT_ID = '11111111-1111-1111-1111-111111111111'

// A phone number generator that stays within a small, valid-ish shape.
const phoneArb = () =>
  fc.string({ minLength: 6, maxLength: 12, unit: fc.constantFrom(...'0123456789'.split('')) }).map(
    (digits) => `+1${digits || '0'}`
  )

function reset(): void {
  __resetWindowsForTesting()
  mockedTenant.__resetQueue()
}

beforeEach(() => {
  reset()
})

describe('RateLimiter / Queue', () => {
  // Feature: respond-leadz, Property 27: Burst messages are queued, never dropped
  describe('Property 27: Burst messages are queued, never dropped', () => {
    it('first 50 arrivals process immediately, every excess is deferred and persisted, none dropped', async () => {
      await fc.assert(
        fc.asyncProperty(
          phoneArb(),
          // N can exceed 50 so the deferral branch is regularly exercised.
          fc.integer({ min: 1, max: 90 }),
          async (phone, n) => {
            // Each generated case starts from a clean window + queue.
            reset()

            // A single, fixed `now` keeps all N arrivals inside one 60s window.
            const now = 1_000_000

            const deferred: Array<{ index: number; messageId: string }> = []
            for (let i = 0; i < n; i++) {
              const decision = registerArrival(TENANT_ID, phone, now)

              // windowCount increments by one per arrival within the window.
              expect(decision.windowCount).toBe(i + 1)

              if (i < BURST_LIMIT) {
                // The first 50 are processed immediately.
                expect(decision.defer).toBe(false)
              } else {
                // Every arrival beyond 50 must be deferred.
                expect(decision.defer).toBe(true)
                deferred.push({ index: i, messageId: `${phone}:${i}` })
              }
            }

            // Every deferred message is enqueued — never dropped.
            for (const d of deferred) {
              await enqueueInbound(TENANT_ID, {
                phoneNumber: phone,
                messageId: d.messageId,
                payload: { index: d.index },
              }, now)
            }

            const immediate = Math.min(n, BURST_LIMIT)
            const expectedDeferred = Math.max(0, n - BURST_LIMIT)

            expect(deferred.length).toBe(expectedDeferred)

            // Each deferred message appears in the durable queue.
            const persisted = mockedTenant.__queue.filter(
              (r) => r.phone_number === phone && r.tenant_id === TENANT_ID
            )
            expect(persisted.length).toBe(expectedDeferred)
            for (const d of deferred) {
              expect(persisted.some((r) => r.message_id === d.messageId)).toBe(true)
            }

            // Nothing is lost: processed-immediately + queued === N.
            expect(immediate + persisted.length).toBe(n)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('windows are per-phone: each phone is rate-limited independently within the window', () => {
      const now = 2_000_000
      // 40 arrivals each (below the 50 limit) never trip the limit for either
      // phone, demonstrating the window is keyed per phone number.
      for (let i = 0; i < 40; i++) {
        const a = registerArrival(TENANT_ID, '+1000000001', now)
        const b = registerArrival(TENANT_ID, '+1000000002', now)
        expect(a.defer).toBe(false)
        expect(b.defer).toBe(false)
      }
    })
  })

  // Feature: respond-leadz, Property 28: Queued sends are spaced
  describe('Property 28: Queued sends are spaced', () => {
    it('consecutive queued sends to one phone are stamped >= 5s apart', async () => {
      await fc.assert(
        fc.asyncProperty(
          phoneArb(),
          // A base time plus a sequence of non-negative inter-arrival gaps. The
          // gaps deliberately straddle the 5s spacing so both the "spread the
          // backlog" and the "already spaced" branches are exercised.
          fc.integer({ min: 0, max: 2_000_000 }),
          fc.array(fc.integer({ min: 0, max: 20_000 }), { minLength: 1, maxLength: 10 }),
          async (phone, base, gaps) => {
            reset()

            const processAfters: number[] = []
            let now = base
            for (const gap of gaps) {
              now += gap
              const row = await enqueueInbound(TENANT_ID, {
                phoneNumber: phone,
                messageId: `${phone}:${processAfters.length}`,
                payload: null,
              }, now)
              processAfters.push(new Date(row.process_after).getTime())
            }

            // Consecutive queued sends for this phone are at least 5s apart.
            for (let i = 1; i < processAfters.length; i++) {
              expect(processAfters[i] - processAfters[i - 1]).toBeGreaterThanOrEqual(
                MIN_SEND_SPACING_MS
              )
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('draining due messages respects the spaced schedule and marks them done', async () => {
      const phone = '+15551230000'
      const base = 10_000_000

      // Enqueue three back-to-back messages (same `now`) so they are spaced
      // 0s, 5s, 10s after `base` by the spacing rule.
      for (let i = 0; i < 3; i++) {
        await enqueueInbound(TENANT_ID, {
          phoneNumber: phone,
          messageId: `${phone}:${i}`,
          payload: { i },
        }, base)
      }

      const scheduled = mockedTenant.__queue
        .filter((r) => r.phone_number === phone)
        .map((r) => new Date(r.process_after).getTime())
        .sort((a, b) => a - b)
      expect(scheduled).toEqual([base, base + 5_000, base + 10_000])

      // Drain at a time when only the first two are due.
      const handled: string[] = []
      const firstDrain = await drainDueInbound(
        TENANT_ID,
        async (item) => {
          handled.push(item.message_id)
        },
        base + 5_000
      )
      expect(firstDrain.drained).toBe(2)
      expect(firstDrain.failed).toBe(0)

      // Drain again once the last one is due.
      const secondDrain = await drainDueInbound(
        TENANT_ID,
        async (item) => {
          handled.push(item.message_id)
        },
        base + 10_000
      )
      expect(secondDrain.drained).toBe(1)
      expect(handled.length).toBe(3)
    })
  })

  it('exposes the documented constants', () => {
    expect(BURST_LIMIT).toBe(50)
    expect(BURST_WINDOW_MS).toBe(60_000)
    expect(MIN_SEND_SPACING_MS).toBe(5_000)
  })
})
