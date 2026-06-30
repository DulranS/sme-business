/**
 * Property-based tests for the Close_Detector.
 *
 * Two properties are covered:
 *   - Property 15: `evaluate` is total — for any conversation history string
 *     (arbitrary unicode, empty, whitespace, very long) and any tenant default
 *     currency it never throws and always returns a well-formed
 *     `CloseEvaluation`. `evaluate` is pure, so this property needs no mocking.
 *   - Property 16: `recordCloseEvent` is idempotent — the underlying write uses
 *     `INSERT ... ON CONFLICT (conversation_id) DO NOTHING RETURNING ...`, so a
 *     second close event is never recorded for the same conversation. The
 *     tenant module's `withTenantContext` is mocked to run the callback against
 *     an in-memory fake context whose `query` models the unique
 *     `conversation_id` close-events store and the ON CONFLICT DO NOTHING
 *     semantics.
 *
 * Hermetic: no database, no network. The fake context models the only DB
 * interaction the code performs.
 *
 * Feature: respond-leadz
 * Validates: Requirements 9.1, 9.3, 9.4, 9.5
 */

import fc from 'fast-check'

// Mock the tenant module so `recordCloseEvent` runs its callback against an
// in-memory fake context. The fake `query` emulates a `close_events` table
// keyed UNIQUELY by `conversation_id` with INSERT ... ON CONFLICT DO NOTHING
// RETURNING semantics: the first insert for a conversation returns a row
// (rowCount 1); any later insert for the same conversation_id returns rowCount 0
// and no rows. Helper exports (`__store`, `__resetStore`) let the tests inspect
// and reset the store between generated cases.
jest.mock('@/lib/pipeline/tenant', () => {
  const store = new Map<string, Record<string, unknown>>()
  return {
    __store: store,
    __resetStore: () => store.clear(),
    withTenantContext: jest.fn(
      async (tenantId: string, fn: (ctx: unknown) => Promise<unknown>) =>
        fn({
          tenantId,
          // Models: INSERT INTO close_events (...) VALUES ($1..$5)
          //         ON CONFLICT (conversation_id) DO NOTHING RETURNING ...
          query: async (_text: string, params: ReadonlyArray<unknown>) => {
            const [tenant_id, conversation_id, phone_number, deal_value, currency] = params
            const key = String(conversation_id)
            if (store.has(key)) {
              // A row already exists for this conversation_id: DO NOTHING.
              return { rows: [], rowCount: 0 }
            }
            const row = {
              id: `evt-${key}`,
              tenant_id,
              conversation_id,
              phone_number,
              deal_value,
              currency,
              closed_at: new Date().toISOString(),
            }
            store.set(key, row)
            return { rows: [row], rowCount: 1 }
          },
        })
    ),
  }
})

import { evaluate, recordCloseEvent, type CloseEvaluation } from '@/lib/pipeline/close-detector'
import * as tenantModule from '@/lib/pipeline/tenant'
import type { Tenant, Conversation } from '@/lib/pipeline/types'

/** Access the mock's in-memory store helpers. */
const mockTenant = tenantModule as unknown as {
  __store: Map<string, Record<string, unknown>>
  __resetStore: () => void
}

/** Run a healthy number of generated cases per property (>= 100). */
const RUNS = { numRuns: 200 }

/**
 * Arbitrary conversation history: arbitrary unicode, empty, whitespace-only,
 * and very long strings, plus a few phrases that look like real closing
 * exchanges so the closed branch is exercised too.
 */
const historyArb = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.fullUnicodeString(),
    fc.string(),
    fc.constant(''),
    fc.constantFrom('   ', '\t\n', '\n\n  \t'),
    // Very long strings.
    fc.string({ minLength: 2000, maxLength: 6000 }),
    fc.fullUnicodeString({ minLength: 1000, maxLength: 4000 }),
    // Closing-style exchanges with and without monetary amounts.
    fc.constantFrom(
      "ok i'll take it",
      'payment sent',
      "I've paid, thanks!",
      'deal closed for $1,200.50',
      'order confirmed — USD 999',
      'let’s do it, sending KES 2,500 now',
      "i'll buy 3 units"
    )
  )

/** Arbitrary tenant default currency: codes, empty, and arbitrary strings. */
const currencyArb = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constantFrom('USD', 'EUR', 'GBP', 'INR', 'JPY', 'KES', 'NGN'),
    fc.constant(''),
    fc.string(),
    fc.fullUnicodeString()
  )

