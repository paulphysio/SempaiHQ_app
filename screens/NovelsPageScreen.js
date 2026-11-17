import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Dimensions,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, FUNCTIONS_URL } from '../services/supabaseClient';
import { readerAction } from '../services/readerActions';
import ConnectButton, { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import WalletPanel from '../components/WalletPanel';
import { PublicKey } from '@solana/web3.js';
import { TREASURY_PUBLIC_KEY, SMP_MINT_ADDRESS } from '../constants';
import { fetchSmpTokenBalance } from '../utils/solana';
import { callSignedEdgeFunction } from '../utils/walletSignature';
import { useTheme } from '../context/ThemeContext';
import { getNovelsStyles } from '../styles/NovelsStyles';
import { getReadingProgressMap } from '../services/readingProgress';
import { cacheSet, cacheValue } from '../services/localCache';
import ScreenSkeleton from '../components/ScreenSkeleton';
import { EmptyState } from '../components/ui';
import { Page, PageHeader, SearchField, ChipRow, SectionHeader, PosterGrid } from '../components/page/PageKit';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;
const isDesktop = width >= 1024;

const API_BASE_URL = 'https://sempaihq.com';

const TAG_OPTIONS = [
  { value: 'Action', label: 'Action' },
  { value: 'Adult(18+)', label: 'Adult(18+)' },
  { value: 'Adventure', label: 'Adventure' },
  { value: 'Comedy', label: 'Comedy' },
  { value: 'Drama', label: 'Drama' },
  { value: 'Fantasy', label: 'Fantasy' },
  { value: 'Horror', label: 'Horror' },
  { value: 'Mystery', label: 'Mystery' },
  { value: 'Romance', label: 'Romance' },
  { value: 'Sci-Fi', label: 'Sci-Fi' },
  { value: 'Slice of Life', label: 'Slice of Life' },
  { value: 'Supernatural', label: 'Supernatural' },
  { value: 'Thriller', label: 'Thriller' },
  { value: 'Historical', label: 'Historical' },
  { value: 'Sports', label: 'Sports' },
  { value: 'Psychological', label: 'Psychological' },
  { value: 'Shonen', label: 'Shonen' },
  { value: 'Shojo', label: 'Shojo' },
  { value: 'Seinen', label: 'Seinen' },
  { value: 'Josei', label: 'Josei' },
];

const MIN_WITHDRAWAL = 2500;
const FALLBACK_IMAGE = 'https://placehold.co/300x400/png?text=No+Image';

const NovelsPageScreen = () => {
  const navigation = useNavigation();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const secretKey = walletContext?.secretKey;
  const { isDark, colors } = useTheme();
  const themedStyles = useMemo(() => getNovelsStyles(isDark), [isDark]);
  
  const [publicKey, setPublicKey] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [balance, setBalance] = useState(0);
  const [offChainBalance, setOffChainBalance] = useState(0);
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [novels, setNovels] = useState([]);
  const [filteredNovels, setFilteredNovels] = useState([]);
  const [userId, setUserId] = useState(null);
  const [progressMap, setProgressMap] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [onChainBalance, setOnChainBalance] = useState(0);
  const isMounted = useRef(true);
  const cardWidth = isDesktop ? (width - 96) / 4 : isTablet ? (width - 64) / 3 : (width - 56) / 2;

  // Sync wallet state
  useEffect(() => {
    const syncWallet = async () => {
      try {
        if (wallet?.publicKey) {
          const walletAddress = wallet.publicKey.toString();
          console.log('Syncing wallet from context:', walletAddress);
          setPublicKey(walletAddress);
          setIsWalletConnected(true);
          await AsyncStorage.setItem('walletAddress', walletAddress);
          console.log('Wallet address stored in AsyncStorage');
        } else {
          const storedAddress = await AsyncStorage.getItem('walletAddress');
          console.log('Retrieved wallet from AsyncStorage:', storedAddress);
          if (storedAddress && isMounted.current) {
            setPublicKey(storedAddress);
            setIsWalletConnected(true);
            console.log('Wallet restored from AsyncStorage');
          } else {
            setPublicKey(null);
            setIsWalletConnected(false);
            console.log('No wallet found in storage');
          }
        }
      } catch (err) {
        console.error('Error syncing wallet:', err.message);
        setErrorMessage('Failed to sync wallet: ' + err.message);
        // Reset wallet state on error
        setPublicKey(null);
        setIsWalletConnected(false);
      }
    };
    syncWallet();
  }, [wallet]);

  const checkBalance = async () => {
    if (!isWalletConnected || !publicKey) {
      console.log('checkBalance skipped: Wallet not connected or no publicKey');
      return;
    }
    try {
      console.log('Checking balance for wallet:', publicKey);
      
      // Normalize the wallet address to ensure consistent format
      const normalizedWalletAddress = publicKey.toString();
      
      // Get user data
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, weekly_points')
        .eq('wallet_address', normalizedWalletAddress)
        .single();

      if (userError) {
        setErrorMessage('User not found. Please register your wallet.');
        throw new Error(`User lookup failed: ${userError.message}`);
      }

      setUserId(user.id);
      setWeeklyPoints(user.weekly_points || 0);

      // Reading progress badges on cards
      getReadingProgressMap(user.id).then((map) => {
        if (isMounted.current) setProgressMap(map);
      });

      // Fetch off-chain balance from Supabase (wallet_balances table)
      const { data: walletBalances, error: walletBalancesError } = await supabase
        .from('wallet_balances')
        .select('amount')
        .eq('wallet_address', normalizedWalletAddress)
        .eq('chain', 'SOL')
        .eq('currency', 'SMP');

      console.log('wallet_balances query result:', walletBalances);

      if (walletBalancesError) {
        throw new Error(`Balances lookup failed: ${walletBalancesError.message}`);
      }

      const offChainBalance = walletBalances && walletBalances.length > 0 ? walletBalances[0].amount : 0;
      setOffChainBalance(offChainBalance);

      // Only use off-chain SMP balance
      setBalance(offChainBalance);
      console.log('Off-chain SMP balance:', offChainBalance);

      // Get pending withdrawals
      const { data: pendingData, error: pendingError } = await supabase
        .from('pending_withdrawals')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (pendingError) {
        console.error('Error fetching pending withdrawals:', pendingError.message);
        throw new Error(`Pending withdrawals lookup failed: ${pendingError.message}`);
      }

      const totalPending = pendingData?.reduce((sum, w) => sum + w.amount, 0) || 0;
      setPendingWithdrawal(totalPending);
    } catch (error) {
      console.error('checkBalance error:', error.message);
      setErrorMessage(error.message);
    }
  };

  const handleWithdraw = async () => {
    if (!isWalletConnected || !publicKey) {
      setErrorMessage('Please connect your wallet.');
      console.log('handleWithdraw failed: Wallet not connected');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
      setErrorMessage(`Withdrawal amount must be at least ${MIN_WITHDRAWAL} SMP.`);
      return;
    }

    try {
      setIsWithdrawing(true);
      setErrorMessage('');

      // First get the user's ID
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', publicKey)
        .single();

      if (userError || !user) throw new Error('User not found');

      // Get both on-chain and off-chain balances
      const { data: balances, error: balancesError } = await supabase
        .from('wallet_balances')
        .select('amount, chain')
        .eq('user_id', user.id)
        .eq('currency', 'SMP')
        .in('chain', ['SOL', 'OFF_CHAIN']);

      if (balancesError) {
        console.error('Error fetching balances:', balancesError);
        throw new Error('Failed to fetch balances');
      }

      // Fetch user's SMP balance from wallet_balances using user_id (backend-compatible)
      const { data: walletBalances, error: walletBalancesError } = await supabase
        .from('wallet_balances')
        .select('amount')
        .eq('user_id', user.id)
        .eq('chain', 'SOL')
        .eq('currency', 'SMP');
      if (walletBalancesError) {
        throw new Error(`Balances lookup failed: ${walletBalancesError.message}`);
      }
      console.log('wallet_balances query result (withdrawal, user_id):', walletBalances);
      if (!walletBalances || walletBalances.length === 0) {
        throw new Error('Wallet balance not found. Please contact support if this is unexpected.');
      }
      const offChainBalance = walletBalances[0].amount;
      console.log('User off-chain balance:', offChainBalance);

      if (offChainBalance < amount) {
        throw new Error(
          `Insufficient off-chain balance: ${offChainBalance.toLocaleString()} SMP available, need ${amount.toLocaleString()} SMP.`
        );
      }

      // Make the withdrawal request with wallet signature authentication
      const edgeUrl = `${FUNCTIONS_URL}/withdraw-smp`;
      console.log('Making withdrawal request to:', edgeUrl, {
        walletAddress: publicKey,
        amount
      });

      // Get private key from wallet context for signing
      const privateKey = secretKey;
      if (!privateKey) {
        throw new Error('Wallet private key not available. Please reconnect your wallet.');
      }

      // Call with wallet signature authentication
      const response = await callSignedEdgeFunction(
        edgeUrl,
        'withdraw',
        { walletAddress: publicKey, amount },
        privateKey
      );

      const result = await response.json();
      if (!response.ok || result.error) {
        let errorMessage = result.error || `Withdrawal failed: HTTP ${response.status}`;
        if (errorMessage.includes('Treasury has insufficient SMP')) {
          errorMessage = 'Treasury has insufficient on-chain SMP balance. Please try again later or contact support.';
        }
        throw new Error(errorMessage);
      }

      // The withdraw-smp function already deducted the balance (debit_smp) —
      // just reflect it on screen.
      setOffChainBalance(offChainBalance - amount);
      setWithdrawAmount('');
      setErrorMessage(`Successfully withdrew ${amount.toLocaleString()} SMP to your wallet! Transaction signature: ${result.signature}`);
      
      // Refresh balances after withdrawal
      await checkBalance();
      
      setTimeout(() => setErrorMessage(''), 10000);
    } catch (error) {
      console.error('Withdrawal error:', error);
      setErrorMessage(error.message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const fetchNovels = async () => {
    try {
      const { data: novelsData, error: novelsError } = await supabase
        .from('novels')
        .select(`
          id,
          title,
          image,
          summary,
          tags,
          user_id,
          viewers_count,
          status,
          users:user_id (name)
        `)
        .eq('is_visible', true);

      if (novelsError) throw new Error(`Failed to fetch novels: ${novelsError.message}`);

      if (isMounted.current) {
        setNovels(novelsData);
        setFilteredNovels(novelsData);
      }
      cacheSet('lib:novels', novelsData);
    } catch (error) {
      // Offline / flaky connection: show the last library we had.
      const cached = await cacheValue('lib:novels');
      if (cached && isMounted.current) {
        setNovels(cached);
        setFilteredNovels(cached);
      } else {
        console.warn('Error fetching novels:', error?.message);
        setErrorMessage(error.message);
      }
    }
  };

  const filterNovels = () => {
    let result = novels;
    if (searchQuery) {
      result = result.filter(
        (novel) =>
          novel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          novel.users?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (selectedTags.length > 0) {
      result = result.filter((novel) =>
        selectedTags.every((tag) => novel.tags?.includes(tag))
      );
    }
    setFilteredNovels(result);
  };

  const toggleTag = (tagValue) => {
    setSelectedTags((prev) =>
      prev.includes(tagValue)
        ? prev.filter((tag) => tag !== tagValue)
        : [...prev, tagValue]
    );
  };

  useEffect(() => {
    filterNovels();
  }, [searchQuery, selectedTags, novels]);

  useEffect(() => {
    const fetchCountdown = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'weekly_reward_timer')
        .single();

      if (error || !data) {
        setTimeLeft('Unknown');
      } else {
        const lastResetTime = new Date(data.value);
        const nextResetTime = getNextSundayMidnight(lastResetTime);
        updateCountdown(nextResetTime);
      }
    };

    const getNextSundayMidnight = (lastResetTime) => {
      const nextSunday = new Date(lastResetTime);
      nextSunday.setDate(lastResetTime.getDate() + ((7 - lastResetTime.getDay()) % 7 || 7));
      nextSunday.setHours(0, 0, 0, 0);
      return nextSunday;
    };

    const updateCountdown = (endTime) => {
      const interval = setInterval(() => {
        const now = new Date();
        const timeDiff = endTime - now;

        if (timeDiff <= 0) {
          clearInterval(interval);
          setTimeLeft('🔄 Resetting...');
          resetTimer();
        } else {
          const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((timeDiff / (1000 * 60 * 60)) % 24);
          const minutes = Math.floor((timeDiff / (1000 * 60)) % 60);
          const seconds = Math.floor((timeDiff / 1000) % 60);
          setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        }
      }, 1000);

      return () => clearInterval(interval);
    };

    const resetTimer = async () => {
      // The server restarts the countdown only when it's actually due.
      const res = await readerAction('reward_timer_reset');
      const error = res.ok ? null : { message: res.error };

      if (error) {
        console.error('Timer reset failed:', error.message);
        setTimeLeft('Error');
      } else {
        fetchCountdown();
      }
    };

    fetchCountdown();
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      if (isWalletConnected && publicKey) {
        await Promise.all([
          checkBalance(),
          fetchNovels(),
          (async () => {
            try {
              const bal = await fetchSmpTokenBalance(publicKey);
              setOnChainBalance(bal);
            } catch (e) {
              setOnChainBalance(0);
              console.error('Error fetching on-chain SMP balance:', e);
            }
          })(),
        ]);
      } else {
        await fetchNovels();
      }
    } finally {
      setLoading(false);
    }
  }, [isWalletConnected, publicKey]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Pull-to-refresh: re-run the same fetch as the mount effect.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const openNovel = useCallback((item) => navigation.navigate('NovelDetail', { id: item.id }), [navigation]);

  const cards = useMemo(
    () =>
      filteredNovels.map((n) => {
        const prog = progressMap?.[`novel:${n.id}`];
        const pct = prog ? Math.max(0, Math.min(100, Number(prog.scroll_pct) || 0)) : undefined;
        const ch = prog ? parseInt(prog.chapter_key, 10) : NaN;
        return {
          id: n.id,
          kind: 'novel',
          title: n.title,
          image: n.image,
          author: n.users?.name,
          status: n.status,
          views: n.viewers_count,
          isAdult: !!n.tags?.includes('Adult(18+)'),
          progress: pct,
          meta: prog ? `${Number.isNaN(ch) ? 'Reading' : `Ch. ${ch + 1}`} · ${Math.round(pct)}%` : undefined,
        };
      }),
    [filteredNovels, progressMap]
  );

  // Memoised: the reward countdown below ticks every second and must not
  // re-render the whole grid with it.
  const grid = useMemo(
    () =>
      cards.length ? (
        <PosterGrid items={cards} onOpen={openNovel} />
      ) : (
        <EmptyState
          icon="book-open"
          title={searchQuery || selectedTags.length ? 'No matches' : 'No novels yet'}
          subtitle={
            searchQuery || selectedTags.length
              ? 'Try a different title, author or genre.'
              : 'New stories are on the way — check back soon.'
          }
          action={searchQuery || selectedTags.length ? 'Clear filters' : undefined}
          onAction={() => {
            setSearchQuery('');
            setSelectedTags([]);
          }}
        />
      ),
    [cards, openNovel, searchQuery, selectedTags.length]
  );

  if (loading) {
    return <ScreenSkeleton variant="grid" label="Loading novels" />;
  }

  return (
    <Page
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}
    >
      <PageHeader eyebrow="Library" title="Hoard" subtitle="Every novel on SempaiHQ, in one place." />
      <SearchField value={searchQuery} onChangeText={setSearchQuery} placeholder="Search title or author" />
      <ChipRow
        options={TAG_OPTIONS}
        selected={selectedTags}
        onToggle={toggleTag}
        onClear={() => setSelectedTags([])}
      />

      <SectionHeader title={searchQuery || selectedTags.length ? 'Results' : 'All novels'} count={cards.length} />
      {grid}

      <SectionHeader title="Your rewards" />
      <WalletPanel
        isWalletConnected={isWalletConnected}
        balance={balance}
        offChainBalance={offChainBalance}
        onChainBalance={onChainBalance}
        weeklyPoints={weeklyPoints}
        pendingWithdrawal={pendingWithdrawal}
        withdrawAmount={withdrawAmount}
        setWithdrawAmount={setWithdrawAmount}
        isWithdrawing={isWithdrawing}
        handleWithdraw={handleWithdraw}
        checkBalance={checkBalance}
        errorMessage={errorMessage}
        timeLeft={timeLeft}
      />
    </Page>
  );
};

export default NovelsPageScreen;
