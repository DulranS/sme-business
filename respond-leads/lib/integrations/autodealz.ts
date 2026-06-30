/**
 * AutoDealz interop adapter.
 *
 * AutoDealz is the sibling sourcing/supply system. Items it supplies must be
 * represented in RespondLeadz inventory for the owning tenant, so the
 * Inventory_Service can ground replies in them like any other stock
 * (Requirement 16.3). Supplied stock is keyed by SKU and, where it relates to a
 * customer or lead, the shared cross-system identifier is the phone number
 * (Requirement 16.4).
 *
 * Pulling the supply feed is a call to an external sibling: if AutoDealz is
 * unavailable RespondLeadz must keep handling inbound messages and only record
 * the integration failure in the system log (Requirement 16.5). For that reason
 * {@link fetchSuppliedItems} never throws — it returns `null` on any failure.
 * Writing the supplied items into the tenant's own inventory runs through
 * {@link withTenantContext}, so RLS scopes every upsert to the owning tenant.
 *
 * Feature: respond-leadz
 * Requirements: 16.3, 16.4, 16.5
 */

import { logger } from '../logger'
import { withTenantContext } from '../pipeline/tenant'

/**
 * A stock item supplied by AutoDealz. Mirrors the fields needed to represent the
 * item in RespondLeadz inventory for the owning tenant (Requirement 16.3). The
 * `sku` is the upsert key within a tenant.
 */
export interface SuppliedItem {
  name: string
  sku: string
  description?: string
  category?: string
  /** Available quantity; must be non-negative. */
  quantity: number
  /** Price in `currency`; must be non-negative. */
  price: number
  /** ISO 4217 currency code for `price`. */
  currency: string
  /** Price normalized to USD; defaults to `price` when not supplied. */
  priceUsd?: number
  /** Whether the item is active/sellable; defaults to true. */
  isActive?: boolean
}

/** A minimal `fetch` signature so tests can inject a stub transport. */
export type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string> }
) => Promise<{ ok: boolean; status: number; statusText: string; json: () => Promise<unknown> }>

/** Optional dependencies for {@link fetchSuppliedItems}, primarily for testability. */
export interface FetchOptions {
  /** Transport used to issue the HTTP request; defaults to global `fetch`. */
  fetchImpl?: FetchLike
  /** AutoDealz feed URL; defaults to the `AUTODEALZ_FEED_URL` env value. */
  feedUrl?: string
}

/** Outcome of a {@link syncSuppliedItems} run. */
export interface SyncResult {
  /** Number of items upserted into the tenant's inventory. */
  upserted: number
}

/**
 * Pull the current supply feed for a tenant from AutoDealz (Requirement 16.3).
 *
 * This is a sibling call: it never throws. When AutoDealz is unconfigured,
 * unreachable, or returns an error, the integration failure is logged and the
 * function returns `null` so inbound handling proceeds unaffected
 * (Requirement 16.5).
 *
 * @param tenantId The owning tenant id (used for routing/log attribution).
 * @param options  Optional injected transport / feed URL (for tests).
 * @returns The supplied items, or `null` when AutoDealz is unavailable.
 */
export async function fetchSuppliedItems(
  tenantId: string,
  options: FetchOptions = {}
): Promise<SuppliedItem[] | null> {
  const feedUrl = options.feedUrl ?? process.env.AUTODEALZ_FEED_URL

  if (!feedUrl || feedUrl.trim() === '') {
    logger.warn('AutoDealz supply fetch skipped; feed not configured', {
      type: 'integration',
      sibling: 'autodealz',
      tenant: tenantId,
    })
    return null
  }

  const fetchImpl: FetchLike = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)

  try {
    const response = await fetchImpl(feedUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      logger.error('AutoDealz supply fetch failed; continuing inbound handling', {
        type: 'integration',
        sibling: 'autodealz',
        tenant: tenantId,
        status: response.status,
        statusText: response.statusText,
      })
      return null
    }

    const body = (await response.json()) as { items?: SuppliedItem[] } | SuppliedItem[]
    const items = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items : []
    return items
  } catch (error) {
    // Sibling unreachable: log the integration failure and never block inbound
    // (Requirement 16.5).
    logger.error(
      'AutoDealz supply fetch errored; continuing inbound handling',
      {
        type: 'integration',
        sibling: 'autodealz',
        tenant: tenantId,
      },
      error instanceof Error ? error : undefined
    )
    return null
  }
}

/**
 * Represent AutoDealz-supplied items in the tenant's RespondLeadz inventory
 * (Requirement 16.3).
 *
 * Each item is upserted on the `(tenant_id, sku)` unique key inside the tenant's
 * RLS context, so a newly supplied SKU is inserted and an existing one has its
 * stock, price, and metadata refreshed in place. No item is ever written for or
 * visible to another tenant (Requirements 12.2, 16.3).
 *
 * @param tenantId The owning tenant id; establishes the RLS context.
 * @param items    The items supplied by AutoDealz.
 * @returns The number of items upserted.
 */
export async function syncSuppliedItems(
  tenantId: string,
  items: ReadonlyArray<SuppliedItem>
): Promise<SyncResult> {
  if (items.length === 0) {
    return { upserted: 0 }
  }

  return withTenantContext(tenantId, async (ctx) => {
    let upserted = 0
    for (const item of items) {
      await ctx.query(
        `INSERT INTO inventory
              (tenant_id, name, sku, description, category,
               quantity, price, currency, price_usd, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tenant_id, sku) DO UPDATE
              SET name = EXCLUDED.name,
                  description = EXCLUDED.description,
                  category = EXCLUDED.category,
                  quantity = EXCLUDED.quantity,
                  price = EXCLUDED.price,
                  currency = EXCLUDED.currency,
                  price_usd = EXCLUDED.price_usd,
                  is_active = EXCLUDED.is_active,
                  updated_at = now()`,
        [
          tenantId,
          item.name,
          item.sku,
          item.description ?? null,
          item.category ?? null,
          item.quantity,
          item.price,
          item.currency,
          item.priceUsd ?? item.price,
          item.isActive ?? true,
        ]
      )
      upserted += 1
    }

    logger.info('AutoDealz supplied items synced into tenant inventory', {
      type: 'integration',
      sibling: 'autodealz',
      tenant: tenantId,
      upserted,
    })

    return { upserted }
  })
}

/**
 * Convenience flow: pull the AutoDealz supply feed and represent it in the
 * tenant's inventory. When AutoDealz is unavailable the failure is already
 * logged by {@link fetchSuppliedItems} and this returns a zero-item result, so
 * inbound handling is never blocked (Requirement 16.5).
 *
 * @param tenantId The owning tenant id.
 * @param options  Optional injected transport / feed URL (for tests).
 * @returns The number of items upserted (0 when AutoDealz is unavailable).
 */
export async function syncFromAutoDealz(
  tenantId: string,
  options: FetchOptions = {}
): Promise<SyncResult> {
  const items = await fetchSuppliedItems(tenantId, options)
  if (items === null) {
    return { upserted: 0 }
  }
  return syncSuppliedItems(tenantId, items)
}
