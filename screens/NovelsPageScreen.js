import React, { useState, useEffect, useRef, useContext } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import ConnectButton, { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import WalletPanel from '../components/WalletPanel';
import { PublicKey } from '@solana/web3.js';
import { TREASURY_PUBLIC_KEY, SMP_MINT_ADDRESS } from '../constants';
import { fetchSmpTokenBalance } from '../utils/solana';

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;
const isDesktop = width >= 1024;

// Kaito Adventure Design System - Japanese Dark-Orange
const KA_COLORS = {
  bgPrimary: '#0c0c0c',
  bgCard: '#141210',
  bgElevated: '#1a1714',
  orangePrimary: '#cc5500',
  orangeBright: '#ff6b35',
  orangeSoft: '#e67e22',
  orangeDim: '#8b4513',
  gold: '#c9a84c',
  goldBright: '#ffd700',
  ivory: '#f5e6d3',
  ivoryDim: '#c4b5a0',
  border: '#2d2418',
  textPrimary: '#f5e6d3',
  textSecondary: '#a09080',
  textMuted: '#6b5d4f',
  success: '#4a7c59',
  error: '#c41e3a',
  warning: '#c9a84c',
};

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KA_COLORS.bgPrimary,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: KA_COLORS.bgPrimary,
  },
  emberContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  ember: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: KA_COLORS.orangePrimary,
    shadowColor: KA_COLORS.orangeBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  scrollContent: {
    paddingBottom: 240,
  },
  // Hero Section
  heroSection: {
    padding: isTablet ? 32 : 24,
    backgroundColor: KA_COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
  },
  heroContent: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  heroTitle: {
    color: KA_COLORS.gold,
    fontSize: isTablet ? 36 : 28,
     
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  heroSubtitle: {
    color: KA_COLORS.textSecondary,
    fontSize: isTablet ? 16 : 14,
    letterSpacing: 1,
    marginBottom: 24,
  },
  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: KA_COLORS.ivory,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  searchPlaceholder: {
    color: KA_COLORS.textMuted,
  },
  clearButton: {
    padding: 8,
  },
  // Tag Filters
  tagFiltersContainer: {
    marginBottom: 8,
  },
  tagFiltersLabel: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 12,
    letterSpacing: 1,
  },
  tagFiltersScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  tagChipActive: {
    backgroundColor: KA_COLORS.orangePrimary,
    borderColor: KA_COLORS.orangePrimary,
  },
  tagChipText: {
    color: KA_COLORS.textSecondary,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  tagChipTextActive: {
    color: KA_COLORS.ivory,
     
  },
  clearTagsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KA_COLORS.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  clearTagsText: {
    color: KA_COLORS.ivory,
    fontSize: 13,
    marginLeft: 6,
  },
  // Results Header
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 32 : 24,
    paddingVertical: 16,
    backgroundColor: KA_COLORS.bgPrimary,
  },
  resultsCount: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    letterSpacing: 1,
  },
  resultsCountHighlight: {
    color: KA_COLORS.gold,
     
  },
  // Grid Container
  gridContainer: {
    paddingHorizontal: isTablet ? 32 : 24,
    paddingTop: 16,
  },
  gridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  // Novel Card
  novelCard: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  novelCardTouchable: {
    width: '100%',
  },
  novelCoverContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: KA_COLORS.bgElevated,
  },
  novelCover: {
    width: '100%',
    height: '100%',
  },
  novelCoverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgElevated,
  },
  novelCoverPlaceholderText: {
    color: KA_COLORS.textMuted,
    fontSize: 14,
    letterSpacing: 1,
  },
  adultBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: KA_COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adultBadgeText: {
    color: KA_COLORS.ivory,
    fontSize: 11,
     
    letterSpacing: 0.5,
  },
  novelInfo: {
    padding: 16,
    minHeight: 100,
  },
  novelTitle: {
    color: KA_COLORS.ivory,
    fontSize: isTablet ? 16 : 15,
     
    marginBottom: 8,
    letterSpacing: 0.5,
    lineHeight: 22,
    height: 44,
  },
  novelMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: KA_COLORS.border,
  },
  novelAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  novelAuthorIcon: {
    marginRight: 6,
  },
  novelAuthorText: {
    color: KA_COLORS.textSecondary,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  novelViewers: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  novelViewersIcon: {
    marginRight: 4,
  },
  novelViewersText: {
    color: KA_COLORS.textSecondary,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgPrimary,
    minHeight: 400,
  },
  loadingText: {
    color: KA_COLORS.ivory,
    fontSize: 16,
    marginTop: 16,
    letterSpacing: 1,
  },
  // Skeleton Loading
  skeletonContainer: {
    paddingHorizontal: isTablet ? 32 : 24,
    paddingTop: 16,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  skeletonCard: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  skeletonCover: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: KA_COLORS.bgElevated,
  },
  skeletonInfo: {
    padding: 16,
  },
  skeletonTitle: {
    height: 20,
    backgroundColor: KA_COLORS.bgElevated,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonMeta: {
    height: 14,
    backgroundColor: KA_COLORS.bgElevated,
    borderRadius: 4,
    width: '60%',
  },
  // Empty State
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    marginBottom: 24,
  },
  emptyTitle: {
    color: KA_COLORS.ivory,
    fontSize: 20,
     
    marginBottom: 12,
    letterSpacing: 1,
  },
  emptyText: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.5,
    maxWidth: 400,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KA_COLORS.orangePrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  emptyButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
     
    marginLeft: 8,
    letterSpacing: 1,
  },
  // Footer
  footer: {
    padding: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: KA_COLORS.border,
    backgroundColor: KA_COLORS.bgCard,
  },
  footerText: {
    color: KA_COLORS.textMuted,
    fontSize: 12,
    letterSpacing: 1,
  },
});

