import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseClient';
import { deleteNovelForOffline, getNovelForOffline, isErrorNetworkError, isNovelSavedOffline, saveNovelForOffline } from '../services/offlineCache';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import NovelCommentSection from '../components/Comments/NovelCommentSection';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import { useTheme } from '../context/ThemeContext';
import { getNovelPageStyles } from '../styles/NovelPageStyles';

const { width, height } = Dimensions.get('window');

const FALLBACK_IMAGE = 'https://placehold.co/300x400/png?text=No+Image';

const NovelDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const { isDark, colors } = useTheme();
  const styles = getNovelPageStyles(isDark);
  
  const [novel, setNovel] = useState(null);
  const [novelChapters, setNovelChapters] = useState(null);
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConnectPopup, setShowConnectPopup] = useState(false);
  const [viewCountError, setViewCountError] = useState(null);
  const [unlockedChapters, setUnlockedChapters] = useState([]);
  const [isOnline, setIsOnline] = useState(null);
  const menuAnim = useRef(new Animated.Value(280)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const emberAnims = useRef([]);
  const { session } = useGoogleAuth();
  const [userId, setUserId] = useState(session?.user?.id || null);

  // Restore user ID from AsyncStorage (works offline)
  useEffect(() => {
    (async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('offline_user_id');
        if (storedUserId && !userId) {
          if (__DEV__) console.log('[NovelDetailScreen] Restored user ID from storage:', storedUserId);
          setUserId(storedUserId);
        }
      } catch (e) {
        console.error('[NovelDetailScreen] Failed to restore user ID:', e);
      }
    })();
  }, []);

  // Update userId when session changes
  useEffect(() => {
    if (session?.user?.id) {
      setUserId(session.user.id);
    }
  }, [session?.user?.id]);

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
  }, []);

  const isWalletConnected = !!wallet?.publicKey;
  const activePublicKey = wallet?.publicKey || null;

  const toggleMenu = () => {
    const toValue = menuOpen ? 280 : 0;
    Animated.parallel([
      Animated.timing(menuAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: menuOpen ? 0 : 0.6,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    setMenuOpen(!menuOpen);
    setShowConnectPopup(false);
  };

  const closeMenu = () => {
    if (menuOpen) toggleMenu();
  };

  // Check network status
  useEffect(() => {
    let lastOnline = null;
    const checkNetworkStatus = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        const online = networkState.isConnected && networkState.type !== 'none';
        setIsOnline(online);
        if (online !== lastOnline) {
          lastOnline = online;
          if (__DEV__) console.log('[NovelDetailScreen] Network status:', online ? 'online' : 'offline');
        }
      } catch (error) {
        console.error('[NovelDetailScreen] Error checking network status:', error);
        setIsOnline(true);
      }
    };

    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const fetchNovel = useCallback(async () => {
    try {
      if (__DEV__) console.log('[NovelDetailScreen] Fetching novel with id:', id, 'isOnline:', isOnline, 'userId:', userId);

      // If offline or network status unknown, try cache first
      if (isOnline === false || isOnline === null) {
        if (__DEV__) console.log('[NovelDetailScreen] Offline/network unknown - loading novel from cache');
        const cachedData = await getNovelForOffline(id, userId || 'guest');
        if (cachedData) {
          if (__DEV__) console.log('[NovelDetailScreen] Novel loaded from cache:', cachedData.novel.title);
          setNovel(cachedData.novel);
          setNovelChapters(cachedData.chapters);
          Animated.timing(contentFade, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
          setLoading(false);
          return;
        } else {
          if (__DEV__) console.log('[NovelDetailScreen] Novel not in cache');
          if (isOnline === false) {
            setError('Novel not available offline. Please save it for offline reading first.');
            setLoading(false);
            return;
          }
          // If network status unknown, continue to try network fetch
        }
      }

      // Online or status unknown - fetch from network first
      if (__DEV__) console.log('[NovelDetailScreen] Online/status unknown - fetching from network');
      let { data, error } = await supabase
        .from('novels')
        .select('*')
        .eq('id', id)
        .eq('is_visible', true)
        .single();

      const isNetworkError = isErrorNetworkError(error);
      // failed to fetch from network, try cache
      if(isNetworkError){
        if (__DEV__) console.log(`[NovelDetailScreen] could not load ${id} from network, trying from cache`);
        const cachedData = await getNovelForOffline(id, userId);
        if (cachedData) {
          data = cachedData.novel;
          setNovelChapters(cachedData.chapters);
          if (__DEV__) console.log(`[NovelDetailScreen] novel ${id} loaded successfully from cache`);
        }
      }

      if (!data && error) {
        console.error('[NovelDetailScreen] Novel fetch error:', error);
        throw new Error('Novel not found');
      }

      if (__DEV__) console.log('[NovelDetailScreen] Novel fetched successfully:', data?.title);
      setNovel(data);
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('[NovelDetailScreen] Unexpected error:', error.message);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [id, isOnline, userId]);

  const updateViewCount = useCallback(async () => {
    if (!isWalletConnected || !activePublicKey) {
      if (__DEV__) console.log('No wallet connected, skipping view count update');
      return;
    }

    // Skip if offline
    if (isOnline === false || isOnline === null) {
      if (__DEV__) console.log('[NovelDetailScreen] Offline - skipping view count update');
      return;
    }

    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', activePublicKey)
        .single();

      if (userError || !user) {
        console.error('User not found for wallet:', activePublicKey);
        setViewCountError('Please register your wallet to track views.');
        return;
      }

      const userId = user.id;

      // Check if user has already viewed this novel
      const { data: existingInteraction, error: interactionError } = await supabase
        .from('novel_interactions')
        .select('id')
        .eq('novel_id', id)
        .eq('user_id', userId)
        .single();

      if (existingInteraction) {
        if (__DEV__) console.log('User has already viewed this novel, skipping view count increment');
        return;
      }

      // Call RPC function to increment viewers_count and add interaction
      const { error: rpcError } = await supabase.rpc('increment_novel_view', {
        novel_id: id,
        user_id: userId,
      });

      if (rpcError) {
        console.error('Error in increment_novel_view:', rpcError.message);
        setViewCountError('Failed to update view count. Please try again later.');
      } else {
        if (__DEV__) console.log('Viewers count incremented and interaction recorded for user:', userId);
      }
    } catch (error) {
      console.error('Error in updateViewCount:', error.message);
      setViewCountError('An unexpected error occurred while updating view count.');
    }
  }, [id, isWalletConnected, activePublicKey, isOnline]);

  const fetchUnlockedChapters = useCallback(async () => {
    if (!isWalletConnected || !activePublicKey) {
      setUnlockedChapters([]);
      return;
    }

    // Skip if definitely offline
    if (isOnline === false) {
      if (__DEV__) console.log('[NovelDetailScreen] Offline - loading unlocked chapters from cache');
      const cachedData = await getNovelForOffline(id, userId);
      if (cachedData && cachedData.chapters) {
        setNovelChapters(cachedData.chapters);
        const unlockedChapterIds = cachedData.chapters.map(p => p.chapter_number.toString()) || [];
        setUnlockedChapters(unlockedChapterIds);
      } else {
        if (__DEV__) console.log('[NovelDetailScreen] Chapters not in cache - novel was cached without chapter data');
      }
      return;
    }

    try {
      // Fetch unlocked chapters from chapter_payments table
      let { data: payments, error: paymentsError } = await supabase
        .from('chapter_payments')
        .select('chapter_number')
        .eq('wallet_address', activePublicKey)
        .eq('novel_id', id);

      const isNetworkError = isErrorNetworkError(paymentsError);
      // failed to fetch from network, try cache
      if(isNetworkError){
        if (__DEV__) console.log(`[NovelDetailScreen] could not load unlocked chapters ${id} from network, trying from cache`);
        const cachedData = await getNovelForOffline(id, userId);
        if (cachedData && cachedData.chapters) {
          payments = cachedData.chapters;
          if (__DEV__) console.log(`[NovelDetailScreen] unlocked chapters ${id} loaded successfully from cache`);
        }
      }

      if (!payments && paymentsError) {
        console.error('Error fetching unlocked chapters:', paymentsError);
        setUnlockedChapters([]);
        return;
      }

      setNovelChapters(payments);

      const unlockedChapterIds = payments?.map(p => p.chapter_number.toString()) || [];
      setUnlockedChapters(unlockedChapterIds);
    } catch (error) {
      console.error('Error in fetchUnlockedChapters:', error.message);
      setUnlockedChapters([]);
    }
  }, [id, isWalletConnected, activePublicKey, isOnline]);

  useEffect(() => {
    if (viewCountError) {
      const timer = setTimeout(() => setViewCountError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [viewCountError]);

  useEffect(() => {
    fetchNovel();
    updateViewCount();
    fetchUnlockedChapters();
  }, [fetchNovel, updateViewCount, fetchUnlockedChapters]);

  // Check if novel is saved offline on mount
  useEffect(() => {
    const checkSavedStatus = async () => {
      const saved = await isNovelSavedOffline(id);
      setIsSavedOffline(saved);
    };
    checkSavedStatus();
  }, [id]);

  const handleSaveOffline = useCallback(async () => {
    if(isSavedOffline){
      await deleteNovelForOffline(id);
      setIsSavedOffline(false);
      return;
    }

    try{
      if(!novel) return;
      if (__DEV__) console.log('[NovelDetailScreen] Saving offline with unlockedChapters:', unlockedChapters);
      // If novel was previously saved with guest key and user is now logged in, it will be re-encrypted with user key
      await saveNovelForOffline(novel, unlockedChapters, userId);
      setIsSavedOffline(true);
    }
    catch(error){
      console.error('[NovelDetailScreen] could not save novel:', error);
      // Don't show error for image download failures - novel content is still saved
      if (error.message && error.message.includes('timeout')) {
        console.warn('[NovelDetailScreen] Image download timed out, novel saved without image');
        setIsSavedOffline(true); // Still mark as saved since content is cached
      } else {
        setError(error.message);
      }
    }
  }, [isSavedOffline, novel, unlockedChapters, id]);

  const handleNavigation = async (screen, params) => {
    const chapterNum = params?.chapterId ? parseInt(params.chapterId, 10) : null;
    if (__DEV__) console.log('[NovelDetailScreen] handleNavigation called:', { screen, params, chapterNum, isWalletConnected, isOnline });

    // First 3 chapters (indices 0, 1, 2) are ALWAYS free - no wallet check needed
    if (chapterNum !== null && chapterNum <= 2) {
      if (__DEV__) console.log('[NovelDetailScreen] First 3 chapters are free, allowing navigation');
      navigation.navigate(screen, params);
      return;
    }

    // For chapters beyond 2, check wallet connection if online
    if (chapterNum !== null && chapterNum > 2 && isWalletConnected !== false) {
      if (isOnline === false || isOnline === null) {
        if (__DEV__) console.log('[NovelDetailScreen] Offline, checking cache for chapter', chapterNum);
        // Check if chapter is available in offline cache
        const cachedData = await getNovelForOffline(id, userId);
        if (__DEV__) console.log('[NovelDetailScreen] Cached novel:', cachedData ? 'found' : 'not found');

        if (cachedData && cachedData.chapters) {
          const offlineChapter = cachedData.chapters.find(c => c.chapter_number === params.chapterId);
          if (__DEV__) console.log('[NovelDetailScreen] Offline chapter found:', offlineChapter ? 'yes' : 'no');
          if (offlineChapter && offlineChapter.content) {
            if (__DEV__) console.log('[NovelDetailScreen] Chapter available offline, allowing navigation');
            navigation.navigate(screen, params);
            return;
          }
        }
      }
      if (!isWalletConnected) {
        if (__DEV__) console.log('[NovelDetailScreen] Wallet not connected, showing connect popup');
        setShowConnectPopup(true);
        return;
      }
    }
    
    navigation.navigate(screen, params);
  };

  const renderChapterItem = ({ item: [chapterId, title] }) => {
    const scaleAnim = new Animated.Value(1);
    const chapterNum = parseInt(chapterId, 10);

    // Check if chapter is advance (advance_chapters is an array of objects with index and is_advance fields)
    const advanceChapterInfo = novel?.advance_chapters?.find(
      (ch) => ch.index === chapterNum
    );
    const isAdvanceChapter = advanceChapterInfo?.is_advance === true;
    // Check if chapter is unlocked by user or is one of the first 3 free chapters
    const isUnlocked = unlockedChapters.includes(chapterId) || chapterNum < 3;

    const onPressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const onPressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    return (
      <TouchableOpacity
        style={styles.chapterCard}
        onPress={() => handleNavigation('Chapter', { novelId: id, chapterId })}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessible={true}
        accessibilityLabel={`View chapter ${title}`}
        activeOpacity={0.7}
      >
        <Animated.View style={[styles.chapterContent, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.chapterGradient}>
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterNumber}>Chapter {chapterNum + 1}</Text>
              <View style={styles.chapterIcons}>
                {isAdvanceChapter && (
                  <FontAwesome5 name="star" size={14} color={colors.gold} style={styles.chapterIcon} />
                )}
                {!isUnlocked ? (
                  <FontAwesome5 name="lock" size={14} color={colors.accent} style={styles.chapterIcon} />
                ) : (
                  <FontAwesome5 name="lock-open" size={14} color={colors.success} style={styles.chapterIcon} />
                )}
              </View>
            </View>
            <Text style={styles.chapterTitle}>{title}</Text>
            <View style={styles.chapterAccent} />
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <Animated.View style={{ opacity: contentFade }}>
      {viewCountError && (
        <View style={styles.errorMessage}>
          <Text style={styles.errorMessageText}>{viewCountError}</Text>
          <TouchableOpacity
            style={styles.clearErrorButton}
            onPress={() => setViewCountError(null)}
            accessible={true}
            accessibilityLabel="Clear error"
          >
            <FontAwesome5 name="times" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.novelContainer}>
        <View style={styles.novelHeaderGradient}>
          <View style={styles.novelHeader}>
            <View style={styles.novelTitleRow}>
              <Text style={styles.novelTitle}>{novel.title}</Text>
              {novel.status && (
                <View style={[
                  styles.statusBadge,
                  novel.status === 'completed' && styles.statusBadgeCompleted,
                  novel.status === 'ongoing' && styles.statusBadgeOngoing,
                  novel.status === 'hiatus' && styles.statusBadgeHiatus,
                ]}>
                  <Text style={styles.statusBadgeText}>
                    {novel.status.charAt(0).toUpperCase() + novel.status.slice(1)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.novelImageWrapper}>
              <Image
                source={{ uri: novel.image || FALLBACK_IMAGE }}
                style={styles.novelImage}
                resizeMode="cover"
                defaultSource={{ uri: FALLBACK_IMAGE }}
              />
              <View style={styles.imageGlow} />
            </View>
            {novel.saved_with_key === 'guest' && (
              <View style={[styles.guestBadge, { backgroundColor: colors.warning }]}>
                <Text style={styles.guestBadgeText}>Guest Session</Text>
              </View>
            )}
            <View style={styles.novelViews}>
              <FontAwesome5 name="eye" size={16} color={colors.accent} />
              <Text style={styles.novelViewsText}>
                {(novel.viewers_count || 0).toLocaleString()} Views
              </Text>
            </View>
            <Text style={styles.novelIntro}>
              Dive into the chapters of{' '}
              <Text style={styles.highlight}>{novel.title}</Text>:
            </Text>
          </View>
        </View>
        
        {/* Summary Link */}
        <View style={styles.summaryLinkContainer}>
          <TouchableOpacity
            style={styles.summaryLink}
            onPress={() => navigation.navigate('NovelSummary', { id })}
            accessible={true}
            accessibilityLabel="View novel summary"
          >
            <FontAwesome5 name="book-open" size={16} color={colors.textPrimary} />
            <Text style={styles.summaryLinkText}>View Novel Summary</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.summaryLink}
            onPress={handleSaveOffline}
            accessible={true}
            accessibilityLabel={isSavedOffline ? "Delete from Downloads" : "Save Offline"}
          >
            <FontAwesome5 name={isSavedOffline ? "trash" : "arrow-circle-down"} size={16} color={colors.textPrimary} />
            <Text style={styles.summaryLinkText}>
              {isSavedOffline ? "Delete from Downloads" : "Save Offline"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chaptersSection}>
          <Text style={styles.sectionTitle}>Chapters</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderFooter = () => (
    <View style={styles.novelContainer}>
      {/* Comments Section - Always visible like web version */}
      {novel.id && novel.title && (
        <NovelCommentSection
          novelId={novel.id}
          novelTitle={novel.title}
          isOnline={isOnline}
        />
      )}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.page}>
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
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!novel || error) {
    return (
      <SafeAreaView style={styles.page}>
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
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Novel not found'}</Text>
          <TouchableOpacity
            style={styles.backHomeLink}
            onPress={() => navigation.navigate('Home')}
            accessible={true}
            accessibilityLabel="Go to home"
          >
            <FontAwesome5 name="home" size={16} color={colors.textPrimary} />
            <Text style={styles.backHomeText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showConnectPopup) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.connectPopupOverlay}>
          <View style={styles.connectPopup}>
            <TouchableOpacity
              style={styles.closePopupButton}
              onPress={() => setShowConnectPopup(false)}
              accessible={true}
              accessibilityLabel="Close popup"
            >
              <FontAwesome5 name="times" size={24} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.popupTitle}>Connect Wallet</Text>
            <Text style={styles.popupMessage}>
              Connect your wallet to access this chapter.
            </Text>
            <GoogleSignInButton style={styles.connectWalletButton} />
            <TouchableOpacity
              style={styles.backHomeLink}
              onPress={() => navigation.navigate('Home')}
              accessible={true}
              accessibilityLabel="Go to home"
            >
              <FontAwesome5 name="home" size={16} color={colors.textPrimary} />
              <Text style={styles.backHomeText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // OFFLINE MODE - Minimal reading UI
  if (isOnline === false || isOnline === null) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={[styles.offlineContainer, { backgroundColor: colors.bgPrimary }]}>
          {/* Offline Header */}
          <View style={[styles.offlineHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.offlineBackButton}
            >
              <FontAwesome5 name="arrow-left" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <FontAwesome5 name="wifi" size={20} color={colors.warning} />
            <Text style={[styles.offlineHeaderText, { color: colors.textPrimary }]}>Offline Mode</Text>
          </View>

          {/* Novel Cover and Info */}
          <ScrollView style={styles.offlineScrollView}>
            <View style={styles.offlineNovelHeader}>
              <Image
                source={{ uri: novel.image || FALLBACK_IMAGE }}
                style={styles.offlineCoverImage}
                resizeMode="cover"
              />
              <View style={styles.offlineNovelInfo}>
                <Text style={[styles.offlineTitle, { color: colors.textPrimary }]}>{novel.title}</Text>
                <Text style={[styles.offlineAuthor, { color: colors.textSecondary }]}>
                  By {novel.writer?.name || 'Unknown'}
                </Text>
                <Text style={[styles.offlineSummary, { color: colors.textSecondary }]}>
                  {novel.summary}
                </Text>
              </View>
            </View>

            {/* Saved Chapters List */}
            <View style={styles.offlineChaptersSection}>
              <Text style={[styles.offlineSectionTitle, { color: colors.textPrimary }]}>
                Saved Chapters
              </Text>
              {novelChapters && novelChapters.length > 0 ? (
                novelChapters.map((chapter, index) => (
                  <TouchableOpacity
                    key={chapter.chapter_number}
                    style={[styles.offlineChapterItem, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}
                    onPress={() => handleNavigation('Chapter', {
                      novelId: novel.id,
                      chapterId: chapter.chapter_number.toString(),
                    })}
                  >
                    <Text style={[styles.offlineChapterTitle, { color: colors.textPrimary }]}>
                      {chapter.title || `Chapter ${index + 1}`}
                    </Text>
                    <FontAwesome5 name="chevron-right" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.offlineEmptyText, { color: colors.textSecondary }]}>
                  No chapters saved
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // ONLINE MODE - Full UI
  return (
    <SafeAreaView style={styles.page}>
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

      {menuOpen && (
        <>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
          <Animated.View style={[styles.navItems, { transform: [{ translateX: menuAnim }] }]}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => {
                toggleMenu();
                navigation.navigate('Home');
              }}
              accessible={true}
              accessibilityLabel="Go to home"
            >
              <FontAwesome5 name="home" size={16} color={colors.textPrimary} />
              <Text style={styles.navItemText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => {
                toggleMenu();
                navigation.navigate('NovelSummary', { id });
              }}
              accessible={true}
              accessibilityLabel="Go to novel summary"
            >
              <FontAwesome5 name="book-open" size={16} color={colors.textPrimary} />
              <Text style={styles.navItemText}>Summary</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      <FlatList
        data={novel.chaptertitles ? Object.entries(novel.chaptertitles).sort((a, b) => parseInt(a[0]) - parseInt(b[0])) : []}
        renderItem={renderChapterItem}
        keyExtractor={([chapterId]) => `chapter-${chapterId}`}
        numColumns={1}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <Text style={styles.noChapters}>No chapters available for this novel.</Text>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

export default NovelDetailScreen;