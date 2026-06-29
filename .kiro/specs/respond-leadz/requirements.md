# Requirements Document

## Introduction

RespondLeadz is the sales and conversion component of an end-to-end SME operations stack. Its
purpose is to convert demand into revenue by closing deals and supporting customers over WhatsApp
using AI. RespondLeadz receives inbound WhatsApp messages, grounds AI responses in live inventory,
maintains conversation memory, detects when a deal is closed, and runs a post-close follow-up
lifecycle. It interoperates with sibling systems (CashFlow for money tracking, AutoDealz for
sourcing and supply, Mails2Leadz for marketing and demand generation).

This effort is a consolidation and enhancement of an existing codebase, not a greenfield build. The
current codebase contains multiple competing implementations of the same pipeline (a native
Next.js webhook plus Make.com blueprints; versions v9, v10, and v11; a Claude-based path and an
OpenAI-based path in a parallel `respond-ai` application; and a Python RAG path). A primary goal of
this specification is to converge on a single canonical, maintainable implementation that is
optimized, responsive, cost-effective, practical, scalable, and multi-tenant.

This document defines the requirements only. Implementation choices (specific files, libraries, and
module structure) are deferred to the design phase.

## Glossary

- **RespondLeadz**: The overall sales and customer-support system specified by this document. Where
  a requirement refers to internal behavior, the responsible component is named explicitly.
- **Inbound_Handler**: The component that receives and validates incoming WhatsApp webhook requests.
- **Conversation_Engine**: The component that orchestrates the per-message pipeline (history fetch,
  deduplication, AI processing, reply send, history save).
- **AI_Responder**: The component that uses a large language model to extract search intent and
  generate customer-facing responses.
- **Inventory_Service**: The component that searches and returns product/stock data.
- **Close_Detector**: The component that determines whether a conversation has resulted in a closed
  deal.
- **Lifecycle_Runner**: The component that executes post-close follow-up actions on a schedule.
- **Tenant_Manager**: The component that enforces per-tenant data isolation and configuration.
- **Outbound_Sender**: The component that sends WhatsApp messages to customers.
- **Meta_Setup**: The configuration and verification of the WhatsApp Business Cloud API connection
  (app, phone number, access token, app secret, verify token, webhook subscription).
