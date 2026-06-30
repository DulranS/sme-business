/**
 * Close_Detector — determines whether a conversation has reached a closed-deal
 * state and records the close exactly once for the canonical RespondLeadz
 * pipeline.
 *
 * {@link evaluate} is a pure, total function: for any valid {@link Conversation}
 * it returns exactly one determination (closed-deal or not-closed-deal) and
 * never raises (Requirement 9.1). When it determines a close, it also reports
 * the detected deal value and currency so the close event can carry them
 * (Requirement 9.3).
 *
 * {@link recordCloseEvent} writes the close event (tenant, phone, deal value,
 * currency, closed-at timestamp) and is guarded by the
 * `close_events_conversation_id_key` unique constraint plus an
 * `ON CONFLICT DO NOTHING` write, so a second close event is never recorded for
 * the same conversation (Requirements 9.3, 9.4, 9.5). The write runs inside
 * {@link withTenantContext} so the row is scoped to the owning tenant by RLS
 * (Requirements 12.1, 12.2).
 *
 * {@link detectAndRecord} is the orchestration entry point the
 * Conversation_Engine calls after a reply is appended: it evaluates the
 * conversation and records a close event when closed. If evaluation or
 * recording fails, it logs the failure and rethrows so the engine can fail the
 * conversation update (Requirement 9.2).
 *
 * Feature: respond-leadz
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import type { Conversation, CloseEvent, Tenant } from './types'
import { withTenantContext } from './tenant'
import { logger } from '../logger'

/** The outcome of evaluating a conversation for a closed deal (Requirement 9.1). */
export interface CloseEvaluation {
  /** True when the conversation has reached a closed-deal state. */
  closed: boolean
  /** Detected deal value (>= 0) when the deal is closed (Requirement 9.3). */
  dealValue?: number
  /** ISO 4217 currency code for {@link dealValue} (Requirement 9.3). */
  currency?: string
}

/** Maximum value representable by the `close_events.deal_value` NUMERIC(12,2) column. */
const MAX_DEAL_VALUE = 9_999_999_999.99

/**
 * Phrases that signal a customer has committed to or completed a purchase. A
 * conversation is treated as closed when any of these match its history. Kept
 * deliberately specific to avoid treating ordinary enquiries as closed deals.
 */
const CLOSE_SIGNAL_PATTERNS: readonly RegExp[] = [
  /\b(i(?:'| ha)?ve\s+)?paid\b/i,
  /\bpayment\s+(sent|done|made|complete[d]?|received)\b/i,
  /\b(sent|made|transfer(?:red)?)\s+(the\s+)?payment\b/i,
  /\bi'?ll\s+take\s+it\b/i,
  /\bi\s+will\s+take\s+it\b/i,
  /\bi'?ll\s+(buy|purchase|order)\b/i,
  /\bi\s+want\s+to\s+(buy|purchase|order)\b/i,
  /\b(order|purchase|deal)\s+confirmed\b/i,
  /\bconfirm(?:ed)?\s+(the\s+)?(order|purchase|deal)\b/i,
  /\b(deal|sale)\s+closed\b/i,
  /\blet'?s\s+do\s+it\b/i,
  /\bgo\s+ahead\s+with\s+(the\s+)?(order|purchase|deal)\b/i,
]

/**
 * Currency symbols mapped to their ISO 4217 codes. Used to attribute a currency
 * to a detected monetary amount written with a symbol.
 */
const SYMBOL_TO_CURRENCY: Readonly<Record<string, string>> = {
  $: 'USD',
  '£': 'GBP',
  '€': 'EUR',
  '₹': 'INR',
  '¥': 'JPY',
}

/** Recognized ISO 4217 codes used to attribute a currency written as a code. */
const KNOWN_CURRENCY_CODES = new Set([
  'USD',
  'EUR',
  'GBP',
  'INR',
  'JPY',
  'CAD',
  'AUD',
  'NGN',
  'KES',
  'ZAR',
  'GHS',
  'CNY',
  'CHF',
  'AED',
  'SGD',
])

/** A monetary amount detected in conversation text. */
interface MoneyMatch {
  value: number
  currency?: string
}

const NUMBER_GROUP = '\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?'

/** Parse a numeric string that may contain thousands separators. */
function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, ''))
}

/**
 * Find every monetary amount in `text`, attributing a currency where one is
 * written alongside the amount (a symbol or a recognized ISO code).
 */
