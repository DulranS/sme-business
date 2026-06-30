/**
 * Property-based tests for the Conversation_Engine (history, dedup, persistence).
 *
 * Fully hermetic: all database access in the module under test flows through
 * `withTenantContext` from `./tenant`, which is mocked here with an in-memory
 * row store. No real Postgres is required.
 *
 * The fake `ctx.query` emulates exactly the SQL shapes the engine issues:
 *   - `SELECT history, last_message_id ... WHERE phone_number = $1` (fetchHistory)
 *   - the plain upsert `INSERT ... ON CONFLICT DO UPDATE` (save)
 *   - the guarded upsert `INSERT ... ON CONFLICT DO UPDATE
 *       ... WHERE conversations.last_message_id IS DISTINCT FROM EXCLUDED.last_message_id
 *       RETURNING id` (commitTurn)
 * For the guarded form, an update is only applied (rowCount 1, one id row) when
 * the stored `last_message_id` is DISTINCT FROM the new one (or no row exists);
 * when they are equal the guard fails and the write is a no-op (rowCount 0),
 * leaving the row unchanged — matching Postgres' `IS DISTINCT FROM` semantics.
 *
 * A single in-memory Map keyed by `${tenantId}:${phone}` models the one row per
 * `(tenant_id, phone_number)`, so tenant scoping and the per-conversation
 * uniqueness key are both reflected.
 *
 * Feature: respond-leadz
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5, 5.1, 5.3, 5.4, 5.5, 5.6, 5.7, 14.3
 */

import fc from 'fast-check'
import {
  fetchHistory,
  isDuplicate,
  appendAndTrim,
  save,
  commitTurn,
  HISTORY_CHAR_LIMIT,
  CUSTOMER_MARKER,
  ASSISTANT_MARKER,
} from '@/lib/pipeline/conversation-engine'

// All DB access is mocked so the tests need no database.
jest.mock('@/lib/pipeline/tenant', () => ({
  withTenantContext: jest.fn(),
}))

// Silence structured logging during the run (the engine logs on every save).
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { withTenantContext } from '@/lib/pipeline/tenant'

/** Run a healthy number of generated cases per property (>= 100). */
const RUNS = { numRuns: 200 }

/** A single conversation row, modelling one `conversations` table row. */
interface Row {
  tenant_id: string
  phone_number: string
  customer_name: string
  history: string
  last_message_id: string | null
}

/** In-memory `conversations` store, keyed by `${tenantId}:${phone}`. */
let store: Map<string, Row>
/** Toggles a simulated database failure for the next query. */
let dbConfig: { failQuery: boolean }

/**
 * Build a fake TenantContext whose `query` interprets the three SQL shapes the
 * engine uses against the shared in-memory `store`.
 */
function makeCtx(tenantId: string) {
  return {
    tenantId,
    query: jest.fn(async (text: string, params?: ReadonlyArray<unknown>) => {
      if (dbConfig.failQuery) {
        // Simulate a DB error mid-transaction (rolls back; nothing is written).
        throw new Error('simulated database failure')
      }

      const sql = text.trim()
      const args = (params ?? []) as unknown[]

      // fetchHistory: SELECT history, last_message_id ... WHERE phone_number = $1
      if (sql.startsWith('SELECT history')) {
        const phone = args[0] as string
        const row = store.get(`${tenantId}:${phone}`)
        if (!row) return { rowCount: 0, rows: [] }
        return {
          rowCount: 1,
          rows: [{ history: row.history, last_message_id: row.last_message_id }],
        }
      }

      // save / commitTurn: INSERT INTO conversations ... ON CONFLICT DO UPDATE ...
      if (sql.startsWith('INSERT INTO conversations')) {
        const [tId, phone, customerName, history, lastMessageId] = args as [
          string,
          string,
          string,
          string,
          string,
        ]
        const key = `${tId}:${phone}`
        const existing = store.get(key)
        const guarded = sql.includes('IS DISTINCT FROM')

        if (existing && guarded && existing.last_message_id === lastMessageId) {
          // Guard fails: stored id is NOT DISTINCT FROM the new id -> no-op.
          return { rowCount: 0, rows: [] }
        }

        store.set(key, {
          tenant_id: tId,
          phone_number: phone,
          customer_name: customerName,
          history,
          last_message_id: lastMessageId,
        })
        return { rowCount: 1, rows: [{ id: key }] }
      }

      throw new Error(`Unexpected SQL in fake ctx.query: ${sql}`)
    }),
  }
}

beforeEach(() => {
  store = new Map()
  dbConfig = { failQuery: false }
  ;(withTenantContext as jest.Mock).mockImplementation(
    async (tenantId: string, fn: (ctx: ReturnType<typeof makeCtx>) => unknown) =>
      fn(makeCtx(tenantId))
  )
})

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** A single line of message body: no CR/LF and no `[` so it can never look
 *  like a `[Customer]: ` / `[Assistant]: ` marker line. */
