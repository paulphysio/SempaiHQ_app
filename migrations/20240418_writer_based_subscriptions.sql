-- Migration to redesign benefactor system for writer-based subscriptions
-- This replaces the novel-based benefactor system with writer-based subscriptions

-- Drop old tables (backup data first if needed)
DROP TABLE IF EXISTS benefactor_access_log CASCADE;
DROP TABLE IF EXISTS benefactor_early_access CASCADE;

-- Create new writer_subscriptions table
CREATE TABLE IF NOT EXISTS writer_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  benefactor_wallet TEXT NOT NULL,
  writer_id UUID NOT NULL REFERENCES users(id),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('blue', 'iron', 'silver', 'gold')),
  chapters_unlocked INTEGER NOT NULL,
  chapters_remaining INTEGER NOT NULL,
  payment_amount NUMERIC NOT NULL,
  payment_currency TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(benefactor_wallet, writer_id)
);

-- Create writer_access_log to track which chapters were accessed
CREATE TABLE IF NOT EXISTS writer_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES writer_subscriptions(id),
  novel_id UUID NOT NULL REFERENCES novels(id),
  chapter_number INTEGER NOT NULL,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subscription_id, novel_id, chapter_number)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_writer_subscriptions_wallet ON writer_subscriptions(benefactor_wallet);
CREATE INDEX IF NOT EXISTS idx_writer_subscriptions_writer ON writer_subscriptions(writer_id);
CREATE INDEX IF NOT EXISTS idx_writer_subscriptions_active ON writer_subscriptions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_writer_access_log_subscription ON writer_access_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_writer_access_log_novel ON writer_access_log(novel_id);

-- Create function to automatically expire subscriptions
CREATE OR REPLACE FUNCTION expire_writer_subscription()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE writer_subscriptions 
  SET is_active = FALSE 
  WHERE id = NEW.id AND expires_at <= NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check expiration on access
CREATE TRIGGER trigger_check_subscription_expiration
BEFORE INSERT ON writer_access_log
FOR EACH ROW
EXECUTE FUNCTION expire_writer_subscription();

-- Update users table to track current writer subscription level
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_writer_subscription TEXT,
ADD COLUMN IF NOT EXISTS current_writer_subscription_expires TIMESTAMP WITH TIME ZONE;

-- Create view for writer subscription statistics
CREATE OR REPLACE VIEW writer_subscription_stats AS
SELECT 
  ws.id,
  ws.benefactor_wallet,
  ws.writer_id,
  u.name as writer_name,
  ws.plan_type,
  ws.chapters_unlocked,
  ws.chapters_remaining,
  ws.expires_at,
  ws.is_active,
  COUNT(DISTINCT wal.novel_id) as novels_accessed,
  COUNT(wal.id) as total_chapters_read
FROM writer_subscriptions ws
LEFT JOIN users u ON u.id = ws.writer_id
LEFT JOIN writer_access_log wal ON wal.subscription_id = ws.id
WHERE ws.is_active = TRUE
GROUP BY ws.id, ws.benefactor_wallet, ws.writer_id, u.name, ws.plan_type, ws.chapters_unlocked, ws.chapters_remaining, ws.expires_at, ws.is_active;

COMMENT ON TABLE writer_subscriptions IS 'Tracks writer-based benefactor subscriptions (blue, iron, silver, gold plans)';
COMMENT ON TABLE writer_access_log IS 'Logs which chapters were accessed under writer subscriptions';
COMMENT ON COLUMN writer_subscriptions.plan_type IS 'Subscription plan: blue (3 chapters, 14 days), iron (6 chapters, 14 days), silver (10 chapters, 14 days), gold (unlimited, 30 days)';
