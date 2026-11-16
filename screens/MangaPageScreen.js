import React, { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import { View, Text, FlatList, SafeAreaView, StatusBar, Alert, Image, ScrollView, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../services/supabaseClient';
import { getReadingProgressMap } from '../services/readingProgress';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import ConnectButton from '../components/ConnectButton';
import { fetchSmpTokenBalance } from '../utils/solana';
import { callSignedEdgeFunction } from '../utils/walletSignature';
import { formatNumber } from '../utils/formatNumber';
import { useTheme } from '../context/ThemeContext';
import {
  Screen, AppBar, IconButton, Input, Chip, Tap, PosterCard, PosterGridSkeleton, EmptyState,
  WalletPill, Sheet, StatTile, GradientButton, GhostButton, Toast, Field,
} from '../components/ui';
import { radius, space, layout, glow, useMangaTheme } from '../theme/theme';
import { getStyles as getPageStyles } from '../styles/MangaPageStyles';

const TAG_OPTIONS = [
  'Action', 'Adult(18+)', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance',
  'Sci-Fi', 'Slice of Life', 'Supernatural', 'Thriller', 'Historical', 'Sports', 'Psychological',
  'Shonen', 'Shojo', 'Seinen', 'Josei',
];

const MIN_WITHDRAWAL = 2500;

const MangaPageScreen = () => {
  const navigation = useNavigation();
  const { isDark, colors: themeColors } = useTheme();
  const mangaTheme = useMangaTheme();
  const { colors, gradients, type } = mangaTheme;
  const styles = useMemo(() => getPageStyles(mangaTheme), [mangaTheme]);
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const secretKey = walletContext?.secretKey;
  const isWalletConnected = !!wallet?.publicKey;

  const [onChainBalance, setOnChainBalance] = useState(0);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [mangaList, setMangaList] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0);
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [message, setMessage] = useState('');
  const [walletOpen, setWalletOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [progressMap, setProgressMap] = useState({});

  /* ───── on-chain balance when the wallet sheet opens ───── */
  useEffect(() => {
    if (!walletOpen || !wallet?.publicKey) return;
    (async () => {
      try {
        const bal = await fetchSmpTokenBalance(wallet.publicKey.toString());
        setOnChainBalance(bal);
      } catch (e) {
        setOnChainBalance(0);
        console.error('Error fetching on-chain SMP balance:', e);
      }
    })();
  }, [walletOpen, wallet]);

  /* ───── weekly reward countdown (interval is now cleaned up correctly) ───── */
  useEffect(() => {
    let interval;
    let cancelled = false;

    const nextSundayMidnight = (last) => {
      const d = new Date(last);
      d.setDate(last.getDate() + ((7 - last.getDay()) % 7 || 7));
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const resetTimer = async () => {
      const { error } = await supabase
        .from('settings')
        .update({ value: new Date().toISOString() })
        .eq('key', 'weekly_reward_timer');
      if (error) {
        console.error('Timer reset failed:', error.message);
        if (!cancelled) setCountdown('Error');
      } else if (!cancelled) {
        init();
      }
    };

    const init = async () => {
      const { data, error } = await supabase.from('settings').select('value').eq('key', 'weekly_reward_timer').single();
      if (cancelled) return;
      if (error || !data) {
        setCountdown('Unknown');
        return;
      }
      const end = nextSundayMidnight(new Date(data.value));
      const tick = () => {
        const diff = end - new Date();
        if (diff <= 0) {
          clearInterval(interval);
          setCountdown('Resetting…');
          resetTimer();
          return;
        }
        setCountdown({
          d: Math.floor(diff / 86400000),
          h: Math.floor((diff / 3600000) % 24),
          m: Math.floor((diff / 60000) % 60),
          s: Math.floor((diff / 1000) % 60),
        });
      };
      clearInterval(interval);
      tick();
      interval = setInterval(tick, 1000);
    };

    init();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const checkBalance = async () => {
    if (!wallet?.publicKey) return;
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, weekly_points')
        .eq('wallet_address', wallet.publicKey.toString())
        .single();
      if (error || !user) throw new Error('User not found');
      setWeeklyPoints(user.weekly_points || 0);

      // Reading progress badges on cards
      getReadingProgressMap(user.id).then(setProgressMap);

      const { data: walletBalance } = await supabase
        .from('wallet_balances')
        .select('amount')
        .eq('user_id', user.id)
        .eq('currency', 'SMP')
        .eq('chain', 'SOL')
        .maybeSingle();
      setBalance(walletBalance?.amount || 0);

      const { data: pendingData } = await supabase
        .from('pending_withdrawals')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending');
      setPendingWithdrawal(pendingData?.reduce((sum, w) => sum + w.amount, 0) || 0);
    } catch (error) {
      setMessage(error.message);
      Alert.alert('Error', error.message);
    }
  };

  const handleWithdraw = async () => {
    if (!isWalletConnected || !wallet?.publicKey) {
      setMessage('Please connect your wallet.');
      return;
    }
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
      setMessage(`Withdrawal amount must be at least ${MIN_WITHDRAWAL.toLocaleString()} SMP.`);
      return;
    }
    try {
      setWithdrawing(true);
      setMessage('');
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet.publicKey.toString())
        .single();
      if (userError || !user) throw new Error('User not found');

      const { data: walletBalances, error: walletBalancesError } = await supabase
        .from('wallet_balances')
        .select('amount')
        .eq('user_id', user.id)
        .eq('chain', 'SOL')
        .eq('currency', 'SMP');
      if (walletBalancesError) throw new Error(`Balances lookup failed: ${walletBalancesError.message}`);
      if (!walletBalances || walletBalances.length === 0) throw new Error('Wallet balance not found. Please contact support if this is unexpected.');
      const offChainBalance = walletBalances[0].amount;
      if (offChainBalance < amount) {
        throw new Error(`Insufficient off-chain balance: ${offChainBalance.toLocaleString()} SMP available, need ${amount.toLocaleString()} SMP.`);
      }

      const edgeUrl = 'https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/withdraw-smp';
      const privateKey = secretKey;
      if (!privateKey) throw new Error('Wallet private key not available. Please reconnect your wallet.');

      const response = await callSignedEdgeFunction(
        edgeUrl,
        'withdraw',
        { walletAddress: wallet.publicKey.toString(), amount },
        privateKey
      );
      if (!response.ok) {
        const errorText = await response.text();
        let msg;
        try {
          msg = JSON.parse(errorText).error || `Withdrawal failed: HTTP ${response.status}`;
        } catch (e) {
          msg = `Withdrawal failed: ${errorText || `HTTP ${response.status}`}`;
        }
        throw new Error(msg);
      }
      const result = await response.json();
      if (result.error) throw new Error(result.error);

      setBalance(offChainBalance - amount);
      setWithdrawAmount('');
      setMessage(`Successfully withdrew ${amount.toLocaleString()} SMP to your wallet! Transaction signature: ${result.signature}`);
      await checkBalance();
      setTimeout(() => setMessage(''), 10000);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setWithdrawing(false);
    }
  };

  const fetchManga = async () => {
    try {
      const { data: mangaData, error: mangaError } = await supabase
        .from('manga')
        .select('id, title, cover_image, summary, tags, user_id, users:user_id (name)')
        .eq('is_visible', true);
      if (mangaError) throw new Error(`Failed to fetch manga: ${mangaError.message}`);

      const { data: interactionsData, error: interactionsError } = await supabase
        .from('manga_interactions')
        .select('manga_id, user_id');
      if (interactionsError) throw new Error(`Failed to fetch interactions: ${interactionsError.message}`);

      const viewerCounts = interactionsData.reduce((acc, { manga_id, user_id }) => {
        if (!acc[manga_id]) acc[manga_id] = new Set();
        acc[manga_id].add(user_id);
        return acc;
      }, {});

      setMangaList(
        mangaData.map((m) => ({ ...m, uniqueViewers: viewerCounts[m.id] ? viewerCounts[m.id].size : 0 }))
      );
    } catch (error) {
      console.error('Error fetching manga:', error);
      setMessage(error.message);
      Alert.alert('Error', error.message);
    }
  };

  const filteredManga = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mangaList.filter((m) => {
      const matchQ = !q || m.title?.toLowerCase().includes(q) || m.users?.name?.toLowerCase().includes(q);
      const matchT = !selectedTag || m.tags?.includes(selectedTag);
      return matchQ && matchT;
    });
  }, [mangaList, searchQuery, selectedTag]);

  /* ───── weekly reward countdown (interval is now cleaned up correctly) ───── */
  useEffect(() => {
    let interval;
    let cancelled = false;

    const nextSundayMidnight = (last) => {
      const d = new Date(last);
      d.setDate(last.getDate() + ((7 - last.getDay()) % 7 || 7));
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const resetTimer = async () => {
      const { error } = await supabase
        .from('settings')
        .update({ value: new Date().toISOString() })
        .eq('key', 'weekly_reward_timer');
      if (error) {
        console.error('Timer reset failed:', error.message);
        if (!cancelled) setCountdown('Error');
      } else if (!cancelled) {
        init();
      }
    };

    const init = async () => {
      const { data, error } = await supabase.from('settings').select('value').eq('key', 'weekly_reward_timer').single();
      if (cancelled) return;
      if (error || !data) {
        setCountdown('Unknown');
        return;
      }
      const end = nextSundayMidnight(new Date(data.value));
      const tick = () => {
        const diff = end - new Date();
        if (diff <= 0) {
          clearInterval(interval);
          setCountdown('Resetting…');
          resetTimer();
          return;
        }
        setCountdown({
          d: Math.floor(diff / 86400000),
          h: Math.floor((diff / 3600000) % 24),
          m: Math.floor((diff / 60000) % 60),
          s: Math.floor((diff / 1000) % 60),
        });
      };
      clearInterval(interval);
      tick();
      interval = setInterval(tick, 1000);
    };

    init();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      if (isWalletConnected && wallet?.publicKey) {
        await Promise.all([checkBalance(), fetchManga()]);
      } else {
        await fetchManga();
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [isWalletConnected, wallet?.publicKey]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Pull-to-refresh: silent reload — keeps the grid visible, no skeleton flash.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData(false);
    } finally {
      setRefreshing(false);
    }
  };

  const renderItem = useCallback(
    ({ item, index }) => {
      const prog = progressMap?.[`manga:${item.id}`];
      const progPct = prog ? Math.max(0, Math.min(100, Number(prog.scroll_pct) || 0)) : 0;
      return (
      <PosterCard
        index={index}
        cover={item.cover_image}
        title={item.title}
        author={item.users?.name}
        views={formatNumber(item.uniqueViewers)}
        adult={item.tags?.includes('Adult(18+)')}
        progress={prog ? progPct : undefined}
        badge={prog ? (
          <View style={styles.progressChip}>
            <Text style={styles.progressChipText}>
              Ch. {prog.chapter_number ?? '—'} · {Math.round(progPct)}%
            </Text>
          </View>
        ) : undefined}
        onPress={() => navigation.navigate('MangaDetail', { id: item.id })}
        onAuthor={() => navigation.navigate('CreatorsProfile', { userId: item.user_id })}
      />
      );
    },
    [navigation, progressMap]
  );

  /* ───── header: search + genre rail ───── */
  const header = (
    <View>
      <View style={styles.searchWrap}>
        <Input
          icon="search"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search titles or artists"
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search manga"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
        <Chip label="All" active={!selectedTag} onPress={() => setSelectedTag('')} />
        {TAG_OPTIONS.map((t) => (
          <Chip key={t} label={t} active={selectedTag === t} onPress={() => setSelectedTag(selectedTag === t ? '' : t)} color={t === 'Adult(18+)' ? colors.danger : colors.primary} />
        ))}
      </ScrollView>

      <View style={styles.resultsRow}>
        <Text style={type.label}>{loading ? 'Loading' : `${filteredManga.length} ${filteredManga.length === 1 ? 'series' : 'series'}`}</Text>
        {(searchQuery || selectedTag) && !loading ? (
          <Tap onPress={() => { setSearchQuery(''); setSelectedTag(''); }}>
            <Text style={styles.clearText}>Clear filters</Text>
          </Tap>
        ) : null}
      </View>
    </View>
  );

  const isError = message && !message.startsWith('Successfully');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={themeColors.bg} />
      <Screen style={{ backgroundColor: themeColors.bg }}>
        {loading ? (
          <View style={{ flex: 1 }}>
            {header}
            <PosterGridSkeleton />
          </View>
        ) : (
          <FlatList
            data={filteredManga}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={styles.columnWrap}
            contentContainerStyle={[styles.grid, { paddingBottom: 100 }]}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <EmptyState
                icon="book-open"
                title={searchQuery || selectedTag ? 'No matches found' : 'The library is empty'}
                subtitle={searchQuery || selectedTag ? 'Try a different search or genre.' : 'New series will appear here soon.'}
                action={searchQuery || selectedTag ? 'Clear filters' : undefined}
                onAction={() => { setSearchQuery(''); setSelectedTag(''); }}
              />
            }
            keyboardShouldPersistTaps="handled"
            initialNumToRender={6}
            windowSize={9}
            removeClippedSubviews
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.accent} colors={[themeColors.accent]} />
            }
          />
        )}

        {isWalletConnected ? (
          <View style={styles.pillWrap} pointerEvents="box-none">
            <WalletPill smp={formatNumber(balance)} points={formatNumber(weeklyPoints)} open={walletOpen} onPress={() => setWalletOpen(true)} />
          </View>
        ) : null}
      </Screen>

      {/* ───── Wallet sheet ───── */}
      <Sheet visible={walletOpen} onClose={() => setWalletOpen(false)} title="Your Wallet" tall>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xl }}>
          <View style={styles.tileRow}>
            <StatTile icon="coins" label="SMP · off-chain" value={formatNumber(balance)} color={colors.primary} />
            <View style={{ width: space.sm }} />
            <StatTile icon="link" label="SMP · on-chain" value={onChainBalance?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '0'} color={colors.electric} />
          </View>
          <View style={[styles.tileRow, { marginTop: space.sm }]}>
            <StatTile icon="star" label="Weekly points" value={formatNumber(weeklyPoints)} color={colors.gold} />
            <View style={{ width: space.sm }} />
            <StatTile icon="hourglass-half" label="Pending" value={formatNumber(pendingWithdrawal)} color={colors.sakura} />
          </View>

          <View style={{ height: space.xl }} />
          <Field label="Withdraw to wallet" hint={`Minimum ${MIN_WITHDRAWAL.toLocaleString()} SMP`}>
            <Input
              icon="coins"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder={`Amount (min ${MIN_WITHDRAWAL.toLocaleString()})`}
              keyboardType="numeric"
              accessibilityLabel="Withdraw amount"
            />
            <View style={styles.quickRow}>
              <Chip label="Min" onPress={() => setWithdrawAmount(String(MIN_WITHDRAWAL))} />
              <Chip label="25%" onPress={() => setWithdrawAmount(String(Math.floor(balance * 0.25)))} />
              <Chip label="50%" onPress={() => setWithdrawAmount(String(Math.floor(balance * 0.5)))} />
              <Chip label="Max" onPress={() => setWithdrawAmount(String(Math.floor(balance)))} />
            </View>
          </Field>

          {message ? <Toast message={message} type={isError ? 'error' : 'success'} style={{ marginHorizontal: 0 }} /> : null}

          <GradientButton label="Withdraw SMP" icon="arrow-up" onPress={handleWithdraw} loading={withdrawing} disabled={withdrawing} />
          <View style={{ height: space.sm }} />
          <GhostButton label="Refresh balances" icon="sync-alt" onPress={checkBalance} disabled={withdrawing} />
        </ScrollView>
      </Sheet>
    </SafeAreaView>
  );
};

export default MangaPageScreen;
