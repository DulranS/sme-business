-- Migration 006: Multi-tenant schema
-- Feature: respond-leadz, Task 1.1 — Create multi-tenant schema migration
--
-- Purpose
--   Converge the single-tenant RespondLeadz schema onto the multi-tenant data model
--   defined in the design document. This migration:
--     * creates the `tenants` table (tenant identity + per-tenant credentials/config)
--     * creates `close_events`, `follow_up_actions`, `customer_consent`, `inbound_queue`
--     * migrates `inventory` and `conversations` to carry a non-null `tenant_id`
--     * sets the tenant-scoped unique keys (tenant_id, sku) and (tenant_id, phone_number)
--
-- Requirements: 5.5, 5.6, 9.3, 9.4, 9.5, 10.4, 18.1, 18.4, 12.1
--
-- Notes
--   * RLS policies and FORCE ROW LEVEL SECURITY are intentionally NOT defined here; they
--     are handled by migration 007 (task 1.2).
--   * The existing `inventory` and `conversations` tables use integer (SERIAL) primary
--     keys. To keep foreign keys valid and the migration runnable against the live
--     single-tenant database, `conversations.id` is referenced with its existing integer
--     type (INTEGER) rather than the uuid shown in the design's logical model. The new
--     stand-alone tables use uuid primary keys as designed.
--   * A default tenant is created so existing single-tenant rows can be backfilled before
--     `tenant_id` is made NOT NULL (Requirement 12.1: every record is tenant-associated).

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- tenants — one isolated business account per founder (Req 12.1, 13.4)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                     TEXT NOT NULL,
    -- Resolves the owning tenant from the receiving WhatsApp phone number id (Req 12.5).
    whatsapp_phone_number_id TEXT UNIQUE,
    -- Per-tenant credentials. Stored as secret references; never logged by value (Req 13.4).
    whatsapp_access_token    TEXT,
    whatsapp_app_secret      TEXT,
    whatsapp_verify_token    TEXT,
    -- Single canonical LLM provider per tenant (Req 11.4).
    llm_provider             TEXT NOT NULL DEFAULT 'claude-haiku',
    llm_api_key              TEXT,
    default_currency         CHAR(3) NOT NULL DEFAULT 'USD',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tenants IS 'Isolated business accounts; owns inventory, conversations, config, and per-tenant credentials (Req 12.1).';
COMMENT ON COLUMN tenants.whatsapp_phone_number_id IS 'Used to resolve the owning tenant for an inbound webhook (Req 12.5).';

-- Default tenant used to backfill existing single-tenant data so tenant_id can be NOT NULL.
INSERT INTO tenants (id, name, default_currency)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'USD')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- inventory (migrated) — add tenant_id + is_active; unique key (tenant_id, sku)
-- ---------------------------------------------------------------------------
ALTER TABLE inventory
    ADD COLUMN IF NOT EXISTS tenant_id UUID,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill existing rows onto the default tenant before enforcing NOT NULL (Req 12.1).
UPDATE inventory
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE inventory
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE inventory
    DROP CONSTRAINT IF EXISTS inventory_tenant_id_fkey;
ALTER TABLE inventory
    ADD CONSTRAINT inventory_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Replace the global SKU uniqueness with a tenant-scoped unique key.
ALTER TABLE inventory
    DROP CONSTRAINT IF EXISTS inventory_sku_key;
ALTER TABLE inventory
    DROP CONSTRAINT IF EXISTS inventory_tenant_sku_key;
ALTER TABLE inventory
    ADD CONSTRAINT inventory_tenant_sku_key UNIQUE (tenant_id, sku);

