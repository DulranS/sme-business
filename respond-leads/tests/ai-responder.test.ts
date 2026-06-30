/**
 * Property-based tests for the AI_Responder (Tasks 8.3–8.6).
 *
 * These tests are fully hermetic: a fake {@link LlmProvider} is injected into
 * `new AiResponder(fakeProvider)` so no network call is ever made. The fake
 * records every `complete` request (used to assert the per-stage token caps)
 * and can be configured to return text or to throw an {@link LlmError} (used to
 * assert the Fallback_Response behavior).
 *
 * Feature: respond-leadz
 */

import fc from 'fast-check'

import {
  AiResponder,
  renderInventoryContext,
  renderInventoryItem,
  NO_MATCHING_ITEMS_MESSAGE,
  EXTRACT_MAX_TOKENS,
  GENERATE_MAX_TOKENS,
  FALLBACK_RESPONSE,
} from '@/lib/pipeline/ai-responder'
import type {
  LlmProvider,
  LlmCompletionRequest,
} from '@/lib/pipeline/llm-provider'
import type { InventoryItem } from '@/lib/pipeline/types'
import { LlmError } from '@/lib/pipeline/errors'

const NUM_RUNS = 200

/**
 * A hermetic fake LLM provider. It records every request it receives so tests
 * can assert the per-stage token caps, and is configured either to return a
 * fixed completion or to throw a typed {@link LlmError}.
 */
class FakeLlmProvider implements LlmProvider {
  readonly name = 'fake-provider'
  readonly requests: LlmCompletionRequest[] = []

  constructor(
    private readonly behavior:
      | { mode: 'return'; text: string }
      | { mode: 'throw'; error: LlmError }
  ) {}

  async complete(request: LlmCompletionRequest): Promise<string> {
    this.requests.push(request)
    if (this.behavior.mode === 'throw') {
      throw this.behavior.error
    }
    return this.behavior.text
  }
}

// A clean alphanumeric token: no whitespace (so it never collapses to a
// default) and no `|`/newline (so rendered lines parse unambiguously).
const tokenArb = fc
  .array(
    fc.constantFrom(
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('')
    ),
    { minLength: 1, maxLength: 12 }
  )
  .map((chars) => chars.join(''))

// Quantity arbitrary that deliberately includes 0 (out of stock).
const quantityArb = fc.oneof(fc.constant(0), fc.nat({ max: 9999 }))

// Price arbitrary: finite, non-negative.
const priceArb = fc.double({
  min: 0,
  max: 1_000_000,
  noNaN: true,
  noDefaultInfinity: true,
})

/** Build an arbitrary {@link InventoryItem} matching the domain type. */
const inventoryItemArb: fc.Arbitrary<InventoryItem> = fc.record({
  tenant_id: fc.uuid(),
  name: tokenArb,
  sku: tokenArb,
  quantity: quantityArb,
  price: priceArb,
  currency: fc.constantFrom('USD', 'EUR', 'GBP', 'LKR', 'JPY'),
  price_usd: priceArb,
  is_active: fc.boolean(),
})

/** Extract the rendered SKU from a single context line. */
function skuFromLine(line: string): string | null {
  const match = /\(SKU: (.*?)\) \|/.exec(line)
  return match ? match[1] : null
}

