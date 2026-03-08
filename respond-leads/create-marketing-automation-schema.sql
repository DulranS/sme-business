-- MARKETING AUTOMATION SYSTEM - COMPLETE DATABASE SCHEMA

-- Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('whatsapp', 'email', 'sms', 'multi')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'failed')),
  automation_level VARCHAR(50) NOT NULL DEFAULT 'semi-automated' CHECK (automation_level IN ('manual', 'semi-automated', 'fully-automated')),
  
  -- Target Audience
  target_audience_id UUID REFERENCES audience_segments(id),
  
  -- Content (JSON)
  content JSONB NOT NULL DEFAULT '{}',
  
  -- Schedule (JSON)
  schedule JSONB NOT NULL DEFAULT '{}',
  
  -- Performance (JSON)
  performance JSONB NOT NULL DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "converted": 0, "bounced": 0, "unsubscribed": 0, "revenue": 0, "cost": 0, "roi": 0}',
  
  -- Settings (JSON)
  settings JSONB NOT NULL DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Created by
  created_by VARCHAR(255) NOT NULL,
  
  -- Constraints
  CONSTRAINT campaigns_name_unique UNIQUE(name),
  CONSTRAINT campaigns_status_check CHECK (
    (status = 'draft' AND started_at IS NULL AND completed_at IS NULL) OR
    (status = 'active' AND started_at IS NOT NULL AND completed_at IS NULL) OR
    (status = 'paused' AND started_at IS NOT NULL AND completed_at IS NULL) OR
    (status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL) OR
    (status = 'failed' AND started_at IS NOT NULL AND completed_at IS NOT NULL)
  )
);

-- Audience Segments Table
CREATE TABLE IF NOT EXISTS audience_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '{}',
  size INTEGER NOT NULL DEFAULT 0,
  estimated_reach INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT audience_segments_name_unique UNIQUE(name)
);

-- Customer Profiles Table
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact Information
  contact_info JSONB NOT NULL DEFAULT '{}',
  
  -- Demographics
  demographics JSONB NOT NULL DEFAULT '{}',
  
  -- Behavior
  behavior JSONB NOT NULL DEFAULT '{}',
  
  -- Preferences
  preferences JSONB NOT NULL DEFAULT '{}',
  
  -- Purchase History
  purchase_history JSONB NOT NULL DEFAULT '{}',
  
  -- Communication History
  communication_history JSONB NOT NULL DEFAULT '{}',
  
  -- Segments (Array of segment IDs)
  segments TEXT[] DEFAULT '{}',
  
  -- Tags
  tags TEXT[] DEFAULT '{}',
  
  -- Score (0-100)
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  
  -- Last Activity
  last_activity TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT customer_profiles_score_check CHECK (score >= 0 AND score <= 100)
);

-- Automation Workflows Table
CREATE TABLE IF NOT EXISTS automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  
  -- Workflow Definition (JSON)
  triggers JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  conditions JSONB NOT NULL DEFAULT '[]',
  settings JSONB NOT NULL DEFAULT '{}',
  
  -- Performance (JSON)
  performance JSONB NOT NULL DEFAULT '{"executions": 0, "successes": 0, "failures": 0, "averageTime": 0, "lastExecution": null}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT automation_workflows_name_unique UNIQUE(name)
);

-- Campaign Messages Table (for manual approval)
CREATE TABLE IF NOT EXISTS campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
  
  -- Message Content
  subject VARCHAR(255),
  body TEXT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  
  -- Approval Info
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  approved_by VARCHAR(255),
  
  -- Sending Info
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracking
  external_message_id VARCHAR(255),
  cost DECIMAL(10, 4),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Performance Metrics Table
CREATE TABLE IF NOT EXISTS campaign_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  metric VARCHAR(100) NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT campaign_performance_metric_check CHECK (metric IN ('sent', 'delivered', 'opened', 'clicked', 'converted', 'bounced', 'unsubscribed', 'revenue', 'cost'))
);

-- Workflow Performance Table
CREATE TABLE IF NOT EXISTS workflow_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES automation_workflows(id) ON DELETE CASCADE,
  result VARCHAR(50) NOT NULL CHECK (result IN ('success', 'failure', 'timeout')),
  execution_time_ms INTEGER,
  error_message TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automation Events Table
CREATE TABLE IF NOT EXISTS automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  source VARCHAR(100) NOT NULL,
  processed BOOLEAN DEFAULT false,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message Templates Table
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  content_type VARCHAR(50) DEFAULT 'text' CHECK (content_type IN ('text', 'html', 'rich')),
  variables TEXT[] DEFAULT '{}',
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT message_templates_name_unique UNIQUE(name)
);

-- Media Assets Table
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('image', 'video', 'document', 'audio')),
  url TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  alt_text TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by VARCHAR(255) NOT NULL
);

