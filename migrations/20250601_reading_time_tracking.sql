-- Reading Time Tracking Table
-- Tracks time spent reading chapters across sessions

CREATE TABLE IF NOT EXISTS reading_time_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
    chapter_id INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reading_time_user_id ON reading_time_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_time_novel_id ON reading_time_sessions(novel_id);
CREATE INDEX IF NOT EXISTS idx_reading_time_active ON reading_time_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_reading_time_started_at ON reading_time_sessions(started_at);

-- Function to get total reading time for a user
CREATE OR REPLACE FUNCTION get_user_reading_time(p_user_id UUID)
RETURNS TABLE (
    total_seconds BIGINT,
    total_chapters INTEGER,
    total_novels INTEGER,
    last_read_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(duration_seconds), 0)::BIGINT as total_seconds,
        COUNT(DISTINCT chapter_id)::INTEGER as total_chapters,
        COUNT(DISTINCT novel_id)::INTEGER as total_novels,
        MAX(ended_at) as last_read_at
    FROM reading_time_sessions
    WHERE user_id = p_user_id
    AND is_active = FALSE; -- Only count completed sessions
END;
$$ LANGUAGE plpgsql;

-- Function to end a reading session
CREATE OR REPLACE FUNCTION end_reading_session(
    p_session_id UUID,
    p_duration_seconds INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE reading_time_sessions
    SET 
        ended_at = NOW(),
        duration_seconds = p_duration_seconds,
        is_active = FALSE,
        updated_at = NOW()
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get active session for user/novel/chapter
CREATE OR REPLACE FUNCTION get_active_reading_session(
    p_user_id UUID,
    p_novel_id UUID,
    p_chapter_id INTEGER
)
RETURNS TABLE (
    id UUID,
    started_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        id,
        started_at,
        COALESCE(duration_seconds, 0) as duration_seconds
    FROM reading_time_sessions
    WHERE user_id = p_user_id
    AND novel_id = p_novel_id
    AND chapter_id = p_chapter_id
    AND is_active = TRUE
    ORDER BY started_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;
