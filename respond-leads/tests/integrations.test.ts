/**
 * Tests for the interop adapters (`lib/integrations/*`).
 *
 * Covers tasks 16.2 and 16.3 of the respond-leadz spec:
 *  - Property 32: Lead handoff creates or updates one conversation
 *    (task 16.2; Req 16.2) — mails2leadz.handoffLead
 *  - Unit tests for sibling outage resilience and the CashFlow contract
 *    (task 16.3; Req 16.1, 16.5) — cashflow.publishCloseEvent /
 *    buildCloseEventPayload and autodealz.fetchSuppliedItems
 *
 * Property tests use fast-check with >= 100 generated cases. All tests are
 * fully hermetic: the CashFlow/AutoDealz adapters receive injected `fetchImpl`
 * stubs (no network), and the DB-backed Mails2Leadz handoff runs against a
 * mocked `withTenantContext` whose fake query surface emulates the
 * `(tenant_id, phone_number)` conversations upsert in memory (no database).
 *
 * Feature: respond-leadz
 */

import fc from 'fast-check'
import type { CloseEvent, Conversation } from '@/lib/pipeline/types'

const NUM_RUNS = 100

// --- Mocked tenant context for the Mails2Leadz handoff --------------------
//
// `handoffLead` persists through `withTenantContext`. We mock that module so the
// callback runs against an in-memory fake context configured per test/iteration.
// The variable is prefixed `mock` so it may be referenced inside the hoisted
// jest.mock factory.
let mockCurrentCtx: {
  tenantId: string
  query: (text: string, params?: ReadonlyArray<unknown>) => Promise<unknown>
} | null = null

jest.mock('@/lib/pipeline/tenant', () => ({
  withTenantContext: jest.fn(async (_tenantId: string, fn: (ctx: unknown) => unknown) => {
    if (!mockCurrentCtx) {
      throw new Error('fake tenant context was not configured for this test')
    }
    return fn(mockCurrentCtx)
  }),
}))

// Imports must come after jest.mock so the adapters pick up the mocked module.
import { handoffLead } from '@/lib/integrations/mails2leadz'
import {
  publishCloseEvent,
  buildCloseEventPayload,
  type FetchLike as CashFlowFetchLike,
} from '@/lib/integrations/cashflow'
import {
  fetchSuppliedItems,
  type SuppliedItem,
  type FetchLike as AutoDealzFetchLike,
} from '@/lib/integrations/autodealz'

/** The default name handoffLead applies when a lead arrives without one. */
const DEFAULT_CUSTOMER_NAME = 'Unknown'

/**
 * Build a fake tenant-context query surface that emulates the conversations
 * upsert on the `(tenant_id, phone_number)` unique key. Backed by an in-memory
 * Map keyed by `${tenantId}:${phoneNumber}`. The first insert for a key reports
 * `__inserted = true` (xmax = 0); subsequent upserts for the same key report
 * `__inserted = false` and update the existing row in place, mirroring
 * `ON CONFLICT (tenant_id, phone_number) DO UPDATE`.
 */
function makeFakeConversationContext() {
  const store = new Map<string, Conversation>()
  let idSeq = 0

  const ctx = {
    tenantId: '',
    async query(_text: string, params?: ReadonlyArray<unknown>) {
      const [tenantId, phoneNumber, customerName, defaultName] = (params ?? []) as string[]
      const key = `${tenantId}:${phoneNumber}`
      const existing = store.get(key)

      if (!existing) {
        const row: Conversation = {
          id: `conv-${++idSeq}`,
          tenant_id: tenantId,
          phone_number: phoneNumber,
          customer_name: customerName,
          history: '',
        }
        store.set(key, row)
        return { rows: [{ ...row, __inserted: true }], rowCount: 1 }
      }

      // ON CONFLICT DO UPDATE: only overwrite the name when a real (non-default)
      // name was supplied, matching the SQL CASE expression.
      if (customerName !== defaultName) {
        existing.customer_name = customerName
      }
      store.set(key, existing)
      return { rows: [{ ...existing, __inserted: false }], rowCount: 1 }
    },
  }

  return { ctx, store }
}

