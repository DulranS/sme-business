/**
 * Conversation_Engine — conversation memory for the canonical RespondLeadz
 * pipeline: history fetch, append-and-trim, and tenant-scoped persistence.
 *
 * This module owns the durable conversation memory required by Requirement 5.
 * A conversation is a single row in the `conversations` table, keyed uniquely by
 * `(tenant_id, phone_number)` (Requirement 5.5, migration 006). Its `history`
 * column stores the ordered turns exchanged with one customer as a single text
 * value, oldest turn first and newest turn last (Requirement 5.1).
 *
 * Each turn is serialized as two whole messages — one inbound customer message
 * and one outbound assistant reply — using the line markers `[Customer]: ` and
 * `[Assistant]: `, matching the format already produced by the legacy webhook so
 * existing stored histories parse cleanly. {@link appendAndTrim} treats those
 * markers as message boundaries so trimming only ever removes whole messages,
 * never a partial one (Requirements 5.3, 5.4).
 *
 * All reads and writes run inside {@link withTenantContext}, so Row Level
 * Security scopes every row to the current tenant: a conversation owned by
 * another tenant is never visible or writable here (Requirements 12.2, 12.6).
 *
 * Deduplication and the conditional `last_message_id` write (Requirement 4 and
 * 5.7) are layered on top of these primitives. {@link fetchHistory} returns the
 * stored `lastMessageId` so a cheap sequential duplicate check
 * ({@link isDuplicate}) can run before any LLM request, and {@link commitTurn}
 * performs the guarded conditional write that advances `last_message_id` only
 * after a reply has been sent — resolving concurrent duplicate deliveries to a
 * single committed turn.
 *
 * The Idempotency_Key for an inbound message is the WhatsApp message id
 * (Requirement 4.1). The caller establishes it before issuing any LLM request
 * and uses {@link isDuplicate} to short-circuit already-processed messages.
 *
 * Feature: respond-leadz
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 14.3
 */

import { withTenantContext } from './tenant'
import { logger } from '../logger'

/**
 * Maximum number of characters the stored conversation history may occupy.
 * While the serialized history exceeds this, {@link appendAndTrim} removes whole
 * oldest messages until it is at most this length (Requirement 5.4).
 */
export const HISTORY_CHAR_LIMIT = 4000

/** Line marker that begins an inbound customer message in the serialized history. */
export const CUSTOMER_MARKER = '[Customer]: '

/** Line marker that begins an outbound assistant reply in the serialized history. */
export const ASSISTANT_MARKER = '[Assistant]: '

/**
 * Matches the start of a whole message in the serialized history. A line that
 * begins with one of these markers starts a new message; any following lines
 * (e.g. a multi-line message body) belong to that same message until the next
 * marker. Trimming therefore operates on whole messages only.
 */
const MESSAGE_BOUNDARY_RE = /^\[(?:Customer|Assistant)\]: /

/** The result of loading a conversation's stored memory. */
export interface ConversationHistory {
  /** Serialized history, ordered oldest message first (Requirement 5.1). Empty when none exists. */
  history: string
  /** Most recently processed message id, used for deduplication (Requirement 4). */
  lastMessageId?: string
}

/** The fields persisted for a conversation (Requirement 5.6). */
export interface SaveConversationParams {
  /** Owning tenant UUID; establishes the RLS context and is stored on the row. */
  tenantId: string
  /** Customer phone number; together with `tenantId` is the conversation key (Requirement 5.5). */
  phoneNumber: string
  /** Customer display name (defaults applied upstream by the parser). */
  customerName: string
  /** Serialized, trimmed conversation history to store (Requirement 5.4). */
  history: string
  /** Most recently processed message id to store (Requirement 4.3 / 5.6). */
  lastMessageId: string
}

/**
 * Split a serialized history into its whole messages. Each returned element is
 * one complete message (its marker line plus any continuation lines). A blank or
 * missing history yields an empty list. Legacy content that does not begin with
 * a marker is treated as a single leading message so it is never split mid-text.
 */
function splitIntoMessages(history: string): string[] {
  if (!history) return []

  const lines = history.split('\n')
  const messages: string[] = []
  let current: string[] | null = null

  for (const line of lines) {
    if (MESSAGE_BOUNDARY_RE.test(line)) {
      if (current) messages.push(current.join('\n'))
      current = [line]
    } else if (current) {
      current.push(line)
    } else {
      // Content before any marker (legacy/unmarked history): keep it whole.
      current = [line]
    }
  }
  if (current) messages.push(current.join('\n'))

  return messages
}

