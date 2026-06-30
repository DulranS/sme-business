/**
 * Property-based tests for the Inbound_Handler webhook verification challenge.
 *
 * Exercises `verifyChallenge` end to end across the full input space: the
 * single success path (correct mode, matching token, non-empty challenge) and
 * every failure path (wrong mode, mismatched token, missing token, missing
 * challenge, missing configured token). On success the challenge must be echoed
 * unmodified with HTTP 200; on any failure the response must be HTTP 403 with an
 * empty body so the challenge is never echoed.
 *
 * Hermetic: the configured token is always passed explicitly, so the tests do
 * not depend on process.env.WHATSAPP_VERIFY_TOKEN.
 *
 * Feature: respond-leadz
 * Validates: Requirements 1.2, 1.3, 1.4
 */

import fc from 'fast-check'
import { verifyChallenge, VERIFY_MODE_SUBSCRIBE } from '@/lib/pipeline/inbound-handler'

/** Property tests generate >= 100 cases each. */
const RUNS = { numRuns: 200 }

/** A non-empty string generator for tokens and challenges. */
const nonEmpty = () => fc.string({ minLength: 1 })

/** Optional value generator: null, undefined, or empty string (all "missing"). */
const missing = () => fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(''))

describe('Inbound_Handler.verifyChallenge', () => {
  // Feature: respond-leadz, Property 1: Webhook verification challenge
  describe('Property 1: Webhook verification challenge', () => {
    it('success: subscribe + matching token + non-empty challenge echoes the challenge unmodified (Req 1.2)', () => {
      fc.assert(
        fc.property(nonEmpty(), nonEmpty(), (configuredToken, challenge) => {
          // token is byte-for-byte equal to configuredToken (same value).
          const result = verifyChallenge(
            VERIFY_MODE_SUBSCRIBE,
            configuredToken,
            challenge,
            configuredToken
          )
          expect(result).toEqual({ status: 200, body: challenge })
          // The challenge is echoed UNMODIFIED.
          expect(result.body).toBe(challenge)
        }),
        RUNS
      )
    })

    it('failure: mode other than "subscribe" is denied with 403 and no echo (Req 1.2)', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.string(), missing()),
          nonEmpty(),
          nonEmpty(),
          (mode, configuredToken, challenge) => {
            fc.pre(mode !== VERIFY_MODE_SUBSCRIBE)
            const result = verifyChallenge(mode, configuredToken, challenge, configuredToken)
            expect(result).toEqual({ status: 403, body: '' })
          }
        ),
        RUNS
      )
    })

    it('failure: token mismatch is denied with 403 and no echo (Req 1.3)', () => {
      fc.assert(
        fc.property(
          nonEmpty(),
          nonEmpty(),
          nonEmpty(),
          (configuredToken, token, challenge) => {
            // Ensure the submitted token is not byte-for-byte equal.
            fc.pre(token !== configuredToken)
            const result = verifyChallenge(
              VERIFY_MODE_SUBSCRIBE,
              token,
              challenge,
              configuredToken
            )
            expect(result).toEqual({ status: 403, body: '' })
          }
        ),
        RUNS
      )
    })

    it('failure: missing/empty token is denied with 403 and no echo (Req 1.4)', () => {
      fc.assert(
        fc.property(missing(), nonEmpty(), nonEmpty(), (token, configuredToken, challenge) => {
          const result = verifyChallenge(
            VERIFY_MODE_SUBSCRIBE,
            token,
            challenge,
            configuredToken
          )
          expect(result).toEqual({ status: 403, body: '' })
        }),
        RUNS
      )
    })

    it('failure: missing/empty challenge is denied with 403 and no echo (Req 1.4)', () => {
      fc.assert(
        fc.property(missing(), nonEmpty(), (challenge, configuredToken) => {
          // token matches configuredToken so only the missing challenge causes denial.
          const result = verifyChallenge(
            VERIFY_MODE_SUBSCRIBE,
            configuredToken,
            challenge,
            configuredToken
          )
          expect(result).toEqual({ status: 403, body: '' })
        }),
        RUNS
      )
    })

    it('failure: missing/empty configured token is denied with 403 and no echo (Req 1.4)', () => {
      fc.assert(
        fc.property(missing(), nonEmpty(), nonEmpty(), (configuredToken, token, challenge) => {
          const result = verifyChallenge(VERIFY_MODE_SUBSCRIBE, token, challenge, configuredToken)
          expect(result).toEqual({ status: 403, body: '' })
        }),
        RUNS
      )
    })
  })
})
