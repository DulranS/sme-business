/**
 * AI_Responder — grounds customer-facing replies in live, tenant-scoped
 * inventory using a single configured LLM provider.
 *
 * This module owns two concerns:
 *  1. The LLM provider wiring (a single config-selected {@link LlmProvider},
 *     Requirement 11.4), and
 *  2. Rendering the inventory context that anchors every response strictly to
 *     the items returned by the Inventory_Service.
 *
 * The rendered inventory context references ONLY the items provided to it and
 * never an unlisted item (Requirement 6.3). When the provided set is empty it
 * states that no matching items were found and asserts no availability
 * (Requirement 6.4). For every referenced item it includes the item's stored
 * price and its available quantity, including a quantity of zero for
 * out-of-stock items (Requirements 6.5, 6.6).
 *
 * Keyword extraction, response generation, and the Fallback_Response are
 * layered on top of this foundation. Intent extraction caps the requested LLM
 * tokens at 50 and response generation caps them at 300 per message
 * (Requirement 14.2). Whenever the LLM fails during either stage, the responder
 * produces a non-empty Fallback_Response and signals the failure so the caller
 * can send the fallback and record the failure in the system log
 * (Requirements 8.1–8.3).
 *
 * Feature: respond-leadz
 * Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 8.1, 8.2, 8.3, 11.4, 14.2
 */

import type { InventoryItem } from './types'
import { createLlmProvider, type LlmProvider } from './llm-provider'
import { LlmError } from './errors'

/**
 * The exact statement used when the Inventory_Service returns no matching
 * items. It declares that nothing was found and makes no availability claim
 * about any unlisted item (Requirement 6.4).
 */
export const NO_MATCHING_ITEMS_MESSAGE = 'No matching items were found in inventory.'

/**
 * Maximum LLM tokens requested for intent (keyword) extraction. Capped at 50
 * tokens per message to control cost and stay within tier limits
 * (Requirement 14.2).
 */
export const EXTRACT_MAX_TOKENS = 50

/**
 * Maximum LLM tokens requested for response generation. Capped at 300 tokens
 * per message (Requirement 14.2).
 */
export const GENERATE_MAX_TOKENS = 300

/**
 * The Fallback_Response sent when the LLM fails during intent extraction or
 * response generation. It is always non-empty so the customer is never left
 * without a reply (Requirements 8.1, 8.2).
 */
export const FALLBACK_RESPONSE =
  "Thanks for your message! I'm having trouble looking that up right now. " +
  'Please try again in a moment, or let me know how I can help and a team member will follow up.'

/**
 * The outcome of intent (keyword) extraction.
 *
 * On success, {@link KeywordExtraction.keyword} holds the extracted search
 * terms and {@link KeywordExtraction.failure} is null. When the LLM fails, the
 * keyword is empty and `failure` carries the typed {@link LlmError} so the
 * caller can short-circuit to the Fallback_Response and log the failure
 * (Requirements 8.1, 8.3).
 */
export interface KeywordExtraction {
  /** Normalized search terms; empty string when extraction failed. */
  keyword: string
  /** The LLM failure to log, or null when extraction succeeded. */
  failure: LlmError | null
}

/**
 * The outcome of response generation.
 *
 * {@link GeneratedResponse.text} is always non-empty: either the grounded,
 * customer-facing reply or the {@link FALLBACK_RESPONSE}. When the LLM fails,
 * `usedFallback` is true and `failure` carries the typed {@link LlmError} for
 * logging (Requirements 8.1–8.3).
 */
export interface GeneratedResponse {
  /** The customer-facing text to send; always non-empty. */
  text: string
  /** True when `text` is the Fallback_Response produced after an LLM failure. */
  usedFallback: boolean
  /** The LLM failure to log when `usedFallback` is true; null otherwise. */
  failure: LlmError | null
}

/**
 * Collapse internal whitespace and trim a model-produced string. Keeps keyword
 * output compact and predictable for the downstream inventory search.
 */
function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Render a single inventory item as one grounded context line.
 *
 * The line always includes the item's stored price (with its currency) and its
 * available quantity, including 0 for out-of-stock items (Requirements 6.5,
 * 6.6). Prices are emitted using the stored value to avoid implying a precision
 * or rounding the item does not have.
 */
