-- Add last_message_id field to conversations table
-- Required for blueprint deduplication logic

-- Add the missing column
ALTER TABLE conversations 
ADD COLUMN last_message_id VARCHAR(100);

-- Create index for better performance on message ID lookups
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_id ON conversations(last_message_id);

-- Update the view to include the new field
DROP VIEW IF EXISTS conversation_details;
CREATE OR REPLACE VIEW conversation_details AS
SELECT 
    c.id,
    c.phone_number,
    c.customer_name,
    c.last_message_id,
    c.history,
    c.created_at,
    c.updated_at,
    -- Count messages in history (simple parsing)
    (LENGTH(c.history) - LENGTH(REPLACE(c.history, '[Customer]:', ''))) / 11 as customer_message_count
FROM conversations c;

-- Grant access to the updated view
GRANT SELECT ON conversation_details TO anon, authenticated;

-- Add comment for documentation
COMMENT ON COLUMN conversations.last_message_id IS 'WhatsApp message ID for deduplication - prevents double replies on webhook retries';