const NovelsPageScreen = () => {
  const navigation = useNavigation();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const [publicKey, setPublicKey] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [balance, setBalance] = useState(0);
  const [offChainBalance, setOffChainBalance] = useState(0);
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [novels, setNovels] = useState([]);
  const [filteredNovels, setFilteredNovels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [onChainBalance, setOnChainBalance] = useState(0);
  const isMounted = useRef(true);
  const emberAnims = useRef([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardWidth = isDesktop ? (width - 96) / 4 : isTablet ? (width - 64) / 3 : (width - 56) / 2;

  // Initialize ember particles
  useEffect(() => {
    const embers = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 4,
    }));
    emberAnims.current = embers.map(() => new Animated.Value(0));
    
    emberAnims.current.forEach((anim, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(embers[index].delay * 1000),
          Animated.timing(anim, {
            toValue: 1,
            duration: embers[index].duration * 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

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

      setWeeklyPoints(user.weekly_points || 0);

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

      // Make the withdrawal request which will check Treasury's on-chain balance

      // Call the Deno Edge Function for withdrawal
      const edgeUrl = `https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/withdraw-smp`;
      console.log('Making withdrawal request to:', edgeUrl, {
        userId: user.id,
        walletAddress: publicKey,
        amount
      });

      // Get the user's Supabase access token for authorization
      let accessToken = null;
      if (supabase.auth.getSession) {
        const sessionRes = await supabase.auth.getSession();
        accessToken = sessionRes?.data?.session?.access_token;
      } else if (supabase.auth.session) {
        accessToken = supabase.auth.session()?.access_token;
      }

      const response = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          walletAddress: publicKey,
          amount
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        let errorMessage = result.error || `Withdrawal failed: HTTP ${response.status}`;
        if (errorMessage.includes('Treasury has insufficient SMP')) {
          errorMessage = 'Treasury has insufficient on-chain SMP balance. Please try again later or contact support.';
        }
        throw new Error(errorMessage);
      }

      // Update off-chain balance after successful on-chain transfer
      const { error: updateError } = await supabase
        .from('wallet_balances')
        .update({ 
          amount: offChainBalance - amount 
        })
        .eq('user_id', user.id)
        .eq('currency', 'SMP')
        .eq('chain', 'OFF_CHAIN');

      if (updateError) {
        console.error('Error updating off-chain balance:', updateError);
        throw new Error('Failed to update off-chain balance');
      }

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
          users:user_id (name)
        `)
        .eq('is_visible', true);

      if (novelsError) throw new Error(`Failed to fetch novels: ${novelsError.message}`);

      if (isMounted.current) {
        setNovels(novelsData);
        setFilteredNovels(novelsData);
      }
    } catch (error) {
      console.error('Error fetching novels:', error);
      setErrorMessage(error.message);
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
      const newTime = new Date().toISOString();
      const { error } = await supabase
        .from('settings')
        .update({ value: newTime })
        .eq('key', 'weekly_reward_timer');

      if (error) {
        console.error('Timer reset failed:', error.message);
        setTimeLeft('Error');
      } else {
        fetchCountdown();
      }
    };

    fetchCountdown();
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
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
    };
    fetchAll();
  }, [isWalletConnected, publicKey]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const renderNovelItem = ({ item }) => (
    <View style={[styles.novelCard, { width: cardWidth }]}>
      <TouchableOpacity
        style={styles.novelCardTouchable}
        onPress={() => navigation.navigate('NovelDetail', { id: item.id })}
        accessible={true}
        accessibilityLabel={`View novel ${item.title}`}
        activeOpacity={0.8}
      >
        <View style={styles.novelCoverContainer}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={styles.novelCover}
              resizeMode="cover"
              defaultSource={{ uri: FALLBACK_IMAGE }}
            />
          ) : (
            <View style={styles.novelCoverPlaceholder}>
              <FontAwesome5 name="book" size={32} color={KA_COLORS.textMuted} />
              <Text style={styles.novelCoverPlaceholderText}>No Cover</Text>
            </View>
          )}
          {item.tags?.includes('Adult(18+)') && (
            <View style={styles.adultBadge}>
              <Text style={styles.adultBadgeText}>18+</Text>
            </View>
          )}
        </View>
        <View style={styles.novelInfo}>
          <Text style={styles.novelTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.novelMeta}>
            <TouchableOpacity
              style={styles.novelAuthor}
              onPress={() => navigation.navigate('WritersProfile', { id: item.user_id })}
              accessible={true}
              accessibilityLabel={`View profile of ${item.users?.name || 'Unknown'}`}
            >
              <FontAwesome5 name="feather-alt" size={12} color={KA_COLORS.ivory} style={styles.novelAuthorIcon} />
              <Text style={styles.novelAuthorText} numberOfLines={1}>
                {item.users?.name || 'Unknown'}
              </Text>
            </TouchableOpacity>
            <View style={styles.novelViewers}>
              <FontAwesome5 name="eye" size={12} color={KA_COLORS.ivory} style={styles.novelViewersIcon} />
              <Text style={styles.novelViewersText}>
                {item.viewers_count >= 1000 
                  ? `${(item.viewers_count / 1000).toFixed(1)}k` 
                  : item.viewers_count.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderSkeletonCard = () => (
    <View style={[styles.skeletonCard, { width: cardWidth }]}>
      <View style={styles.skeletonCover} />
      <View style={styles.skeletonInfo}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonMeta} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.backgroundGradient} />
        <View style={styles.emberContainer}>
          {emberAnims.current.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                styles.ember,
                {
                  left: `${Math.random() * 100}%`,
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [height, -50],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KA_COLORS.orangePrimary} />
          <Text style={styles.loadingText}>Loading novels...</Text>
        </View>
      </View>
    );
  }

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <FontAwesome5 name="book-open" size={64} color={KA_COLORS.textMuted} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>No Novels Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery || selectedTags.length > 0
          ? 'Try adjusting your search or filters to find what you\'re looking for.'
          : 'There are no novels in the library yet.'}
      </Text>
      {(searchQuery || selectedTags.length > 0) && (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => {
            setSearchQuery('');
            setSelectedTags([]);
          }}
        >
          <FontAwesome5 name="times" size={16} color={KA_COLORS.ivory} />
          <Text style={styles.emptyButtonText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGradient} />
      <View style={styles.emberContainer}>
        {emberAnims.current.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.ember,
              {
                left: `${Math.random() * 100}%`,
                opacity: anim,
                transform: [
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [height, -50],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Novel Library</Text>
            <Text style={styles.heroSubtitle}>Discover amazing stories and adventures</Text>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <FontAwesome5 name="search" size={16} color={KA_COLORS.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search novels by title or author..."
                placeholderTextColor={KA_COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity style={styles.clearButton} onPress={() => setSearchQuery('')}>
                  <FontAwesome5 name="times" size={16} color={KA_COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Tag Filters */}
            <View style={styles.tagFiltersContainer}>
              <Text style={styles.tagFiltersLabel}>Filter by Genre:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagFiltersScroll}>
                {selectedTags.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearTagsButton}
                    onPress={() => setSelectedTags([])}
                  >
                    <FontAwesome5 name="times" size={12} color={KA_COLORS.ivory} />
                    <Text style={styles.clearTagsText}>Clear All</Text>
                  </TouchableOpacity>
                )}
                {TAG_OPTIONS.map((tag) => (
                  <TouchableOpacity
                    key={tag.value}
                    style={[
                      styles.tagChip,
                      selectedTags.includes(tag.value) && styles.tagChipActive,
                    ]}
                    onPress={() => toggleTag(tag.value)}
                  >
                    <Text
                      style={[
                        styles.tagChipText,
                        selectedTags.includes(tag.value) && styles.tagChipTextActive,
                      ]}
                    >
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>

        {/* Results Header */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            Showing <Text style={styles.resultsCountHighlight}>{filteredNovels.length}</Text> novel{filteredNovels.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Novels Grid */}
        <View style={styles.gridContainer}>
          {filteredNovels.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.gridContent}>
              {filteredNovels.map((item) => (
                <View key={`novel-${item.id}`}>
                  {renderNovelItem({ item })}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Wallet Panel */}
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

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

export default NovelsPageScreen;