-- AutoParts AI - Complete Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- INVENTORY TABLE
-- =====================
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_number VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  brand VARCHAR(100),
  category VARCHAR(100) NOT NULL,
  compatible_vehicles JSONB DEFAULT '[]', -- [{make, model, year_from, year_to}]
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2),
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  location VARCHAR(100), -- shelf/bin location
  supplier VARCHAR(255),
  supplier_part_number VARCHAR(100),
  images JSONB DEFAULT '[]',
  weight_kg DECIMAL(8,3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- CUSTOMERS TABLE
-- =====================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  vehicle_info JSONB DEFAULT '[]', -- [{make, model, year, registration}]
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  last_interaction TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- CONVERSATIONS TABLE
-- =====================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  whatsapp_number VARCHAR(20) NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, resolved, escalated
  messages JSONB DEFAULT '[]', -- [{role, content, timestamp}]
  context JSONB DEFAULT '{}', -- AI context/memory
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- ORDERS TABLE
-- =====================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  whatsapp_number VARCHAR(20),
  items JSONB NOT NULL DEFAULT '[]', -- [{part_id, part_number, name, quantity, price}]
  subtotal DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, processing, ready, delivered, cancelled
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid, refunded
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INQUIRY LOGS TABLE
-- =====================
CREATE TABLE inquiry_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whatsapp_number VARCHAR(20),
  customer_id UUID REFERENCES customers(id),
  message TEXT NOT NULL,
  ai_response TEXT,
  intent VARCHAR(100), -- part_inquiry, price_check, availability, order_status, other
  parts_mentioned JSONB DEFAULT '[]',
  resolved BOOLEAN DEFAULT false,
  escalated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- STOCK ALERTS TABLE
-- =====================
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id),
  part_number VARCHAR(100),
  part_name VARCHAR(255),
  current_quantity INTEGER,
  threshold INTEGER,
  alert_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INDEXES FOR PERFORMANCE
-- =====================
CREATE INDEX idx_inventory_part_number ON inventory(part_number);
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_quantity ON inventory(quantity);
CREATE INDEX idx_customers_whatsapp ON customers(whatsapp_number);
CREATE INDEX idx_conversations_whatsapp ON conversations(whatsapp_number);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_inquiry_logs_whatsapp ON inquiry_logs(whatsapp_number);

-- =====================
-- UPDATED_AT TRIGGER
-- =====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================
-- SEED DATA (Sample inventory)
-- =====================
INSERT INTO inventory (part_number, name, description, brand, category, compatible_vehicles, price, cost_price, quantity, low_stock_threshold, supplier) VALUES
('OIL-001', 'Engine Oil Filter', 'High-performance oil filter for extended drain intervals', 'Bosch', 'Filters', '[{"make":"Toyota","model":"Camry","year_from":2015,"year_to":2023},{"make":"Toyota","model":"Corolla","year_from":2014,"year_to":2023}]', 850.00, 450.00, 45, 10, 'Bosch Lanka'),
('BRK-001', 'Front Brake Pads Set', 'Ceramic brake pads, low dust, quiet operation', 'Brembo', 'Brakes', '[{"make":"Honda","model":"Civic","year_from":2016,"year_to":2022},{"make":"Honda","model":"Accord","year_from":2015,"year_to":2022}]', 4500.00, 2800.00, 12, 5, 'Brembo Distributors'),
('SPK-001', 'Iridium Spark Plug', 'Long life iridium spark plug, 100k km rated', 'NGK', 'Ignition', '[{"make":"Nissan","model":"X-Trail","year_from":2014,"year_to":2021},{"make":"Nissan","model":"Qashqai","year_from":2014,"year_to":2021}]', 1200.00, 700.00, 30, 8, 'NGK Lanka'),
('AIR-001', 'Air Filter', 'High flow air filter for improved performance', 'K&N', 'Filters', '[{"make":"Toyota","model":"Land Cruiser","year_from":2015,"year_to":2023},{"make":"Toyota","model":"Prado","year_from":2015,"year_to":2023}]', 3200.00, 1900.00, 8, 4, 'K&N Imports'),
('ALT-001', 'Alternator', 'OEM replacement alternator, 90A output', 'Denso', 'Electrical', '[{"make":"Toyota","model":"Corolla","year_from":2014,"year_to":2019}]', 28000.00, 18000.00, 3, 2, 'Denso Lanka'),
('RAD-001', 'Radiator', 'Aluminum core radiator, direct fit replacement', 'Nissens', 'Cooling', '[{"make":"Honda","model":"Civic","year_from":2012,"year_to":2016}]', 15000.00, 9500.00, 5, 2, 'Nissens Distributors'),
('SHK-001', 'Front Shock Absorber', 'Gas-filled shock absorber for improved handling', 'KYB', 'Suspension', '[{"make":"Toyota","model":"Hilux","year_from":2015,"year_to":2023}]', 8500.00, 5500.00, 6, 3, 'KYB Lanka'),
('TIM-001', 'Timing Belt Kit', 'Complete timing belt kit with tensioner and idler', 'Gates', 'Engine', '[{"make":"Mitsubishi","model":"Outlander","year_from":2013,"year_to":2020}]', 12000.00, 7500.00, 4, 2, 'Gates Imports');

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (your dashboard)
CREATE POLICY "Allow all for authenticated" ON inventory FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON customers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON conversations FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON inquiry_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON stock_alerts FOR ALL TO authenticated USING (true);

-- Allow service role (for API routes/webhooks)
CREATE POLICY "Allow service role" ON inventory FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role" ON customers FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role" ON conversations FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role" ON orders FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role" ON inquiry_logs FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role" ON stock_alerts FOR ALL TO service_role USING (true);