/**
 * Consent_Manager — per-customer messaging consent, opt-out, and data deletion
 * for the canonical RespondLeadz pipeline.
 *
 * WhatsApp policy and GDPR require that messaging respect consent and data
 * rights. This module records, per customer, whether consent to receive
 * messages has been granted (Requirement 18.1) and whether the customer has
 * opted out (Requirement 18.4), and it removes a customer's conversation and
 * personal data on request (Requirement 18.3). The Lifecycle_Runner consults
 * {@link getConsent} to skip customers who have not granted consent or who have
 * opted out (Requirements 18.2, 18.4).
 *
 * Every operation runs inside {@link withTenantContext}, so each read and write
 * is scoped to the requesting tenant by Row Level Security: one tenant can
 * never read, change, or delete another tenant's consent state or conversation
 * (Requirements 12.2, 12.6). Consent and conversation rows are keyed by
 * `(tenant_id, phone_number)` — the shared phone-number identifier used across
 * the sibling systems (Requirement 16.4).
 *
 * Feature: respond-leadz
 * Requirements: 18.1, 18.3, 18.4
 */

import { withTenantContext } from './tenant'
import { logger } from '../logger'

/**
 * The recorded messaging consent state for a single customer within a tenant.
 * Mirrors the `customer_consent` row, keyed by `(tenant_id, phone_number)`.
 */
export interface CustomerConsent {
  tenant_id: string
  phone_number: string
  /** Whether the customer has granted consent to receive messages (Requirement 18.1). */
  consent_granted: boolean
  /** Whether the customer has opted out of further messages (Requirement 18.4). */
  opted_out: boolean
  created_at?: string
  updated_at?: string
}

/** Outcome of a customer data deletion request (Requirement 18.3). */
export interface DeletionResult {
  /** Number of conversation records removed for the customer. */
  conversationsDeleted: number
  /** Number of consent records removed for the customer. */
  consentDeleted: number
}

/** Normalize a phone number argument; throws on a blank/invalid value. */
function normalizePhone(phoneNumber: string): string {
  const trimmed = typeof phoneNumber === 'string' ? phoneNumber.trim() : ''
  if (trimmed === '') {
    throw new TypeError('A non-empty phone number is required')
  }
  return trimmed
}

/**
 * Record whether a customer has granted consent to receive messages
 * (Requirement 18.1). Creates the consent record for `(tenant_id, phone_number)`
 * if absent, otherwise updates the existing record's `consent_granted` flag.
 * The customer's `opted_out` state is left unchanged — opt-out is managed
 * separately by {@link recordOptOut}.
 *
 * @param tenantId    The owning tenant's UUID; establishes the RLS context.
 * @param phoneNumber The customer's phone number (shared identifier, Req 16.4).
 * @param granted     Whether consent is granted.
 * @returns The stored {@link CustomerConsent} record.
 */
export async function recordConsent(
  tenantId: string,
  phoneNumber: string,
  granted: boolean
): Promise<CustomerConsent> {
  const phone = normalizePhone(phoneNumber)

  return withTenantContext(tenantId, async (ctx) => {
    const result = await ctx.query<CustomerConsent>(
      `INSERT INTO customer_consent (tenant_id, phone_number, consent_granted)
            VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, phone_number)
       DO UPDATE SET consent_granted = EXCLUDED.consent_granted,
                     updated_at = NOW()
         RETURNING tenant_id, phone_number, consent_granted, opted_out,
                   created_at, updated_at`,
      [tenantId, phone, granted]
    )

    logger.info('Recorded customer consent', {
      type: 'consent',
      tenantId,
      phone,
      consentGranted: granted,
    })

    return result.rows[0]
  })
}

