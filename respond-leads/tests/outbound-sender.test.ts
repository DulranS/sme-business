/**
 * Property-based tests for the Outbound_Sender retry policy.
 *
 * Exercises the WhatsApp send loop end to end with an injected fake transport
 * (`fetchImpl`) so attempts can be counted and success/failure controlled
 * precisely. `retryDelayMs` is pinned to 0 so the tests are fast.
 *
 * The properties verify the three retry-policy guarantees:
 *   - at most MAX_SEND_ATTEMPTS (3) attempts are ever made;
 *   - a success on attempt k resolves after exactly k attempts (no further
 *     attempts after the first success);
 *   - when every attempt fails the call rejects with a DeliveryError after
 *     exactly 3 attempts.
 *
 * Hermetic: no real network — the only side effect is reading WhatsApp env
 * values (set below) consumed by the Config accessor inside `send`.
 *
 * Feature: respond-leadz
 * Validates: Requirements 7.2, 7.3
 */

import fc from 'fast-check'
import { send, MAX_SEND_ATTEMPTS, type FetchLike } from '@/lib/pipeline/outbound-sender'
import { DeliveryError } from '@/lib/pipeline/errors'
import type { Tenant } from '@/lib/pipeline/types'

// The Config.whatsapp accessor used by `send` eagerly reads the four WhatsApp
// credentials from the environment. Provide harmless non-secret placeholders so
// the URL/headers can be assembled; no real request is ever issued.
beforeAll(() => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-number-id'
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token'
  process.env.WHATSAPP_APP_SECRET = 'test-app-secret'
  process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token'
})

/** Run a healthy number of generated cases per property (>= 100). */
const RUNS = { numRuns: 200 }

/** A successful FetchLike response shaped like the real transport return type. */
function okResponse() {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
  }
}

/** A failing FetchLike response (HTTP error) shaped like the real return type. */
function errorResponse(status: number) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({}),
  }
}

/**
 * Build a fake transport that counts attempts. It succeeds on attempt
 * `successOn` (1-based); attempts before that fail using `failMode`. When
 * `successOn` is null it never succeeds (all attempts fail).
 */
function makeFetch(
  successOn: number | null,
  failMode: 'http' | 'reject',
  failStatus: number
): { fetchImpl: FetchLike; attempts: () => number } {
  let count = 0
  const fetchImpl: FetchLike = async () => {
    count += 1
    if (successOn !== null && count >= successOn) {
      return okResponse()
    }
    if (failMode === 'reject') {
      throw new Error('network down')
    }
    return errorResponse(failStatus)
  }
  return { fetchImpl, attempts: () => count }
}

/** Generator for a minimal Tenant carrying the credentials `send` reads. */
const tenantArb = (): fc.Arbitrary<Tenant> =>
  fc.record({
    id: fc.string({ minLength: 1 }),
    phoneNumberId: fc.string({ minLength: 1 }),
    accessToken: fc.string({ minLength: 1 }),
  }).map(({ id, phoneNumberId, accessToken }) => ({
    id,
    name: 'Test Tenant',
    whatsapp_phone_number_id: phoneNumberId,
    whatsapp_access_token: accessToken,
    whatsapp_app_secret: 'secret',
    whatsapp_verify_token: 'verify',
    llm_provider: 'claude',
    llm_api_key: 'key',
    default_currency: 'USD',
  }))

/** Phone numbers and message bodies. */
const phoneArb = () => fc.string({ minLength: 1 })
const bodyArb = () => fc.string()
const replyToArb = () => fc.option(fc.string({ minLength: 1 }), { nil: undefined })
/** Failure mode: HTTP error response, or a rejected promise (transport error). */
const failModeArb = () => fc.constantFrom<'http' | 'reject'>('http', 'reject')
/** A plausible HTTP error status for the failing-response mode. */
const failStatusArb = () => fc.integer({ min: 400, max: 599 })

describe('Outbound_Sender', () => {
  // Feature: respond-leadz, Property 13: Outbound send retry policy
  describe('Property 13: Outbound send retry policy', () => {
    it('succeeds on attempt k: resolves after exactly k attempts, none after (Req 7.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantArb(),
          phoneArb(),
          bodyArb(),
          replyToArb(),
          fc.integer({ min: 1, max: MAX_SEND_ATTEMPTS }),
          failModeArb(),
          failStatusArb(),
          async (tenant, to, body, replyTo, successOn, failMode, failStatus) => {
            const { fetchImpl, attempts } = makeFetch(successOn, failMode, failStatus)

            await expect(
              send(tenant, to, body, replyTo, { fetchImpl, retryDelayMs: 0 })
            ).resolves.toBeUndefined()

            // Stopped after the first success: exactly `successOn` attempts.
            expect(attempts()).toBe(successOn)
            // And never exceeds the cap.
            expect(attempts()).toBeLessThanOrEqual(MAX_SEND_ATTEMPTS)
          }
        ),
        RUNS
      )
    })

    it('all attempts fail: rejects with DeliveryError after exactly 3 attempts (Req 7.3)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantArb(),
          phoneArb(),
          bodyArb(),
          replyToArb(),
          failModeArb(),
          failStatusArb(),
          async (tenant, to, body, replyTo, failMode, failStatus) => {
            const { fetchImpl, attempts } = makeFetch(null, failMode, failStatus)

            await expect(
              send(tenant, to, body, replyTo, { fetchImpl, retryDelayMs: 0 })
            ).rejects.toBeInstanceOf(DeliveryError)

            // Exhausted the full attempt budget, no more.
            expect(attempts()).toBe(MAX_SEND_ATTEMPTS)
          }
        ),
        RUNS
      )
    })

    it('attempt count never exceeds MAX_SEND_ATTEMPTS across mixed outcomes (Req 7.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantArb(),
          phoneArb(),
          bodyArb(),
          replyToArb(),
          // null => never succeeds; otherwise succeeds on that attempt.
          fc.option(fc.integer({ min: 1, max: MAX_SEND_ATTEMPTS }), { nil: null }),
          failModeArb(),
          failStatusArb(),
          async (tenant, to, body, replyTo, successOn, failMode, failStatus) => {
            const { fetchImpl, attempts } = makeFetch(successOn, failMode, failStatus)

            try {
              await send(tenant, to, body, replyTo, { fetchImpl, retryDelayMs: 0 })
            } catch (err) {
              // Only a DeliveryError is an acceptable failure outcome.
              expect(err).toBeInstanceOf(DeliveryError)
            }

            expect(attempts()).toBeGreaterThanOrEqual(1)
            expect(attempts()).toBeLessThanOrEqual(MAX_SEND_ATTEMPTS)
          }
        ),
        RUNS
      )
    })
  })
})
