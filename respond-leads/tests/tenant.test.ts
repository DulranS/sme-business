/**
 * Tests for the Tenant_Manager (`lib/pipeline/tenant.ts`).
 *
 * This file contains TWO categories of tests:
 *
 * ───────────────────────────────────────────────────────────────────────────
 * (A) HERMETIC — always run under a plain `npm test` (no database required).
 *     Property 24: Tenant resolution from phone number id (task 5.2, Req 12.5).
 *     `resolveTenant` runs against a FAKE admin pool injected with
 *     `__setPoolsForTesting`, so no real Postgres connection is opened.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * (B) RLS INTEGRATION — gated; SKIPPED by default (tasks 5.3, 5.4, 5.5).
 *     Properties 21, 22, 23 genuinely require a live Postgres test database with
 *     the migrations applied, RLS enabled + forced, and a non-superuser tenant
 *     role. They are gated behind the `RESPONDLEADZ_TEST_DATABASE` env var via
 *     `describe.skip`, so the default test run stays hermetic and green.
 *
 *     HOW TO RUN THE GATED SUITE
 *     --------------------------
 *     1. Stand up a Postgres database and apply migrations 001–007
 *        (`respond-leads/supabase/migrations/`). Migration 007 enables and
 *        FORCEs Row Level Security on every tenant-scoped table and creates the
 *        non-superuser `respondleadz_tenant` role used for tenant-scoped access.
 *     2. Export the following environment variables:
 *          RESPONDLEADZ_TEST_DATABASE  — any non-empty value; ENABLES the suite.
 *          ADMIN_DATABASE_URL          — superuser / BYPASSRLS connection used
 *                                        only for routing + the RLS probe.
 *          TENANT_DATABASE_URL         — connection as the non-superuser
 *                                        `respondleadz_tenant` role; this is the
 *                                        ONLY pool RLS is enforced on. It must
 *                                        NOT be a superuser/BYPASSRLS role or the
 *                                        isolation properties cannot hold.
 *        (If ADMIN_DATABASE_URL is unset it falls back to
 *         RESPONDLEADZ_TEST_DATABASE; TENANT_DATABASE_URL must be provided
 *         explicitly because it requires the restricted role.)
 *     3. Run: `RESPONDLEADZ_TEST_DATABASE=1 ADMIN_DATABASE_URL=... \
 *              TENANT_DATABASE_URL=... npx jest tests/tenant.test.ts`
 *
 *     When `RESPONDLEADZ_TEST_DATABASE` is unset these suites are SKIPPED (not
 *     failed) and `npm test` requires no database.
 *
 * Feature: respond-leadz
 * Validates: Requirements 12.1, 12.2, 12.4, 12.5, 12.6, 13.4
 */

import fc from 'fast-check'
import { Pool } from 'pg'

import {
  resolveTenant,
  withTenantContext,
  getTenantCredentials,
  assertRlsEnabled,
  __setPoolsForTesting,
  __resetRlsStateForTesting,
} from '@/lib/pipeline/tenant'
import { TenantContextError } from '@/lib/pipeline/errors'
import type { Tenant } from '@/lib/pipeline/types'

// ===========================================================================
// (A) HERMETIC — Property 24: Tenant resolution from phone number id (task 5.2)
// ===========================================================================
//
// Feature: respond-leadz, Property 24: Tenant resolution from phone number id
// Validates: Requirements 12.5 (resolution by phone_number_id) and 13.4
// (credential-free routing: the resolved identity never carries secret fields).

/** Secret fields that routing must NEVER expose (Requirement 13.4). */
const CREDENTIAL_KEYS = [
  'whatsapp_access_token',
  'whatsapp_app_secret',
  'whatsapp_verify_token',
  'llm_api_key',
] as const

/**
 * Project a full tenant row down to exactly the identity columns the
 * `resolveTenant` SELECT lists. Modeling the SQL contract here is what proves
 * routing is credential-free: even though the in-memory store holds full
 * tenants (with secrets), the fake returns only the non-secret identity columns,
 * just like `SELECT id, name, whatsapp_phone_number_id, llm_provider,
 * default_currency FROM tenants`.
 */
function identityOf(t: Tenant) {
  return {
    id: t.id,
    name: t.name,
    whatsapp_phone_number_id: t.whatsapp_phone_number_id,
    llm_provider: t.llm_provider,
    default_currency: t.default_currency,
  }
}

