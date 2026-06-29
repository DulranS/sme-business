/**
 * SignatureVerifier — webhook request authentication for the canonical
 * RespondLeadz pipeline.
 *
 * Meta signs each webhook POST with an HMAC-SHA256 of the raw, unmodified
 * request body keyed by the app secret, delivered in the
 * `X-Hub-Signature-256` header as `sha256=<hex>`. This module computes that
 * signature and verifies an incoming header against it using a comparison whose
 * runtime is independent of the position of the first differing byte.
 *
 * Feature: respond-leadz
 * Requirements: 3.1, 3.3, 3.4, 3.5, 3.6
 */

import { createHmac, timingSafeEqual } from 'crypto'

/** Prefix Meta uses for the HMAC-SHA256 signature value. */
const SIGNATURE_PREFIX = 'sha256='

/**
 * Compute the WhatsApp webhook signature for a raw request body.
 *
 * Returns the signature in Meta's wire format: `sha256=<lowercase-hex>`
 * (Requirement 3.1). The body is hashed exactly as received — callers must pass
 * the raw, unmodified body string, not a re-serialized payload.
 *
 * @param rawBody   The raw, unmodified request body.
 * @param appSecret The configured WHATSAPP_APP_SECRET.
 * @returns The signature string `sha256=<hex>`.
 */
export function computeSignature(rawBody: string, appSecret: string): string {
  const digest = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  return SIGNATURE_PREFIX + digest
}

/**
 * Verify an incoming webhook signature header against the body.
 *
 * Returns `true` only when the header is a well-formed `sha256=<hex>` value that
 * matches the HMAC-SHA256 of `rawBody` keyed by `appSecret` (Requirement 3.3).
 * The comparison runs in time independent of the position of the first
 * differing byte (Requirement 3.4).
 *
 * Returns `false` when:
 * - the header is missing, empty, or malformed (Requirement 3.5), or
 * - the configured app secret is absent or empty (Requirement 3.6), or
 * - the computed signature does not match the header (Requirement 3.2).
 *
 * @param rawBody   The raw, unmodified request body.
 * @param header    The value of the `X-Hub-Signature-256` request header.
 * @param appSecret The configured WHATSAPP_APP_SECRET.
 * @returns `true` if the signature is valid, otherwise `false`.
 */
export function verify(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string
): boolean {
  // Reject when the app secret is absent or empty (Requirement 3.6). The caller
  // (Inbound_Handler) is responsible for logging the named configuration error.
  if (!appSecret) {
    return false
  }

  // Reject missing, empty, or malformed headers (Requirement 3.5).
  if (typeof header !== 'string' || header.length === 0) {
    return false
  }
  if (!header.startsWith(SIGNATURE_PREFIX)) {
    return false
  }

  const expected = computeSignature(rawBody, appSecret)

  // Constant-time comparison whose runtime is independent of the position of
  // the first differing byte (Requirement 3.4). timingSafeEqual requires equal
  // length buffers and throws otherwise, so guard on length first. A length
  // mismatch already means the hex digest cannot match.
  const headerBuf = Buffer.from(header, 'utf8')
  const expectedBuf = Buffer.from(expected, 'utf8')
  if (headerBuf.length !== expectedBuf.length) {
    return false
  }

  return timingSafeEqual(headerBuf, expectedBuf)
}
