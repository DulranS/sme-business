/**
 * Property-based tests for the Inbound_Handler POST pipeline (`handlePost`).
 *
 * These cover the post-authentication pipeline behaviors:
 *  - Property 29: Independent per-conversation processing (task 17.4, Req 15.2)
 *  - Property 30: Webhook resilience returns 200 on processing error
 *    (task 17.5, Req 17.3)
 *  - Property 31: Per-message log completeness (task 17.6, Req 17.1)
 *
 * The signature verifier is mocked to accept every request here; the
 * 401-on-bad-signature path is covered by the signature unit/property tests, so
 * these tests focus on what happens once a request is authenticated.
 *
 * Hermetic: every collaborator the handler wires together is mocked, so the
 * pipeline runs with no network, database, or LLM access. The WhatsApp payloads
 * are real, valid `whatsapp_business_account` structures so the production
 * `parse` and `extractPhoneNumberId` run unmocked.
 *
 * Feature: respond-leadz
 * Validates: Requirements 15.2, 17.3, 17.1
 */

import fc from 'fast-check'

// ---------------------------------------------------------------------------
// Module mocks. Each collaborator the Inbound_Handler imports is replaced with
// a jest mock so `handlePost` runs without any external dependency. The factory
// bodies only reference `jest.fn()` literals (no outer variables) so they are
// safe under jest.mock hoisting; per-test behavior is configured below.
// ---------------------------------------------------------------------------

jest.mock('@/lib/pipeline/signature', () => ({
  verify: jest.fn(() => true),
}))

jest.mock('@/lib/config', () => ({
  Config: { whatsapp: { appSecret: 'test-app-secret' } },
  ConfigValidator: {
    getLastResult: jest.fn(() => ({ ok: true, missingKeys: [], error: null })),
    validateStartup: jest.fn(() => ({ ok: true, missingKeys: [], error: null })),
    assertAcceptingWebhooks: jest.fn(() => undefined),
  },
}))

jest.mock('@/lib/pipeline/tenant', () => ({
  resolveTenant: jest.fn(),
  getTenantCredentials: jest.fn(),
  withTenantContext: jest.fn(),
}))

jest.mock('@/lib/pipeline/rate-limiter', () => ({
  registerArrival: jest.fn(() => ({ windowCount: 1, defer: false })),
  enqueueInbound: jest.fn(async () => undefined),
}))

jest.mock('@/lib/pipeline/conversation-engine', () => ({
  fetchHistory: jest.fn(async () => ({ history: '' })),
  isDuplicate: jest.fn(() => false),
  appendAndTrim: jest.fn(() => ''),
  commitTurn: jest.fn(async () => ({ committed: true })),
}))

jest.mock('@/lib/pipeline/inventory', () => ({
  search: jest.fn(async () => []),
}))

jest.mock('@/lib/pipeline/ai-responder', () => ({
  AiResponder: jest.fn(),
}))

jest.mock('@/lib/pipeline/outbound-sender', () => ({
  send: jest.fn(async () => undefined),
}))

jest.mock('@/lib/pipeline/close-detector', () => ({
  detectAndRecord: jest.fn(async () => undefined),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    message: jest.fn(),
  },
  LogLevel: { ERROR: 'ERROR', WARN: 'WARN', INFO: 'INFO', DEBUG: 'DEBUG' },
}))

// Imports must come after jest.mock so the handler picks up the mocked modules.
import { handlePost } from '@/lib/pipeline/inbound-handler'
import { verify as verifySignature } from '@/lib/pipeline/signature'
import {
  resolveTenant,
  getTenantCredentials,
  withTenantContext,
} from '@/lib/pipeline/tenant'
import { registerArrival, enqueueInbound } from '@/lib/pipeline/rate-limiter'
import {
  fetchHistory,
  isDuplicate,
  appendAndTrim,
  commitTurn,
} from '@/lib/pipeline/conversation-engine'
import { search as searchInventory } from '@/lib/pipeline/inventory'
import { AiResponder } from '@/lib/pipeline/ai-responder'
import { send as sendOutbound } from '@/lib/pipeline/outbound-sender'
import { detectAndRecord } from '@/lib/pipeline/close-detector'
import { logger } from '@/lib/logger'
import type { Tenant } from '@/lib/pipeline/types'

