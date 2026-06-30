/**
 * Tests for the WebhookParser (`lib/pipeline/parser.ts`).
 *
 * Covers tasks 4.2–4.5 of the respond-leadz spec:
 *  - Property 3: Message extraction and count cap (Req 2.2, 2.4, 2.5)
 *  - Property 4: Message truncation is a bounded prefix (Req 2.3)
 *  - Property 5: Customer name defaulting (Req 2.7)
 *  - Unit tests for parser edge cases (Req 2.5, 2.6)
 *
 * Property tests use fast-check with >= 100 generated cases. All tests are
 * hermetic (no network, no database).
 *
 * Feature: respond-leadz
 */

import fc from 'fast-check'
import {
  parse,
  truncateMessage,
  resolveCustomerName,
  MAX_MESSAGES_PER_PAYLOAD,
  MAX_MESSAGE_LENGTH,
  DEFAULT_CUSTOMER_NAME,
} from '@/lib/pipeline/parser'
import { PayloadParseError } from '@/lib/pipeline/errors'

const NUM_RUNS = 100

// --- Shared helpers -------------------------------------------------------

/** Build a canonical WhatsApp webhook payload around a single change value. */
function buildPayload(value: unknown): unknown {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: 'entry-0', changes: [{ field: 'messages', value }] }],
  }
}

/** A non-whitespace token generator (no leading/trailing/internal whitespace). */
const cleanToken = fc
  .string({ minLength: 1, maxLength: 20 })
  .map((s) => s.replace(/\s/g, 'x'))
  .filter((s) => s.length > 0)

/** A well-formed WhatsApp text message. */
const textMessageArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 24 }).map((s) => `wamid.${s}`),
  from: fc.string({ minLength: 6, maxLength: 15 }).map((s) => s.replace(/\D/g, '5') || '15550000000'),
  type: fc.constant('text'),
  text: fc.record({ body: fc.string({ minLength: 0, maxLength: 50 }) }),
})

/** A non-text message: any message whose `type` is not 'text'. */
const nonTextMessageArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 24 }).map((s) => `wamid.${s}`),
  from: fc.string({ minLength: 6, maxLength: 15 }).map((s) => s.replace(/\D/g, '5') || '15550000000'),
  type: fc.constantFrom(
    'image',
    'audio',
    'video',
    'document',
    'sticker',
    'location',
    'contacts',
    'button',
    'interactive',
    'reaction',
    'system',
    'unknown'
  ),
  // Arbitrary extra payload that the parser must ignore for non-text messages.
  caption: fc.option(fc.string(), { nil: undefined }),
})

// =========================================================================
// Property 3: Message extraction and count cap (task 4.2; Req 2.2, 2.4, 2.5)
// =========================================================================

