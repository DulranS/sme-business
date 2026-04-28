-- Multi-currency support migration
-- Run this in your Supabase SQL editor after the initial schema

-- Remove legacy currency constraint if it exists
ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_currency_check;

-- Add currency columns to inventory table
ALTER TABLE inventory 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS price_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Add currency validation constraint for all supported currencies
ALTER TABLE inventory 
ADD CONSTRAINT IF NOT EXISTS valid_currency 
CHECK (currency IN (
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR',
  'CAD', 'AUD', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU',
  'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RUB', 'TRY',
  'KRW', 'TWD', 'HKD', 'SGD', 'MYR', 'THB', 'VND', 'PHP', 'IDR', 'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'ILS', 'JOD', 'LBP',
  'ZAR', 'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'EGP', 'MAD', 'DZD', 'TND',
  'NZD', 'FJD', 'PGK', 'SBD', 'VUV', 'WST', 'TOP',
  'JMD', 'TTD', 'BBD', 'BSD', 'BZD', 'GTQ', 'HNL', 'NIO', 'CRC', 'XCD',
  'NIS', 'LKR', 'PKR', 'BDT', 'NPR', 'AFN', 'MMK', 'LAK', 'KHR', 'MVR', 'BTN', 'GEL', 'AMD', 'AZN', 'KZT', 'KGS', 'UZS', 'TJS', 'TMT', 'MNT', 'KPW',
  'BTC', 'ETH', 'USDT'
));

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

