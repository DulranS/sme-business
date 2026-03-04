-- Create API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_name VARCHAR(255) NOT NULL,
  key_value TEXT NOT NULL,
  service VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP,
  UNIQUE(user_id, key_name)
);

-- Create Supply Tracking table
CREATE TABLE IF NOT EXISTS user_supplies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 5,
  last_restocked TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, part_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON api_keys(service);
CREATE INDEX IF NOT EXISTS idx_user_supplies_user_id ON user_supplies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_supplies_part_id ON user_supplies(part_id);

-- Enable RLS (Row Level Security)
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_supplies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_keys
CREATE POLICY "Users can view their own API keys"
  ON api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys"
  ON api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON api_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for user_supplies
CREATE POLICY "Users can view their own supplies"
  ON user_supplies
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own supplies"
  ON user_supplies
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supplies"
  ON user_supplies
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supplies"
  ON user_supplies
  FOR DELETE
  USING (auth.uid() = user_id);