/** Count conversations stored for a given `(tenant, phone)` key. */
function countForKey(store: Map<string, Conversation>, tenantId: string, phone: string): number {
  return store.has(`${tenantId}:${phone}`) ? 1 : 0
}

// =========================================================================
// Property 32: Lead handoff creates or updates one conversation
// (task 16.2; Req 16.2)
// =========================================================================

describe('mails2leadz.handoffLead — Property 32: one conversation per lead', () => {
  const tenantArb = fc.uuid()
  const phoneArb = fc
    .string({ minLength: 6, maxLength: 15 })
    .map((s) => s.replace(/\D/g, '5') || '15550000000')
  // Names include absent/blank/whitespace to also exercise the "Unknown" default.
  const nameArb = fc.option(
    fc.oneof(fc.string({ maxLength: 20 }), fc.constantFrom('', '   ', '\t')),
    { nil: undefined }
  )

  // Feature: respond-leadz, Property 32: Lead handoff creates or updating one conversation
  it('creates exactly one conversation, updates the same row on repeat, and keeps distinct keys distinct', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantArb,
        phoneArb,
        nameArb,
        nameArb,
        tenantArb,
        phoneArb,
        nameArb,
        async (tenantA, phoneA, name1, name2, tenantB, phoneB, name3) => {
          // The second lead must be a different (tenant, phone) key.
          fc.pre(`${tenantA}:${phoneA}` !== `${tenantB}:${phoneB}`)

          const { ctx, store } = makeFakeConversationContext()
          mockCurrentCtx = ctx

          // First handoff for (tenantA, phoneA): creates exactly one conversation.
          const r1 = await handoffLead({
            tenantId: tenantA,
            phoneNumber: phoneA,
            customerName: name1,
          })
          expect(r1.created).toBe(true)
          expect(r1.conversation.tenant_id).toBe(tenantA)
          expect(r1.conversation.phone_number).toBe(phoneA)
          // Name is always normalized to a non-empty value.
          expect(r1.conversation.customer_name.length).toBeGreaterThan(0)
          expect(countForKey(store, tenantA, phoneA)).toBe(1)
          expect(store.size).toBe(1)

          // Repeat handoff for the SAME key: updates the same single row.
          const r2 = await handoffLead({
            tenantId: tenantA,
            phoneNumber: phoneA,
            customerName: name2,
          })
          expect(r2.created).toBe(false)
          expect(r2.conversation.id).toBe(r1.conversation.id)
          expect(countForKey(store, tenantA, phoneA)).toBe(1)
          expect(store.size).toBe(1)

          // A different (tenant, phone) key creates a distinct conversation.
          const r3 = await handoffLead({
            tenantId: tenantB,
            phoneNumber: phoneB,
            customerName: name3,
          })
          expect(r3.created).toBe(true)
          expect(r3.conversation.id).not.toBe(r1.conversation.id)
          expect(countForKey(store, tenantB, phoneB)).toBe(1)
          expect(store.size).toBe(2)
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('defaults a blank lead name to "Unknown" on create (unit)', async () => {
    const { ctx } = makeFakeConversationContext()
    mockCurrentCtx = ctx

    const result = await handoffLead({
      tenantId: '11111111-1111-4111-8111-111111111111',
      phoneNumber: '15551234567',
      customerName: '   ',
    })

    expect(result.created).toBe(true)
    expect(result.conversation.customer_name).toBe(DEFAULT_CUSTOMER_NAME)
  })
})

// =========================================================================
// Unit tests — sibling outage resilience + CashFlow contract
// (task 16.3; Req 16.1, 16.5)
// =========================================================================

/** A representative recorded Close_Event. */
const closeEvent: CloseEvent = {
  id: 'ce-1',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  conversation_id: 'conv-1',
  phone_number: '15557654321',
  deal_value: 1499.95,
  currency: 'USD',
  closed_at: '2024-05-01T12:00:00.000Z',
}

beforeEach(() => {
  // Keep config deterministic regardless of the ambient environment.
  delete process.env.CASHFLOW_WEBHOOK_URL
  delete process.env.AUTODEALZ_FEED_URL
})

describe('cashflow.buildCloseEventPayload — CashFlow contract (Req 16.1)', () => {
  it('exposes deal value, currency, customerId (= phone_number), closedAt, tenantId from the event', () => {
    const payload = buildCloseEventPayload(closeEvent)
    expect(payload).toEqual({
      dealValue: closeEvent.deal_value,
      currency: closeEvent.currency,
      customerId: closeEvent.phone_number,
      closedAt: closeEvent.closed_at,
      tenantId: closeEvent.tenant_id,
    })
    // customerId is the shared phone-number identifier (Req 16.4).
    expect(payload.customerId).toBe(closeEvent.phone_number)
  })
})

describe('cashflow.publishCloseEvent — sibling resilience (Req 16.1, 16.5)', () => {
  it('returns { status: "published" } when the endpoint accepts the payload', async () => {
    const fetchImpl: CashFlowFetchLike = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
    }))

    const result = await publishCloseEvent(closeEvent, {
      endpointUrl: 'https://cashflow.example/webhook',
      fetchImpl,
    })

    expect(result.status).toBe('published')
    expect(result.payload).toEqual(buildCloseEventPayload(closeEvent))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('returns { status: "skipped" } when no endpoint is configured', async () => {
    const fetchImpl: CashFlowFetchLike = jest.fn()

    const result = await publishCloseEvent(closeEvent, { fetchImpl })

    expect(result.status).toBe('skipped')
    expect(result.payload).toEqual(buildCloseEventPayload(closeEvent))
    // Nothing was sent because the sibling is unconfigured.
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns { status: "failed" } and does NOT throw when the transport rejects (Req 16.5)', async () => {
    const fetchImpl: CashFlowFetchLike = jest.fn(async () => {
      throw new Error('CashFlow unreachable')
    })

    // Must resolve, never reject — a sibling outage never blocks inbound.
    const result = await publishCloseEvent(closeEvent, {
      endpointUrl: 'https://cashflow.example/webhook',
      fetchImpl,
    })

    expect(result.status).toBe('failed')
    expect(result.payload).toEqual(buildCloseEventPayload(closeEvent))
  })

  it('returns { status: "failed" } when the endpoint responds with an error status (Req 16.5)', async () => {
    const fetchImpl: CashFlowFetchLike = jest.fn(async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    }))

    const result = await publishCloseEvent(closeEvent, {
      endpointUrl: 'https://cashflow.example/webhook',
      fetchImpl,
    })

    expect(result.status).toBe('failed')
  })
})

