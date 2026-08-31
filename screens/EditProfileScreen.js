import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { supabase } from '../services/supabaseClient';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import { AMETHYST_MINT_ADDRESS, SMP_DECIMALS, RPC_URL } from '../constants';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { formatNumber } from '../utils/formatNumber';

const { width, height } = Dimensions.get('window');

const getThemedStyles = (colors, isDark) => {
  const c = colors;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bgPrimary,
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.bgPrimary,
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
      backgroundColor: c.accent,
      shadowColor: c.accentBright,
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
    connectPrompt: {
      alignItems: 'center',
      padding: 40,
    },
    promptIcon: {
      marginBottom: 20,
    },
    promptText: {
      color: c.textSecondary,
      fontSize: 16,
      textAlign: 'center',
      letterSpacing: 1,
      lineHeight: 24,
      marginBottom: 20,
    },
    title: {
      color: c.textPrimary,
      fontSize: 32,
      textAlign: 'center',
      letterSpacing: 3,
      textShadowColor: c.accent,
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 8,
      marginBottom: 8,
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 24,
    },
    card: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 4,
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 16,
      elevation: 8,
      marginBottom: 16,
    },
    cardTopBorder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: c.accent,
    },
    cardCorner: {
      position: 'absolute',
      width: 12,
      height: 12,
      borderColor: c.accentDim,
      borderStyle: 'solid',
      opacity: 0.5,
    },
    cardCornerTL: { top: 8, left: 8, borderWidth: 2, borderBottomWidth: 0, borderRightWidth: 0 },
    cardCornerTR: { top: 8, right: 8, borderWidth: 2, borderBottomWidth: 0, borderLeftWidth: 0 },
    cardCornerBL: { bottom: 8, left: 8, borderWidth: 2, borderTopWidth: 0, borderRightWidth: 0 },
    cardCornerBR: { bottom: 8, right: 8, borderWidth: 2, borderTopWidth: 0, borderLeftWidth: 0 },
    balanceCard: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 4,
      padding: 16,
      marginBottom: 16,
    },
    balanceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    balanceText: {
      color: c.gold,
      fontSize: 14,
      letterSpacing: 1,
    },
    walletInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 16,
    },
    walletText: {
      color: c.gold,
      fontSize: 13,
      marginLeft: 8,
      letterSpacing: 1,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: c.border,
    },
    dividerText: {
      color: c.textMuted,
      fontSize: 12,
      marginHorizontal: 12,
      letterSpacing: 3,
      textTransform: 'uppercase',
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      color: c.textPrimary,
      fontSize: 14,
      letterSpacing: 2,
      marginBottom: 8,
      textShadowColor: c.accent,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    input: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: c.textPrimary,
      fontSize: 14,
      letterSpacing: 1,
    },
    textarea: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: c.textPrimary,
      fontSize: 14,
      letterSpacing: 1,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    inputWithButton: {
      flexDirection: 'row',
      gap: 12,
    },
    verifyButton: {
      backgroundColor: c.accent,
      borderWidth: 1,
      borderColor: c.accentBright,
      borderRadius: 4,
      paddingHorizontal: 20,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 100,
    },
    buttonText: {
      color: c.textPrimary,
      fontSize: 14,
      letterSpacing: 1,
    },
    imageGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    imageLabel: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 4,
      paddingHorizontal: 20,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    previewImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: c.accentDim,
    },
    alert: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderRadius: 4,
      padding: 16,
      marginBottom: 16,
    },
    alertError: {
      borderColor: '#c41e3a',
    },
    alertSuccess: {
      borderColor: '#4a7c59',
    },
    alertInfo: {
      borderColor: c.gold,
    },
    alertText: {
      color: c.textPrimary,
      fontSize: 14,
      letterSpacing: 1,
      textAlign: 'center',
    },
    submitButton: {
      backgroundColor: c.accent,
      borderWidth: 1,
      borderColor: c.accentBright,
      borderRadius: 4,
      paddingHorizontal: 20,
      paddingVertical: 16,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 6,
    },
    placeholder: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: 'center',
      fontStyle: 'italic',
      letterSpacing: 1,
    },
    toggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 4,
      padding: 16,
    },
    toggleLabel: {
      color: c.textPrimary,
      fontSize: 14,
      letterSpacing: 1,
      flex: 1,
    },
    toggleSwitch: {
      width: 50,
      height: 28,
      backgroundColor: c.textMuted,
      borderRadius: 14,
      padding: 2,
      justifyContent: 'center',
    },
    toggleSwitchOn: {
      backgroundColor: c.accent,
    },
    toggleKnob: {
      width: 24,
      height: 24,
      backgroundColor: c.textPrimary,
      borderRadius: 12,
    },
    toggleKnobOn: {
      transform: [{ translateX: 22 }],
    },
    toggleDescription: {
      color: c.textSecondary,
      fontSize: 12,
      marginTop: 8,
      letterSpacing: 1,
    },
  });
};

