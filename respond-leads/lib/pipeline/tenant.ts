/**
 * Tenant_Manager — per-tenant resolution, RLS-enforced data access, and the
 * startup RLS probe for the canonical RespondLeadz pipeline.
 *
 * Tenant isolation is enforced at the database layer with Row Level Security
 * (Requirement 12.3). Every tenant-scoped read or write runs inside a
 * transaction that first sets `app.current_tenant`, on a connection that uses
 * the non-superuser `respondleadz_tenant` role so the `FORCE ROW LEVEL
 * SECURITY` policies always apply (the Supabase service role is never used for
 * tenant-scoped access because it bypasses RLS). When no tenant context is
 * established — or when RLS is disabled/unavailable — the policies make zero
 * rows visible and reject all writes, which denies the operation
 * (Requirements 12.2, 12.4, 12.6).
 *
 * Two connection pools are used:
 *  - the **tenant pool** (`TENANT_DATABASE_URL`, non-superuser role) backs
 *    {@link withTenantContext} and is the only path for tenant-scoped data.
 *  - the **admin pool** (`ADMIN_DATABASE_URL` / `DATABASE_URL`) is used solely
 *    for routing ({@link resolveTenant}) and the RLS probe
 *    ({@link assertRlsEnabled}). It must connect as a role able to read the
 *    `tenants` routing table (e.g. superuser or a `BYPASSRLS` role) and is never
 *    used to read or write tenant-scoped business data.
 *
 * Per-tenant credentials live in the `tenants` row and are only readable from
 * within the owning tenant's context, so {@link getTenantCredentials} reads them
 * through {@link withTenantContext}; {@link resolveTenant} returns a credential
 * free {@link TenantIdentity} so routing never exposes secrets (Requirement 13.4).
 *
 * Feature: respond-leadz
 * Requirements: 12.1, 12.2, 12.4, 12.5, 12.6, 13.4
 */

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'
import type { Tenant } from './types'
import { TenantContextError } from './errors'
import { logger } from '../logger'

/**
 * The tenant-scoped tables protected by RLS. Every one of these must have RLS
 * both enabled and forced for tenant isolation to hold (see migration 007). The
 * {@link assertRlsEnabled} probe checks each of them.
 */
export const TENANT_SCOPED_TABLES = [
  'tenants',
  'inventory',
  'conversations',
  'close_events',
  'follow_up_actions',
  'customer_consent',
  'inbound_queue',
] as const

/**
 * A credential-free view of a Tenant, sufficient to route an inbound message to
 * its owning tenant. Secret fields (`whatsapp_access_token`, `whatsapp_app_secret`,
 * `whatsapp_verify_token`, `llm_api_key`) are deliberately omitted because
 * routing happens before any tenant context exists; credentials are only ever
 * read within the owning context (Requirement 13.4).
 */
export type TenantIdentity = Pick<
  Tenant,
  'id' | 'name' | 'whatsapp_phone_number_id' | 'llm_provider' | 'default_currency'
>

/**
 * The query surface handed to the callback of {@link withTenantContext}. All
 * queries issued through it run inside the tenant transaction on the
 * RLS-enforced connection, so they only ever see/affect the current tenant's
 * rows.
 */
export interface TenantContext {
  /** The tenant id that scopes every query issued through this context. */
  readonly tenantId: string
  /**
   * Run a parameterized query within the established tenant context. Use bound
   * parameters (`$1`, `$2`, …) rather than string interpolation.
   */
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: ReadonlyArray<unknown>
  ): Promise<QueryResult<R>>
}

/** Overridable connection pools (primarily for tests against a Postgres test DB). */
interface PoolBundle {
  tenant: Pool | null
  admin: Pool | null
}

const pools: PoolBundle = { tenant: null, admin: null }

/** Cached result of the RLS probe; gates all tenant-scoped access. */
type RlsState = 'unknown' | 'enabled' | 'disabled'
let rlsState: RlsState = 'unknown'

/** Matches a canonical RFC 4122 UUID (the `tenants.id` format). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/**
 * Lazily build the tenant (RLS-enforced) connection pool from
 * `TENANT_DATABASE_URL`. Denies access when the connection is not configured
 * (Requirement 12.4 — RLS-enforced path unavailable).
 */
function getTenantPool(): Pool {
  if (pools.tenant) return pools.tenant
  const connectionString = process.env.TENANT_DATABASE_URL
  if (!connectionString || connectionString.trim() === '') {
    throw new TenantContextError(
      'TENANT_DATABASE_URL (RLS-enforced non-superuser connection) is not configured; ' +
        'tenant-scoped access denied'
    )
  }
  pools.tenant = new Pool({ connectionString })
  return pools.tenant
}

/**
 * Lazily build the admin connection pool used only for routing and the RLS
 * probe. Prefers `ADMIN_DATABASE_URL`, falling back to `DATABASE_URL`.
 */