const lineArb = fc.string({ maxLength: 120 }).map((s) => s.replace(/[\r\n[]/g, ' '))

/** A (possibly multi-line) message body that contains no marker boundaries. */
const bodyArb = fc.array(lineArb, { minLength: 1, maxLength: 3 }).map((ls) => ls.join('\n'))

/** A turn = one inbound customer message + one outbound assistant reply. */
const turnArb = fc.record({ inbound: bodyArb, reply: bodyArb })

/** Serialize turns into the engine's whole-message list (oldest first). */
function turnsToMessages(turns: { inbound: string; reply: string }[]): string[] {
  return turns.flatMap((t) => [`${CUSTOMER_MARKER}${t.inbound}`, `${ASSISTANT_MARKER}${t.reply}`])
}

/** Serialize turns into a stored-history string. */
function serialize(turns: { inbound: string; reply: string }[]): string {
  return turnsToMessages(turns).join('\n')
}

/** Split a serialized history back into whole messages (mirrors the engine's
 *  boundary rule). Safe because generated bodies never start a line with a marker. */
function splitMessages(s: string): string[] {
  if (s === '') return []
  return s.split(/\n(?=\[(?:Customer|Assistant)\]: )/)
}

// ---------------------------------------------------------------------------
// Property 8: History ordering, append, and bounded trim (task 10.5)
// ---------------------------------------------------------------------------
// Feature: respond-leadz, Property 8: History ordering, append, and bounded trim
// Validates: Requirements 5.1, 5.3, 5.4
describe('Property 8: History ordering, append, and bounded trim', () => {
  it('appends inbound then reply (newest last) and trims to whole messages only', async () => {
    await fc.assert(
      fc.property(
        fc.array(turnArb, { maxLength: 30 }),
        bodyArb,
        bodyArb,
        (existingTurns, inbound, reply) => {
          const history = serialize(existingTurns)
          const result = appendAndTrim(history, inbound, reply)

          const newCustomer = `${CUSTOMER_MARKER}${inbound}`
          const newAssistant = `${ASSISTANT_MARKER}${reply}`

          // Req 5.3: inbound is appended before the reply, the reply is newest/last.
          expect(result.endsWith(`${newCustomer}\n${newAssistant}`)).toBe(true)

          // Req 5.4: bounded to the limit, unless only the newest turn remains
          // (the engine never trims below the latest exchange).
          if (result.length > HISTORY_CHAR_LIMIT) {
            expect(result).toBe(`${newCustomer}\n${newAssistant}`)
          }

          // Trimming removes WHOLE oldest messages only: the surviving messages
          // are a contiguous suffix of (existing ++ new turn), and the newest
          // turn (its last two messages) is always retained.
          const fullMessages = [...turnsToMessages(existingTurns), newCustomer, newAssistant]
          const resultMessages = splitMessages(result)
          expect(resultMessages.length).toBeGreaterThanOrEqual(2)
          expect(fullMessages.slice(fullMessages.length - resultMessages.length)).toEqual(
            resultMessages
          )

          // No partial leading message: the result begins on a marker boundary.
          expect(/^\[(?:Customer|Assistant)\]: /.test(result)).toBe(true)
        }
      ),
      RUNS
    )
  })

  it('keeps the result at or below the limit whenever more than one turn fits', async () => {
    await fc.assert(
      fc.property(
        // Force a large existing history so trimming actually engages.
        fc.array(turnArb, { minLength: 20, maxLength: 40 }),
        bodyArb,
        bodyArb,
        (existingTurns, inbound, reply) => {
          const result = appendAndTrim(serialize(existingTurns), inbound, reply)
          const newestTurn = `${CUSTOMER_MARKER}${inbound}\n${ASSISTANT_MARKER}${reply}`
          // Either within the limit, or trimmed down to exactly the newest turn.
          expect(result.length <= HISTORY_CHAR_LIMIT || result === newestTurn).toBe(true)
        }
      ),
      RUNS
    )
  })
})

// ---------------------------------------------------------------------------
// Property 6: Deduplication yields exactly one reply (task 10.3)
// ---------------------------------------------------------------------------
// Feature: respond-leadz, Property 6: Deduplication yields exactly one reply
// Validates: Requirements 4.2, 4.4, 4.5, 14.3
describe('Property 6: Deduplication yields exactly one reply', () => {
  const idLikeArb = fc.oneof(
    fc.constant(undefined),
    fc.constant(null),
    fc.constant(''),
    fc.string({ minLength: 1 })
  )

  it('isDuplicate is true iff both ids are non-empty and equal', () => {
    fc.assert(
      fc.property(idLikeArb, idLikeArb, (a, b) => {
        const expected =
          typeof a === 'string' && a !== '' && typeof b === 'string' && b !== '' && a === b
        expect(isDuplicate(a, b)).toBe(expected)
      }),
      RUNS
    )
  })

  it('equal non-empty ids are duplicates; unequal ids are not', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (s) => {
        expect(isDuplicate(s, s)).toBe(true)
      }),
      RUNS
    )
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (a, b) => {
        fc.pre(a !== b)
        expect(isDuplicate(a, b)).toBe(false)
      }),
      RUNS
    )
  })

  it('two concurrent commits with the same new id resolve to exactly one committed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        bodyArb,
        bodyArb,
        async (tenantId, phone, newId, historyA, historyB) => {
          store.clear()
          const paramsA = {
            tenantId,
            phoneNumber: phone,
            customerName: 'A',
            history: historyA,
            lastMessageId: newId,
          }
          const paramsB = {
            tenantId,
            phoneNumber: phone,
            customerName: 'B',
            history: historyB,
            lastMessageId: newId,
          }

          const [resultA, resultB] = await Promise.all([
            commitTurn(paramsA),
            commitTurn(paramsB),
          ])

          // Req 4.4/4.5: exactly one delivery commits; the other is a no-op.
          expect([resultA.committed, resultB.committed].filter(Boolean).length).toBe(1)

          // The conversation advanced once to the shared id, and its history is
          // the winner's (the loser left history unchanged).
          const row = store.get(`${tenantId}:${phone}`)!
          expect(row).toBeDefined()
          expect(row.last_message_id).toBe(newId)
          const winner = resultA.committed ? paramsA : paramsB
          expect(row.history).toBe(winner.history)
        }
      ),
      RUNS
    )
  })
})

