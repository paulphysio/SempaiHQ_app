import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Modal from 'react-native-modal';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { getProfileStyles } from '../styles/ProfileStyles';
import UBBadge from '../components/UBBadge';
import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createTransferInstruction } from '@solana/spl-token';
import {
  USDC_MINT_ADDRESS,
  SKR_MINT_ADDRESS,
  RPC_URL,
  USDC_DECIMALS,
  SKR_DECIMALS,
} from '../constants';

const connection = new Connection(RPC_URL, 'confirmed');

const { width, height } = Dimensions.get('window');

  const CreatorsProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params || {};
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const signAndSendTransaction = walletContext?.signAndSendTransaction;
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
  const [showBadgePurchaseModal, setShowBadgePurchaseModal] = useState(false);
  const [writerBadges, setWriterBadges] = useState([]);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USDC');
  const [isProcessingBadgePurchase, setIsProcessingBadgePurchase] = useState(false);
  const [solPrice, setSolPrice] = useState(0);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const emberAnims = useRef([]);

  const getBadgeImage = (badge) => {
    if (badge.image_url && badge.image_url !== 'local') {
      return { uri: badge.image_url };
    }
    // Use local images for default badges
    const type = badge.type?.toLowerCase();
    if (type === 'gold') return require('../assets/plan-image/Gold.png');
    if (type === 'silver') return require('../assets/plan-image/Sliver.png');
    if (type === 'blue') return require('../assets/plan-image/Blue.png');
    if (type === 'iron') return require('../assets/plan-image/Black.png');
    return require('../assets/plan-image/Blue.png');
  };

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

  // Fetch live SOL price
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112');
        const data = await response.json();
        if (data?.data?.['So11111111111111111111111111111111111111112']?.price) {
          setSolPrice(data.data['So11111111111111111111111111111111111111112'].price);
        }
      } catch (error) {
        console.error('[CreatorsProfileScreen] Error fetching SOL price:', error);
        // Fallback to a reasonable default
        setSolPrice(150);
      }
    };

    fetchSolPrice();
  }, []);

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

  const handleNavigation = (screen, params) => {
    navigation.navigate(screen, params);
  };

  const normalizeWebsiteUrl = (url) => {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  useEffect(() => {
    if (activeWalletAddress) {
      setIsOwnProfile(activeWalletAddress === creatorData?.wallet_address);
    }
    fetchWriterBadges();
  }, [id, activeWalletAddress, creatorData?.wallet_address]);

  const fetchWriterBadges = async () => {
    if (!id) return;
    try {
      const { data: badgesData, error: badgesError } = await supabase
        .from('badges')
        .select('*')
        .eq('writer_id', id)
        .order('price', { ascending: true });

      if (badgesError) throw badgesError;

      // If writer has no custom badges, use default badges
      if (!badgesData || badgesData.length === 0) {
        const defaultBadges = [
          {
            id: 'default-blue',
            name: 'Blue Badge',
            description: 'Unlock 3 chapters',
            price: 1,
            type: 'blue',
            image_url: 'local',
            writer_id: id,
          },
          {
            id: 'default-iron',
            name: 'Iron Badge',
            description: 'Unlock 6 chapters',
            price: 2,
            type: 'iron',
            image_url: 'local',
            writer_id: id,
          },
          {
            id: 'default-silver',
            name: 'Silver Badge',
            description: 'Unlock 10 chapters',
            price: 3,
            type: 'silver',
            image_url: 'local',
            writer_id: id,
          },
          {
            id: 'default-gold',
            name: 'Gold Badge',
            description: 'Unlock all chapters',
            price: 5,
            type: 'gold',
            image_url: 'local',
            writer_id: id,
          },
        ];
        setWriterBadges(defaultBadges);
      } else {
        setWriterBadges(badgesData);
      }
    } catch (error) {
      console.error('[CreatorsProfileScreen] Error fetching writer badges:', error);
    }
  };

  const handleBadgePurchase = useCallback(async () => {
    if (!selectedBadge) {
      alert('Please select a badge');
      return;
    }
    
    if (!wallet || !wallet.publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (!signAndSendTransaction) {
      alert('Wallet not ready for transactions. Please reconnect.');
      return;
    }

    setIsProcessingBadgePurchase(true);

    try {
      const badgePrice = selectedBadge.price || 0;
      let paymentAmount = 0;
      let paymentMint = null;

      if (selectedCurrency === 'USDC') {
        paymentMint = new PublicKey(USDC_MINT_ADDRESS);
        paymentAmount = Math.floor(badgePrice * 1e6);
      } else if (selectedCurrency === 'SOL') {
        const currentSolPrice = solPrice || 150; // Fallback if price not loaded
        paymentAmount = Math.floor((badgePrice / currentSolPrice) * 1e9);
      } else if (selectedCurrency === 'SKR') {
        paymentMint = new PublicKey(SKR_MINT_ADDRESS);
        paymentAmount = Math.floor(badgePrice * 1e6);
      } else {
        throw new Error('Invalid currency');
      }

      // Comprehensive balance checking BEFORE transaction
      if (!paymentMint) {
        // SOL balance check
        const solBalance = await connection.getBalance(wallet.publicKey);
        const requiredLamports = paymentAmount + 10000; // Add buffer for transaction fee
        if (solBalance < requiredLamports) {
          throw new Error(`Insufficient SOL balance. You have ${(solBalance / 1e9).toFixed(4)} SOL but need ${(requiredLamports / 1e9).toFixed(4)} SOL. Please use USDC or SKR instead.`);
        }
      } else {
        // Token balance check
        try {
          const userAta = getAssociatedTokenAddressSync(paymentMint, wallet.publicKey);
          const ataInfo = await connection.getAccountInfo(userAta);
          if (!ataInfo) {
            throw new Error(`No ${selectedCurrency} account found. Please use SOL instead.`);
          }
          const tokenBalance = Number(ataInfo.data.readBigUInt64LE(64));
          const decimals = selectedCurrency === 'USDC' ? USDC_DECIMALS : SKR_DECIMALS;
          const tokenBalanceFormatted = tokenBalance / (10 ** decimals);
          if (tokenBalance < paymentAmount) {
            throw new Error(`Insufficient ${selectedCurrency} balance. You have ${tokenBalanceFormatted.toFixed(2)} but need ${(paymentAmount / (10 ** decimals)).toFixed(2)}.`);
          }
        } catch (balanceError) {
          console.error('[CreatorsProfileScreen] Token balance check failed:', balanceError);
          if (balanceError.message.includes('No') || balanceError.message.includes('Insufficient')) {
            throw balanceError; // Re-throw our custom error
          }
          throw new Error(`Failed to check ${selectedCurrency} balance. Please try SOL instead.`);
        }
      }

      // Build transaction
      const instructions = [];
      const activePublicKey = wallet.publicKey;

      if (!paymentMint) {
        // SOL transfer to treasury
        const treasuryWallet = new PublicKey('4ZFvgNZygfiCSAS4aKBbQEgwJgBq5fRT9oLAH56GrF6H');
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: activePublicKey,
            toPubkey: treasuryWallet,
            lamports: paymentAmount,
          })
        );
      } else {
        // Token transfer to treasury
        const userAta = getAssociatedTokenAddressSync(paymentMint, activePublicKey);
        const treasuryWallet = new PublicKey('4ZFvgNZygfiCSAS4aKBbQEgwJgBq5fRT9oLAH56GrF6H');
        const treasuryAta = getAssociatedTokenAddressSync(paymentMint, treasuryWallet, true);

        instructions.push(
          createTransferInstruction(userAta, treasuryAta, activePublicKey, paymentAmount)
        );
      }

      const transaction = new Transaction();
      transaction.add(...instructions);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = activePublicKey;

      // Sign and send transaction
      const signature = await signAndSendTransaction(transaction);

      // Confirm transaction
      let retryCount = 0;
      const maxRetries = 3;
      let confirmation;

      while (retryCount < maxRetries) {
        try {
          confirmation = await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            'confirmed'
          );
          break;
        } catch (confirmError) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error('Transaction confirmation failed');
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (confirmation.value.err) {
        // Check for specific insufficient balance error
        const errorString = JSON.stringify(confirmation.value.err);
        if (errorString.includes('insufficient') || errorString.includes('lamports')) {
          throw new Error('Insufficient balance. Please check your wallet balance and try again.');
        }
        throw new Error('Transaction failed on blockchain');
      }

      // Call benefactor-payment edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      const planType = selectedBadge.type || 'blue';

      const response = await fetch('https://xqeimsncmnqsiowftdmz.supabase.co/functions/v1/benefactor-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          writerId: id,
          badgeId: selectedBadge.id,
          planType,
          signature,
          userPublicKey: activeWalletAddress,
          currency: selectedCurrency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[CreatorsProfileScreen] Edge function error:', data.error);
        throw new Error(data.error || 'Failed to record purchase');
      }

      alert('Badge purchased successfully!');
      setShowBadgePurchaseModal(false);
      setSelectedBadge(null);
      await fetchWriterBadges();

    } catch (error) {
      console.error('[CreatorsProfileScreen] Purchase error:', error.message);
      alert(error.message || 'Purchase failed. Please try again.');
    } finally {
      setIsProcessingBadgePurchase(false);
    }
  }, [selectedBadge, selectedCurrency, wallet, signAndSendTransaction, id, activeWalletAddress]);

  useEffect(() => {
    console.log('Route params:', route.params);
    console.log('Wallet:', wallet);

    const fetchProfileDetails = async () => {
      if (!id) {
        setError('No profile ID provided. Please select a profile.');
        setLoading(false);
        setTimeout(() => {
          navigation.navigate('Home');
        }, 2000);
        return;
      }

      try {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, isWriter, isArtist, isSuperuser, name, wallet_address, image')
          .eq('id', id)
          .single();

        if (userError || !user) throw new Error(`User not found: ${userError?.message || 'No user data'}`);

        setIsWriter(user.isWriter || false);
        setIsArtist(user.isArtist || false);
        setIsSuperuser(user.isSuperuser || false);

        if (activeWalletAddress === user.wallet_address) {
          setIsOwnProfile(true);
        }

        const { data: profile, error: profileError } = await supabase
          .from('writer_profiles')
          .select('bio, twitter, discord, website')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116') console.error('Profile fetch error:', profileError);

        console.log('Fetching novels for user ID:', user.id); // Debug log
        const { data: novelsData, error: novelsError } = await supabase
          .from('novels')
          .select('id, title, image, summary')
          .eq('user_id', user.id);

        if (novelsError) throw new Error(`Novels fetch error: ${novelsError.message}`);

        console.log('Fetched novels:', novelsData);
        setCreatorData({ ...user, ...profile });
        setNovels(novelsData || []);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileDetails();
  }, [id, activeWalletAddress, navigation, route.params]);

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

  const dashboardButton = getDashboardButtonProps();

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
        {error ? (
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
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  {isWriter && <UBBadge type="writer" size="small" />}
                  {isArtist && <UBBadge type="artist" size="small" />}
                </View>
                {!isOwnProfile && isWalletConnected && (
                  <TouchableOpacity 
                    style={[themedStyles.actionButton, { marginTop: 12 }]}
                    onPress={() => setShowBadgePurchaseModal(true)}
                    activeOpacity={0.8}
                  >
                    <FontAwesome5 name="shopping-cart" size={16} color={colors.textOnAccent} />
                    <Text style={themedStyles.actionButtonText}>BUY BADGE</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <Text style={themedStyles.bio}>{creatorData?.bio || 'No bio provided.'}</Text>
              
              <View style={themedStyles.divider}>
                <View style={themedStyles.dividerLine} />
                <Text style={themedStyles.dividerText}>SOCIAL</Text>
                <View style={themedStyles.dividerLine} />
              </View>
              
              <View style={themedStyles.socials}>
                {creatorData?.twitter ? (
                  <TouchableOpacity style={themedStyles.socialButton} onPress={() => Linking.openURL(`https://x.com/${creatorData.twitter}`)}>
                    <FontAwesome5 name="twitter" size={16} color="#1DA1F2" />
                    <Text style={themedStyles.socialText}>@{creatorData.twitter}</Text>
                  </TouchableOpacity>
                ) : creatorData?.discord ? (
                  <View style={themedStyles.socialButton}>
                    <FontAwesome5 name="discord" size={16} color="#7289DA" />
                    <Text style={themedStyles.socialText}>{creatorData.discord}</Text>
                  </View>
                ) : creatorData?.website ? (
                  <TouchableOpacity style={themedStyles.socialButton} onPress={() => Linking.openURL(normalizeWebsiteUrl(creatorData.website))}>
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

      {/* Badge Purchase Modal */}
      <Modal
        isVisible={showBadgePurchaseModal}
        onBackdropPress={() => setShowBadgePurchaseModal(false)}
        onBackButtonPress={() => setShowBadgePurchaseModal(false)}
      >
        <View style={themedStyles.modalOverlay}>
          <View style={themedStyles.modalContent}>
            <TouchableOpacity
              style={themedStyles.closeButton}
              onPress={() => setShowBadgePurchaseModal(false)}
            >
              <FontAwesome5 name="times" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={themedStyles.modalTitle}>Purchase Badge</Text>
            <Text style={themedStyles.modalMessage}>
              Support {creatorData?.name || 'this creator'} by purchasing their badge.
            </Text>
            
            {writerBadges.length > 0 ? (
              <>
                <ScrollView style={themedStyles.badgeOptions}>
                  {writerBadges.map((badge) => (
                    <TouchableOpacity
                      key={badge.id}
                      style={[themedStyles.badgeOption, selectedBadge?.id === badge.id && themedStyles.badgeOptionSelected]}
                      onPress={() => setSelectedBadge(badge)}
                    >
                      <Image
                        source={getBadgeImage(badge)}
                        style={themedStyles.badgeOptionImage}
                      />
                      <View style={themedStyles.badgeOptionInfo}>
                        <Text style={themedStyles.badgeOptionName}>{badge.name}</Text>
                        <Text style={themedStyles.badgeOptionDescription}>{badge.description}</Text>
                        <Text style={themedStyles.badgeOptionPrice}>${badge.price || 0}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {selectedBadge && (
                  <>
                    <View style={themedStyles.currencySelector}>
                      <TouchableOpacity
                        style={[themedStyles.currencyOption, selectedCurrency === 'USDC' && themedStyles.currencyOptionSelected]}
                        onPress={() => setSelectedCurrency('USDC')}
                      >
                        <Text style={[themedStyles.currencyOptionText, selectedCurrency === 'USDC' && themedStyles.currencyOptionTextSelected]}>USDC</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[themedStyles.currencyOption, selectedCurrency === 'SOL' && themedStyles.currencyOptionSelected]}
                        onPress={() => setSelectedCurrency('SOL')}
                      >
                        <Text style={[themedStyles.currencyOptionText, selectedCurrency === 'SOL' && themedStyles.currencyOptionTextSelected]}>SOL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[themedStyles.currencyOption, selectedCurrency === 'SKR' && themedStyles.currencyOptionSelected]}
                        onPress={() => setSelectedCurrency('SKR')}
                      >
                        <Text style={[themedStyles.currencyOptionText, selectedCurrency === 'SKR' && themedStyles.currencyOptionTextSelected]}>SKR</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[themedStyles.modalButton, { backgroundColor: colors.accent, opacity: isProcessingBadgePurchase ? 0.6 : 1 }]}
                      onPress={handleBadgePurchase}
                      disabled={isProcessingBadgePurchase}
                    >
                      {isProcessingBadgePurchase ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={themedStyles.modalButtonText}>Purchase for ${selectedBadge.price || 0}</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : (
              <View style={themedStyles.noBadgesContainer}>
                <FontAwesome5 name="information" size={32} color="#888" />
                <Text style={themedStyles.noBadgesText}>No badges available for this writer yet.</Text>
                <TouchableOpacity
                  style={[themedStyles.modalButton, { backgroundColor: colors.accent }]}
                  onPress={() => navigation.navigate('Badges')}
                >
                  <Text style={themedStyles.modalButtonText}>Browse All Badges</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CreatorsProfileScreen;



