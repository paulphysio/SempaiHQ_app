import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, getAccount } from '@solana/spl-token';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import { SMP_MINT_ADDRESS, TREASURY_PUBLIC_KEY, RPC_URL, SMP_DECIMALS } from '../constants';
import { styles } from '../styles/StatStyles';

const { width } = Dimensions.get('window');
const connection = new Connection(RPC_URL, 'confirmed');

const StatPageScreen = () => {
  const navigation = useNavigation();
  const { wallet } = useContext(EmbeddedWalletContext);
  const activePublicKey = wallet?.publicKey ? new PublicKey(wallet.publicKey) : null;
  const activeWalletAddress = activePublicKey?.toString();
  const isWalletConnected = !!activeWalletAddress;

  const [totalUsers, setTotalUsers] = useState(0);
  const [mintTreasuryBalance, setMintTreasuryBalance] = useState(null);
  const [rewardsWalletBalance, setRewardsWalletBalance] = useState(null);
  const [userSmpBalance, setUserSmpBalance] = useState({ onChain: null, offChain: null });
  const [usersOverTime, setUsersOverTime] = useState([]);
  const [activeUsers, setActiveUsers] = useState({ last7: 0, last30: 0 });
  const [smpDistribution, setSmpDistribution] = useState({ '<1K': 0, '1K-10K': 0, '>10K': 0 });
  const [activityTypes, setActivityTypes] = useState({});
  const [totalNovelsRead, setTotalNovelsRead] = useState(0);
  const [avgWeeklyPoints, setAvgWeeklyPoints] = useState(0);
  const [commentActivity, setCommentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Timeout wrapper for async operations
  const withTimeout = (promise, ms = 10000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), ms)
      ),
    ]);
  };

  // Sanitize chart data to prevent NaN, Infinity, or undefined values
  const sanitizeChartData = (data, defaultValue = 0) => {
    if (!Array.isArray(data)) return [defaultValue];
    return data.map((value) => {
      const num = Number(value);
      return Number.isFinite(num) && num >= 0 ? num : defaultValue;
    });
  };

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching stats for wallet:', activeWalletAddress);

      // Total User Count
      console.log('Fetching total users...');
      const { count: userCount, error: userError } = await withTimeout(
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .not('wallet_address', 'is', null)
      );
      if (userError) throw new Error(`User fetch error: ${userError.message}`);
      console.log('Total users:', userCount);
      setTotalUsers(userCount || 0);

      // Mint Treasury SMP Balance
      console.log('Fetching treasury balance...');
      const treasuryATA = getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, new PublicKey(TREASURY_PUBLIC_KEY));
      const treasuryAccountInfo = await withTimeout(connection.getAccountInfo(treasuryATA));
      if (treasuryAccountInfo) {
        const treasuryAccount = await withTimeout(getAccount(connection, treasuryATA));
        const treasuryBalance = Number(treasuryAccount.amount) / 10 ** SMP_DECIMALS;
        console.log('Treasury balance:', treasuryBalance);
        setMintTreasuryBalance(treasuryBalance);
      } else {
        console.log('No treasury ATA found');
        setMintTreasuryBalance(0);
      }

      // Total Rewards SMP Balance
      console.log('Fetching rewards balances...');
      const { data: rewardsBalances, error: rewardsError } = await withTimeout(
        supabase
          .from('wallet_balances')
          .select('amount')
          .eq('currency', 'SMP')
      );
      if (rewardsError) throw new Error(`Rewards balance fetch error: ${rewardsError.message}`);
      const rewardsBalancesNum = (rewardsBalances || []).map((b) => ({ ...b, amount: Number(b.amount) }));
      const totalRewardsBalance = rewardsBalancesNum.reduce(
        (sum, { amount }) => sum + (Number.isFinite(amount) ? amount : 0),
        0
      );
      console.log('Total rewards balance:', totalRewardsBalance);
      setRewardsWalletBalance(totalRewardsBalance);

      // Current User's SMP Balance
      if (activeWalletAddress) {
        console.log('Fetching user SMP balance for:', activeWalletAddress);
        const userATA = getAssociatedTokenAddressSync(SMP_MINT_ADDRESS, activePublicKey);
        const userAccountInfo = await withTimeout(connection.getAccountInfo(userATA));
        const onChainBalance = userAccountInfo
          ? Number((await withTimeout(getAccount(connection, userATA))).amount) / 10 ** SMP_DECIMALS
          : 0;
        console.log('On-chain balance:', onChainBalance);

        const { data: userData, error: userError } = await withTimeout(
          supabase
            .from('users')
            .select('id')
            .eq('wallet_address', activeWalletAddress)
            .single()
        );
        if (userError) throw new Error(`User fetch error: ${userError.message}`);
        if (!userData) throw new Error('User not found');
        console.log('User data:', userData);

        const { data: userBalance, error: balanceError } = await withTimeout(
          supabase
            .from('wallet_balances')
            .select('amount')
            .eq('user_id', userData.id)
            .eq('currency', 'SMP')
            .single()
        );
        const offChainBalance = userBalance ? Number(userBalance.amount) || 0 : 0;
        console.log('Off-chain balance:', offChainBalance);

        setUserSmpBalance({ onChain: onChainBalance, offChain: offChainBalance });
      } else {
        console.log('No wallet connected, skipping user balance');
        setUserSmpBalance({ onChain: null, offChain: null });
      }

      // Users Over Time
      console.log('Fetching users over time...');
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: walletEventsTime, error: walletTimeError } = await withTimeout(
        supabase
          .from('wallet_events')
          .select('timestamp, source_user_id')
          .gte('timestamp', thirtyDaysAgo)
      );
      if (walletTimeError) throw new Error(`Wallet events over time fetch error: ${walletTimeError.message}`);
      const uniqueUsersByDay = groupByDate(walletEventsTime || [], 'timestamp', 'source_user_id');
      console.log('Users over time:', uniqueUsersByDay);
      setUsersOverTime(uniqueUsersByDay);

      // Active Users
      console.log('Fetching active users...');
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: events7, error: events7Error } = await withTimeout(
        supabase
          .from('wallet_events')
          .select('source_user_id')
          .gte('timestamp', sevenDaysAgo)
      );
      if (events7Error) throw new Error(`7-day events fetch error: ${events7Error.message}`);
      setActiveUsers((prev) => ({
        ...prev,
        last7: events7 ? new Set(events7.map((e) => e.source_user_id)).size : 0,
      }));
      console.log('Active users (7 days):', events7 ? new Set(events7.map((e) => e.source_user_id)).size : 0);

      const { data: events30, error: events30Error } = await withTimeout(
        supabase
          .from('wallet_events')
          .select('source_user_id')
          .gte('timestamp', thirtyDaysAgo)
      );
      if (events30Error) throw new Error(`30-day events fetch error: ${events30Error.message}`);
      setActiveUsers((prev) => ({
        ...prev,
        last30: events30 ? new Set(events30.map((e) => e.source_user_id)).size : 0,
      }));
      console.log('Active users (30 days):', events30 ? new Set(events30.map((e) => e.source_user_id)).size : 0);

      // SMP Balance Distribution
      console.log('Fetching SMP distribution...');
      const { data: balances, error: balanceError } = await withTimeout(
        supabase
          .from('wallet_balances')
          .select('amount')
          .eq('currency', 'SMP')
      );
      if (balanceError) throw new Error(`Balance fetch error: ${balanceError.message}`);
      const balancesNum = (balances || []).map((b) => ({ ...b, amount: Number(b.amount) }));
      const dist = calculateSmpDistribution(balancesNum);
      console.log('SMP distribution:', dist);
      setSmpDistribution(dist);

      // Top Activity Types
      console.log('Fetching activity types...');
      const { data: events, error: eventsError } = await withTimeout(
        supabase
          .from('wallet_events')
          .select('event_type')
      );
      if (eventsError) throw new Error(`Activity types fetch error: ${eventsError.message}`);
      const activityCount = (events || []).reduce((acc, { event_type }) => {
        acc[event_type] = (acc[event_type] || 0) + 1;
        return acc;
      }, {});
      console.log('Activity types:', activityCount);
      setActivityTypes(activityCount);

      // Total Novels Read
      console.log('Fetching novel interactions...');
      const { data: novelInteractions, error: novelError } = await withTimeout(
        supabase
          .from('novel_interactions')
          .select('read_count')
      );
      if (novelError) throw new Error(`Novel interactions fetch error: ${novelError.message}`);
      const totalRead = (novelInteractions || []).reduce((sum, { read_count }) => sum + (read_count || 0), 0);
      console.log('Total novels read:', totalRead);
      setTotalNovelsRead(totalRead);

      // Average Weekly Points
      console.log('Fetching weekly points...');
      const { data: userPoints, error: pointsError } = await withTimeout(
        supabase
          .from('users')
          .select('weekly_points')
          .not('weekly_points', 'is', null)
      );
      if (pointsError) throw new Error(`Weekly points fetch error: ${pointsError.message}`);
      const avgPoints = userPoints && userPoints.length
        ? userPoints.reduce((sum, { weekly_points }) => sum + (weekly_points || 0), 0) / userPoints.length
        : 0;
      console.log('Average weekly points:', avgPoints);
      setAvgWeeklyPoints(avgPoints);

      // Comment Activity
      console.log('Fetching comment activity...');
      const { data: comments, error: commentsError } = await withTimeout(
        supabase
          .from('comments')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo)
      );
      if (commentsError) throw new Error(`Comments fetch error: ${commentsError.message}`);
      const commentByDay = groupByDate(comments || [], 'created_at');
      console.log('Comment activity:', commentByDay);
      setCommentActivity(commentByDay);
    } catch (error) {
      console.error('Error fetching stats:', error.message, error.stack);
      setErrorMessage(error.message || 'Failed to load stats. Please try again.');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      console.log('Fetch stats completed');
      setLoading(false);
    }
  }, [activeWalletAddress]);

  const groupByDate = (data, key, uniqueKey = null) => {
    const result = {};
    if (uniqueKey) {
      const uniqueEntries = new Set();
      data.forEach((item) => {
        const date = new Date(item[key]).toLocaleDateString();
        uniqueEntries.add(`${date}-${item[uniqueKey]}`);
        result[date] = result[date] || new Set();
        result[date].add(item[uniqueKey]);
      });
      return Object.entries(result).map(([date, set]) => ({ date, count: set.size }));
    }
    data.forEach((item) => {
      const date = new Date(item[key]).toLocaleDateString();
      result[date] = (result[date] || 0) + 1;
    });
    return Object.entries(result).map(([date, count]) => ({ date, count }));
  };

  const calculateSmpDistribution = (balances) => {
    const buckets = { '<1K': 0, '1K-10K': 0, '>10K': 0 };
    balances.forEach(({ amount }) => {
      if (!Number.isFinite(amount)) return;
      if (amount < 1000) buckets['<1K']++;
      else if (amount <= 10000) buckets['1K-10K']++;
      else buckets['>10K']++;
    });
    return buckets;
  };

  // Chart Data with sanitization
  const usersOverTimeData = {
    labels: usersOverTime.length ? usersOverTime.map((d) => d.date || 'N/A') : ['No Data'],
    datasets: [
      {
        data: usersOverTime.length ? sanitizeChartData(usersOverTime.map((d) => d.count)) : [0],
        color: () => '#F28C38',
        strokeWidth: 2,
      },
    ],
  };

  const activeUsersData = {
    labels: ['Last 7 Days', 'Last 30 Days'],
    datasets: [
      {
        data: sanitizeChartData([activeUsers.last7, activeUsers.last30]),
        color: () => '#E67E22',
        strokeWidth: 2,
      },
    ],
  };

  const smpDistributionData = [
    {
      value: Number.isFinite(smpDistribution['<1K']) ? smpDistribution['<1K'] : 0,
      color: '#F28C38',
      name: '<1K SMP',
    },
    {
      value: Number.isFinite(smpDistribution['1K-10K']) ? smpDistribution['1K-10K'] : 0,
      color: '#E67E22',
      name: '1K-10K SMP',
    },
    {
      value: Number.isFinite(smpDistribution['>10K']) ? smpDistribution['>10K'] : 0,
      color: '#D76E1B',
      name: '>10K SMP',
    },
  ];
  // If all values are zero, show a single 'No Data' slice
  const allZero = smpDistributionData.every((item) => item.value === 0);
  const pieChartData = allZero
    ? [{ value: 1, color: '#444', name: 'No Data' }]
    : smpDistributionData.filter((item) => item.value > 0);

  const activityTypesData = {
    labels: Object.keys(activityTypes).length ? Object.keys(activityTypes) : ['No Data'],
    datasets: [
      {
        data: Object.keys(activityTypes).length ? sanitizeChartData(Object.values(activityTypes)) : [0],
        color: () => '#F28C38',
        strokeWidth: 2,
      },
    ],
  };

  const commentActivityData = {
    labels: commentActivity.length ? commentActivity.map((d) => d.date || 'N/A') : ['No Data'],
    datasets: [
      {
        data: commentActivity.length ? sanitizeChartData(commentActivity.map((d) => d.count)) : [0],
        color: () => '#E67E22',
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundGradientFrom: '#23234A',
    backgroundGradientTo: '#1A1A2E',
    backgroundGradientFromOpacity: 0.95,
    backgroundGradientToOpacity: 0.95,
    color: (opacity = 1) => `rgba(242, 140, 56, ${opacity})`, // vibrant orange
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    fillShadowGradient: '#F28C38',
    fillShadowGradientOpacity: 0.18,
    propsForDots: {
      r: '7',
      strokeWidth: '3',
      stroke: '#FFD580',
      fill: '#F28C38',
      shadowColor: '#F28C38',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
    },
    propsForBackgroundLines: {
      stroke: 'rgba(255,255,255,0.08)',
      strokeDasharray: '',
    },
    propsForLabels: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: 'System',
      fill: '#FFD580',
    },
    barPercentage: 0.6,
    decimalPlaces: 0,
    style: {
      borderRadius: 12,
    },
    useShadowColorFromDataset: false,
  };

  useEffect(() => {
    console.log('StatsScreen mounted, wallet:', activeWalletAddress);
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F28C38" />
          <Text style={styles.loadingText}>Loading Stats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Home')}>
          <Icon name="home" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Platform Stats</Text>
        
      </View>

      {errorMessage && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.errorContainer}>
          <TouchableOpacity onPress={() => setErrorMessage(null)}>
            <Text style={styles.errorText}>Error: {errorMessage}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Platform Statistics</Text>

        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Total Users</Text>
            <Text style={styles.statValue}>{Number.isFinite(totalUsers) ? totalUsers.toLocaleString() : 'N/A'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>SMP Rewards Bank</Text>
            <Text style={styles.statValue}>
              {Number.isFinite(mintTreasuryBalance) ? mintTreasuryBalance.toLocaleString() : 'Loading...'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Total SMP Rewarded</Text>
            <Text style={styles.statValue}>
              {Number.isFinite(rewardsWalletBalance) ? rewardsWalletBalance.toLocaleString() : 'Loading...'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Your SMP Balance</Text>
            <Text style={styles.statValue}>
              {isWalletConnected
                ? Number.isFinite(userSmpBalance.onChain) && Number.isFinite(userSmpBalance.offChain)
                  ? `${userSmpBalance.onChain.toLocaleString()} (${userSmpBalance.offChain.toLocaleString()})`
                  : 'Loading...'
                : 'Connect Wallet'}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Total Novel Reads</Text>
            <Text style={styles.statValue}>{Number.isFinite(totalNovelsRead) ? totalNovelsRead.toLocaleString() : 'N/A'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Avg Weekly Points</Text>
            <Text style={styles.statValue}>{Number.isFinite(avgWeeklyPoints) ? avgWeeklyPoints.toFixed(2) : 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.chartGrid}>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Users Over Time (30 Days)</Text>
            <LineChart
              data={usersOverTimeData}
              width={width - 40}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withShadow={true}
              withDots={true}
              withInnerLines={true}
              withOuterLines={false}
            />
            <Text style={{ color: '#FFD580', fontSize: 13, textAlign: 'center', marginTop: 4, fontFamily: 'System' }}>
              Number of unique users per day
            </Text>
          </View>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Active Users</Text>
            <BarChart
              data={activeUsersData}
              width={width - 40}
              height={220}
              chartConfig={chartConfig}
              style={styles.chart}
              showBarTops={true}
              withInnerLines={true}
              fromZero={true}
              withHorizontalLabels={true}
            />
            <Text style={{ color: '#FFD580', fontSize: 13, textAlign: 'center', marginTop: 4, fontFamily: 'System' }}>
              Active users in the last 7 and 30 days
            </Text>
          </View>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>SMP Balance Distribution</Text>
            <PieChart
              data={pieChartData.map((item, i) => ({
                ...item,
                color: item.color,
                legendFontColor: '#FFD580',
                legendFontSize: 14,
                legendFontWeight: '600',
                legendFontFamily: 'System',
                name: item.name,
              }))}
              width={width - 40}
              height={220}
              chartConfig={chartConfig}
              accessor="value"
              backgroundColor="transparent"
              style={styles.chart}
              hasLegend={true}
            />
            <Text style={{ color: '#FFD580', fontSize: 13, textAlign: 'center', marginTop: 4, fontFamily: 'System' }}>
              Distribution of SMP token holders
            </Text>
          </View>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Top Activity Types</Text>
            <BarChart
              data={activityTypesData}
              width={width - 40}
              height={220}
              chartConfig={chartConfig}
              style={styles.chart}
              showBarTops={true}
              withInnerLines={true}
              fromZero={true}
              withHorizontalLabels={true}
            />
            <Text style={{ color: '#FFD580', fontSize: 13, textAlign: 'center', marginTop: 4, fontFamily: 'System' }}>
              Number of events by activity type
            </Text>
          </View>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Comment Activity (30 Days)</Text>
            <LineChart
              data={commentActivityData}
              width={width - 40}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
              withShadow={true}
              withDots={true}
              withInnerLines={true}
              withOuterLines={false}
            />
            <Text style={{ color: '#FFD580', fontSize: 13, textAlign: 'center', marginTop: 4, fontFamily: 'System' }}>
              Comments posted per day (last 30 days)
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 Sempai HQ. All rights reserved.</Text>
      </View>
    </SafeAreaView>
  );
};

export default StatPageScreen;