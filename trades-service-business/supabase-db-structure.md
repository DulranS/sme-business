-- Create leads table
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_type TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  
  -- Plumbing-specific fields
  issue TEXT,
  urgency TEXT,
  
  -- Electrical-specific fields
  safety BOOLEAN,
  
  -- HVAC-specific fields
  system_type TEXT,
  
  -- Roofing-specific fields
  roof_type TEXT,
  
  -- General optional fields
  message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (recommended)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserts from your app (via service role in API route)
-- Since you're using service_role key in API, RLS won't block inserts
-- But if you ever read from frontend, you'll need select policies

-- Create index for performance
CREATE INDEX idx_leads_business_type ON leads (business_type);
CREATE INDEX idx_leads_created_at ON leads (created_at DESC);

-- Optional: Create a trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at 
  BEFORE UPDATE ON leads 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
