# Implementation Plan: RespondLeadz

## Overview

This plan consolidates the existing RespondLeadz codebase into a single canonical TypeScript/Next.js
pipeline and implements the multi-tenant, cost-controlled, observable WhatsApp sales pipeline defined
in the design. Work proceeds bottom-up: database/RLS foundation and shared utilities first, then pure
pipeline modules (signature, parser, dedup, trimming, inventory rendering, retry, close detection),
then orchestration and wiring through the single webhook endpoint, lifecycle cron, interop adapters,
and finally the consolidation cleanup that retires the competing variants.

All code lives in the canonical app at `respond-leads/`. New pipeline modules go under
`respond-leads/lib/pipeline/`. Property-based tests use `fast-check` with the existing Jest runner and
each property test is tagged `// Feature: respond-leadz, Property {n}: {text}` and runs ≥ 100 cases.

## Tasks

- [ ] 1. Establish database foundation, RLS, and shared types
  - [x] 1.1 Create multi-tenant schema migration
    - Add migration creating `tenants`, `close_events`, `follow_up_actions`, `customer_consent`,
      `inbound_queue` tables and migrating `inventory` and `conversations` to add `tenant_id`
    - Set unique keys `(tenant_id, sku)` on inventory and `(tenant_id, phone_number)` on conversations
    - File: `respond-leads/supabase/migrations/006_multi_tenant_schema.sql`
    - _Requirements: 5.5, 5.6, 9.3, 9.4, 9.5, 10.4, 18.1, 18.4, 12.1_

  - [-] 1.2 Add RLS policies and FORCE ROW LEVEL SECURITY migration
    - Enable and force RLS on all tenant-scoped tables; add `tenant_isolation` USING/WITH CHECK
      policies keyed on `current_setting('app.current_tenant', true)::uuid`
    - Create a non-superuser tenant role used for tenant-scoped access
    - File: `respond-leads/supabase/migrations/007_tenant_rls_policies.sql`
    - _Requirements: 12.2, 12.3, 12.4, 12.6_

  - [x] 1.3 Define core domain types and typed errors
    - Add `Tenant`, `ParsedMessage`, `InventoryItem`, `Conversation`, `CloseEvent`, `FollowUpAction`
      types and typed errors `PayloadParseError`, `SignatureError`, `ConfigError`, `LlmError`,
      `DeliveryError`, `TenantContextError`
    - Files: `respond-leads/lib/pipeline/types.ts`, `respond-leads/lib/pipeline/errors.ts`
    - _Requirements: 2.6, 3.2, 8.1, 9.2, 12.4, 17.3_

- [ ] 2. Implement startup configuration validation and structured logging
  - [-] 2.1 Implement ConfigValidator
    - `validateStartup()` verifies all required env values are present/non-empty, reports a named
      error for each missing value, and keeps the app in a state that refuses webhooks until resolved
    - File: `respond-leads/lib/config.ts`
    - _Requirements: 1.1, 1.7, 19.1, 19.2, 19.3, 13.1, 13.2_

  - [-] 2.2 Implement structured Logger with credential redaction
    - Emit error/warn/info levels; per-message entries include tenant, phone, message id, outcome;
      serialize credentials by name only, never their values
    - File: `respond-leads/lib/logger.ts`
    - _Requirements: 13.3, 17.1, 17.2_

  - [ ]* 2.3 Write property test for log credential redaction
    - **Property 25: Logs never contain credential values**
    - **Validates: Requirements 13.3**

  - [ ]* 2.4 Write unit tests for ConfigValidator startup failures
    - Test missing/empty credential subsets produce named errors and refuse-webhook state
    - _Requirements: 1.7, 19.2_

- [ ] 3. Implement SignatureVerifier
  - [-] 3.1 Implement HMAC-SHA256 signing and constant-time verification
    - `computeSignature(rawBody, appSecret)` returns `sha256=<hex>`; `verify(rawBody, header, appSecret)`
      uses a constant-time comparison; returns false for missing/empty/malformed header or empty secret
    - File: `respond-leads/lib/pipeline/signature.ts`
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.2 Write property test for signature round-trip and tamper rejection
    - **Property 2: Signature round-trip and tamper rejection**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6**

