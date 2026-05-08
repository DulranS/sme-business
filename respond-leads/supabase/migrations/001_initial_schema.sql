-- Initial schema for WhatsApp AI Customer Support System
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create inventory table with multi-currency support
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    price_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (price_usd >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (currency IN (
      'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL',
      'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU',
      'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RUB', 'TRY',
      'KRW', 'TWD', 'HKD', 'SGD', 'MYR', 'THB', 'VND', 'PHP', 'IDR', 'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'ILS', 'JOD', 'LBP',
      'NIS', 'LKR', 'PKR', 'BDT', 'NPR', 'AFN', 'MMK', 'LAK', 'KHR', 'MVR', 'BTN', 'GEL', 'AMD', 'AZN', 'KZT', 'KGS', 'UZS', 'TJS', 'TMT', 'MNT', 'KPW',
      'ZAR', 'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'EGP', 'MAD', 'DZD', 'TND',
      'NZD', 'FJD', 'PGK', 'SBD', 'VUV', 'WST', 'TOP',
      'JMD', 'TTD', 'BBD', 'BSD', 'BZD', 'GTQ', 'HNL', 'NIO', 'CRC', 'XCD',
      'BTC', 'ETH', 'USDT'
    ))
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    customer_name VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    history TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(phone_number)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory USING GIN (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory (sku);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory (quantity);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations (phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations (updated_at DESC);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data with multi-currency support (optional - remove in production)
INSERT INTO inventory (name, sku, quantity, price, currency, price_usd) VALUES
('Nike Air Max 90', 'NIKE-AIR-MAX-90', 15, 120.00, 'USD', 120.00),
('iPhone 15 Pro', 'APPLE-IPHONE-15-PRO', 8, 999.00, 'USD', 999.00),
('Red Summer Dress', 'DRESS-RED-SUMMER', 12, 45.99, 'USD', 45.99),
('Sony WH-1000XM5 Headphones', 'SONY-WH1000XM5', 5, 399.99, 'USD', 399.99),
('MacBook Air M2', 'APPLE-MACBOOK-AIR-M2', 3, 1299.00, 'USD', 1299.00),
('European Watch', 'WATCH-EURO-001', 8, 450.00, 'EUR', 485.50),
('Japanese Camera', 'CAM-JP-001', 6, 85000.00, 'JPY', 567.00),
('British Tea Set', 'TEA-UK-001', 10, 75.00, 'GBP', 95.00)
ON CONFLICT (sku) DO NOTHING;

-- Row Level Security (RLS) policies
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Policy for inventory (read-only for anon, full access for service role)
CREATE POLICY "Allow anonymous read access to inventory" ON inventory
    FOR SELECT USING (true);

CREATE POLICY "Allow service role full access to inventory" ON inventory
    FOR ALL USING (auth.role() = 'service_role');

-- Policy for conversations (service role only for privacy)
CREATE POLICY "Allow service role full access to conversations" ON conversations
    FOR ALL USING (auth.role() = 'service_role');

-- Create a function to safely truncate conversation history
CREATE OR REPLACE FUNCTION truncate_conversation_history()
RETURNS TRIGGER AS $$
BEGIN
    IF LENGTH(NEW.history) > 4000 THEN
        NEW.history = RIGHT(NEW.history, 4000);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger
CREATE TRIGGER truncate_conversation_history_trigger
    BEFORE INSERT OR UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION truncate_conversation_history();

-- Create view for low stock items
CREATE OR REPLACE VIEW low_inventory_items AS
SELECT 
    id,
    name,
    sku,
    quantity,
    price,
    CASE 
        WHEN quantity = 0 THEN 'OUT OF STOCK'
        WHEN quantity <= 5 THEN 'LOW STOCK'
        ELSE 'IN STOCK'
    END as status
FROM inventory
WHERE quantity <= 5
ORDER BY quantity ASC, name ASC;

-- Create view for inventory statistics with multi-currency support
CREATE OR REPLACE VIEW inventory_stats AS
SELECT 
    COUNT(*) as total_items,
    COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock,
    COUNT(CASE WHEN quantity > 0 AND quantity <= 5 THEN 1 END) as low_stock,
    SUM(quantity * price_usd) as total_value_usd,
    SUM(CASE WHEN currency = 'USD' THEN quantity * price ELSE 0 END) as total_value_native,
    COUNT(DISTINCT currency) as currency_count,
    AVG(price_usd) as avg_price_usd
FROM inventory;

-- Grant access to views
GRANT SELECT ON low_inventory_items TO anon, authenticated;
GRANT SELECT ON inventory_stats TO anon, authenticated;
