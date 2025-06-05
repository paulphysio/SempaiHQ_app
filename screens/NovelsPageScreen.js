import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import ConnectButton, { EmbeddedWalletContext } from '../components/ConnectButton';
import WalletPanel from '../components/WalletPanel';
import { styles } from '../styles/NovelsStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { PublicKey } from '@solana/web3.js';
import { TREASURY_PUBLIC_KEY, SMP_MINT_ADDRESS } from '../constants';

const API_BASE_URL = 'https://sempaihq.xyz';

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
  const { wallet } = useContext(EmbeddedWalletContext);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const menuAnim = useRef(new Animated.Value(280)).current;
  const isMounted = useRef(true);

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

  const toggleMenu = () => {
    const toValue = menuOpen ? 280 : 0;
    Animated.timing(menuAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    if (menuOpen) {
      toggleMenu();
    }
  };

  const handleNavigation = (path) => {
    toggleMenu();
    navigation.navigate(path);
  };

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
        console.error('Error fetching user:', userError.message);
        throw new Error(`User lookup failed: ${userError.message}`);
      }
      
      if (!user) {
        console.error('No user found for wallet address:', normalizedWalletAddress);
        throw new Error('User not found. Please ensure your wallet is properly connected.');
      }

      console.log('Found user:', user);
      setWeeklyPoints(user.weekly_points || 0);

      // Get both on-chain and off-chain balances
      const { data: balances, error: balancesError } = await supabase
        .from('wallet_balances')
        .select('amount, chain')
        .eq('wallet_address', normalizedWalletAddress)
        .eq('currency', 'SMP');

      if (balancesError) {
        console.error('Error fetching balances:', balancesError.message);
        throw new Error(`Balance lookup failed: ${balancesError.message}`);
      }

      // Find on-chain (SOL) and off-chain balances
      const onChainBalance = balances?.find(b => b.chain === 'SOL')?.amount || 0;
      const offChainBalance = balances?.find(b => b.chain === 'OFF_CHAIN')?.amount || 0;

      console.log('Balances found:', { onChain: onChainBalance, offChain: offChainBalance });
      
      setBalance(onChainBalance);
      setOffChainBalance(offChainBalance);

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

      // Find off-chain balance
      const offChainBalance = balances?.find(b => b.chain === 'OFF_CHAIN')?.amount || 0;
      console.log('User off-chain balance:', offChainBalance);

      if (offChainBalance < amount) {
        throw new Error(
          `Insufficient off-chain balance: ${offChainBalance.toLocaleString()} SMP available, need ${amount.toLocaleString()} SMP`
        );
      }

      // Make the withdrawal request which will check Treasury's on-chain balance
      const apiUrl = `${API_BASE_URL}/api/withdraw-smp`;
      console.log('Making withdrawal request to:', apiUrl, {
        userId: user.id,
        walletAddress: publicKey,
        amount,
        treasuryAddress: TREASURY_PUBLIC_KEY,
        tokenMint: SMP_MINT_ADDRESS.toString()
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          walletAddress: publicKey,
          amount,
          treasuryAddress: TREASURY_PUBLIC_KEY,
          tokenMint: SMP_MINT_ADDRESS.toString()
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && errorJson.error.includes('Treasury has insufficient SMP')) {
            errorMessage = 'Treasury has insufficient on-chain SMP balance. Please try again later or contact support.';
          } else {
            errorMessage = errorJson.error || `Withdrawal failed: HTTP ${response.status}`;
          }
        } catch (e) {
          errorMessage = `Withdrawal failed: ${errorText || `HTTP ${response.status}`}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (result.error) throw new Error(result.error);

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
        `);

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
    if (isWalletConnected && publicKey) {
      setLoading(true);
      Promise.all([checkBalance(), fetchNovels()]).finally(() => setLoading(false));
    } else {
      fetchNovels().finally(() => setLoading(false));
    }
  }, [isWalletConnected, publicKey]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const renderHeader = () => (
    <View>
      <View style={styles.libraryHeader}>
        <Text style={styles.headerTitle}>SempaiHQ Library</Text>
        <Text style={styles.headerTagline}>Unlock the Nexus of Imagination</Text>
        <View style={styles.searchBar}>
          <FontAwesome5 name="search" size={18} color="#F36316" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by title or author..."
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
          />
        </View>
        <View style={styles.tagSelectContainer}>
          {TAG_OPTIONS.map((tag) => (
            <TouchableOpacity
              key={tag.value}
              style={[
                styles.tagButton,
                selectedTags.includes(tag.value) && styles.tagButtonSelected,
              ]}
              onPress={() => toggleTag(tag.value)}
              accessible={true}
              accessibilityLabel={`Filter by ${tag.label}`}
            >
              <Text
                style={[
                  styles.tagButtonText,
                  selectedTags.includes(tag.value) && styles.tagButtonTextSelected,
                ]}
              >
                {tag.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderNovelItem = ({ item }) => (
    <View style={styles.bookCard}>
      <TouchableOpacity
        style={styles.bookLink}
        onPress={() => navigation.navigate('NovelDetail', { id: item.id })}
        accessible={true}
        accessibilityLabel={`View novel ${item.title}`}
      >
        <Image
          source={{ uri: item.image || FALLBACK_IMAGE }}
          style={styles.bookCover}
          resizeMode="cover"
          defaultSource={{ uri: FALLBACK_IMAGE }}
        />
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.bookSummary} numberOfLines={3}>
            {item.summary?.substring(0, 100) || 'No summary available'}...
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.bookMeta}>
        <TouchableOpacity
          style={styles.authorLink}
          onPress={() => navigation.navigate('WritersProfile', { id: item.user_id })}
          accessible={true}
          accessibilityLabel={`View profile of ${item.users?.name || 'Unknown'}`}
        >
          <FontAwesome5 name="feather-alt" size={14} color="#fff" />
          <Text style={styles.authorText}>{item.users?.name || 'Unknown'}</Text>
        </TouchableOpacity>
        <View style={styles.viewersContainer}>
          <FontAwesome5 name="eye" size={14} color="#fff" />
          <Text style={styles.viewersText}>{item.viewers_count.toLocaleString()}</Text>
        </View>
        {item.tags?.includes('Adult(18+)') && (
          <Text style={styles.adultTag}>18+ Adult</Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F36316" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.libraryContainer}>
      {/* Navbar */}
      <View style={styles.libraryNavbar}>
        <View style={styles.navbarContent}>
          <TouchableOpacity
            style={styles.libraryLogo}
            onPress={() => navigation.navigate('Home')}
            accessible={true}
            accessibilityLabel="Go to home"
          >
            <Image
              source={{
                uri:
                  'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' ||
                  'https://placehold.co/50x50/png?text=Logo',
              }}
              style={styles.logoImage}
              resizeMode="cover"
              defaultSource={{ uri: 'https://placehold.co/50x50/png?text=Logo' }}
            />
            <Text style={styles.logoText}>SempaiHQ Library</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={toggleMenu}
            accessible={true}
            accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <FontAwesome5 name={menuOpen ? 'times' : 'bars'} size={24} color="#F36316" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sidebar with Backdrop */}
      {menuOpen && (
        <TouchableWithoutFeedback onPress={closeMenu}>
          <View style={[styles.backdrop, { pointerEvents: 'auto' }]} />
        </TouchableWithoutFeedback>
      )}
      <Animated.View style={[styles.navItems, { transform: [{ translateX: menuAnim }] }]}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => handleNavigation('Home')}
          accessible={true}
          accessibilityLabel="Go to home"
        >
          <FontAwesome5 name="home" size={16} color="#fff" />
          <Text style={styles.navItemText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => handleNavigation('Swap')}
          accessible={true}
          accessibilityLabel="Go to swap"
        >
          <FontAwesome5 name="exchange-alt" size={16} color="#fff" />
          <Text style={styles.navItemText}>Swap</Text>
        </TouchableOpacity>
        <ConnectButton style={styles.connectBtn} />
      </Animated.View>

      {/* Novels Grid with Header */}
      <FlatList
        data={filteredNovels}
        renderItem={renderNovelItem}
        keyExtractor={(item) => `novel-${item.id}`}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.noBooks}>No novels found in the library...</Text>
        }
      />

      {/* Wallet Panel */}
      <WalletPanel
        isWalletConnected={isWalletConnected}
        balance={balance}
        offChainBalance={offChainBalance}
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

      {/* Footer Text */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
      </View>
    </View>
  );
};

export default NovelsPageScreen;