/**
 * Retrieve the existing conversation history for `phone` within the current
 * tenant, ordered oldest message to newest (Requirement 5.1). The stored
 * `history` column is already serialized oldest-first, so loading it preserves
 * that order.
 *
 * If retrieval fails for any reason, the failure is logged and the history is
 * treated as empty for the remainder of processing (Requirement 5.2) — the
 * caller receives `{ history: '' }` rather than an exception.
 *
 * @param tenantId The owning tenant's UUID; establishes the RLS context.
 * @param phone    The customer phone number to look up.
 * @returns The stored history and last processed message id, or empty on miss/failure.
 */
export async function fetchHistory(
  tenantId: string,
  phone: string
): Promise<ConversationHistory> {
  try {
    return await withTenantContext(tenantId, async (ctx) => {
      const result = await ctx.query<{ history: string | null; last_message_id: string | null }>(
        `SELECT history, last_message_id
           FROM conversations
          WHERE phone_number = $1
          LIMIT 1`,
        [phone]
      )

      if (result.rowCount === 0) {
        // No conversation yet for this (tenant, phone); start from empty memory.
        return { history: '' }
      }

      const row = result.rows[0]
      return {
        history: row.history ?? '',
        lastMessageId: row.last_message_id ?? undefined,
      }
    })
  } catch (error) {
    // Requirement 5.2: log the retrieval failure and treat history as empty.
    logger.error(
      'Failed to fetch conversation history; treating history as empty',
      { type: 'conversation', tenantId, phone },
      error as Error
    )
    return { history: '' }
  }
}

/**
 * Decide whether an inbound message is a duplicate of the one most recently
 * processed for its Conversation (Requirement 4.2). The Idempotency_Key of an
 * inbound message is its WhatsApp message id; a message is a duplicate when that
 * id is present and byte-for-byte equal to the Conversation's stored
 * `last_message_id`.
 *
 * This is the cheap, sequential dedup gate the caller runs *before* issuing any
 * LLM request: when it returns `true` the caller must discard the message
 * without calling the LLM, sending a reply, or modifying history, and simply
 * acknowledge the webhook (Requirements 4.2, 4.4, 14.3). Concurrent duplicates
 * that both pass this gate are resolved later by {@link commitTurn}'s guarded
 * write (Requirement 4.5).
 *
 * A missing/empty `messageId` or a Conversation with no stored `lastMessageId`
 * is never treated as a duplicate, so first-contact messages are always
 * processed.
 *
 * @param messageId     The inbound message's Idempotency_Key (WhatsApp message id).
 * @param lastMessageId The Conversation's most recently processed message id, if any.
 * @returns `true` when the message has already been processed and must be discarded.
 */
export function isDuplicate(
  messageId: string | null | undefined,
  lastMessageId: string | null | undefined
): boolean {
  if (typeof messageId !== 'string' || messageId === '') return false
  if (typeof lastMessageId !== 'string' || lastMessageId === '') return false
  return messageId === lastMessageId
}

/**
 * Append a new turn (the inbound customer message followed by the outbound
 * reply) to the end of `history`, then trim the result so it is at most
 * {@link HISTORY_CHAR_LIMIT} characters by removing whole oldest messages
 * (Requirements 5.3, 5.4).
 *
 * The inbound message is appended before the reply so the stored order remains
 * oldest→newest. Trimming removes complete messages from the front only; it
 * never cuts a message in half and always retains the newest turn (the just
 * appended inbound + reply pair).
 *
 * @param history Existing serialized history (may be empty).
 * @param inbound The inbound customer message text.
 * @param reply   The outbound assistant reply text.
 * @returns The new serialized history, ordered oldest→newest and trimmed.
 */
export function appendAndTrim(history: string, inbound: string, reply: string): string {
  const messages = splitIntoMessages(history)

  // Requirement 5.3: append inbound, then the reply, to the end (newest last).
  messages.push(`${CUSTOMER_MARKER}${inbound}`)
  messages.push(`${ASSISTANT_MARKER}${reply}`)

  // Requirement 5.4: while over the limit, drop whole oldest messages. Keep the
  // newest turn (the last two messages) intact so the latest exchange is never
  // lost to trimming.
  while (messages.length > 2 && messages.join('\n').length > HISTORY_CHAR_LIMIT) {
    messages.shift()
  }

  return messages.join('\n')
}

/**
 * Persist a conversation's phone number, customer name, history, and most
 * recently processed message id, keyed by `(tenant_id, phone_number)`
 * (Requirements 5.5, 5.6). Creates the conversation when none exists for the
 * key and updates it otherwise, in a single tenant-scoped upsert.
 *
 * The write runs inside {@link withTenantContext}; RLS `WITH CHECK` guarantees
 * the stored `tenant_id` is the active tenant, so a conversation can only ever
 * be written for the owning tenant (Requirements 12.2, 12.6).
 *
 * This function persists whatever `lastMessageId` it is given. The policy of
 * advancing `last_message_id` only after a reply has been sent and this save has
 * succeeded (Requirements 4.3, 5.7) is enforced by the caller in task 10.2; on
 * any failure here this function throws so the caller can decline to advance it.
 *
 * @param params The conversation fields to store.
 */
