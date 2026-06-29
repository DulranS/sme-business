/**
 * WebhookParser — extracts processable text messages from a WhatsApp webhook
 * payload for the canonical RespondLeadz pipeline.
 *
 * Responsibilities (per design "Components and Interfaces → WebhookParser"):
 *  - `parse(payload)` extracts one {@link ParsedMessage} per text message,
 *    capped at 100 messages per payload (Requirement 2.2).
 *  - `truncateMessage(text)` caps extracted text at 4096 characters
 *    (Requirement 2.3).
 *  - `resolveCustomerName(contact)` returns "Unknown" for absent, empty, or
 *    whitespace-only names (Requirement 2.7).
 *  - Non-text messages and zero-message/status-only payloads yield an empty
 *    processing set (Requirements 2.4, 2.5).
 *  - Structurally unparseable payloads throw {@link PayloadParseError}, which
 *    the Inbound_Handler maps to a logged HTTP 200 (Requirement 2.6).
 *
 * Feature: respond-leadz
 * Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { PayloadParseError } from './errors'
import type { ParsedMessage } from './types'

/** Maximum number of text messages extracted from a single payload (Requirement 2.2). */
export const MAX_MESSAGES_PER_PAYLOAD = 100

/** Maximum length, in characters, of an extracted message body (Requirement 2.3). */
export const MAX_MESSAGE_LENGTH = 4096

/** Default customer name used when a contact display name is unusable (Requirement 2.7). */
export const DEFAULT_CUSTOMER_NAME = 'Unknown'

/** WhatsApp profile name shape; all fields are optional/untrusted in practice. */
interface RawProfileName {
  first_name?: unknown
  last_name?: unknown
  formatted_name?: unknown
}

/** WhatsApp contact shape; treated as untrusted input. */
interface RawContact {
  profile?: { name?: RawProfileName | null } | null
  wa_id?: unknown
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Truncate a message body to at most {@link MAX_MESSAGE_LENGTH} characters.
 *
 * The result is always a prefix of the input and equal to the input when the
 * input is already within the limit (Requirement 2.3).
 */
export function truncateMessage(text: string): string {
  if (!isString(text)) {
    return ''
  }
  return text.length > MAX_MESSAGE_LENGTH ? text.slice(0, MAX_MESSAGE_LENGTH) : text
}

/**
 * Derive a display name candidate from a contact's profile name, preferring a
 * first/last combination, then either part alone, then the formatted name.
 * Returns `undefined` when no usable name part is present.
 */
function deriveDisplayName(contact: RawContact | null | undefined): string | undefined {
  const name = contact?.profile?.name
  if (!isObject(name)) {
    return undefined
  }

  const first = isString(name.first_name) ? name.first_name : ''
  const last = isString(name.last_name) ? name.last_name : ''
  const formatted = isString(name.formatted_name) ? name.formatted_name : ''

  if (first && last) {
    return `${first} ${last}`
  }
  if (first) {
    return first
  }
  if (last) {
    return last
  }
  if (formatted) {
    return formatted
  }
  return undefined
}

/**
 * Resolve the customer display name for a contact.
 *
 * Returns the trimmed display name when present, or {@link DEFAULT_CUSTOMER_NAME}
 * ("Unknown") when the name is absent, empty, or whitespace-only (Requirement 2.7).
 */
export function resolveCustomerName(contact: RawContact | null | undefined): string {
  const candidate = deriveDisplayName(contact)
  if (candidate === undefined) {
    return DEFAULT_CUSTOMER_NAME
  }
  const trimmed = candidate.trim()
  return trimmed.length === 0 ? DEFAULT_CUSTOMER_NAME : trimmed
}

/**
 * Extract one {@link ParsedMessage} per text message from a WhatsApp webhook
 * payload.
 *
 * Behavior:
 *  - Only `type === 'text'` messages produce records (Requirement 2.4); other
 *    message types are skipped.
 *  - At most {@link MAX_MESSAGES_PER_PAYLOAD} (100) records are returned, even if
 *    the payload carries more text messages (Requirement 2.2).
 *  - Zero-message and status-only payloads produce an empty array
 *    (Requirement 2.5).
 *  - A payload that does not match the expected WhatsApp structure throws a
 *    {@link PayloadParseError} (Requirement 2.6).
 *
 * @throws {PayloadParseError} when the payload structure cannot be parsed.
 */
export function parse(payload: unknown): ParsedMessage[] {
  if (!isObject(payload)) {
    throw new PayloadParseError('Webhook payload is not an object')
  }

  // A WhatsApp Business webhook always identifies itself; anything else is not
  // a payload this parser understands.
  if (payload.object !== 'whatsapp_business_account') {
    throw new PayloadParseError(
      `Unexpected webhook payload object: ${
        isString(payload.object) ? payload.object : typeof payload.object
      }`
    )
  }

  const entries = payload.entry
  if (!Array.isArray(entries)) {
    throw new PayloadParseError('Webhook payload is missing an entry array')
  }

  const results: ParsedMessage[] = []

  for (const entry of entries) {
    if (!isObject(entry)) {
      throw new PayloadParseError('Webhook payload contains a malformed entry')
    }

    const changes = entry.changes
    if (!Array.isArray(changes)) {
      throw new PayloadParseError('Webhook payload entry is missing a changes array')
    }

    for (const change of changes) {
      if (!isObject(change)) {
        throw new PayloadParseError('Webhook payload contains a malformed change')
      }

      const value = change.value
      if (!isObject(value)) {
        // A change without a value object carries nothing to process.
        continue
      }

      const messages = value.messages
      // Status-only / zero-message payloads have no messages array — skip them
      // without error (Requirement 2.5).
      if (messages === undefined) {
        continue
      }
      if (!Array.isArray(messages)) {
        throw new PayloadParseError('Webhook payload messages field is not an array')
      }

      const contacts = value.contacts
      const contact: RawContact | undefined =
        Array.isArray(contacts) && isObject(contacts[0]) ? (contacts[0] as RawContact) : undefined
      const contactName = resolveCustomerName(contact)

      for (const message of messages) {
        if (!isObject(message)) {
          throw new PayloadParseError('Webhook payload contains a malformed message')
        }

        // Only text messages are processed; other types are acknowledged but
        // not extracted (Requirement 2.4).
        if (message.type !== 'text') {
          continue
        }

        const messageId = message.id
        const from = message.from
        const body = isObject(message.text) ? message.text.body : undefined

        if (!isString(messageId) || !isString(from) || !isString(body)) {
          throw new PayloadParseError('Webhook payload contains a malformed text message')
        }

        results.push({
          messageId,
          from,
          text: truncateMessage(body),
          contactName,
        })

        // Stop once the per-payload cap is reached (Requirement 2.2).
        if (results.length >= MAX_MESSAGES_PER_PAYLOAD) {
          return results
        }
      }
    }
  }

  return results
}
