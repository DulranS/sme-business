-- Migration 007: Tenant Row Level Security policies and tenant role
-- Feature: respond-leadz, Task 1.2 — Add RLS policies and FORCE ROW LEVEL SECURITY migration
--
-- Purpose
--   Enforce strict per-tenant data isolation at the database layer (Requirement 12.3).
--   This migration:
--     * creates a non-superuser `respondleadz_tenant` role used for all tenant-scoped
--       reads/writes (the RLS-enforced connection). The Supabase service role is NOT used
--       for tenant-scoped access because it bypasses RLS.
--     * enables AND forces RLS on every tenant-scoped table so policies apply even to the
--       table owner (`ENABLE` + `FORCE ROW LEVEL SECURITY`).
--     * adds a `tenant_isolation` policy on each table whose USING/WITH CHECK clauses are
--       keyed on `current_setting('app.current_tenant', true)::uuid`.
--
-- Requirements: 12.2, 12.3, 12.4, 12.6
--
-- Isolation semantics
--   * Each request opens a transaction and runs `SET LOCAL app.current_tenant = '<uuid>'`.
--   * `current_setting('app.current_tenant', true)` returns NULL when the GUC is unset; the
--     comparison `tenant_id = NULL` then evaluates to NULL (not TRUE), so NO rows are visible
--     and NO writes are permitted without an explicit tenant context. This satisfies
--     "deny all when isolation cannot be established" (Requirements 12.4, 12.6).
--   * USING enforces read/visibility scoping (Requirement 12.2); WITH CHECK prevents writing
--     or moving a row into another tenant (Requirement 12.6).
--
-- Tenant-scoped tables
--   tenants (keyed on id), inventory, conversations, close_events, follow_up_actions,
--   customer_consent, inbound_queue (each keyed on tenant_id).

BEGIN;

-- ---------------------------------------------------------------------------
-- Non-superuser tenant role (Requirement 12.3)
--   NOLOGIN by default; the application connection role is GRANTed this role, or a
--   password is set out-of-band by the operator. It deliberately has no BYPASSRLS,
--   no SUPERUSER, so FORCE ROW LEVEL SECURITY policies always apply to it.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'respondleadz_tenant') THEN
        CREATE ROLE respondleadz_tenant NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOLOGIN;
    END IF;
END
$$;

COMMENT ON ROLE respondleadz_tenant IS
    'Non-superuser role for tenant-scoped access; RLS policies always apply (no BYPASSRLS). Used by the app connection that runs SET LOCAL app.current_tenant per request (Req 12.3).';

-- Schema + table privileges for the tenant role. RLS still constrains which rows are
-- visible/writable; these grants only allow the role to attempt the operations.
GRANT USAGE ON SCHEMA public TO respondleadz_tenant;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    tenants,
    inventory,
    conversations,
    close_events,
    follow_up_actions,
    customer_consent,
    inbound_queue
TO respondleadz_tenant;

-- The migrated `inventory` and `conversations` tables use SERIAL/integer primary keys,
-- so the tenant role needs access to their sequences to INSERT.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO respondleadz_tenant;

-- ---------------------------------------------------------------------------
-- tenants — keyed on id (a tenant may only see/modify its own identity + credentials)
-- (Requirements 12.2, 12.6, and per-tenant credential isolation 13.4)
-- ---------------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
    USING (id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (id = current_setting('app.current_tenant', true)::uuid);

-- ---------------------------------------------------------------------------
-- inventory
-- ---------------------------------------------------------------------------
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON inventory;
CREATE POLICY tenant_isolation ON inventory
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON conversations;
CREATE POLICY tenant_isolation ON conversations
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ---------------------------------------------------------------------------
-- close_events
-- ---------------------------------------------------------------------------
ALTER TABLE close_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE close_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON close_events;
CREATE POLICY tenant_isolation ON close_events
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ---------------------------------------------------------------------------
-- follow_up_actions
-- ---------------------------------------------------------------------------
ALTER TABLE follow_up_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_actions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON follow_up_actions;
CREATE POLICY tenant_isolation ON follow_up_actions
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ---------------------------------------------------------------------------
-- customer_consent
-- ---------------------------------------------------------------------------
ALTER TABLE customer_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_consent FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON customer_consent;
CREATE POLICY tenant_isolation ON customer_consent
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ---------------------------------------------------------------------------
-- inbound_queue
-- ---------------------------------------------------------------------------
ALTER TABLE inbound_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_queue FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON inbound_queue;
CREATE POLICY tenant_isolation ON inbound_queue
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Ensure future sequences created in this migration are also usable by the tenant role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO respondleadz_tenant;

COMMIT;
