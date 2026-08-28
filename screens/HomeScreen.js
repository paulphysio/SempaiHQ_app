import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Animated,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
  Text,
  Clipboard,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Modal from 'react-native-modal';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import GoogleSignInButton from '../components/GoogleSignInButton';
import ConnectButton from '../components/ConnectButtonEnhanced';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import { supabase } from '../services/supabaseClient';
import { styles, HOME_GRADIENTS, HOME_COLORS, CARD_STEP, getThemedStyles } from '../styles/HomeStyles';
import { AnimatedPressable, useDelayedUnmount, usePulse } from '../utils/homeAnimation';
import { useCardExpansion } from '../utils/cardExpansion';
import CinematicCardOverlay from '../components/CinematicCardOverlay';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

// Shimmer placeholder shown in place of a carousel while its data is still
// loading — sized to match the real poster card exactly so nothing reflows
// once real content swaps in. Defined outside Home so it isn't recreated
// (and its usePulse loop restarted) on every Home render.
const CarouselSkeleton = ({ count = 4 }) => {
  const pulse = usePulse();
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={[styles.skeletonCard, { opacity: pulse }]}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
        </Animated.View>
      ))}
    </View>
  );
};

const Home = () => {
  const navigation = useNavigation();
  const { wallet, isWalletConnected, disconnectWallet, createEmbeddedWallet, retrieveEmbeddedWallet } = useContext(EmbeddedWalletContext);
  const { session, signIn, signOut } = useGoogleAuth();
  const { isDark, colors, toggleTheme } = useTheme();

  // State for UI and data
  const [menuOpen, setMenuOpen] = useState(false);
  const [novels, setNovels] = useState([]);
  const [manga, setManga] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);

  const [publicKey, setPublicKey] = useState(null);
  const [userId, setUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isWriter, setIsWriter] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [showDashboardPopup, setShowDashboardPopup] = useState(false);
  const [showWalletConnectModal, setShowWalletConnectModal] = useState(false);
  const [walletModalMode, setWalletModalMode] = useState('choose'); // 'choose' | 'create' | 'retrieve'
  const [walletPassword, setWalletPassword] = useState('');
  const [walletPassword2, setWalletPassword2] = useState('');
  const [walletModalError, setWalletModalError] = useState(null);

  // Get themed styles
  const themedStyles = getThemedStyles(isDark);

  // Animation refs
  const slideAnim = useRef(new Animated.Value(280)).current;
  const announcementAnim = useRef(new Animated.Value(0)).current;
  const notificationAnim = useRef(new Animated.Value(0)).current;
  const authAnim = useRef(new Animated.Value(0)).current;
  const walletMenuAnim = useRef(new Animated.Value(0)).current;

  const heroTextAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const headerPulse = useRef(new Animated.Value(0)).current;
  const badgePop = useRef(new Animated.Value(1)).current;
  const isMounted = useRef(true);
  const novelFlatListRef = useRef(null);
  const mangaFlatListRef = useRef(null);
  const novelIndexRef = useRef(0);
  const mangaIndexRef = useRef(0);

  // Cinematic card expansion — measures the tapped poster's real screen
  // rect, then CinematicCardOverlay morphs it into a full detail panel.
  // cardNodeRefs holds the live View node for each rendered card so we can
  // call measureInWindow() on tap.
  const cardNodeRefs = useRef({});
  const { expandedCard, progress, kenBurns, openCard, closeCard, resetImmediate } = useCardExpansion();

  // Scroll-linked hero parallax — the hero text drifts up and fades
  // slightly as the person scrolls into the content below, instead of
  // sitting static the whole time.
  const scrollY = useRef(new Animated.Value(0)).current;
  const heroParallaxTranslate = scrollY.interpolate({ inputRange: [0, 160], outputRange: [0, -26], extrapolate: 'clamp' });
  const heroParallaxOpacity = scrollY.interpolate({ inputRange: [0, 160], outputRange: [1, 0.4], extrapolate: 'clamp' });

  // Keeps dropdowns/overlay mounted long enough to play their exit
  // animation instead of disappearing the instant state flips.
  const overlayShouldRender = useDelayedUnmount(menuOpen, 300);
  const notificationsShouldRender = useDelayedUnmount(showNotifications, 300);
  const announcementsShouldRender = useDelayedUnmount(showAnnouncements, 300);
  const walletMenuShouldRender = useDelayedUnmount(showWalletMenu, 250);
  const authMenuShouldRender = useDelayedUnmount(showAuthMenu, 250);

  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, 280],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Feature cards
  const features = [
    {
      title: "Kaito's Adventure",
      image: { uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/background.jpg' },
      path: 'KaitoAdventure',
      requiresWallet: true,
    },
    {
      title: 'DAO Governance',
      image: { uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/dao.jpg' },
      path: 'DAOGovernance',
      requiresWallet: true,
    },
    {
      title: 'Hoard',
      image: { uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/novel-3.jpg' },
      path: 'NovelsPage', // Updated from 'Novels'
      requiresWallet: false,
    },
    {
      title: 'KISS',
      image: { uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/novel-4.jpg' },
      path: 'KeepItSimple',
      requiresWallet: false,
    },
  ];

  const scaleAnims = useRef(features.map(() => new Animated.Value(1))).current;
  const fadeAnims = useRef(features.map(() => new Animated.Value(0))).current;

  // Background animations
  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 360,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 7500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 7500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Pop the notification badge whenever the unread count goes up, instead
  // of it just silently changing number.
  useEffect(() => {
    if (unreadCount > 0) {
      badgePop.setValue(0.6);
      Animated.spring(badgePop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    }
  }, [unreadCount]);

  // Wallet dropdown handlers
  const toggleWalletMenu = () => {
    if (showAnnouncements) { setShowAnnouncements(false); Animated.timing(announcementAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(); }
    if (showNotifications) { setShowNotifications(false); Animated.timing(notificationAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(); }
    if (showAuthMenu) { setShowAuthMenu(false); Animated.timing(authAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(); }
    const toValue = showWalletMenu ? 0 : 1;
    Animated.timing(walletMenuAnim, { toValue, duration: 250, useNativeDriver: true }).start();
    setShowWalletMenu(!showWalletMenu);
  };

  const copyWalletAddress = () => {
    try {
      if (wallet?.publicKey) {
        Clipboard.setString(wallet.publicKey.toString());
        Alert.alert('Copied', 'Wallet address copied to clipboard');
      }
    } catch (e) {
      console.warn('Copy failed:', e.message);
    }
  };

  // Hero and feature animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroTextAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      ...fadeAnims.map((anim, index) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          delay: index * 150,
          useNativeDriver: true,
        })
      ),
    ]).start();

    // Subtle pulse for wallet button in header
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerPulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(headerPulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Sync wallet and fetch user ID/roles
  useEffect(() => {
    const syncWallet = async () => {
      try {
        if (session?.user?.id) {
          const { data: authUser, error: authUserError } = await supabase
            .from('users')
            .select('id, wallet_address, isWriter, isArtist, isSuperuser')
            .eq('id', session.user.id)
            .single();

          if (authUserError && authUserError.code !== 'PGRST116') {
            throw new Error(`Failed to fetch auth user: ${authUserError.message}`);
          }

          if (authUser && isMounted.current) {
            setPublicKey(authUser.wallet_address || null);
            setUserId(authUser.id);
            setIsWriter(authUser.isWriter || false);
            setIsArtist(authUser.isArtist || false);
            setIsSuperuser(authUser.isSuperuser || false);
            if (authUser.wallet_address) {
              await AsyncStorage.setItem('walletAddress', authUser.wallet_address.toString());
            }
            return;
          }
        }

        if (wallet?.publicKey && isWalletConnected) {
          const publicKeyStr = typeof wallet.publicKey === 'string' 
            ? wallet.publicKey 
            : wallet.publicKey?.toString();
            
          if (!publicKeyStr) {
            console.log('No valid public key found');
            return;
          }
          
          setPublicKey(publicKeyStr);
          await AsyncStorage.setItem('walletAddress', publicKeyStr);

          const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, isWriter, isArtist, isSuperuser')
            .eq('wallet_address', publicKeyStr)
            .maybeSingle();

          if (userError && userError.code !== 'PGRST116') {
            throw new Error(`Failed to fetch user: ${userError.message}`);
          }

          if (user && isMounted.current) {
            setUserId(user.id);
            setIsWriter(user.isWriter || false);
            setIsArtist(user.isArtist || false);
            setIsSuperuser(user.isSuperuser || false);
          } else if (session?.user?.id) {
            const { data: updatedUser, error: updateError } = await supabase
              .from('users')
              .update({ wallet_address: publicKeyStr })
              .eq('id', session.user.id)
              .select('id, isWriter, isArtist, isSuperuser')
              .single();

            if (updateError) {
              throw new Error(`Failed to update user wallet: ${updateError.message}`);
            }

            if (updatedUser && isMounted.current) {
              setUserId(updatedUser.id);
              setIsWriter(updatedUser.isWriter || false);
              setIsArtist(updatedUser.isArtist || false);
              setIsSuperuser(updatedUser.isSuperuser || false);
            }
          }
        } else {
          const key = await AsyncStorage.getItem('walletAddress');
          if (key && isMounted.current) {
            setPublicKey(key);

            const { data: user, error: userError } = await supabase
              .from('users')
              .select('id, isWriter, isArtist, isSuperuser')
              .eq('wallet_address', key)
              .maybeSingle();

            if (userError && userError.code !== 'PGRST116') {
              throw new Error(`Failed to fetch user: ${userError.message}`);
            }

            if (user && isMounted.current) {
              setUserId(user.id);
              setIsWriter(user.isWriter || false);
              setIsArtist(user.isArtist || false);
              setIsSuperuser(user.isSuperuser || false);
            } else {
              setPublicKey(null);
              setUserId(null);
            }
          } else {
            setPublicKey(null);
            setUserId(null);
            setIsWriter(false);
            setIsArtist(false);
            setIsSuperuser(false);
          }
        }
      } catch (err) {
        console.error('Error syncing wallet:', err.message);
        if (isMounted.current) {
          setError('Failed to sync wallet');
        }
      }
    };
    syncWallet();
  }, [wallet?.publicKey, isWalletConnected, session?.user?.id]);

  // Fetch announcements
  useEffect(() => {
    if (!userId) return;

    const fetchAnnouncements = async () => {
      try {
        const { data: interactions, error: interactionsError } = await supabase
          .from('novel_interactions')
          .select('novel_id')
          .eq('user_id', userId);

        if (interactionsError) {
          throw new Error(`Failed to fetch interactions: ${interactionsError.message}`);
        }

        const novelIds = interactions?.map(i => i.novel_id) || [];

        let writerQuery = supabase
          .from('writer_announcements')
          .select(`
            id, title, message, created_at, release_date,
            novels(id, title),
            users!writer_id(id, wallet_address)
          `)
          .order('created_at', { ascending: false });

        if (novelIds.length > 0) {
          writerQuery = writerQuery.in('novel_id', novelIds);
        }

        const [
          { data: writerAnnouncements, error: writerError },
          { data: generalAnnouncements, error: announcementsError },
        ] = await Promise.all([
          writerQuery,
          supabase
            .from('announcements')
            .select(`
              id, title, message, created_at, release_date, audience,
              users!user_id(id, wallet_address)
            `)
            .order('created_at', { ascending: false }),
        ]);

        if (writerError) {
          throw new Error(`Failed to fetch writer announcements: ${writerError.message}`);
        }
        if (announcementsError) {
          throw new Error(`Failed to fetch general announcements: ${announcementsError.message}`);
        }

        const filteredGeneralAnnouncements = generalAnnouncements.filter(ann =>
          ann.audience === 'creators' ? isWriter || isArtist : true
        );

        const normalizedWriterAnnouncements = writerAnnouncements.map(ann => ({
          id: ann.id,
          title: ann.title,
          message: ann.message,
          created_at: ann.created_at,
          release_date: ann.release_date,
          novels: ann.novels ? { id: ann.novels.id, title: ann.novels.title } : null,
          users: ann.users ? { id: ann.users.id, wallet_address: ann.users.wallet_address } : null,
        }));

        const normalizedGeneralAnnouncements = filteredGeneralAnnouncements.map(ann => ({
          id: ann.id,
          title: ann.title,
          message: ann.message,
          created_at: ann.created_at,
          release_date: ann.release_date,
          novels: null,
          users: ann.users ? { id: ann.users.id, wallet_address: ann.users.wallet_address } : null,
        }));

        const combinedAnnouncements = [...normalizedWriterAnnouncements, ...normalizedGeneralAnnouncements]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 10);

        if (isMounted.current) {
          setAnnouncements(combinedAnnouncements);
        }
      } catch (err) {
        console.error('fetchAnnouncements error:', err.message);
        if (isMounted.current) {
          setError(`Failed to fetch announcements: ${err.message}`);
        }
      }
    };
    fetchAnnouncements();
  }, [userId, isWriter, isArtist]);

  // Fetch notifications
  useEffect(() => {
    if (!userId) return;

    const fetchNotifications = async () => {
      try {
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifications')
          .select('id, novel_id, message, novel_title, is_read, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (notificationsError) {
          throw new Error(`Failed to fetch notifications: ${notificationsError.message}`);
        }

        if (isMounted.current) {
          setNotifications(notificationsData || []);
          setUnreadCount(notificationsData?.filter(n => !n.is_read).length || 0);
        }
      } catch (err) {
        console.error('fetchNotifications error:', err.message);
        if (isMounted.current) {
          setError(`Failed to fetch notifications: ${err.message}`);
        }
      }
    };
    fetchNotifications();
  }, [userId]);

  // Fetch novels
  useEffect(() => {
    const fetchNovel = async () => {
      setLoading(true);
      try {
        const { data: novelsData, error } = await supabase
          .from('novels')
          .select('id, title, image, summary, user_id, tags, viewers_count')
          .eq('is_visible', true)
          .eq('featured', true);

        if (error) {
          throw new Error(`Failed to fetch novels: ${error.message}`);
        }
        if (!novelsData?.length) {
          setNovels([]);
          return;
        }

        const userIds = [...new Set(novelsData.map(novel => novel.user_id).filter(id => id))];
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, isWriter')
          .in('id', userIds);

        if (usersError) {
          throw new Error(`Failed to fetch users: ${usersError.message}`);
        }

        const usersMap = usersData.reduce((acc, user) => {
          acc[user.id] = { name: user.name || 'Unknown', isWriter: user.isWriter || false };
          return acc;
        }, {});

        const { data: ratingsData, error: ratingsError } = await supabase
          .from('chapter_ratings')
          .select('content_id, rating')
          .eq('content_type', 'novel');

        if (ratingsError) {
          throw new Error(`Failed to fetch novel ratings: ${ratingsError.message}`);
        }

        const ratingsMap = ratingsData.reduce((acc, rating) => {
          acc[rating.content_id] = (acc[rating.content_id] || []).concat(rating.rating);
          return acc;
        }, {});

        const enrichedNovels = (novelsData || [])
          .map(novel => {
            const ratings = ratingsMap[novel.id] || [];
            const averageRating = ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
            return {
              ...novel,
              id: novel.id || `temp-${Math.random()}`,
              writer: usersMap[novel.user_id] || { name: 'Unknown', isWriter: false },
              viewers: novel.viewers_count || 0,
              averageRating: averageRating.toFixed(2),
              isAdult: novel.tags?.includes('Adult(18+)') || false,
            };
          });

        if (isMounted.current) {
          setNovels(enrichedNovels.sort((a, b) => b.viewers - a.viewers).slice(0, 6));
        }
      } catch (err) {
        console.error('fetchNovels error:', err.message);
        if (isMounted.current) {
          setError(`Failed to fetch novels: ${err.message}`);
          setNovels([]);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };
    fetchNovel();
  }, []);

  // Fetch manga
  useEffect(() => {
    const fetchManga = async () => {
      setLoading(true);
      try {
        const { data: mangaData, error } = await supabase
          .from('manga')
          .select('id, title, cover_image, summary, user_id, status, tags, viewers_count')
          .eq('is_visible', true)
          .eq('featured', true)
          .in('status', ['ongoing', 'completed'])
          .limit(5);

        if (error) {
          throw new Error(`Failed to fetch manga: ${error.message}`);
        }
        if (!mangaData?.length) {
          setManga([]);
          return;
        }

        const userIds = [...new Set(mangaData.map(manga => manga.user_id).filter(id => id))];
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, isArtist')
          .in('id', userIds);

        if (usersError) {
          throw new Error(`Failed to fetch users: ${usersError.message}`);
        }

        const usersMap = usersData.reduce((acc, user) => {
          acc[user.id] = { name: user.name || 'Unknown', isArtist: user.isArtist || false };
          return acc;
        }, {});

        const { data: interactionsData, error: interactionsError } = await supabase
          .from('manga_interactions')
          .select('manga_id, user_id');

        if (interactionsError) {
          throw new Error(`Failed to fetch interactions: ${interactionsError.message}`);
        }

        const viewerCounts = interactionsData.reduce((acc, interaction) => {
          acc[interaction.manga_id] = (acc[interaction.manga_id] || new Set()).add(interaction.user_id);
          return acc;
        }, {});

        const { data: ratingsData, error: ratingsError } = await supabase
          .from('chapter_ratings')
          .select('content_id, rating')
          .eq('content_type', 'manga');

        if (ratingsError) {
          throw new Error(`Failed to fetch manga ratings: ${ratingsError.message}`);
        }

        const ratingsMap = ratingsData.reduce((acc, rating) => {
          acc[rating.content_id] = (acc[rating.content_id] || []).concat(rating.rating);
          return acc;
        }, {});

        const enrichedManga = (mangaData || [])
          .map(manga => {
          const ratings = ratingsMap[manga.id] || [];
          const averageRating = ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
          const uniqueViewers = viewerCounts[manga.id]?.size || 0;
          return {
            ...manga,
            id: manga.id || `temp-${Math.random()}`,
            image: manga.cover_image,
            writer: usersMap[manga.user_id] || { name: 'Unknown', isArtist: false },
            viewers: manga.viewers_count || uniqueViewers || 0,
            averageRating: averageRating.toFixed(1),
            isAdult: manga.tags?.includes('Adult(18+)') || false,
          };
        });

        if (isMounted.current) {
          setManga(enrichedManga);
        }
      } catch (err) {
        console.error('Error fetching manga:', err.message);
        if (isMounted.current) {
          setError(`Failed to fetch manga: ${err.message}`);
          setManga([]);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };
    fetchManga();
  }, []);

  // Toggle sidebar — spring instead of a flat timing curve, so it has a
  // touch of natural overshoot/settle rather than a mechanical slide.
  const toggleMenu = () => {
    Animated.spring(slideAnim, {
      toValue: menuOpen ? 280 : 0,
      friction: 9,
      tension: 65,
      useNativeDriver: true,
    }).start();
    setMenuOpen(!menuOpen);
  };

  // Toggle announcements dropdown
  const toggleAnnouncements = () => {
    if (showAuthMenu) { setShowAuthMenu(false); Animated.timing(authAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(); }
    if (showWalletMenu) { setShowWalletMenu(false); Animated.timing(walletMenuAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(); }
    Animated.timing(announcementAnim, {
      toValue: showAnnouncements ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowAnnouncements(!showAnnouncements);
  };

  // Toggle notifications dropdown
  const toggleNotifications = () => {
    if (showAuthMenu) { setShowAuthMenu(false); Animated.timing(authAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(); }
    if (showWalletMenu) { setShowWalletMenu(false); Animated.timing(walletMenuAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(); }
    Animated.timing(notificationAnim, {
      toValue: showNotifications ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowNotifications(!showNotifications);
  };

  // Toggle auth dropdown
  const toggleAuthMenu = () => {
    // close other dropdowns
    if (showAnnouncements) setShowAnnouncements(false);
    if (showNotifications) setShowNotifications(false);
    if (showWalletMenu) setShowWalletMenu(false);
    Animated.timing(announcementAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(notificationAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();

    const toValue = showAuthMenu ? 0 : 1;
    Animated.timing(authAnim, { toValue, duration: 250, useNativeDriver: true }).start();
    setShowAuthMenu(!showAuthMenu);
  };

  // Mark notifications as read
  const markNotificationsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .in('id', notifications.filter(n => !n.is_read).map(n => n.id));

      if (error) {
        throw error;
      }

      if (isMounted.current) {
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err.message);
      setError(`Failed to mark notifications as read: ${err.message}`);
    }
  };

  // Navigation handler with error handling
  const handleNavigation = (path, params = {}) => {
    try {
      toggleMenu();
      navigation.navigate(path, params);
    } catch (error) {
      console.error(`Navigation error to ${path}:`, error.message);
      Alert.alert('Navigation Error', 'Unable to navigate to this section. Please try again later.');
    }
  };

  // Profile navigation with wallet check
  const handleProfileNavigation = () => {
    if (!isWalletConnected || !userId) {
      Alert.alert('Wallet Required', 'Please connect your wallet to view or edit your profile.', [
        { text: 'OK' },
      ]);
      return;
    }
    const hasRole = isWriter || isArtist || isSuperuser;
    handleNavigation(hasRole ? 'CreatorsProfile' : 'EditProfile', { id: userId });
  };

  // Creator profile navigation
  const handleCreatorProfileNavigation = (creatorId) => {
    if (!creatorId) {
      console.warn('No creator ID provided');
      return;
    }
    handleNavigation('CreatorsProfile', { id: creatorId });
  };

  // Dashboard navigation
  const handleDashboardNavigation = () => {
    if ((isWriter && isArtist) || isSuperuser) {
      setShowDashboardPopup(true);
    } else if (isWriter) {
      handleNavigation('NovelDashboard');
    } else if (isArtist) {
      handleNavigation('MangaDashboard');
    }
  };

  // Auto-scroll novels — paused while a card is expanded so the list can't
  // silently scroll underneath the overlay (which would make the collapse
  // animation land somewhere other than where the card actually is now).
  useEffect(() => {
    if (novels.length <= 1 || expandedCard) return;
    const interval = setInterval(() => {
      let nextIndex = novelIndexRef.current + 1;
      if (nextIndex >= novels.length) nextIndex = 0;
      novelFlatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      novelIndexRef.current = nextIndex;
    }, 2500);
    return () => clearInterval(interval);
  }, [novels.length, expandedCard]);

  // Auto-scroll manga — same pause-while-expanded guard as novels above.
  useEffect(() => {
    if (manga.length <= 1 || expandedCard) return;
    const interval = setInterval(() => {
      let nextIndex = mangaIndexRef.current + 1;
      if (nextIndex >= manga.length) nextIndex = 0;
      mangaFlatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      mangaIndexRef.current = nextIndex;
    }, 2500);
    return () => clearInterval(interval);
  }, [manga.length, expandedCard]);

  // Tapping a poster no longer navigates immediately — it opens the
  // cinematic in-place preview. The CTA inside that preview is what
  // actually navigates to the full detail screen.
  const handleCardPress = (item, type) => {
    const node = cardNodeRefs.current[`${type}-${item.id}`];
    if (!node?.measureInWindow) return;
    node.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      openCard(item, type, { x, y, width: measuredWidth, height: measuredHeight });
    });
  };

  const handleReadNow = () => {
    if (!expandedCard) return;
    const { item, type } = expandedCard;
    resetImmediate(); // no point playing the 420ms close animation on a screen we're leaving
    navigation.navigate(type === 'novel' ? 'NovelDetail' : 'MangaDetail', { id: item.id });
  };

  // Render novel/manga carousel item — poster-card layout. `index` drives
  // the rank badge (only meaningful because both lists are pre-sorted by
  // viewers before they ever reach this component).
  const renderCarouselItem = ({ item, index, type }) => {
    if (!item.id) {
      console.warn(`Missing ID for ${type}: ${item.title}`);
      return null;
    }
    const hasWriterCredit =
      (type === 'novel' ? item.writer?.isWriter : item.writer?.isArtist) && item.writer?.name !== 'Unknown';

    return (
      <View style={styles.contentCard}>
        <AnimatedPressable
          onPress={() => handleCardPress(item, type)}
          accessible={true}
          accessibilityLabel={`Preview ${item.title}`}
          accessibilityHint="Opens a detail preview in place"
          scaleTo={0.96}
        >
          <View
            style={styles.contentImageWrap}
            ref={(node) => {
              if (node) cardNodeRefs.current[`${type}-${item.id}`] = node;
            }}
            collapsable={false}
          >
            <Image
              source={{ uri: item.image || 'https://via.placeholder.com/260x340' }}
              style={styles.contentImage}
              defaultSource={{ uri: 'https://via.placeholder.com/260x340' }}
            />
            <View style={[styles.rankBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.rankBadgeText}>{index + 1}</Text>
            </View>
            <View style={[styles.ratingFloatBadge, { backgroundColor: colors.bgElevated }]}>
              <FontAwesome5 name="star" size={9} color={colors.gold} />
              <Text style={[styles.ratingFloatText, { color: colors.textPrimary }]}>{item.averageRating}</Text>
            </View>
            {item.isAdult && (
              <View style={[styles.adultRibbon, { backgroundColor: colors.danger }]}>
                <Text style={styles.adultWarning}>18+</Text>
              </View>
            )}
          </View>

          <View style={styles.contentInfo}>
            <Text style={[styles.contentTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
            <View style={styles.contentStats}>
              {hasWriterCredit ? (
                <TouchableOpacity
                  style={styles.writerName}
                  activeOpacity={0.7}
                  onPress={() => handleCreatorProfileNavigation(item.user_id)}
                  accessible={true}
                  accessibilityLabel={`View ${item.writer.name}'s profile`}
                  accessibilityHint="Navigates to creator profile"
                >
                  <FontAwesome5 name="feather-alt" size={10} color={colors.accent} style={styles.writerIcon} />
                  <Text style={[styles.writerNameText, { color: colors.textSecondary }]} numberOfLines={1}>{item.writer.name}</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              <View style={styles.statChip}>
                <FontAwesome5 name="eye" size={10} color={colors.textMuted} />
                <Text style={[styles.viewers, { color: colors.textMuted }]}>{item.viewers}</Text>
              </View>
            </View>
          </View>
        </AnimatedPressable>
      </View>
    );
  };

  // Render announcement item
  const renderAnnouncementItem = ({ item }) => (
    <View style={[styles.announcementCard, { backgroundColor: colors.bgCard }]}>
      <Text style={[styles.announcementTitle, { color: colors.textPrimary }]}>{item.title}</Text>
      <Text style={[styles.announcementMessage, { color: colors.textSecondary }]} numberOfLines={3}>{item.message}</Text>
      <View style={styles.announcementDetails}>
        {item.novels && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('NovelDetail', { id: item.novels.id })}
          >
            <Text style={[styles.announcementLink, { color: colors.accent }]}>{item.novels.title}</Text>
          </TouchableOpacity>
        )}
        {item.users?.wallet_address && (
          <Text style={[styles.announcementAuthor, { color: colors.textMuted }]}>By: {item.users.wallet_address.slice(0, 6)}...</Text>
        )}
        <Text style={[styles.announcementDate, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    </View>
  );

  // Render notification item
  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.notificationItem, { backgroundColor: colors.bgCard }]}
      onPress={() => {
        if (item.novel_id) {
          navigation.navigate('NovelDetail', { id: item.novel_id });
        }
      }}
      accessible={true}
      accessibilityLabel={item.message}
      accessibilityHint="View notification details"
    >
      <Text style={[styles.notificationMessage, { color: colors.textPrimary }]}>{item.message}</Text>
      <Text style={[styles.notificationDetails, { color: colors.textMuted }]}>
        {item.novel_title} • {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  // Render feature item
  const renderFeatureItem = ({ item, index }) => {
    const onPressIn = () => {
      Animated.spring(scaleAnims[index], {
        toValue: 0.95,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    };

    const onPressOut = () => {
      Animated.spring(scaleAnims[index], {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View
        style={[
          styles.featureCard,
          {
            backgroundColor: colors.bgCard,
            opacity: fadeAnims[index],
            transform: [
              { translateY: fadeAnims[index].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              { scale: scaleAnims[index] },
            ],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          accessible={true}
          accessibilityLabel={`Explore ${item.title}`}
          accessibilityHint={item.requiresWallet ? 'Requires wallet connection' : 'Navigate to feature'}
          style={styles.featureCardInner}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={() => {
            if (item.requiresWallet && !isWalletConnected) {
              Alert.alert('Wallet Required', 'Please connect your wallet.');
            } else {
              handleNavigation(item.path);
            }
          }}
        >
          <Image
            source={item.image}
            style={[styles.featureImage, item.title === 'Google Sign-In' && styles.googleSignInImage]}
            defaultSource={require('../assets/default-feature.png')}
          />
          <LinearGradient 
            colors={isDark ? HOME_GRADIENTS.featureImage : ['transparent', 'rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.6)']} 
            style={styles.featureImageGradient} 
            pointerEvents="none" 
          />
          <View style={styles.featureOverlay}>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
            {item.requiresWallet && (
              <View style={[styles.premiumBadge, { backgroundColor: colors.accent }]}>
                <FontAwesome5 name="lock" size={9} color="#fff" />
                <Text style={styles.premiumBadgeText}>Wallet</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Section header with accent bar + optional "See all" action.
  const SectionHeader = ({ title, onSeeAll }) => (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionHeaderLeft}>
        <View style={[styles.sectionAccentBar, { backgroundColor: colors.accent }]} />
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {onSeeAll && (
        <AnimatedPressable style={styles.sectionSeeAll} onPress={onSeeAll} scaleTo={0.93}>
          <Text style={[styles.sectionSeeAllText, { color: colors.textSecondary }]}>See all</Text>
          <FontAwesome5 name="chevron-right" size={9} color={colors.textSecondary} />
        </AnimatedPressable>
      )}
    </View>
  );

  // Update the sidebar rendering part of the Home component

  // In the Home component, replace the sidebar rendering with this
  const renderSidebarContent = () => {
    const [activeDropdown, setActiveDropdown] = useState(null);

    const navGroups = [
      {
        title: 'Main',
        icon: 'home',
        items: [
          { name: 'Home', screen: 'Home', icon: 'home' },
          { name: 'Feed', screen: 'Feed', icon: 'newspaper' },
          { name: 'Profile', screen: 'Profile', icon: 'user' },
        ],
      },
      {
        title: 'Content',
        icon: 'book',
        condition: isWriter || isArtist || isSuperuser,
        items: [
          { name: 'Novel Dashboard', screen: 'NovelDashboard', icon: 'book-open', condition: isWriter || isSuperuser },
          { name: 'Manga Dashboard', screen: 'MangaDashboard', icon: 'images', condition: isArtist || isSuperuser },
          { name: 'Novels', screen: 'NovelsPage', icon: 'book' },
          { name: 'Manga', screen: 'MangaPage', icon: 'images' },
        ],
      },
      {
        title: 'Wallet',
        icon: 'wallet',
        items: [
          { name: 'Wallet', screen: 'Wallet', icon: 'wallet' },
          { name: 'Swap', screen: 'Swap', icon: 'exchange-alt' },
          { name: 'Mint', screen: 'Mint', icon: 'coins' },
          { name: 'Marketplace', screen: 'Marketplace', icon: 'shopping-cart' },
          { name: 'Wallet Migration', screen: 'WalletMigration', icon: 'exchange-alt' },
        ],
      },
      {
        title: 'Community',
        icon: 'users',
        items: [
          { name: 'Chat', screen: 'Chat', icon: 'comments' },
          { name: 'Leaderboard', screen: 'Leaderboard', icon: 'trophy' },
          { name: 'Kaito Leaderboard', screen: 'KaitoLeaderboard', icon: 'crown' },
        ],
      },
      {
        title: 'Admin',
        icon: 'cog',
        condition: isSuperuser,
        items: [
          { name: 'Admin', screen: 'Admin', icon: 'user-shield' },
          { name: 'Announcements', screen: 'Announcements', icon: 'bullhorn' },
        ],
      },
      {
        title: 'Info',
        icon: 'info-circle',
        items: [
          { name: 'Support', screen: 'Support', icon: 'life-ring' },
          { name: 'Terms', screen: 'Terms', icon: 'file-contract' },
          { name: 'Privacy Policy', screen: 'PrivacyPolicy', icon: 'shield-alt' },
        ],
      },
      {
        title: 'Other',
        icon: 'ellipsis-h',
        items: [
          { name: 'Apply', screen: 'Apply', icon: 'user-plus', condition: !isWriter && !isArtist && !isSuperuser },
          { name: 'Download', screen: 'Download', icon: 'download' },
          { name: 'Add Gif', screen: 'AddGif', icon: 'image', condition: isSuperuser },
        ],
      },
    ];

    const toggleDropdown = (index) => {
      setActiveDropdown(activeDropdown === index ? null : index);
    };

    const navigateToScreen = (screenName) => {
      handleNavigation(screenName);
      setActiveDropdown(null);
    };

    return (
      <View style={styles.sidebarContent}>
        {/* Profile Section at Top */}
        <View style={styles.sidebarProfileSection}>
          <View style={styles.sidebarButtons}>
            <GoogleSignInButton />
            {session && <ConnectButton email={session?.user?.email} userId={session?.user?.id} />}
          </View>
        </View>
        
        <View style={styles.sidebarDivider} />
        
        {/* Navigation Links - Make these scrollable */}
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.navLinksContainer}
        >
          {navGroups.filter(group => !group.condition || group.condition).map((group, groupIndex) => (
            <View key={groupIndex} style={styles.navGroup}>
              <AnimatedPressable
                style={styles.navGroupButton}
                onPress={() => toggleDropdown(groupIndex)}
                scaleTo={0.98}
              >
                <FontAwesome5 name={group.icon} size={16} color={HOME_COLORS.accent} style={styles.navIcon} />
                <Text style={styles.navGroupText}>{group.title}</Text>
                <FontAwesome5 
                  name={activeDropdown === groupIndex ? 'chevron-up' : 'chevron-down'} 
                  size={12} 
                  color={HOME_COLORS.accent} 
                  style={styles.dropdownIcon} 
                />
              </AnimatedPressable>
              
              {activeDropdown === groupIndex && (
                <View style={styles.dropdown}>
                  {group.items.filter(item => !item.condition || item.condition).map((item, itemIndex) => (
                    <AnimatedPressable
                      key={itemIndex}
                      style={styles.dropdownItem}
                      onPress={() => navigateToScreen(item.screen)}
                      scaleTo={0.97}
                    >
                      <FontAwesome5 name={item.icon} size={14} color={HOME_COLORS.accent} style={styles.navIcon} />
                      <Text style={styles.dropdownItemText}>{item.name}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
              )}
            </View>
          ))}
          {/* Add some bottom padding for better scrolling */}
          <View style={{ height: 10 }} />
        </ScrollView>
      </View>
    );
  };

  const walletAddress = wallet?.publicKey?.toString();
  const walletLabel = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : 'Connect';

  return (
    <View style={themedStyles.container}>
      {/* Background animations */}
      <View style={[styles.backgroundAnimation, { zIndex: -1, pointerEvents: 'none' }]}>
        <LinearGradient
          colors={isDark ? ['rgba(0, 0, 0, 0.8)', 'rgba(243, 99, 22, 0.3)'] : ['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.2)']}
          style={styles.gradientLayer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Animated.View
          style={[
            styles.waveLayer,
            {
              transform: [
                { translateX: -width / 2 },
                { translateY: -height / 2 },
                { rotate: waveAnim.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={isDark ? ['rgba(243, 99, 22, 0.4)', 'transparent'] : ['rgba(59, 130, 246, 0.3)', 'transparent']}
            style={styles.waveGradient}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.pulseLayer,
            {
              opacity: pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.6, 0.3] }),
              transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.1, 1] }) }],
            },
          ]}
        />
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      {/* Header */}
      {/* <View style={styles.header}>
        <View style={styles.brand}>
          <Image
            source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
            style={styles.brandLogo}
          />
          <Text style={styles.brandText}>SEMPAI</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.headerActions}>
            <View style={styles.announcementToggleWrapper}>
              <AnimatedPressable style={styles.headerAction} onPress={toggleAnnouncements} accessible accessibilityLabel="Announcements" scaleTo={0.88}>
                <FontAwesome5 name="bullhorn" size={15} color="#fff" />
                {announcements.length > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{announcements.length > 9 ? '9+' : announcements.length}</Text>
                  </View>
                )}
              </AnimatedPressable>
            </View>

            <View style={styles.notificationWrapper}>
              <AnimatedPressable style={styles.headerAction} onPress={toggleNotifications} accessible accessibilityLabel="Notifications" scaleTo={0.88}>
                <FontAwesome5 name="bell" size={15} color="#fff" />
                {unreadCount > 0 && (
                  <Animated.View style={[styles.headerBadge, { transform: [{ scale: badgePop }] }]}>
                    <Text style={styles.headerBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </Animated.View>
                )}
              </AnimatedPressable>
            </View>
          </View>

          <View style={styles.headerAuthRow}>
            {session ? (
              <AnimatedPressable style={styles.signOutBtn} onPress={() => signOut?.()} scaleTo={0.94}>
                <FontAwesome5 name="sign-out-alt" size={12} color={HOME_COLORS.accent} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </AnimatedPressable>
            ) : (
              <AnimatedPressable style={styles.headerSignInBtn} onPress={toggleAuthMenu} scaleTo={0.94}>
                <FontAwesome5 name="google" size={12} color={HOME_COLORS.accent} />
                <Text style={styles.headerSignInText}>Sign In</Text>
              </AnimatedPressable>
            )}

            <AnimatedPressable style={styles.headerWalletBtn} onPress={toggleWalletMenu} scaleTo={0.94}>
              <FontAwesome5 name="wallet" size={12} color="#fff" />
              <Text style={styles.headerWalletText}>{walletLabel}</Text>
            </AnimatedPressable>
          </View>

          <AnimatedPressable style={styles.menuButton} onPress={toggleMenu} accessible accessibilityLabel="Open menu" scaleTo={0.88}>
            <FontAwesome5 name="bars" size={16} color={colors.textPrimary} />
          </AnimatedPressable>
          <AnimatedPressable 
            style={[styles.menuButton, { marginLeft: 8 }]} 
            onPress={toggleTheme} 
            accessible 
            accessibilityLabel="Toggle theme" 
            scaleTo={0.88}
          >
            <FontAwesome5 name={isDark ? 'sun' : 'moon'} size={16} color={colors.textPrimary} />
          </AnimatedPressable>
        </View>
      </View> */}

      {/* Main content */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          scrollY.setValue(nativeEvent.contentOffset.y);
        }}
      >
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: heroParallaxOpacity,
              transform: [{ translateY: heroParallaxTranslate }],
              backgroundColor: isDark ? 'rgba(233, 69, 96, 0.16)' : 'rgba(59, 130, 246, 0.08)',
              borderBottomColor: isDark ? 'rgba(233, 69, 96, 0.3)' : 'rgba(59, 130, 246, 0.15)',
            },
          ]}
        >
          <Animated.Text
            style={[
              styles.heroEyebrow,
              { opacity: heroTextAnim, color: isDark ? colors.gold : colors.accent },
            ]}
          >
            Novels • Manga • On-chain rewards
          </Animated.Text>
          <Animated.Text
            style={[
              styles.heroTitle,
              {
                opacity: heroTextAnim,
                color: colors.textPrimary,
                transform: [{ translateY: heroTextAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
              },
            ]}
          >
            Discover Epic Stories
          </Animated.Text>
          <View style={styles.heroButtons}>
            <AnimatedPressable
              style={[styles.heroButton, { backgroundColor: colors.accent, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
              onPress={() => handleNavigation('NovelsPage', {})}
              accessible={true}
              accessibilityLabel="Explore novels"
              scaleTo={0.94}
            >
              <FontAwesome5 name="book" size={12} color="#fff" />
              <Text style={styles.heroButtonText}>Novels</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.heroButton, { backgroundColor: colors.accent, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
              onPress={() => handleNavigation('MangaPage', {})}
              accessible={true}
              accessibilityLabel="Explore manga"
              scaleTo={0.94}
            >
              <FontAwesome5 name="images" size={12} color="#fff" />
              <Text style={styles.heroButtonText}>Manga</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Novels section */}
            <View style={styles.section}>
              <SectionHeader title="Featured Novels" onSeeAll={() => handleNavigation('NovelsPage', {})} />
              {loading ? (
                <CarouselSkeleton />
              ) : novels.length === 0 ? (
                <Text style={styles.noContent}>No novels available.</Text>
              ) : (
                <FlatList
                  ref={novelFlatListRef}
                  data={novels}
                  renderItem={({ item, index }) => renderCarouselItem({ item, index, type: 'novel' })}
                  keyExtractor={item => `novel-${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={CARD_STEP}
                  decelerationRate="fast"
                  contentContainerStyle={styles.carouselContainer}
                  removeClippedSubviews={false}
                  onScrollToIndexFailed={info => console.warn('Novel scroll failed:', info)}
                />
              )}
            </View>

            {/* Manga section */}
            <View style={styles.section}>
              <SectionHeader title="Featured Manga" onSeeAll={() => handleNavigation('MangaPage', {})} />
              {loading ? (
                <CarouselSkeleton />
              ) : manga.length === 0 ? (
                <Text style={styles.noContent}>No manga available.</Text>
              ) : (
                <FlatList
                  ref={mangaFlatListRef}
                  data={manga}
                  renderItem={({ item, index }) => renderCarouselItem({ item, index, type: 'manga' })}
                  keyExtractor={item => `manga-${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={CARD_STEP}
                  decelerationRate="fast"
                  contentContainerStyle={styles.carouselContainer}
                  removeClippedSubviews={false}
                  onScrollToIndexFailed={info => console.warn('Manga scroll failed:', info)}
                />
              )}
            </View>

            {/* Features section — held back until data has settled so it
                doesn't render an empty grid with a floating header while
                loading; novels/manga above already communicate progress
                via their skeletons. */}
            {!loading && (
              <View style={styles.featuresSection}>
                <SectionHeader title="Explore More" />
                {features.length === 0 ? (
                  <Text style={styles.noContent}>No features available.</Text>
                ) : (
                  <FlatList
                    data={features}
                    renderItem={renderFeatureItem}
                    keyExtractor={item => `feature-${item.title}`}
                    numColumns={2}
                    contentContainerStyle={styles.featuresGrid}
                    scrollEnabled={false}
                  />
                )}
              </View>
            )}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 SempaiHQ. All rights reserved.</Text>
        </View>
      </ScrollView>

      {/* Sidebar */}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        {renderSidebarContent()}
      </Animated.View>

      {/* Sidebar overlay — fades with the sidebar's own slide position and
          stays mounted long enough to finish fading before it unmounts. */}
      {overlayShouldRender && (
        <Animated.View
          style={[styles.overlay, { opacity: overlayOpacity }]}
          pointerEvents={menuOpen ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={toggleMenu}
            activeOpacity={1}
            accessible={true}
            accessibilityLabel="Close menu"
          />
        </Animated.View>
      )}

      {/* Notifications dropdown */}
      {notificationsShouldRender && (
        <Animated.View
          style={[
            styles.notificationDropdown,
            {
              opacity: notificationAnim,
              transform: [{ translateY: notificationAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          {notifications.length === 0 ? (
            <Text style={styles.noNotifications}>No notifications</Text>
          ) : (
            <>
              <FlatList
                data={notifications}
                renderItem={renderNotificationItem}
                keyExtractor={item => `notification-${item.id}`}
                style={styles.notificationList}
              />
              {unreadCount > 0 && (
                <AnimatedPressable
                  style={styles.markReadButton}
                  onPress={markNotificationsRead}
                  accessible={true}
                  accessibilityLabel="Mark all notifications as read"
                >
                  <Text style={styles.markReadButtonText}>Mark All as Read</Text>
                </AnimatedPressable>
              )}
            </>
          )}
        </Animated.View>
      )}

      {/* Header Wallet dropdown (root-level for layering) */}
      {walletMenuShouldRender && (
        <Animated.View
          style={[
            styles.headerWalletDropdown,
            {
              opacity: walletMenuAnim,
              transform: [{ translateY: walletMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
        >
          {wallet?.publicKey ? (
            <>
              <AnimatedPressable style={styles.headerWalletItem} onPress={copyWalletAddress} scaleTo={0.97}>
                <FontAwesome5 name="copy" size={14} color="#fff" />
                <Text style={styles.headerWalletItemText}>Copy address</Text>
              </AnimatedPressable>
              <View style={styles.headerWalletDivider} />
              <AnimatedPressable style={styles.headerWalletItem} onPress={() => { setShowWalletMenu(false); handleNavigation('Wallet'); }} scaleTo={0.97}>
                <FontAwesome5 name="external-link-alt" size={14} color="#fff" />
                <Text style={styles.headerWalletItemText}>Open wallet</Text>
              </AnimatedPressable>
              <View style={styles.headerWalletDivider} />
              <AnimatedPressable style={styles.headerWalletItem} onPress={async () => { try { await disconnectWallet?.(); } finally { setShowWalletMenu(false); } }} scaleTo={0.97}>
                <FontAwesome5 name="unlink" size={14} color="#ff9b82" />
                <Text style={[styles.headerWalletItemText, { color: '#ff9b82' }]}>Disconnect</Text>
              </AnimatedPressable>
            </>
          ) : (
            <AnimatedPressable
              style={[styles.headerWalletItem, { justifyContent: 'center' }]}
              onPress={() => {
                setShowWalletMenu(false);
                setWalletModalMode('choose');
                setWalletPassword('');
                setWalletPassword2('');
                setWalletModalError(null);
                setShowWalletConnectModal(true);
              }}
              scaleTo={0.97}
            >
              <Text style={styles.headerWalletItemText}>Connect</Text>
            </AnimatedPressable>
          )}
        </Animated.View>
      )}

      {/* Auth dropdown */}
      {authMenuShouldRender && (
        <Animated.View
          style={[
            styles.authDropdown,
            {
              opacity: authAnim,
              transform: [{ translateY: authAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
        >
          <View style={styles.authItem}>
            <GoogleSignInButton />
          </View>
        </Animated.View>
      )}

      {/* Announcements dropdown */}
      {announcementsShouldRender && (
        <Animated.View
          style={[
            styles.announcementDropdown,
            {
              opacity: announcementAnim,
              transform: [{ translateY: announcementAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <AnimatedPressable
            style={styles.closeAnnouncementButton}
            onPress={toggleAnnouncements}
            accessible={true}
            accessibilityLabel="Close announcements"
            scaleTo={0.85}
          >
            <FontAwesome5 name="times" size={16} color="#fff" />
          </AnimatedPressable>
          {announcements.length === 0 ? (
            <Text style={styles.noAnnouncements}>No announcements</Text>
          ) : (
            <FlatList
              data={announcements}
              renderItem={renderAnnouncementItem}
              keyExtractor={item => `announcement-${item.id}`}
              style={styles.announcementCarousel}
            />
          )}
        </Animated.View>
      )}

      {/* Dashboard selection modal */}
      <Modal isVisible={showDashboardPopup} onBackdropPress={() => setShowDashboardPopup(false)} useNativeDriver>
        <View style={styles.popupContainer}>
          <Text style={styles.popupTitle}>Choose Your Dashboard</Text>
          <AnimatedPressable
            style={styles.popupButton}
            onPress={() => {
              setShowDashboardPopup(false);
              handleNavigation('NovelDashboard');
            }}
            accessible={true}
            accessibilityLabel="Open Writer's Dashboard"
          >
            <Text style={styles.popupButtonText}>Writer's Dashboard</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.popupButton}
            onPress={() => {
              setShowDashboardPopup(false);
              handleNavigation('MangaDashboard');
            }}
            accessible={true}
            accessibilityLabel="Open Artist's Dashboard"
          >
            <Text style={styles.popupButtonText}>Artist's Dashboard</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={styles.popupCancelButton}
            onPress={() => setShowDashboardPopup(false)}
            accessible={true}
            accessibilityLabel="Cancel dashboard selection"
          >
            <Text style={styles.popupCancelButtonText}>Cancel</Text>
          </AnimatedPressable>
        </View>
      </Modal>

      {/* Wallet connect modal */}
      <Modal isVisible={showWalletConnectModal} onBackdropPress={() => setShowWalletConnectModal(false)} useNativeDriver>
        <View style={styles.popupContainer}>
          {walletModalMode === 'choose' && (
            <>
              <Text style={styles.popupTitle}>Connect Wallet</Text>
              <AnimatedPressable style={styles.popupButton} onPress={() => setWalletModalMode('create')}>
                <Text style={styles.popupButtonText}>Create New Wallet</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.popupButton} onPress={() => setWalletModalMode('retrieve')}>
                <Text style={styles.popupButtonText}>Retrieve Existing Wallet</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.popupCancelButton} onPress={() => setShowWalletConnectModal(false)}>
                <Text style={styles.popupCancelButtonText}>Cancel</Text>
              </AnimatedPressable>
            </>
          )}

          {walletModalMode !== 'choose' && (
            <>
              <Text style={styles.popupTitle}>
                {walletModalMode === 'create' ? 'Create Wallet' : 'Retrieve Wallet'}
              </Text>
              {!!walletModalError && (
                <Text style={styles.headerModalError}>{walletModalError}</Text>
              )}
              <TextInput
                style={styles.headerInput}
                placeholder="Password (min 8 chars)"
                placeholderTextColor="#999"
                secureTextEntry
                value={walletPassword}
                onChangeText={setWalletPassword}
              />
              <TextInput
                style={styles.headerInput}
                placeholder={walletModalMode === 'create' ? 'Confirm Password' : 'Re-enter Password'}
                placeholderTextColor="#999"
                secureTextEntry
                value={walletPassword2}
                onChangeText={setWalletPassword2}
              />
              <AnimatedPressable
                style={styles.popupButton}
                onPress={async () => {
                  try {
                    setWalletModalError(null);
                    if (!walletPassword || walletPassword.length < 8) {
                      setWalletModalError('Password must be at least 8 characters long.');
                      return;
                    }
                    if (walletPassword !== walletPassword2) {
                      setWalletModalError('Passwords do not match.');
                      return;
                    }
                    if (walletModalMode === 'create') {
                      const res = await createEmbeddedWallet(walletPassword);
                      if (!res) throw new Error('Failed to create wallet');
                    } else {
                      const res = await retrieveEmbeddedWallet(walletPassword);
                      if (!res) throw new Error('Failed to retrieve wallet');
                    }
                    setShowWalletConnectModal(false);
                    setWalletPassword('');
                    setWalletPassword2('');
                    setWalletModalMode('choose');
                  } catch (e) {
                    setWalletModalError(e.message || 'Operation failed');
                  }
                }}
              >
                <Text style={styles.popupButtonText}>
                  {walletModalMode === 'create' ? 'Create Wallet' : 'Retrieve Wallet'}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.popupCancelButton} onPress={() => setWalletModalMode('choose')}>
                <Text style={styles.popupCancelButtonText}>Back</Text>
              </AnimatedPressable>
            </>
          )}
        </View>
      </Modal>

      {/* Cinematic card preview — sits above everything (including the
          sidebar/dropdowns) via its own zIndex. */}
      <CinematicCardOverlay
        expandedCard={expandedCard}
        progress={progress}
        kenBurns={kenBurns}
        onClose={closeCard}
        onReadNow={handleReadNow}
      />
    </View>
  );
};

export default Home;