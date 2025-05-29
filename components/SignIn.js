import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, Linking, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useGoogleAuth } from './GoogleAuthProvider';
import { useSystemUi } from '../context/SystemUiContext';
import  ConnectButton  from './ConnectButton';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import styles from '../styles/SignInStyles';

const SignIn = ({ onSkip, onWalletConnect }) => {
  const { signIn: signInWithGoogle, loading: googleLoading } = useGoogleAuth();
  const { user, isAuthenticated, signOut } = useAuth();
  const { setIsSystemUiVisible } = useSystemUi();
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);

  
  // Handle skip functionality
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };
  
  // Handle wallet connection
  const handleConnect = async () => {
    try {
      setWalletLoading(true);
      // The actual connection will be handled by the ConnectButton component
      // We'll get the address through the onConnect callback
    } catch (error) {
      console.error('Wallet connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect wallet. Please try again.');
    } finally {
      setWalletLoading(false);
    }
  };

  // Handle wallet disconnection
  const handleDisconnect = () => {
    setWalletAddress(null);
    if (onWalletConnect) {
      onWalletConnect(null);
    }
  };
  
  // Hide system UI when component mounts
  useEffect(() => {
    setIsSystemUiVisible(false);
    return () => setIsSystemUiVisible(true);
  }, []);

  // Update wallet address when user changes
  useEffect(() => {
    if (user?.wallet_address) {
      setWalletAddress(user.wallet_address);
      if (onWalletConnect) {
        onWalletConnect(user.wallet_address);
      }
    }
  }, [user]);

  // Handle successful wallet connection
  const handleWalletConnect = useCallback((keypair) => {
    const address = keypair.publicKey.toString();
    setWalletAddress(address);
    if (onWalletConnect) {
      onWalletConnect(address);
    }
  }, [onWalletConnect]);

  // If user is already authenticated, show profile and wallet connection
  if (isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.profileContainer}>
            {user?.picture ? (
              <Image 
                source={{ uri: user.picture }} 
                style={styles.profileImage} 
              />
            ) : (
              <View style={[styles.profileImage, styles.profilePlaceholder]}>
                <Text style={styles.profileInitial}>
                  {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <Text style={styles.userName}>{user?.name || user?.email?.split('@')[0] || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            
            <TouchableOpacity 
              style={styles.signOutButton}
              onPress={async () => {
                try {
                  await supabase.auth.signOut();
                  await signOut();
                  setWalletAddress(null);
                  if (onWalletConnect) {
                    onWalletConnect(null);
                  }
                } catch (error) {
                  console.error('Error signing out:', error);
                }
              }}
            >
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
          
          {!walletAddress && (
            <View style={styles.walletSection}>
              <Text style={styles.sectionTitle}>Connect Your Wallet</Text>
              <ConnectButton 
                onConnect={handleWalletConnect}
                onDisconnect={() => {
                  setWalletAddress(null);
                  if (onWalletConnect) {
                    onWalletConnect(null);
                  }
                }}
              />
            </View>
          )}
          
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By connecting your wallet, you agree to our{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.sempaihq.xyz/terms')}>
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.sempaihq.xyz/privacy-policy')}>
                Privacy Policy
              </Text>
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to SempaiHQ</Text>
        
        {/* Wallet Connection Section */}
        <View style={styles.walletSection}>
          <Text style={styles.sectionTitle}>Connect Your Wallet</Text>
          <ConnectButton 
            onConnect={handleWalletConnect}
            onDisconnect={handleDisconnect}
          />
        </View>
        
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>
        
        {/* Google Sign In Button */}
        <TouchableOpacity 
          style={[styles.authButton, styles.googleButton]} 
          onPress={signInWithGoogle}
          disabled={googleLoading || walletLoading}
        >
          <Image 
            source={{ uri: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_24dp.png' }}
            style={styles.icon}
          />
          <Text style={styles.buttonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Twitter Sign In Button */}
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

        {/* Terms and Conditions */}
        {/* Skip Button - Only show if not connected */}
        {!walletAddress && (
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={handleSkip}
            disabled={googleLoading || walletLoading}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        )}
        
        {/* Loading indicators */}
        {(googleLoading || walletLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF9900" />
            <Text style={styles.loadingText}>
              {googleLoading ? 'Signing you in...' : 'Connecting wallet...'}
            </Text>
          </View>
        )}
        
        {/* Connected wallet info */}
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
            <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.sempaihq.xyz/terms')}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.sempaihq.xyz/privacy-policy')}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

export default SignIn;
