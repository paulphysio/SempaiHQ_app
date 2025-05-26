import { supabase } from '../services/supabaseClient';

/**
 * Fetch all users with optional filtering
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Array of users
 */
export const fetchUsers = async (options = {}) => {
  try {
    let query = supabase
      .from('users')
      .select(`
        id,
        wallet_address,
        created_at,
        updated_at,
        name,
        email,
        has_updated_profile,
        weekly_points,
        referral_code,
        x_account,
        discord,
        website,
        bio,
        image_url
      `);

    // Add filters if provided
    if (options.hasWallet) {
      query = query.not('wallet_address', 'is', null);
    }
    
    if (options.isActive) {
      query = query.gt('last_sign_in', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    }

    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.ascending });
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

/**
 * Get user statistics
 * @returns {Promise<Object>} User statistics
 */
export const getUserStats = async () => {
  try {
    const [totalUsers, activeUsers, walletUsers] = await Promise.all([
      // Total users count
      supabase
        .from('users')
        .select('id', { count: 'exact' }),
      
      // Active users in last 30 days
      supabase
        .from('users')
        .select('id', { count: 'exact' })
        .gt('last_sign_in', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Users with wallets
      supabase
        .from('users')
        .select('id', { count: 'exact' })
        .not('wallet_address', 'is', null)
    ]);

    return {
      total: totalUsers.count || 0,
      active: activeUsers.count || 0,
      withWallet: walletUsers.count || 0,
      activePercentage: totalUsers.count ? ((activeUsers.count / totalUsers.count) * 100).toFixed(1) : 0,
      walletPercentage: totalUsers.count ? ((walletUsers.count / totalUsers.count) * 100).toFixed(1) : 0
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
};

/**
 * Get a single user's details
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} User details
 */
export const getUserDetails = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        chapter_payments(count),
        comments(count),
        unlocked_story_chapters(count)
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;

    return {
      ...data,
      totalPayments: data.chapter_payments?.[0]?.count || 0,
      totalComments: data.comments?.[0]?.count || 0,
      totalUnlocked: data.unlocked_story_chapters?.[0]?.count || 0
    };
  } catch (error) {
    console.error('Error fetching user details:', error);
    throw error;
  }
};

/**
 * Get recent user activity
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} Recent activity
 */
export const getUserActivity = async (userId) => {
  try {
    const [payments, comments] = await Promise.all([
      // Recent payments
      supabase
        .from('chapter_payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      
      // Recent comments
      supabase
        .from('comments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    return {
      recentPayments: payments.data || [],
      recentComments: comments.data || []
    };
  } catch (error) {
    console.error('Error fetching user activity:', error);
    throw error;
  }
}; 