export function renderInventoryItem(item: InventoryItem): string {
  const name = item.name && item.name.trim().length > 0 ? item.name.trim() : 'Unnamed item'
  const sku = item.sku && item.sku.trim().length > 0 ? item.sku.trim() : 'N/A'
  // Use the stored price value directly (Requirement 6.5) alongside the
  // item's currency; quantity is always shown, including 0 (Requirement 6.6).
  const price = `${item.currency} ${item.price}`
  return `- ${name} (SKU: ${sku}) | price: ${price} | quantity available: ${item.quantity}`
}

/**
 * Render the grounded inventory context for a set of items.
 *
 * The output references only the provided items, in the order given, with no
 * unlisted item (Requirement 6.3). An empty set yields the explicit
 * "no matching items" statement (Requirement 6.4). Each referenced item carries
 * its stored price and available quantity, including zero (Requirements 6.5,
 * 6.6).
 *
 * @param items The inventory items returned by the Inventory_Service.
 * @returns A plain-text inventory context suitable for grounding an LLM prompt.
 */
export function renderInventoryContext(items: readonly InventoryItem[] | null | undefined): string {
  if (!items || items.length === 0) {
    return NO_MATCHING_ITEMS_MESSAGE
  }
  return items.map(renderInventoryItem).join('\n')
}

/**
 * The AI_Responder wraps a single configured {@link LlmProvider} and grounds
 * responses in the inventory context.
 *
 * It extracts search keywords from the customer message (≤ 50 tokens) and
 * generates a customer-facing reply grounded strictly in the items returned by
 * the Inventory_Service (≤ 300 tokens), enforcing the per-stage token caps of
 * Requirement 14.2. When the LLM fails during either stage, the responder
 * produces a non-empty Fallback_Response and surfaces the typed failure so the
 * caller can send the fallback and log the failure (Requirements 8.1–8.3).
 */
export class AiResponder {
  /** The single configured provider used for all LLM calls (Requirement 11.4). */
  protected readonly provider: LlmProvider

  /**
   * @param provider An explicit provider (primarily for tests); defaults to the
   *   config-selected canonical provider so a tenant cannot mix providers.
   */
  constructor(provider: LlmProvider = createLlmProvider()) {
    this.provider = provider
  }

  /**
   * Build the inventory context that grounds a response strictly in the items
   * returned by the Inventory_Service (Requirements 6.3–6.6). Exposed as a
   * method so later response-generation logic shares one grounding path.
   */
  buildInventoryContext(items: readonly InventoryItem[] | null | undefined): string {
    return renderInventoryContext(items)
  }

  /** The non-empty Fallback_Response sent when the LLM fails (Requirement 8.1). */
  getFallbackResponse(): string {
    return FALLBACK_RESPONSE
  }

  /**
   * Extract search terms from the customer message using the LLM
   * (Requirement 6.1). The request is capped at {@link EXTRACT_MAX_TOKENS}
   * (50) tokens per message (Requirement 14.2).
   *
   * This never throws: if the LLM fails, the returned {@link KeywordExtraction}
   * has an empty keyword and carries the typed {@link LlmError} so the caller
   * can short-circuit to the Fallback_Response and log the failure
   * (Requirements 8.1, 8.3).
   */
  async extractKeyword(text: string): Promise<KeywordExtraction> {
    const prompt = buildKeywordPrompt(text)
    try {
      const raw = await this.provider.complete({
        prompt,
        maxTokens: EXTRACT_MAX_TOKENS,
        stage: 'extract',
      })
      return { keyword: normalizeWhitespace(raw), failure: null }
    } catch (cause) {
      return { keyword: '', failure: toLlmError('extract', cause) }
    }
  }

