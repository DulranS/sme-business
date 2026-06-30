/**
 * Inbound_Handler — the single canonical entry point for WhatsApp webhook
 * traffic in the RespondLeadz pipeline.
 *
 * This module hosts the framework-agnostic handler logic that the Next.js route
 * (`app/api/webhook/whatsapp/route.ts`) delegates to:
 *
 *  - `GET`  → Meta webhook verification challenge (implemented here as
 *    {@link verifyChallenge}).
 *  - `POST` → signature verification, payload parsing, tenant resolution, rate
 *    limiting, and per-message dispatch (added by task 17.2).
 *
 * Keeping the pipeline logic here — separate from the framework route — keeps it
 * pure and directly testable.
 *
 * Feature: respond-leadz
 * Requirements: 1.2, 1.3, 1.4, 2.1, 3.2, 15.1, 15.2, 17.3
 */

import { timingSafeEqual } from 'crypto'
import { Config, ConfigValidator } from '../config'
import { logger, LogLevel } from '../logger'
import { ConfigError } from './errors'
import { verify as verifySignature } from './signature'
import { parse } from './parser'
import type { ParsedMessage } from './types'
import type { Tenant } from './types'
import { resolveTenant, getTenantCredentials, withTenantContext } from './tenant'
import { registerArrival, enqueueInbound } from './rate-limiter'
import {
  fetchHistory,
  isDuplicate,
  appendAndTrim,
  commitTurn,
} from './conversation-engine'
import { search as searchInventory } from './inventory'
import { AiResponder } from './ai-responder'
import { send as sendOutbound } from './outbound-sender'
import { detectAndRecord } from './close-detector'

/**
 * The `hub.mode` value Meta sends for a webhook subscription verification
 * request. The challenge only succeeds for this mode (Requirement 1.2).
 */
export const VERIFY_MODE_SUBSCRIBE = 'subscribe'

/**
 * The result of handling a webhook GET request. `status` is the HTTP status the
 * route should respond with and `body` is the exact response body.
 *
 * On success the body is the unmodified challenge value (Requirement 1.2). On
 * any failure the body is an empty string so the challenge is never echoed
 * (Requirements 1.3, 1.4).
 */
export interface VerificationResult {
  status: 200 | 403
  body: string
}

/**
 * Compare two strings in time independent of the position of the first
 * differing byte, returning true only on a byte-for-byte match.
 *
 * `timingSafeEqual` requires equal-length buffers and throws otherwise, so a
 * length mismatch (which already means the tokens differ) short-circuits to
 * false. UTF-8 encoding makes the comparison byte-for-byte over the full token.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8')
  const bBuf = Buffer.from(b, 'utf8')
  if (aBuf.length !== bBuf.length) {
    return false
  }
  return timingSafeEqual(aBuf, bBuf)
}

/**
 * Handle a Meta webhook verification challenge.
 *
 * Meta verifies a webhook subscription by issuing a GET request carrying
 * `hub.mode`, `hub.verify_token`, and `hub.challenge`. The challenge succeeds
 * **only** when all of the following hold (Requirement 1.2):
 *  - `mode` is exactly `subscribe`,
 *  - `token` is byte-for-byte equal to the configured `WHATSAPP_VERIFY_TOKEN`, and
 *  - a non-empty `challenge` value is present.
 *
 * On success it responds with HTTP 200 and a body equal to the unmodified
 * challenge value. In every other case — wrong/mismatched token (Requirement
 * 1.3), or a missing token or missing challenge (Requirement 1.4), or a missing
 * configured token — it responds with HTTP 403 and never echoes the challenge.
 *
 * The token comparison runs in time independent of the position of the first
 * differing byte.
 *
 * @param mode      The submitted `hub.mode` value.
 * @param token     The submitted `hub.verify_token` value.
 * @param challenge The submitted `hub.challenge` value.
 * @param configuredToken The expected verify token; defaults to the configured
 *   `WHATSAPP_VERIFY_TOKEN`. Exposed for testability.
 * @returns The HTTP status and response body to send back to Meta.
 */
