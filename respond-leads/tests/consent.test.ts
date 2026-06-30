/**
 * Property-based tests for the Consent_Manager data-deletion behavior.
 *
 * Property 20: Data deletion removes personal data. For any customer, a
 * deletion request removes that customer's conversation and personal data
 * (consent, history) for the requesting tenant, leaving no retrievable personal
 * record for that `(tenant_id, phone_number)`; another tenant's data for the
 * same phone number is never affected.
 *
 * The tenant module's `withTenantContext` is mocked so the consent functions
 * run their callbacks against an in-memory fake context. The fake `query`
 * models two tenant-scoped stores — `conversations` and `customer_consent` —
 * each keyed by `${tenantId}:${phone}`. The current tenant id is closed over by
 * the context handed to each callback, exactly as Row Level Security scopes
 * every read/write to the requesting tenant. The fake implements the SQL shapes
 * the module issues: the consent upserts (recordConsent / recordOptOut), the
 * getConsent SELECT, and the two phone-scoped DELETEs (returning a rowCount of
 * the rows removed for that phone within the current tenant).
 *
 * Hermetic: no database, no network.
 *
 * Feature: respond-leadz
 * Validates: Requirements 18.3
 */

import fc from 'fast-check'

// Mock the tenant module so the consent functions run their callbacks against
// an in-memory fake context. Two Maps model the tenant-scoped tables, keyed by
// `${tenantId}:${phone}`. The fake `query` dispatches on the SQL text the
// module issues and uses the current context's tenant id for scoping — so a
// query that filters only by `phone_number = $1` (getConsent and both DELETEs)
// still only ever sees/affects the current tenant's rows, like RLS. Helper
// exports let the tests seed conversations and reset state between cases.
jest.mock('@/lib/pipeline/tenant', () => {
  type Row = Record<string, unknown>
  const conversations = new Map<string, Row>()
  const consent = new Map<string, Row>()
  const key = (tenantId: string, phone: string) => `${tenantId}:${phone}`

  return {
    __conversations: conversations,
    __consent: consent,
    __key: key,
    __reset: () => {
      conversations.clear()
      consent.clear()
    },
    __seedConversation: (tenantId: string, phone: string, row?: Row) => {
      conversations.set(key(tenantId, phone), {
        tenant_id: tenantId,
        phone_number: phone,
        customer_name: 'Seeded Customer',
        history: 'hello there',
        ...row,
      })
    },
    withTenantContext: jest.fn(
      async (tenantId: string, fn: (ctx: unknown) => Promise<unknown>) =>
        fn({
          tenantId,
          query: async (text: string, params: ReadonlyArray<unknown>) => {
            // recordConsent: INSERT ... (tenant_id, phone_number, consent_granted)
            //                ... ON CONFLICT DO UPDATE consent_granted ... RETURNING
            if (
              text.includes('INSERT INTO customer_consent') &&
              text.includes('(tenant_id, phone_number, consent_granted)')
            ) {
              const [tenant_id, phone, granted] = params as [string, string, boolean]
              const k = key(tenantId, phone)
              const existing = consent.get(k)
              const row = existing
                ? { ...existing, consent_granted: granted }
                : {
                    tenant_id,
                    phone_number: phone,
                    consent_granted: granted,
                    opted_out: false,
                  }
              consent.set(k, row)
              return { rows: [row], rowCount: 1 }
            }

            // recordOptOut: INSERT ... (tenant_id, phone_number, opted_out)
            //               VALUES ($1, $2, TRUE) ON CONFLICT DO UPDATE opted_out = TRUE
            if (
              text.includes('INSERT INTO customer_consent') &&
              text.includes('(tenant_id, phone_number, opted_out)')
            ) {
              const [tenant_id, phone] = params as [string, string]
              const k = key(tenantId, phone)
              const existing = consent.get(k)
              const row = existing
                ? { ...existing, opted_out: true }
                : {
                    tenant_id,
                    phone_number: phone,
                    consent_granted: false,
                    opted_out: true,
                  }
              consent.set(k, row)
              return { rows: [row], rowCount: 1 }
            }

            // getConsent: SELECT ... FROM customer_consent WHERE phone_number = $1
            if (text.includes('SELECT') && text.includes('FROM customer_consent')) {
              const [phone] = params as [string]
              const row = consent.get(key(tenantId, phone))
              return row ? { rows: [row], rowCount: 1 } : { rows: [], rowCount: 0 }
            }

            // deleteCustomerData (1/2): DELETE FROM conversations WHERE phone_number = $1
            if (text.includes('DELETE FROM conversations')) {
              const [phone] = params as [string]
              const removed = conversations.delete(key(tenantId, phone)) ? 1 : 0
              return { rows: [], rowCount: removed }
            }

            // deleteCustomerData (2/2): DELETE FROM customer_consent WHERE phone_number = $1
            if (text.includes('DELETE FROM customer_consent')) {
              const [phone] = params as [string]
              const removed = consent.delete(key(tenantId, phone)) ? 1 : 0
              return { rows: [], rowCount: removed }
            }

            throw new Error(`Unexpected query in consent test mock: ${text}`)
          },
        })
    ),
  }
})

