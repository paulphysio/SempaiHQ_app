import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
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
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { supabase } from '../services/supabaseClient';
import { readerAction } from '../services/readerActions';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import { AMETHYST_MINT_ADDRESS, SMP_DECIMALS, RPC_URL } from '../constants';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import { formatNumber } from '../utils/formatNumber';
import GelOrb from '../components/nav/GelOrb';
import { GelGlass, GelInput, GelButton } from '../components/gel/GelKit';
import { GelGate } from '../components/gel/GelGate';

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
  
  const themedStyles = useMemo(() => getThemedStyles(colors, isDark), [colors, isDark]);
  
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
          .select('id, name, x_account, x_verified_at, image, isWriter, isArtist, isSuperuser, referred_by, has_updated_profile, weekly_points')
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
        setEmail(session?.user?.email || '');
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
      console.log('[ProfileImage] Starting upload flow');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[ProfileImage] Media library permission status:', status);
      if (status !== 'granted') {
        setError('Permission to access gallery was denied.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      console.log('[ProfileImage] Picker result canceled:', result.canceled, 'assets:', result.assets?.length);

      if (result.canceled) {
        setError('No image selected.');
        return;
      }

      const file = result.assets[0];
      console.log('[ProfileImage] Picked asset:', JSON.stringify({ uri: file.uri, mimeType: file.mimeType, fileName: file.fileName, fileSize: file.fileSize }));
      if (!file.mimeType?.startsWith('image/')) {
        setError('Please upload a valid image file.');
        return;
      }

      const walletAddress = embeddedWallet?.publicKey.toString();
      console.log('[ProfileImage] Wallet address:', walletAddress);
      if (!walletAddress) {
        setError('Wallet not connected. Please connect your wallet first.');
        return;
      }
      const fileExtension = file.mimeType.split('/')[1] || 'jpg';
      const fileName = `${walletAddress}-${Date.now()}.${fileExtension}`;
      const storagePath = `profile-images/${fileName}`;
      console.log('[ProfileImage] Uploading to sempai bucket, path:', storagePath);

      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.log('[ProfileImage] Read image as ArrayBuffer, bytes:', bytes.length);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sempai')
        .upload(storagePath, bytes.buffer, {
          contentType: file.mimeType,
          cacheControl: '3600',
          upsert: true,
        });

      console.log('[ProfileImage] Upload response:', JSON.stringify({ data: uploadData, error: uploadError }));
      if (uploadError) throw new Error('Image upload failed: ' + uploadError.message);

      const { data } = supabase.storage.from('sempai').getPublicUrl(storagePath);
      console.log('[ProfileImage] Public URL:', data.publicUrl);
      setImageUrl(data.publicUrl);
    } catch (err) {
      setError(err.message);
      console.error('[ProfileImage] Image upload error:', err);
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
      console.log('[ProfileImage] Saving profile — imageUrl:', imageUrl, '| wallet:', walletAddress);
      const { data: updatedRows, error: userError } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          email: email.trim(),
          x_account: xAccount.toUpperCase(),
          x_verified_at: new Date().toISOString(),
          image: imageUrl,
          has_updated_profile: true,
        })
        .eq('wallet_address', walletAddress)
        .select('id, image');

      console.log('[ProfileImage] Users update result:', JSON.stringify({ updatedRows, error: userError }));
      if (!userError && (!updatedRows || updatedRows.length === 0)) {
        console.warn('[ProfileImage] WARNING: update matched 0 rows — no users row with wallet_address =', walletAddress);
      }

      if (userError) {
        if (userError.message.includes('duplicate key value violates unique constraint')) {
          setError('X account already exists. Please contact support.');
          throw new Error('Duplicate X account');
        }
        throw new Error('Error updating user: ' + userError.message);
      }

      if (isNewUser && !currentUserData.has_updated_profile && currentUserData.referred_by) {
        // The server pays the referral bonus — once per account, never to yourself.
        const bonus = await readerAction('referral_bonus');
        setIsNewUser(false);
        setReferralMessage('');
        setSuccess(bonus.ok && bonus.awarded
          ? 'Profile updated successfully! You\'ve claimed 100 points, and your inviter received 100 points!'
          : 'Profile updated successfully!');
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
    return <GelGate icon="user-edit" headerTitle="Edit profile" title="Sign in to edit your profile" subtitle="Your name, photo and links show on your profile, comments and Crazy Corner." />;
  }

  const notice = (text, tone) => (
    <Text style={{ color: tone, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 }}>{text}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* photo + who */}
          <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 18 }}>
            <Pressable
              onPress={handleImageChange}
              disabled={!walletReady || isSaving}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              style={{ width: 104, height: 104, borderRadius: 52, borderWidth: 3, borderColor: colors.accent, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgCard }}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <FontAwesome5 name="user" size={40} color={colors.textMuted} />
              )}
            </Pressable>
            <View style={{ position: 'absolute', top: 72, left: '50%', marginLeft: 22 }}>
              <GelOrb icon="camera" size={34} lit onPress={handleImageChange} disabled={!walletReady || isSaving} label="Change photo" breathe={false} />
            </View>
            <Text style={{ fontFamily: 'Yoruka', fontSize: 26, color: colors.textPrimary, marginTop: 12 }}>Edit profile</Text>
            {embeddedWallet?.publicKey ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Wallet {formatUsername(embeddedWallet.publicKey.toString())}</Text>
            ) : null}
          </View>

          {/* amethyst */}
          <GelGlass radius={24} glow={false} padding={14} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <FontAwesome5 name="gem" size={16} color={colors.gold} />
                <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 4 }}>{formatNumber(balance)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Amethyst</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <FontAwesome5 name="bolt" size={16} color={colors.gold} />
                <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 4 }}>{rewardAmount}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Multiplier</Text>
              </View>
            </View>
            {referralMessage ? notice(referralMessage, colors.info) : null}
          </GelGlass>

          {!session ? (
            <GelGlass radius={24} glow={false} padding={16} style={{ marginBottom: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>Sign in to save changes</Text>
              <GoogleSignInButton />
            </GelGlass>
          ) : null}

          {/* basics */}
          <GelGlass radius={26} glow={false} padding={18}>
            <GelInput label="Username" value={name} onChangeText={setName} placeholder="How people see you" editable={walletReady && !isSaving} style={{ marginTop: 0 }} />
            <GelInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" editable={walletReady && !isSaving} />
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6, marginLeft: 4 }}>X (Twitter)</Text>
            {xAccount && twitterVerified ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 }}>
                <FontAwesome5 name="check-circle" size={14} color={colors.success} solid />
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>@{xAccount}</Text>
                <Text style={{ color: colors.textMuted }}>verified</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <GelInput
                  value={twitterInput}
                  onChangeText={setTwitterInput}
                  placeholder="@username"
                  autoCapitalize="none"
                  editable={walletReady && !isVerifying && !isSaving}
                  style={{ flex: 1, marginTop: 0 }}
                />
                <GelButton
                  label="Verify"
                  small
                  variant="secondary"
                  loading={isVerifying}
                  disabled={!walletReady || isSaving || !twitterInput}
                  onPress={validateTwitterUsername}
                />
              </View>
            )}
            {twitterError ? notice(twitterError, colors.danger) : null}
          </GelGlass>

          {/* creator */}
          {isCreator ? (
            <GelGlass radius={26} glow={false} padding={18} style={{ marginTop: 14 }}>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginLeft: 4 }}>CREATOR</Text>
              <GelInput label="Bio" value={bio} onChangeText={setBio} placeholder="Tell readers about yourself" multiline editable={walletReady && !isSaving} />
              <GelInput label="Discord" value={discord} onChangeText={setDiscord} placeholder="user#1234" autoCapitalize="none" editable={walletReady && !isSaving} />
              <GelInput label="Website" value={website} onChangeText={setWebsite} placeholder="https://yourwebsite.com" autoCapitalize="none" editable={walletReady && !isSaving} />
            </GelGlass>
          ) : null}

          {error ? notice(error, colors.danger) : null}
          {success ? notice(success, colors.success) : null}

          <GelButton label="Save changes" icon="save" loading={isSaving} disabled={!walletReady} onPress={handleSubmit} style={{ marginTop: 18 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
};

export default EditProfileScreen;