CREATE INDEX IF NOT EXISTS idx_inventory_tenant_id ON inventory (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_active ON inventory (tenant_id, is_active);

COMMENT ON COLUMN inventory.tenant_id IS 'Owning tenant (Req 12.1).';
COMMENT ON COLUMN inventory.is_active IS 'Only active items are returned by tenant-scoped search (Req 6.2).';

-- ---------------------------------------------------------------------------
-- conversations (migrated) — add tenant_id; unique key (tenant_id, phone_number)
-- ---------------------------------------------------------------------------
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

UPDATE conversations
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

ALTER TABLE conversations
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE conversations
    DROP CONSTRAINT IF EXISTS conversations_tenant_id_fkey;
ALTER TABLE conversations
    ADD CONSTRAINT conversations_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Replace the global phone_number uniqueness with a tenant-scoped unique key (Req 5.5).
ALTER TABLE conversations
    DROP CONSTRAINT IF EXISTS conversations_phone_number_key;
ALTER TABLE conversations
    DROP CONSTRAINT IF EXISTS conversations_tenant_phone_key;
ALTER TABLE conversations
    ADD CONSTRAINT conversations_tenant_phone_key UNIQUE (tenant_id, phone_number);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations (tenant_id);

COMMENT ON COLUMN conversations.tenant_id IS 'Owning tenant; conversations are keyed by (tenant_id, phone_number) (Req 5.5, 12.1).';

-- ---------------------------------------------------------------------------
-- close_events — one recorded closed deal per conversation (Req 9.3, 9.4, 9.5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS close_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- conversations.id is integer (SERIAL); reference it with the matching type.
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    phone_number    TEXT NOT NULL,
    deal_value      NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (deal_value >= 0),
    currency        CHAR(3) NOT NULL DEFAULT 'USD',
    closed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- At most one close event per conversation (Req 9.4).
    CONSTRAINT close_events_conversation_id_key UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_close_events_tenant_id ON close_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_close_events_tenant_phone ON close_events (tenant_id, phone_number);

COMMENT ON TABLE close_events IS 'Recorded closed deals; unique per conversation guarantees idempotent recording (Req 9.3-9.5).';

-- ---------------------------------------------------------------------------
-- follow_up_actions — post-close lifecycle steps (Req 10.1, 10.4)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follow_up_actions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    close_event_id  UUID NOT NULL REFERENCES close_events(id) ON DELETE CASCADE,
    action_type     TEXT NOT NULL,
    scheduled_for   TIMESTAMPTZ NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Exactly one action per (close event, step); supports idempotent scheduling/sending (Req 10.1, 10.4).
    CONSTRAINT follow_up_actions_event_step_key UNIQUE (close_event_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_follow_up_actions_tenant_id ON follow_up_actions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_actions_due ON follow_up_actions (status, scheduled_for);

COMMENT ON TABLE follow_up_actions IS 'Scheduled post-close follow-ups; marked completed once sent so they are not re-sent (Req 10.4).';

-- ---------------------------------------------------------------------------
-- customer_consent — consent and opt-out per customer (Req 18.1, 18.4)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_consent (
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone_number    TEXT NOT NULL,
    consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
    opted_out       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, phone_number)
);

COMMENT ON TABLE customer_consent IS 'Per-customer messaging consent and opt-out state; gates follow-ups (Req 18.1, 18.4).';

-- ---------------------------------------------------------------------------
-- inbound_queue — deferred (burst) inbound messages, spaced draining (Req 14.1, 14.4, 15.3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inbound_queue (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone_number  TEXT NOT NULL,
    message_id    TEXT NOT NULL,
    payload       JSONB NOT NULL,
    enqueued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforces >= 5s spacing between consecutive sends to one phone number (Req 14.4).
    process_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done'))
);

CREATE INDEX IF NOT EXISTS idx_inbound_queue_tenant_id ON inbound_queue (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbound_queue_drain ON inbound_queue (tenant_id, phone_number, status, process_after);

COMMENT ON TABLE inbound_queue IS 'Deferred inbound messages under burst load; never dropped, drained with spacing (Req 14.1, 14.4, 15.3).';

-- ---------------------------------------------------------------------------
-- updated_at maintenance triggers for new tables
-- (update_updated_at_column() is defined by migration 001)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_consent_updated_at ON customer_consent;
CREATE TRIGGER update_customer_consent_updated_at BEFORE UPDATE ON customer_consent
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
