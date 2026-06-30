/**
 * Unit tests for ConfigValidator startup validation.
 *
 * Covers the startup gate that refuses inbound webhooks until every required
 * environment value is present and non-empty:
 *   - A complete environment validates, transitions to `ready`, and accepts
 *     webhooks.
 *   - Any missing, empty, or whitespace-only required value (individually or in
 *     subsets) fails validation, names exactly the offending keys, keeps the app
 *     in `starting`, refuses webhooks, and causes assertAcceptingWebhooks() to
 *     throw a ConfigError that references key NAMES only (never their values).
 *
 * Each test passes an explicit env object to validateStartup() rather than
 * mutating process.env, and resets validator state in beforeEach so every case
 * starts clean. Hermetic — no network, no database.
 *
 * Feature: respond-leadz
 * Requirements: 1.7, 19.2
 */

import fc from 'fast-check'
import { ConfigValidator, REQUIRED_ENV_KEYS } from '@/lib/config'
import { ConfigError } from '@/lib/pipeline/errors'

type EnvSource = Record<string, string | undefined>

/** A complete, valid environment with distinctive non-empty values per key. */
function completeEnv(): EnvSource {
  const env: EnvSource = {}
  for (const key of REQUIRED_ENV_KEYS) {
    env[key] = `value-for-${key}`
  }
  return env
}

/** All distinctive values used in a complete env (to assert they never leak). */
function allEnvValues(env: EnvSource): string[] {
  return REQUIRED_ENV_KEYS.map((k) => env[k]).filter((v): v is string => typeof v === 'string')
}

describe('ConfigValidator', () => {
  // Silence the validator's own logging so the test output stays readable.
  let errorSpy: jest.SpyInstance
  let infoSpy: jest.SpyInstance

  beforeEach(() => {
    ConfigValidator.reset()
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    infoSpy.mockRestore()
  })

  describe('complete configuration (Req 19.2)', () => {
    it('validates, becomes ready, and accepts webhooks', () => {
      const env = completeEnv()
      const result = ConfigValidator.validateStartup(env)

      expect(result.ok).toBe(true)
      expect(result.missingKeys).toEqual([])
      expect(result.error).toBeNull()
      expect(ConfigValidator.getState()).toBe('ready')
      expect(ConfigValidator.isAcceptingWebhooks()).toBe(true)
      expect(() => ConfigValidator.assertAcceptingWebhooks()).not.toThrow()
    })
  })

  describe('a single missing required value (Req 1.7, 19.2)', () => {
    it.each(REQUIRED_ENV_KEYS.map((k) => [k]))('refuses webhooks when %s is absent', (missing) => {
      const env = completeEnv()
      delete env[missing]

      const result = ConfigValidator.validateStartup(env)

      expect(result.ok).toBe(false)
      expect(result.missingKeys).toEqual([missing])
      expect(result.error).toBeInstanceOf(ConfigError)
      expect(ConfigValidator.getState()).toBe('starting')
      expect(ConfigValidator.isAcceptingWebhooks()).toBe(false)
    })

    it.each(REQUIRED_ENV_KEYS.map((k) => [k]))('treats empty %s as missing', (missing) => {
      const env = completeEnv()
      env[missing] = ''

      const result = ConfigValidator.validateStartup(env)

      expect(result.ok).toBe(false)
      expect(result.missingKeys).toEqual([missing])
      expect(ConfigValidator.isAcceptingWebhooks()).toBe(false)
    })

    it.each(REQUIRED_ENV_KEYS.map((k) => [k]))('treats whitespace-only %s as missing', (missing) => {
      const env = completeEnv()
      env[missing] = '   \t\n '

      const result = ConfigValidator.validateStartup(env)

      expect(result.ok).toBe(false)
      expect(result.missingKeys).toEqual([missing])
      expect(ConfigValidator.isAcceptingWebhooks()).toBe(false)
    })
  })

  describe('arbitrary subsets of missing values (Req 1.7, 19.2)', () => {
    it('names exactly the missing keys and refuses webhooks', () => {
      fc.assert(
        fc.property(
          // Pick a non-empty subset of required keys to remove.
          fc.subarray([...REQUIRED_ENV_KEYS], { minLength: 1 }),
          // Independently decide how each chosen key is "missing".
          fc.array(fc.constantFrom<'absent' | 'empty' | 'whitespace'>('absent', 'empty', 'whitespace'), {
            minLength: REQUIRED_ENV_KEYS.length,
            maxLength: REQUIRED_ENV_KEYS.length,
          }),
          (missingKeys, modes) => {
            ConfigValidator.reset()
            const env = completeEnv()

            missingKeys.forEach((key, i) => {
              const mode = modes[i % modes.length]
              if (mode === 'absent') delete env[key]
              else if (mode === 'empty') env[key] = ''
              else env[key] = '   '
            })

            const result = ConfigValidator.validateStartup(env)

            expect(result.ok).toBe(false)
            // Exactly the keys we broke, in the canonical REQUIRED_ENV_KEYS order.
            const expected = REQUIRED_ENV_KEYS.filter((k) => missingKeys.includes(k))
            expect([...result.missingKeys].sort()).toEqual([...expected].sort())
            expect(ConfigValidator.getState()).toBe('starting')
            expect(ConfigValidator.isAcceptingWebhooks()).toBe(false)
          }
        ),
        { numRuns: 150 }
      )
    })
  })

  describe('assertAcceptingWebhooks throws a named ConfigError (Req 1.7, 19.2)', () => {
    it('throws ConfigError referencing key names, never values', () => {
      const env = completeEnv()
      const values = allEnvValues(env)
      // Break two keys.
      delete env['WHATSAPP_ACCESS_TOKEN']
      env['WHATSAPP_APP_SECRET'] = ''

      ConfigValidator.validateStartup(env)

      expect(() => ConfigValidator.assertAcceptingWebhooks()).toThrow(ConfigError)

      let thrown: ConfigError | undefined
      try {
        ConfigValidator.assertAcceptingWebhooks()
      } catch (e) {
        thrown = e as ConfigError
      }

      expect(thrown).toBeInstanceOf(ConfigError)
      expect([...(thrown!.missingKeys as string[])].sort()).toEqual(
        ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET'].sort()
      )
      // The error references names only — no configured value ever appears.
      for (const value of values) {
        expect(thrown!.missingKeys.join(',')).not.toContain(value)
        expect(thrown!.message).not.toContain(value)
      }
    })

    it('throws before any successful validation has run', () => {
      // Fresh state (reset in beforeEach): nothing validated yet.
      expect(ConfigValidator.isAcceptingWebhooks()).toBe(false)
      expect(() => ConfigValidator.assertAcceptingWebhooks()).toThrow(ConfigError)
    })
  })
})