export function verifyChallenge(
  mode: string | null | undefined,
  token: string | null | undefined,
  challenge: string | null | undefined,
  configuredToken: string | null | undefined = process.env.WHATSAPP_VERIFY_TOKEN
): VerificationResult {
  // 403 with no challenge echo for every failure path (Requirements 1.3, 1.4).
  const denied: VerificationResult = { status: 403, body: '' }

  // The mode must be exactly "subscribe" (Requirement 1.2).
  if (mode !== VERIFY_MODE_SUBSCRIBE) {
    return denied
  }

  // A verify token and a challenge value must both be present; an absent or
  // empty value is a failed verification (Requirement 1.4).
  if (typeof token !== 'string' || token.length === 0) {
    return denied
  }
  if (typeof challenge !== 'string' || challenge.length === 0) {
    return denied
  }

  // Without a configured token there is nothing to match against; deny rather
  // than echo the challenge.
  if (typeof configuredToken !== 'string' || configuredToken.length === 0) {
    return denied
  }

  // Byte-for-byte, constant-time token comparison (Requirements 1.2, 1.3).
  if (!constantTimeEquals(token, configuredToken)) {
    return denied
  }

  // Success: echo the unmodified challenge with HTTP 200 (Requirement 1.2).
  return { status: 200, body: challenge }
}

// ---------------------------------------------------------------------------
// POST handling — signature verification, parsing, tenant resolution, rate
// limiting, and per-message dispatch.
//
// Requirements: 2.1, 3.2, 15.1, 15.2, 17.3
// ---------------------------------------------------------------------------

/**
 * The result of handling a webhook POST request. `status` is the HTTP status the
 * route should respond with and `body` is a JSON-serializable acknowledgement
 * payload.
 *
 * The webhook always acknowledges with HTTP 200 — including on parse and
 * per-message processing errors (Requirements 2.1, 2.6, 17.3) — except where
 * the requirements mandate otherwise: a missing/invalid signature is rejected
 * with HTTP 401 (Requirements 3.2, 3.5, 3.6) and a not-yet-ready configuration
 * refuses the request (Requirement 19.2).
 */
export interface WebhookResult {
  status: number
  body: Record<string, unknown>
}

/**
 * Read the configured WhatsApp app secret without throwing when it is absent.
 *
 * `Config.whatsapp.appSecret` throws when the value is missing; an absent or
 * empty secret is a valid (rejected) state for signature verification per
 * Requirement 3.6, so this normalizes the absence to an empty string instead of
 * propagating the error.
 */
function readAppSecret(): string {
  try {
    return Config.whatsapp.appSecret
  } catch {
    return ''
  }
}

/**
 * Ensure the startup configuration validation has run at least once so the
 * webhook-acceptance gate reflects the current environment. The validator
 * begins in a `starting` state; running it lazily on first webhook lets a
 * correctly configured deployment advance to `ready` without a separate
 * bootstrap step.
 */
function ensureStartupValidated(): void {
  if (ConfigValidator.getLastResult() === null) {
    ConfigValidator.validateStartup()
  }
}

/**
 * Extract the receiving WhatsApp `phone_number_id` from a webhook payload. The
 * id lives at `entry[].changes[].value.metadata.phone_number_id`; the first one
 * found is used to resolve the owning tenant (Requirement 12.5). Returns `null`
 * when the payload carries none.
 */
function extractPhoneNumberId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const entries = (payload as { entry?: unknown }).entry
  if (!Array.isArray(entries)) return null

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue
    const changes = (entry as { changes?: unknown }).changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      if (typeof change !== 'object' || change === null) continue
      const value = (change as { value?: unknown }).value
      if (typeof value !== 'object' || value === null) continue
      const metadata = (value as { metadata?: unknown }).metadata
      if (typeof metadata !== 'object' || metadata === null) continue
      const id = (metadata as { phone_number_id?: unknown }).phone_number_id
      if (typeof id === 'string' && id.trim() !== '') {
        return id
      }
    }
  }
  return null
}

/**
 * Read a Conversation's persisted id within the owning tenant's context. The
 * Close_Detector needs the id to record a close event; the conversation-engine
 * primitives do not surface it, so this small tenant-scoped read fetches it
 * after the turn has been committed. Returns `null` when no row exists.
 */
async function getConversationId(tenantId: string, phone: string): Promise<string | null> {
  try {
    return await withTenantContext(tenantId, async (ctx) => {
      const result = await ctx.query<{ id: string | number }>(
        `SELECT id FROM conversations WHERE phone_number = $1 LIMIT 1`,
        [phone]
      )
      if (result.rowCount === 0) return null
      return String(result.rows[0].id)
    })
  } catch (error) {
    logger.error(
      'Failed to read conversation id for close detection',
      { type: 'conversation', tenantId, phone },
      error as Error
    )
    return null
  }
}

