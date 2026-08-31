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
import { useTheme } from '../context/ThemeContext';
import { getProfileStyles } from '../styles/ProfileStyles';
import AutopaySettings from '../components/AutopaySettings';

const { width, height } = Dimensions.get('window');

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params || {};
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();
  const { isDark, colors } = useTheme();
  const themedStyles = getProfileStyles(isDark);

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
      <View style={themedStyles.container}>
        <View style={themedStyles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={themedStyles.loadingText}>LOADING...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={themedStyles.container}>
      <View style={themedStyles.backgroundGradient} />
      <View style={themedStyles.emberContainer}>
        {emberAnims.current.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              themedStyles.ember,
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
      
      <ScrollView style={themedStyles.scrollView} contentContainerStyle={themedStyles.scrollContent}>
        {!isWalletConnected && !userId ? (
          <View style={themedStyles.connectPrompt}>
            <FontAwesome5 name="wallet" size={48} color={colors.accent} style={themedStyles.promptIcon} />
            <Text style={themedStyles.promptText}>Connect your Solana wallet to view your profile</Text>
          </View>
        ) : error ? (
          <View style={themedStyles.errorContainer}>
            <Text style={themedStyles.errorText}>{error}</Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }}>
            <Text style={themedStyles.title}>CREATOR PROFILE</Text>
            <Text style={themedStyles.subtitle}>武士道 • Bushido</Text>
            
            <View style={themedStyles.card}>
              <View style={themedStyles.cardTopBorder} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerTL]} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerTR]} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerBL]} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerBR]} />
              
              <View style={themedStyles.profileHeader}>
                <View style={themedStyles.avatarFrame}>
                  <Image
                    source={{ uri: creatorData?.image || 'https://via.placeholder.com/80' }}
                    style={themedStyles.profileImage}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={themedStyles.profileName}>
                    {creatorData?.name || creatorData?.wallet_address?.slice(0, 8)}
                  </Text>
                  {isBenefactor && getBenefactorBadgeImage() && (
                    <Image source={getBenefactorBadgeImage()} style={themedStyles.benefactorBadge} />
                  )}
                </View>
              </View>
              
              <Text style={themedStyles.bio}>{creatorData?.bio || 'No bio provided.'}</Text>
              
              <View style={themedStyles.divider}>
                <View style={themedStyles.dividerLine} />
                <Text style={themedStyles.dividerText}>SOCIAL</Text>
                <View style={themedStyles.dividerLine} />
              </View>
              
              <View style={themedStyles.socials}>
                {creatorData?.twitter ? (
                  <TouchableOpacity style={themedStyles.socialButton}>
                    <FontAwesome5 name="twitter" size={16} color="#1DA1F2" />
                    <Text style={themedStyles.socialText}>@{creatorData.twitter}</Text>
                  </TouchableOpacity>
                ) : creatorData?.discord ? (
                  <View style={themedStyles.socialButton}>
                    <FontAwesome5 name="discord" size={16} color="#7289DA" />
                    <Text style={themedStyles.socialText}>{creatorData.discord}</Text>
                  </View>
                ) : creatorData?.website ? (
                  <TouchableOpacity style={themedStyles.socialButton}>
                    <FontAwesome5 name="globe" size={16} color={colors.accent} />
                    <Text style={themedStyles.socialText}>Website</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={themedStyles.placeholder}>No social links added</Text>
                )}
              </View>
              
              <View style={themedStyles.walletInfo}>
                <FontAwesome5 name="wallet" size={14} color={colors.gold} />
                <Text style={themedStyles.walletText}>{creatorData?.wallet_address?.slice(0, 8)}...</Text>
              </View>
            </View>

            <View style={themedStyles.card}>
              <View style={themedStyles.cardTopBorder} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerTL]} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerTR]} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerBL]} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerBR]} />
              
              <Text style={themedStyles.sectionTitle}>CREATIONS</Text>
              
              {novels.length > 0 ? (
                <View style={themedStyles.novelGrid}>
                  {novels.map((novel) => (
                    <TouchableOpacity
                      key={novel.id}
                      style={themedStyles.novelCard}
                      onPress={() => navigation.navigate('NovelDetail', { id: novel.id })}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: novel.image }} style={themedStyles.novelImage} />
                      <View style={themedStyles.novelContent}>
                        <Text style={themedStyles.novelTitle}>{novel.title}</Text>
                        <Text style={themedStyles.novelSummary} numberOfLines={2}>
                          {novel.summary?.slice(0, 80)}...
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={themedStyles.placeholder}>No creations yet. Begin your journey.</Text>
              )}
            </View>

            {isOwnProfile && (
              <View style={themedStyles.card}>
                <View style={themedStyles.cardTopBorder} />
                <View style={[themedStyles.cardCorner, themedStyles.cardCornerTL]} />
                <View style={[themedStyles.cardCorner, themedStyles.cardCornerTR]} />
                <View style={[themedStyles.cardCorner, themedStyles.cardCornerBL]} />
                <View style={[themedStyles.cardCorner, themedStyles.cardCornerBR]} />

                <Text style={themedStyles.sectionTitle}>SETTINGS</Text>

                <AutopaySettings walletAddress={activeWalletAddress} />

                <View style={themedStyles.actions}>
                  <TouchableOpacity
                    style={themedStyles.actionButton}
                    onPress={() => navigation.navigate('EditProfile')}
                    activeOpacity={0.8}
                  >
                    <FontAwesome5 name="edit" size={16} color={colors.textOnAccent} />
                    <Text style={themedStyles.actionButtonText}>EDIT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={themedStyles.actionButton}
                    onPress={dashboardButton.action}
                    activeOpacity={0.8}
                  >
                    <FontAwesome5 name="rocket" size={16} color={colors.textOnAccent} />
                    <Text style={themedStyles.actionButtonText}>{dashboardButton.text.toUpperCase()}</Text>
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
