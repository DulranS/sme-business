/**
 * CashFlow interop adapter.
 *
 * When a Close_Event is recorded, RespondLeadz makes the deal value, currency,
 * customer identifier, and close timestamp available to the sibling CashFlow
 * system so money tracking can pick the closed deal up (Requirement 16.1). The
 * customer is identified by the shared identifier used across all sibling
 * systems — the phone number (Requirement 16.4).
 *
 * CashFlow is an external sibling. If it is unavailable (unconfigured,
 * unreachable, or returning an error) RespondLeadz must continue handling
 * inbound messages and only record the integration failure in the system log —
 * a sibling outage never blocks inbound handling (Requirement 16.5). For that
 * reason {@link publishCloseEvent} never throws: it always resolves to a
 * {@link CashFlowPublishResult} describing the outcome.
 *
 * Feature: respond-leadz
 * Requirements: 16.1, 16.4, 16.5
 */

import { logger } from '../logger'
import type { CloseEvent } from '../pipeline/types'

/**
 * The contract exposed to CashFlow for a recorded Close_Event. This is the
 * exact set of fields a closed deal makes available to money tracking
 * (Requirement 16.1). `customerId` is the shared phone-number identifier
 * (Requirement 16.4).
 */
export interface CashFlowCloseEventPayload {
  /** Deal value associated with the close (Requirement 16.1). */
  dealValue: number
  /** ISO 4217 currency code for `dealValue` (Requirement 16.1). */
  currency: string
  /** Shared cross-system identifier: the customer phone number (Requirements 16.1, 16.4). */
  customerId: string
  /** ISO-8601 timestamp of the close (Requirement 16.1). */
  closedAt: string
  /** Owning tenant id, so CashFlow can attribute the deal to the right business. */
  tenantId: string
}

/** Discriminated outcome of a {@link publishCloseEvent} attempt. */
export type CashFlowPublishResult =
  /** The payload was delivered to CashFlow successfully. */
  | { status: 'published'; payload: CashFlowCloseEventPayload }
  /** No CashFlow endpoint is configured; the payload was built but not sent. */
  | { status: 'skipped'; payload: CashFlowCloseEventPayload; reason: string }
  /** CashFlow was unavailable; the failure was logged and inbound is unaffected. */
  | { status: 'failed'; payload: CashFlowCloseEventPayload; reason: string }

/** A minimal `fetch` signature so tests can inject a stub transport. */
export type FetchLike = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
  }
) => Promise<{ ok: boolean; status: number; statusText: string }>

/** Optional dependencies for {@link publishCloseEvent}, primarily for testability. */
export interface PublishOptions {
  /** Transport used to issue the HTTP request; defaults to global `fetch`. */
  fetchImpl?: FetchLike
  /** CashFlow endpoint URL; defaults to the `CASHFLOW_WEBHOOK_URL` env value. */
  endpointUrl?: string
}

/**
 * Build the CashFlow-facing payload from a recorded Close_Event. The deal value,
 * currency, customer phone number, and close timestamp are exposed exactly as
 * stored on the event (Requirements 16.1, 16.4).
 */
export function buildCloseEventPayload(event: CloseEvent): CashFlowCloseEventPayload {
  return {
    dealValue: event.deal_value,
    currency: event.currency,
    customerId: event.phone_number,
    closedAt: event.closed_at,
    tenantId: event.tenant_id,
  }
}

/**
 * Make a recorded Close_Event available to CashFlow (Requirement 16.1).
 *
 * Builds the {@link CashFlowCloseEventPayload} and posts it to the configured
 * CashFlow endpoint. This call never throws: if CashFlow is unconfigured the
 * result is `skipped`, and if CashFlow is unreachable or returns an error the
 * failure is logged and the result is `failed`. In either case inbound message
 * handling is unaffected (Requirement 16.5).
 *
 * @param event   The recorded Close_Event to publish.
 * @param options Optional injected transport / endpoint (for tests).
 * @returns The outcome and the payload that was (or would have been) sent.
 */
export async function publishCloseEvent(
  event: CloseEvent,
  options: PublishOptions = {}
): Promise<CashFlowPublishResult> {
  const payload = buildCloseEventPayload(event)
  const endpointUrl = options.endpointUrl ?? process.env.CASHFLOW_WEBHOOK_URL

  if (!endpointUrl || endpointUrl.trim() === '') {
    const reason = 'CASHFLOW_WEBHOOK_URL is not configured'
    logger.warn('CashFlow close-event publish skipped; endpoint not configured', {
      type: 'integration',
      sibling: 'cashflow',
      tenant: payload.tenantId,
      phone: payload.customerId,
    })
    return { status: 'skipped', payload, reason }
  }

  const fetchImpl: FetchLike = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)

  try {
    const response = await fetchImpl(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const reason = `CashFlow responded ${response.status} ${response.statusText}`
      // Sibling returned an error: log the integration failure and carry on
      // (Requirement 16.5).
      logger.error('CashFlow close-event publish failed; continuing inbound handling', {
        type: 'integration',
        sibling: 'cashflow',
        tenant: payload.tenantId,
        phone: payload.customerId,
        status: response.status,
        statusText: response.statusText,
      })
      return { status: 'failed', payload, reason }
    }

    logger.info('CashFlow close-event published', {
      type: 'integration',
      sibling: 'cashflow',
      tenant: payload.tenantId,
      phone: payload.customerId,
    })
    return { status: 'published', payload }
  } catch (error) {
    // Sibling unreachable: log the integration failure and never block inbound
    // (Requirement 16.5).
    const reason = error instanceof Error ? error.message : String(error)
    logger.error(
      'CashFlow close-event publish errored; continuing inbound handling',
      {
        type: 'integration',
        sibling: 'cashflow',
        tenant: payload.tenantId,
        phone: payload.customerId,
      },
      error instanceof Error ? error : undefined
    )
    return { status: 'failed', payload, reason }
  }
}
