-- Amethyst Balance Cache Migration
-- Create table to cache Amethyst balances from blockchain

-- Create amethyst_balances table
CREATE TABLE IF NOT EXISTS amethyst_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    amethyst_balance BIGINT DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_amethyst_balances_user_id ON amethyst_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_amethyst_balances_wallet_address ON amethyst_balances(wallet_address);
CREATE INDEX IF NOT EXISTS idx_amethyst_balances_last_updated ON amethyst_balances(last_updated);

-- Function to update cached Amethyst balance
CREATE OR REPLACE FUNCTION update_amethyst_balance(
    p_user_id UUID,
    p_wallet_address TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    current_balance BIGINT;
    cached_balance BIGINT;
    balance_changed BOOLEAN := FALSE;
BEGIN
    -- Get current cached balance
    SELECT amethyst_balance INTO cached_balance
    FROM amethyst_balances
    WHERE user_id = p_user_id;
    
    -- Get blockchain balance (this would be called from edge function)
    -- For now, we'll update based on triggers or direct calls
    
    -- Update or insert the cached balance
    INSERT INTO amethyst_balances (user_id, wallet_address, amethyst_balance, last_updated)
    VALUES (p_user_id, p_wallet_address, COALESCE(cached_balance, 0), NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET
        amethyst_balance = EXCLUDED.amethyst_balance,
        last_updated = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get cached Amethyst balance for a user
CREATE OR REPLACE FUNCTION get_amethyst_balance(
    p_user_id UUID
) RETURNS BIGINT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT amethyst_balance FROM amethyst_balances WHERE user_id = p_user_id),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Function to increment Amethyst balance (called when Amethyst is awarded)
CREATE OR REPLACE FUNCTION increment_amethyst_balance(
    p_user_id UUID,
    p_amount BIGINT
) RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO amethyst_balances (user_id, amethyst_balance, last_updated)
    VALUES (p_user_id, p_amount, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET
        amethyst_balance = amethyst_balances.amethyst_balance + p_amount,
        last_updated = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create amethyst balance entry when user is created
CREATE OR REPLACE FUNCTION create_amethyst_balance_entry()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO amethyst_balances (user_id, wallet_address, amethyst_balance)
    VALUES (NEW.id, NEW.wallet_address, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new users
DROP TRIGGER IF EXISTS create_amethyst_balance_trigger ON users;
CREATE TRIGGER create_amethyst_balance_trigger
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_amethyst_balance_entry();