export async function save(params: SaveConversationParams): Promise<void> {
  const { tenantId, phoneNumber, customerName, history, lastMessageId } = params

  await withTenantContext(tenantId, async (ctx) => {
    await ctx.query(
      `INSERT INTO conversations
              (tenant_id, phone_number, customer_name, history, last_message_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id, phone_number)
       DO UPDATE SET customer_name   = EXCLUDED.customer_name,
                     history         = EXCLUDED.history,
                     last_message_id = EXCLUDED.last_message_id,
                     updated_at      = NOW()`,
      [tenantId, phoneNumber, customerName, history, lastMessageId]
    )
  })

  logger.info('Conversation persisted', {
    type: 'conversation',
    tenantId,
    phone: phoneNumber,
    historyLength: history.length,
  })
}

/** The outcome of a guarded conversation commit (see {@link commitTurn}). */
export interface CommitTurnResult {
  /**
   * `true` when this delivery's turn was the one persisted (it advanced
   * `last_message_id` to the new Idempotency_Key). `false` when a concurrent
   * delivery carrying the same Idempotency_Key had already committed it, so this
   * delivery is a (concurrent) duplicate: its write was a no-op and the
   * Conversation history was left unchanged (Requirements 4.4, 4.5).
   */
  committed: boolean
}

/**
 * Persist a completed turn with a guarded conditional write that advances
 * `last_message_id` to the new Idempotency_Key only when it differs from the id
 * already stored for the Conversation, keyed by `(tenant_id, phone_number)`
 * (Requirements 4.3, 4.5, 5.5, 5.6, 5.7).
 *
 * This is the write the caller performs **after** a reply has been sent. Because
 * the advance is guarded by `last_message_id IS DISTINCT FROM` the new id and
 * the row is uniquely keyed by `(tenant_id, phone_number)`, two deliveries
 * carrying the same Idempotency_Key processed concurrently serialize on the row:
 * the first commits the new history and id and reports `committed: true`; the
 * second re-evaluates the guard against the now-equal id, updates no row, leaves
 * the history unchanged, and reports `committed: false`. Concurrent duplicates
 * therefore resolve to exactly one committed turn (Requirement 4.5).
 *
 * The write runs inside {@link withTenantContext}; RLS `WITH CHECK` guarantees
 * the stored `tenant_id` is the active tenant, so a Conversation can only ever be
 * written for its owning tenant (Requirements 12.2, 12.6).
 *
 * On any database failure this function throws (the transaction rolls back, so
 * `last_message_id` is not advanced); the caller logs the failure and declines
 * to mark the message processed (Requirement 5.7).
 *
 * @param params The conversation fields to store, including the new Idempotency_Key.
 * @returns Whether this delivery committed the turn (`false` for a concurrent duplicate).
 */
export async function commitTurn(params: SaveConversationParams): Promise<CommitTurnResult> {
  const { tenantId, phoneNumber, customerName, history, lastMessageId } = params

  const committed = await withTenantContext(tenantId, async (ctx) => {
    // Insert a fresh conversation, or — when one already exists for this
    // (tenant, phone) — advance it only if the new Idempotency_Key differs from
    // the stored one. The guard makes the second of two concurrent duplicate
    // deliveries a no-op (RETURNING yields no row), so exactly one turn commits.
    const result = await ctx.query(
      `INSERT INTO conversations
              (tenant_id, phone_number, customer_name, history, last_message_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id, phone_number)
       DO UPDATE SET customer_name   = EXCLUDED.customer_name,
                     history         = EXCLUDED.history,
                     last_message_id = EXCLUDED.last_message_id,
                     updated_at      = NOW()
                WHERE conversations.last_message_id IS DISTINCT FROM EXCLUDED.last_message_id
       RETURNING id`,
      [tenantId, phoneNumber, customerName, history, lastMessageId]
    )
    return (result.rowCount ?? 0) > 0
  })

  if (committed) {
    logger.info('Conversation turn committed', {
      type: 'conversation',
      tenantId,
      phone: phoneNumber,
      lastMessageId,
      historyLength: history.length,
    })
  } else {
    // A concurrent delivery with the same Idempotency_Key already committed this
    // turn; this one is discarded and the history is left unchanged (Req 4.5).
    logger.info('Conversation turn skipped; concurrent duplicate already committed', {
      type: 'conversation',
      tenantId,
      phone: phoneNumber,
      lastMessageId,
    })
  }

  return { committed }
}