function getAdminPool(): Pool {
  if (pools.admin) return pools.admin
  const connectionString = process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL
  if (!connectionString || connectionString.trim() === '') {
    throw new TenantContextError(
      'ADMIN_DATABASE_URL/DATABASE_URL (tenant routing connection) is not configured; ' +
        'tenant resolution unavailable'
    )
  }
  pools.admin = new Pool({ connectionString })
  return pools.admin
}

/**
 * Resolve the owning tenant for an inbound message from the receiving WhatsApp
 * `phone_number_id` (Requirement 12.5). Returns a credential-free
 * {@link TenantIdentity}, or `null` when the id is absent/blank or no tenant
 * owns it.
 *
 * This lookup runs on the admin routing connection because the owning tenant is
 * not yet known (no context can be established for an unknown tenant). Only
 * non-secret identity columns are selected so routing never exposes per-tenant
 * credentials (Requirement 13.4).
 *
 * @param phoneNumberId The WhatsApp `phone_number_id` the webhook was delivered to.
 * @returns The owning tenant's identity, or `null` if none matches.
 */
export async function resolveTenant(
  phoneNumberId: string | null | undefined
): Promise<TenantIdentity | null> {
  if (typeof phoneNumberId !== 'string' || phoneNumberId.trim() === '') {
    return null
  }

  const client = await getAdminPool().connect()
  try {
    const result = await client.query<TenantIdentity>(
      `SELECT id, name, whatsapp_phone_number_id, llm_provider, default_currency
         FROM tenants
        WHERE whatsapp_phone_number_id = $1
        LIMIT 1`,
      [phoneNumberId]
    )
    if (result.rowCount === 0) {
      logger.warn('No tenant resolved for WhatsApp phone_number_id', {
        type: 'tenant',
        phoneNumberId,
      })
      return null
    }
    const tenant = result.rows[0]
    logger.info('Resolved tenant for inbound message', {
      type: 'tenant',
      tenantId: tenant.id,
      phoneNumberId,
    })
    return tenant
  } finally {
    client.release()
  }
}

/**
 * List the ids of every tenant, for admin/cron operations that must fan out
 * across all tenants (e.g. the daily Lifecycle_Runner). This routing-level read
 * of the `tenants` table runs on the admin pool — the same pool used by
 * {@link resolveTenant} — because no single tenant context can span all
 * tenants. It returns ids only and never reads per-tenant credentials, which
 * remain accessible solely within each owning tenant's context (Requirement
 * 13.4). Per-tenant business data is still only ever read/written through
 * {@link withTenantContext}.
 *
 * @returns The id of every tenant.
 */
export async function listTenantIds(): Promise<string[]> {
  const client = await getAdminPool().connect()
  try {
    const result = await client.query<{ id: string }>(`SELECT id FROM tenants ORDER BY created_at`)
    return result.rows.map((row) => row.id)
  } finally {
    client.release()
  }
}

/**
 * Lightweight database reachability probe for the health-check endpoint
 * (Requirement 17.4). Issues a trivial `SELECT 1` over the admin routing pool —
 * the same connection used for {@link resolveTenant} — to confirm the database
 * is reachable. No tenant-scoped or business data is read, and no credential
 * values are returned: the result is a plain boolean plus a measured latency.
 *
 * Resolves to a reachability report rather than throwing so the health endpoint
 * can degrade gracefully and report the failure instead of crashing.
 *
 * @returns `{ reachable, latencyMs }`, where `latencyMs` is the round-trip time
 *          of the probe query.
 */
export async function pingDatabase(): Promise<{ reachable: boolean; latencyMs: number }> {
  const startedAt = Date.now()
  let client: PoolClient | undefined
  try {
    client = await getAdminPool().connect()
    await client.query('SELECT 1')
    return { reachable: true, latencyMs: Date.now() - startedAt }
  } catch (error) {
    logger.error(
      'Health check: database is not reachable',
      { type: 'health' },
      error as Error
    )
    return { reachable: false, latencyMs: Date.now() - startedAt }
  } finally {
    client?.release()
  }
}

/**
 * Startup probe that verifies Row Level Security is both enabled and forced on
 * every tenant-scoped table. Caches the result so subsequent tenant-scoped
 * operations can be denied cheaply when RLS is off.
 *
 * Throws {@link TenantContextError} when any tenant-scoped table is missing or
 * does not have RLS enabled and forced, and when the status cannot be
 * determined (e.g. the database is unreachable). In all failure cases the
 * cached state is set to `disabled` so {@link withTenantContext} denies
 * tenant-scoped reads and writes (Requirement 12.4).
 */
