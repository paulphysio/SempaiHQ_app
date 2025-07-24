import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, Linking, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useGoogleAuth } from './GoogleAuthProvider';
import { useSystemUi } from '../context/SystemUiContext';
import ConnectButton from './ConnectButton';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import TokenClaimModal from './TokenClaimModal';
import GoogleSignInButton from './GoogleSignInButton';
import styles from '../styles/SignInStyles';

const SignIn = ({ onSkip, onWalletConnect }) => {
  const navigation = useNavigation();
  const { loading: googleLoading, session, error: googleError } = useGoogleAuth();
  const { signIn: appSignIn, skipSignIn, user, isAuthenticated, signOut } = useAuth();
  const { setIsSystemUiVisible } = useSystemUi();
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);

  useEffect(() => {
    const syncAuthState = async () => {
      if (session?.user && !user) {
        await appSignIn(session.user);
      }
    };
    syncAuthState();
  }, [session, user, appSignIn]);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigation.replace('Home');
    }
  }, [isAuthenticated, user, navigation]);

  const handleSkip = async () => {
    try {
      await skipSignIn();
      if (onSkip) {
        onSkip();
      }
    } catch (error) {
      console.error('Error skipping sign in:', error);
      Alert.alert('Error', 'Failed to skip sign in. Please try again.');
    }
  };

  const handleConnect = async () => {
    try {
      setWalletLoading(true);
    } catch (error) {
      console.error('Wallet connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect wallet. Please try again.');
    } finally {
      setWalletLoading(false);
    }
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    if (onWalletConnect) {
      onWalletConnect(null);
    }
  };

  useEffect(() => {
    setIsSystemUiVisible(false);
    return () => setIsSystemUiVisible(true);
  }, [setIsSystemUiVisible]);

  useEffect(() => {
    if (user?.wallet_address) {
      setWalletAddress(user.wallet_address);
      if (onWalletConnect) {
        onWalletConnect(user.wallet_address);
      }
    }
  }, [user, onWalletConnect]);

  const handleWalletConnect = useCallback(
    (keypair) => {
      const address = keypair.publicKey.toString();
      setWalletAddress(address);
      if (onWalletConnect) {
        onWalletConnect(address);
      }
      navigation.replace('Home');
    },
    [onWalletConnect, navigation]
  );

  const handleSuccessfulSignIn = useCallback(async () => {
    try {
      const { data: userHistory } = await supabase
        .from('user_activity')
        .select('first_login')
        .eq('user_id', user?.id)
        .single();

      if (!userHistory?.first_login) {
        setShowTokenModal(true);
        await supabase
          .from('user_activity')
          .upsert({
            user_id: user.id,
            first_login: new Date().toISOString(),
          });
      } else {
        navigation.replace('Home');
      }
    } catch (error) {
      console.error('Error checking user history:', error);
      navigation.replace('Home');
    }
  }, [user, navigation]);

  useEffect(() => {
    if (isAuthenticated && user) {
      handleSuccessfulSignIn();
    }
  }, [isAuthenticated, user, handleSuccessfulSignIn]);

  if (isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.profileContainer}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.profilePlaceholder]}>
                <Text style={styles.profileInitial}>
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <Text style={styles.userName}>{user?.name || user?.email?.split('@')[0] || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <GoogleSignInButton />
          </View>

          {!walletAddress && (
            <View style={styles.walletSection}>
              <Text style={styles.sectionTitle}>Connect Your Wallet</Text>
              <ConnectButton onConnect={handleWalletConnect} onDisconnect={handleDisconnect} />
            </View>
          )}

          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By connecting your wallet, you agree to our{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://www.sempaihq.xyz/terms')}
              >
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://www.sempaihq.xyz/privacy-policy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </View>

        <TokenClaimModal visible={showTokenModal} onClose={() => setShowTokenModal(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to SempaiHQ</Text>

       

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <GoogleSignInButton />

        <TouchableOpacity
          style={[styles.authButton, styles.twitterButton]}
          onPress={() => Alert.alert('Coming Soon', 'Twitter sign-in will be available soon!')}
          disabled={googleLoading || walletLoading}
        >
          <Image
            source={{ uri: 'https://abs.twimg.com/responsive-web/client-web/icon-ios.svg' }}
            style={styles.icon}
          />
          <Text style={styles.buttonText}>Continue with Twitter</Text>
        </TouchableOpacity>

        {!walletAddress && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={googleLoading || walletLoading}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        )}

        {(googleLoading || walletLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF9900" />
            <Text style={styles.loadingText}>
              {googleLoading ? 'Signing you in...' : 'Connecting wallet...'}
            </Text>
          </View>
        )}

        {walletAddress && (
          <View style={styles.connectedWallet}>
            <Text style={styles.connectedText}>
              Connected: {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
            </Text>
          </View>
        )}

        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://www.sempaihq.xyz/terms')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://www.sempaihq.xyz/privacy-policy')}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>

      <TokenClaimModal visible={showTokenModal} onClose={() => setShowTokenModal(false)} />
    </View>
  );
};

export default SignIn;