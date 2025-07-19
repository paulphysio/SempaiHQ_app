-- Create table for logging Kaito Adventure leaderboard reward distributions
CREATE TABLE IF NOT EXISTS kaito_leaderboard_rewards (
    id BIGSERIAL PRIMARY KEY,
    total_amount_distributed BIGINT NOT NULL,
    players_rewarded INTEGER NOT NULL,
    top_players_count INTEGER NOT NULL DEFAULT 10,
    distribution_details JSONB,
    distributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_kaito_leaderboard_rewards_distributed_at 
ON kaito_leaderboard_rewards(distributed_at);

-- Add RLS (Row Level Security) if needed
ALTER TABLE kaito_leaderboard_rewards ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to insert/select
CREATE POLICY "Service role can manage kaito leaderboard rewards" 
ON kaito_leaderboard_rewards 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE kaito_leaderboard_rewards IS 'Logs weekly SMP token distributions to top Kaito Adventure players based on Gold and XP rankings';