export async function assertRlsEnabled(): Promise<void> {
  let client: PoolClient | undefined
  try {
    client = await getAdminPool().connect()
    const result = await client.query<{
      relname: string
      relrowsecurity: boolean
      relforcerowsecurity: boolean
    }>(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = ANY($1::text[])`,
      [TENANT_SCOPED_TABLES as unknown as string[]]
    )

    const byName = new Map(result.rows.map((row) => [row.relname, row]))
    const offenders: string[] = []
    for (const table of TENANT_SCOPED_TABLES) {
      const row = byName.get(table)
      if (!row || row.relrowsecurity !== true || row.relforcerowsecurity !== true) {
        offenders.push(table)
      }
    }

    if (offenders.length > 0) {
      rlsState = 'disabled'
      throw new TenantContextError(
        `Row Level Security is not enabled and forced on tenant-scoped table(s): ` +
          `${offenders.join(', ')}; tenant-scoped access denied`
      )
    }

    rlsState = 'enabled'
    logger.info('RLS probe passed; tenant isolation is enforced for all tenant-scoped tables', {
      type: 'tenant',
      tables: TENANT_SCOPED_TABLES.length,
    })
  } catch (error) {
    if (error instanceof TenantContextError) {
      logger.error('RLS probe failed; tenant-scoped operations will be denied', {
        type: 'tenant',
      })
      throw error
    }
    // Status could not be determined (e.g. DB unavailable) — deny by default.
    rlsState = 'disabled'
    const denied = new TenantContextError(
      'RLS status could not be verified; tenant-scoped access denied',
      { cause: error }
    )
    logger.error(
      'RLS probe could not determine status; tenant-scoped operations will be denied',
      { type: 'tenant' },
      error as Error
    )
    throw denied
  } finally {
    client?.release()
  }
}

/**
 * Run `fn` within an established tenant context. Opens a transaction on the
 * RLS-enforced (non-superuser) connection, sets `app.current_tenant` for the
 * life of that transaction, and runs `fn` against a {@link TenantContext} whose
 * every query is therefore scoped to `tenantId`. Commits on success and rolls
 * back on any error (Requirements 12.2, 12.3, 12.6).
 *
 * Tenant-scoped access is denied (throws {@link TenantContextError}) when:
 *  - `tenantId` is not a valid UUID, or
 *  - the RLS probe reports RLS disabled/unavailable (Requirement 12.4). The
 *    probe runs lazily on first use if it has not run at startup.
 *
 * `app.current_tenant` is set with `set_config(..., is_local => true)` so it is
 * scoped to this transaction only and cleared on commit/rollback — a connection
 * returned to the pool never leaks one tenant's context into another's request.
 *
 * @param tenantId The owning tenant's UUID.
 * @param fn       Callback executed with a tenant-scoped query surface.
 * @returns Whatever `fn` resolves to.
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (ctx: TenantContext) => Promise<T>
): Promise<T> {
  if (!isValidUuid(tenantId)) {
    throw new TenantContextError(
      'A valid tenant id is required to establish tenant context; tenant-scoped access denied'
    )
  }

  // Ensure RLS has been verified. Run the probe lazily if startup did not.
  if (rlsState === 'unknown') {
    await assertRlsEnabled()
  }
  if (rlsState !== 'enabled') {
    throw new TenantContextError(
      'RLS is disabled or unavailable; tenant-scoped access denied'
    )
  }

  const client = await getTenantPool().connect()
  try {
    await client.query('BEGIN')
    // SET LOCAL cannot be parameterized; use set_config with is_local => true so
    // the GUC is bound to this transaction and never persists on the pooled
    // connection.
    await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantId])

    const ctx: TenantContext = {
      tenantId,
      query: (text, params) => client.query(text, params ? [...params] : undefined),
    }

    const result = await fn(ctx)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Ignore rollback failures; surface the original error below.
    }
    throw error
  } finally {
    client.release()
  }
}

/**
 * Read the owning tenant's full record, including per-tenant credentials, from
 * within its own context. Because RLS only exposes the `tenants` row whose `id`
 * equals `app.current_tenant`, credentials are accessible only to the owning
 * tenant (Requirements 13.4, 12.6).
 *
 * @param tenantId The owning tenant's UUID.
 * @returns The full {@link Tenant} record.
 * @throws TenantContextError if the tenant cannot be read within its own context.
 */
export async function getTenantCredentials(tenantId: string): Promise<Tenant> {
  return withTenantContext(tenantId, async (ctx) => {
    const result = await ctx.query<Tenant>(`SELECT * FROM tenants WHERE id = $1 LIMIT 1`, [
      tenantId,
    ])
    if (result.rowCount === 0) {
      throw new TenantContextError(
        'Tenant record is not accessible within its own context; tenant-scoped access denied'
      )
    }
    return result.rows[0]
  })
}

/**
 * Override the connection pools and reset cached RLS state. Intended for tests
 * that exercise tenant isolation against a Postgres test database. Passing
 * `undefined` for a pool leaves the lazy default (env-derived) pool in place.
 */
export function __setPoolsForTesting(next: { tenant?: Pool | null; admin?: Pool | null }): void {
  if (next.tenant !== undefined) pools.tenant = next.tenant
  if (next.admin !== undefined) pools.admin = next.admin
  rlsState = 'unknown'
}

/** Reset cached RLS probe state (primarily for tests). */
export function __resetRlsStateForTesting(): void {
  rlsState = 'unknown'
}
