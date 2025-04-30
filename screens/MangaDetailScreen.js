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
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import ConnectButton from '../components/ConnectButton';
import Animated, { FadeIn } from 'react-native-reanimated';
import { styles } from '../styles/MangaDetailStyles';

const MangaDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params || {}; // Safely destructure params
  const { wallet } = React.useContext(EmbeddedWalletContext);
  const isWalletConnected = !!wallet?.publicKey;
  const [manga, setManga] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [weeklyPoints, setWeeklyPoints] = useState(0);

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const toggleWalletPanel = () => setWalletPanelOpen((prev) => !prev);

  const fetchMangaDetails = async () => {
    try {
      const { data: mangaData, error: mangaError } = await supabase
        .from('manga')
        .select('id, title, cover_image, summary, user_id, users:user_id (name)')
        .eq('id', id)
        .single();
      if (mangaError) throw mangaError;
      setManga(mangaData);

      const { data: chaptersData, error: chaptersError } = await supabase
        .from('manga_chapters')
        .select('id, chapter_number, title, is_premium')
        .eq('manga_id', id)
        .order('chapter_number', { ascending: true });
      if (chaptersError) throw chaptersError;
      setChapters(chaptersData || []);
    } catch (error) {
      console.error('Error fetching manga details:', error.message);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

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

      const { data: walletBalance, error: balanceError } = await supabase
        .from('wallet_balances')
        .select('amount')
        .eq('user_id', user.id)
        .eq('currency', 'SMP')
        .eq('chain', 'SOL')
        .single();
      if (balanceError) throw balanceError;
      setBalance(walletBalance?.amount || 0);
    } catch (error) {
      console.error('Error checking balance:', error.message);
      Alert.alert('Error', error.message);
    }
  };

  useEffect(() => {
    setLoading(true);
    if (isWalletConnected && wallet?.publicKey) {
      Promise.all([fetchMangaDetails(), checkBalance()]).finally(() => setLoading(false));
    } else {
      fetchMangaDetails();
    }
  }, [id, isWalletConnected, wallet?.publicKey]);

  const renderChapterItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chapterItem}
      onPress={() => {
        // Placeholder: Navigate to chapter screen
        Alert.alert('Chapter Navigation', `Navigate to Chapter: ${item.title}`);
        // navigation.navigate('Chapter', { mangaId: id, chapterId: item.id });
      }}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Icon name="book" size={16} color="#fff" style={styles.chapterIcon} />
      <Text style={styles.chapterText}>{item.title}</Text>
      {item.is_premium && <Icon name="lock" size={16} color="#ff4444" style={styles.premiumIcon} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5733" />
        </View>
      </SafeAreaView>
    );
  }

  if (!manga) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
        <View style={styles.container}>
          <Text style={styles.errorText}>Manga not found.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                onPress={() => navigation.navigate('Manga')}
                style={styles.navMenuItem}
              >
                <Icon name="book" size={20} color="#fff" />
                <Text style={styles.navMenuText}>Manga</Text>
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

        {/* Manga Header */}
        <Animated.View entering={FadeIn} style={styles.header}>
          <Image
            source={{ uri: manga.cover_image || 'https://via.placeholder.com/300x400' }}
            style={styles.coverImage}
            resizeMode="cover"
          />
          <View style={styles.info}>
            <Text style={styles.title}>
              <Icon name="star" size={20} color="#ffd700" style={styles.titleIcon} /> {manga.title}
            </Text>
            <TouchableOpacity
              style={styles.artistContainer}
              onPress={() => navigation.navigate('WritersProfile', { userId: manga.user_id })}
            >
              <Icon name="user" size={16} color="#fff" />
              <Text style={styles.artistText}>{manga.users?.name || 'Unknown Artist'}</Text>
            </TouchableOpacity>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <Text style={styles.summaryText}>{manga.summary || 'No summary available.'}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Chapters Section */}
        <Animated.View entering={FadeIn} style={styles.chapters}>
          <Text style={styles.chapterTitle}>Chapters</Text>
          <FlatList
            data={chapters}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderChapterItem}
            contentContainerStyle={styles.chapterGrid}
            scrollEnabled={false} // Disable FlatList scrolling to use ScrollView
          />
          {chapters.length === 0 && (
            <Text style={styles.noChapters}>No chapters available.</Text>
          )}
        </Animated.View>

        {/* Comment Section Placeholder */}
        {isWalletConnected && (
          <Animated.View entering={FadeIn} style={styles.comments}>
            <Text style={styles.commentsTitle}>Comments</Text>
            <View style={styles.commentPlaceholder}>
              <Text style={styles.commentPlaceholderText}>
                Comment section coming soon! Add your thoughts about {manga.title}.
              </Text>
              <TouchableOpacity
                style={styles.commentButton}
                onPress={() => Alert.alert('Comments', 'Comment functionality not yet implemented.')}
              >
                <Text style={styles.commentButtonText}>Add Comment</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Wallet Panel */}
        {isWalletConnected && (
          <Animated.View
            entering={FadeIn}
            style={[styles.walletPanel, walletPanelOpen && styles.walletPanelOpen]}
          >
            <TouchableOpacity
              onPress={toggleWalletPanel}
              style={styles.walletToggle}
            >
              <Icon name="wallet" size={20} color="#FF5733" />
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
        )}

        {/* Footer */}
        <Animated.View entering={FadeIn} style={styles.footer}>
          <Text style={styles.footerText}>
            <Icon name="star" size={14} color="#ffd700" /> © 2025 SempaiHQ. All rights reserved.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MangaDetailScreen;