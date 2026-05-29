-- Simple Amethyst Balance Cache Migration
-- Create table to cache Amethyst balances

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

-- Simple trigger to create balance entry for new users
CREATE OR REPLACE FUNCTION create_amethyst_balance_entry()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO amethyst_balances (user_id, wallet_address, amethyst_balance)
    VALUES (NEW.id, COALESCE(NEW.wallet_address, 'no_wallet'), 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new users (drop if exists first)
DROP TRIGGER IF EXISTS create_amethyst_balance_trigger ON users;
CREATE TRIGGER create_amethyst_balance_trigger
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_amethyst_balance_entry();

-- Create existing users' balance entries
INSERT INTO amethyst_balances (user_id, wallet_address, amethyst_balance)
SELECT id, COALESCE(wallet_address, 'no_wallet'), 0
FROM users
WHERE id NOT IN (SELECT user_id FROM amethyst_balances)
ON CONFLICT (user_id) DO NOTHING;
