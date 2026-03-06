-- Enterprise-grade database setup with monitoring and error tracking
-- Run this in your Supabase SQL editor after the basic setup

-- Error tracking table
CREATE TABLE IF NOT EXISTS error_logs (
  id VARCHAR(255) PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category VARCHAR(50) NOT NULL CHECK (category IN ('api', 'database', 'gmail', 'ai', 'authentication', 'validation', 'system')),
  message TEXT NOT NULL,
  stack TEXT,
  user_id UUID REFERENCES auth.users(id),
  lead_id UUID REFERENCES leads(id),
  message_id VARCHAR(255),
  context JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  identifier VARCHAR(255) PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  last_reset TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  unit VARCHAR(50),
  tags JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System health table
CREATE TABLE IF NOT EXISTS system_health (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  response_time_ms INTEGER,
  error_rate NUMERIC(5,2),
  last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email delivery tracking
CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id VARCHAR(255) NOT NULL,
  lead_id UUID REFERENCES leads(id),
  user_id UUID REFERENCES auth.users(id),
  email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('outbound', 'ai_reply', 'follow_up')),
  to_email VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')),
  delivery_timestamp TIMESTAMP WITH TIME ZONE,
  bounce_reason TEXT,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  reply_received BOOLEAN DEFAULT FALSE,
  reply_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI response quality tracking
CREATE TABLE IF NOT EXISTS ai_response_quality (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  user_id UUID REFERENCES auth.users(id),
  reply_intent VARCHAR(50),
  ai_response_generated BOOLEAN,
  ai_response_sent BOOLEAN,
  response_time_ms INTEGER,
  response_quality_score NUMERIC(3,2), -- 1-5 scale
  human_correction_required BOOLEAN DEFAULT FALSE,
  correction_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_timestamp ON performance_metrics(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_system_health_service ON system_health(service_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);
CREATE INDEX IF NOT EXISTS idx_system_health_last_check ON system_health(last_check);

CREATE INDEX IF NOT EXISTS idx_email_delivery_message_id ON email_delivery_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_lead_id ON email_delivery_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_status ON email_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_timestamp ON email_delivery_logs(delivery_timestamp);

CREATE INDEX IF NOT EXISTS idx_ai_quality_lead_id ON ai_response_quality(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_quality_intent ON ai_response_quality(reply_intent);
CREATE INDEX IF NOT EXISTS idx_ai_quality_timestamp ON ai_response_quality(created_at);

-- RLS Policies for new tables
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_response_quality ENABLE ROW LEVEL SECURITY;

-- Policies for error_logs (admin only)
CREATE POLICY "Admins can view all error logs" ON error_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Admins can insert error logs" ON error_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policies for audit_logs
CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policies for email_delivery_logs
CREATE POLICY "Users can view their own email logs" ON email_delivery_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all email logs" ON email_delivery_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policies for ai_response_quality
CREATE POLICY "Users can view their own AI quality logs" ON ai_response_quality
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all AI quality logs" ON ai_response_quality
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_error_logs_updated_at 
  BEFORE UPDATE ON error_logs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_updated_at 
  BEFORE UPDATE ON rate_limits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_delivery_logs_updated_at 
  BEFORE UPDATE ON email_delivery_logs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW error_summary AS
SELECT 
  severity,
  category,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE resolved = false) as unresolved_count,
  MAX(timestamp) as last_occurrence
FROM error_logs 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY severity, category;

CREATE OR REPLACE VIEW delivery_performance AS
SELECT 
  email_type,
  status,
  COUNT(*) as count,
  AVG(CASE WHEN reply_received THEN 1 ELSE 0 END) as reply_rate
FROM email_delivery_logs 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY email_type, status;

CREATE OR REPLACE VIEW ai_performance_summary AS
SELECT 
  reply_intent,
  COUNT(*) as total_responses,
  AVG(response_quality_score) as avg_quality,
  COUNT(*) FILTER (WHERE human_correction_required = true) as corrections_needed
FROM ai_response_quality 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY reply_intent;

-- Grant permissions for service role
GRANT ALL ON error_logs TO service_role;
GRANT ALL ON rate_limits TO service_role;
GRANT ALL ON performance_metrics TO service_role;
GRANT ALL ON audit_logs TO service_role;
GRANT ALL ON system_health TO service_role;
GRANT ALL ON email_delivery_logs TO service_role;
GRANT ALL ON ai_response_quality TO service_role;

GRANT SELECT ON error_summary TO service_role;
GRANT SELECT ON delivery_performance TO service_role;
GRANT SELECT ON ai_performance_summary TO service_role;
