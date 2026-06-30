/**
 * Outbound_Sender — delivers customer-facing replies over the WhatsApp Business
 * Cloud API for the canonical RespondLeadz pipeline.
 *
 * A generated reply is sent to the customer's phone number via the WhatsApp
 * Cloud API (Requirement 7.1). When the API returns an error the failure is
 * logged and the send is retried — at most 2 additional times, for at most 3
 * total attempts (Requirement 7.2). Sending stops immediately after the first
 * success. When every attempt fails, exactly one delivery-failure event is
 * recorded identifying the customer phone number and the message id, and a
 * {@link DeliveryError} is thrown (Requirement 7.3).
 *
 * Per-tenant WhatsApp credentials are read from the owning {@link Tenant} and
 * are never written to the log; the logger redacts them by name and scrubs
 * registered secret values (Requirement 13.3, 13.4).
 *
 * Feature: respond-leadz
 * Requirements: 7.1, 7.2, 7.3
 */

import { Config } from '../config'
import { logger } from '../logger'
import { DeliveryError } from './errors'
import type { Tenant } from './types'

/** Maximum total send attempts: 1 initial attempt + 2 retries (Requirement 7.2). */
export const MAX_SEND_ATTEMPTS = 3

/** A minimal `fetch` signature so tests can inject a stub transport. */
export type FetchLike = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
  }
) => Promise<{
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
}>

/** Optional dependencies for {@link send}, primarily for testability. */
export interface SendOptions {
  /** Transport used to issue the HTTP request; defaults to global `fetch`. */
  fetchImpl?: FetchLike
  /** Delay in milliseconds between retry attempts; defaults to 0. */
  retryDelayMs?: number
}

/** Resolve a value to use as the message id in logs and the delivery-failure event. */
function resolveMessageId(replyTo?: string): string {
  return typeof replyTo === 'string' && replyTo.length > 0 ? replyTo : 'unknown'
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Send a customer-facing reply to a phone number via the WhatsApp Cloud API.
 *
 * Makes at most {@link MAX_SEND_ATTEMPTS} attempts (1 initial + 2 retries),
 * returning as soon as one attempt succeeds (Requirements 7.1, 7.2). If all
 * attempts fail, records a single delivery-failure event containing the phone
 * number and message id, then throws a {@link DeliveryError} (Requirement 7.3).
 *
 * @param tenant  The owning tenant whose WhatsApp credentials are used.
 * @param to      The destination customer phone number.
 * @param body    The reply text to deliver.
 * @param replyTo Optional inbound message id this reply responds to; also used
 *                as the message id recorded in logs and on failure.
 * @param options Optional injected transport / retry timing (for tests).
 * @throws DeliveryError when every attempt fails.
 */
export async function send(
  tenant: Tenant,
  to: string,
  body: string,
  replyTo?: string,
  options: SendOptions = {}
): Promise<void> {
  const fetchImpl: FetchLike = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
  const retryDelayMs = options.retryDelayMs ?? 0
  const messageId = resolveMessageId(replyTo)

  const url = `${Config.whatsapp.apiUrl}/${tenant.whatsapp_phone_number_id}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to,
    text: { body },
    ...(replyTo ? { context: { message_id: replyTo } } : {}),
  }
  const requestBody = JSON.stringify(payload)

  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tenant.whatsapp_access_token}`,
          'Content-Type': 'application/json',
        },
        body: requestBody,
      })

      if (response.ok) {
        // First success stops all further attempts (Requirement 7.2).
        return
      }

      // The API returned an error: record it and fall through to retry
      // (Requirement 7.2). Response details are logged, never credentials.
      const errorData = await response.json().catch(() => ({}))
      lastError = new Error(
        `WhatsApp API error: ${response.status} ${response.statusText}`
      )
      logger.warn('Outbound send attempt failed', {
        type: 'whatsapp',
        tenant: tenant.id,
        phone: to,
        messageId,
        attempt,
        maxAttempts: MAX_SEND_ATTEMPTS,
        status: response.status,
        statusText: response.statusText,
        errorData,
      })
    } catch (error) {
      // Network/transport error: record it and fall through to retry.
      lastError = error
      logger.warn('Outbound send attempt failed', {
        type: 'whatsapp',
        tenant: tenant.id,
        phone: to,
        messageId,
        attempt,
        maxAttempts: MAX_SEND_ATTEMPTS,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    if (attempt < MAX_SEND_ATTEMPTS) {
      await delay(retryDelayMs)
    }
  }

  // All attempts failed: record exactly one delivery-failure event identifying
  // the phone number and message id (Requirement 7.3).
  logger.error('Delivery failure: all send attempts exhausted', {
    type: 'delivery_failure',
    tenant: tenant.id,
    phone: to,
    messageId,
    attempts: MAX_SEND_ATTEMPTS,
  })

  throw new DeliveryError(
    to,
    messageId,
    undefined,
    lastError !== undefined ? { cause: lastError } : undefined
  )
}