function findMoneyMatches(text: string): MoneyMatch[] {
  const matches: MoneyMatch[] = []

  // Symbol-prefixed amounts, e.g. "$1,200.50", "£100", "₹500".
  const symbolRe = new RegExp(`([$£€₹¥])\\s?(${NUMBER_GROUP})`, 'g')
  for (const m of text.matchAll(symbolRe)) {
    const value = parseAmount(m[2])
    if (Number.isFinite(value)) {
      matches.push({ value, currency: SYMBOL_TO_CURRENCY[m[1]] })
    }
  }

  // Code-prefixed amounts, e.g. "USD 100", "KES 2,500".
  const codePrefixRe = new RegExp(`\\b([A-Za-z]{3})\\s?(${NUMBER_GROUP})\\b`, 'g')
  for (const m of text.matchAll(codePrefixRe)) {
    const code = m[1].toUpperCase()
    if (!KNOWN_CURRENCY_CODES.has(code)) continue
    const value = parseAmount(m[2])
    if (Number.isFinite(value)) {
      matches.push({ value, currency: code })
    }
  }

  // Code-suffixed amounts, e.g. "100 USD", "2,500 KES".
  const codeSuffixRe = new RegExp(`\\b(${NUMBER_GROUP})\\s?([A-Za-z]{3})\\b`, 'g')
  for (const m of text.matchAll(codeSuffixRe)) {
    const code = m[2].toUpperCase()
    if (!KNOWN_CURRENCY_CODES.has(code)) continue
    const value = parseAmount(m[1])
    if (Number.isFinite(value)) {
      matches.push({ value, currency: code })
    }
  }

  return matches
}

/** Clamp a deal value into the range supported by the database column. */
function clampDealValue(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  const capped = Math.min(value, MAX_DEAL_VALUE)
  // Round to 2 decimals to match NUMERIC(12,2).
  return Math.round(capped * 100) / 100
}

/**
 * Evaluate a conversation and produce a single determination of closed-deal or
 * not-closed-deal (Requirement 9.1).
 *
 * This function is total: for any valid {@link Conversation} it returns a
 * {@link CloseEvaluation} without raising. Defensive handling of an
 * absent/blank history yields a not-closed determination rather than an error.
 * When closed, the detected deal value and currency are attached; the currency
 * falls back to the tenant default and the value to 0 when none is mentioned in
 * the conversation (Requirement 9.3).
 *
 * @param tenant       The owning tenant (supplies the default currency).
 * @param conversation The conversation to evaluate.
 * @returns The close determination.
 */
export function evaluate(
  tenant: Pick<Tenant, 'default_currency'>,
  conversation: Pick<Conversation, 'history'>
): CloseEvaluation {
  const history =
    conversation && typeof conversation.history === 'string' ? conversation.history : ''

  if (history.trim() === '') {
    return { closed: false }
  }

  const closed = CLOSE_SIGNAL_PATTERNS.some((pattern) => pattern.test(history))
  if (!closed) {
    return { closed: false }
  }

  const fallbackCurrency =
    tenant && typeof tenant.default_currency === 'string' && tenant.default_currency.trim() !== ''
      ? tenant.default_currency.toUpperCase()
      : 'USD'

  const moneyMatches = findMoneyMatches(history)
  if (moneyMatches.length === 0) {
    return { closed: true, dealValue: 0, currency: fallbackCurrency }
  }

  // Use the largest detected amount as the deal value; a deal total is the most
  // significant monetary figure mentioned in a closing exchange.
  const best = moneyMatches.reduce((max, current) =>
    current.value > max.value ? current : max
  )

  return {
    closed: true,
    dealValue: clampDealValue(best.value),
    currency: best.currency ?? fallbackCurrency,
  }
}

/** A close event row as returned by the database (conversation_id is integer). */
interface CloseEventRow {
  id: string
  tenant_id: string
  conversation_id: number | string
  phone_number: string
  deal_value: string | number
  currency: string
  closed_at: string
}

function toCloseEvent(row: CloseEventRow): CloseEvent {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    conversation_id: String(row.conversation_id),
    phone_number: row.phone_number,
    deal_value: typeof row.deal_value === 'string' ? Number(row.deal_value) : row.deal_value,
    currency: row.currency,
    closed_at: row.closed_at,
  }
}