describe('parse — Property 3: message extraction and count cap', () => {
  // Feature: respond-leadz, Property 3: Message extraction and count cap
  it('produces exactly one record per text message (capped at 100), excluding non-text messages', () => {
    // A tagged item is either a text message or a non-text message; we preserve
    // ordering so we can assert the extracted records line up with the inputs.
    const itemArb = fc.oneof(
      textMessageArb.map((m) => ({ kind: 'text' as const, m })),
      nonTextMessageArb.map((m) => ({ kind: 'other' as const, m }))
    )

    // Optional contact so we can assert the resolved contact name is carried.
    const contactArb = fc.oneof(
      fc.constant({ contacts: undefined as unknown, expectedName: DEFAULT_CUSTOMER_NAME }),
      cleanToken.map((name) => ({
        contacts: [{ profile: { name: { first_name: name } } }] as unknown,
        expectedName: name,
      }))
    )

    fc.assert(
      fc.property(
        // maxLength > 100 so the per-payload cap is regularly exercised.
        fc.array(itemArb, { minLength: 0, maxLength: 130 }),
        contactArb,
        (items, contact) => {
          const messages = items.map((i) => i.m)
          const value: Record<string, unknown> = { messaging_product: 'whatsapp', messages }
          if (contact.contacts !== undefined) {
            value.contacts = contact.contacts
          }

          const result = parse(buildPayload(value))

          const textInputs = items.filter((i) => i.kind === 'text').map((i) => i.m)
          const expectedCount = Math.min(textInputs.length, MAX_MESSAGES_PER_PAYLOAD)

          // One record per text message, capped at 100, never more.
          expect(result.length).toBe(expectedCount)
          expect(result.length).toBeLessThanOrEqual(MAX_MESSAGES_PER_PAYLOAD)

          // Records correspond, in order, to the first <=100 text messages and
          // carry id, phone, (truncated) text, and contact name.
          for (let i = 0; i < expectedCount; i++) {
            const src = textInputs[i]
            const rec = result[i]
            expect(rec.messageId).toBe(src.id)
            expect(rec.from).toBe(src.from)
            expect(rec.text).toBe(truncateMessage(src.text.body))
            expect(rec.contactName).toBe(contact.expectedName)
          }
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  // Feature: respond-leadz, Property 3: Message extraction and count cap
  it('returns [] for status-only and zero-message payloads', () => {
    const emptyValueArb = fc.oneof(
      // Zero-message payload.
      fc.constant({ messaging_product: 'whatsapp', messages: [] as unknown[] }),
      // Status-only payload: a statuses array and no messages key at all.
      fc.array(fc.record({ id: cleanToken, status: fc.constantFrom('sent', 'delivered', 'read') }), {
        minLength: 0,
        maxLength: 5,
      }).map((statuses) => ({ messaging_product: 'whatsapp', statuses })),
      // Change value with no messages and no statuses.
      fc.constant({ messaging_product: 'whatsapp' })
    )

    fc.assert(
      fc.property(emptyValueArb, (value) => {
        expect(parse(buildPayload(value))).toEqual([])
      }),
      { numRuns: NUM_RUNS }
    )
  })
})

// =========================================================================
// Property 4: Message truncation is a bounded prefix (task 4.3; Req 2.3)
// =========================================================================

describe('truncateMessage — Property 4: bounded prefix', () => {
  // Feature: respond-leadz, Property 4: Message truncation is a bounded prefix
  it('returns a <=4096-char prefix of the input, equal to the input when within the limit', () => {
    fc.assert(
      fc.property(
        // Range straddles the 4096 boundary so both branches are exercised.
        fc.string({ minLength: 0, maxLength: MAX_MESSAGE_LENGTH * 2 }),
        (text) => {
          const result = truncateMessage(text)

          // Bounded length.
          expect(result.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH)
          // Prefix of the input.
          expect(text.startsWith(result)).toBe(true)
          expect(result).toBe(text.slice(0, MAX_MESSAGE_LENGTH))
          // Identity when within the limit.
          if (text.length <= MAX_MESSAGE_LENGTH) {
            expect(result).toBe(text)
          }
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('truncates an over-length input to exactly the limit (unit)', () => {
    const long = 'a'.repeat(MAX_MESSAGE_LENGTH + 500)
    const result = truncateMessage(long)
    expect(result.length).toBe(MAX_MESSAGE_LENGTH)
    expect(result).toBe('a'.repeat(MAX_MESSAGE_LENGTH))
  })

  it('returns the input unchanged at exactly the limit (unit)', () => {
    const exact = 'b'.repeat(MAX_MESSAGE_LENGTH)
    expect(truncateMessage(exact)).toBe(exact)
  })
})

// =========================================================================
// Property 5: Customer name defaulting (task 4.4; Req 2.7)
// =========================================================================

describe('resolveCustomerName — Property 5: customer name defaulting', () => {
  const whitespacePart = fc.constantFrom('', ' ', '   ', '\t', '\n', ' \t\n ')

  // Feature: respond-leadz, Property 5: Customer name defaulting
  it("returns 'Unknown' for absent, empty, or whitespace-only names", () => {
    // Contacts whose name resolves to nothing usable.
    const unusableContactArb = fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.constant({}),
      fc.constant({ profile: null }),
      fc.constant({ profile: {} }),
      fc.constant({ profile: { name: null } }),
      // A name object whose every present part is whitespace-only or absent.
      fc
        .record(
          {
            first_name: fc.option(whitespacePart, { nil: undefined }),
            last_name: fc.option(whitespacePart, { nil: undefined }),
            formatted_name: fc.option(whitespacePart, { nil: undefined }),
          },
          { requiredKeys: [] }
        )
        .map((name) => ({ profile: { name } }))
    )

    fc.assert(
      fc.property(unusableContactArb, (contact) => {
        expect(resolveCustomerName(contact as never)).toBe(DEFAULT_CUSTOMER_NAME)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  // Feature: respond-leadz, Property 5: Customer name defaulting
  it('returns the non-empty trimmed name when a usable name part is present', () => {
    const pad = (token: string) =>
      fc.tuple(whitespacePart, whitespacePart).map(([l, r]) => `${l}${token}${r}`)

    // Each scenario yields the name object plus the expected resolved value.
    const namedScenarioArb = fc.oneof(
      // first_name only.
      cleanToken.chain((t) => pad(t).map((raw) => ({ name: { first_name: raw }, expected: t }))),
      // last_name only.
      cleanToken.chain((t) => pad(t).map((raw) => ({ name: { last_name: raw }, expected: t }))),
      // formatted_name only.
      cleanToken.chain((t) => pad(t).map((raw) => ({ name: { formatted_name: raw }, expected: t }))),
      // first + last (clean tokens) -> "first last".
      fc.tuple(cleanToken, cleanToken).map(([f, l]) => ({
        name: { first_name: f, last_name: l },
        expected: `${f} ${l}`,
      }))
    )

    fc.assert(
      fc.property(namedScenarioArb, ({ name, expected }) => {
        const resolved = resolveCustomerName({ profile: { name } } as never)
        expect(resolved).toBe(expected)
        // The resolved name is a non-empty, fully-trimmed value.
        expect(resolved.length).toBeGreaterThan(0)
        expect(resolved).toBe(resolved.trim())
      }),
      { numRuns: NUM_RUNS }
    )
  })
})

// =========================================================================
// Unit tests — parser edge cases (task 4.5; Req 2.5, 2.6)
// =========================================================================

describe('parse — edge cases (Req 2.5, 2.6)', () => {
  describe('garbage / structurally-invalid payloads throw PayloadParseError (Req 2.6)', () => {
    const garbage: Array<[string, unknown]> = [
      ['null', null],
      ['undefined', undefined],
      ['number', 42],
      ['string', 'not a payload'],
      ['boolean', true],
      ['top-level array', []],
      ['empty object', {}],
      ['wrong object field', { object: 'instagram', entry: [] }],
      ['missing entry array', { object: 'whatsapp_business_account' }],
      ['entry not an array', { object: 'whatsapp_business_account', entry: {} }],
      [
        'malformed entry element',
        { object: 'whatsapp_business_account', entry: ['nope'] },
      ],
      [
        'entry missing changes array',
        { object: 'whatsapp_business_account', entry: [{ id: 'e' }] },
      ],
      [
        'changes not an array',
        { object: 'whatsapp_business_account', entry: [{ changes: {} }] },
      ],
      [
        'malformed change element',
        { object: 'whatsapp_business_account', entry: [{ changes: ['nope'] }] },
      ],
      ['messages not an array', buildPayload({ messages: 'nope' })],
      [
        'malformed message element',
        buildPayload({ messages: ['nope'] }),
      ],
      [
        'text message missing body',
        buildPayload({ messages: [{ id: 'wamid.1', from: '15550001111', type: 'text', text: {} }] }),
      ],
      [
        'text message missing id',
        buildPayload({ messages: [{ from: '15550001111', type: 'text', text: { body: 'hi' } }] }),
      ],
      [
        'text message missing from',
        buildPayload({ messages: [{ id: 'wamid.1', type: 'text', text: { body: 'hi' } }] }),
      ],
      [
        'text message with non-object text',
        buildPayload({ messages: [{ id: 'wamid.1', from: '15550001111', type: 'text', text: 'hi' }] }),
      ],
    ]

    it.each(garbage)('throws PayloadParseError for %s', (_label, payload) => {
      expect(() => parse(payload)).toThrow(PayloadParseError)
    })
  })

  describe('zero-message and status-only payloads return [] (Req 2.5)', () => {
    it('returns [] for a zero-message payload', () => {
      expect(parse(buildPayload({ messaging_product: 'whatsapp', messages: [] }))).toEqual([])
    })

    it('returns [] for a status-only payload (no messages key)', () => {
      const value = {
        messaging_product: 'whatsapp',
        statuses: [{ id: 'wamid.1', status: 'delivered', recipient_id: '15550001111' }],
      }
      expect(parse(buildPayload(value))).toEqual([])
    })

    it('returns [] when a change carries no value object', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ id: 'e', changes: [{ field: 'messages' }] }],
      }
      expect(parse(payload)).toEqual([])
    })

    it('returns [] when only non-text messages are present', () => {
      const value = {
        messaging_product: 'whatsapp',
        messages: [
          { id: 'wamid.1', from: '15550001111', type: 'image' },
          { id: 'wamid.2', from: '15550001111', type: 'audio' },
        ],
      }
      expect(parse(buildPayload(value))).toEqual([])
    })
  })

  it('extracts a single well-formed text message end to end', () => {
    const value = {
      messaging_product: 'whatsapp',
      contacts: [{ profile: { name: { first_name: 'Ada', last_name: 'Lovelace' } } }],
      messages: [{ id: 'wamid.ABC', from: '15551234567', type: 'text', text: { body: 'hello there' } }],
    }
    expect(parse(buildPayload(value))).toEqual([
      { messageId: 'wamid.ABC', from: '15551234567', text: 'hello there', contactName: 'Ada Lovelace' },
    ])
  })
})
