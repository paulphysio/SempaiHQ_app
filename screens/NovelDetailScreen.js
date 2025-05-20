// ./screens/NovelDetailScreen.js
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import ConnectButton, { EmbeddedWalletContext } from '../components/ConnectButton';
import NovelCommentSection from '../components/Comments/NovelCommentSection';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from '../styles/NovelPageStyles';

const FALLBACK_IMAGE = 'https://placehold.co/300x400/png?text=No+Image';

const NovelDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;
  const { wallet } = useContext(EmbeddedWalletContext);
  const [novel, setNovel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConnectPopup, setShowConnectPopup] = useState(false);
  const [viewCountError, setViewCountError] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const menuAnim = useRef(new Animated.Value(280)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

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

  const toggleComments = () => {
    setShowComments(!showComments);
  };

  const fetchNovel = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('novels')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error('Novel not found');
      setNovel(data);
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Unexpected error:', error.message);
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
      const { error: rpcError } = await supabase.rpc('increment_novel_view', {
        novel_id: id,
        user_id: userId,
      });

      if (rpcError) {
        console.error('Error in increment_novel_view:', rpcError.message);
        setViewCountError('Failed to update view count. Please try again later.');
      } else {
        console.log('Viewers count incremented for user:', userId);
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
          <LinearGradient
            colors={['#1A1A2E', '#0F0F1F']}
            style={styles.chapterGradient}
          >
            <Text style={styles.chapterTitle}>{sanitizeText(title)}</Text>
            <View style={styles.chapterAccent} />
          </LinearGradient>
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
            <FontAwesome5 name="times" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.novelContainer}>
        <LinearGradient
          colors={['#1A1A2E', '#0F0F1F']}
          style={styles.novelHeaderGradient}
        >
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
              <FontAwesome5 name="eye" size={16} color="#D94F04" />
              <Text style={styles.novelViewsText}>
                {(novel.viewers_count || 0).toLocaleString()} Views
              </Text>
            </View>
            <Text style={styles.novelIntro}>
              Dive into the chapters of{' '}
              <Text style={styles.highlight}>{sanitizeText(novel.title)}</Text>:
            </Text>
          </View>
        </LinearGradient>
        <View style={styles.chaptersSection}>
          <Text style={styles.sectionTitle}>Chapters</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderFooter = () => (
    <View style={styles.novelContainer}>
      <View style={styles.commentsSection}>
        <TouchableOpacity
          style={styles.commentsToggle}
          onPress={toggleComments}
          accessible={true}
          accessibilityLabel={showComments ? 'Hide comments' : 'Show comments'}
        >
          <Text style={styles.sectionTitle}>
            Comments {showComments ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {showComments && novel.id && novel.title && (
          <NovelCommentSection
            novelId={novel.id}
            novelTitle={sanitizeText(novel.title)}
          />
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D94F04" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!novel || error) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Novel not found'}</Text>
          <TouchableOpacity
            style={styles.backHomeLink}
            onPress={() => navigation.navigate('Home')}
            accessible={true}
            accessibilityLabel="Go to home"
          >
            <FontAwesome5 name="home" size={16} color="#fff" />
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
          <LinearGradient
            colors={['#1A1A2E', '#0F0F1F']}
            style={styles.connectPopup}
          >
            <TouchableOpacity
              style={styles.closePopupButton}
              onPress={() => setShowConnectPopup(false)}
              accessible={true}
              accessibilityLabel="Close popup"
            >
              <FontAwesome5 name="times" size={24} color="#D94F04" />
            </TouchableOpacity>
            <Text style={styles.popupTitle}>Connect Wallet</Text>
            <Text style={styles.popupMessage}>
              Connect your wallet to access this chapter.
            </Text>
            <ConnectButton style={styles.connectWalletButton} />
            <TouchableOpacity
              style={styles.backHomeLink}
              onPress={() => navigation.navigate('Home')}
              accessible={true}
              accessibilityLabel="Go to home"
            >
              <FontAwesome5 name="home" size={16} color="#fff" />
              <Text style={styles.backHomeText}>Back to Home</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.navbar}>
        <View style={styles.navContainer}>
          <TouchableOpacity
            style={styles.logoLink}
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
              style={styles.logo}
              resizeMode="cover"
              defaultSource={{ uri: 'https://placehold.co/50x50/png?text=Logo' }}
            />
            <Text style={styles.logoText}>SempaiHQ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuToggle}
            onPress={toggleMenu}
            accessible={true}
            accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <FontAwesome5 name={menuOpen ? 'times' : 'bars'} size={24} color="#D94F04" />
          </TouchableOpacity>
        </View>
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
              <FontAwesome5 name="home" size={16} color="#fff" />
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
              <FontAwesome5 name="book-open" size={16} color="#fff" />
              <Text style={styles.navItemText}>Summary</Text>
            </TouchableOpacity>
            <ConnectButton style={styles.connectBtn} />
          </Animated.View>
        </>
      )}

      <FlatList
        data={novel.chaptertitles ? Object.entries(novel.chaptertitles) : []}
        renderItem={renderChapterItem}
        keyExtractor={([chapterId]) => `chapter-${chapterId}`}
        numColumns={2}
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