-- Manual Overrides Table
CREATE TABLE IF NOT EXISTS manual_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('campaign', 'workflow', 'message')),
  target_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('pause', 'stop', 'send', 'modify', 'approve', 'reject')),
  reason TEXT,
  applied_by VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  -- Unique constraint to prevent duplicate active overrides
  CONSTRAINT manual_overrides_unique_active UNIQUE(target_type, target_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(100),
  is_public BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(255)
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_target_audience ON campaigns(target_audience_id);

CREATE INDEX IF NOT EXISTS idx_audience_segments_active ON audience_segments(is_active);
CREATE INDEX IF NOT EXISTS idx_audience_segments_created_at ON audience_segments(created_at);

CREATE INDEX IF NOT EXISTS idx_customer_profiles_segments ON customer_profiles USING GIN(segments);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_tags ON customer_profiles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_score ON customer_profiles(score DESC);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_last_activity ON customer_profiles(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_contact_info ON customer_profiles USING GIN(contact_info);

CREATE INDEX IF NOT EXISTS idx_automation_workflows_status ON automation_workflows(status);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_created_at ON automation_workflows(created_at);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_id ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_customer_id ON campaign_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_status ON campaign_messages(status);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_scheduled_at ON campaign_messages(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_campaign_performance_campaign_id ON campaign_performance(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_performance_timestamp ON campaign_performance(timestamp);

CREATE INDEX IF NOT EXISTS idx_workflow_performance_workflow_id ON workflow_performance(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_performance_timestamp ON workflow_performance(timestamp);

CREATE INDEX IF NOT EXISTS idx_automation_events_processed ON automation_events(processed);
CREATE INDEX IF NOT EXISTS idx_automation_events_type ON automation_events(type);
CREATE INDEX IF NOT EXISTS idx_automation_events_timestamp ON automation_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_message_templates_active ON message_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);

CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(type);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploaded_at ON media_assets(uploaded_at);

CREATE INDEX IF NOT EXISTS idx_manual_overrides_target ON manual_overrides(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_manual_overrides_active ON manual_overrides(is_active);
CREATE INDEX IF NOT EXISTS idx_manual_overrides_applied_at ON manual_overrides(applied_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Basic - can be customized based on requirements)
-- Campaigns
CREATE POLICY "Enable read access for authenticated users" ON campaigns
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON campaigns
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON campaigns
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON campaigns
  FOR DELETE USING (auth.role() = 'authenticated');

-- Audience Segments
CREATE POLICY "Enable full access for authenticated users" ON audience_segments
  FOR ALL USING (auth.role() = 'authenticated');

-- Customer Profiles
CREATE POLICY "Enable full access for authenticated users" ON customer_profiles
  FOR ALL USING (auth.role() = 'authenticated');

-- Automation Workflows
CREATE POLICY "Enable full access for authenticated users" ON automation_workflows
  FOR ALL USING (auth.role() = 'authenticated');

-- Campaign Messages
CREATE POLICY "Enable full access for authenticated users" ON campaign_messages
  FOR ALL USING (auth.role() = 'authenticated');

-- Performance Tables
CREATE POLICY "Enable read access for authenticated users" ON campaign_performance
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON workflow_performance
  FOR SELECT USING (auth.role() = 'authenticated');

-- Automation Events
CREATE POLICY "Enable full access for authenticated users" ON automation_events
  FOR ALL USING (auth.role() = 'authenticated');

-- Message Templates
CREATE POLICY "Enable full access for authenticated users" ON message_templates
  FOR ALL USING (auth.role() = 'authenticated');

-- Media Assets
CREATE POLICY "Enable full access for authenticated users" ON media_assets
  FOR ALL USING (auth.role() = 'authenticated');

-- Manual Overrides
CREATE POLICY "Enable full access for authenticated users" ON manual_overrides
  FOR ALL USING (auth.role() = 'authenticated');

-- Audit Log (read-only for most users)
CREATE POLICY "Enable read access for authenticated users" ON audit_log
  FOR SELECT USING (auth.role() = 'authenticated');

-- System Settings (read-only for most users)
CREATE POLICY "Enable read access for authenticated users" ON system_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create Functions for Automatic Updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create Triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audience_segments_updated_at BEFORE UPDATE ON audience_segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_profiles_updated_at BEFORE UPDATE ON customer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_workflows_updated_at BEFORE UPDATE ON automation_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_messages_updated_at BEFORE UPDATE ON campaign_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert Default System Settings
INSERT INTO system_settings (key, value, description, category, is_public) VALUES
('automation_enabled', 'true', 'Enable/disable marketing automation engine', 'automation', true),
('default_timezone', 'UTC', 'Default timezone for scheduling', 'general', true),
('max_campaigns_per_day', '100', 'Maximum campaigns that can run per day', 'limits', false),
('rate_limit_per_hour', '1000', 'Maximum messages per hour', 'limits', false),
('gdpr_compliant', 'true', 'GDPR compliance mode', 'compliance', true),
('consent_required', 'true', 'Require explicit consent for marketing', 'compliance', true),
('data_retention_days', '730', 'Days to retain customer data', 'compliance', false),
('manual_approval_required', 'false', 'Require manual approval for campaigns', 'workflow', false),
('fallback_to_manual', 'true', 'Fallback to manual mode on automation failure', 'workflow', true)
ON CONFLICT (key) DO NOTHING;

-- Insert Default Message Templates
INSERT INTO message_templates (name, subject, body, language, content_type, category) VALUES
('Welcome Message', 'Welcome to our Business!', 'Hello {{customer_name}}, welcome to our business! We''re excited to have you with us.', 'en', 'text', 'welcome'),
('Promotional Offer', 'Special Offer Just for You!', 'Hi {{customer_name}}, we have a special offer for you: {{offer_details}}. Don''t miss out!', 'en', 'text', 'promotion'),
('Abandoned Cart', 'Complete Your Purchase', 'Hello {{customer_name}}, you left items in your cart. Complete your purchase now before they''re gone!', 'en', 'text', 'cart'),
('Re-engagement', 'We Miss You!', 'Hi {{customer_name}}, it''s been a while. Here''s a special offer to welcome you back: {{offer}}', 'en', 'text', 're-engagement')
ON CONFLICT (name) DO NOTHING;

-- Create Views for Common Queries
CREATE OR REPLACE VIEW campaign_summary AS
SELECT 
    c.id,
    c.name,
    c.type,
    c.status,
    c.created_at,
    c.started_at,
    c.completed_at,
    COALESCE(cp.sent, 0) as sent,
    COALESCE(cp.delivered, 0) as delivered,
    COALESCE(cp.opened, 0) as opened,
    COALESCE(cp.clicked, 0) as clicked,
    COALESCE(cp.converted, 0) as converted,
    COALESCE(cp.revenue, 0) as revenue,
    COALESCE(cp.cost, 0) as cost,
    CASE 
        WHEN cp.cost > 0 THEN ROUND((cp.revenue - cp.cost) / cp.cost * 100, 2)
        ELSE 0 
    END as roi_percentage
FROM campaigns c
LEFT JOIN LATERAL (
    SELECT 
        SUM(CASE WHEN metric = 'sent' THEN value ELSE 0 END) as sent,
        SUM(CASE WHEN metric = 'delivered' THEN value ELSE 0 END) as delivered,
        SUM(CASE WHEN metric = 'opened' THEN value ELSE 0 END) as opened,
        SUM(CASE WHEN metric = 'clicked' THEN value ELSE 0 END) as clicked,
        SUM(CASE WHEN metric = 'converted' THEN value ELSE 0 END) as converted,
        SUM(CASE WHEN metric = 'revenue' THEN value ELSE 0 END) as revenue,
        SUM(CASE WHEN metric = 'cost' THEN value ELSE 0 END) as cost
    FROM campaign_performance 
    WHERE campaign_id = c.id
) cp ON true;

CREATE OR REPLACE VIEW customer_summary AS
SELECT 
    cp.id,
    cp.contact_info->>'email' as email,
    cp.contact_info->>'phone' as phone,
    cp.demographics->>'age' as age,
    cp.demographics->>'location' as location,
    cp.score,
    cp.last_activity,
    cp.purchase_history->'totalOrders' as total_orders,
    cp.purchase_history->'totalSpent' as total_spent,
    cp.purchase_history->'avgOrderValue' as avg_order_value,
    cp.behavior->'engagementLevel' as engagement_level,
    cp.preferences->'preferredChannel' as preferred_channel,
    array_length(cp.segments, 1) as segment_count,
    array_length(cp.tags, 1) as tag_count
FROM customer_profiles cp;

-- Comments for Documentation
COMMENT ON TABLE campaigns IS 'Main campaigns table with all campaign details and performance metrics';
COMMENT ON TABLE audience_segments IS 'Customer audience segments for targeting campaigns';
COMMENT ON TABLE customer_profiles IS 'Comprehensive customer profiles with behavior, preferences, and history';
COMMENT ON TABLE automation_workflows IS 'Automation workflows with triggers, steps, and conditions';
COMMENT ON TABLE campaign_messages IS 'Individual campaign messages with approval workflow';
COMMENT ON TABLE campaign_performance IS 'Performance metrics tracking for campaigns';
COMMENT ON TABLE workflow_performance IS 'Performance metrics tracking for automation workflows';
COMMENT ON TABLE automation_events IS 'Events that trigger automation workflows';
COMMENT ON TABLE message_templates IS 'Reusable message templates for campaigns';
COMMENT ON TABLE media_assets IS 'Media files (images, videos, documents) for campaigns';
COMMENT ON TABLE manual_overrides IS 'Manual override controls for automation';
COMMENT ON TABLE audit_log IS 'Audit trail for all system changes';
COMMENT ON TABLE system_settings IS 'System-wide configuration settings';