- [ ] 4. Implement WebhookParser
  - [-] 4.1 Implement payload parsing, truncation, and name resolution
    - `parse(payload)` extracts one record per text message (cap 100) with message id, phone, text,
      contact name; non-text and zero-message payloads yield empty set; unparseable payloads throw
      `PayloadParseError`; `truncateMessage` caps at 4096 chars; `resolveCustomerName` returns
      "Unknown" for absent/empty/whitespace names
    - File: `respond-leads/lib/pipeline/parser.ts`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 4.2 Write property test for message extraction and count cap
    - **Property 3: Message extraction and count cap**
    - **Validates: Requirements 2.2, 2.4, 2.5**

  - [ ]* 4.3 Write property test for message truncation
    - **Property 4: Message truncation is a bounded prefix**
    - **Validates: Requirements 2.3**

  - [ ]* 4.4 Write property test for customer name defaulting
    - **Property 5: Customer name defaulting**
    - **Validates: Requirements 2.7**

  - [ ]* 4.5 Write unit tests for parser edge cases
    - Test garbage payloads (2.6) and zero-message/status-only payloads (2.5)
    - _Requirements: 2.5, 2.6_

- [ ] 5. Implement Tenant_Manager and RLS-scoped access
  - [-] 5.1 Implement tenant context, resolution, and RLS probe
    - `resolveTenant(phoneNumberId)` returns owning tenant or null; `withTenantContext(tenantId, fn)`
      opens a transaction, runs `SET LOCAL app.current_tenant`, executes `fn` on the RLS-enforced
      non-superuser connection; `assertRlsEnabled()` startup probe denies tenant-scoped ops if RLS off;
      per-tenant credentials read only within owning context
    - File: `respond-leads/lib/pipeline/tenant.ts`
    - _Requirements: 12.1, 12.2, 12.4, 12.5, 12.6, 13.4_

  - [ ]* 5.2 Write property test for tenant resolution from phone number id
    - **Property 24: Tenant resolution from phone number id**
    - **Validates: Requirements 12.5**

  - [ ]* 5.3 Write property test for record tenant association
    - **Property 21: Every record is tenant-associated**
    - **Validates: Requirements 12.1**

  - [ ]* 5.4 Write property test for tenant isolation on read and write
    - **Property 22: Tenant isolation on read and write** (runs against Postgres test DB with RLS)
    - **Validates: Requirements 12.2, 12.6, 13.4**

  - [ ]* 5.5 Write property test for no-tenant-context denial
    - **Property 23: No tenant context denies all access** (runs against Postgres test DB with RLS)
    - **Validates: Requirements 12.4**

- [~] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement Inventory_Service
  - [~] 7.1 Implement tenant-scoped inventory search
    - `search(tenantId, keyword)` returns at most 5 active items belonging to the requesting tenant,
      targeting < 1s latency
    - File: `respond-leads/lib/pipeline/inventory.ts`
    - _Requirements: 6.2, 15.4, 16.3_

  - [ ]* 7.2 Write property test for tenant-scoped bounded inventory search
    - **Property 10: Inventory search is tenant-scoped and bounded**
    - **Validates: Requirements 6.2**