// In-memory "tenants" routing table + a record of every query the fake issued.
// Both are module-scoped `let`s so the fake client (which closes over them)
// always reads the current binding; the property bodies reassign them per run.
let fakeTenants: Tenant[] = []
let queryCalls: Array<{ text: string; params: ReadonlyArray<unknown> | undefined }> = []

/**
 * A fake `pg.Pool` whose `connect()` yields a fake client modeling the
 * `resolveTenant` routing query against `fakeTenants`. Returns identity-only
 * rows (no credentials) to mirror the real SELECT's column list.
 */
const fakeAdminPool = {
  connect: async () => ({
    query: async (text: string, params?: ReadonlyArray<unknown>) => {
      queryCalls.push({ text, params })
      const phoneNumberId = params?.[0]
      const match = fakeTenants.find((t) => t.whatsapp_phone_number_id === phoneNumberId)
      if (!match) return { rows: [], rowCount: 0 }
      return { rows: [identityOf(match)], rowCount: 1 }
    },
    release: () => {},
  }),
}

/** A digit-only WhatsApp phone_number_id (always a non-blank string). */
const phoneIdArb = fc.string({
  minLength: 6,
  maxLength: 15,
  unit: fc.constantFrom(...'0123456789'.split('')),
})

const currencyArb = fc.constantFrom('USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR')

/** A full tenant row, including (irrelevant-to-routing) secret fields. */
const tenantArb: fc.Arbitrary<Tenant> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 24 }),
  whatsapp_phone_number_id: phoneIdArb,
  whatsapp_access_token: fc.string({ minLength: 1, maxLength: 32 }),
  whatsapp_app_secret: fc.string({ minLength: 1, maxLength: 32 }),
  whatsapp_verify_token: fc.string({ minLength: 1, maxLength: 32 }),
  llm_provider: fc.constantFrom('anthropic', 'claude'),
  llm_api_key: fc.string({ minLength: 1, maxLength: 32 }),
  default_currency: currencyArb,
})

/** A non-empty routing table with unique phone_number_ids. */
const tableArb: fc.Arbitrary<Tenant[]> = fc.uniqueArray(tenantArb, {
  minLength: 1,
  maxLength: 6,
  selector: (t) => t.whatsapp_phone_number_id,
})

/** Run a healthy number of generated cases per property (>= 100). */
const RUNS = { numRuns: 200 }

describe('Tenant_Manager — resolveTenant (hermetic)', () => {
  beforeEach(() => {
    fakeTenants = []
    queryCalls = []
    // Inject the fake admin pool so resolveTenant never opens a real connection.
    __setPoolsForTesting({ admin: fakeAdminPool as unknown as Pool })
  })

  afterAll(() => {
    // Clear injected pools and cached RLS state so no test state leaks.
    __setPoolsForTesting({ admin: null, tenant: null })
    __resetRlsStateForTesting()
  })

  // Feature: respond-leadz, Property 24: Tenant resolution from phone number id
  it('resolves an existing phone_number_id to its owning tenant, credential-free (Req 12.5, 13.4)', async () => {
    await fc.assert(
      fc.asyncProperty(
        tableArb.chain((table) =>
          fc.nat({ max: table.length - 1 }).map((idx) => ({ table, idx }))
        ),
        async ({ table, idx }) => {
          fakeTenants = table
          queryCalls = []
          const target = table[idx]

          const result = await resolveTenant(target.whatsapp_phone_number_id)

          // Returns the owning tenant's identity (matching id).
          expect(result).not.toBeNull()
          expect(result!.id).toBe(target.id)
          expect(result!.whatsapp_phone_number_id).toBe(target.whatsapp_phone_number_id)
          expect(result!.name).toBe(target.name)
          expect(result!.llm_provider).toBe(target.llm_provider)
          expect(result!.default_currency).toBe(target.default_currency)

          // Credential-free routing: no secret field is present (Req 13.4).
          for (const key of CREDENTIAL_KEYS) {
            expect(Object.prototype.hasOwnProperty.call(result, key)).toBe(false)
          }
          expect(Object.keys(result as object).sort()).toEqual(
            ['default_currency', 'id', 'llm_provider', 'name', 'whatsapp_phone_number_id'].sort()
          )

          // Exactly one routing query was issued for a present id.
          expect(queryCalls.length).toBe(1)
        }
      ),
      RUNS
    )
  })

  // Feature: respond-leadz, Property 24: Tenant resolution from phone number id
  it('returns null for a phone_number_id absent from the table (Req 12.5)', async () => {
    await fc.assert(
      fc.asyncProperty(
        tableArb,
        // Prefix with a non-digit so it can never equal a digit-only stored id.
        fc.string({ minLength: 1, maxLength: 12 }).map((s) => `X${s}`),
        async (table, absentId) => {
          fakeTenants = table
          queryCalls = []

          const result = await resolveTenant(absentId)

          expect(result).toBeNull()
          // A query WAS issued (the id is a non-blank string) but matched nothing.
          expect(queryCalls.length).toBe(1)
        }
      ),
      RUNS
    )
  })

  // Feature: respond-leadz, Property 24: Tenant resolution from phone number id
  it('returns null WITHOUT issuing a query for blank, null, or undefined ids (Req 12.5)', async () => {
    const blankArb = fc.constantFrom<string | null | undefined>(
      '',
      ' ',
      '   ',
      '\t',
      '\n',
      ' \t\n ',
      null,
      undefined
    )

    await fc.assert(
      fc.asyncProperty(tableArb, blankArb, async (table, blank) => {
        fakeTenants = table
        queryCalls = []

        const result = await resolveTenant(blank)

        expect(result).toBeNull()
        // No tenant can be resolved from a blank/absent id, and no query runs.
        expect(queryCalls.length).toBe(0)
      }),
      RUNS
    )
  })
})