/**
 * Process a single inbound text message end-to-end for one tenant:
 * rate-limit → dedup → keyword extraction → inventory search → response
 * generation → outbound send → history commit → close detection.
 *
 * This function never throws: every failure is caught and logged as a
 * per-message outcome so that a delay or failure processing one message does
 * not prevent its siblings in the same payload from being processed
 * (Requirements 15.2, 17.3). The reply is sent before the turn is committed, so
 * a delivery failure leaves `last_message_id` un-advanced and the message
 * eligible for redelivery.
 *
 * @param tenant    The owning tenant (with credentials) for outbound delivery.
 * @param message   The parsed inbound message to process.
 * @param responder The shared AI_Responder used for extraction and generation.
 */
async function processMessage(
  tenant: Tenant,
  message: ParsedMessage,
  responder: AiResponder
): Promise<void> {
  const logFields = {
    tenant: tenant.id,
    phone: message.from,
    messageId: message.messageId,
  }

  try {
    // Burst guard: defer the excess beyond the per-phone window to the durable
    // queue rather than processing it inline; it is never dropped (Req 15.3).
    const decision = registerArrival(tenant.id, message.from)
    if (decision.defer) {
      await enqueueInbound(tenant.id, {
        phoneNumber: message.from,
        messageId: message.messageId,
        payload: message,
      })
      logger.message({ ...logFields, outcome: 'deferred' })
      return
    }

    // Load conversation memory (oldest→newest) and the last processed id.
    const { history, lastMessageId } = await fetchHistory(tenant.id, message.from)

    // Cheap sequential dedup gate before any LLM request (Req 4.2): discard a
    // message whose Idempotency_Key matches the last one processed.
    if (isDuplicate(message.messageId, lastMessageId)) {
      logger.message({ ...logFields, outcome: 'duplicate' })
      return
    }

    // Extract search intent (≤ 50 tokens). On LLM failure, short-circuit to the
    // Fallback_Response and skip inventory search (Requirements 8.1, 8.3).
    const extraction = await responder.extractKeyword(message.text)

    let replyText: string
    let usedFallback: boolean
    if (extraction.failure) {
      replyText = responder.getFallbackResponse()
      usedFallback = true
      logger.error(
        'LLM keyword extraction failed; sending fallback response',
        { type: 'ai', ...logFields, stage: extraction.failure.stage },
        extraction.failure
      )
    } else {
      const items = await searchInventory(tenant.id, extraction.keyword)
      const generated = await responder.generateResponse(
        message.contactName,
        message.text,
        items,
        history,
        extraction.keyword
      )
      replyText = generated.text
      usedFallback = generated.usedFallback
      if (generated.failure) {
        logger.error(
          'LLM response generation failed; sending fallback response',
          { type: 'ai', ...logFields, stage: generated.failure.stage },
          generated.failure
        )
      }
    }

    // Deliver the reply (with retries). A delivery failure throws and is caught
    // below; the turn is not committed so the message stays redeliverable.
    await sendOutbound(tenant, message.from, replyText, message.messageId)

    // Append the turn, trim to the history limit, and advance last_message_id
    // only now that the reply has been sent (Requirements 5.3, 5.4, 5.7).
    const newHistory = appendAndTrim(history, message.text, replyText)
    const { committed } = await commitTurn({
      tenantId: tenant.id,
      phoneNumber: message.from,
      customerName: message.contactName,
      history: newHistory,
      lastMessageId: message.messageId,
    })

    // Evaluate the conversation for a closed deal and record it once. Only the
    // delivery that actually committed the turn runs close detection; a
    // concurrent duplicate that lost the guarded write does not (Req 4.5, 9.4).
    if (committed) {
      const conversationId = await getConversationId(tenant.id, message.from)
      if (conversationId !== null) {
        await detectAndRecord(
          { id: tenant.id, default_currency: tenant.default_currency },
          { id: conversationId, phone_number: message.from, history: newHistory }
        )
      }
    }

    logger.message({
      ...logFields,
      outcome: usedFallback ? 'fallback' : 'replied',
    })
  } catch (error) {
    // Per-conversation isolation: log and swallow so sibling messages in the
    // same payload still complete (Requirements 15.2, 17.3).
    logger.message({ ...logFields, outcome: 'error' }, LogLevel.ERROR)
    logger.error(
      'Inbound message processing failed',
      { type: 'inbound_message', ...logFields },
      error as Error
    )
  }
}

