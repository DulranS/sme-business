-- Add lead scoring and conversion tracking for maximum business value
-- This enables SMEs to track which conversations convert to sales

-- Add lead scoring fields to conversations table
ALTER TABLE conversations
ADD COLUMN lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
ADD COLUMN lead_status VARCHAR(20) DEFAULT 'new' CHECK (lead_status IN ('new', 'qualified', 'contacted', 'converted', 'lost')),
ADD COLUMN conversion_value DECIMAL(10,2) DEFAULT 0.00 CHECK (conversion_value >= 0),
ADD COLUMN conversion_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_interaction_type VARCHAR(20) DEFAULT 'inquiry' CHECK (last_interaction_type IN ('inquiry', 'follow_up', 'negotiation', 'purchase', 'complaint')),
ADD COLUMN priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Create leads table for better tracking
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    customer_name VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'qualified', 'contacted', 'converted', 'lost')),
    estimated_value DECIMAL(10,2) DEFAULT 0.00,
    conversion_probability DECIMAL(5,2) DEFAULT 0.00 CHECK (conversion_probability >= 0 AND conversion_probability <= 1),
    last_message TEXT,
    next_follow_up TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    converted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(conversation_id)
);

-- Create lead scoring rules table
CREATE TABLE IF NOT EXISTS lead_scoring_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    score_increase INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default lead scoring rules
INSERT INTO lead_scoring_rules (rule_name, keywords, score_increase) VALUES
('Price Inquiry', ARRAY['price', 'cost', 'how much', 'budget', 'afford'], 15),
('Quantity Inquiry', ARRAY['stock', 'available', 'quantity', 'in stock', 'have'], 10),
('Purchase Intent', ARRAY['buy', 'purchase', 'order', 'interested', 'want'], 25),
('Urgency Signals', ARRAY['urgent', 'asap', 'quickly', 'soon', 'today'], 20),
('Competition Mention', ARRAY['competitor', 'other company', 'elsewhere', 'cheaper'], 15),
('Follow-up Request', ARRAY['call back', 'contact', 'reach out', 'follow up'], 10),
('Complaints', ARRAY['problem', 'issue', 'wrong', 'bad', 'disappointed'], -10);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_conversation_id ON leads (conversation_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads (lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads (next_follow_up);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_score ON conversations (lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_status ON conversations (lead_status);

-- Create function to automatically score leads based on conversation content
CREATE OR REPLACE FUNCTION calculate_lead_score(conversation_history TEXT)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    rule RECORD;
    keyword TEXT;
BEGIN
    -- Base score for any conversation
    score := 5;

    -- Check each scoring rule
    FOR rule IN SELECT * FROM lead_scoring_rules WHERE is_active = true LOOP
        FOREACH keyword IN ARRAY rule.keywords LOOP
            IF conversation_history ILIKE '%' || keyword || '%' THEN
                score := score + rule.score_increase;
                EXIT; -- Only count each keyword once per rule
            END IF;
        END LOOP;
    END LOOP;

    -- Cap at 100
    IF score > 100 THEN
        score := 100;
    END IF;

    -- Minimum score of 0
    IF score < 0 THEN
        score := 0;
    END IF;

    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Create function to update lead status based on score
CREATE OR REPLACE FUNCTION update_lead_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update lead score
    NEW.lead_score := calculate_lead_score(NEW.history);

    -- Update lead status based on score and history
    IF NEW.lead_score >= 70 THEN
        NEW.lead_status := 'qualified';
        NEW.priority := 'high';
    ELSIF NEW.lead_score >= 40 THEN
        NEW.lead_status := 'contacted';
        NEW.priority := 'medium';
    ELSIF NEW.lead_score >= 20 THEN
        NEW.lead_status := 'new';
        NEW.priority := 'medium';
    ELSE
        NEW.lead_status := 'new';
        NEW.priority := 'low';
    END IF;

    -- If conversion value is set, mark as converted
    IF NEW.conversion_value > 0 AND NEW.conversion_date IS NOT NULL THEN
        NEW.lead_status := 'converted';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update lead scores
CREATE TRIGGER trigger_update_lead_score
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    WHEN (OLD.history IS DISTINCT FROM NEW.history)
    EXECUTE FUNCTION update_lead_status();

-- Create function to sync leads table
CREATE OR REPLACE FUNCTION sync_leads_table()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update lead record
    INSERT INTO leads (
        conversation_id,
        phone_number,
        customer_name,
        lead_score,
        status,
        last_message,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.phone_number,
        NEW.customer_name,
        NEW.lead_score,
        NEW.lead_status,
        (SELECT split_part(NEW.history, '\n', -1)),
        NOW()
    ) ON CONFLICT (conversation_id) DO UPDATE SET
        lead_score = EXCLUDED.lead_score,
        status = EXCLUDED.status,
        last_message = EXCLUDED.last_message,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync leads table
CREATE TRIGGER trigger_sync_leads
    AFTER INSERT OR UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION sync_leads_table();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON leads TO anon, authenticated;
GRANT SELECT ON lead_scoring_rules TO anon, authenticated;

-- Add comments
COMMENT ON COLUMN conversations.lead_score IS 'AI-calculated lead score (0-100) based on conversation content';
COMMENT ON COLUMN conversations.lead_status IS 'Lead status: new, qualified, contacted, converted, lost';
COMMENT ON COLUMN conversations.conversion_value IS 'Monetary value of conversion';
COMMENT ON COLUMN conversations.conversion_date IS 'Date when conversion occurred';
COMMENT ON COLUMN conversations.last_interaction_type IS 'Type of last customer interaction';
COMMENT ON COLUMN conversations.priority IS 'Lead priority: low, medium, high, urgent';

COMMENT ON TABLE leads IS 'Dedicated leads table for advanced lead management and CRM integration';
COMMENT ON TABLE lead_scoring_rules IS 'Configurable rules for automatic lead scoring';