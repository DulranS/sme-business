/**
 * Property-based tests for the structured Logger's credential redaction.
 *
 * Verifies that no credential value is ever written to the serialized log
 * output, exercised two ways:
 *   (a) A value registered via `logger.registerSecret(...)` and then logged
 *       inside a context object under a NON-credential key is scrubbed from
 *       the output (defense-in-depth secret scrubbing).
 *   (b) A value placed under a credential-named context key (token, apiKey,
 *       password, app_secret, ...) is redacted by key: the raw value is gone
 *       and the REDACTION_PLACEHOLDER appears in its place.
 *
 * Technique: spy on the console methods the Logger writes to so we can capture
 * the exact serialized string, then assert over it. Hermetic — no network, no
 * database.
 *
 * Feature: respond-leadz
 * Validates: Requirements 13.3
 */

import fc from 'fast-check'
import { logger, REDACTION_PLACEHOLDER } from '@/lib/logger'

/** Run a healthy number of generated cases per property. */
const RUNS = { numRuns: 150 }

/**
 * Generate distinctive, realistic credential-shaped strings (the alphabet used
 * by real tokens/keys: alphanumerics plus `-` and `_`). Constraining to these
 * characters keeps the value verbatim through JSON serialization (no escaping)
 * so the absence assertion is meaningful, while still ranging over arbitrary
 * secrets. `minLength: 8` keeps values distinctive enough to avoid coincidental
 * collisions with the log scaffolding (timestamp, level, message).
 */
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split('')
const secretArb = () =>
  fc
    .array(fc.constantFrom(...TOKEN_ALPHABET), { minLength: 8, maxLength: 64 })
    .map((chars) => chars.join(''))
    // A secret that is a substring of the placeholder would make the absence
    // assertion vacuously fail; exclude that degenerate case.
    .filter((s) => !REDACTION_PLACEHOLDER.includes(s) && s !== REDACTION_PLACEHOLDER)

/**
 * Capture everything the Logger writes to the console for the duration of `fn`.
 * Returns the concatenated serialized output across all severity methods.
 */
function captureLogOutput(fn: () => void): string {
  const methods = ['info', 'warn', 'error', 'debug'] as const
  const captured: string[] = []
  const spies = methods.map((m) =>
    jest.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    })
  )
  try {
    fn()
  } finally {
    spies.forEach((spy) => spy.mockRestore())
  }
  return captured.join('\n')
}

describe('Logger credential redaction', () => {
  // Feature: respond-leadz, Property 25: Logs never contain credential values
  describe('Property 25: Logs never contain credential values', () => {
    it('(a) a registered secret is scrubbed even under a non-credential key (Req 13.3)', () => {
      fc.assert(
        fc.property(secretArb(), (secret) => {
          // Register the credential value, then log it nested under a key that
          // does NOT look like a credential ("detail"). Only the registered-secret
          // scrubbing can keep it out of the output.
          logger.registerSecret(secret)
          const output = captureLogOutput(() => {
            logger.info('processing inbound', { detail: secret, tenant: 'acme' })
          })

          // The raw credential value must never appear in the serialized output.
          expect(output).not.toContain(secret)
          // The scrubbed placeholder takes its place.
          expect(output).toContain(REDACTION_PLACEHOLDER)
        }),
        RUNS
      )
    })

    it('(b) values under credential-named keys are redacted by name (Req 13.3)', () => {
      fc.assert(
        fc.property(
          secretArb(),
          secretArb(),
          secretArb(),
          secretArb(),
          (token, apiKey, password, appSecret) => {
            // These are NOT registered as secrets — redaction here is driven
            // purely by the credential-looking key names.
            const output = captureLogOutput(() => {
              logger.warn('config snapshot', {
                token,
                apiKey,
                password,
                app_secret: appSecret,
                tenant: 'acme', // non-credential key retained as-is
              })
            })

            // No raw credential value survives serialization...
            expect(output).not.toContain(token)
            expect(output).not.toContain(apiKey)
            expect(output).not.toContain(password)
            expect(output).not.toContain(appSecret)
            // ...and each is replaced with the redaction placeholder.
            expect(output).toContain(REDACTION_PLACEHOLDER)
            // The non-credential value is still present (only credentials are redacted).
            expect(output).toContain('acme')
          }
        ),
        RUNS
      )
    })

    it('(c) credentials are redacted even when nested deep in a context object (Req 13.3)', () => {
      fc.assert(
        fc.property(secretArb(), secretArb(), (registered, keyedValue) => {
          logger.registerSecret(registered)
          const output = captureLogOutput(() => {
            logger.error('nested failure', {
              request: {
                headers: { authorization: keyedValue }, // redacted by key
                meta: { trace: registered }, // scrubbed as a registered secret
              },
            })
          })

          expect(output).not.toContain(registered)
          expect(output).not.toContain(keyedValue)
          expect(output).toContain(REDACTION_PLACEHOLDER)
        }),
        RUNS
      )
    })
  })
})