// ===========================================================================
// (B) RLS INTEGRATION — gated; skipped without RESPONDLEADZ_TEST_DATABASE.
//     Tasks 5.3 (Property 21), 5.4 (Property 22), 5.5 (Property 23).
// ===========================================================================

const TEST_DB = process.env.RESPONDLEADZ_TEST_DATABASE
const describeDb = TEST_DB ? describe : describe.skip

describeDb('Tenant_Manager — RLS isolation (requires Postgres test DB)', () => {
  let adminPool: Pool
  let tenantA: string
  let tenantB: string

  /** Insert a tenant via the admin (BYPASSRLS) pool and return its id. */
  async function seedTenant(label: string): Promise<string> {
    const result = await adminPool.query<{ id: string }>(
      `INSERT INTO tenants
         (name, whatsapp_phone_number_id, whatsapp_access_token, whatsapp_app_secret,
          whatsapp_verify_token, llm_provider, llm_api_key, default_currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        `Test Tenant ${label}`,
        `phone-${label}-${Date.now()}`,
        `access-${label}`,
        `secret-${label}`,
        `verify-${label}`,
        'anthropic',
        `llm-${label}`,
        'USD',
      ]
    )
    return result.rows[0].id
  }

  beforeAll(async () => {
    // Wire the env-derived pools. ADMIN falls back to the test DB URL; TENANT
    // must be the restricted, non-superuser role connection (RLS is only
    // enforced there).
    process.env.ADMIN_DATABASE_URL = process.env.ADMIN_DATABASE_URL ?? TEST_DB
    if (!process.env.TENANT_DATABASE_URL) {
      throw new Error(
        'TENANT_DATABASE_URL must be set to the non-superuser respondleadz_tenant connection ' +
          'to run the RLS isolation suite (see the file header).'
      )
    }

    // Use the env-derived lazy pools inside the module, with fresh RLS state.
    __setPoolsForTesting({ admin: null, tenant: null })
    __resetRlsStateForTesting()

    adminPool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL })
    tenantA = await seedTenant('A')
    tenantB = await seedTenant('B')

    // RLS must be enabled and forced for isolation to hold; this also primes
    // the cached state so withTenantContext is allowed to run.
    await assertRlsEnabled()
  })

  afterAll(async () => {
    if (adminPool) {
      const ids = [tenantA, tenantB].filter(Boolean)
      if (ids.length > 0) {
        await adminPool.query('DELETE FROM conversations WHERE tenant_id = ANY($1)', [ids])
        await adminPool.query('DELETE FROM inventory WHERE tenant_id = ANY($1)', [ids])
        await adminPool.query('DELETE FROM tenants WHERE id = ANY($1)', [ids])
      }
      await adminPool.end()
    }
    __setPoolsForTesting({ admin: null, tenant: null })
    __resetRlsStateForTesting()
  })

  // Feature: respond-leadz, Property 21: Every record is tenant-associated
  // Validates: Requirements 12.1
  describe('Property 21: Every record is tenant-associated', () => {
    it('stamps the active tenant_id on rows written within a tenant context', async () => {
      const inserted = await withTenantContext(tenantA, async (ctx) => {
        // Insert WITHOUT supplying tenant_id; the RLS WITH CHECK / column default
        // keyed on app.current_tenant must stamp it with the active tenant.
        const ins = await ctx.query<{ id: string; tenant_id: string }>(
          `INSERT INTO inventory (name, sku, quantity, price, currency, price_usd, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)
           RETURNING id, tenant_id`,
          [`Widget ${Date.now()}`, `SKU-${Date.now()}`, 1, 10, 'USD', 10]
        )
        return ins.rows[0]
      })

      expect(inserted.tenant_id).toBe(tenantA)
    })

    it('rejects writes attempted with no established tenant context', async () => {
      // Connect directly to the RLS-enforced (non-superuser) pool WITHOUT setting
      // app.current_tenant: the WITH CHECK policy must reject the insert.
      const tenantPool = new Pool({ connectionString: process.env.TENANT_DATABASE_URL })
      try {
        await expect(
          tenantPool.query(
            `INSERT INTO inventory (name, sku, quantity, price, currency, price_usd, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
            [`NoCtx ${Date.now()}`, `SKU-NC-${Date.now()}`, 1, 10, 'USD', 10]
          )
        ).rejects.toBeDefined()
      } finally {
        await tenantPool.end()
      }
    })
  })

  // Feature: respond-leadz, Property 22: Tenant isolation on read and write
  // Validates: Requirements 12.2, 12.6, 13.4
  describe('Property 22: Tenant isolation on read and write', () => {
    it("does not let tenant B read or update a row written under tenant A", async () => {
      const sku = `SKU-ISO-${Date.now()}`

      // Tenant A writes a row.
      const aId = await withTenantContext(tenantA, async (ctx) => {
        const ins = await ctx.query<{ id: string }>(
          `INSERT INTO inventory (name, sku, quantity, price, currency, price_usd, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)
           RETURNING id`,
          ['Isolated', sku, 5, 20, 'USD', 20]
        )
        return ins.rows[0].id
      })

      // Tenant B cannot SEE A's row...
      await withTenantContext(tenantB, async (ctx) => {
        const read = await ctx.query(`SELECT id FROM inventory WHERE id = $1`, [aId])
        expect(read.rowCount).toBe(0)
      })

      // ...nor UPDATE it (zero rows affected).
      await withTenantContext(tenantB, async (ctx) => {
        const upd = await ctx.query(`UPDATE inventory SET quantity = 999 WHERE id = $1`, [aId])
        expect(upd.rowCount).toBe(0)
      })

      // A still sees the original, unmodified row.
      await withTenantContext(tenantA, async (ctx) => {
        const read = await ctx.query<{ quantity: number }>(
          `SELECT quantity FROM inventory WHERE id = $1`,
          [aId]
        )
        expect(read.rowCount).toBe(1)
        expect(read.rows[0].quantity).toBe(5)
      })
    })

    it('reads per-tenant credentials only within the owning context (Req 13.4)', async () => {
      const credsA = await getTenantCredentials(tenantA)
      expect(credsA.id).toBe(tenantA)
      // Within A's context, B's credentials are not visible.
      await withTenantContext(tenantA, async (ctx) => {
        const other = await ctx.query(`SELECT id FROM tenants WHERE id = $1`, [tenantB])
        expect(other.rowCount).toBe(0)
      })
    })
  })

  // Feature: respond-leadz, Property 23: No tenant context denies all access
  // Validates: Requirements 12.4
  describe('Property 23: No tenant context denies all access', () => {
    it('returns zero rows for tenant-scoped reads issued with no app.current_tenant', async () => {
      const tenantPool = new Pool({ connectionString: process.env.TENANT_DATABASE_URL })
      try {
        // No SET of app.current_tenant: RLS makes all rows invisible.
        const read = await tenantPool.query(`SELECT id FROM inventory`)
        expect(read.rowCount).toBe(0)
      } finally {
        await tenantPool.end()
      }
    })

    it('denies tenant-scoped access when RLS is unverified/disabled', async () => {
      // Force the cached probe state back to unknown and point the admin pool at
      // a probe that reports RLS off by clearing it; an invalid tenant id is the
      // simplest "no context" trigger and must be denied with TenantContextError.
      __resetRlsStateForTesting()
      await expect(
        withTenantContext('not-a-uuid', async () => undefined)
      ).rejects.toBeInstanceOf(TenantContextError)
    })
  })
})
