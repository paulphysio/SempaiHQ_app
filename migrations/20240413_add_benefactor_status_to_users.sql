-- Add benefactor status to users table
ALTER TABLE users 
ADD COLUMN is_benefactor BOOLEAN DEFAULT FALSE,
ADD COLUMN benefactor_since TIMESTAMP WITH TIME ZONE,
ADD COLUMN benefactor_level TEXT DEFAULT 'bronze', -- bronze, silver, gold, platinum
ADD COLUMN total_benefactor_payments NUMERIC DEFAULT 0;

-- Create index for benefactor queries
CREATE INDEX idx_users_is_benefactor ON users(is_benefactor) WHERE is_benefactor = TRUE;

-- Add comment
COMMENT ON COLUMN users.is_benefactor IS 'Whether user is a benefactor (has made early access payments)';
COMMENT ON COLUMN users.benefactor_since IS 'When user became a benefactor';
COMMENT ON COLUMN users.benefactor_level IS 'Benefactor level based on total contributions';
COMMENT ON COLUMN users.total_benefactor_payments IS 'Total amount paid for benefactor early access';
