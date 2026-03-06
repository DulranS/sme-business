-- Multi-currency support migration
-- Run this in your Supabase SQL editor after the initial schema

-- Add currency columns to inventory table
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS price_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Add currency validation constraint
ALTER TABLE inventory 
ADD CONSTRAINT IF NOT EXISTS valid_currency 
CHECK (currency IN ('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL'));

-- Update existing records to have USD currency and price_usd
UPDATE inventory 
SET currency = 'USD', price_usd = price 
WHERE currency IS NULL OR price_usd = 0;

-- Update inventory stats view for multi-currency support
DROP VIEW IF EXISTS inventory_stats;
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

-- Grant access to updated view
GRANT SELECT ON inventory_stats TO anon, authenticated;

-- Create function to calculate USD equivalent
CREATE OR REPLACE FUNCTION calculate_usd_equivalent()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate if currency is not USD and price_usd is 0
    IF NEW.currency != 'USD' AND (NEW.price_usd = 0 OR OLD.price_usd = 0) THEN
        -- Simple exchange rates - in production, use real-time API
        NEW.price_usd = CASE NEW.currency
            WHEN 'EUR' THEN NEW.price / 0.85
            WHEN 'GBP' THEN NEW.price / 0.73
            WHEN 'JPY' THEN NEW.price / 110.0
            WHEN 'CAD' THEN NEW.price / 1.25
            WHEN 'AUD' THEN NEW.price / 1.35
            WHEN 'CHF' THEN NEW.price / 0.92
            WHEN 'CNY' THEN NEW.price / 6.45
            WHEN 'INR' THEN NEW.price / 74.5
            WHEN 'BRL' THEN NEW.price / 5.2
            ELSE NEW.price  -- Default to USD
        END;
    ELSIF NEW.currency = 'USD' THEN
        NEW.price_usd = NEW.price;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate USD equivalent
DROP TRIGGER IF EXISTS calculate_usd_trigger ON inventory;
CREATE TRIGGER calculate_usd_trigger
    BEFORE INSERT OR UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION calculate_usd_equivalent();