const connection = new Connection(RPC_URL, 'confirmed');

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { wallet: embeddedWallet } = useContext(EmbeddedWalletContext);
  const { session } = useGoogleAuth();
  const { colors, isDark } = useTheme();
  
  const themedStyles = getThemedStyles(colors, isDark);
  
  const [userId, setUserId] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [xAccount, setXAccount] = useState('');
  const [twitterInput, setTwitterInput] = useState('');
  const [twitterError, setTwitterError] = useState('');
  const [twitterVerified, setTwitterVerified] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [bio, setBio] = useState('');
  const [discord, setDiscord] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [referralMessage, setReferralMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [balance, setBalance] = useState(0);
  const [walletReady, setWalletReady] = useState(false);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const emberAnims = useRef([]);
  const buttonScale = useRef(new Animated.Value(1)).current;

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

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const checkBalance = useCallback(async () => {
    if (!embeddedWallet?.publicKey) {
      setBalance(0);
      return;
    }

    try {
      const mintAddress = new PublicKey(AMETHYST_MINT_ADDRESS);
      let balance = 0;

      const ataAddress = getAssociatedTokenAddressSync(mintAddress, new PublicKey(embeddedWallet.publicKey));
      const ataInfo = await connection.getAccountInfo(ataAddress);
      if (ataInfo) {
        const ata = unpackAccount(ataAddress, ataInfo);
        balance = Number(ata.amount) / 10 ** SMP_DECIMALS;
      }
      setBalance(balance);
    } catch (error) {
      console.error('Error fetching Amethyst balance:', error);
      setBalance(0);
    }
  }, [embeddedWallet]);

  useEffect(() => {
    if (embeddedWallet?.publicKey) {
      setWalletReady(true);
      checkBalance();
    } else {
      setWalletReady(false);
    }
  }, [embeddedWallet, checkBalance]);

  useEffect(() => {
    const fetchUserData = async () => {
      const walletAddress = embeddedWallet?.publicKey;
      if (!walletReady || !walletAddress || !session) return;

      try {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, email, name, x_account, x_verified_at, image, isWriter, isArtist, isSuperuser, referred_by, has_updated_profile, weekly_points')
          .eq('wallet_address', walletAddress.toString())
          .single();

        if (userError) {
          if (userError.code === 'PGRST116') {
            setError('No user found. Please connect your wallet on the home page first.');
            return;
          }
          throw new Error(`Error fetching user: ${userError.message}`);
        }

        setUserId(user.id);
        setEmail(user.email || '');
        setName(user.name || '');
        setXAccount(user.x_account || '');
        setImageUrl(user.image || '');
        setIsCreator(user.isWriter || user.isArtist);

        if (user.x_account && user.x_verified_at) {
          const verifiedAt = new Date(user.x_verified_at);
          if (verifiedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
            setTwitterVerified(true);
            setTwitterInput(user.x_account);
          }
        }

        setIsNewUser(!user.has_updated_profile && !!user.referred_by);
        if (!user.has_updated_profile && user.referred_by) {
          setReferralMessage('Update your profile to claim 100 points and reward your inviter with 100 points!');
        }

        if (user.isWriter || user.isArtist) {
          const { data: profile, error: profileError } = await supabase
            .from('writer_profiles')
            .select('bio, twitter, discord, website')
            .eq('user_id', user.id)
            .maybeSingle();

          if (profileError && profileError.code !== 'PGRST116') {
            throw new Error('Error fetching profile: ' + profileError.message);
          }
          setBio(profile?.bio || '');
          setTwitterInput(profile?.twitter || user.x_account || '');
          setXAccount(profile?.twitter || user.x_account || '');
          setDiscord(profile?.discord || '');
          setWebsite(profile?.website || '');
        }
      } catch (err) {
        setError(err.message);
        console.error('Fetch user data failed:', err);
      }
    };

    fetchUserData();
  }, [walletReady, embeddedWallet, session]);

  const validateTwitterUsername = async () => {
    setTwitterError('');
    setTwitterVerified(false);
    setSuccess('');
    setIsVerifying(true);

    let username = twitterInput.trim();
    const urlMatch = username.match(/twitter\.com\/([A-Za-z0-9_]+)/) || username.match(/x\.com\/([A-Za-z0-9_]+)/);
    if (urlMatch) {
      username = urlMatch[1];
    } else {
      username = username.replace(/^@/, '');
    }

    if (!username.match(/^[A-Za-z0-9_]{1,15}$/)) {
      setTwitterError('Please enter a valid X username (1-15 characters, letters, numbers, or underscores).');
      setIsVerifying(false);
      return;
    }

    try {
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('x_account', username)
        .neq('id', userId || '')
        .maybeSingle();

      if (existingUser) {
        setTwitterError('Username @' + username + ' is already taken. Please choose a different username.');
        setIsVerifying(false);
        return;
      }

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(`Error checking username uniqueness: ${checkError.message}`);
      }

      const response = await axios.get(`https://x.com/${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html',
        },
        timeout: 5000,
      });

      const isValid = response.status === 200 && !response.data.includes("Sorry, that page doesn't exist!");
      if (isValid) {
        setTwitterVerified(true);
        setXAccount(username);
        setSuccess(`X username @${username} verified!`);
      } else {
        setTwitterError(`Username @${username} does not exist or is private. Ensure the account is public and try again.`);
      }
    } catch (err) {
      console.error('X validation error:', err.message);
      setTwitterError(`Error verifying username: ${err.message}. Please contact support.`);
    } finally {
      setIsVerifying(false);
    }
  };

  const getRewardAmount = () => {
    const balanceNum = Number(balance);
    if (balanceNum >= 5_000_000) return 'x2.5';
    if (balanceNum >= 1_000_000) return 'x2';
    if (balanceNum >= 500_000) return 'x1.7';
    if (balanceNum >= 250_000) return 'x1.5';
    if (balanceNum >= 100_000) return 'x1.2';
    return 'x1';
  };
  const rewardAmount = getRewardAmount();

  const handleImageChange = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access gallery was denied.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (result.canceled) {
        setError('No image selected.');
        return;
      }

      const file = result.assets[0];
      if (!file.mimeType?.startsWith('image/')) {
        setError('Please upload a valid image file.');
        return;
      }

      const walletAddress = embeddedWallet?.publicKey.toString();
      const fileExtension = file.mimeType.split('/')[1] || 'jpg';
      const fileName = `${walletAddress}-${Date.now()}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from('sempai')
        .upload(`profile-images/${fileName}`, { uri: file.uri, type: file.mimeType, name: fileName }, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw new Error('Image upload failed: ' + uploadError.message);

      const { data } = supabase.storage.from('sempai').getPublicUrl(`profile-images/${fileName}`);
      setImageUrl(data.publicUrl);
    } catch (err) {
      setError(err.message);
      console.error('Image upload error:', err);
    }
  };

  const handleSubmit = async () => {
    animateButton();
    setError('');
    setSuccess('');
    setIsSaving(true);

    if (!userId || !walletReady || !embeddedWallet || !session) {
      setError('Please sign in and connect your wallet to update your profile.');
      setIsSaving(false);
      return;
    }

    if (!twitterVerified && !xAccount) {
      setError('Please verify your X username before saving.');
      setIsSaving(false);
      return;
    }

    try {
      const { data: currentUserData, error: fetchError } = await supabase
        .from('users')
        .select('referred_by, has_updated_profile, weekly_points')
        .eq('id', userId)
        .single();

      if (fetchError) throw new Error('Error fetching user data: ' + fetchError.message);

      const walletAddress = embeddedWallet.publicKey.toString();
      const { error: userError } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          email: email.trim(),
          x_account: xAccount.toUpperCase(),
          x_verified_at: new Date().toISOString(),
          image: imageUrl,
          has_updated_profile: true,
        })
        .eq('wallet_address', walletAddress);

      if (userError) {
        if (userError.message.includes('duplicate key value violates unique constraint')) {
          setError('X account already exists. Please contact support.');
          throw new Error('Duplicate X account');
        }
        throw new Error('Error updating user: ' + userError.message);
      }

      if (isNewUser && !currentUserData.has_updated_profile && currentUserData.referred_by) {
        await supabase
          .from('users')
          .update({ weekly_points: (currentUserData.weekly_points || 0) + 100 })
          .eq('id', userId);

        const { data: inviterData, error: inviterError } = await supabase
          .from('users')
          .select('weekly_points')
          .eq('id', currentUserData.referred_by)
          .single();

        if (inviterError) throw new Error('Error fetching inviter data: ' + inviterError.message);

        await supabase
          .from('users')
          .update({ weekly_points: (inviterData?.weekly_points || 0) + 100 })
          .eq('id', currentUserData.referred_by);

        setIsNewUser(false);
        setReferralMessage('');
        setSuccess('Profile updated successfully! You\'ve claimed 100 points, and your inviter received 100 points!');
      } else {
        setSuccess('Profile updated successfully!');
      }

      if (isCreator) {
        const { error: profileError } = await supabase
          .from('writer_profiles')
          .upsert(
            {
              user_id: userId,
              bio: bio.trim(),
              twitter: xAccount,
              discord: discord.trim(),
              website: website.trim(),
            },
            { onConflict: 'user_id' }
          );

        if (profileError) throw new Error('Error updating writer profile: ' + profileError.message);
      }

      await checkBalance();
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatUsername = (address) =>
    address && address.length > 15 ? `${address.slice(0, 2)}**${address.slice(-2)}` : address || '';

  if (!walletReady && !session) {
    return (
      <View style={themedStyles.container}>
        <View style={themedStyles.centerContainer}>
          <FontAwesome5 name="wallet" size={48} color={colors.accent} style={themedStyles.promptIcon} />
          <Text style={themedStyles.promptText}>Please sign in and connect your wallet.</Text>
          <GoogleSignInButton />
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
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }}>
          <Text style={themedStyles.title}>EDIT PROFILE</Text>
          <Text style={themedStyles.subtitle}>武士道 • Bushido</Text>
          
          <View style={themedStyles.card}>
            <View style={themedStyles.cardTopBorder} />
            <View style={[themedStyles.cardCorner, themedStyles.cardCornerTL]} />
            <View style={[themedStyles.cardCorner, themedStyles.cardCornerTR]} />
            <View style={[themedStyles.cardCorner, themedStyles.cardCornerBL]} />
            <View style={[themedStyles.cardCorner, themedStyles.cardCornerBR]} />
            
            <View style={themedStyles.balanceCard}>
              <View style={themedStyles.balanceItem}>
                <FontAwesome5 name="gem" size={20} color={colors.gold} />
                <Text style={themedStyles.balanceText}>Amethyst: {formatNumber(balance)}</Text>
              </View>
              <View style={themedStyles.balanceItem}>
                <FontAwesome5 name="bolt" size={20} color={colors.gold} />
                <Text style={themedStyles.balanceText}>Multiplier: {rewardAmount}</Text>
              </View>
            </View>

            {!session ? (
              <View style={themedStyles.connectPrompt}>
                <Text style={themedStyles.promptText}>Sign in to edit your profile</Text>
                <GoogleSignInButton />
              </View>
            ) : (
              <View style={themedStyles.walletInfo}>
                <FontAwesome5 name="wallet" size={14} color={colors.gold} />
                <Text style={themedStyles.walletText}>{formatUsername(embeddedWallet?.publicKey?.toString() || '')}</Text>
              </View>
            )}

            {referralMessage && (
              <View style={[themedStyles.alert, themedStyles.alertInfo]}>
                <Text style={themedStyles.alertText}>{referralMessage}</Text>
              </View>
            )}
          </View>

          <View style={themedStyles.card}>
            <View style={themedStyles.cardTopBorder} />
            <View style={[themedStyles.cardCorner, themedStyles.cardCornerTL]} />
            <View style={[themedStyles.cardCorner, themedStyles.cardCornerTR]} />
            <View style={[themedStyles.cardCorner, themedStyles.cardCornerBL]} />
            <View style={[themedStyles.cardCorner, themedStyles.cardCornerBR]} />
            
            <View style={themedStyles.inputGroup}>
              <Text style={themedStyles.inputLabel}>
                <FontAwesome5 name="user" size={16} color={colors.accent} /> USERNAME
              </Text>
              <TextInput
                style={themedStyles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your username"
                placeholderTextColor={colors.textMuted}
                editable={walletReady && !isSaving}
              />
            </View>

            <View style={themedStyles.inputGroup}>
              <Text style={themedStyles.inputLabel}>
                <FontAwesome5 name="envelope" size={16} color={colors.accent} /> EMAIL
              </Text>
              <TextInput
                style={themedStyles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                editable={walletReady && !isSaving}
              />
            </View>

            <View style={themedStyles.inputGroup}>
              <Text style={themedStyles.inputLabel}>
                <FontAwesome5 name="twitter" size={16} color={colors.accent} /> X USERNAME
              </Text>
              {xAccount && twitterVerified ? (
                <Text style={[themedStyles.alertText, { color: colors.gold, textAlign: 'left' }]}>Verified: @{xAccount}</Text>
              ) : (
                <View style={themedStyles.inputWithButton}>
                  <TextInput
                    style={[themedStyles.input, { flex: 1 }]}
                    value={twitterInput}
                    onChangeText={setTwitterInput}
                    placeholder="e.g., @username or https://x.com/username"
                    placeholderTextColor={colors.textMuted}
                    editable={walletReady && !isVerifying && !isSaving}
                  />
                  <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                    <TouchableOpacity
                      style={themedStyles.verifyButton}
                      onPress={() => {
                        animateButton();
                        validateTwitterUsername();
                      }}
                      disabled={!walletReady || isVerifying || isSaving || !twitterInput}
                    >
                      {isVerifying ? (
                        <ActivityIndicator size="small" color={colors.textPrimary} />
                      ) : (
                        <Text style={themedStyles.buttonText}>VERIFY</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              )}
            </View>

            {twitterError && (
              <View style={[themedStyles.alert, themedStyles.alertError]}>
                <Text style={themedStyles.alertText}>{twitterError}</Text>
              </View>
            )}
            {twitterVerified && xAccount && (
              <View style={[themedStyles.alert, themedStyles.alertSuccess]}>
                <Text style={themedStyles.alertText}>X username @{xAccount} verified!</Text>
              </View>
            )}

            <View style={themedStyles.inputGroup}>
              <Text style={themedStyles.inputLabel}>
                <FontAwesome5 name="camera" size={16} color={colors.accent} /> PROFILE IMAGE
              </Text>
              <View style={themedStyles.imageGroup}>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={themedStyles.imageLabel}
                    onPress={() => {
                      animateButton();
                      handleImageChange();
                    }}
                    disabled={!walletReady || isSaving}
                  >
                    <FontAwesome5 name="pen" size={16} color={colors.textPrimary} />
                    <Text style={themedStyles.buttonText}>UPLOAD</Text>
                  </TouchableOpacity>
                </Animated.View>
                {imageUrl && (
                  <Image source={{ uri: imageUrl }} style={themedStyles.previewImage} />
                )}
              </View>
            </View>
          </View>

          {isCreator && (
            <View style={themedStyles.card}>
              <View style={themedStyles.cardTopBorder} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerTL]} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerTR]} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerBL]} />
              <View style={[themedStyles.cardCorner, themedStyles.cardCornerBR]} />
              
              <View style={themedStyles.divider}>
                <View style={themedStyles.dividerLine} />
                <Text style={themedStyles.dividerText}>CREATOR</Text>
                <View style={themedStyles.dividerLine} />
              </View>
              
              <View style={themedStyles.inputGroup}>
                <Text style={themedStyles.inputLabel}>
                  <FontAwesome5 name="book" size={16} color={colors.accent} /> BIO
                </Text>
                <TextInput
                  style={themedStyles.textarea}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  editable={walletReady && !isSaving}
                />
              </View>
              
              <View style={themedStyles.inputGroup}>
                <Text style={themedStyles.inputLabel}>
                  <FontAwesome5 name="discord" size={16} color={colors.accent} /> DISCORD
                </Text>
                <TextInput
                  style={themedStyles.input}
                  value={discord}
                  onChangeText={setDiscord}
                  placeholder="e.g., user#1234"
                  placeholderTextColor={colors.textMuted}
                  editable={walletReady && !isSaving}
                />
              </View>
              
              <View style={themedStyles.inputGroup}>
                <Text style={themedStyles.inputLabel}>
                  <FontAwesome5 name="globe" size={16} color={colors.accent} /> WEBSITE
                </Text>
                <TextInput
                  style={themedStyles.input}
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="e.g., https://yourwebsite.com"
                  placeholderTextColor={colors.textMuted}
                  editable={walletReady && !isSaving}
                />
              </View>
            </View>
          )}

          {error && (
            <View style={[themedStyles.alert, themedStyles.alertError]}>
              <Text style={themedStyles.alertText}>{error}</Text>
            </View>
          )}
          {success && (
            <View style={[themedStyles.alert, themedStyles.alertSuccess]}>
              <Text style={themedStyles.alertText}>{success}</Text>
            </View>
          )}

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity style={themedStyles.submitButton}
              onPress={() => {
                animateButton();
                handleSubmit();
              }}
              disabled={!walletReady || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <>
                  <FontAwesome5 name="save" size={20} color={colors.textPrimary} />
                  <Text style={themedStyles.buttonText}>SAVE CHANGES</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

export default EditProfileScreen;