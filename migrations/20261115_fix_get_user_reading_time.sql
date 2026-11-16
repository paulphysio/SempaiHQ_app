-- Fix: recreate get_user_reading_time RPC missing from schema cache (PGRST202)
-- Safe to run multiple times (CREATE OR REPLACE).

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

GRANT EXECUTE ON FUNCTION get_user_reading_time(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_reading_time(UUID) TO anon;

-- Tell PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