- [ ] 8. Implement AI_Responder over a single LLM provider
  - [~] 8.1 Implement LlmProvider abstraction and inventory context rendering
    - Single Claude Haiku provider behind a config-selected interface; render inventory context that
      references only provided items and includes price and available quantity (incl. 0) per item;
      state "no matching items" when the set is empty
    - Files: `respond-leads/lib/pipeline/llm-provider.ts`, `respond-leads/lib/pipeline/ai-responder.ts`
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 11.4_

  - [~] 8.2 Implement keyword extraction, response generation, token caps, and fallback
    - `extractKeyword` capped at 50 tokens; `generateResponse` capped at 300 tokens; on any LLM
      failure return a non-empty `Fallback_Response` and signal failure for logging
    - File: `respond-leads/lib/pipeline/ai-responder.ts`
    - _Requirements: 6.1, 8.1, 8.2, 8.3, 14.2_

  - [ ]* 8.3 Write property test for grounding only in returned inventory
    - **Property 11: Responses are grounded only in returned inventory**
    - **Validates: Requirements 6.3, 6.4**

  - [ ]* 8.4 Write property test for referenced items including price and quantity
    - **Property 12: Referenced items always include price and quantity**
    - **Validates: Requirements 6.5, 6.6**

  - [ ]* 8.5 Write property test for AI fallback on failure
    - **Property 14: AI failure produces a fallback**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 8.6 Write property test for token caps on LLM requests
    - **Property 26: Token caps on LLM requests**
    - **Validates: Requirements 14.2**

- [ ] 9. Implement Outbound_Sender
  - [~] 9.1 Implement WhatsApp send with retry policy
    - `send(tenant, to, body, replyTo?)` via WhatsApp Cloud API; at most 3 total attempts (1 + 2
      retries), stop after first success, log a single delivery-failure event with phone + message id
      when all attempts fail
    - File: `respond-leads/lib/pipeline/outbound-sender.ts`
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 9.2 Write property test for outbound send retry policy
    - **Property 13: Outbound send retry policy**
    - **Validates: Requirements 7.2, 7.3**