// Typed handles to the mocks for per-test configuration and assertions.
const mockVerify = verifySignature as jest.Mock
const mockResolveTenant = resolveTenant as jest.Mock
const mockGetTenantCredentials = getTenantCredentials as jest.Mock
const mockWithTenantContext = withTenantContext as jest.Mock
const mockRegisterArrival = registerArrival as jest.Mock
const mockEnqueueInbound = enqueueInbound as jest.Mock
const mockFetchHistory = fetchHistory as jest.Mock
const mockIsDuplicate = isDuplicate as jest.Mock
const mockAppendAndTrim = appendAndTrim as jest.Mock
const mockCommitTurn = commitTurn as jest.Mock
const mockSearch = searchInventory as jest.Mock
const mockAiResponder = AiResponder as unknown as jest.Mock
const mockSend = sendOutbound as jest.Mock
const mockDetectAndRecord = detectAndRecord as jest.Mock
const mockLogger = logger as unknown as {
  info: jest.Mock
  warn: jest.Mock
  error: jest.Mock
  debug: jest.Mock
  message: jest.Mock
}

// The AiResponder instance methods are stable jest.fns shared across `new
// AiResponder()` calls so behavior is configured once and asserted globally.
const mockExtractKeyword = jest.fn()
const mockGenerateResponse = jest.fn()

/** Property tests generate >= 100 cases each. */
const RUNS = { numRuns: 120 }

const PHONE_NUMBER_ID = '109876543210123'
const TENANT_ID = '11111111-1111-4111-8111-111111111111'

/** A fake tenant identity returned by the resolver (credential-free). */
const TENANT_IDENTITY = {
  id: TENANT_ID,
  name: 'Acme',
  whatsapp_phone_number_id: PHONE_NUMBER_ID,
  llm_provider: 'claude',
  default_currency: 'USD',
}

/** A fake tenant with credentials returned by getTenantCredentials. */
const TENANT: Tenant = {
  id: TENANT_ID,
  name: 'Acme',
  whatsapp_phone_number_id: PHONE_NUMBER_ID,
  whatsapp_access_token: 'access-token',
  whatsapp_app_secret: 'app-secret',
  whatsapp_verify_token: 'verify-token',
  llm_provider: 'claude',
  llm_api_key: 'llm-key',
  default_currency: 'USD',
}

/** The phone number assigned to the i-th generated message. */
function phoneFor(index: number): string {
  return `1555000${String(index).padStart(3, '0')}`
}

/** Build one valid WhatsApp text message object for the payload. */
function buildMessage(index: number, text: string) {
  return {
    from: phoneFor(index),
    id: `wamid.TEST${index}`,
    timestamp: '1700000000',
    type: 'text',
    text: { body: text },
  }
}

/** Build a valid `whatsapp_business_account` webhook payload string. */
function buildRawBody(texts: string[]): string {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550000000',
                phone_number_id: PHONE_NUMBER_ID,
              },
              contacts: [
                { profile: { name: { formatted_name: 'Customer' } }, wa_id: phoneFor(0) },
              ],
              messages: texts.map((text, i) => buildMessage(i, text)),
            },
          },
        ],
      },
    ],
  }
  return JSON.stringify(payload)
}

/**
 * Restore every mock to its success-path default. `clearMocks` (jest config)
 * resets call records between tests but not implementations, and individual
 * property runs override behavior, so defaults are re-established before each
 * run to keep runs independent.
 */
function setDefaults(): void {
  mockVerify.mockReturnValue(true)
  mockResolveTenant.mockResolvedValue(TENANT_IDENTITY)
  mockGetTenantCredentials.mockResolvedValue(TENANT)
  // getConversationId reads a row through withTenantContext.
  mockWithTenantContext.mockImplementation(
    async (_tenantId: string, fn: (ctx: unknown) => unknown) =>
      fn({
        tenantId: _tenantId,
        query: async () => ({ rowCount: 1, rows: [{ id: 'conv-1' }] }),
      })
  )
  mockRegisterArrival.mockReturnValue({ windowCount: 1, defer: false })
  mockEnqueueInbound.mockResolvedValue(undefined)
  mockFetchHistory.mockResolvedValue({ history: '' })
  mockIsDuplicate.mockReturnValue(false)
  mockAppendAndTrim.mockReturnValue('')
  mockCommitTurn.mockResolvedValue({ committed: true })
  mockSearch.mockResolvedValue([])
  mockDetectAndRecord.mockResolvedValue(undefined)
  mockSend.mockResolvedValue(undefined)
  mockExtractKeyword.mockResolvedValue({ keyword: 'k', failure: null })
  mockGenerateResponse.mockResolvedValue({
    text: 'reply',
    usedFallback: false,
    failure: null,
  })
  mockAiResponder.mockImplementation(() => ({
    extractKeyword: mockExtractKeyword,
    generateResponse: mockGenerateResponse,
    getFallbackResponse: () => 'fb',
  }))
}