describe('autodealz.fetchSuppliedItems — sibling resilience (Req 16.5)', () => {
  const tenantId = '33333333-3333-4333-8333-333333333333'

  it('returns supplied items when the feed responds successfully (happy path)', async () => {
    const items: SuppliedItem[] = [
      { name: 'Brake Pad', sku: 'BP-1', quantity: 10, price: 25, currency: 'USD' },
      { name: 'Oil Filter', sku: 'OF-2', quantity: 5, price: 8, currency: 'USD' },
    ]
    const fetchImpl: AutoDealzFetchLike = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ items }),
    }))

    const result = await fetchSuppliedItems(tenantId, {
      feedUrl: 'https://autodealz.example/feed',
      fetchImpl,
    })

    expect(result).toEqual(items)
  })

  it('returns null and does NOT throw when the transport rejects (Req 16.5)', async () => {
    const fetchImpl: AutoDealzFetchLike = jest.fn(async () => {
      throw new Error('AutoDealz unreachable')
    })

    const result = await fetchSuppliedItems(tenantId, {
      feedUrl: 'https://autodealz.example/feed',
      fetchImpl,
    })

    expect(result).toBeNull()
  })

  it('returns null when the feed responds with an error status (Req 16.5)', async () => {
    const fetchImpl: AutoDealzFetchLike = jest.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    }))

    const result = await fetchSuppliedItems(tenantId, {
      feedUrl: 'https://autodealz.example/feed',
      fetchImpl,
    })

    expect(result).toBeNull()
  })

  it('returns null when no feed URL is configured', async () => {
    const fetchImpl: AutoDealzFetchLike = jest.fn()

    const result = await fetchSuppliedItems(tenantId, { fetchImpl })

    expect(result).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