- [ ] 10. Implement Conversation_Engine core (history, dedup, persistence)
  - [~] 10.1 Implement history fetch, append-and-trim, and persistence
    - `fetchHistory` ordered oldest→newest, treats history as empty on failure and logs; `appendAndTrim`
      appends inbound then reply and removes whole oldest messages until ≤ 4000 chars; `save` persists
      phone, name, history, last_message_id keyed by `(tenant_id, phone_number)`
    - File: `respond-leads/lib/pipeline/conversation-engine.ts`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [~] 10.2 Implement deduplication and conditional last-message-id write
    - `isDuplicate(messageId, lastMessageId)`; set Idempotency_Key before any LLM call; store
      last_message_id only after reply sent and save succeeds; conditional DB write resolves concurrent
      duplicates to exactly one reply; duplicates issue no LLM request and leave history unchanged
    - File: `respond-leads/lib/pipeline/conversation-engine.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.7, 14.3_

  - [ ]* 10.3 Write property test for deduplication yielding exactly one reply
    - **Property 6: Deduplication yields exactly one reply**
    - **Validates: Requirements 4.2, 4.4, 4.5, 14.3**

  - [ ]* 10.4 Write property test for last-processed id set only after success
    - **Property 7: Last-processed id is set only after a successful reply**
    - **Validates: Requirements 4.3, 5.7**

  - [ ]* 10.5 Write property test for history ordering, append, and bounded trim
    - **Property 8: History ordering, append, and bounded trim**
    - **Validates: Requirements 5.1, 5.3, 5.4**

  - [ ]* 10.6 Write property test for conversation persistence round-trip
    - **Property 9: Conversation persistence round-trip keyed by tenant and phone**
    - **Validates: Requirements 5.5, 5.6**

- [~] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement Close_Detector
  - [~] 12.1 Implement close evaluation and idempotent close-event recording
    - `evaluate(tenant, conversation)` is total (returns closed/not-closed without raising for valid
      input); `recordCloseEvent` writes tenant, phone, deal_value, currency, closed_at, guarded so a
      second event is never recorded per conversation; evaluation failure fails the conversation update
      and logs
    - File: `respond-leads/lib/pipeline/close-detector.ts`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 12.2 Write property test for close detection totality
    - **Property 15: Close detection is total**
    - **Validates: Requirements 9.1**

  - [ ]* 12.3 Write property test for idempotent close-event recording
    - **Property 16: Close-event recording is idempotent**
    - **Validates: Requirements 9.3, 9.4, 9.5**

- [ ] 13. Implement consent, opt-out, and data deletion
  - [~] 13.1 Implement consent recording, opt-out, and deletion
    - Record per-customer consent and opt-out; deletion request removes a customer's conversation and
      personal data (consent, history) for the requesting tenant
    - File: `respond-leads/lib/pipeline/consent.ts`
    - _Requirements: 18.1, 18.3, 18.4_

  - [ ]* 13.2 Write property test for data deletion removing personal data
    - **Property 20: Data deletion removes personal data**
    - **Validates: Requirements 18.3**

- [ ] 14. Implement Lifecycle_Runner and daily cron
  - [~] 14.1 Implement follow-up scheduling and idempotent sending with consent gating
    - On a Close_Event, create exactly one pending follow-up action per tenant-defined step; daily cron
      sends due actions via Outbound_Sender, marks them completed idempotently, runs at most once per
      day per job; skip customers without consent or who opted out
    - Files: `respond-leads/lib/pipeline/lifecycle.ts`, `respond-leads/app/api/cron/lifecycle/route.ts`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 14.5, 18.2, 18.4_

  - [ ]* 14.2 Write property test for follow-up scheduling matching tenant plan
    - **Property 17: Follow-up scheduling matches the tenant plan**
    - **Validates: Requirements 10.1**

  - [ ]* 14.3 Write property test for idempotent lifecycle sending
    - **Property 18: Lifecycle sending is idempotent**
    - **Validates: Requirements 10.2, 10.4**

  - [ ]* 14.4 Write property test for consent and opt-out gating
    - **Property 19: Consent and opt-out gate follow-ups**
    - **Validates: Requirements 18.2, 18.4**

- [ ] 15. Implement RateLimiter and queue
  - [~] 15.1 Implement burst queuing and spaced draining
    - Track inbound volume per phone; enqueue excess beyond 50 messages within any 60s window (never
      drop); drain queued sends to a single phone with ≥ 5s spacing using `inbound_queue.process_after`
    - File: `respond-leads/lib/pipeline/rate-limiter.ts`
    - _Requirements: 14.1, 14.4, 15.3_

  - [ ]* 15.2 Write property test for burst messages queued, never dropped
    - **Property 27: Burst messages are queued, never dropped**
    - **Validates: Requirements 14.1, 15.3**

  - [ ]* 15.3 Write property test for spaced queued sends
    - **Property 28: Queued sends are spaced**
    - **Validates: Requirements 14.4**

- [ ] 16. Implement interop adapters
  - [~] 16.1 Implement CashFlow, Mails2Leadz, and AutoDealz adapters
    - `cashflow.publishCloseEvent` exposes deal value, currency, customer id, close timestamp;
      `mails2leadz.handoffLead` creates or updates exactly one conversation for the lead's phone in the
      tenant; shared identifier is phone number; sibling outages are logged and never block inbound
    - Files: `respond-leads/lib/integrations/cashflow.ts`, `respond-leads/lib/integrations/mails2leadz.ts`,
      `respond-leads/lib/integrations/autodealz.ts`
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ]* 16.2 Write property test for lead handoff creating or updating one conversation
    - **Property 32: Lead handoff creates or updates one conversation**
    - **Validates: Requirements 16.2**

  - [ ]* 16.3 Write unit tests for sibling outage resilience and CashFlow contract
    - Test sibling unavailability is logged and does not block inbound (16.5); CashFlow payload shape (16.1)
    - _Requirements: 16.1, 16.5_

- [ ] 17. Wire the canonical Inbound_Handler endpoint
  - [~] 17.1 Implement GET verification challenge handler
    - `verifyChallenge(mode, token, challenge)` returns 200 + unmodified challenge only when
      `mode==='subscribe'` and token byte-for-byte equals configured token and a challenge is present;
      otherwise 403 with no challenge echo
    - File: `respond-leads/lib/pipeline/inbound-handler.ts`
    - _Requirements: 1.2, 1.3, 1.4_

  - [~] 17.2 Implement POST handler wiring signature, parse, tenant, rate limit, and per-message dispatch
    - Verify signature (401 on failure), parse, resolve tenant, route through rate limiter, process each
      message via Conversation_Engine → AI_Responder → Outbound_Sender → Close_Detector independently;
      always acknowledge 200 within 5s including on processing errors; catch per-conversation failures
      so siblings still complete
    - Files: `respond-leads/lib/pipeline/inbound-handler.ts`, `respond-leads/app/api/webhook/whatsapp/route.ts`
    - _Requirements: 2.1, 3.2, 15.1, 15.2, 17.3_

  - [ ]* 17.3 Write property test for webhook verification challenge
    - **Property 1: Webhook verification challenge**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [ ]* 17.4 Write property test for independent per-conversation processing
    - **Property 29: Independent per-conversation processing**
    - **Validates: Requirements 15.2**

  - [ ]* 17.5 Write property test for webhook resilience returning 200 on processing error
    - **Property 30: Webhook resilience returns 200 on processing error**
    - **Validates: Requirements 17.3**

  - [ ]* 17.6 Write property test for per-message log completeness
    - **Property 31: Per-message log completeness**
    - **Validates: Requirements 17.1**

- [ ] 18. Implement health-check endpoint
  - [~] 18.1 Implement health endpoint reporting DB and WhatsApp reachability
    - File: `respond-leads/app/api/health/route.ts`
    - _Requirements: 17.4_

- [~] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Consolidate to the single canonical implementation
  - [~] 20.1 Remove competing route and service variants
    - Delete `app/api/webhook/whatsapp/v9-route.ts`, `v10-route.ts`, `blueprint-route.ts` and services
      `lib/whatsapp-v9.ts`, `lib/claude-v9.ts`, `lib/whatsapp-blueprint.ts` so exactly one production
      endpoint and one provider remain
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [~] 20.2 Archive non-production reference material
    - Move Make.com blueprints (`*.blueprint.json`, `v9-clean-blueprint.json`,
      `whatsapp-ai-inventory-v10.json`), the OpenAI `respond-ai/` app, and `respond-leads/python/` into
      a clearly labelled `/reference` location
    - _Requirements: 11.3_

  - [ ]* 20.3 Write structural consolidation test
    - Assert exactly one production webhook route exists, variant files are deleted, blueprints/OpenAI/
      Python paths live under `/reference`, and Requirement 2–10 behaviors run through the canonical path
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 13.1, 13.2, 12.3, 10.3, 14.5_

- [~] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP.
- Each task references specific requirements clauses for traceability.
- Property tests (Properties 1–32) use `fast-check` with Jest, run ≥ 100 generated cases, and are
  tagged `// Feature: respond-leadz, Property {n}: {text}`. Tenant isolation properties (21–24) run
  against a Postgres test database with RLS enabled and a non-superuser role.
- LLM, WhatsApp delivery, timing/SLA, and infrastructure wiring are covered by unit/integration tests
  rather than property tests, per the design's testing strategy.
- Checkpoints ensure incremental validation at natural boundaries.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "3.2", "4.2", "4.3", "4.4", "4.5", "5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "5.4", "5.5", "7.1", "8.1", "9.1"] },
    { "id": 4, "tasks": ["7.2", "8.2", "9.2", "10.1", "12.1", "13.1", "16.1"] },
    { "id": 5, "tasks": ["8.3", "8.4", "8.5", "8.6", "10.2", "12.2", "12.3", "13.2", "14.1", "15.1", "16.2", "16.3"] },
    { "id": 6, "tasks": ["10.3", "10.4", "10.5", "10.6", "14.2", "14.3", "14.4", "15.2", "15.3", "17.1", "17.2", "18.1"] },
    { "id": 7, "tasks": ["17.3", "17.4", "17.5", "17.6", "20.1", "20.2"] },
    { "id": 8, "tasks": ["20.3"] }
  ]
}
```