describe('AI_Responder property tests', () => {
  // Feature: respond-leadz, Property 11: Responses are grounded only in returned inventory
  // Validates: Requirements 6.3, 6.4
  describe('Property 11: Responses are grounded only in returned inventory', () => {
    it('renders only the provided items, with no invented SKUs', () => {
      fc.assert(
        fc.property(fc.array(inventoryItemArb, { minLength: 1, maxLength: 8 }), (items) => {
          const output = renderInventoryContext(items)
          const lines = output.split('\n')

          // One rendered line per provided item — nothing extra is invented.
          expect(lines).toHaveLength(items.length)

          const providedSkus = new Set(items.map((i) => i.sku.trim()))
          for (const line of lines) {
            const sku = skuFromLine(line)
            expect(sku).not.toBeNull()
            // Every rendered SKU corresponds to a provided item.
            expect(providedSkus.has(sku as string)).toBe(true)
          }

          // Every provided item's name and SKU is referenced in the output.
          for (const item of items) {
            expect(output).toContain(item.name.trim())
            expect(output).toContain(`SKU: ${item.sku.trim()}`)
          }
        }),
        { numRuns: NUM_RUNS }
      )
    })

    it('states no matching items for an empty / null / undefined set', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<readonly InventoryItem[] | null | undefined>([], null, undefined),
          (items) => {
            expect(renderInventoryContext(items)).toBe(NO_MATCHING_ITEMS_MESSAGE)
          }
        ),
        { numRuns: NUM_RUNS }
      )
    })
  })

  // Feature: respond-leadz, Property 12: Referenced items always include price and quantity
  // Validates: Requirements 6.5, 6.6
  describe('Property 12: Referenced items always include price and quantity', () => {
    it('every rendered item line includes its price and quantity (including 0)', () => {
      fc.assert(
        fc.property(fc.array(inventoryItemArb, { minLength: 1, maxLength: 8 }), (items) => {
          const output = renderInventoryContext(items)
          const lines = output.split('\n')
          expect(lines).toHaveLength(items.length)

          items.forEach((item, index) => {
            const line = lines[index]
            // Price (stored value) and its currency are present.
            expect(line).toContain(`price: ${item.currency} ${item.price}`)
            // Quantity is always shown, including a quantity of 0.
            expect(line).toContain(`quantity available: ${item.quantity}`)

            // The same guarantee holds when rendering the item in isolation.
            const single = renderInventoryItem(item)
            expect(single).toContain(`${item.price}`)
            expect(single).toContain(`quantity available: ${item.quantity}`)
          })
        }),
        { numRuns: NUM_RUNS }
      )
    })
  })

  // Feature: respond-leadz, Property 14: AI failure produces a fallback
  // Validates: Requirements 8.1, 8.2, 8.3
  describe('Property 14: AI failure produces a fallback', () => {
    it('extractKeyword returns an empty keyword and surfaces the LlmError', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), async (text) => {
          const error = new LlmError('extract', 'boom')
          const responder = new AiResponder(new FakeLlmProvider({ mode: 'throw', error }))

          const result = await responder.extractKeyword(text)

          expect(result.keyword).toBe('')
          expect(result.failure).toBeInstanceOf(LlmError)
          expect(result.failure).toBe(error)
        }),
        { numRuns: NUM_RUNS }
      )
    })

    it('generateResponse returns the non-empty fallback with usedFallback and a failure', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.string(),
          fc.array(inventoryItemArb, { maxLength: 5 }),
          fc.string(),
          fc.string(),
          async (contactName, text, items, history, keyword) => {
            const error = new LlmError('generate', 'kaput')
            const responder = new AiResponder(new FakeLlmProvider({ mode: 'throw', error }))

            const result = await responder.generateResponse(
              contactName,
              text,
              items,
              history,
              keyword
            )

            expect(result.text).toBe(FALLBACK_RESPONSE)
            expect(result.text.length).toBeGreaterThan(0)
            expect(result.usedFallback).toBe(true)
            expect(result.failure).not.toBeNull()
            expect(result.failure).toBeInstanceOf(LlmError)
          }
        ),
        { numRuns: NUM_RUNS }
      )
    })
  })

  // Feature: respond-leadz, Property 26: Token caps on LLM requests
  // Validates: Requirements 14.2
  describe('Property 26: Token caps on LLM requests', () => {
    it('every issued request respects the per-stage token cap', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string(),
          fc.string(),
          fc.array(inventoryItemArb, { maxLength: 5 }),
          fc.string(),
          fc.string(),
          async (contactName, text, items, history, keyword) => {
            const fake = new FakeLlmProvider({ mode: 'return', text: 'ok reply' })
            const responder = new AiResponder(fake)

            await responder.extractKeyword(text)
            await responder.generateResponse(contactName, text, items, history, keyword)

            // The responder must have actually issued requests through the provider.
            expect(fake.requests.length).toBeGreaterThan(0)

            for (const request of fake.requests) {
              if (request.stage === 'extract') {
                expect(request.maxTokens).toBeLessThanOrEqual(EXTRACT_MAX_TOKENS)
                expect(EXTRACT_MAX_TOKENS).toBe(50)
              } else if (request.stage === 'generate') {
                expect(request.maxTokens).toBeLessThanOrEqual(GENERATE_MAX_TOKENS)
                expect(GENERATE_MAX_TOKENS).toBe(300)
              } else {
                throw new Error(`Unexpected stage: ${String(request.stage)}`)
              }
            }
          }
        ),
        { numRuns: NUM_RUNS }
      )
    })
  })
})
