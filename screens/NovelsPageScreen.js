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
import { callSignedEdgeFunction } from '../utils/walletSignature';
import { useTheme } from '../context/ThemeContext';
import { getNovelsStyles } from '../styles/NovelsStyles';

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
  const themedStyles = getNovelsStyles(isDark);
  
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

      // Make the withdrawal request with wallet signature authentication
      const edgeUrl = `https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/withdraw-smp`;
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
    <View style={[themedStyles.novelCard, { width: cardWidth }]}>
      <TouchableOpacity
        style={themedStyles.novelCardTouchable}
        onPress={() => navigation.navigate('NovelDetail', { id: item.id })}
        accessible={true}
        accessibilityLabel={`View novel ${item.title}`}
        activeOpacity={0.8}
      >
        <View style={themedStyles.novelCoverContainer}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={themedStyles.novelCover}
              resizeMode="cover"
              defaultSource={{ uri: FALLBACK_IMAGE }}
            />
          ) : (
            <View style={themedStyles.novelCoverPlaceholder}>
              <FontAwesome5 name="book" size={32} color={colors.textMuted} />
              <Text style={themedStyles.novelCoverPlaceholderText}>No Cover</Text>
            </View>
          )}
          {item.tags?.includes('Adult(18+)') && (
            <View style={themedStyles.adultBadge}>
              <Text style={themedStyles.adultBadgeText}>18+</Text>
            </View>
          )}
        </View>
        <View style={themedStyles.novelInfo}>
          <Text style={themedStyles.novelTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={themedStyles.novelMeta}>
            <TouchableOpacity
              style={themedStyles.novelAuthor}
              onPress={() => navigation.navigate('CreatorsProfile', { id: item.user_id })}
              accessible={true}
              accessibilityLabel={`View profile of ${item.users?.name || 'Unknown'}`}
            >
              <FontAwesome5 name="feather-alt" size={12} color={colors.textPrimary} style={themedStyles.novelAuthorIcon} />
              <Text style={themedStyles.novelAuthorText} numberOfLines={1}>
                {item.users?.name || 'Unknown'}
              </Text>
            </TouchableOpacity>
            <View style={themedStyles.novelViewers}>
              <FontAwesome5 name="eye" size={12} color={colors.textPrimary} style={themedStyles.novelViewersIcon} />
              <Text style={themedStyles.novelViewersText}>
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
    <View style={[themedStyles.skeletonCard, { width: cardWidth }]}>
      <View style={themedStyles.skeletonCover} />
      <View style={themedStyles.skeletonInfo}>
        <View style={themedStyles.skeletonTitle} />
        <View style={themedStyles.skeletonMeta} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={themedStyles.container}>
        <View style={themedStyles.backgroundGradient} />
        <View style={themedStyles.emberContainer}>
          {emberAnims.current.map((anim, index) => (
            <Animated.View
              key={index}
              style={[
                themedStyles.ember,
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
        <View style={themedStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={themedStyles.loadingText}>Loading novels...</Text>
        </View>
      </View>
    );
  }

  const renderEmptyState = () => (
    <View style={themedStyles.emptyContainer}>
      <FontAwesome5 name="book-open" size={64} color={colors.textMuted} style={themedStyles.emptyIcon} />
      <Text style={themedStyles.emptyTitle}>No Novels Found</Text>
      <Text style={themedStyles.emptyText}>
        {searchQuery || selectedTags.length > 0
          ? 'Try adjusting your search or filters to find what you\'re looking for.'
          : 'There are no novels in the library yet.'}
      </Text>
      {(searchQuery || selectedTags.length > 0) && (
        <TouchableOpacity
          style={themedStyles.emptyButton}
          onPress={() => {
            setSearchQuery('');
            setSelectedTags([]);
          }}
        >
          <FontAwesome5 name="times" size={16} color={colors.textOnAccent} />
          <Text style={themedStyles.emptyButtonText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={themedStyles.container}>
      <View style={themedStyles.backgroundGradient} />
      <View style={themedStyles.emberContainer}>
        {emberAnims.current.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              themedStyles.ember,
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
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={themedStyles.heroSection}>
          <View style={themedStyles.heroContent}>
            <Text style={themedStyles.heroTitle}>Novel Library</Text>
            <Text style={themedStyles.heroSubtitle}>Discover amazing stories and adventures</Text>
            
            {/* Search Bar */}
            <View style={themedStyles.searchContainer}>
              <FontAwesome5 name="search" size={16} color={colors.textMuted} style={themedStyles.searchIcon} />
              <TextInput
                style={themedStyles.searchInput}
                placeholder="Search novels by title or author..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity style={themedStyles.clearButton} onPress={() => setSearchQuery('')}>
                  <FontAwesome5 name="times" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Tag Filters */}
            <View style={themedStyles.tagFiltersContainer}>
              <Text style={themedStyles.tagFiltersLabel}>Filter by Genre:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={themedStyles.tagFiltersScroll}>
                {selectedTags.length > 0 && (
                  <TouchableOpacity
                    style={themedStyles.clearTagsButton}
                    onPress={() => setSelectedTags([])}
                  >
                    <FontAwesome5 name="times" size={12} color={colors.textOnAccent} />
                    <Text style={themedStyles.clearTagsText}>Clear All</Text>
                  </TouchableOpacity>
                )}
                {TAG_OPTIONS.map((tag) => (
                  <TouchableOpacity
                    key={tag.value}
                    style={[
                      themedStyles.tagChip,
                      selectedTags.includes(tag.value) && themedStyles.tagChipActive,
                    ]}
                    onPress={() => toggleTag(tag.value)}
                  >
                    <Text
                      style={[
                        themedStyles.tagChipText,
                        selectedTags.includes(tag.value) && themedStyles.tagChipTextActive,
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
        <View style={themedStyles.resultsHeader}>
          <Text style={themedStyles.resultsCount}>
            Showing <Text style={themedStyles.resultsCountHighlight}>{filteredNovels.length}</Text> novel{filteredNovels.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Novels Grid */}
        <View style={themedStyles.gridContainer}>
          {filteredNovels.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={themedStyles.gridContent}>
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
        <View style={themedStyles.footer}>
          <Text style={themedStyles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

export default NovelsPageScreen;