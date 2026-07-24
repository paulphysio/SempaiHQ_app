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
import { formatNumber } from '../utils/formatNumber';

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
    marginBottom: 20,
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
    marginBottom: 24,
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
    marginBottom: 16,
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
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
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
    color: KA_COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
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
    marginBottom: 16,
  },
  walletText: {
    color: KA_COLORS.gold,
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
    backgroundColor: KA_COLORS.border,
  },
  dividerText: {
    color: KA_COLORS.textMuted,
    fontSize: 12,
    marginHorizontal: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
    textShadowColor: KA_COLORS.orangePrimary,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  input: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
  },
  textarea: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: KA_COLORS.ivory,
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
    backgroundColor: KA_COLORS.orangePrimary,
    borderWidth: 1,
    borderColor: KA_COLORS.orangeBright,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  buttonText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  imageGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  imageLabel: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
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
    borderColor: KA_COLORS.orangeDim,
  },
  alert: {
    backgroundColor: KA_COLORS.bgElevated,
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
    borderColor: KA_COLORS.gold,
  },
  alertText: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: KA_COLORS.orangePrimary,
    borderWidth: 1,
    borderColor: KA_COLORS.orangeBright,
    borderRadius: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    shadowColor: KA_COLORS.orangePrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  placeholder: {
    color: KA_COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 16,
  },
  toggleLabel: {
    color: KA_COLORS.ivory,
    fontSize: 14,
    letterSpacing: 1,
    flex: 1,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    backgroundColor: KA_COLORS.textMuted,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: KA_COLORS.orangePrimary,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: KA_COLORS.ivory,
    borderRadius: 12,
  },
  toggleKnobOn: {
    transform: [{ translateX: 22 }],
  },
  toggleDescription: {
    color: KA_COLORS.textSecondary,
    fontSize: 12,
    marginTop: 8,
    letterSpacing: 1,
  },
});

