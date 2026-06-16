-- ──────────────────────────────────────────────
-- Run this in your Supabase SQL editor
-- ──────────────────────────────────────────────

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL UNIQUE,
    customer_name TEXT DEFAULT 'Unknown',
    history TEXT DEFAULT '',
    last_message_id TEXT DEFAULT '',
    store_name TEXT,
    store_hours TEXT,
    store_location TEXT,
    store_contact TEXT,
    return_policy TEXT,
    shipping_info TEXT,
    payment_methods TEXT,
    additional_info TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_phone ON conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);


-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    quantity INTEGER DEFAULT 0,
    price NUMERIC(10,2),
    sku TEXT UNIQUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigram index for fast ilike search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_inv_name ON inventory USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inv_sku ON inventory(sku);


-- ──────────────────────────────────────────────
-- RAG (optional — requires pgvector extension)
-- Uncomment if USE_RAG=true
-- ──────────────────────────────────────────────

-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE inventory ADD COLUMN IF NOT EXISTS embedding vector(384);
-- CREATE INDEX IF NOT EXISTS idx_inv_embedding
--     ON inventory USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);

-- RAG search function
-- CREATE OR REPLACE FUNCTION match_inventory(query_text TEXT, match_count INT DEFAULT 5)
-- RETURNS TABLE(
--     id BIGINT,
--     name TEXT,
--     description TEXT,
--     quantity INT,
--     price NUMERIC,
--     sku TEXT,
--     similarity FLOAT
-- ) AS $$
-- BEGIN
--     RETURN QUERY
--     SELECT i.id, i.name, i.description, i.quantity, i.price, i.sku,
--            1 - (i.embedding <=> ai.embed(query_text)) AS similarity
--     FROM inventory i
--     ORDER BY i.embedding <=> ai.embed(query_text)
--     LIMIT match_count;
-- END;
-- $$ LANGUAGE plpgsql;