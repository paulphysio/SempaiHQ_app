import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';

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
};

const styles = StyleSheet.create({
  container: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: height * 0.5,
  },
  loadingText: {
    color: KA_COLORS.ivory,
    marginTop: 16,
    fontSize: 16,
    letterSpacing: 2,
  },
  connectPrompt: {
    alignItems: 'center',
    padding: 40,
  },
  promptIcon: {
    marginBottom: 20,
  },
  promptText: {
    color: KA_COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 24,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: KA_COLORS.orangePrimary,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  content: {
    gap: 24,
  },
  title: {
    color: KA_COLORS.ivory,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 3,
    textShadowColor: KA_COLORS.orangePrimary,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginBottom: 8,
  },
  subtitle: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: KA_COLORS.orangePrimary,
  },
  cardCorner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: KA_COLORS.orangeDim,
    borderStyle: 'solid',
    opacity: 0.5,
  },
  cardCornerTL: { top: 8, left: 8, borderWidth: 2, borderBottomWidth: 0, borderRightWidth: 0 },
  cardCornerTR: { top: 8, right: 8, borderWidth: 2, borderBottomWidth: 0, borderLeftWidth: 0 },
  cardCornerBL: { bottom: 8, left: 8, borderWidth: 2, borderTopWidth: 0, borderRightWidth: 0 },
  cardCornerBR: { bottom: 8, right: 8, borderWidth: 2, borderTopWidth: 0, borderLeftWidth: 0 },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarFrame: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: KA_COLORS.orangeDim,
    marginBottom: 16,
    shadowColor: KA_COLORS.orangePrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 37,
  },
  profileName: {
    color: KA_COLORS.ivory,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    textShadowColor: KA_COLORS.orangePrimary,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  benefactorBadge: {
    width: 28,
    height: 28,
    marginLeft: 10,
  },
  bio: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: KA_COLORS.border,
  },
  dividerText: {
    color: KA_COLORS.textMuted,
    fontSize: 12,
    marginHorizontal: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  socials: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  socialText: {
    color: KA_COLORS.ivory,
    fontSize: 13,
    marginLeft: 8,
    letterSpacing: 1,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  walletText: {
    color: KA_COLORS.gold,
    fontSize: 13,
    marginLeft: 8,
    letterSpacing: 1,
  },
  sectionTitle: {
    color: KA_COLORS.ivory,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 16,
    textShadowColor: KA_COLORS.orangePrimary,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  novelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  novelCard: {
    width: (width - 52) / 2,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  novelImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  novelContent: {
    padding: 12,
  },
  novelTitle: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  novelSummary: {
    color: KA_COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  placeholder: {
    color: KA_COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: KA_COLORS.orangePrimary,
    borderWidth: 1,
    borderColor: KA_COLORS.orangeBright,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: KA_COLORS.orangePrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginLeft: 8,
  },
});

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params || {};
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();

  const [creatorData, setCreatorData] = useState(null);
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isWriter, setIsWriter] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isBenefactor, setIsBenefactor] = useState(false);
  const [benefactorLevel, setBenefactorLevel] = useState(null);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const emberAnims = useRef([]);

  // Initialize ember particles
  useEffect(() => {
    const embers = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 4,
    }));
    emberAnims.current = embers.map(() => new Animated.Value(0));
    
    // Animate embers
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

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const fetchProfileDetails = async () => {
      const targetUserId = userId || (activeWalletAddress ? await getUserIdByWallet(activeWalletAddress) : null);
      
      if (!targetUserId) {
        if (!isWalletConnected) {
          setLoading(false);
          return;
        }
        setError('No user ID provided. Please connect your wallet or navigate with a user ID.');
        setLoading(false);
        return;
      }

      try {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, isWriter, isArtist, isSuperuser, name, wallet_address, image, is_benefactor, benefactor_level')
          .eq('id', targetUserId)
          .single();

        if (userError || !user) throw new Error('User not found');
        
        setIsWriter(user.isWriter || false);
        setIsArtist(user.isArtist || false);
        setIsSuperuser(user.isSuperuser || false);
        setIsBenefactor(user.is_benefactor || false);
        setBenefactorLevel(user.benefactor_level || null);

        if (activeWalletAddress === user.wallet_address) {
          setIsOwnProfile(true);
        }

        const { data: profile } = await supabase
          .from('writer_profiles')
          .select('bio, twitter, discord, website')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: novelsData } = await supabase
          .from('novels')
          .select('id, title, image, summary')
          .eq('user_id', user.id)
          .eq('is_visible', true);

        setCreatorData({ ...user, ...profile });
        setNovels(novelsData || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const getUserIdByWallet = async (walletAddress) => {
      try {
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', walletAddress)
          .single();
        return data?.id;
      } catch {
        return null;
      }
    };

    if (isWalletConnected || userId) {
      fetchProfileDetails();
    } else {
      setLoading(false);
    }
  }, [isWalletConnected, activeWalletAddress, userId]);

  const getBenefactorBadgeImage = () => {
    if (!isBenefactor) return null;
    const level = benefactorLevel?.toLowerCase();
    if (level === 'gold') return require('../assets/plan-image/Gold.png');
    if (level === 'silver') return require('../assets/plan-image/Sliver.png');
    if (level === 'blue') return require('../assets/plan-image/Blue.png');
    return require('../assets/plan-image/Black.png');
  };

  const getDashboardButtonProps = () => {
    if (isSuperuser || (isWriter && isArtist)) {
      return { text: 'Dashboard', action: () => Alert.alert('Choose Dashboard', '', [
        { text: 'Novel', onPress: () => navigation.navigate('NovelDashboard') },
        { text: 'Manga', onPress: () => navigation.navigate('MangaDashboard') },
        { text: 'Cancel', style: 'cancel' }
      ])};
    } else if (isWriter) {
      return { text: 'Novel Dashboard', action: () => navigation.navigate('NovelDashboard') };
    } else if (isArtist) {
      return { text: 'Manga Dashboard', action: () => navigation.navigate('MangaDashboard') };
    }
    return { text: 'Apply', action: () => navigation.navigate('Apply') };
  };

  const dashboardButton = getDashboardButtonProps();

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={KA_COLORS.orangePrimary} />
          <Text style={styles.loadingText}>LOADING...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!isWalletConnected && !userId ? (
          <View style={styles.connectPrompt}>
            <FontAwesome5 name="wallet" size={48} color={KA_COLORS.orangePrimary} style={styles.promptIcon} />
            <Text style={styles.promptText}>Connect your Solana wallet to view your profile</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }}>
            <Text style={styles.title}>CREATOR PROFILE</Text>
            <Text style={styles.subtitle}>武士道 • Bushido</Text>
            
            <View style={styles.card}>
              <View style={styles.cardTopBorder} />
              <View style={[styles.cardCorner, styles.cardCornerTL]} />
              <View style={[styles.cardCorner, styles.cardCornerTR]} />
              <View style={[styles.cardCorner, styles.cardCornerBL]} />
              <View style={[styles.cardCorner, styles.cardCornerBR]} />
              
              <View style={styles.profileHeader}>
                <View style={styles.avatarFrame}>
                  <Image
                    source={{ uri: creatorData?.image || 'https://via.placeholder.com/80' }}
                    style={styles.profileImage}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.profileName}>
                    {creatorData?.name || creatorData?.wallet_address?.slice(0, 8)}
                  </Text>
                  {isBenefactor && getBenefactorBadgeImage() && (
                    <Image source={getBenefactorBadgeImage()} style={styles.benefactorBadge} />
                  )}
                </View>
              </View>
              
              <Text style={styles.bio}>{creatorData?.bio || 'No bio provided.'}</Text>
              
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>SOCIAL</Text>
                <View style={styles.dividerLine} />
              </View>
              
              <View style={styles.socials}>
                {creatorData?.twitter ? (
                  <TouchableOpacity style={styles.socialButton}>
                    <FontAwesome5 name="twitter" size={16} color="#1DA1F2" />
                    <Text style={styles.socialText}>@{creatorData.twitter}</Text>
                  </TouchableOpacity>
                ) : creatorData?.discord ? (
                  <View style={styles.socialButton}>
                    <FontAwesome5 name="discord" size={16} color="#7289DA" />
                    <Text style={styles.socialText}>{creatorData.discord}</Text>
                  </View>
                ) : creatorData?.website ? (
                  <TouchableOpacity style={styles.socialButton}>
                    <FontAwesome5 name="globe" size={16} color={KA_COLORS.orangePrimary} />
                    <Text style={styles.socialText}>Website</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.placeholder}>No social links added</Text>
                )}
              </View>
              
              <View style={styles.walletInfo}>
                <FontAwesome5 name="wallet" size={14} color={KA_COLORS.gold} />
                <Text style={styles.walletText}>{creatorData?.wallet_address?.slice(0, 8)}...</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardTopBorder} />
              <View style={[styles.cardCorner, styles.cardCornerTL]} />
              <View style={[styles.cardCorner, styles.cardCornerTR]} />
              <View style={[styles.cardCorner, styles.cardCornerBL]} />
              <View style={[styles.cardCorner, styles.cardCornerBR]} />
              
              <Text style={styles.sectionTitle}>CREATIONS</Text>
              
              {novels.length > 0 ? (
                <View style={styles.novelGrid}>
                  {novels.map((novel) => (
                    <TouchableOpacity
                      key={novel.id}
                      style={styles.novelCard}
                      onPress={() => navigation.navigate('NovelDetail', { id: novel.id })}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: novel.image }} style={styles.novelImage} />
                      <View style={styles.novelContent}>
                        <Text style={styles.novelTitle}>{novel.title}</Text>
                        <Text style={styles.novelSummary} numberOfLines={2}>
                          {novel.summary?.slice(0, 80)}...
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.placeholder}>No creations yet. Begin your journey.</Text>
              )}
            </View>

            {isOwnProfile && (
              <View style={styles.card}>
                <View style={styles.cardTopBorder} />
                <View style={[styles.cardCorner, styles.cardCornerTL]} />
                <View style={[styles.cardCorner, styles.cardCornerTR]} />
                <View style={[styles.cardCorner, styles.cardCornerBL]} />
                <View style={[styles.cardCorner, styles.cardCornerBR]} />
                
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('EditProfile')}
                    activeOpacity={0.8}
                  >
                    <FontAwesome5 name="edit" size={16} color={KA_COLORS.ivory} />
                    <Text style={styles.actionButtonText}>EDIT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={dashboardButton.action}
                    activeOpacity={0.8}
                  >
                    <FontAwesome5 name="rocket" size={16} color={KA_COLORS.ivory} />
                    <Text style={styles.actionButtonText}>{dashboardButton.text.toUpperCase()}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

export default ProfileScreen;
