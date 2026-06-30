/**
 * Property-based test for the Inventory_Service.
 *
 * Property 10: Inventory search is tenant-scoped and bounded.
 *
 * `search(tenantId, keyword)` runs a single query inside `withTenantContext`
 * that selects active rows matching the keyword, ordered by name and capped at
 * `INVENTORY_SEARCH_LIMIT` (5). A blank keyword, or the `GENERAL` intent
 * sentinel (case-insensitive), short-circuits to `[]` without ever issuing a
 * query.
 *
 * The tenant module is mocked so `withTenantContext(tenantId, fn)` runs `fn`
 * against an in-memory fake context. The fake `ctx.query` models the real SQL
 * contract: it reads the per-tenant inventory store and returns only the active
 * rows that match the supplied `pattern` ($1) / SKU ($2), ordered by name and
 * sliced to the `LIMIT` param ($3). Honoring the LIMIT param it is passed is
 * what verifies `search` supplies the correct bound. Asserting the mock is
 * invoked with the requested `tenantId` is what demonstrates tenant scoping.
 *
 * Hermetic: no database, no network.
 *
 * Feature: respond-leadz
 * Validates: Requirements 6.2
 */

import fc from 'fast-check'

// Mock the tenant module so `search` runs its callback against an in-memory
// fake context. The fake `query` emulates the inventory SELECT:
//   WHERE is_active = TRUE
//     AND (name ILIKE $1 OR description ILIKE $1 OR category ILIKE $1 OR sku = $2)
//   ORDER BY name
//   LIMIT $3
// A per-tenant inventory store (`__setInventory`) lets each generated case load
// the rows the fake should match against.
jest.mock('@/lib/pipeline/tenant', () => {
  const inventories = new Map<string, Array<Record<string, unknown>>>()

  // Emulate Postgres ILIKE for our generated patterns of the form `%core%`.
  // The keyword is escaped before being wrapped in `%...%`; for plain
  // alphanumeric keywords (all this test generates) the escape is a no-op, so
  // we strip the wrapping wildcards, undo any backslash escapes, and do a
  // case-insensitive substring test.
  const ilike = (value: unknown, pattern: string): boolean => {
    if (typeof value !== 'string') return false
    const core = pattern.slice(1, -1).replace(/\\(.)/g, '$1').toLowerCase()
    return value.toLowerCase().includes(core)
  }

  return {
    __setInventory: (tenantId: string, items: Array<Record<string, unknown>>) =>
      inventories.set(tenantId, items),
    __reset: () => inventories.clear(),
    withTenantContext: jest.fn(
      async (tenantId: string, fn: (ctx: unknown) => Promise<unknown>) =>
        fn({
          tenantId,
          query: async (_text: string, params: ReadonlyArray<unknown>) => {
            const [pattern, trimmed, limit] = params as [string, string, number]
            const items = inventories.get(tenantId) ?? []
            const matched = items
              .filter(
                (it) =>
                  it.is_active === true &&
                  (ilike(it.name, pattern) ||
                    ilike(it.description, pattern) ||
                    ilike(it.category, pattern) ||
                    it.sku === trimmed)
              )
              .sort((a, b) => String(a.name).localeCompare(String(b.name)))
              .slice(0, limit)
            return { rows: matched, rowCount: matched.length }
          },
        })
    ),
  }
})

import { search, INVENTORY_SEARCH_LIMIT } from '@/lib/pipeline/inventory'
import * as tenantModule from '@/lib/pipeline/tenant'
import type { InventoryItem } from '@/lib/pipeline/types'

/** Access the mock helpers and the spied `withTenantContext`. */
const mockTenant = tenantModule as unknown as {
  __setInventory: (tenantId: string, items: InventoryItem[]) => void
  __reset: () => void
  withTenantContext: jest.Mock
}

beforeEach(() => {
  mockTenant.__reset()
  mockTenant.withTenantContext.mockClear()
})

/** Run a healthy number of generated cases per property (>= 100). */
const RUNS = { numRuns: 200 }

/** Plain alphanumeric keyword so LIKE-escaping is a no-op and matching is exact. */
const keywordArb = fc.string({
  minLength: 1,
  maxLength: 6,
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
})

/** ISO 4217-ish currency code. */
const currencyArb = fc.constantFrom('USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR')

/**
 * Build an InventoryItem for a tenant. `matchesKeyword` controls whether the
 * item's name embeds the keyword (so the fake's ILIKE matches it); `active`
 * controls `is_active`.
 */
const itemArb = (tenantId: string, keyword: string, matchesKeyword: boolean, active: boolean) =>
  fc
    .record({
      id: fc.uuid(),
      sku: fc.string({ minLength: 4, maxLength: 10 }).map((s) => `SKU-${s.replace(/\s/g, '')}`),
      // A name that either embeds the keyword (guaranteed match) or is built
      // from characters that cannot contain it (guaranteed non-match).
      nameNoise: fc.string({ minLength: 0, maxLength: 8, unit: fc.constantFrom(...'!@#$^&*()'.split('')) }),
      quantity: fc.integer({ min: 0, max: 1000 }),
      price: fc.integer({ min: 0, max: 1_000_000 }).map((n) => n / 100),
      priceUsd: fc.integer({ min: 0, max: 1_000_000 }).map((n) => n / 100),
      currency: currencyArb,
    })
    .map(
      ({ id, sku, nameNoise, quantity, price, priceUsd, currency }): InventoryItem => ({
        id,
        tenant_id: tenantId,
        // Embed the keyword for matching items; symbols-only name for non-matching.
        name: matchesKeyword ? `Product ${keyword} ${nameNoise}` : `${nameNoise || '###'}`,
        sku,
        description: '',
        category: '',
        quantity,
        price,
        currency,
        price_usd: priceUsd,
        is_active: active,
      })
    )

