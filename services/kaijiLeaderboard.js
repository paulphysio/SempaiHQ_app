import { supabase } from './supabaseClient';

/**
 * Fetch Kaiji leaderboard data from the database
 * Returns players ranked by wins
 */
export async function getKaijiLeaderboard() {
  try {
    // Query for leaderboard: count wins per wallet
    const { data, error } = await supabase.rpc('kaiji_leaderboard_data');

    if (error) {
      console.error('[kaijiLeaderboard] Error fetching leaderboard:', error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('[kaijiLeaderboard] Exception:', e);
    return [];
  }
}
