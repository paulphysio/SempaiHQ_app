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

const { width, height } = Dimensions.get('window');

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

const FALLBACK_IMAGE = 'https://placehold.co/300x400/png?text=No+Image';

const styles = StyleSheet.create({
  page: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: KA_COLORS.ivory,
    fontSize: 16,
    marginTop: 16,
    letterSpacing: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: KA_COLORS.ivory,
    fontSize: 24,
     
    marginBottom: 24,
    letterSpacing: 2,
  },
  backHomeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backHomeText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  navItems: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: KA_COLORS.bgCard,
    borderRightWidth: 1,
    borderRightColor: KA_COLORS.border,
    zIndex: 2,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  navItemText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 200,
  },
  novelContainer: {
    marginBottom: 24,
  },
  errorMessage: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.error,
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorMessageText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    flex: 1,
    letterSpacing: 1,
  },
  clearErrorButton: {
    padding: 8,
  },
  novelHeaderGradient: {
    backgroundColor: KA_COLORS.bgCard,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
  },
  novelHeader: {
    alignItems: 'center',
  },
  novelTitle: {
    color: KA_COLORS.ivory,
    fontSize: 24,
     
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  novelImageWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  novelImage: {
    width: 200,
    height: 280,
    borderRadius: 8,
  },
  imageGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 2,
    borderColor: KA_COLORS.orangePrimary,
    borderRadius: 12,
  },
  novelViews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  novelViewsText: {
    color: KA_COLORS.gold,
    fontSize: 14,
     
    letterSpacing: 1,
  },
  novelIntro: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.5,
  },
  highlight: {
    color: KA_COLORS.orangePrimary,
     
  },
  summaryLinkContainer: {
    padding: 16,
  },
  summaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  summaryLinkText: {
    color: KA_COLORS.orangePrimary,
    fontSize: 14,
     
    letterSpacing: 1,
  },
  chaptersSection: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    color: KA_COLORS.gold,
    fontSize: 20,
     
    marginBottom: 16,
    letterSpacing: 2,
  },
  chapterCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  chapterContent: {
    backgroundColor: KA_COLORS.bgCard,
    padding: 16,
  },
  chapterGradient: {
    backgroundColor: KA_COLORS.bgCard,
  },
  chapterTitle: {
    color: KA_COLORS.ivory,
    fontSize: 16,
     
    marginBottom: 8,
    letterSpacing: 1,
  },
  chapterNumber: {
    color: KA_COLORS.gold,
    fontSize: 12,
     
    marginBottom: 4,
    letterSpacing: 1,
  },
  chapterAccent: {
    height: 2,
    backgroundColor: KA_COLORS.orangePrimary,
    width: '100%',
  },
  noChapters: {
    color: KA_COLORS.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
    letterSpacing: 1,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: KA_COLORS.border,
  },
  footerText: {
    color: KA_COLORS.textMuted,
    fontSize: 12,
    letterSpacing: 1,
  },
  connectPopupOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  connectPopup: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 32,
    width: '80%',
    maxWidth: 400,
  },
  closePopupButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  popupTitle: {
    color: KA_COLORS.ivory,
    fontSize: 24,
     
    marginBottom: 12,
    letterSpacing: 2,
  },
  popupMessage: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 1,
  },
  connectWalletButton: {
    marginBottom: 16,
  },
});

const NovelDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const [novel, setNovel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConnectPopup, setShowConnectPopup] = useState(false);
  const [viewCountError, setViewCountError] = useState(null);
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

  useEffect(() => {
    if (viewCountError) {
      const timer = setTimeout(() => setViewCountError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [viewCountError]);

  useEffect(() => {
    fetchNovel();
    updateViewCount();
  }, [fetchNovel, updateViewCount]);

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
            <Text style={styles.chapterNumber}>Chapter {parseInt(chapterId) + 1}</Text>
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
            <FontAwesome5 name="times" size={16} color={KA_COLORS.ivory} />
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
              <FontAwesome5 name="eye" size={16} color={KA_COLORS.orangePrimary} />
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
            <FontAwesome5 name="book-open" size={16} color={KA_COLORS.orangePrimary} />
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
          <ActivityIndicator size="large" color={KA_COLORS.orangePrimary} />
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
            <FontAwesome5 name="home" size={16} color={KA_COLORS.ivory} />
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
              <FontAwesome5 name="times" size={24} color={KA_COLORS.orangePrimary} />
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
              <FontAwesome5 name="home" size={16} color={KA_COLORS.ivory} />
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
              <FontAwesome5 name="home" size={16} color={KA_COLORS.ivory} />
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
              <FontAwesome5 name="book-open" size={16} color={KA_COLORS.ivory} />
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