/**
 * A complete generated scenario: a tenant, a keyword, and an inventory that
 * deliberately mixes (a) more than LIMIT active matching items so the cap is
 * regularly exercised, (b) inactive items that also match (must be excluded),
 * and (c) active items that do not match.
 */
const scenarioArb = fc
  .uuid()
  .chain((tenantId) =>
    keywordArb.chain((keyword) =>
      fc
        .record({
          // Up to ~12 active matches so the > 5 cap branch is hit often.
          activeMatching: fc.array(itemArb(tenantId, keyword, true, true), {
            minLength: 0,
            maxLength: 12,
          }),
          // Inactive items that match the keyword: must never be returned.
          inactiveMatching: fc.array(itemArb(tenantId, keyword, true, false), {
            minLength: 0,
            maxLength: 6,
          }),
          // Active items that do not match: must never be returned.
          activeNonMatching: fc.array(itemArb(tenantId, keyword, false, true), {
            minLength: 0,
            maxLength: 6,
          }),
        })
        .map(({ activeMatching, inactiveMatching, activeNonMatching }) => ({
          tenantId,
          keyword,
          items: [...activeMatching, ...inactiveMatching, ...activeNonMatching],
        }))
    )
  )

describe('Inventory_Service — Property 10: tenant-scoped and bounded search', () => {
  // Feature: respond-leadz, Property 10: Inventory search is tenant-scoped and bounded
  it('returns at most LIMIT active items, scoped to the requested tenant', async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ tenantId, keyword, items }) => {
        mockTenant.__reset()
        mockTenant.withTenantContext.mockClear()
        mockTenant.__setInventory(tenantId, items)

        const result = await search(tenantId, keyword)

        // Bounded: never more than the search limit, even when > 5 active
        // matches exist (the fake honors the LIMIT param `search` passes).
        expect(result.length).toBeLessThanOrEqual(INVENTORY_SEARCH_LIMIT)

        // Only active items are ever returned.
        expect(result.every((it) => it.is_active === true)).toBe(true);
        expect(result.some((it) => it.is_active === false)).toBe(false)

        // Every returned item belongs to the requested tenant.
        expect(result.every((it) => it.tenant_id === tenantId)).toBe(true)

        // Tenant scoping: the search ran inside the requested tenant's context.
        expect(mockTenant.withTenantContext).toHaveBeenCalledTimes(1)
        expect(mockTenant.withTenantContext.mock.calls[0][0]).toBe(tenantId)
      }),
      RUNS
    )
  })

  it('reaches the LIMIT exactly when more than LIMIT active matches exist', async () => {
    // A focused case that guarantees the > LIMIT branch: 8 active matching items.
    await fc.assert(
      fc.asyncProperty(fc.uuid(), keywordArb, async (tenantId, keyword) => {
        mockTenant.__reset()
        mockTenant.withTenantContext.mockClear()
        const many: InventoryItem[] = Array.from({ length: 8 }, (_, i) => ({
          id: `00000000-0000-4000-8000-00000000000${i}`,
          tenant_id: tenantId,
          name: `Item ${keyword} ${i}`,
          sku: `SKU-${i}`,
          description: '',
          category: '',
          quantity: i,
          price: i,
          currency: 'USD',
          price_usd: i,
          is_active: true,
        }))
        mockTenant.__setInventory(tenantId, many)

        const result = await search(tenantId, keyword)
        expect(result.length).toBe(INVENTORY_SEARCH_LIMIT)
      }),
      RUNS
    )
  })

  it('returns [] without querying for a blank keyword or the GENERAL sentinel (any case)', async () => {
    const blankOrSentinelArb = fc.oneof(
      fc.constantFrom('', '   ', '\t', '\n', ' \t\n '),
      // GENERAL in arbitrary casing, optionally surrounded by whitespace.
      fc
        .array(fc.constantFrom(...'general'.split('')), { minLength: 7, maxLength: 7 })
        .map(() => 'general')
        .chain(() =>
          fc.tuple(
            fc.constantFrom('', ' ', '  ', '\t'),
            fc.constantFrom('general', 'GENERAL', 'General', 'GeNeRaL', 'gEnErAl'),
            fc.constantFrom('', ' ', '  ', '\n')
          )
        )
        .map(([pre, word, post]) => `${pre}${word}${post}`)
    )

    await fc.assert(
      fc.asyncProperty(fc.uuid(), blankOrSentinelArb, async (tenantId, keyword) => {
        mockTenant.__reset()
        mockTenant.withTenantContext.mockClear()
        // Stock the tenant so a query, if it ran, could return rows.
        mockTenant.__setInventory(tenantId, [
          {
            id: '00000000-0000-4000-8000-000000000000',
            tenant_id: tenantId,
            name: 'general purpose widget',
            sku: 'SKU-G',
            description: '',
            category: '',
            quantity: 1,
            price: 1,
            currency: 'USD',
            price_usd: 1,
            is_active: true,
          },
        ])

        const result = await search(tenantId, keyword)

        expect(result).toEqual([])
        // No tenant context established and therefore no query issued.
        expect(mockTenant.withTenantContext).not.toHaveBeenCalled()
      }),
      RUNS
    )
  })
})
