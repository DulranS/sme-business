/**
 * Inventory_Service — tenant-scoped keyword search over product/stock data for
 * the canonical RespondLeadz pipeline.
 *
 * {@link search} returns the inventory items that match an extracted search
 * keyword for the requesting tenant, capped at 5 results and restricted to
 * active items (Requirement 6.2). The search runs inside
 * {@link withTenantContext}, so every row it can see is already scoped to the
 * current tenant by Row Level Security — an item owned by another tenant is
 * never visible here (Requirements 12.2, 12.6). Items supplied through
 * AutoDealz are represented in the same `inventory` table for the owning
 * tenant, so they are returned by this search like any other stock
 * (Requirement 16.3).
 *
 * The query is backed by the `idx_inventory_tenant_active` index (see migration
 * 006) and is bounded to 5 rows, keeping search latency well under the 1 second
 * nominal-load target (Requirement 15.4).
 *
 * Feature: respond-leadz
 * Requirements: 6.2, 15.4, 16.3
 */

import type { InventoryItem } from './types'
import { withTenantContext } from './tenant'
import { logger } from '../logger'

/** Maximum number of inventory items returned for a single search (Requirement 6.2). */
export const INVENTORY_SEARCH_LIMIT = 5

/**
 * Sentinel keyword emitted by the AI_Responder's intent extraction when the
 * inbound message carries no specific product intent. It is treated as "no
 * search" so the responder can produce a general reply rather than matching the
 * literal word "GENERAL" against stock.
 */
const GENERAL_KEYWORD = 'GENERAL'

/**
 * Escape the LIKE/ILIKE wildcard characters (`%` and `_`) in a user-supplied
 * keyword so they are matched literally rather than acting as wildcards. The
 * default Postgres escape character (backslash) is used.
 */
function escapeLikePattern(keyword: string): string {
  return keyword.replace(/[\\%_]/g, (match) => `\\${match}`)
}

/**
 * Search the requesting tenant's inventory for active items matching `keyword`.
 *
 * Matching is case-insensitive across the item name, description, and category,
 * plus an exact match on SKU. Results are limited to {@link INVENTORY_SEARCH_LIMIT}
 * active items and are always scoped to the current tenant by RLS
 * (Requirements 6.2, 12.2). A blank keyword, or the `GENERAL` intent sentinel,
 * yields no results without issuing a query.
 *
 * @param tenantId The owning tenant's UUID; establishes the RLS context.
 * @param keyword  The extracted search keyword.
 * @returns Up to 5 active {@link InventoryItem}s belonging to the tenant.
 */
export async function search(tenantId: string, keyword: string): Promise<InventoryItem[]> {
  const trimmed = typeof keyword === 'string' ? keyword.trim() : ''
  if (trimmed === '' || trimmed.toUpperCase() === GENERAL_KEYWORD) {
    return []
  }

  const pattern = `%${escapeLikePattern(trimmed)}%`

  return withTenantContext(tenantId, async (ctx) => {
    const result = await ctx.query<InventoryItem>(
      `SELECT id, tenant_id, name, sku, description, category,
              quantity, price, currency, price_usd, is_active,
              created_at, updated_at
         FROM inventory
        WHERE is_active = TRUE
          AND (
                name ILIKE $1
             OR description ILIKE $1
             OR category ILIKE $1
             OR sku = $2
          )
        ORDER BY name
        LIMIT $3`,
      [pattern, trimmed, INVENTORY_SEARCH_LIMIT]
    )

    logger.info('Inventory search completed', {
      type: 'inventory',
      tenantId,
      keyword: trimmed,
      results: result.rowCount ?? 0,
    })

    return result.rows
  })
}