- **LLM**: A large language model service used for intent extraction and response generation.
- **Tenant**: An isolated business account (one of the founders' businesses) with its own inventory,
  conversations, configuration, and credentials.
- **Conversation**: The ordered message history exchanged with a single customer phone number for a
  single tenant.
- **Close_Event**: A recorded determination that a conversation reached a closed-deal state,
  including the associated deal value and currency.
- **Idempotency_Key**: A value (the WhatsApp message id) used to detect and discard duplicate
  inbound message deliveries.
- **Canonical_Implementation**: The single supported pipeline that replaces all competing versions.
- **Fallback_Response**: A predefined safe reply sent to the customer when AI processing fails.
- **RLS**: Row Level Security, a database-level access control that restricts rows to their owning
  tenant.
- **Vercel_Hobby_Limits**: The deployment constraints of the Vercel Hobby tier, including a maximum
  of one scheduled cron execution per day per job.

## Requirements

### Requirement 1: WhatsApp Business Cloud API Setup and Verification (Meta/Facebook bug)

**User Story:** As the owner of RespondLeadz, I want a reliable, verifiable path from the Meta
sandbox/test number to a working production WhatsApp sender, so that the Facebook/Meta registration
blocker no longer prevents the system from sending and receiving messages.

#### Acceptance Criteria

1. THE Meta_Setup SHALL document each of the following required credentials as a named configuration
   value, with each entry listing the credential name, its purpose, and whether it is mandatory:
   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, and WHATSAPP_VERIFY_TOKEN.
2. WHEN Meta sends a webhook verification request containing both a verify token and a challenge
   value, AND the submitted verify token is byte-for-byte equal to the configured
   WHATSAPP_VERIFY_TOKEN, THE Inbound_Handler SHALL respond within 5 seconds with HTTP status 200
   and a response body equal to the unmodified challenge value.
3. IF Meta sends a webhook verification request whose verify token is not byte-for-byte equal to the
   configured WHATSAPP_VERIFY_TOKEN, THEN THE Inbound_Handler SHALL respond with HTTP status 403 and
   SHALL NOT echo the challenge value.
4. IF Meta sends a webhook verification request that omits the verify token or omits the challenge
   value, THEN THE Inbound_Handler SHALL respond with HTTP status 403 and SHALL NOT echo any
   challenge value.
5. THE Meta_Setup SHALL provide a verification procedure consisting of discrete pass/fail steps that
   each confirm: (a) the webhook subscription includes the `messages` field, (b) a test message sent
   from the sandbox number is received by the Inbound_Handler, and (c) a reply is delivered back to
   the test number, where each step states the expected observable result that indicates success.
6. WHERE the WhatsApp connection operates in sandbox mode, THE Meta_Setup SHALL document the ordered
   steps required to promote the configuration to a verified production sender, including the
   precondition for each step and the observable outcome that confirms the step succeeded.
7. IF one or more required WhatsApp credentials are absent or empty at startup, THEN THE
   RespondLeadz SHALL halt startup and report a configuration error that names each missing or empty
   credential.

### Requirement 2: Inbound Message Reception and Validation

**User Story:** As a customer, I want my WhatsApp messages to reliably reach the system, so that I
receive a response.

#### Acceptance Criteria

1. WHEN a WhatsApp webhook POST request is received, THE Inbound_Handler SHALL respond with HTTP
   status 200 within 5 seconds of receipt.
2. WHEN a webhook payload contains one or more text messages, THE Inbound_Handler SHALL extract the
   message id, sender phone number, message text, and contact display name from each text message,
   processing at most 100 text messages per payload.
3. WHEN a text message body exceeds 4096 characters, THE Inbound_Handler SHALL truncate the
   extracted message text to its first 4096 characters before further processing.
4. IF a webhook payload contains a message type other than text, THEN THE Inbound_Handler SHALL
   acknowledge the request with HTTP status 200 and SHALL NOT attempt text processing on that
   message.
5. WHEN a webhook payload contains zero messages, including status-only delivery or read
   notifications, THE Inbound_Handler SHALL acknowledge the request with HTTP status 200 and SHALL
   NOT initiate text processing.
6. IF a webhook payload cannot be parsed into the expected structure, THEN THE Inbound_Handler SHALL
   respond with HTTP status 200, SHALL record a parse error in the system log, and SHALL NOT
   initiate text processing.
7. WHEN a contact display name is absent, empty, or whitespace-only in the payload, THE
   Inbound_Handler SHALL use the value "Unknown" as the customer name.

### Requirement 3: Webhook Signature Verification

**User Story:** As the owner of RespondLeadz, I want incoming webhook requests to be authenticated,
so that only Meta-originated requests are processed.

#### Acceptance Criteria

1. WHEN a webhook POST request is received, THE Inbound_Handler SHALL compute an HMAC-SHA256
   signature of the raw, unmodified request body using the configured WHATSAPP_APP_SECRET and SHALL
   extract the expected signature from the request signature header.
2. IF the computed signature does not match the expected signature extracted from the request
   header, THEN THE Inbound_Handler SHALL reject the request with HTTP status 401 and SHALL NOT
   process or generate a reply for any message in the request.
3. WHEN the computed signature matches the expected signature from the request header, THE
   Inbound_Handler SHALL proceed to process the request.
4. THE Inbound_Handler SHALL compare signatures using a comparison whose execution time is
   independent of the position of the first differing byte.
5. IF the request signature header is missing, empty, or malformed, THEN THE Inbound_Handler SHALL
   reject the request with HTTP status 401 and SHALL NOT process any message.
6. IF the configured WHATSAPP_APP_SECRET is absent or empty, THEN THE Inbound_Handler SHALL reject
   the request with HTTP status 401 and SHALL record a named configuration error in the system log.

### Requirement 4: Message Deduplication and Idempotency

**User Story:** As the owner of RespondLeadz, I want duplicate webhook deliveries to be ignored, so
that customers are not sent repeated replies and LLM cost is not incurred twice.

#### Acceptance Criteria

1. WHEN an inbound message is received for processing, THE Conversation_Engine SHALL set the
   Idempotency_Key equal to the WhatsApp message id before issuing any LLM request or generating any
   reply.
2. IF the Idempotency_Key of an inbound message equals the most recently stored message id for that
   Conversation, THEN THE Conversation_Engine SHALL discard the message, SHALL NOT issue any LLM
   request, SHALL NOT generate or send any reply, SHALL NOT modify the Conversation history, and
   SHALL acknowledge the webhook with HTTP status 200.
3. WHEN an inbound message with a new Idempotency_Key has been processed to the point that a reply
   has been sent, THE Conversation_Engine SHALL store that Idempotency_Key as the most recently
   processed message id for the Conversation.
4. FOR ALL inbound messages, processing the same Idempotency_Key two or more times in sequence SHALL
   result in exactly one outbound reply, with zero additional outbound replies for each subsequent
   processing of the same Idempotency_Key.
5. IF two or more deliveries carrying the same Idempotency_Key for the same Conversation are
   processed concurrently, THEN THE Conversation_Engine SHALL ensure that at most one of those
   deliveries generates an outbound reply and the remaining deliveries are discarded.

### Requirement 5: Conversation Memory

**User Story:** As a customer, I want the system to remember the context of my conversation, so that
I do not have to repeat myself.

#### Acceptance Criteria

1. WHEN an inbound message is processed, THE Conversation_Engine SHALL retrieve the existing
   Conversation history for the sender phone number within the current Tenant, ordered from oldest
   message to newest message.
2. IF retrieval of the Conversation history fails, THEN THE Conversation_Engine SHALL record the
   retrieval failure in the system log and SHALL treat the Conversation history as empty for the
   remainder of processing.
3. WHEN a reply has been sent, THE Conversation_Engine SHALL append the inbound message followed by
   the outbound reply to the end of the Conversation history.
4. WHILE the Conversation history exceeds 4000 characters, THE Conversation_Engine SHALL remove
   whole oldest messages, each being a single inbound message or a single outbound reply, until the
   stored history is at most 4000 characters.
5. WHEN a Conversation does not yet exist for a sender phone number within the current Tenant, THE
   Conversation_Engine SHALL create a new Conversation record keyed by phone number and Tenant.
6. THE Conversation_Engine SHALL store, for each Conversation, the phone number, customer name,
   history, and most recently processed message id.
7. IF saving the Conversation history fails, THEN THE Conversation_Engine SHALL NOT mark the inbound
   message id as the most recently processed message id and SHALL record the save failure in the
   system log.

### Requirement 6: AI Response Generation Grounded in Inventory

**User Story:** As a customer, I want accurate answers about product availability and pricing, so
that I can decide to buy.

#### Acceptance Criteria

1. WHEN an inbound message is processed, THE AI_Responder SHALL extract search terms from the
   message text using the LLM.
2. WHEN search terms have been extracted, THE Inventory_Service SHALL return matching inventory items
   for the current Tenant, limited to at most 5 results.
3. WHEN inventory results are available, THE AI_Responder SHALL generate a customer-facing response
   that references only inventory items returned by the Inventory_Service for the current Tenant.
4. WHEN the Inventory_Service returns no matching items, THE AI_Responder SHALL generate a response
   that states no matching items were found and SHALL NOT state availability for unlisted items.
5. THE AI_Responder SHALL include in each response the price and available quantity of any inventory
   item it references, using the price values stored for that item.
6. WHERE a referenced inventory item has an available quantity of zero, THE AI_Responder SHALL still
   include the price and the zero quantity for that item.

### Requirement 7: Outbound Reply Delivery

**User Story:** As a customer, I want to receive the system's reply on WhatsApp, so that the
conversation continues.

#### Acceptance Criteria

1. WHEN a customer-facing response has been generated, THE Outbound_Sender SHALL send the response
   to the sender phone number via the WhatsApp Business Cloud API.
2. IF the WhatsApp Business Cloud API returns an error when sending a reply, THEN THE Outbound_Sender
   SHALL record the error in the system log and SHALL retry sending at most 2 additional times.
3. IF all send attempts for a reply fail, THEN THE Outbound_Sender SHALL record a delivery-failure
   event in the system log identifying the sender phone number and message id.

### Requirement 8: AI Failure Fallback

**User Story:** As a customer, I want to receive a helpful reply even when the AI cannot respond, so
that I am not left without an answer.

#### Acceptance Criteria

1. IF the LLM fails to return a response during intent extraction or response generation, THEN THE
   AI_Responder SHALL produce a Fallback_Response.
2. WHEN a Fallback_Response is produced, THE Outbound_Sender SHALL send the Fallback_Response to the
   sender phone number.
3. WHEN a Fallback_Response is sent, THE Conversation_Engine SHALL record the LLM failure in the
   system log.

### Requirement 9: Close Detection

**User Story:** As the owner of RespondLeadz, I want the system to detect when a deal is closed, so
that revenue can be tracked and follow-up can begin.

#### Acceptance Criteria

1. WHEN a Conversation is updated with a new reply, THE Close_Detector SHALL evaluate the
   Conversation and produce a determination of either closed-deal or not-closed-deal.
2. IF the close-detection evaluation fails, THEN THE Conversation_Engine SHALL fail the Conversation
   update and SHALL record the evaluation failure in the system log.
3. WHEN the Close_Detector determines that a Conversation has reached a closed-deal state, THE
   Close_Detector SHALL record a Close_Event containing the Tenant, phone number, deal value, and
   currency.
4. IF a Close_Event already exists for a Conversation, THEN THE Close_Detector SHALL NOT record a
   second Close_Event for the same closed deal.
5. WHEN a Close_Event is recorded, THE Close_Detector SHALL store the timestamp of the close.

### Requirement 10: Post-Close Lifecycle Follow-Up

**User Story:** As the owner of RespondLeadz, I want automated follow-up after a deal closes, so that
customers are supported and retained.

#### Acceptance Criteria

1. WHEN a Close_Event has been recorded, THE Lifecycle_Runner SHALL schedule the post-close
   follow-up actions defined for the current Tenant.
2. WHILE a scheduled follow-up action is due, THE Lifecycle_Runner SHALL send the follow-up message
   to the customer via the Outbound_Sender.
3. WHERE the deployment operates under Vercel_Hobby_Limits, THE Lifecycle_Runner SHALL execute its
   scheduled processing at most once per day per scheduled job.
4. WHEN a follow-up action has been sent, THE Lifecycle_Runner SHALL record the action as completed
   so that it is not sent again.
5. IF a customer replies after a Close_Event, THEN THE Conversation_Engine SHALL process the reply
   through the standard inbound pipeline.

### Requirement 11: Single Canonical Implementation (Consolidation)

**User Story:** As a maintainer, I want one canonical implementation of the message pipeline, so
that the system is maintainable and free of competing versions.

#### Acceptance Criteria

1. THE Canonical_Implementation SHALL be the single code path that handles inbound WhatsApp messages
   in production.
2. THE RespondLeadz SHALL expose exactly one production webhook endpoint for WhatsApp inbound
   messages.
3. WHERE a prior implementation variant exists (including v9, v10, v11 blueprint, the base route,
   the Make.com blueprints, the OpenAI-based path, and the Python RAG path), THE consolidation SHALL
   either remove the variant or document it as non-production reference material.
4. THE Canonical_Implementation SHALL use a single configured LLM provider for intent extraction and
   response generation.
5. THE RespondLeadz SHALL retain all behaviors required by Requirements 2 through 10 after
   consolidation.

### Requirement 12: Multi-Tenancy and Data Isolation

**User Story:** As one of three founders, I want to run RespondLeadz for my own business without
seeing or affecting another founder's data, so that each business operates independently.

#### Acceptance Criteria

1. THE Tenant_Manager SHALL associate every inventory item, Conversation, Close_Event, and
   configuration record with exactly one Tenant.
2. WHEN a request reads or writes tenant-scoped data, THE Tenant_Manager SHALL restrict the operation
   to records belonging to the requesting Tenant.
3. THE RespondLeadz SHALL enforce tenant isolation at the database layer using RLS.
4. IF RLS is disabled or unavailable, THEN THE Tenant_Manager SHALL deny all tenant-scoped read and
   write operations.
5. WHEN an inbound message is received, THE Conversation_Engine SHALL resolve the owning Tenant from
   the receiving WhatsApp phone number id before processing the message.
6. IF a tenant-scoped operation references a record owned by a different Tenant, THEN THE
   Tenant_Manager SHALL deny the operation.

### Requirement 13: Secrets and Credential Handling

**User Story:** As the owner of RespondLeadz, I want all credentials handled securely, so that
secrets are not exposed.

#### Acceptance Criteria

1. THE RespondLeadz SHALL read all API keys, access tokens, and database service-role keys from
   environment configuration rather than from source code.
2. THE RespondLeadz SHALL exclude environment configuration files containing secrets from version
   control.
3. WHEN the system logs an event, THE RespondLeadz SHALL refer to credentials by name and SHALL NOT
   write credential values to the log.
4. WHERE per-tenant WhatsApp or LLM credentials are stored, THE Tenant_Manager SHALL restrict access
   to those credentials to the owning Tenant.

### Requirement 14: Rate Limiting and Cost Control

**User Story:** As the owner of RespondLeadz, I want LLM and API usage controlled, so that costs stay
low and the deployment stays within tier limits.

#### Acceptance Criteria

1. WHEN more than 50 inbound messages are received from a single phone number within 60 seconds, THE
   Conversation_Engine SHALL defer processing of the excess messages through a queue rather than
   processing them immediately.
2. THE AI_Responder SHALL cap the LLM tokens requested for intent extraction at 50 tokens and for
   response generation at 300 tokens per message.
3. WHEN a duplicate message is discarded under Requirement 4, THE AI_Responder SHALL NOT issue any
   LLM request for that message.
4. THE Conversation_Engine SHALL send queued messages with a minimum spacing of 5 seconds between
   consecutive sends to a single phone number.
5. WHERE the deployment operates under Vercel_Hobby_Limits, THE RespondLeadz SHALL schedule each
   recurring background job to run at most once per day.

### Requirement 15: Responsiveness and Scale

**User Story:** As a customer, I want fast replies even when the system is busy, so that the
conversation feels responsive.

#### Acceptance Criteria

1. WHEN an inbound message is accepted for processing, THE RespondLeadz SHALL deliver a reply within
   10 seconds under nominal load of a single concurrent conversation.
2. WHILE multiple conversations are active concurrently, THE Conversation_Engine SHALL process each
   Conversation independently such that a delay or failure in processing one Conversation does not
   prevent another Conversation from being processed.
3. WHEN inbound message volume exceeds immediate processing capacity, THE Conversation_Engine SHALL
   enqueue messages for deferred processing rather than dropping them.
4. THE Inventory_Service SHALL return search results for a single query within 1 second under
   nominal load.

### Requirement 16: Interoperability with Sibling Systems

**User Story:** As the owner of the SME stack, I want RespondLeadz to exchange data with CashFlow,
AutoDealz, and Mails2Leadz, so that the systems operate as one pipeline.

#### Acceptance Criteria

1. WHEN a Close_Event is recorded, THE RespondLeadz SHALL make the deal value, currency, customer
   identifier, and close timestamp available to CashFlow.
2. WHEN Mails2Leadz hands off a lead, THE RespondLeadz SHALL create or update a Conversation for that
   lead's phone number within the receiving Tenant.
3. THE Inventory_Service SHALL source inventory data such that items supplied through AutoDealz are
   represented in RespondLeadz inventory for the owning Tenant.
4. THE RespondLeadz SHALL identify customers and leads using a shared identifier (phone number) that
   is consistent across the sibling systems.
5. WHERE a sibling system is unavailable, THE RespondLeadz SHALL continue handling inbound messages
   and SHALL record the integration failure in the system log.

### Requirement 17: Observability and Logging

**User Story:** As a maintainer, I want structured logs and health visibility, so that I can detect
and diagnose failures.

#### Acceptance Criteria

1. WHEN processing an inbound message, THE Conversation_Engine SHALL record a log entry containing
   the Tenant, phone number, message id, and processing outcome.
2. THE RespondLeadz SHALL record log entries at distinct severity levels for errors, warnings, and
   informational events.
3. WHEN an unhandled error occurs during message processing, THE Conversation_Engine SHALL record
   the error and SHALL still respond to the webhook with HTTP status 200.
4. THE RespondLeadz SHALL expose a health-check endpoint that reports whether the system can reach
   the database and the WhatsApp Business Cloud API.

### Requirement 18: Consent and Messaging Compliance

**User Story:** As the owner of RespondLeadz, I want WhatsApp messaging to respect consent and data
rights, so that the system complies with WhatsApp policy and GDPR.

#### Acceptance Criteria

1. THE Tenant_Manager SHALL record, for each customer, whether consent to receive messages has been
   granted.
2. IF a customer has not granted consent, THEN THE Lifecycle_Runner SHALL NOT send post-close
   follow-up messages to that customer.
3. WHEN a customer requests deletion of their data, THE RespondLeadz SHALL remove that customer's
   Conversation and personal data for the requesting Tenant.
4. WHEN a customer sends an opt-out message, THE Conversation_Engine SHALL record the opt-out and THE
   Lifecycle_Runner SHALL stop sending follow-up messages to that customer.

### Requirement 19: Configuration and Startup Validation

**User Story:** As a maintainer, I want the system to validate its configuration at startup, so that
misconfiguration is caught early rather than during a customer conversation.

#### Acceptance Criteria

1. WHEN the system starts, THE RespondLeadz SHALL verify that all required environment configuration
   values are present.
2. IF a required configuration value is missing or empty, THEN THE RespondLeadz SHALL report a named
   configuration error identifying the missing value and SHALL remain in a starting state in which
   it does not accept inbound webhook requests.
3. WHEN all required configuration values are present, THE RespondLeadz SHALL start and accept
   inbound webhook requests, regardless of other non-required validation outcomes.
