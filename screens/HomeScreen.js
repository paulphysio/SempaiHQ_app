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
  Text
} from 'react-native';
// import { Text } from '../components/Text';
// import { Text } from '../App'; // Adjust path
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Modal from 'react-native-modal';
import { EmbeddedWalletContext } from '../components/ConnectButton';
import GoogleSignInButton from '../components/GoogleSignInButton';
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
  const rotateAnim = useRef(new Animated.Value(0)).current;
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
      path: 'Novels',
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
  }, [waveAnim, pulseAnim]);

  // Hero and feature animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroTextAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      ...features.map((_, index) =>
        Animated.timing(fadeAnims[index], {
          toValue: 1,
          duration: 500,
          delay: index * 150,
          useNativeDriver: true,
        })
      ),
    ]).start();
  }, [heroTextAnim, fadeAnims]);

  // Sync wallet and fetch user ID/roles
  useEffect(() => {
    const syncWallet = async () => {
      try {
        if (wallet?.publicKey && isWalletConnected) {
          console.log('Wallet publicKey:', wallet.publicKey);
          setPublicKey(wallet.publicKey);
          await AsyncStorage.setItem('walletAddress', wallet.publicKey);

          const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, isWriter, isArtist, isSuperuser')
            .eq('wallet_address', wallet.publicKey)
            .single();

          if (userError) {
            if (userError.code === 'PGRST116') {
              console.log('No user found, creating new user...');
              const newReferralCode = `${wallet.publicKey.slice(0, 4)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
              const userData = {
                name: 'DefaultUser',
                wallet_address: wallet.publicKey,
                isWriter: false,
                isArtist: false,
                isSuperuser: false,
                referral_code: newReferralCode,
                has_updated_profile: false,
              };
              const { data: newUser, error: upsertError } = await supabase
                .from('users')
                .upsert(userData, { onConflict: 'wallet_address' })
                .select('id, isWriter, isArtist, isSuperuser')
                .single();

              if (upsertError) throw new Error(`Failed to create or update user: ${upsertError.message}`);
              console.log('New user created or updated:', newUser);
              setUserId(newUser.id);
              setIsWriter(newUser.isWriter || false);
              setIsArtist(newUser.isArtist || false);
              setIsSuperuser(newUser.isSuperuser || false);
            } else {
              throw new Error(`User fetch error: ${userError.message}`);
            }
          } else if (user && isMounted.current) {
            console.log('User fetched:', { id: user.id, isWriter: user.isWriter, isArtist: user.isArtist });
            setUserId(user.id);
            setIsWriter(user.isWriter || false);
            setIsArtist(user.isArtist || false);
            setIsSuperuser(user.isSuperuser || false);
          }
        } else {
          const key = await AsyncStorage.getItem('walletAddress');
          if (key && isMounted.current) {
            console.log('AsyncStorage walletAddress:', key);
            setPublicKey(key);

            const { data: user, error: userError } = await supabase
              .from('users')
              .select('id, isWriter, isArtist, isSuperuser')
              .eq('wallet_address', key)
              .single();

            if (userError) {
              if (userError.code === 'PGRST116') {
                console.log('No user found for wallet, skipping...');
                setPublicKey(null);
                setUserId(null);
              } else {
                throw new Error(`User fetch error: ${userError.message}`);
              }
            } else if (user && isMounted.current) {
              console.log('User fetched:', { id: user.id, isWriter: user.isWriter, isArtist: user.isArtist });
              setUserId(user.id);
              setIsWriter(user.isWriter || false);
              setIsArtist(user.isArtist || false);
              setIsSuperuser(user.isSuperuser || false);
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
        setError('Failed to sync wallet');
      }
    };
    syncWallet();
  }, [wallet, isWalletConnected]);

  // Fetch announcements
  useEffect(() => {
    if (!publicKey || !userId) {
      console.log('No userId or publicKey, skipping announcements fetch');
      return;
    }

    const fetchAnnouncements = async () => {
      try {
        let novelIds = [];
        let isWriter = false;
        let isArtist = false;

        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, isWriter, isArtist')
          .eq('wallet_address', publicKey)
          .single();

        if (userError) throw new Error(`User fetch error: ${userError.message}`);
        if (user) {
          isWriter = user.isWriter;
          isArtist = user.isArtist;

          const { data: interactions, error: interactionsError } = await supabase
            .from('novel_interactions')
            .select('novel_id')
            .eq('user_id', user.id);

          if (interactionsError) throw new Error(`Interactions fetch error: ${interactionsError.message}`);
          novelIds = interactions.map(i => i.novel_id);
        }

        let writerQuery = supabase
          .from('writer_announcements')
          .select(`
            id, title, message, created_at, release_date,
            novels (id, title),
            users!writer_id (id, wallet_address)
          `)
          .order('created_at', { ascending: false });

        if (novelIds.length > 0) {
          writerQuery = writerQuery.in('novel_id', novelIds);
        }

        const { data: writerAnnouncements, error: writerError } = await writerQuery;
        if (writerError) throw new Error(`Writer announcements fetch error: ${writerError.message}`);

        const { data: generalAnnouncements, error: announcementsError } = await supabase
          .from('announcements')
          .select(`
            id, title, message, created_at, release_date, audience,
            users!user_id (id, wallet_address)
          `)
          .order('created_at', { ascending: false });

        if (announcementsError) throw new Error(`General announcements fetch error: ${announcementsError.message}`);

        const filteredGeneralAnnouncements = generalAnnouncements.filter(ann => {
          if (ann.audience === 'creators') {
            return isWriter || isArtist;
          }
          return true;
        });

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
  }, [publicKey, userId]);

  // Fetch notifications
  useEffect(() => {
    if (!publicKey || !userId) {
      console.log('No userId or publicKey, skipping notifications fetch');
      return;
    }

    const fetchNotifications = async () => {
      try {
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifications')
          .select('id, novel_id, message, novel_title, is_read, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (notificationsError) throw new Error(`Notifications fetch error: ${notificationsError.message}`);

        if (isMounted.current) {
          setNotifications(notificationsData || []);
          setUnreadCount(notificationsData ? notificationsData.filter(n => !n.is_read).length : 0);
        }
      } catch (err) {
        console.error('fetchNotifications error:', err.message);
        if (isMounted.current) {
          setError(err.message);
        }
      }
    };
    fetchNotifications();
  }, [publicKey, userId]);

  // Fetch novels
  useEffect(() => {
    const fetchNovel = async () => {
      setLoading(true);
      try {
        const { data: novelsData, error } = await supabase
          .from('novels')
          .select('id, title, image, summary, user_id, tags, viewers_count');

        if (error) throw new Error(`Novels fetch error: ${error.message}`);

        const userIds = novelsData.map(novel => novel.user_id).filter(id => id);
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, isWriter')
          .in('id', userIds);

        if (usersError) throw new Error(`Users fetch error: ${usersError.message}`);

        const usersMap = usersData.reduce((acc, user) => {
          acc[user.id] = { name: user.name || 'Unknown', isWriter: user.isWriter || false };
          return acc;
        }, {});

        const { data: ratingsData, error: ratingsError } = await supabase
          .from('chapter_ratings')
          .select('content_id, rating')
          .eq('content_type', 'novel');

        if (ratingsError) throw new Error(`Ratings fetch error: ${ratingsError.message}`);

        const ratingsMap = ratingsData.reduce((acc, rating) => {
          if (!acc[rating.content_id]) acc[rating.content_id] = [];
          acc[rating.content_id].push(rating.rating);
          return acc;
        }, {});

        const enrichedNovels = novelsData.map(novel => {
          const ratings = ratingsMap[novel.id] || [];
          const averageRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
          return {
            ...novel,
            writer: usersMap[novel.user_id] || { name: 'Unknown', isWriter: false },
            viewers: novel.viewers_count || 0,
            averageRating: averageRating.toFixed(2),
            isAdult: novel.tags && novel.tags.includes('Adult(18+)'),
          };
        });

        const sortedNovels = enrichedNovels
          .sort((a, b) => b.viewers - a.viewers)
          .slice(0, 6);

        if (isMounted.current) {
          setNovels(sortedNovels);
        }
      } catch (err) {
        console.error('fetchNovels error:', err.message);
        if (isMounted.current) {
          setError(err.message);
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

        if (error) throw new Error(`Manga fetch error: ${error.message}`);
        if (!mangaData || mangaData.length === 0) {
          console.log('No manga data found');
          setManga([]);
          return;
        }

        const userIds = mangaData.map(manga => manga.user_id).filter(id => id);
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, isArtist')
          .in('id', userIds);

        if (usersError) throw new Error(`Users fetch error: ${usersError.message}`);

        const usersMap = usersData.reduce((acc, user) => {
          acc[user.id] = { name: user.name || 'Unknown', isArtist: user.isArtist || false };
          return acc;
        }, {});

        const { data: interactionsData, error: interactionsError } = await supabase
          .from('manga_interactions')
          .select('manga_id, user_id');

        if (interactionsError) throw new Error(`Interactions fetch error: ${interactionsError.message}`);

        const viewerCounts = interactionsData.reduce((acc, interaction) => {
          if (!acc[interaction.manga_id]) acc[interaction.manga_id] = new Set();
          acc[interaction.manga_id].add(interaction.user_id);
          return acc;
        }, {});

        const { data: ratingsData, error: ratingsError } = await supabase
          .from('chapter_ratings')
          .select('content_id, rating')
          .eq('content_type', 'manga');

        if (ratingsError) throw new Error(`Ratings fetch error: ${ratingsError.message}`);

        const ratingsMap = ratingsData.reduce((acc, rating) => {
          if (!acc[rating.content_id]) acc[rating.content_id] = [];
          acc[rating.content_id].push(rating.rating);
          return acc;
        }, {});

        const enrichedManga = mangaData.map(manga => {
          const ratings = ratingsMap[manga.id] || [];
          const averageRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
          const uniqueViewers = viewerCounts[manga.id] ? viewerCounts[manga.id].size : 0;
          return {
            ...manga,
            image: manga.cover_image,
            writer: usersMap[manga.user_id] || { name: 'Unknown', isArtist: false },
            viewers: manga.viewers_count || uniqueViewers || 0,
            averageRating: averageRating.toFixed(1),
            isAdult: manga.tags && manga.tags.includes('Adult(18+)'),
          };
        });

        if (isMounted.current) {
          setManga(enrichedManga);
          console.log('Enriched Manga:', enrichedManga.map(m => ({
            title: m.title,
            writerName: m.writer.name,
            isArtist: m.writer.isArtist,
            user_id: m.user_id,
          })));
        }
      } catch (err) {
        console.error('fetchManga error:', err.message);
        if (isMounted.current) {
          setError(err.message);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Toggle sidebar
  const toggleMenu = () => {
    const toValue = menuOpen ? 280 : 0;
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setMenuOpen(!menuOpen);
  };

  // Toggle announcements dropdown
  const toggleAnnouncements = () => {
    const toValue = showAnnouncements ? 0 : 1;
    Animated.timing(announcementAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    if (isMounted.current) {
      setShowAnnouncements(!showAnnouncements);
    }
  };

  // Toggle notifications dropdown
  const toggleNotifications = () => {
    const toValue = showNotifications ? 0 : 1;
    Animated.timing(notificationAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    if (isMounted.current) {
      setShowNotifications(!showNotifications);
    }
  };

  // Mark notifications as read
  const markNotificationsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .in('id', notifications.filter(n => !n.is_read).map(n => n.id));

      if (error) throw error;
      if (isMounted.current) {
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('markNotificationsRead error:', err.message);
      setError(err.message);
    }
  };

  // Navigation handler
  const handleNavigation = (path, params = {}) => {
    toggleMenu();
    navigation.navigate(path, params);
  };

  // Profile/Edit Profile navigation with wallet check
  const handleProfileNavigation = () => {
    if (!isWalletConnected || !userId) {
      Alert.alert('Wallet Required', 'Please connect your wallet to view or edit your profile.', [
        { text: 'OK', onPress: () => {} },
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
      if (novelFlatListRef.current) {
        novelFlatListRef.current.scrollToIndex({ index: nextIndex, animated: true });
      }
      novelIndexRef.current = nextIndex;
    }, 2500);
    return () => clearInterval(interval);
  }, [novels]);

  // Auto-scroll manga
  useEffect(() => {
    if (manga.length <= 1) return;
    const interval = setInterval(() => {
      let nextIndex = mangaIndexRef.current + 1;
      if (nextIndex >= manga.length) nextIndex = 0;
      if (mangaFlatListRef.current) {
        mangaFlatListRef.current.scrollToIndex({ index: nextIndex, animated: true });
      }
      mangaIndexRef.current = nextIndex;
    }, 2500);
    return () => clearInterval(interval);
  }, [manga]);

  // Render novel/manga carousel item
  const renderCarouselItem = ({ item, type }) => {
    console.log(`Rendering ${type}:`, {
      title: item.title,
      writerName: item.writer?.name || 'Unknown',
      isArtist: item.writer?.isArtist || false,
      isWriter: item.writer?.isWriter || false,
      userId: item.user_id,
    });
    return (
      <View style={styles.contentCard}>
        <TouchableOpacity
          onPress={() => navigation.navigate(type === 'novel' ? 'Novel' : 'MangaDetail', { id: item.id })}
          accessibilityLabel={`View ${item.title}`}
          accessible={true}
          accessibilityHint={`Navigate to ${type} details`}
        >
          <Image
            source={{ uri: item.image || 'https://via.placeholder.com/260x200' }}
            style={styles.contentImage}
            defaultSource={{ uri: 'https://via.placeholder.com/260x200' }}
          />
          <View style={styles.contentOverlay}>
            <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.contentSummary} numberOfLines={2}>
              {item.summary || 'No summary available.'}
            </Text>
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
            style={styles.writerName}
            onPress={() => item.user_id && navigation.navigate('CreatorsProfile', { id: item.user_id })}
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
          <TouchableOpacity onPress={() => navigation.navigate('Novel', { id: item.novels.id })}>
            <Text style={styles.announcementLink}>{item.novels.title}</Text>
          </TouchableOpacity>
        )}
        {item.users && (
          <Text style={styles.announcementAuthor}>
            By {item.users.wallet_address.slice(0, 6)}...
          </Text>
        )}
        <Text style={styles.announcementDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  // Render notification item
  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.notificationItem}
      onPress={() => item.novel_id && navigation.navigate('Novel', { id: item.novel_id })}
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
            style={styles.featureImage}
            defaultSource={{ uri: 'https://via.placeholder.com/300x150' }}
            onError={(e) => console.error(`Image error for ${item.title}:`, e.nativeEvent.error)}
          />
          <View style={styles.featureOverlay}>
            <Text style={styles.featureTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.requiresWallet && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}></Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
          <FontAwesome5 name="bars" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <GoogleSignInButton />
        </View>
      </View>

      {/* Background animations */}
      <View style={styles.backgroundAnimation}>
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
                {
                  rotate: waveAnim.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
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
              opacity: pulseAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 0.6, 0.3],
              }),
              transform: [
                {
                  scale: pulseAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1.1, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.circle1} />
          <View style={styles.circle2} />
          <View style={styles.circle3} />
        </Animated.View>
      </View>

      {/* Logo */}
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
      >
        <View style={styles.heroSection}>
          <Animated.Text
            style={[
              styles.heroTitle,
              {
                opacity: heroTextAnim,
                transform: [
                  {
                    translateY: heroTextAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            Discover Epic Stories
          </Animated.Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => handleNavigation('Novels')}
              accessible={true}
              accessibilityLabel="Explore novels"
            >
              <Text style={styles.heroButtonText}>Novels</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => handleNavigation('Manga')}
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
                  onScrollToIndexFailed={() => {}}
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
                  onScrollToIndexFailed={() => {}}
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
      <Animated.View 
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={styles.sidebarContent}>
          {[
            { path: 'Home', icon: 'home', label: 'Home' },
            { path: 'Swap', icon: 'exchange-alt', label: 'Swap' },
            { path: 'StatPage', icon: 'chart-bar', label: 'Stats' },
            {
              path: isWriter || isArtist || isSuperuser ? 'CreatorsProfile' : 'EditProfile',
              icon: 'user',
              label: isWriter || isArtist || isSuperuser ? 'Profile' : 'Edit Profile',
              onPress: handleProfileNavigation,
            },
            { path: 'Chat', icon: 'comments', label: 'Chat' },
            { path: 'KaitoAdventure', icon: 'gamepad', label: "Kaito's Adventure" },
            { path: 'WalletImport', icon: 'wallet', label: 'Import Wallet' },
            {
              path: isWriter && !isArtist ? 'NovelDashboard' : isArtist && !isWriter ? 'MangaDashboard' : '',
              icon: 'bullhorn',
              label: isWriter && !isArtist ? "Writer's Dashboard" : isArtist && !isWriter ? "Artist's Dashboard" : 'Creator Dashboard',
              onPress: handleDashboardNavigation,
            },
          ].map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.navLink}
              onPress={item.onPress || (() => handleNavigation(item.path))}
              accessible={true}
              accessibilityLabel={item.label}
            >
              <FontAwesome5 name={item.icon} size={16} color="#fff" style={styles.navIcon} />
              <Text style={styles.navLinkText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          <GoogleSignInButton />
        </View>
      </Animated.View>

      {/* Sidebar overlay */}
      {menuOpen && (
        <TouchableOpacity 
          style={styles.overlay} 
          onPress={toggleMenu} 
          activeOpacity={1} 
        />
      )}

      {/* Notifications dropdown */}
      {showNotifications && (
        <Animated.View
          style={[
            styles.notificationDropdown,
            {
              opacity: notificationAnim,
              transform: [
                {
                  translateY: notificationAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
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
              transform: [
                {
                  translateY: announcementAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
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
      <Modal
        isVisible={showDashboardPopup}
        onBackdropPress={() => setShowDashboardPopup(false)}
        style={styles.popupModal}
      >
        <View style={styles.popupContainer}>
          <Text style={styles.popupTitle}>Choose Your Dashboard</Text>
          <TouchableOpacity
            style={styles.popupButton}
            onPress={() => {
              setShowDashboardPopup(false);
              handleNavigation('NovelDashboard');
            }}
          >
            <Text style={styles.popupButtonText}>Writer's Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.popupButton}
            onPress={() => {
              setShowDashboardPopup(false);
              handleNavigation('MangaDashboard');
            }}
          >
            <Text style={styles.popupButtonText}>Artist's Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.popupCancelButton}
            onPress={() => setShowDashboardPopup(false)}
          >
            <Text style={styles.popupCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Bottom navbar */}
      <View style={styles.bottomNavbar}>
        <TouchableOpacity
          style={styles.bottomNavButton}
          onPress={toggleMenu}
          accessible={true}
          accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }),
                },
              ],
            }}
          >
            <FontAwesome5
              name={menuOpen ? 'times' : 'bars'}
              size={width < 480 ? 24 : 28}
              color="#fff"
            />
          </Animated.View>
        </TouchableOpacity>
        <View style={styles.notificationWrapper}>
          <TouchableOpacity
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