/**
 * Core domain types for the canonical RespondLeadz pipeline.
 *
 * These are the multi-tenant domain models referenced throughout the pipeline
 * design. Every tenant-scoped record carries a `tenant_id` and is protected by
 * RLS at the database layer.
 *
 * Feature: respond-leadz
 * Requirements: 2.6, 9.2, 12.1, 12.4
 */

/**
 * An isolated business account with its own inventory, conversations,
 * configuration, and credentials.
 *
 * `whatsapp_phone_number_id` is used to resolve the owning tenant for an
 * inbound message (Requirement 12.5). Credential fields hold secret references
 * and are only ever read within the owning tenant's context (Requirement 13.4);
 * their values are never logged (Requirement 13.3).
 */
export interface Tenant {
  id: string
  name: string
  /** The WhatsApp `phone_number_id` that routes inbound messages to this tenant. */
  whatsapp_phone_number_id: string
  /** Per-tenant WhatsApp Cloud API access token (secret reference). */
  whatsapp_access_token: string
  /** Per-tenant app secret used for webhook signature verification (secret reference). */
  whatsapp_app_secret: string
  /** Per-tenant verify token used for the webhook verification challenge (secret reference). */
  whatsapp_verify_token: string
  /** The configured LLM provider; fixed to the canonical provider. */
  llm_provider: string
  /** Per-tenant LLM API key (secret reference). */
  llm_api_key: string
  /** ISO 4217 currency code used as the tenant default. */
  default_currency: string
  created_at?: string
}

/**
 * A single text message extracted from a WhatsApp webhook payload by the
 * WebhookParser. Non-text and status-only payloads never produce one of these
 * (Requirements 2.2, 2.4, 2.5).
 */
export interface ParsedMessage {
  /** WhatsApp message id; also used as the Idempotency_Key (Requirement 4.1). */
  messageId: string
  /** Sender phone number. */
  from: string
  /** Message text, truncated to at most 4096 characters (Requirement 2.3). */
  text: string
  /** Contact display name, defaulting to "Unknown" when absent (Requirement 2.7). */
  contactName: string
}

/**
 * A product/stock record owned by a single tenant. Unique on `(tenant_id, sku)`.
 */
export interface InventoryItem {
  id?: string
  tenant_id: string
  name: string
  sku: string
  description?: string
  category?: string
  /** Available quantity, never negative; 0 indicates out of stock. */
  quantity: number
  /** Stored price in the item's currency, never negative. */
  price: number
  /** ISO 4217 currency code for `price`. */
  currency: string
  /** Price normalized to USD for cross-currency reporting. */
  price_usd: number
  /** Only active items are returned by inventory search (Requirement 6.2). */
  is_active: boolean
  created_at?: string
  updated_at?: string
}

/**
 * The ordered message history exchanged with a single customer phone number for
 * a single tenant. Unique on `(tenant_id, phone_number)` (Requirement 5.5).
 */
export interface Conversation {
  id?: string
  tenant_id: string
  phone_number: string
  /** Customer name, defaulting to "Unknown" (Requirement 2.7). */
  customer_name: string
  /** Serialized conversation history, trimmed to at most 4000 characters (Requirement 5.4). */
  history: string
  /** Most recently processed message id, used for deduplication (Requirement 4). */
  last_message_id?: string
  created_at?: string
  updated_at?: string
}

/**
 * A recorded determination that a conversation reached a closed-deal state.
 * Exactly one Close_Event may exist per conversation (Requirement 9.4).
 */
export interface CloseEvent {
  id?: string
  tenant_id: string
  /** The conversation that closed; unique per close event (Requirement 9.4). */
  conversation_id: string
  phone_number: string
  /** Deal value associated with the close (Requirement 9.3). */
  deal_value: number
  /** ISO 4217 currency code for `deal_value` (Requirement 9.3). */
  currency: string
  /** Timestamp of the close (Requirement 9.5). */
  closed_at: string
}

/** Lifecycle state of a scheduled follow-up action. */
export type FollowUpStatus = 'pending' | 'completed'

/**
 * A post-close follow-up step scheduled for a tenant. Created from a
 * Close_Event according to the tenant's follow-up plan (Requirement 10.1) and
 * marked completed once sent so it is not sent again (Requirement 10.4).
 */
export interface FollowUpAction {
  id?: string
  tenant_id: string
  close_event_id: string
  /** Tenant-defined follow-up step identifier. */
  action_type: string
  /** Time at which the action becomes due. */
  scheduled_for: string
  status: FollowUpStatus
  /** Set when the action has been sent (Requirement 10.4). */
  sent_at?: string | null
}