beforeEach(() => {
  setDefaults()
})

describe('Inbound_Handler.handlePost', () => {
  // Feature: respond-leadz, Property 29: Independent per-conversation processing
  describe('Property 29: Independent per-conversation processing', () => {
    it('processes every message independently even when a subset of sends fail (Req 15.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          // One boolean per message: true => its outbound send fails.
          fc.array(fc.boolean(), { minLength: 1, maxLength: 6 }),
          async (failFlags) => {
            // Reset call counts/behavior for an isolated run (keeps no leakage
            // of accumulated call counts between fast-check iterations).
            jest.clearAllMocks()
            setDefaults()

            const n = failFlags.length
            const failPhones = new Set(
              failFlags.map((flag, i) => (flag ? phoneFor(i) : null)).filter((p): p is string => p !== null)
            )

            // Fail the send for messages whose phone is in the fail set; the
            // others succeed. This isolates failures to specific conversations.
            mockSend.mockImplementation(async (_tenant: Tenant, to: string) => {
              if (failPhones.has(to)) {
                throw new Error(`simulated delivery failure for ${to}`)
              }
              return undefined
            })

            const rawBody = buildRawBody(failFlags.map((_, i) => `message ${i}`))
            const result = await handlePost(rawBody, 'sha256=whatever')

            // The webhook still acknowledges with 200 despite per-message failures.
            expect(result.status).toBe(200)

            // Every message was attempted independently: one send and one
            // keyword extraction per message, regardless of sibling failures.
            expect(mockSend).toHaveBeenCalledTimes(n)
            expect(mockExtractKeyword).toHaveBeenCalledTimes(n)

            // A per-message log entry is emitted for each message (failing or not).
            expect(mockLogger.message).toHaveBeenCalledTimes(n)
          }
        ),
        RUNS
      )
    })
  })

  // Feature: respond-leadz, Property 30: Webhook resilience returns 200 on processing error
  describe('Property 30: Webhook resilience returns 200 on processing error', () => {
    it('returns 200 and records the error when any collaborator throws (Req 17.3)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            mode: fc.constantFrom(
              'send',
              'commit',
              'detect',
              'extract',
              'fetch',
              'credentials',
              'resolve'
            ),
            count: fc.integer({ min: 1, max: 5 }),
          }),
          async ({ mode, count }) => {
            jest.clearAllMocks()
            setDefaults()

            const boom = new Error(`injected failure: ${mode}`)
            switch (mode) {
              case 'send':
                mockSend.mockRejectedValue(boom)
                break
              case 'commit':
                mockCommitTurn.mockRejectedValue(boom)
                break
              case 'detect':
                mockDetectAndRecord.mockRejectedValue(boom)
                break
              case 'extract':
                mockExtractKeyword.mockRejectedValue(boom)
                break
              case 'fetch':
                mockFetchHistory.mockRejectedValue(boom)
                break
              case 'credentials':
                mockGetTenantCredentials.mockRejectedValue(boom)
                break
              case 'resolve':
                mockResolveTenant.mockRejectedValue(boom)
                break
            }

            const rawBody = buildRawBody(
              Array.from({ length: count }, (_, i) => `message ${i}`)
            )

            // handlePost must never throw and never return a 5xx for a
            // processing error.
            const result = await handlePost(rawBody, 'sha256=whatever')

            expect(result.status).toBe(200)
            // The error is recorded in the system log.
            expect(mockLogger.error).toHaveBeenCalled()
          }
        ),
        RUNS
      )
    })
  })

  // Feature: respond-leadz, Property 31: Per-message log completeness
  describe('Property 31: Per-message log completeness', () => {
    it('emits one complete per-message log entry per message (Req 17.1)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ maxLength: 40 }), { minLength: 1, maxLength: 6 }),
          async (texts) => {
            jest.clearAllMocks()
            setDefaults()

            const rawBody = buildRawBody(texts)
            const result = await handlePost(rawBody, 'sha256=whatever')

            expect(result.status).toBe(200)

            // Exactly one per-message log entry per message.
            expect(mockLogger.message).toHaveBeenCalledTimes(texts.length)

            // Every entry carries a non-empty tenant, phone, messageId, and outcome.
            for (const call of mockLogger.message.mock.calls) {
              const fields = call[0] as Record<string, unknown>
              for (const key of ['tenant', 'phone', 'messageId', 'outcome']) {
                expect(fields).toHaveProperty(key)
                expect(typeof fields[key]).toBe('string')
                expect((fields[key] as string).length).toBeGreaterThan(0)
              }
            }
          }
        ),
        RUNS
      )
    })
  })
})
