import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import ConnectButton from '../components/ConnectButton';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { styles } from '../styles/MangaPageStyles';

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

const MangaPageScreen = () => {
  const navigation = useNavigation();
  const { wallet } = React.useContext(EmbeddedWalletContext);
  const isWalletConnected = !!wallet?.publicKey;
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mangaList, setMangaList] = useState([]);
  const [filteredManga, setFilteredManga] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0);
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const scrollViewRef = React.useRef(null);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const toggleWalletPanel = () => setWalletPanelOpen((prev) => !prev);

  useEffect(() => {
    if (walletPanelOpen && scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [walletPanelOpen]);

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

      const { data: walletBalance } = await supabase
        .from('wallet_balances')
        .select('amount')
        .eq('user_id', user.id)
        .eq('currency', 'SMP')
        .eq('chain', 'SOL')
        .single();

      setBalance(walletBalance?.amount || 0);

      const { data: pendingData } = await supabase
        .from('pending_withdrawals')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      const totalPending = pendingData?.reduce((sum, w) => sum + w.amount, 0) || 0;
      setPendingWithdrawal(totalPending);
    } catch (error) {
      setErrorMessage(error.message);
      Alert.alert('Error', error.message);
    }
  };

  const handleWithdraw = async () => {
    // Placeholder: Implement Solana transaction logic here
    Alert.alert('Withdraw', 'Withdrawal functionality not implemented. Please provide Solana transaction logic.');
    setWithdrawAmount('');
  };

  const fetchManga = async () => {
    try {
      const { data: mangaData, error: mangaError } = await supabase
        .from('manga')
        .select(`
          id,
          title,
          cover_image,
          summary,
          tags,
          user_id,
          users:user_id (name)
        `);

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

      const enrichedManga = mangaData.map((manga) => ({
        ...manga,
        uniqueViewers: viewerCounts[manga.id] ? viewerCounts[manga.id].size : 0,
      }));

      setMangaList(enrichedManga);
      setFilteredManga(enrichedManga);
    } catch (error) {
      console.error('Error fetching manga:', error);
      setErrorMessage(error.message);
      Alert.alert('Error', error.message);
    }
  };

  const filterManga = useCallback(() => {
    let result = mangaList;
    if (searchQuery) {
      result = result.filter(
        (manga) =>
          manga.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          manga.users?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (selectedTag) {
      result = result.filter((manga) => manga.tags?.includes(selectedTag));
    }
    setFilteredManga(result);
  }, [searchQuery, selectedTag, mangaList]);

  useEffect(() => {
    async function fetchCountdown() {
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
    }

    function getNextSundayMidnight(lastResetTime) {
      const nextSunday = new Date(lastResetTime);
      nextSunday.setDate(lastResetTime.getDate() + ((7 - lastResetTime.getDay()) % 7 || 7));
      nextSunday.setHours(0, 0, 0, 0);
      return nextSunday;
    }

    function updateCountdown(endTime) {
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
    }

    async function resetTimer() {
      const newTime = new Date().toISOString();
      const { error } = await supabase
        .from('settings')
        .update({ value: newTime })
        .eq('key', 'weekly_reward_timer');

      if (error) {
        console.error('Timer reset failed:', error.message);
        setTimeLeft('Error');
        Alert.alert('Error', 'Failed to reset timer');
      } else {
        fetchCountdown();
      }
    }

    fetchCountdown();
  }, []);

  useEffect(() => {
    filterManga();
  }, [filterManga]);

  useEffect(() => {
    if (isWalletConnected && wallet?.publicKey) {
      setLoading(true);
      Promise.all([checkBalance(), fetchManga()]).finally(() => setLoading(false));
    } else {
      fetchManga().finally(() => setLoading(false));
    }
  }, [isWalletConnected, wallet?.publicKey]);

  const renderMangaItem = useCallback(
    ({ item }) => (
      <Animated.View entering={FadeIn} style={styles.mangaCard}>
        <TouchableOpacity
          onPress={() => {
            console.log('Navigating to MangaDetail with ID:', item.id);
            navigation.navigate('MangaDetail', { id: item.id });
          }}
          style={styles.mangaLink}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Image source={{ uri: item.cover_image }} style={styles.mangaCover} resizeMode="cover" />
          <View style={styles.mangaInfo}>
            <Text style={styles.mangaTitle}>{item.title}</Text>
            <Text style={styles.mangaSummary}>{item.summary?.substring(0, 100)}...</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.mangaMeta}>
          <TouchableOpacity
            onPress={() => navigation.navigate('WritersProfile', { userId: item.user_id })}
            style={styles.artistLink}
          >
            <Icon name="paint-brush" size={16} color="#fff" />
            <Text style={styles.artistText}>{item.users?.name || 'Unknown'}</Text>
          </TouchableOpacity>
          <View style={styles.viewers}>
            <Icon name="eye" size={16} color="#fff" />
            <Text style={styles.viewersText}>{item.uniqueViewers}</Text>
          </View>
          {item.tags?.includes('Adult(18+)') && (
            <Text style={styles.adultTag}>18+ Adult</Text>
          )}
        </View>
      </Animated.View>
    ),
    [navigation]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F36316" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Navbar */}
        <Animated.View entering={FadeIn} style={styles.navbar}>
          <View style={styles.navContainer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Home')}
              style={styles.navLink}
              accessible
              accessibilityLabel="Navigate to home"
            >
              <Image
                source={require('../assets/logo.jpeg')} // Adjust path as needed
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>SempaiHQ Manga</Text>
            </TouchableOpacity>
            <View style={styles.navRight}>
              <ConnectButton />
              <TouchableOpacity
                onPress={toggleMenu}
                style={styles.menuToggle}
                accessible
                accessibilityLabel="Toggle menu"
              >
                <Icon name={menuOpen ? 'times' : 'bars'} size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          {menuOpen && (
            <Animated.View entering={FadeIn} style={styles.navMenu}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Home')}
                style={styles.navMenuItem}
              >
                <Icon name="home" size={20} color="#fff" />
                <Text style={styles.navMenuText}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('Swap')}
                style={styles.navMenuItem}
              >
                <Icon name="exchange-alt" size={20} color="#fff" />
                <Text style={styles.navMenuText}>Swap</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        {/* Rewards Belt */}
        <Animated.View entering={FadeIn} style={styles.rewardsBelt}>
          <View style={styles.beltContent}>
            <Text style={styles.rewardItem}>
                           🎉 Weekly Reward: <Text style={styles.bold}>25,000,000 SMP Tokens</Text> every week based on points! 🌟
            </Text>
            <Text style={styles.rewardItem}>
              👑 Top Reader: <Text style={styles.bold}>100 Pts Daily</Text> 🏆
            </Text>
          </View>
        </Animated.View>

        {/* Header with Search */}
        <Animated.View entering={FadeIn} style={styles.header}>
          <Text style={styles.headerTitle}>SempaiHQ Manga</Text>
          <Text style={styles.headerTagline}>Journey Through Infinite Panels</Text>
          <View style={styles.searchBar}>
            <Icon name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title or artist..."
              placeholderTextColor="#888"
              accessible
              accessibilityLabel="Search manga"
            />
          </View>
          <View style={styles.tagSelectContainer}>
            <Text style={styles.tagSelectLabel}>Filter by Tag:</Text>
            <FlatList
              data={[{ value: '', label: 'All Tags' }, ...TAG_OPTIONS]}
              keyExtractor={(item) => item.value}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setSelectedTag(item.value)}
                  style={[
                    styles.tagOption,
                    selectedTag === item.value && styles.tagOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.tagOptionText,
                      selectedTag === item.value && styles.tagOptionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.tagList}
            />
          </View>
        </Animated.View>

        {/* Manga Grid */}
        <FlatList
          data={filteredManga}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMangaItem}
          contentContainerStyle={styles.mangaGrid}
          numColumns={2}
          initialNumToRender={6}
          windowSize={10}
          removeClippedSubviews={true}
        />
        {filteredManga.length === 0 && (
          <Text style={styles.noManga}>No manga found in the library...</Text>
        )}

        {/* Wallet Panel */}
        {isWalletConnected && (
          <Animated.View
            entering={FadeIn}
            style={[
              styles.walletPanel,
              walletPanelOpen && styles.walletPanelOpen,
            ]}
          >
            <TouchableOpacity
              onPress={toggleWalletPanel}
              style={styles.walletToggle}
            >
              <Icon name="wallet" size={20} color="#F36316" />
              <Text style={styles.walletSummary}>
                {balance} SMP | {weeklyPoints} Pts
              </Text>
            </TouchableOpacity>
            <View style={styles.walletCountdown}>
              <Icon name="clock" size={16} color="#fff" />
              <Text style={styles.countdownText}>{timeLeft || 'Loading...'}</Text>
            </View>
            {walletPanelOpen && (
              <ScrollView ref={scrollViewRef} style={styles.walletContent}>
                <Animated.View entering={FadeIn}>
                  <View style={styles.walletInfo}>
                    <Text style={styles.walletInfoText}>
                      <Text style={styles.bold}>Balance:</Text> {balance} SMP
                    </Text>
                    <Text style={styles.walletInfoText}>
                      <Text style={styles.bold}>Points:</Text> {weeklyPoints}
                    </Text>
                    {pendingWithdrawal > 0 && (
                      <Text style={styles.walletInfoText}>
                        <Text style={styles.bold}>Pending:</Text> {pendingWithdrawal} SMP
                      </Text>
                    )}
                  </View>
                  <View style={styles.withdrawSection}>
                    <TextInput
                      style={styles.withdrawInput}
                      value={withdrawAmount}
                      onChangeText={setWithdrawAmount}
                      placeholder="Amount (Min: 2500)"
                      placeholderTextColor="#888"
                      keyboardType="numeric"
                      accessible
                      accessibilityLabel="Withdraw amount"
                    />
                    <View style={styles.withdrawActions}>
                      <TouchableOpacity
                        onPress={handleWithdraw}
                        style={[styles.withdrawButton, loading && styles.disabledButton]}
                        disabled={loading}
                      >
                        <Text style={styles.withdrawButtonText}>Withdraw</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={checkBalance}
                        style={[styles.refreshButton, loading && styles.disabledButton]}
                        disabled={loading}
                      >
                        <Text style={styles.refreshButtonText}>Refresh</Text>
                      </TouchableOpacity>
                    </View>
                    {errorMessage && (
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    )}
                  </View>
                </Animated.View>
              </ScrollView>
            )}
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default MangaPageScreen;