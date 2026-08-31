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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConnectPopup, setShowConnectPopup] = useState(false);
  const [viewCountError, setViewCountError] = useState(null);
  const [unlockedChapters, setUnlockedChapters] = useState([]);
  const menuAnim = useRef(new Animated.Value(280)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const emberAnims = useRef([]);
  const { session } = useGoogleAuth();

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

  const sanitizeText = (text) => {
    if (!text) return '';
    return text.replace(/[<>&"']/g, (char) =>
      ({ '<': '<', '>': '>', '&': '&', '"': '"', "'": "'" }[char])
    );
  };

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

  const fetchNovel = useCallback(async () => {
    try {
      console.log('[NovelDetailScreen] Fetching novel with id:', id);
      const { data, error } = await supabase
        .from('novels')
        .select('*')
        .eq('id', id)
        .eq('is_visible', true)
        .single();

      if (error) {
        console.error('[NovelDetailScreen] Novel fetch error:', error);
        throw new Error('Novel not found');
      }
      
      console.log('[NovelDetailScreen] Novel fetched successfully:', data?.title);
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
  }, [id]);

  const updateViewCount = useCallback(async () => {
    if (!isWalletConnected || !activePublicKey) {
      console.log('No wallet connected, skipping view count update');
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
        console.log('User has already viewed this novel, skipping view count increment');
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
        console.log('Viewers count incremented and interaction recorded for user:', userId);
      }
    } catch (error) {
      console.error('Error in updateViewCount:', error.message);
      setViewCountError('An unexpected error occurred while updating view count.');
    }
  }, [id, isWalletConnected, activePublicKey]);

  const fetchUnlockedChapters = useCallback(async () => {
    if (!isWalletConnected || !activePublicKey) {
      setUnlockedChapters([]);
      return;
    }

    try {
      // Fetch unlocked chapters from chapter_payments table
      const { data: payments, error: paymentsError } = await supabase
        .from('chapter_payments')
        .select('chapter_number')
        .eq('wallet_address', activePublicKey)
        .eq('novel_id', id);

      if (paymentsError) {
        console.error('Error fetching unlocked chapters:', paymentsError);
        setUnlockedChapters([]);
        return;
      }

      const unlockedChapterIds = payments?.map(p => p.chapter_number.toString()) || [];
      setUnlockedChapters(unlockedChapterIds);
    } catch (error) {
      console.error('Error in fetchUnlockedChapters:', error.message);
      setUnlockedChapters([]);
    }
  }, [id, isWalletConnected, activePublicKey]);

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

  const handleNavigation = (screen, params) => {
    const chapterNum = params?.chapterId ? parseInt(params.chapterId, 10) : null;
    if (chapterNum && (!isWalletConnected && chapterNum > 1)) {
      setShowConnectPopup(true);
    } else {
      navigation.navigate(screen, params);
    }
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
            <Text style={styles.chapterTitle}>{sanitizeText(title)}</Text>
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
            <Text style={styles.novelTitle}>{sanitizeText(novel.title)}</Text>
            <View style={styles.novelImageWrapper}>
              <Image
                source={{ uri: novel.image || FALLBACK_IMAGE }}
                style={styles.novelImage}
                resizeMode="cover"
                defaultSource={{ uri: FALLBACK_IMAGE }}
              />
              <View style={styles.imageGlow} />
            </View>
            <View style={styles.novelViews}>
              <FontAwesome5 name="eye" size={16} color={colors.accent} />
              <Text style={styles.novelViewsText}>
                {(novel.viewers_count || 0).toLocaleString()} Views
              </Text>
            </View>
            <Text style={styles.novelIntro}>
              Dive into the chapters of{' '}
              <Text style={styles.highlight}>{sanitizeText(novel.title)}</Text>:
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
            <FontAwesome5 name="book-open" size={16} color={colors.accent} />
            <Text style={styles.summaryLinkText}>View Novel Summary</Text>
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
          novelTitle={sanitizeText(novel.title)}
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