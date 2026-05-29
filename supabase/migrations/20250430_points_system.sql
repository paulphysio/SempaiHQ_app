-- Points System Migration
-- Add proper points tracking columns to users table

-- Add points tracking columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS weekly_points BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_points_read BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS amethyst_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_points_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create points history table for tracking point awards
CREATE TABLE IF NOT EXISTS points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    points_awarded BIGINT NOT NULL,
    points_type VARCHAR(50) NOT NULL, -- 'chapter_read', 'amethyst_bonus', 'daily_bonus', etc.
    reference_id VARCHAR(255), -- chapter_id, novel_id, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB -- Additional data like multiplier info
);

-- Create amethyst tracking table
CREATE TABLE IF NOT EXISTS amethyst_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amethyst_type VARCHAR(50) NOT NULL DEFAULT 'standard',
    quantity BIGINT NOT NULL DEFAULT 0,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(100), -- 'chapter_unlock', 'reward', 'purchase', etc.
    metadata JSONB
);

-- Create weekly leaderboard cache table
CREATE TABLE IF NOT EXISTS weekly_leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    weekly_points BIGINT NOT NULL DEFAULT 0,
    amethyst_count BIGINT NOT NULL DEFAULT 0,
    effective_points BIGINT NOT NULL DEFAULT 0,
    rank INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_points_history_user_id ON points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_points_history_created_at ON points_history(created_at);
CREATE INDEX IF NOT EXISTS idx_amethyst_inventory_user_id ON amethyst_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_leaderboard_week_start ON weekly_leaderboard(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_leaderboard_effective_points ON weekly_leaderboard(effective_points DESC);

-- Create function to calculate effective points
CREATE OR REPLACE FUNCTION calculate_effective_points(
    p_weekly_points BIGINT,
    p_amethyst_count BIGINT
) RETURNS BIGINT AS $$
BEGIN
    -- Amethyst multiplier: 1 Amethyst = 2x points bonus
    RETURN p_weekly_points + (p_amethyst_count * 2);
END;
$$ LANGUAGE plpgsql;

-- Create function to award points
CREATE OR REPLACE FUNCTION award_points(
    p_user_id UUID,
    p_points BIGINT,
    p_points_type VARCHAR(50),
    p_reference_id VARCHAR(255) DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    current_weekly_points BIGINT;
    current_total_points BIGINT;
    current_amethyst_count BIGINT;
BEGIN
    -- Get current user stats
    SELECT 
        COALESCE(weekly_points, 0),
        COALESCE(total_points_read, 0),
        COALESCE(amethyst_count, 0)
    INTO current_weekly_points, current_total_points, current_amethyst_count
    FROM users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Update user points
    UPDATE users SET
        weekly_points = current_weekly_points + p_points,
        total_points_read = current_total_points + p_points
    WHERE id = p_user_id;
    
    -- Record in history
    INSERT INTO points_history (
        user_id, 
        points_awarded, 
        points_type, 
        reference_id, 
        metadata
    ) VALUES (
        p_user_id,
        p_points,
        p_points_type,
        p_reference_id,
        p_metadata
    );
    
    -- Update weekly leaderboard cache
    INSERT INTO weekly_leaderboard (
        user_id,
        week_start,
        weekly_points,
        amethyst_count,
        effective_points,
        updated_at
    ) VALUES (
        p_user_id,
        DATE_TRUNC('week', CURRENT_DATE),
        current_weekly_points + p_points,
        current_amethyst_count,
        calculate_effective_points(current_weekly_points + p_points, current_amethyst_count),
        NOW()
    )
    ON CONFLICT (user_id, week_start) 
    DO UPDATE SET
        weekly_points = EXCLUDED.weekly_points,
        effective_points = calculate_effective_points(EXCLUDED.weekly_points, EXCLUDED.amethyst_count),
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to award amethyst
CREATE OR REPLACE FUNCTION award_amethyst(
    p_user_id UUID,
    p_quantity BIGINT,
    p_amethyst_type VARCHAR(50) DEFAULT 'standard',
    p_source VARCHAR(100) DEFAULT 'system',
    p_metadata JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    current_amethyst_count BIGINT;
    current_weekly_points BIGINT;
BEGIN
    -- Get current user stats
    SELECT 
        COALESCE(amethyst_count, 0),
        COALESCE(weekly_points, 0)
    INTO current_amethyst_count, current_weekly_points
    FROM users WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Update user amethyst count
    UPDATE users SET
        amethyst_count = current_amethyst_count + p_quantity
    WHERE id = p_user_id;
    
    -- Record in inventory
    INSERT INTO amethyst_inventory (
        user_id,
        amethyst_type,
        quantity,
        acquired_at,
        source,
        metadata
    ) VALUES (
        p_user_id,
        p_amethyst_type,
        p_quantity,
        NOW(),
        p_source,
        p_metadata
    );
    
    -- Update weekly leaderboard cache with new effective points
    UPDATE weekly_leaderboard SET
        amethyst_count = current_amethyst_count + p_quantity,
        effective_points = calculate_effective_points(current_weekly_points, current_amethyst_count + p_quantity),
        updated_at = NOW()
    WHERE user_id = p_user_id AND week_start = DATE_TRUNC('week', CURRENT_DATE);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to reset weekly points
CREATE OR REPLACE FUNCTION reset_weekly_points() RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER;
BEGIN
    -- Reset weekly points for all users
    UPDATE users SET
        weekly_points = 0,
        weekly_points_reset = NOW()
    WHERE weekly_points > 0;
    
    GET DIAGNOSTICS reset_count = ROW_COUNT;
    
    -- Clear old weekly leaderboard entries (older than 4 weeks)
    DELETE FROM weekly_leaderboard 
    WHERE week_start < DATE_TRUNC('week', CURRENT_DATE - INTERVAL '4 weeks');
    
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically reset weekly points on Monday
CREATE OR REPLACE FUNCTION weekly_points_reset_trigger() RETURNS TRIGGER AS $$
BEGIN
    -- Only reset if it's Monday and points haven't been reset this week
    IF EXTRACT(DOW FROM CURRENT_DATE) = 1 AND 
       EXISTS (SELECT 1 FROM users WHERE weekly_points_reset < DATE_TRUNC('week', CURRENT_DATE)) THEN
        PERFORM reset_weekly_points();
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job trigger (this would need to be set up in your database system)
-- For now, this is a placeholder for the weekly reset mechanism