import {
  recordConsent,
  recordOptOut,
  getConsent,
  deleteCustomerData,
} from '@/lib/pipeline/consent'
import * as tenantModule from '@/lib/pipeline/tenant'

/** Access the mock's in-memory stores and helpers. */
const mockTenant = tenantModule as unknown as {
  __conversations: Map<string, Record<string, unknown>>
  __consent: Map<string, Record<string, unknown>>
  __key: (tenantId: string, phone: string) => string
  __reset: () => void
  __seedConversation: (tenantId: string, phone: string, row?: Record<string, unknown>) => void
}

/** Run a healthy number of generated cases per property (>= 100). */
const RUNS = { numRuns: 200 }

/** Non-blank phone numbers (so normalizePhone never rejects the input). */
const phoneArb = (): fc.Arbitrary<string> =>
  fc
    .array(fc.integer({ min: 0, max: 9 }), { minLength: 7, maxLength: 13 })
    .map((digits) => `+${digits.join('')}`)

describe('Consent_Manager — Property 20: Data deletion removes personal data', () => {
  // Feature: respond-leadz, Property 20: Data deletion removes personal data
  it('removes a customer’s conversation and consent for the requesting tenant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        phoneArb(),
        fc.boolean(), // record consent?
        fc.boolean(), // consent granted value (when recorded)
        fc.boolean(), // record opt-out?
        async (tenantId, phone, doConsent, granted, doOptOut) => {
          mockTenant.__reset()

          // Seed arbitrary consent state for the (tenant, phone).
          if (doConsent) await recordConsent(tenantId, phone, granted)
          if (doOptOut) await recordOptOut(tenantId, phone)
          const consentExisted = doConsent || doOptOut

          // Seed a conversation row (customer name + history) for the customer.
          mockTenant.__seedConversation(tenantId, phone)

          const result = await deleteCustomerData(tenantId, phone)

          // No retrievable personal record remains for (tenant, phone).
          expect(await getConsent(tenantId, phone)).toBeNull()
          expect(mockTenant.__conversations.has(mockTenant.__key(tenantId, phone))).toBe(false)
          expect(mockTenant.__consent.has(mockTenant.__key(tenantId, phone))).toBe(false)

          // Returned counts reflect exactly what was removed.
          expect(result.conversationsDeleted).toBe(1)
          expect(result.consentDeleted).toBe(consentExisted ? 1 : 0)
        }
      ),
      RUNS
    )
  })

  // Feature: respond-leadz, Property 20: Data deletion removes personal data
  it('does not remove another tenant’s data for the same phone number', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        phoneArb(),
        fc.boolean(),
        fc.boolean(),
        async (tenantA, tenantB, phone, grantedA, grantedB) => {
          fc.pre(tenantA !== tenantB)
          mockTenant.__reset()

          // Seed the SAME phone under two different tenants.
          await recordConsent(tenantA, phone, grantedA)
          mockTenant.__seedConversation(tenantA, phone, { customer_name: 'A' })
          await recordConsent(tenantB, phone, grantedB)
          mockTenant.__seedConversation(tenantB, phone, { customer_name: 'B' })

          // Delete only tenant A's data for that phone.
          await deleteCustomerData(tenantA, phone)

          // Tenant A's records are gone.
          expect(await getConsent(tenantA, phone)).toBeNull()
          expect(mockTenant.__conversations.has(mockTenant.__key(tenantA, phone))).toBe(false)

          // Tenant B's records for the same phone are untouched.
          expect(await getConsent(tenantB, phone)).not.toBeNull()
          expect(mockTenant.__conversations.has(mockTenant.__key(tenantB, phone))).toBe(true)
        }
      ),
      RUNS
    )
  })
})