const connection = new Connection(RPC_URL, 'confirmed');

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { wallet: embeddedWallet } = useContext(EmbeddedWalletContext);
  const { session } = useGoogleAuth();
  
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
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <FontAwesome5 name="wallet" size={48} color={KA_COLORS.orangePrimary} style={styles.promptIcon} />
          <Text style={styles.promptText}>Please sign in and connect your wallet.</Text>
          <GoogleSignInButton />
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
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }}>
          <Text style={styles.title}>EDIT PROFILE</Text>
          <Text style={styles.subtitle}>武士道 • Bushido</Text>
          
          <View style={styles.card}>
            <View style={styles.cardTopBorder} />
            <View style={[styles.cardCorner, styles.cardCornerTL]} />
            <View style={[styles.cardCorner, styles.cardCornerTR]} />
            <View style={[styles.cardCorner, styles.cardCornerBL]} />
            <View style={[styles.cardCorner, styles.cardCornerBR]} />
            
            <View style={styles.balanceCard}>
              <View style={styles.balanceItem}>
                <FontAwesome5 name="gem" size={20} color={KA_COLORS.gold} />
                <Text style={styles.balanceText}>Amethyst: {formatNumber(balance)}</Text>
              </View>
              <View style={styles.balanceItem}>
                <FontAwesome5 name="bolt" size={20} color={KA_COLORS.gold} />
                <Text style={styles.balanceText}>Multiplier: {rewardAmount}</Text>
              </View>
            </View>

            {!session ? (
              <View style={styles.connectPrompt}>
                <Text style={styles.promptText}>Sign in to edit your profile</Text>
                <GoogleSignInButton />
              </View>
            ) : (
              <View style={styles.walletInfo}>
                <FontAwesome5 name="wallet" size={14} color={KA_COLORS.gold} />
                <Text style={styles.walletText}>{formatUsername(embeddedWallet?.publicKey?.toString() || '')}</Text>
              </View>
            )}

            {referralMessage && (
              <View style={[styles.alert, styles.alertInfo]}>
                <Text style={styles.alertText}>{referralMessage}</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardTopBorder} />
            <View style={[styles.cardCorner, styles.cardCornerTL]} />
            <View style={[styles.cardCorner, styles.cardCornerTR]} />
            <View style={[styles.cardCorner, styles.cardCornerBL]} />
            <View style={[styles.cardCorner, styles.cardCornerBR]} />
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                <FontAwesome5 name="user" size={16} color={KA_COLORS.orangePrimary} /> USERNAME
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your username"
                placeholderTextColor={KA_COLORS.textMuted}
                editable={walletReady && !isSaving}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                <FontAwesome5 name="envelope" size={16} color={KA_COLORS.orangePrimary} /> EMAIL
              </Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={KA_COLORS.textMuted}
                keyboardType="email-address"
                editable={walletReady && !isSaving}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                <FontAwesome5 name="twitter" size={16} color={KA_COLORS.orangePrimary} /> X USERNAME
              </Text>
              {xAccount && twitterVerified ? (
                <Text style={[styles.alertText, { color: KA_COLORS.gold, textAlign: 'left' }]}>Verified: @{xAccount}</Text>
              ) : (
                <View style={styles.inputWithButton}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={twitterInput}
                    onChangeText={setTwitterInput}
                    placeholder="e.g., @username or https://x.com/username"
                    placeholderTextColor={KA_COLORS.textMuted}
                    editable={walletReady && !isVerifying && !isSaving}
                  />
                  <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                    <TouchableOpacity
                      style={styles.verifyButton}
                      onPress={() => {
                        animateButton();
                        validateTwitterUsername();
                      }}
                      disabled={!walletReady || isVerifying || isSaving || !twitterInput}
                    >
                      {isVerifying ? (
                        <ActivityIndicator size="small" color={KA_COLORS.ivory} />
                      ) : (
                        <Text style={styles.buttonText}>VERIFY</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              )}
            </View>

            {twitterError && (
              <View style={[styles.alert, styles.alertError]}>
                <Text style={styles.alertText}>{twitterError}</Text>
              </View>
            )}
            {twitterVerified && xAccount && (
              <View style={[styles.alert, styles.alertSuccess]}>
                <Text style={styles.alertText}>X username @{xAccount} verified!</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                <FontAwesome5 name="camera" size={16} color={KA_COLORS.orangePrimary} /> PROFILE IMAGE
              </Text>
              <View style={styles.imageGroup}>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={styles.imageLabel}
                    onPress={() => {
                      animateButton();
                      handleImageChange();
                    }}
                    disabled={!walletReady || isSaving}
                  >
                    <FontAwesome5 name="pen" size={16} color={KA_COLORS.ivory} />
                    <Text style={styles.buttonText}>UPLOAD</Text>
                  </TouchableOpacity>
                </Animated.View>
                {imageUrl && (
                  <Image source={{ uri: imageUrl }} style={styles.previewImage} />
                )}
              </View>
            </View>
          </View>

          {isCreator && (
            <View style={styles.card}>
              <View style={styles.cardTopBorder} />
              <View style={[styles.cardCorner, styles.cardCornerTL]} />
              <View style={[styles.cardCorner, styles.cardCornerTR]} />
              <View style={[styles.cardCorner, styles.cardCornerBL]} />
              <View style={[styles.cardCorner, styles.cardCornerBR]} />
              
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>CREATOR</Text>
                <View style={styles.dividerLine} />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  <FontAwesome5 name="book" size={16} color={KA_COLORS.orangePrimary} /> BIO
                </Text>
                <TextInput
                  style={styles.textarea}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself"
                  placeholderTextColor={KA_COLORS.textMuted}
                  multiline
                  numberOfLines={4}
                  editable={walletReady && !isSaving}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  <FontAwesome5 name="discord" size={16} color={KA_COLORS.orangePrimary} /> DISCORD
                </Text>
                <TextInput
                  style={styles.input}
                  value={discord}
                  onChangeText={setDiscord}
                  placeholder="e.g., user#1234"
                  placeholderTextColor={KA_COLORS.textMuted}
                  editable={walletReady && !isSaving}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  <FontAwesome5 name="globe" size={16} color={KA_COLORS.orangePrimary} /> WEBSITE
                </Text>
                <TextInput
                  style={styles.input}
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="e.g., https://yourwebsite.com"
                  placeholderTextColor={KA_COLORS.textMuted}
                  editable={walletReady && !isSaving}
                />
              </View>
            </View>
          )}

          {error && (
            <View style={[styles.alert, styles.alertError]}>
              <Text style={styles.alertText}>{error}</Text>
            </View>
          )}
          {success && (
            <View style={[styles.alert, styles.alertSuccess]}>
              <Text style={styles.alertText}>{success}</Text>
            </View>
          )}

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => {
                animateButton();
                handleSubmit();
              }}
              disabled={!walletReady || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={KA_COLORS.ivory} />
              ) : (
                <>
                  <FontAwesome5 name="save" size={16} color={KA_COLORS.ivory} />
                  <Text style={styles.buttonText}>SAVE CHANGES</Text>
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