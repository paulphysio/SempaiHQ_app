-- Add benefactor status columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_benefactor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS benefactor_since TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS benefactor_level TEXT DEFAULT 'bronze',
ADD COLUMN IF NOT EXISTS total_benefactor_payments NUMERIC DEFAULT 0;

-- Create index for benefactor queries
CREATE INDEX IF NOT EXISTS idx_users_is_benefactor ON users(is_benefactor) WHERE is_benefactor = TRUE;

-- Update existing benefactor status based on benefactor_early_access table
UPDATE users u
SET 
    is_benefactor = TRUE,
    benefactor_since = LEAST(u.benefactor_since, bea.first_payment),
    benefactor_level = CASE 
        WHEN bea.total_contribution >= 50 THEN 'platinum'
        WHEN bea.total_contribution >= 20 THEN 'gold'
        WHEN bea.total_contribution >= 10 THEN 'silver'
        ELSE 'bronze'
    END,
    total_benefactor_payments = bea.total_contribution
FROM (
    SELECT 
        benefactor_wallet,
        SUM(payment_amount) as total_contribution,
        MIN(paid_at) as first_payment
    FROM benefactor_early_access 
    WHERE is_active = TRUE
    GROUP BY benefactor_wallet
) bea
WHERE u.wallet_address = bea.benefactor_wallet;

-- Create view for benefactor statistics
CREATE OR REPLACE VIEW benefactor_stats AS
SELECT 
    u.id,
    u.wallet_address,
    u.name as username,
    u.total_benefactor_payments,
    u.benefactor_level,
    u.benefactor_since,
    COUNT(DISTINCT bea.novel_id) AS novels_supported,
    COUNT(DISTINCT bea.id) AS total_benefactor_purchases,
    MAX(bea.paid_at) AS last_purchase_date
FROM users u
LEFT JOIN benefactor_early_access bea ON bea.benefactor_wallet = u.wallet_address
WHERE u.total_benefactor_payments > 0
GROUP BY 
    u.id, u.wallet_address, u.name, u.total_benefactor_payments, 
    u.benefactor_level, u.benefactor_since;

-- Create function to get benefactor leaderboard
CREATE OR REPLACE FUNCTION get_benefactor_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    rank INTEGER,
    user_id UUID,
    username VARCHAR,
    total_contribution DECIMAL(10,2),
    tier VARCHAR,
    novels_supported INTEGER,
    last_purchase_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY total_benefactor_payments DESC) as rank,
        id as user_id,
        name as username,
        total_benefactor_payments as total_contribution,
        benefactor_level as tier,
        (SELECT COUNT(DISTINCT novel_id) FROM benefactor_early_access WHERE benefactor_wallet = users.wallet_address) as novels_supported,
        (SELECT MAX(paid_at) FROM benefactor_early_access WHERE benefactor_wallet = users.wallet_address) as last_purchase_date
    FROM users 
    WHERE total_benefactor_payments > 0
    ORDER BY total_benefactor_payments DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to update benefactor level
CREATE OR REPLACE FUNCTION update_benefactor_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Update benefactor level based on total payments
    NEW.benefactor_level = CASE 
        WHEN NEW.total_benefactor_payments >= 50 THEN 'platinum'
        WHEN NEW.total_benefactor_payments >= 20 THEN 'gold'
        WHEN NEW.total_benefactor_payments >= 10 THEN 'silver'
        ELSE 'bronze'
    END;
    
    -- Set benefactor status
    NEW.is_benefactor = (NEW.total_benefactor_payments > 0);
    
    -- Set benefactor since if not already set
    IF NEW.is_benefactor AND NEW.benefactor_since IS NULL THEN
        NEW.benefactor_since = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update benefactor level
CREATE TRIGGER trigger_update_benefactor_level
BEFORE UPDATE OF total_benefactor_payments ON users
FOR EACH ROW
WHEN (NEW.total_benefactor_payments IS DISTINCT FROM OLD.total_benefactor_payments)
EXECUTE FUNCTION update_benefactor_level();

-- Create trigger for insert as well
CREATE TRIGGER trigger_update_benefactor_level_insert
BEFORE INSERT ON users
FOR EACH ROW
WHEN (NEW.total_benefactor_payments > 0)
EXECUTE FUNCTION update_benefactor_level();