/**
 * Record that a customer has opted out of further messages (Requirement 18.4).
 * Creates the consent record for `(tenant_id, phone_number)` if absent (with
 * `opted_out = true`), otherwise sets the existing record's `opted_out` flag.
 * Once opted out, the Lifecycle_Runner stops sending follow-up messages to that
 * customer (Requirements 18.4, 18.2).
 *
 * @param tenantId    The owning tenant's UUID; establishes the RLS context.
 * @param phoneNumber The customer's phone number (shared identifier, Req 16.4).
 * @returns The stored {@link CustomerConsent} record reflecting the opt-out.
 */
export async function recordOptOut(
  tenantId: string,
  phoneNumber: string
): Promise<CustomerConsent> {
  const phone = normalizePhone(phoneNumber)

  return withTenantContext(tenantId, async (ctx) => {
    const result = await ctx.query<CustomerConsent>(
      `INSERT INTO customer_consent (tenant_id, phone_number, opted_out)
            VALUES ($1, $2, TRUE)
       ON CONFLICT (tenant_id, phone_number)
       DO UPDATE SET opted_out = TRUE,
                     updated_at = NOW()
         RETURNING tenant_id, phone_number, consent_granted, opted_out,
                   created_at, updated_at`,
      [tenantId, phone]
    )

    logger.info('Recorded customer opt-out', {
      type: 'consent',
      tenantId,
      phone,
    })

    return result.rows[0]
  })
}

/**
 * Read a customer's recorded consent state, or `null` when no record exists for
 * `(tenant_id, phone_number)`. Used by the Lifecycle_Runner to gate follow-ups:
 * a customer with no record, with consent not granted, or who has opted out is
 * not sent follow-up messages (Requirements 18.2, 18.4).
 *
 * @param tenantId    The owning tenant's UUID; establishes the RLS context.
 * @param phoneNumber The customer's phone number (shared identifier, Req 16.4).
 * @returns The {@link CustomerConsent} record, or `null` if none exists.
 */
export async function getConsent(
  tenantId: string,
  phoneNumber: string
): Promise<CustomerConsent | null> {
  const phone = normalizePhone(phoneNumber)

  return withTenantContext(tenantId, async (ctx) => {
    const result = await ctx.query<CustomerConsent>(
      `SELECT tenant_id, phone_number, consent_granted, opted_out,
              created_at, updated_at
         FROM customer_consent
        WHERE phone_number = $1
        LIMIT 1`,
      [phone]
    )
    return result.rowCount === 0 ? null : result.rows[0]
  })
}

/**
 * Delete a customer's conversation and personal data for the requesting tenant
 * in response to a deletion request (Requirement 18.3). Removes both the
 * conversation record (which carries the customer name and message history) and
 * the consent record for `(tenant_id, phone_number)`, leaving no retrievable
 * personal record for that customer within the tenant.
 *
 * Both deletes run within the same tenant context (transaction), so RLS scopes
 * them to the requesting tenant — another tenant's data for the same phone
 * number is never affected (Requirements 12.2, 12.6). Deleting the conversation
 * cascades to its dependent close-event and follow-up records via the
 * `ON DELETE CASCADE` foreign keys defined in migration 006.
 *
 * @param tenantId    The requesting tenant's UUID; establishes the RLS context.
 * @param phoneNumber The customer's phone number (shared identifier, Req 16.4).
 * @returns Counts of the conversation and consent records removed.
 */
export async function deleteCustomerData(
  tenantId: string,
  phoneNumber: string
): Promise<DeletionResult> {
  const phone = normalizePhone(phoneNumber)

  return withTenantContext(tenantId, async (ctx) => {
    const conversationResult = await ctx.query(
      `DELETE FROM conversations WHERE phone_number = $1`,
      [phone]
    )
    const consentResult = await ctx.query(
      `DELETE FROM customer_consent WHERE phone_number = $1`,
      [phone]
    )

    const conversationsDeleted = conversationResult.rowCount ?? 0
    const consentDeleted = consentResult.rowCount ?? 0

    logger.info('Deleted customer personal data on request', {
      type: 'consent',
      tenantId,
      phone,
      conversationsDeleted,
      consentDeleted,
    })

    return { conversationsDeleted, consentDeleted }
  })
}