/**
 * Handle a WhatsApp webhook POST request.
 *
 * Verifies the request signature against the raw, unmodified body
 * (Requirements 3.1–3.6), parses the payload, resolves the owning tenant from
 * the receiving `phone_number_id` (Requirement 12.5), and dispatches each text
 * message independently through the pipeline. The handler always acknowledges
 * with HTTP 200 — including on parse and processing errors (Requirements 2.1,
 * 2.6, 17.3) — except that an invalid/missing signature is rejected with 401
 * (Requirements 3.2, 3.5, 3.6) and an unready configuration refuses the request
 * (Requirement 19.2).
 *
 * @param rawBody         The raw, unmodified request body string.
 * @param signatureHeader The value of the `X-Hub-Signature-256` header.
 * @returns The HTTP status and acknowledgement body for the route to return.
 */
export async function handlePost(
  rawBody: string,
  signatureHeader: string | null | undefined
): Promise<WebhookResult> {
  // Refuse inbound webhooks until required configuration is present (Req 19.2).
  ensureStartupValidated()
  try {
    ConfigValidator.assertAcceptingWebhooks()
  } catch (error) {
    // The named configuration error is already logged by validateStartup; never
    // echo any secret value here (Requirement 13.3).
    const missing = error instanceof ConfigError ? error.missingKeys : undefined
    logger.warn('Refusing inbound webhook; configuration is not ready', {
      type: 'config',
      ...(missing ? { missingKeys: missing } : {}),
    })
    return { status: 503, body: { status: 'service_unavailable' } }
  }

  // Authenticate the request: compute and compare the HMAC-SHA256 signature of
  // the raw body using the configured app secret (Requirements 3.1–3.6).
  const appSecret = readAppSecret()
  if (!verifySignature(rawBody, signatureHeader, appSecret)) {
    if (appSecret === '') {
      // Absent/empty app secret: record a named configuration error (Req 3.6).
      logger.error(
        'Webhook rejected: WHATSAPP_APP_SECRET is absent or empty',
        { type: 'config', missingKeys: ['WHATSAPP_APP_SECRET'] }
      )
    } else {
      // Missing, malformed, or mismatched signature (Requirements 3.2, 3.5).
      logger.warn('Webhook rejected: signature verification failed', { type: 'webhook' })
    }
    return { status: 401, body: { error: 'invalid_signature' } }
  }

  // Everything past authentication is acknowledged with HTTP 200, even on
  // failure (Requirements 2.1, 17.3).
  try {
    // Parse the JSON body, then extract processable messages. A structurally
    // unparseable payload is logged and acknowledged with 200 (Req 2.6).
    let messages: ParsedMessage[]
    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
      messages = parse(payload)
    } catch (error) {
      logger.error(
        'Webhook payload could not be parsed; acknowledging without processing',
        { type: 'webhook' },
        error as Error
      )
      return { status: 200, body: { status: 'parse_error' } }
    }

    // Zero-message / status-only payloads are acknowledged without processing
    // (Requirement 2.5).
    if (messages.length === 0) {
      return { status: 200, body: { status: 'no_messages' } }
    }

    // Resolve the owning tenant from the receiving phone_number_id (Req 12.5).
    const phoneNumberId = extractPhoneNumberId(payload)
    const identity = await resolveTenant(phoneNumberId)
    if (!identity) {
      // Unknown phone_number_id: do not process against any tenant (Req 12.5).
      logger.warn('Webhook acknowledged; no tenant resolved for phone_number_id', {
        type: 'tenant',
        phoneNumberId: phoneNumberId ?? null,
      })
      return { status: 200, body: { status: 'no_tenant' } }
    }

    // Read the owning tenant's credentials within its own context; required for
    // outbound delivery (Requirement 13.4).
    const tenant = await getTenantCredentials(identity.id)

    // Process each message independently. A failure in one is contained so the
    // others still complete (Requirement 15.2); awaiting all keeps the work
    // within the acknowledgement window (Requirement 2.1).
    const responder = new AiResponder()
    await Promise.all(messages.map((message) => processMessage(tenant, message, responder)))

    return { status: 200, body: { status: 'processed', count: messages.length } }
  } catch (error) {
    // Any unhandled error still acknowledges with 200 and is recorded (Req 17.3).
    logger.error(
      'Unhandled error while processing webhook; acknowledging with 200',
      { type: 'webhook' },
      error as Error
    )
    return { status: 200, body: { status: 'error' } }
  }
}
