/**
 * Mails2Leadz interop adapter.
 *
 * Mails2Leadz is the sibling marketing/demand-generation system. When it hands a
 * lead off to RespondLeadz, the result must be exactly one Conversation for that
 * lead's phone number within the receiving tenant — created if none exists yet,
 * or updated in place if one already does (Requirement 16.2). Leads and
 * customers are identified by the shared cross-system identifier, the phone
 * number (Requirement 16.4).
 *
 * The handoff persists into the receiving tenant's own data, so it runs through
 * {@link withTenantContext}: Row Level Security guarantees the conversation is
 * written under — and only visible to — the receiving tenant. The single-row
 * create-or-update is expressed as an idempotent upsert on the
 * `(tenant_id, phone_number)` unique key, so repeated handoffs of the same lead
 * never produce a second conversation (Requirement 16.2).
 *
 * Feature: respond-leadz
 * Requirements: 16.2, 16.4
 */

import { logger } from '../logger'
import { withTenantContext } from '../pipeline/tenant'
import type { Conversation } from '../pipeline/types'

/** Default customer name used when a lead arrives without one (Requirement 2.7 convention). */
const DEFAULT_CUSTOMER_NAME = 'Unknown'

/**
 * A lead handed off from Mails2Leadz. The phone number is the shared identifier
 * that links this lead to the same customer across sibling systems
 * (Requirement 16.4).
 */
export interface LeadHandoff {
  /** Receiving tenant id; scopes the conversation by RLS. */
  tenantId: string
  /** The lead's phone number — the shared cross-system identifier. */
  phoneNumber: string
  /** Optional display name; defaults to "Unknown" when absent or blank. */
  customerName?: string | null
}

/** Outcome of a {@link handoffLead} call. */
export interface LeadHandoffResult {
  /** The single conversation for the lead's phone number within the tenant. */
  conversation: Conversation
  /** Whether the conversation was newly created (`true`) or updated (`false`). */
  created: boolean
}

/** Normalize an optional display name to a non-empty value, defaulting to "Unknown". */
function normalizeCustomerName(name: string | null | undefined): string {
  if (typeof name === 'string' && name.trim().length > 0) {
    return name.trim()
  }
  return DEFAULT_CUSTOMER_NAME
}

/**
 * Create or update exactly one Conversation for a handed-off lead's phone number
 * within the receiving tenant (Requirement 16.2).
 *
 * Uses an upsert on the `(tenant_id, phone_number)` unique key so the operation
 * is idempotent: a brand-new lead creates one conversation, and a lead that
 * already has a conversation updates that same row (refreshing the customer
 * name when one is supplied, never overwriting an existing name with the
 * default). A new conversation starts with empty history and no processed
 * message id — the standard inbound pipeline takes over from there.
 *
 * @param lead The lead handed off from Mails2Leadz.
 * @returns The single conversation and whether it was created or updated.
 */
export async function handoffLead(lead: LeadHandoff): Promise<LeadHandoffResult> {
  const customerName = normalizeCustomerName(lead.customerName)

  return withTenantContext(lead.tenantId, async (ctx) => {
    const result = await ctx.query<Conversation & { __inserted: boolean }>(
      `INSERT INTO conversations (tenant_id, phone_number, customer_name, history)
            VALUES ($1, $2, $3, '')
       ON CONFLICT (tenant_id, phone_number) DO UPDATE
            SET customer_name = CASE
                  WHEN $3 <> $4 THEN EXCLUDED.customer_name
                  ELSE conversations.customer_name
                END,
                updated_at = now()
       RETURNING *, (xmax = 0) AS __inserted`,
      [lead.tenantId, lead.phoneNumber, customerName, DEFAULT_CUSTOMER_NAME]
    )

    const row = result.rows[0]
    const created = row.__inserted === true
    // Strip the upsert discriminator from the returned domain object.
    const { __inserted, ...conversation } = row

    logger.info('Mails2Leadz lead handed off', {
      type: 'integration',
      sibling: 'mails2leadz',
      tenant: lead.tenantId,
      phone: lead.phoneNumber,
      outcome: created ? 'conversation_created' : 'conversation_updated',
    })

    return { conversation: conversation as Conversation, created }
  })
}
