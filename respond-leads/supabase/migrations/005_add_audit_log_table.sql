-- Add audit_log table for persistent audit tracking
CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(100),
  resource_name VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  user_agent VARCHAR(255),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity VARCHAR(20) NOT NULL DEFAULT 'low',
  category VARCHAR(50) NOT NULL DEFAULT 'read',
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON audit_log (resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON audit_log (severity);
