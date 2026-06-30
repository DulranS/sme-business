/**
 * Property-based tests for the SignatureVerifier.
 *
 * Exercises HMAC-SHA256 signing and constant-time verification end to end:
 * a freshly computed signature must verify, and any tampering with the body,
 * the signature, or the secret must be rejected. Also covers the explicit
 * rejection cases for missing/empty/malformed headers and empty app secrets.
 *
 * Hermetic: no network, no database — pure function exercise.
 *
 * Feature: respond-leadz
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6
 */

import fc from 'fast-check'
import { computeSignature, verify } from '@/lib/pipeline/signature'

/** Run a healthy number of generated cases per property. */
const RUNS = { numRuns: 200 }

/** Non-empty secret generator (empty secrets are tested separately). */
const nonEmptySecret = () => fc.string({ minLength: 1 })

describe('SignatureVerifier', () => {
  // Feature: respond-leadz, Property 2: Signature round-trip and tamper rejection
  describe('Property 2: Signature round-trip and tamper rejection', () => {
    it('computeSignature returns a sha256=<hex> value (Req 3.1)', () => {
      fc.assert(
        fc.property(fc.string(), nonEmptySecret(), (body, secret) => {
          const sig = computeSignature(body, secret)
          // sha256= prefix followed by exactly 64 lowercase hex chars.
          expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/)
        }),
        RUNS
      )
    })

    it('round-trip: a freshly computed signature verifies (Req 3.1, 3.3)', () => {
      fc.assert(
        fc.property(fc.string(), nonEmptySecret(), (body, secret) => {
          const sig = computeSignature(body, secret)
          expect(verify(body, sig, secret)).toBe(true)
        }),
        RUNS
      )
    })

    it('tamper rejection: mutating the body fails verification (Req 3.2)', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          nonEmptySecret(),
          (body, otherBody, secret) => {
            fc.pre(body !== otherBody)
            const sig = computeSignature(body, secret)
            expect(verify(otherBody, sig, secret)).toBe(false)
          }
        ),
        RUNS
      )
    })

    it('tamper rejection: mutating the signature fails verification (Req 3.2)', () => {
      fc.assert(
        fc.property(
          fc.string(),
          nonEmptySecret(),
          fc.string({ minLength: 1 }),
          (body, secret, otherBody) => {
            // Build a valid signature, then replace its digest with a different
            // but well-formed sha256=<hex> value derived from other input.
            const valid = computeSignature(body, secret)
            const tampered = computeSignature(body + otherBody, secret)
            fc.pre(valid !== tampered)
            expect(verify(body, tampered, secret)).toBe(false)
          }
        ),
        RUNS
      )
    })

    it('tamper rejection: mutating the secret fails verification (Req 3.2)', () => {
      fc.assert(
        fc.property(
          fc.string(),
          nonEmptySecret(),
          nonEmptySecret(),
          (body, secret, otherSecret) => {
            fc.pre(secret !== otherSecret)
            const sig = computeSignature(body, secret)
            expect(verify(body, sig, otherSecret)).toBe(false)
          }
        ),
        RUNS
      )
    })
  })

  describe('rejection cases (Req 3.5, 3.6)', () => {
    it('verify returns false for missing/empty/malformed headers (Req 3.5)', () => {
      fc.assert(
        fc.property(
          fc.string(),
          nonEmptySecret(),
          // Headers that are not a valid sha256=<hex> for the given body+secret:
          // null, undefined, empty string, and arbitrary strings without the
          // sha256= prefix.
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.string().filter((h) => !h.startsWith('sha256=')),
            fc.string().map((h) => 'sha256' + h) // missing '=' separator variants
          ),
          (body, secret, header) => {
            // Guard: ensure the generated header is not coincidentally the real
            // signature (only possible for the unprefixed/sha256-prefixed cases).
            const real = computeSignature(body, secret)
            fc.pre(header !== real)
            expect(verify(body, header as string | null | undefined, secret)).toBe(false)
          }
        ),
        RUNS
      )
    })

    it('verify returns false when the app secret is empty (Req 3.6)', () => {
      fc.assert(
        fc.property(fc.string(), nonEmptySecret(), (body, secret) => {
          // A valid signature must still be rejected when verified with an empty
          // secret, since an absent secret means the request cannot be trusted.
          const sig = computeSignature(body, secret)
          expect(verify(body, sig, '')).toBe(false)
        }),
        RUNS
      )
    })

    it('verify returns false for empty secret regardless of header (Req 3.6)', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.oneof(fc.constant(null), fc.constant(undefined), fc.string()),
          (body, header) => {
            expect(verify(body, header as string | null | undefined, '')).toBe(false)
          }
        ),
        RUNS
      )
    })
  })
})