describe('Close_Detector', () => {
  // Feature: respond-leadz, Property 15: Close detection is total
  describe('Property 15: Close detection is total (Req 9.1)', () => {
    it('evaluate never throws and always returns a well-formed CloseEvaluation', () => {
      fc.assert(
        fc.property(historyArb(), currencyArb(), (history, default_currency) => {
          const tenant = { default_currency } as Pick<Tenant, 'default_currency'>
          const conversation = { history } as Pick<Conversation, 'history'>

          let result: CloseEvaluation
          expect(() => {
            result = evaluate(tenant, conversation)
          }).not.toThrow()

          // `closed` is always a boolean.
          expect(typeof result!.closed).toBe('boolean')

          // When closed, the deal value is a finite number >= 0 and the
          // currency is a non-empty string (Requirement 9.3 attaches both).
          if (result!.closed) {
            expect(typeof result!.dealValue).toBe('number')
            expect(Number.isFinite(result!.dealValue)).toBe(true)
            expect(result!.dealValue as number).toBeGreaterThanOrEqual(0)
            expect(typeof result!.currency).toBe('string')
            expect((result!.currency as string).length).toBeGreaterThan(0)
          }
        }),
        RUNS
      )
    })
  })

  // Feature: respond-leadz, Property 16: Close-event recording is idempotent
  describe('Property 16: Close-event recording is idempotent (Req 9.3, 9.4, 9.5)', () => {
    const tenantArb = (): fc.Arbitrary<Pick<Tenant, 'id' | 'default_currency'>> =>
      fc.record({
        id: fc.uuid(),
        default_currency: fc.constantFrom('USD', 'EUR', 'GBP', 'INR', 'KES'),
      })

    const conversationArb = (): fc.Arbitrary<Pick<Conversation, 'id' | 'phone_number'>> =>
      fc.record({
        id: fc.oneof(
          fc.integer({ min: 1, max: 1_000_000 }).map((n) => String(n)),
          fc.uuid()
        ),
        phone_number: fc.string({ minLength: 1 }),
      })

    const evaluationArb = (): fc.Arbitrary<CloseEvaluation> =>
      fc.record({
        closed: fc.constant(true),
        dealValue: fc.double({ min: 0, max: 50_000, noNaN: true }),
        currency: fc.constantFrom('USD', 'EUR', 'GBP', 'INR', 'KES'),
      })

    it('records exactly one close event when called twice for the same conversation', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantArb(),
          conversationArb(),
          evaluationArb(),
          async (tenant, conversation, evaluation) => {
            // Isolate each generated case.
            mockTenant.__resetStore()

            const first = await recordCloseEvent(tenant, conversation, evaluation)
            const second = await recordCloseEvent(tenant, conversation, evaluation)

            // First call records a CloseEvent...
            expect(first).not.toBeNull()
            expect(first!.conversation_id).toBe(String(conversation.id))
            expect(first!.phone_number).toBe(conversation.phone_number)
            expect(typeof first!.deal_value).toBe('number')
            expect(typeof first!.currency).toBe('string')
            expect(first!.currency.length).toBeGreaterThan(0)

            // ...the second call records nothing (ON CONFLICT DO NOTHING).
            expect(second).toBeNull()

            // Exactly one event is stored for the conversation.
            expect(mockTenant.__store.size).toBe(1)
          }
        ),
        RUNS
      )
    })

    it('distinct conversations each record their own single event', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantArb(),
          fc.uniqueArray(
            fc.oneof(
              fc.integer({ min: 1, max: 1_000_000 }).map((n) => String(n)),
              fc.uuid()
            ),
            { minLength: 2, maxLength: 6 }
          ),
          fc.string({ minLength: 1 }),
          evaluationArb(),
          async (tenant, conversationIds, phone_number, evaluation) => {
            mockTenant.__resetStore()

            for (const id of conversationIds) {
              const conversation = { id, phone_number }
              const first = await recordCloseEvent(tenant, conversation, evaluation)
              const second = await recordCloseEvent(tenant, conversation, evaluation)
              expect(first).not.toBeNull()
              expect(second).toBeNull()
            }

            // One event per distinct conversation id.
            expect(mockTenant.__store.size).toBe(conversationIds.length)
          }
        ),
        RUNS
      )
    })
  })
})