// ---------------------------------------------------------------------------
// Property 7: Last-processed id is set only after a successful reply (task 10.4)
// ---------------------------------------------------------------------------
// Feature: respond-leadz, Property 7: Last-processed id is set only after a successful reply
// Validates: Requirements 4.3, 5.7
describe('Property 7: Last-processed id is set only after a successful reply', () => {
  it('advances last_message_id only when the guarded write succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        bodyArb,
        async (tenantId, phone, oldId, newId, history) => {
          store.clear()
          dbConfig.failQuery = false
          store.set(`${tenantId}:${phone}`, {
            tenant_id: tenantId,
            phone_number: phone,
            customer_name: 'x',
            history: 'OLD-HISTORY',
            last_message_id: oldId,
          })

          const result = await commitTurn({
            tenantId,
            phoneNumber: phone,
            customerName: 'x',
            history,
            lastMessageId: newId,
          })
          const row = store.get(`${tenantId}:${phone}`)!

          if (oldId === newId) {
            // Guard fails: not committed, nothing advanced.
            expect(result.committed).toBe(false)
            expect(row.last_message_id).toBe(oldId)
            expect(row.history).toBe('OLD-HISTORY')
          } else {
            // Guard passes: id and history both advance.
            expect(result.committed).toBe(true)
            expect(row.last_message_id).toBe(newId)
            expect(row.history).toBe(history)
          }
        }
      ),
      RUNS
    )
  })

  it('does NOT advance last_message_id when the underlying write fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        bodyArb,
        async (tenantId, phone, oldId, newId, history) => {
          store.clear()
          store.set(`${tenantId}:${phone}`, {
            tenant_id: tenantId,
            phone_number: phone,
            customer_name: 'x',
            history: 'OLD-HISTORY',
            last_message_id: oldId,
          })

          dbConfig.failQuery = true
          await expect(
            commitTurn({
              tenantId,
              phoneNumber: phone,
              customerName: 'x',
              history,
              lastMessageId: newId,
            })
          ).rejects.toBeDefined()

          // Req 5.7: the stored id is unchanged after a failed write.
          const row = store.get(`${tenantId}:${phone}`)!
          expect(row.last_message_id).toBe(oldId)
          expect(row.history).toBe('OLD-HISTORY')
        }
      ),
      RUNS
    )
  })
})

// ---------------------------------------------------------------------------
// Property 9: Conversation persistence round-trip keyed by tenant and phone (task 10.6)
// ---------------------------------------------------------------------------
// Feature: respond-leadz, Property 9: Conversation persistence round-trip keyed by tenant and phone
// Validates: Requirements 5.5, 5.6
describe('Property 9: Conversation persistence round-trip keyed by tenant and phone', () => {
  it('save then fetchHistory returns the same history and lastMessageId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string(),
        fc.string({ minLength: 1 }),
        async (tenantId, phone, customerName, history, lastMessageId) => {
          store.clear()
          await save({ tenantId, phoneNumber: phone, customerName, history, lastMessageId })
          const loaded = await fetchHistory(tenantId, phone)
          expect(loaded.history).toBe(history)
          expect(loaded.lastMessageId).toBe(lastMessageId)
        }
      ),
      RUNS
    )
  })

  it('different (tenant, phone) keys do not collide', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string(),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (t1, p1, t2, p2, h1, h2, id1, id2) => {
          fc.pre(`${t1}:${p1}` !== `${t2}:${p2}`)
          store.clear()

          await save({ tenantId: t1, phoneNumber: p1, customerName: 'a', history: h1, lastMessageId: id1 })
          await save({ tenantId: t2, phoneNumber: p2, customerName: 'b', history: h2, lastMessageId: id2 })

          const r1 = await fetchHistory(t1, p1)
          const r2 = await fetchHistory(t2, p2)

          expect(r1.history).toBe(h1)
          expect(r1.lastMessageId).toBe(id1)
          expect(r2.history).toBe(h2)
          expect(r2.lastMessageId).toBe(id2)
        }
      ),
      RUNS
    )
  })
})
