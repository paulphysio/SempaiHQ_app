/**
 * Advanced Charting service for data visualization
 * Provides chart data preparation and formatting for mobile charts
 */

/**
 * Prepare reading activity data for charts
 */
export const prepareReadingActivityData = (sessions) => {
  try {
    if (!sessions || sessions.length === 0) return [];

    // Group sessions by date
    const groupedByDate = {};
    
    sessions.forEach(session => {
      const date = new Date(session.created_at).toLocaleDateString();
      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date,
          pagesRead: 0,
          timeSpent: 0,
          sessions: 0
        };
      }
      groupedByDate[date].pagesRead += session.pages_read || 0;
      groupedByDate[date].timeSpent += session.time_on_page_seconds || 0;
      groupedByDate[date].sessions += 1;
    });

    // Convert to array and sort by date
    const chartData = Object.values(groupedByDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(item => ({
        label: item.date,
        value: item.pagesRead,
        timeSpent: item.timeSpent,
        sessions: item.sessions
      }));

    return chartData;
  } catch (error) {
    console.error('[ChartService] Error preparing reading activity data:', error);
    return [];
  }
};

/**
 * Prepare reputation progression data for charts
 */
export const prepareReputationProgressionData = (reputationHistory) => {
  try {
    if (!reputationHistory || reputationHistory.length === 0) return [];

    const chartData = reputationHistory
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(item => ({
        label: new Date(item.created_at).toLocaleDateString(),
        value: item.reputation_score || 0,
        tier: item.current_tier || 'seed'
      }));

    return chartData;
  } catch (error) {
    console.error('[ChartService] Error preparing reputation data:', error);
    return [];
  }
};

/**
 * Prepare token balance history data for charts
 */
export const prepareBalanceHistoryData = (balanceHistory) => {
  try {
    if (!balanceHistory || balanceHistory.length === 0) return [];

    const chartData = balanceHistory
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(item => ({
        label: new Date(item.timestamp).toLocaleDateString(),
        value: item.balance || 0,
        token: item.token || 'SMP'
      }));

    return chartData;
  } catch (error) {
    console.error('[ChartService] Error preparing balance data:', error);
    return [];
  }
};

/**
 * Prepare leaderboard ranking data for charts
 */
export const prepareLeaderboardData = (leaderboard) => {
  try {
    if (!leaderboard || leaderboard.length === 0) return [];

    const chartData = leaderboard
      .slice(0, 10) // Top 10
      .map((item, index) => ({
        label: item.name || item.wallet_address?.slice(0, 6) + '...' || `User ${index + 1}`,
        value: item.score || item.points || item.pages_read || 0,
        rank: index + 1
      }));

    return chartData;
  } catch (error) {
    console.error('[ChartService] Error preparing leaderboard data:', error);
    return [];
  }
};

/**
 * Prepare weekly activity data for charts
 */
export const prepareWeeklyActivityData = (activities) => {
  try {
    if (!activities || activities.length === 0) return [];

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = {};

    // Initialize all days with 0
    days.forEach(day => {
      weeklyData[day] = 0;
    });

    // Group activities by day of week
    activities.forEach(activity => {
      const day = days[new Date(activity.created_at).getDay()];
      weeklyData[day] += 1;
    });

    const chartData = days.map(day => ({
      label: day,
      value: weeklyData[day]
    }));

    return chartData;
  } catch (error) {
    console.error('[ChartService] Error preparing weekly activity data:', error);
    return [];
  }
};

/**
 * Calculate chart statistics
 */
export const calculateChartStats = (data) => {
  try {
    if (!data || data.length === 0) {
      return {
        total: 0,
        average: 0,
        max: 0,
        min: 0
      };
    }

    const values = data.map(item => item.value);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    return {
      total,
      average: Math.round(average * 100) / 100,
      max,
      min
    };
  } catch (error) {
    console.error('[ChartService] Error calculating stats:', error);
    return {
      total: 0,
      average: 0,
      max: 0,
      min: 0
    };
  }
};

/**
 * Format chart data for different chart types
 */
export const formatForLineChart = (data) => {
  return {
    labels: data.map(item => item.label),
    datasets: [{
      data: data.map(item => item.value),
      color: (opacity = 1) => `rgba(155, 89, 182, ${opacity})`,
      strokeWidth: 2
    }]
  };
};

export const formatForBarChart = (data) => {
  return {
    labels: data.map(item => item.label),
    datasets: [{
      data: data.map(item => item.value)
    }]
  };
};

export const formatForPieChart = (data) => {
  return data.map(item => ({
    name: item.label,
    population: item.value,
    color: getColorForIndex(data.indexOf(item))
  }));
};

/**
 * Get color for chart index
 */
const getColorForIndex = (index) => {
  const colors = [
    '#9B59B6', // Purple
    '#4A90E2', // Blue
    '#F39C12', // Orange
    '#E74C3C', // Red
    '#2ECC71', // Green
    '#1ABC9C', // Teal
    '#3498DB', // Light Blue
    '#9B59B6', // Purple
    '#E67E22', // Dark Orange
    '#95A5A6'  // Gray
  ];
  return colors[index % colors.length];
};

/**
 * Generate trend data
 */
export const generateTrendData = (data, period = 7) => {
  try {
    if (!data || data.length === 0) return [];

    const trendData = [];
    const now = new Date();

    for (let i = period - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString();

      const dayData = data.find(item => item.label === dateStr);
      trendData.push({
        label: dateStr,
        value: dayData ? dayData.value : 0
      });
    }

    return trendData;
  } catch (error) {
    console.error('[ChartService] Error generating trend data:', error);
    return [];
  }
};

export default {
  prepareReadingActivityData,
  prepareReputationProgressionData,
  prepareBalanceHistoryData,
  prepareLeaderboardData,
  prepareWeeklyActivityData,
  calculateChartStats,
  formatForLineChart,
  formatForBarChart,
  formatForPieChart,
  generateTrendData
};