/**
 * Record a close event for a closed conversation, guarded so a second event is
 * never recorded for the same conversation (Requirements 9.3, 9.4, 9.5).
 *
 * The insert is conditional on the `close_events_conversation_id_key` unique
 * constraint via `ON CONFLICT (conversation_id) DO NOTHING`, so concurrent or
 * repeated calls for the same conversation resolve to at most one stored event.
 * The stored event carries the tenant, phone number, deal value, currency, and
 * the close timestamp (`closed_at`, defaulted to now).
 *
 * @param tenant       The owning tenant.
 * @param conversation The conversation that closed (must have a persisted id).
 * @param evaluation   The close determination produced by {@link evaluate}.
 * @returns The newly recorded {@link CloseEvent}, or `null` when a close event
 *          already existed for the conversation (no second event recorded).
 */
export async function recordCloseEvent(
  tenant: Pick<Tenant, 'id' | 'default_currency'>,
  conversation: Pick<Conversation, 'id' | 'phone_number'>,
  evaluation: CloseEvaluation
): Promise<CloseEvent | null> {
  if (conversation.id === undefined || conversation.id === null) {
    throw new Error('Cannot record a close event for a conversation without a persisted id')
  }

  const dealValue = clampDealValue(evaluation.dealValue ?? 0)
  const currency =
    typeof evaluation.currency === 'string' && evaluation.currency.trim() !== ''
      ? evaluation.currency.toUpperCase()
      : (tenant.default_currency || 'USD').toUpperCase()

  return withTenantContext(tenant.id, async (ctx) => {
    const result = await ctx.query<CloseEventRow>(
      `INSERT INTO close_events
              (tenant_id, conversation_id, phone_number, deal_value, currency)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (conversation_id) DO NOTHING
       RETURNING id, tenant_id, conversation_id, phone_number, deal_value, currency, closed_at`,
      [tenant.id, conversation.id, conversation.phone_number, dealValue, currency]
    )

    if (result.rowCount === 0) {
      // A close event already exists for this conversation; do not record a
      // second one (Requirement 9.4).
      logger.info('Close event already recorded for conversation; skipping', {
        type: 'close_event',
        tenant: tenant.id,
        phone: conversation.phone_number,
        conversationId: String(conversation.id),
      })
      return null
    }

    const event = toCloseEvent(result.rows[0])
    logger.info('Close event recorded', {
      type: 'close_event',
      tenant: tenant.id,
      phone: conversation.phone_number,
      conversationId: String(conversation.id),
      dealValue: event.deal_value,
      currency: event.currency,
    })
    return event
  })
}

/**
 * Evaluate a conversation and record a close event when it has closed. This is
 * the entry point the Conversation_Engine calls after appending a reply.
 *
 * When the conversation is not closed, no event is written and `null` is
 * returned. When evaluation or recording fails, the failure is logged and
 * rethrown so the engine fails the conversation update (Requirement 9.2).
 *
 * @param tenant       The owning tenant.
 * @param conversation The conversation to evaluate and, if closed, record.
 * @returns The recorded {@link CloseEvent}, or `null` when not closed or when a
 *          close event already existed.
 */
export async function detectAndRecord(
  tenant: Pick<Tenant, 'id' | 'default_currency'>,
  conversation: Pick<Conversation, 'id' | 'phone_number' | 'history'>
): Promise<CloseEvent | null> {
  let evaluation: CloseEvaluation
  try {
    evaluation = evaluate(tenant, conversation)
  } catch (error) {
    // evaluate is total for valid input; reaching here means the evaluation
    // itself failed and the conversation update must fail (Requirement 9.2).
    logger.error(
      'Close-detection evaluation failed',
      {
        type: 'close_event',
        tenant: tenant.id,
        phone: conversation.phone_number,
        conversationId: conversation.id !== undefined ? String(conversation.id) : undefined,
      },
      error as Error
    )
    throw error
  }

  if (!evaluation.closed) {
    return null
  }

  try {
    return await recordCloseEvent(tenant, conversation, evaluation)
  } catch (error) {
    logger.error(
      'Recording close event failed',
      {
        type: 'close_event',
        tenant: tenant.id,
        phone: conversation.phone_number,
        conversationId: conversation.id !== undefined ? String(conversation.id) : undefined,
      },
      error as Error
    )
    throw error
  }
}
