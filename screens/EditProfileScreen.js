// screens/EditProfileScreen.js
import React, { useState, useEffect, useContext, useCallback } from 'react';
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
} from 'react-native';
import Modal from 'react-native-modal';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { supabase } from '../services/supabaseClient';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import { AMETHYST_MINT_ADDRESS, SMP_DECIMALS, RPC_URL } from '../constants';
import styles from '../styles/EditProfileStyles';
import { useGoogleAuth } from '../components/GoogleAuthProvider';
import { EmbeddedWalletContext } from '../components/ConnectButton'; // Import EmbeddedWalletContext

const { width, height } = Dimensions.get('window');

const connection = new Connection(RPC_URL, 'confirmed');

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { wallet: embeddedWallet } = useContext(EmbeddedWalletContext);
  const { session } = useGoogleAuth();
  const [userId, setUserId] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [userRole, setUserRole] = useState('default');
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [referralMessage, setReferralMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [buttonScale] = useState(new Animated.Value(1));
  const [balance, setBalance] = useState(0);
  const [walletReady, setWalletReady] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

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
      console.log(`Amethyst Balance: ${balance}`);
    } catch (error) {
      console.error('Error fetching Amethyst balance:', error);
      setError('Failed to fetch Amethyst balance. Please try again.');
      setTimeout(() => setError(''), 5000);
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
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();

    const fetchUserData = async () => {
      const walletAddress = embeddedWallet?.publicKey;
      if (!walletReady || !walletAddress || !session) return;

      try {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select(
            'id, email, name, x_account, x_verified_at, image, isWriter, isArtist, isSuperuser, referred_by, has_updated_profile, weekly_points'
          )
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
        setUserRole(
          user.isSuperuser ? 'superuser' :
          user.isWriter && user.isArtist ? 'both' :
          user.isArtist ? 'artist' :
          user.isWriter ? 'writer' : 'default'
        );

        if (user.x_account && user.x_verified_at) {
          const verifiedAt = new Date(user.x_verified_at);
          if (verifiedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
            setTwitterVerified(true);
            setTwitterInput(user.x_account);
          }
        }

        setIsNewUser(!user.has_updated_profile && !!user.referred_by);
        if (!user.has_updated_profile && user.referred_by) {
          setReferralMessage(
            'Update your profile to claim 100 points and reward your inviter with 100 points!'
          );
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
  }, [walletReady, embeddedWallet, session, fadeAnim]);

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

      const clientIp = 'mobile-device';
      const rateLimitKey = `rate-limit:${clientIp}`;
      const rateLimitWindow = 15 * 60 * 1000;
      const maxRequests = 100;

      let count = 0;
      let lastReset = Date.now();

      const { data: rateLimit, error: rateLimitError } = await supabase
        .from('rate_limits')
        .select('count, last_reset')
        .eq('ip', rateLimitKey)
        .maybeSingle();

      if (!rateLimit) {
        await supabase
          .from('rate_limits')
          .insert({ ip: rateLimitKey, count: 0, last_reset: new Date().toISOString() });
      } else {
        count = rateLimit.count;
        lastReset = new Date(rateLimit.last_reset).getTime();
      }

      if (Date.now() - lastReset > rateLimitWindow) {
        count = 0;
        lastReset = Date.now();
        await supabase
          .from('rate_limits')
          .update({ count: 0, last_reset: new Date().toISOString() })
          .eq('ip', rateLimitKey);
      }

      if (count >= maxRequests) {
        setTwitterError('Too many requests. Please try again later.');
        setIsVerifying(false);
        return;
      }

      await supabase
        .from('rate_limits')
        .upsert({ ip: rateLimitKey, count: count + 1 }, { onConflict: 'ip' });

      const response = await axios.get(`https://x.com/${username}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
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
        setSuccess('Profile updated successfully! You’ve claimed 100 points, and your inviter received 100 points!');
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

  const getThemeStyles = () => {
    switch (userRole) {
      case 'creator':
        return {
          background: { backgroundColor: '#0D1B2A', opacity: 0.9 },
          borderColor: '#F36316',
          textColor: '#F36316',
          shadowColor: 'rgba(243, 99, 22, 0.6)',
          inputBackground: 'rgba(243, 99, 22, 0.2)',
          buttonBackground: 'rgba(243, 99, 22, 0.8)',
        };
      case 'artist':
        return {
          background: { backgroundColor: '#1A0B2E', opacity: 0.9 },
          borderColor: '#9333EA',
          textColor: '#9333EA',
          shadowColor: 'rgba(147, 51, 234, 0.6)',
          inputBackground: 'rgba(147, 51, 234, 0.2)',
          buttonBackground: 'rgba(147, 51, 234, 0.8)',
        };
      case 'both':
      case 'superuser':
        return {
          background: { backgroundColor: '#1C1400', opacity: 0.9 },
          borderColor: '#FFD700',
          textColor: '#FFD700',
          shadowColor: 'rgba(255, 215, 0, 0.6)',
          inputBackground: 'rgba(255, 215, 0, 0.2)',
          buttonBackground: 'rgba(255, 215, 0, 0.8)',
        };
      default:
        return {
          background: { backgroundColor: '#0D1B2A', opacity: 0.9 },
          borderColor: 'rgba(255, 255, 255, 0.4)',
          textColor: '#FFFFFF',
          shadowColor: 'rgba(255, 255, 255, 0.4)',
          inputBackground: 'rgba(255, 255, 255, 0.1)',
          buttonBackground: 'rgba(255, 255, 255, 0.2)',
        };
    }
  };

  const theme = getThemeStyles();

  if (!walletReady && !session) {
    return (
      <View style={[styles.container, theme.background, styles.center]}>
        <Text style={[styles.connectText, { color: theme.textColor }]}>Please sign in and connect your wallet.</Text>
        <GoogleSignInButton />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, theme.background, { opacity: fadeAnim }]}>
      <View style={[styles.navbar, { borderBottomColor: theme.borderColor }]}>
        <View style={styles.navContainer}>
          <TouchableOpacity
            style={styles.logoLink}
            onPress={() => navigation.navigate('Home')}
            accessibilityLabel="Sempai HQ Home"
            accessibilityHint="Navigate to the home screen"
          >
            <Image
              source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
              style={[styles.logo, { borderColor: theme.borderColor }]}
            />
            <Text style={[styles.logoText, { color: theme.textColor }]}>Sempai HQ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuToggle}
            onPress={toggleMenu}
            accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'}
            accessibilityHint={menuOpen ? 'Close the navigation menu' : 'Open the navigation menu'}
          >
            <Icon name={menuOpen ? 'times' : 'bars'} size={24} color={theme.textColor} />
          </TouchableOpacity>
          {menuOpen && (
            <View style={[styles.navLinks, { shadowColor: theme.shadowColor }]}>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => navigation.navigate('Home')}
                accessibilityLabel="Home"
                accessibilityHint="Navigate to the home screen"
              >
                <Icon name="home" size={20} color="#fff" />
                <Text style={styles.navLinkText}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => navigation.navigate('CreatorsProfile', { id: userId })}
                accessibilityLabel="View Profile"
                accessibilityHint="View your creator profile"
              >
                <Icon name="exchange-alt" size={20} color="#fff" />
                <Text style={styles.navLinkText}>View Profile</Text>
              </TouchableOpacity>
              <GoogleSignInButton />
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.main}>
        <View style={[styles.profileSection, { borderColor: theme.borderColor, shadowColor: theme.shadowColor }]}>
          <Text style={[styles.title, { color: theme.textColor }]}>
            <Icon name="user" size={24} color={theme.textColor} /> Edit Profile
          </Text>

          <View style={[styles.balanceCard, { borderColor: theme.borderColor, backgroundColor: theme.inputBackground }]}>
            <View style={styles.balanceItem}>
              <Icon name="gem" size={20} color="#fff" />
              <Text style={styles.balanceText}>Amethyst: {balance.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceItem}>
              <Icon name="bolt" size={20} color="#fff" />
              <Text style={styles.balanceText}>Multiplier: {rewardAmount}</Text>
            </View>
          </View>

          {!session ? (
            <View style={styles.connectWrapper}>
              <Text style={styles.connectText}>Sign in to edit your profile</Text>
              <GoogleSignInButton />
            </View>
          ) : (
            <Text style={styles.walletText}>
              <Icon name="user" size={16} color="#fff" /> {formatUsername(embeddedWallet?.publicKey?.toString() || '')}
            </Text>
          )}

          {referralMessage && (
            <View style={[styles.alertInfo, { backgroundColor: theme.inputBackground }]}>
              <Text style={styles.alertText}>{referralMessage}</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textColor }]}>
                <Icon name="user" size={20} color={theme.textColor} /> Username
              </Text>
              <TextInput
                style={[styles.input, { borderColor: theme.borderColor, backgroundColor: theme.inputBackground }]}
                value={name}
                onChangeText={setName}
                placeholder="Enter your username"
                placeholderTextColor="#888"
                editable={walletReady && !isSaving}
                accessibilityLabel="Username input"
                accessibilityHint="Enter your preferred username"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textColor }]}>
                <Icon name="envelope" size={20} color={theme.textColor} /> Email
              </Text>
              <TextInput
                style={[styles.input, { borderColor: theme.borderColor, backgroundColor: theme.inputBackground }]}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#888"
                keyboardType="email-address"
                editable={walletReady && !isSaving}
                accessibilityLabel="Email input"
                accessibilityHint="Enter your email address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textColor }]}>
                <Icon name="twitter" size={20} color={theme.textColor} /> X Username
              </Text>
              {xAccount && twitterVerified ? (
                <Text style={styles.verifiedText}>Verified X Account: @{xAccount}</Text>
              ) : (
                <View style={styles.inputWithButton}>
                  <TextInput
                    style={[styles.input, { borderColor: theme.borderColor, backgroundColor: theme.inputBackground }]}
                    value={twitterInput}
                    onChangeText={setTwitterInput}
                    placeholder="e.g., @username or https://x.com/username"
                    placeholderTextColor="#888"
                    editable={walletReady && !isVerifying && !isSaving}
                    accessibilityLabel="X username input"
                    accessibilityHint="Enter your X username or profile URL"
                  />
                  <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                    <TouchableOpacity
                      style={[styles.verifyButton, { backgroundColor: theme.buttonBackground }]}
                      onPress={() => {
                        animateButton();
                        validateTwitterUsername();
                      }}
                      disabled={!walletReady || isVerifying || isSaving || !twitterInput}
                      accessibilityLabel="Verify X Username"
                      accessibilityHint="Verify your X username"
                    >
                      {isVerifying ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.buttonText}>Verify</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              )}
            </View>

            {twitterError && (
              <View style={styles.alertError}>
                <Text style={styles.alertText}>{twitterError}</Text>
              </View>
            )}
            {twitterVerified && xAccount && (
              <View style={styles.alertSuccess}>
                <Text style={styles.alertText}>X username @{xAccount} verified!</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textColor }]}>
                <Icon name="camera" size={20} color={theme.textColor} /> Profile Image
              </Text>
              <View style={styles.imageGroup}>
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                  <TouchableOpacity
                    style={[styles.imageLabel, { borderColor: theme.borderColor, backgroundColor: theme.inputBackground }]}
                    onPress={() => {
                      animateButton();
                      handleImageChange();
                    }}
                    disabled={!walletReady || isSaving}
                    accessibilityLabel="Upload Profile Image"
                    accessibilityHint="Select a profile image from your device"
                  >
                    <Icon name="pen" size={16} color={theme.textColor} />
                    <Text style={styles.buttonText}>Upload Image</Text>
                  </TouchableOpacity>
                </Animated.View>
                {imageUrl && (
                  <Image source={{ uri: imageUrl }} style={[styles.previewImage, { shadowColor: theme.shadowColor }]} />
                )}
              </View>
            </View>

            {isCreator && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textColor }]}>
                    <Icon name="book" size={20} color={theme.textColor} /> Bio
                  </Text>
                  <TextInput
                    style={[styles.textarea, { borderColor: theme.borderColor, backgroundColor: theme.inputBackground }]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell us about yourself"
                    placeholderTextColor="#888"
                    multiline
                    numberOfLines={4}
                    editable={walletReady && !isSaving}
                    accessibilityLabel="Bio input"
                    accessibilityHint="Enter a short biography"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textColor }]}>
                    <Icon name="discord" size={20} color={theme.textColor} /> Discord ID
                  </Text>
                  <TextInput
                    style={[styles.input, { borderColor: theme.borderColor, backgroundColor: theme.inputBackground }]}
                    value={discord}
                    onChangeText={setDiscord}
                    placeholder="e.g., user#1234"
                    placeholderTextColor="#888"
                    editable={walletReady && !isSaving}
                    accessibilityLabel="Discord ID input"
                    accessibilityHint="Enter your Discord ID"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textColor }]}>
                    <Icon name="globe" size={20} color={theme.textColor} /> Website
                  </Text>
                  <TextInput
                    style={[styles.input, { borderColor: theme.borderColor, backgroundColor: theme.inputBackground }]}
                    value={website}
                    onChangeText={setWebsite}
                    placeholder="e.g., https://yourwebsite.com"
                    placeholderTextColor="#888"
                    editable={walletReady && !isSaving}
                    accessibilityLabel="Website input"
                    accessibilityHint="Enter your website URL"
                  />
                </View>
              </>
            )}

            {error && (
              <View style={styles.alertError}>
                <Text style={styles.alertText}>{error}</Text>
              </View>
            )}
            {success && (
              <View style={styles.alertSuccess}>
                <Text style={styles.alertText}>{success}</Text>
              </View>
            )}

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: theme.buttonBackground }]}
                onPress={() => {
                  animateButton();
                  handleSubmit();
                }}
                disabled={!walletReady || isSaving}
                accessibilityLabel="Save Changes"
                accessibilityHint="Save your profile changes"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="save" size={16} color="#fff" />
                    <Text style={styles.buttonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      {(error || success) && (
        <Modal
          isVisible={!!(error || success)}
          onBackdropPress={() => {
            setError('');
            setSuccess('');
          }}
          style={styles.modal}
        >
          <View style={[styles.modalContent, { backgroundColor: error ? '#DC3545' : '#28A745' }]}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setError('');
                setSuccess('');
              }}
              accessibilityLabel="Close message"
              accessibilityHint="Dismiss the error or success message"
            >
              <Icon name="times" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalText}>{error || success}</Text>
          </View>
        </Modal>
      )}
    </Animated.View>
  );
};

export default EditProfileScreen;