  /**
   * Generate a customer-facing reply grounded strictly in the inventory items
   * returned by the Inventory_Service for the current tenant. The reply
   * references only those items, includes each referenced item's stored price
   * and available quantity (including zero), and states that no matching items
   * were found when the set is empty (Requirements 6.3–6.6). The request is
   * capped at {@link GENERATE_MAX_TOKENS} (300) tokens per message
   * (Requirement 14.2).
   *
   * This never throws: if the LLM fails, the returned {@link GeneratedResponse}
   * carries the non-empty {@link FALLBACK_RESPONSE}, sets `usedFallback`, and
   * surfaces the typed {@link LlmError} for logging (Requirements 8.1–8.3).
   *
   * @param contactName The customer's display name.
   * @param text The customer's inbound message text.
   * @param items The inventory items returned by the Inventory_Service.
   * @param history The serialized conversation history for context.
   * @param keyword The search terms previously extracted from the message.
   */
  async generateResponse(
    contactName: string,
    text: string,
    items: readonly InventoryItem[] | null | undefined,
    history: string,
    keyword: string
  ): Promise<GeneratedResponse> {
    const prompt = buildResponsePrompt({
      contactName,
      text,
      inventoryContext: this.buildInventoryContext(items),
      history,
      keyword,
    })
    try {
      const raw = await this.provider.complete({
        prompt,
        maxTokens: GENERATE_MAX_TOKENS,
        stage: 'generate',
      })
      const reply = raw.trim()
      // Defend against an empty completion: the customer must always receive a
      // non-empty reply (Requirement 8.1).
      if (reply.length === 0) {
        return {
          text: FALLBACK_RESPONSE,
          usedFallback: true,
          failure: new LlmError('generate', 'LLM generate response contained no text'),
        }
      }
      return { text: reply, usedFallback: false, failure: null }
    } catch (cause) {
      return {
        text: FALLBACK_RESPONSE,
        usedFallback: true,
        failure: toLlmError('generate', cause),
      }
    }
  }
}

/**
 * Coerce an unknown thrown value into a typed {@link LlmError} for the given
 * stage. Provider implementations already throw {@link LlmError}; this guards
 * against any non-typed failure so callers always receive a stage-tagged error
 * to log (Requirement 8.3) without exposing provider internals.
 */
function toLlmError(stage: 'extract' | 'generate', cause: unknown): LlmError {
  if (cause instanceof LlmError) return cause
  return new LlmError(stage, `LLM ${stage} request failed`, { cause })
}

/**
 * Build the intent-extraction prompt. The model is asked to return only concise
 * search terms drawn from the customer message, which keeps the completion well
 * within the 50-token cap (Requirements 6.1, 14.2).
 */
function buildKeywordPrompt(text: string): string {
  const message = (text ?? '').trim()
  return [
    'You extract product search terms from a customer message for an inventory lookup.',
    'Return only the key product names, categories, or attributes the customer is asking about.',
    'Respond with a short space-separated list of search terms and nothing else.',
    'If there are no product-related terms, respond with an empty line.',
    '',
    `Customer message: ${message}`,
    'Search terms:',
  ].join('\n')
}

/** Inputs used to render the response-generation prompt. */
interface ResponsePromptInput {
  contactName: string
  text: string
  inventoryContext: string
  history: string
  keyword: string
}

/**
 * Build the response-generation prompt. The prompt grounds the model strictly
 * in the rendered inventory context: it must reference only the listed items,
 * always include each referenced item's price and available quantity (including
 * a quantity of zero), and state that no matching items were found when the
 * context says so (Requirements 6.3–6.6). The reply is constrained to plain
 * text suitable for WhatsApp.
 */
function buildResponsePrompt(input: ResponsePromptInput): string {
  const name = input.contactName && input.contactName.trim().length > 0
    ? input.contactName.trim()
    : 'there'
  const history = input.history && input.history.trim().length > 0
    ? input.history.trim()
    : '(no prior conversation)'
  const keyword = input.keyword && input.keyword.trim().length > 0
    ? input.keyword.trim()
    : '(none)'

  return [
    'You are a helpful sales assistant replying to a customer on WhatsApp.',
    'Ground your reply strictly in the INVENTORY below.',
    'Rules:',
    '- Reference ONLY items listed in INVENTORY. Never mention or imply any item that is not listed.',
    '- For every item you reference, state its price and its available quantity, including a quantity of 0.',
    `- If INVENTORY says "${NO_MATCHING_ITEMS_MESSAGE}", tell the customer no matching items were found and do not claim any item is available.`,
    '- Reply in plain text only (no markdown, no formatting symbols). Keep it concise and friendly.',
    '',
    `Customer name: ${name}`,
    `Extracted search terms: ${keyword}`,
    '',
    'Conversation history:',
    history,
    '',
    'INVENTORY:',
    input.inventoryContext,
    '',
    `Customer message: ${(input.text ?? '').trim()}`,
    'Your reply:',
  ].join('\n')
}
