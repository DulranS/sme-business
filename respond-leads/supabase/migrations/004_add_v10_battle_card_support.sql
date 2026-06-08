-- V10 Blueprint: Add battle card and store config support
-- This migration adds the necessary columns for the two-channel battle card architecture

-- Add store config columns to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS store_name TEXT,
ADD COLUMN IF NOT EXISTS store_hours TEXT,
ADD COLUMN IF NOT EXISTS store_location TEXT,
ADD COLUMN IF NOT EXISTS store_contact TEXT,
ADD COLUMN IF NOT EXISTS return_policy TEXT,
ADD COLUMN IF NOT EXISTS shipping_info TEXT,
ADD COLUMN IF NOT EXISTS payment_methods TEXT,
ADD COLUMN IF NOT EXISTS additional_info TEXT;

-- Add battle card tracking columns
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS battle_card_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS battle_card_content TEXT,
ADD COLUMN IF NOT EXISTS battle_card_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closer_phone_number TEXT,
ADD COLUMN IF NOT EXISTS blueprint_version TEXT DEFAULT 'V10';

-- Add conversation analytics table for V10 metrics
CREATE TABLE IF NOT EXISTS conversation_analytics (
  id BIGSERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  search_keyword TEXT,
  inventory_results_count INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  battle_card_generated BOOLEAN DEFAULT FALSE,
  customer_reply_sent BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  blueprint_version TEXT DEFAULT 'V10'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_blueprint_version ON conversations(blueprint_version);
CREATE INDEX IF NOT EXISTS idx_conversations_battle_card ON conversations(battle_card_generated);
CREATE INDEX IF NOT EXISTS idx_analytics_phone_number ON conversation_analytics(phone_number);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON conversation_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_keyword ON conversation_analytics(search_keyword);

-- Add comments for documentation
COMMENT ON COLUMN conversations.store_name IS 'Business name for customer responses';
COMMENT ON COLUMN conversations.store_hours IS 'Business operating hours';
COMMENT ON COLUMN conversations.store_location IS 'Physical store location';
COMMENT ON COLUMN conversations.store_contact IS 'Contact information (phone, email)';
COMMENT ON COLUMN conversations.return_policy IS 'Product return policy';
COMMENT ON COLUMN conversations.shipping_info IS 'Shipping options and costs';
COMMENT ON COLUMN conversations.payment_methods IS 'Accepted payment methods';
COMMENT ON COLUMN conversations.additional_info IS 'Additional business information';
COMMENT ON COLUMN conversations.battle_card_generated IS 'Whether battle card was generated for this conversation';
COMMENT ON COLUMN conversations.battle_card_content IS 'Generated battle card content for sales team';
COMMENT ON COLUMN conversations.battle_card_sent_at IS 'Timestamp when battle card was sent to closer';
COMMENT ON COLUMN conversations.closer_phone_number IS 'WhatsApp number of the sales closer';
COMMENT ON COLUMN conversations.blueprint_version IS 'Blueprint version used (V6, V9, V10, etc.)';

-- Create a function to update blueprint version for existing records
CREATE OR REPLACE FUNCTION set_blueprint_version()
RETURNS VOID AS $$
BEGIN
  UPDATE conversations 
  SET blueprint_version = 'V10' 
  WHERE blueprint_version IS NULL OR blueprint_version = '';
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT set_blueprint_version();
