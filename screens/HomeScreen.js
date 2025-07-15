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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Modal from 'react-native-modal';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import GoogleSignInButton from '../components/GoogleSignInButton';
import ConnectButton from '../components/ConnectButton';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import { supabase } from '../services/supabaseClient';
import { styles } from '../styles/HomeStyles';

const { width, height } = Dimensions.get('window');

const Home = () => {
  const navigation = useNavigation();
  const { wallet, isWalletConnected } = useContext(EmbeddedWalletContext);
  const { session } = useGoogleAuth();

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
  const [publicKey, setPublicKey] = useState(null);
  const [userId, setUserId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isWriter, setIsWriter] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [showDashboardPopup, setShowDashboardPopup] = useState(false);

  // Animation refs
  const slideAnim = useRef(new Animated.Value(280)).current;
  const announcementAnim = useRef(new Animated.Value(0)).current;
  const notificationAnim = useRef(new Animated.Value(0)).current;
  const heroTextAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);
  const novelFlatListRef = useRef(null);
  const mangaFlatListRef = useRef(null);
  const novelIndexRef = useRef(0);
  const mangaIndexRef = useRef(0);

  // Feature cards
  const features = [
    {
      title: 'Google Sign-In',
      image: {
        uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAEkUlEQVR4nO2Zf2hVZRjHv+fHvefes7l5N6dOmomWWmkUlpkFUWBFEKXOamlJIkGBhRWUVH9kf0gUFUhkQf4TEf2jv1KKDEK0H2qIhBpRKUUqrUzn3Nx2z7n3nNPzvu+5Z7t3Z3vP2b0jfOAL973nPe/zfp/n+zzP+7xKpZFGGv9jKACqABQDyPwvk88FsADAKwBaALwKYDKA3HQRzwLwIIBmAF8A6ADQCuBpAJUAcq5l8vkA6gC8DuBzAEcBHAKwA8BGAPcBKACgX23iGQDKATwM4CUAL30vl2ULgE8BHBH5XwHYC2ArgA0AqgEUXQ3yqpxhBYDHALwNYDeALwEcBnAcwHEAPwD4XiR0GsA5AN0AzgA4AeAQgD0A3gKwDsD9AEqvFPl0AKUAFgF4EsA2AB8B+BbALwDOAugE8CeAPgADAC4CGAQQABAEEAIQBmADcAAYAK4A6JYxfpIx35cxXwJQJ2OPm3wOgGIANQDWA3gXwD4AxwCcAtABoAfARQCXAIQAWAAsABEAUQBxADEABgBd/o8DiMm9qNwbknH6ZNw/AHwjc1kn8ysdCXkVQBGAeQAel+1xUMh0iF0YlRWLCuGokI8JcUtWW5eVjwJwA3ABMAGYQt4EYADQhHwYgE/k9QrxPgC/AfgUwCYAD8iq5owlfwaAMgDLALwG4BMAv8qqXpAJBQEMi4QiQl6XSRsioSkSsEXGhpDXJXhNSKsy6ZBsHV3I+0XePgC/A/gAwBMAFkoSjAo+Q1a7AsB6kc1PAM7LSnlFAkOyukNiHrqQsWRCpkjBFPKGEI8JaUMIx4SwJqtsy8rbstp+mVu3zPUwgJ0A1gKYMxb5XADzATwL4CMZIC4T9sjEfEI6IKsbFjKakDCEgCnELSFrC1lTyOoi0biQNoS0IaQNIW1LzgkJeY/M/RyAbQDuG4v8AgBbxVrD4qEhIR4U0mEhYQgBU0gYQsAS0paQtYSsKWR1IWwIYUMIG0LaFNKmyMiQXBQS8ufFHO8ei/wqALvFQqNCIiwS0IWEKSRMIWEJWVNImULWFLKGEDWFqClETSFqSXQyJT8ZQj4qxC8D2AlgxVjkVwPYL4NHhUhYJGAICVOImELEEjKWkLKElCWkTCFlCClDSBlCypQIZQppU0hbksDCAL4DsGwsocracy8msBfC0DRUSP9hUkbAkZS8hYQsoSUpaQMoWUIaR0IaULKV1IGULKEFKmkLYAfANg6Vjk1wE4IANFRQIRIWBJtLGEjCVkLCFlCSlTSBlCShcyhpAxhIwhZEwhYwL4GsDiscg/B+A7GcQS/7aEgCUELCFgCgFTCJhCwBQCphAwxVctAF8BqBmLfBpppJFGGhOO/wA36kJcbZkxjgAAAABJRU5ErkJggg==',
      },
      path: 'GoogleSignIn',
      requiresWallet: false,
    },
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
          .select('id, title, image, summary, user_id, tags, viewers_count');

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

        const enrichedNovels = novelsData.map(novel => {
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

        const enrichedManga = mangaData.map(manga => {
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

  // Toggle sidebar
  const toggleMenu = () => {
    Animated.timing(slideAnim, {
      toValue: menuOpen ? 280 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setMenuOpen(!menuOpen);
  };

  // Toggle announcements dropdown
  const toggleAnnouncements = () => {
    Animated.timing(announcementAnim, {
      toValue: showAnnouncements ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowAnnouncements(!showAnnouncements);
  };

  // Toggle notifications dropdown
  const toggleNotifications = () => {
    Animated.timing(notificationAnim, {
      toValue: showNotifications ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setShowNotifications(!showNotifications);
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

  // Auto-scroll novels
  useEffect(() => {
    if (novels.length <= 1) return;
    const interval = setInterval(() => {
      let nextIndex = novelIndexRef.current + 1;
      if (nextIndex >= novels.length) nextIndex = 0;
      novelFlatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      novelIndexRef.current = nextIndex;
    }, 2500);
    return () => clearInterval(interval);
  }, [novels.length]);

  // Auto-scroll manga
  useEffect(() => {
    if (manga.length <= 1) return;
    const interval = setInterval(() => {
      let nextIndex = mangaIndexRef.current + 1;
      if (nextIndex >= manga.length) nextIndex = 0;
      mangaFlatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      mangaIndexRef.current = nextIndex;
    }, 2500);
    return () => clearInterval(interval);
  }, [manga.length]);

  // Render novel/manga carousel item
  const renderCarouselItem = ({ item, type }) => {
    console.log(`Rendering ${type}:`, { id: item.id, title: item.title });
    if (!item.id) {
      console.warn(`Missing ID for ${type}: ${item.title}`);
      return null;
    }
    return (
      <View style={styles.contentCard}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            console.log(`Navigating to ${type} with ID: ${item.id}`);
            try {
              navigation.navigate(type === 'novel' ? 'NovelDetail' : 'MangaDetail', { id: item.id });
            } catch (error) {
              console.error(`Failed to navigate to ${type} ID ${item.id}: ${error.message}`);
              Alert.alert('Navigation Error', 'Unable to view this item. Please try again.');
            }
          }}
          accessible={true}
          accessibilityLabel={`View ${item.title}`}
          accessibilityHint={`Navigate to ${type} details`}
        >
          <Image
            source={{ uri: item.image || 'https://via.placeholder.com/260x200' }}
            style={styles.contentImage}
            defaultSource={{ uri: 'https://via.placeholder.com/260x200' }}
          />
          <View style={styles.contentOverlay}>
            <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.contentSummary} numberOfLines={2}>{item.summary || 'No summary available.'}</Text>
            {item.isAdult && <Text style={styles.adultWarning}>Adult(18+)</Text>}
            <View style={styles.contentStats}>
              <Text style={styles.viewers}>
                <FontAwesome5 name="eye" size={14} color="#fff" /> {item.viewers}
              </Text>
              <Text style={styles.rating}>
                <FontAwesome5 name="star" size={14} color="#ffd700" /> {item.averageRating}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        {(type === 'novel' ? item.writer?.isWriter : item.writer?.isArtist) && item.writer?.name !== 'Unknown' && (
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.writerName}
            onPress={() => {
              if (item.user_id) {
                console.log(`Navigating to CreatorsProfile with ID: ${item.user_id}`);
                navigation.navigate('CreatorsProfile', { id: item.user_id });
              } else {
                console.warn(`Missing user_id for ${type}: ${item.title}`);
              }
            }}
            accessible={true}
            accessibilityLabel={`View profile of ${item.writer.name}`}
            accessibilityHint={`Navigate to ${type === 'novel' ? 'writer' : 'artist'} profile`}
          >
            <FontAwesome5 name="feather-alt" size={14} color="#fff" style={styles.writerIcon} />
            <Text style={styles.writerNameText}>{item.writer.name}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render announcement item
  const renderAnnouncementItem = ({ item }) => (
    <View style={styles.announcementCard}>
      <Text style={styles.announcementTitle}>{item.title}</Text>
      <Text style={styles.announcementMessage} numberOfLines={3}>{item.message}</Text>
      <View style={styles.announcementDetails}>
        {item.novels && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              console.log(`Navigating to Novel with ID: ${item.novels.id}`);
              navigation.navigate('NovelDetail', { id: item.novels.id });
            }}
          >
            <Text style={styles.announcementLink}>{item.novels.title}</Text>
          </TouchableOpacity>
        )}
        {item.users?.wallet_address && (
          <Text style={styles.announcementAuthor}>By: {item.users.wallet_address.slice(0, 6)}...</Text>
        )}
        <Text style={styles.announcementDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </View>
    </View>
  );

  // Render notification item
  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.notificationItem}
      onPress={() => {
        if (item.novel_id) {
          console.log(`Navigating to Novel with ID: ${item.novel_id}`);
          navigation.navigate('NovelDetail', { id: item.novel_id });
        }
      }}
      accessible={true}
      accessibilityLabel={item.message}
      accessibilityHint="View notification details"
    >
      <Text style={styles.notificationMessage}>{item.message}</Text>
      <Text style={styles.notificationDetails}>
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
            console.log(`Navigating to ${item.path}`);
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
          <View style={styles.featureOverlay}>
            <Text style={styles.featureTitle} numberOfLines={1}>{item.title}</Text>
            {item.requiresWallet && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Update the sidebar rendering part of the Home component

  // In the Home component, replace the sidebar rendering with this
  const renderSidebarContent = () => {
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
          {[
            { path: 'Home', icon: 'home', label: 'Home' },
            { path: 'Wallet', icon: 'wallet', label: 'Wallet' },
            { path: 'Swap', icon: 'exchange-alt', label: 'Swap' },
            { path: 'StatPage', icon: 'chart-bar', label: 'Stats' },
            {
              path: '',
              icon: 'user',
              label: isWriter || isArtist || isSuperuser ? 'Profile' : 'Edit Profile',
              onPress: handleProfileNavigation,
            },
            { path: 'Chat', icon: 'comments', label: 'Chat' },
            { path: 'KaitoAdventure', icon: 'gamepad', label: "Kaito's Adventure" },
            { path: 'WalletImport', icon: 'wallet', label: 'Import Wallet' },
            {
              path: '',
              icon: 'bullhorn',
              label: isWriter && !isArtist ? "Writer's Dashboard" : isArtist && !isWriter ? "Artist's Dashboard" : 'Creator Dashboard',
              onPress: handleDashboardNavigation,
            },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              style={styles.navLink}
              onPress={item.onPress || (() => handleNavigation(item.path))}
              accessible={true}
              accessibilityLabel={item.label}
            >
              <FontAwesome5 name={item.icon} size={16} color="#FF5733" style={styles.navIcon} />
              <Text style={styles.navLinkText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          
          {/* Add some bottom padding for better scrolling */}
          <View style={{ height: 10 }} />
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleMenu} style={styles.menuButton} accessible={true} accessibilityLabel="Open menu">
          <FontAwesome5 name="bars" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <GoogleSignInButton />
          {session && <ConnectButton email={session?.user?.email} userId={session?.user?.id} />}
        </View>
      </View>

      {/* Background animations */}
      <View style={[styles.backgroundAnimation, { zIndex: -1, pointerEvents: 'none' }]}>
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.8)', 'rgba(243, 99, 22, 0.3)']}
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
            colors={['rgba(243, 99, 22, 0.4)', 'transparent']}
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

      {/* Logo Section */}

      <View style={styles.logoContainer}>
        <Image
          source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
          style={styles.logoImage}
          defaultSource={{ uri: 'https://via.placeholder.com/40x40' }}
        />
        <Text style={styles.logoText}>SempaiHQ</Text>
      </View>

      {/* Main content */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.heroSection}>
          <Animated.Text
            style={[
              styles.heroTitle,
              {
                opacity: heroTextAnim,
                transform: [{ translateY: heroTextAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
              },
            ]}
          >
            Discover Epic Stories
          </Animated.Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.heroButton}
              onPress={() => handleNavigation('NovelsPage', {})}
              accessible={true}
              accessibilityLabel="Explore novels"
            >
              <Text style={styles.heroButtonText}>Novels</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.heroButton}
              onPress={() => handleNavigation('MangaPage', {})}
              accessible={true}
              accessibilityLabel="Explore manga"
            >
              <Text style={styles.heroButtonText}>Manga</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF5733" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Novels section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Featured Novels</Text>
              {novels.length === 0 ? (
                <Text style={styles.noContent}>No novels available.</Text>
              ) : (
                <FlatList
                  ref={novelFlatListRef}
                  data={novels}
                  renderItem={({ item }) => renderCarouselItem({ item, type: 'novel' })}
                  keyExtractor={item => `novel-${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={276}
                  decelerationRate="fast"
                  contentContainerStyle={styles.carouselContainer}
                  removeClippedSubviews={false}
                  onScrollToIndexFailed={info => console.warn('Novel scroll failed:', info)}
                />
              )}
            </View>

            {/* Manga section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Featured Manga</Text>
              {manga.length === 0 ? (
                <Text style={styles.noContent}>No manga available.</Text>
              ) : (
                <FlatList
                  ref={mangaFlatListRef}
                  data={manga}
                  renderItem={({ item }) => renderCarouselItem({ item, type: 'manga' })}
                  keyExtractor={item => `manga-${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={276}
                  decelerationRate="fast"
                  contentContainerStyle={styles.carouselContainer}
                  removeClippedSubviews={false}
                  onScrollToIndexFailed={info => console.warn('Manga scroll failed:', info)}
                />
              )}
            </View>

            {/* Features section */}
            <View style={styles.featuresSection}>
              <Text style={styles.sectionTitle}>Explore More</Text>
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

      {/* Sidebar overlay */}
      {menuOpen && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={toggleMenu}
          activeOpacity={0.7}
          accessible={true}
          accessibilityLabel="Close menu"
        />
      )}

      {/* Notifications dropdown */}
      {showNotifications && (
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
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.markReadButton}
                  onPress={markNotificationsRead}
                  accessible={true}
                  accessibilityLabel="Mark all notifications as read"
                >
                  <Text style={styles.markReadButtonText}>Mark All as Read</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </Animated.View>
      )}

      {/* Announcements dropdown */}
      {showAnnouncements && (
        <Animated.View
          style={[
            styles.announcementDropdown,
            {
              opacity: announcementAnim,
              transform: [{ translateY: announcementAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.closeAnnouncementButton}
            onPress={toggleAnnouncements}
            accessible={true}
            accessibilityLabel="Close announcements"
          >
            <FontAwesome5 name="times" size={20} color="#fff" />
          </TouchableOpacity>
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
      <Modal isVisible={showDashboardPopup} onBackdropPress={() => setShowDashboardPopup(false)}>
        <View style={styles.popupContainer}>
          <Text style={styles.popupTitle}>Choose Your Dashboard</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.popupButton}
            onPress={() => {
              setShowDashboardPopup(false);
              handleNavigation('NovelDashboard');
            }}
            accessible={true}
            accessibilityLabel="Open Writer's Dashboard"
          >
            <Text style={styles.popupButtonText}>Writer's Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.popupButton}
            onPress={() => {
              setShowDashboardPopup(false);
              handleNavigation('MangaDashboard');
            }}
            accessible={true}
            accessibilityLabel="Open Artist's Dashboard"
          >
            <Text style={styles.popupButtonText}>Artist's Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.popupCancelButton}
            onPress={() => setShowDashboardPopup(false)}
            accessible={true}
            accessibilityLabel="Cancel dashboard selection"
          >
            <Text style={styles.popupCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Bottom navbar */}
      <View style={styles.bottomNavbar}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.bottomNavButton}
          onPress={toggleMenu}
          accessible={true}
          accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <FontAwesome5 name={menuOpen ? 'times' : 'bars'} size={width < 480 ? 24 : 28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.notificationWrapper}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.bottomNavButton}
            onPress={toggleNotifications}
            accessible={true}
            accessibilityLabel="View notifications"
          >
            <FontAwesome5 name="envelope" size={width < 480 ? 24 : 28} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.announcementToggleWrapper}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.bottomNavButton}
            onPress={toggleAnnouncements}
            accessible={true}
            accessibilityLabel="View announcements"
          >
            <FontAwesome5 name="bell" size={width < 480 ? 24 : 28} color="#fff" />
            {announcements.length > 0 && (
              <View style={styles.announcementBadge}>
                <Text style={styles.badgeText}>{announcements.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Home;