-- Function to recalculate leaderboard based on chapters read in past 14 days
CREATE OR REPLACE FUNCTION recalculate_leaderboard_points() RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Calculate points based on chapters read in past 14 days (100 points per chapter)
    WITH reading_stats AS (
        SELECT 
            user_id,
            COUNT(*) as total_chapters_read
        FROM novel_interactions
        WHERE last_read_at >= NOW() - INTERVAL '14 days'
        GROUP BY user_id
    )
    UPDATE users
    SET weekly_points = rs.total_chapters_read * 100
    FROM reading_stats rs
    WHERE users.id = rs.user_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Reset points for users with no reading activity in past 14 days
    UPDATE users
    SET weekly_points = 0
    WHERE id NOT IN (
        SELECT user_id 
        FROM novel_interactions 
        WHERE last_read_at >= NOW() - INTERVAL '14 days'
    )
    AND weekly_points > 0;
    
    -- Update weekly leaderboard
    INSERT INTO weekly_leaderboard (user_id, week_start, weekly_points, amethyst_count, effective_points, updated_at)
    SELECT 
        u.id as user_id,
        DATE_TRUNC('week', NOW())::date as week_start,
        COALESCE(u.weekly_points, 0) as weekly_points,
        COALESCE(u.amethyst_count, 0) as amethyst_count,
        COALESCE(u.weekly_points, 0) + (COALESCE(u.amethyst_count, 0) * 2)::bigint as effective_points,
        NOW() as updated_at
    FROM users u
    WHERE u.weekly_points > 0 OR u.amethyst_count > 0
    ON CONFLICT (user_id, week_start) 
    DO UPDATE SET
        weekly_points = EXCLUDED.weekly_points,
        amethyst_count = EXCLUDED.amethyst_count,
        effective_points = EXCLUDED.effective_points,
        updated_at = EXCLUDED.updated_at;
    
    -- Update ranks
    UPDATE weekly_leaderboard
    SET rank = subquery.rank
    FROM (
        SELECT 
            user_id, 
            week_start,
            ROW_NUMBER() OVER (PARTITION BY week_start ORDER BY effective_points DESC) as rank
        FROM weekly_leaderboard
        WHERE week_start = DATE_TRUNC('week', NOW())::date
    ) subquery
    WHERE weekly_leaderboard.user_id = subquery.user_id
      AND weekly_leaderboard.week_start = subquery.week_start;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get leaderboard data by time frame
CREATE OR REPLACE FUNCTION get_leaderboard_data(p_timeframe TEXT DEFAULT 'week')
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    name TEXT,
    wallet_address TEXT,
    chapters_read BIGINT,
    amethyst_count BIGINT,
    base_points BIGINT,
    amethyst_bonus BIGINT,
    effective_points BIGINT
) AS $$
DECLARE
    time_filter TEXT;
BEGIN
    -- Set time filter based on timeframe
    CASE p_timeframe
        WHEN 'week' THEN time_filter := 'last_read_at >= NOW() - INTERVAL ''7 days''';
        WHEN 'month' THEN time_filter := 'last_read_at >= NOW() - INTERVAL ''30 days''';
        WHEN 'all' THEN time_filter := 'true';
        ELSE time_filter := 'last_read_at >= NOW() - INTERVAL ''7 days''';
    END CASE;
    
    RETURN QUERY EXECUTE format('
        WITH novel_reading AS (
            SELECT 
                user_id,
                COUNT(*) as novel_chapters
            FROM novel_interactions
            WHERE %s
            GROUP BY user_id
        ),
        manga_reading AS (
            SELECT 
                user_id,
                COUNT(*) as manga_chapters
            FROM manga_interactions
            WHERE last_read_at >= NOW() - INTERVAL ''30 days''
            GROUP BY user_id
        ),
        combined_reading AS (
            SELECT 
                COALESCE(nr.user_id, mr.user_id) as user_id,
                COALESCE(nr.novel_chapters, 0) + COALESCE(mr.manga_chapters, 0) as total_chapters
            FROM novel_reading nr
            FULL OUTER JOIN manga_reading mr ON nr.user_id = mr.user_id
        ),
        amethyst_data AS (
            SELECT 
                user_id,
                COALESCE(amethyst_balance, 0) as amethyst_count
            FROM amethyst_balances
        )
        SELECT 
            u.id as user_id,
            u.email,
            u.name,
            u.wallet_address,
            (COALESCE(cr.total_chapters, 0)::BIGINT) as chapters_read,
            (COALESCE(ad.amethyst_count, 0)::BIGINT) as amethyst_count,
            ((COALESCE(cr.total_chapters, 0) * 100)::BIGINT) as base_points,
            (CASE 
                WHEN COALESCE(ad.amethyst_count, 0) >= 5000000 THEN 250
                WHEN COALESCE(ad.amethyst_count, 0) >= 1000000 THEN 200
                WHEN COALESCE(ad.amethyst_count, 0) >= 500000 THEN 170
                WHEN COALESCE(ad.amethyst_count, 0) >= 250000 THEN 150
                WHEN COALESCE(ad.amethyst_count, 0) >= 100000 THEN 120
                ELSE 0
            END)::BIGINT as amethyst_bonus,
            ((COALESCE(cr.total_chapters, 0) * 100)::BIGINT + 
            (CASE 
                WHEN COALESCE(ad.amethyst_count, 0) >= 5000000 THEN 250
                WHEN COALESCE(ad.amethyst_count, 0) >= 1000000 THEN 200
                WHEN COALESCE(ad.amethyst_count, 0) >= 500000 THEN 170
                WHEN COALESCE(ad.amethyst_count, 0) >= 250000 THEN 150
                WHEN COALESCE(ad.amethyst_count, 0) >= 100000 THEN 120
                ELSE 0
            END)::BIGINT) as effective_points
        FROM users u
        LEFT JOIN combined_reading cr ON u.id = cr.user_id
        LEFT JOIN amethyst_data ad ON u.id = ad.user_id
        WHERE COALESCE(cr.total_chapters, 0) > 0 OR COALESCE(ad.amethyst_count, 0) > 0
        ORDER BY effective_points DESC
        LIMIT 50
    ', time_filter);
END;
$$ LANGUAGE plpgsql;
