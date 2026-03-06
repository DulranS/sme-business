-- AI Reply Handling & Follow-up Automation System
-- Run this in your Supabase SQL editor

-- Lead conversations table - tracks all email threads per lead
CREATE TABLE IF NOT EXISTS lead_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  thread_id VARCHAR(255) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('outbound', 'inbound', 'ai_reply')),
  intent_classification VARCHAR(50) CHECK (intent_classification IN ('interested', 'not_interested', 'needs_more_info', 'out_of_office', 'unsubscribe', 'unknown')),
  ai_response_generated BOOLEAN DEFAULT FALSE,
  ai_response_sent BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(thread_id, message_id)
);

-- Follow-up schedule table - stores scheduled follow-up dates and status
CREATE TABLE IF NOT EXISTS follow_up_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  follow_up_number INTEGER NOT NULL CHECK (follow_up_number IN (1, 2, 3)),
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'skipped', 'cancelled')),
  email_content TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  ai_generated BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(lead_id, follow_up_number)
);

-- Add columns to existing leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'cold' CHECK (status IN ('cold', 'warm', 'hot', 'closed', 'unsubscribed')),
ADD COLUMN IF NOT EXISTS last_reply_intent VARCHAR(50) CHECK (last_reply_intent IN ('interested', 'not_interested', 'needs_more_info', 'out_of_office', 'unsubscribe', 'unknown')),
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_replies INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_conversation_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_ai_response_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS out_of_office_until TIMESTAMP WITH TIME ZONE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_conversations_lead_id ON lead_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversations_thread_id ON lead_conversations(thread_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversations_processed_at ON lead_conversations(processed_at);
CREATE INDEX IF NOT EXISTS idx_follow_up_schedule_lead_id ON follow_up_schedule(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_schedule_scheduled_for ON follow_up_schedule(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_follow_up_schedule_status ON follow_up_schedule(status);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_last_contacted_at ON leads(last_contacted_at);

-- RLS Policies (if you use Row Level Security)
ALTER TABLE lead_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_schedule ENABLE ROW LEVEL SECURITY;

-- Policy for lead_conversations
CREATE POLICY "Users can view their own lead conversations" ON lead_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = lead_conversations.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own lead conversations" ON lead_conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = lead_conversations.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own lead conversations" ON lead_conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = lead_conversations.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

-- Policy for follow_up_schedule
CREATE POLICY "Users can view their own follow-up schedules" ON follow_up_schedule
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = follow_up_schedule.lead_id 
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own follow-up schedules" ON follow_up_schedule
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM leads 
      WHERE leads.id = follow_up_schedule.lead_id 
      AND leads.user_id = auth.uid()
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
CREATE TRIGGER update_lead_conversations_updated_at 
  BEFORE UPDATE ON lead_conversations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_up_schedule_updated_at 
  BEFORE UPDATE ON follow_up_schedule 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