-- Create function to calculate USD equivalent for all currencies
CREATE OR REPLACE FUNCTION calculate_usd_equivalent()
RETURNS TRIGGER AS $$
BEGIN
    -- Only calculate if currency is not USD and price_usd is 0
    IF NEW.currency != 'USD' AND (NEW.price_usd = 0 OR OLD.price_usd = 0) THEN
        -- Comprehensive exchange rates for all supported currencies
        NEW.price_usd = CASE NEW.currency
            -- Americas
            WHEN 'CAD' THEN NEW.price / 1.25
            WHEN 'AUD' THEN NEW.price / 1.35
            WHEN 'BRL' THEN NEW.price / 5.2
            WHEN 'MXN' THEN NEW.price / 20.1
            WHEN 'ARS' THEN NEW.price / 98.5
            WHEN 'CLP' THEN NEW.price / 790.0
            WHEN 'COP' THEN NEW.price / 3800.0
            WHEN 'PEN' THEN NEW.price / 3.75
            WHEN 'UYU' THEN NEW.price / 44.0
            WHEN 'JMD' THEN NEW.price / 150.0
            WHEN 'TTD' THEN NEW.price / 6.8
            WHEN 'BBD' THEN NEW.price / 2.0
            WHEN 'BSD' THEN NEW.price / 1.0
            WHEN 'BZD' THEN NEW.price / 2.0
            WHEN 'GTQ' THEN NEW.price / 7.7
            WHEN 'HNL' THEN NEW.price / 24.0
            WHEN 'NIO' THEN NEW.price / 35.0
            WHEN 'CRC' THEN NEW.price / 610.0
            WHEN 'XCD' THEN NEW.price / 2.7
            
            -- Europe
            WHEN 'EUR' THEN NEW.price / 0.85
            WHEN 'GBP' THEN NEW.price / 0.73
            WHEN 'CHF' THEN NEW.price / 0.92
            WHEN 'SEK' THEN NEW.price / 8.6
            WHEN 'NOK' THEN NEW.price / 8.4
            WHEN 'DKK' THEN NEW.price / 6.3
            WHEN 'PLN' THEN NEW.price / 3.9
            WHEN 'CZK' THEN NEW.price / 21.8
            WHEN 'HUF' THEN NEW.price / 295.0
            WHEN 'RON' THEN NEW.price / 4.1
            WHEN 'BGN' THEN NEW.price / 1.6
            WHEN 'HRK' THEN NEW.price / 6.3
            WHEN 'RUB' THEN NEW.price / 74.0
            WHEN 'TRY' THEN NEW.price / 8.9
            
            -- Asia & Middle East
            WHEN 'JPY' THEN NEW.price / 110.0
            WHEN 'CNY' THEN NEW.price / 6.45
            WHEN 'INR' THEN NEW.price / 74.5
            WHEN 'KRW' THEN NEW.price / 1180.0
            WHEN 'TWD' THEN NEW.price / 28.0
            WHEN 'HKD' THEN NEW.price / 7.8
            WHEN 'SGD' THEN NEW.price / 1.35
            WHEN 'MYR' THEN NEW.price / 4.2
            WHEN 'THB' THEN NEW.price / 31.5
            WHEN 'VND' THEN NEW.price / 23000.0
            WHEN 'PHP' THEN NEW.price / 50.0
            WHEN 'IDR' THEN NEW.price / 14500.0
            WHEN 'SAR' THEN NEW.price / 3.75
            WHEN 'AED' THEN NEW.price / 3.67
            WHEN 'QAR' THEN NEW.price / 3.64
            WHEN 'KWD' THEN NEW.price / 0.30
            WHEN 'BHD' THEN NEW.price / 0.38
            WHEN 'OMR' THEN NEW.price / 0.38
            WHEN 'ILS' THEN NEW.price / 3.2
            WHEN 'JOD' THEN NEW.price / 0.71
            WHEN 'LBP' THEN NEW.price / 1500.0
            WHEN 'NIS' THEN NEW.price / 3.2
            WHEN 'LKR' THEN NEW.price / 200.0
            WHEN 'PKR' THEN NEW.price / 160.0
            WHEN 'BDT' THEN NEW.price / 85.0
            WHEN 'NPR' THEN NEW.price / 120.0
            WHEN 'AFN' THEN NEW.price / 85.0
            WHEN 'MMK' THEN NEW.price / 1650.0
            WHEN 'LAK' THEN NEW.price / 9500.0
            WHEN 'KHR' THEN NEW.price / 4100.0
            WHEN 'MVR' THEN NEW.price / 15.4
            WHEN 'BTN' THEN NEW.price / 74.5
            WHEN 'GEL' THEN NEW.price / 3.3
            WHEN 'AMD' THEN NEW.price / 520.0
            WHEN 'AZN' THEN NEW.price / 1.7
            WHEN 'KZT' THEN NEW.price / 425.0
            WHEN 'KGS' THEN NEW.price / 85.0
            WHEN 'UZS' THEN NEW.price / 10500.0
            WHEN 'TJS' THEN NEW.price / 11.0
            WHEN 'TMT' THEN NEW.price / 3.4
            WHEN 'MNT' THEN NEW.price / 2850.0
            WHEN 'KPW' THEN NEW.price / 900.0
            
            -- Africa
            WHEN 'ZAR' THEN NEW.price / 15.0
            WHEN 'NGN' THEN NEW.price / 410.0
            WHEN 'GHS' THEN NEW.price / 5.9
            WHEN 'KES' THEN NEW.price / 110.0
            WHEN 'UGX' THEN NEW.price / 3700.0
            WHEN 'TZS' THEN NEW.price / 2300.0
            WHEN 'EGP' THEN NEW.price / 15.7
            WHEN 'MAD' THEN NEW.price / 9.0
            WHEN 'DZD' THEN NEW.price / 135.0
            WHEN 'TND' THEN NEW.price / 2.9
            
            -- Oceania
            WHEN 'NZD' THEN NEW.price / 1.4
            WHEN 'FJD' THEN NEW.price / 2.1
            WHEN 'PGK' THEN NEW.price / 3.5
            WHEN 'SBD' THEN NEW.price / 8.0
            WHEN 'VUV' THEN NEW.price / 110.0
            WHEN 'WST' THEN NEW.price / 2.6
            WHEN 'TOP' THEN NEW.price / 2.3
            
            -- Cryptocurrencies
            WHEN 'BTC' THEN NEW.price / 0.000023
            WHEN 'ETH' THEN NEW.price / 0.00031
            WHEN 'USDT' THEN NEW.price / 1.0
            ELSE NEW.price  -- Default to USD for unknown currencies
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
