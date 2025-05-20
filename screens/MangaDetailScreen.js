import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import ConnectButton from '../components/ConnectButton';
import Animated, { FadeIn } from 'react-native-reanimated';
import MangaDetailCommentSection from '../components/MangaDetailCommentSection';
import { styles } from '../styles/MangaDetailStyles';
import { PublicKey } from '@solana/web3.js';

const MangaDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params || {};
  const { wallet } = React.useContext(EmbeddedWalletContext);
  const isWalletConnected = !!wallet?.publicKey;
  const [manga, setManga] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [weeklyPoints, setWeeklyPoints] = useState(0);
  const [error, setError] = useState(null);

  const activePublicKey = React.useMemo(() => {
    try {
      if (!wallet?.publicKey) return null;
      return new PublicKey(wallet.publicKey);
    } catch (err) {
      console.error('Error creating PublicKey:', err);
      setError('Invalid wallet public key.');
      setTimeout(() => setError(null), 5000);
      return null;
    }
  }, [wallet?.publicKey]);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const toggleWalletPanel = () => setWalletPanelOpen((prev) => !prev);

  const fetchMangaDetails = async () => {
    try {
      const { data: mangaData, error: mangaError } = await supabase
        .from('manga')
        .select('id, title, cover_image, summary, user_id, users:user_id (name), tags')
        .eq('id', id)
        .single();
      if (mangaError) throw mangaError;

      const { data: chaptersData, error: chaptersError } = await supabase
        .from('manga_chapters')
        .select('id, chapter_number, title, is_premium')
        .eq('manga_id', id)
        .order('chapter_number', { ascending: true });
      if (chaptersError) throw chaptersError;

      setManga(mangaData);
      setChapters(chaptersData || []);
    } catch (error) {
      console.error('Error fetching manga details:', error.message);
      setError(error.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const checkBalance = async () => {
    if (!wallet?.publicKey || !activePublicKey) return;
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, weekly_points')
        .eq('wallet_address', activePublicKey.toString())
        .single();
      if (error || !user) throw new Error('User not found');
      setWeeklyPoints(user.weekly_points || 0);

      const { data: walletBalance, error: balanceError } = await supabase
        .from('wallet_balances')
        .select('amount')
        .eq('user_id', user.id)
        .eq('currency', 'SMP')
        .eq('chain', 'SOL')
        .single();
      if (balanceError && balanceError.code !== 'PGRST116') throw balanceError;
      setBalance(walletBalance?.amount || 0);
    } catch (error) {
      console.error('Error checking balance:', error.message);
      setError(error.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  useEffect(() => {
    setLoading(true);
    if (isWalletConnected && activePublicKey) {
      Promise.all([fetchMangaDetails(), checkBalance()]).finally(() => setLoading(false));
    } else {
      fetchMangaDetails();
    }
  }, [id, isWalletConnected, activePublicKey]);

  const renderChapterItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chapterItem}
      onPress={() => {
        navigation.navigate('MangaChapter', { mangaId: id, chapterId: item.id });
      }}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Icon name="book" size={16} color="#FFFFFF" style={styles.chapterIcon} />
      <Text style={styles.chapterText}>{item.title || `Chapter ${item.chapter_number}`}</Text>
      {item.is_premium && <Icon name="lock" size={16} color="#FF4444" style={styles.premiumIcon} />}
    </TouchableOpacity>
  );

  const data = [
    { type: 'navbar', key: 'navbar' },
    { type: 'error', key: 'error' },
    { type: 'header', key: 'header' },
    { type: 'chapters', key: 'chapters' },
    { type: 'comments', key: 'comments' },
    { type: 'wallet', key: 'wallet' },
    { type: 'footer', key: 'footer' },
  ];

  const renderItem = ({ item }) => {
    switch (item.type) {
      case 'navbar':
        return (
          <Animated.View entering={FadeIn} style={styles.navbar}>
            <View style={styles.navContainer}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Home')}
                style={styles.navLink}
                accessible
                accessibilityLabel="Navigate to home"
              >
                <Image
                  source={require('../assets/logo.jpeg')}
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
                  <Icon name={menuOpen ? 'times' : 'bars'} size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            {menuOpen && (
              <Animated.View entering={FadeIn} style={styles.navMenu}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Home')}
                  style={styles.navMenuItem}
                >
                  <Icon name="home" size={20} color="#FFFFFF" />
                  <Text style={styles.navMenuText}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Manga')}
                  style={styles.navMenuItem}
                >
                  <Icon name="book" size={20} color="#FFFFFF" />
                  <Text style={styles.navMenuText}>Manga</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Swap')}
                  style={styles.navMenuItem}
                >
                  <Icon name="exchange-alt" size={20} color="#FFFFFF" />
                  <Text style={styles.navMenuText}>Swap</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        );
      case 'error':
        return error ? (
          <Animated.View entering={FadeIn} style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null;
      case 'header':
        return manga ? (
          <Animated.View entering={FadeIn} style={styles.header}>
            <Image
              source={{ uri: manga.cover_image || 'https://via.placeholder.com/300x400' }}
              style={styles.coverImage}
              resizeMode="cover"
            />
            <View style={styles.info}>
              <Text style={styles.title}>
                <Icon name="star" size={20} color="#FFD700" style={styles.titleIcon} /> {manga.title}
              </Text>
              <TouchableOpacity
                style={styles.artistContainer}
                onPress={() => navigation.navigate('CreatorsProfile', { id: manga.user_id })}
              >
                <Icon name="user" size={16} color="#FFFFFF" />
                <Text style={styles.artistText}>{manga.users?.name || 'Unknown Artist'}</Text>
              </TouchableOpacity>
              <Text style={styles.genres}>{manga.tags?.join(', ') || 'No tags'}</Text>
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>Summary</Text>
                <Text style={styles.summaryText}>{manga.summary || 'No summary available.'}</Text>
              </View>
            </View>
          </Animated.View>
        ) : null;
      case 'chapters':
        return (
          <Animated.View entering={FadeIn} style={styles.chapters}>
            <Text style={styles.chapterTitle}>Chapters</Text>
            {chapters.length === 0 ? (
              <Text style={styles.noChapters}>No chapters available.</Text>
            ) : (
              <FlatList
                data={chapters}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderChapterItem}
                contentContainerStyle={styles.chapterGrid}
                scrollEnabled={false} // Disable nested scrolling
              />
            )}
          </Animated.View>
        );
      case 'comments':
        return manga ? (
          <Animated.View entering={FadeIn} style={styles.comments}>
            <MangaDetailCommentSection
              mangaId={manga.id}
              mangaTitle={manga.title}
              isWalletConnected={isWalletConnected}
              activePublicKey={activePublicKey}
            />
          </Animated.View>
        ) : null;
      case 'wallet':
        return isWalletConnected ? (
          <Animated.View
            entering={FadeIn}
            style={[styles.walletPanel, walletPanelOpen && styles.walletPanelOpen]}
          >
            <TouchableOpacity onPress={toggleWalletPanel} style={styles.walletToggle}>
              <Icon name="wallet" size={20} color="#F36316" />
              <Text style={styles.walletSummary}>
                {balance} SMP | {weeklyPoints} Pts
              </Text>
            </TouchableOpacity>
            {walletPanelOpen && (
              <View style={styles.walletContent}>
                <Animated.View entering={FadeIn}>
                  <View style={styles.walletInfo}>
                    <Text style={styles.walletInfoText}>
                      <Text style={styles.bold}>Balance:</Text> {balance} SMP
                    </Text>
                    <Text style={styles.walletInfoText}>
                      <Text style={styles.bold}>Points:</Text> {weeklyPoints}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.withdrawButton}
                    onPress={() => Alert.alert('Withdraw', 'Withdrawal functionality not implemented.')}
                  >
                    <Text style={styles.withdrawButtonText}>Withdraw</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}
          </Animated.View>
        ) : null;
      case 'footer':
        return (
          <Animated.View entering={FadeIn} style={styles.footer}>
            <Text style={styles.footerText}>
              <Icon name="star" size={14} color="#FFD700" /> © 2025 SempaiHQ. All rights reserved.
            </Text>
          </Animated.View>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F36316" />
          <Text style={styles.loadingText}>Loading Manga...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!manga) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
        <Animated.View entering={FadeIn} style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Manga Not Found</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.actionButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.scrollContent}
      />
    </SafeAreaView>
  );
};

export default MangaDetailScreen;