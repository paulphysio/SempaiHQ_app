import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from './ConnectButton';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export const GoogleAuthContext = createContext();

// Get the client IDs from Constants
const constants = Constants.expoConfig || {};
const extra = constants.extra || {};
const googleClientId = extra.googleClientId;
const googleAndroidClientId = extra.googleAndroidClientId;

// Validate configuration
if (!googleClientId || !googleAndroidClientId) {
  console.error('Missing Google OAuth configuration:', {
    webClientId: googleClientId,
    androidClientId: googleAndroidClientId,
    platform: Platform.OS
  });
}

// Fallback values if constants are not available
const fallbackGoogleClientId = process.env.GOOGLE_WEB_CLIENT_ID || 'your-web-client-id';
const fallbackGoogleAndroidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID || 'your-android-client-id';

// Use fallbacks if main values are not available
const finalGoogleClientId = googleClientId || fallbackGoogleClientId;
const finalGoogleAndroidClientId = googleAndroidClientId || fallbackGoogleAndroidClientId;

// Validate required configuration
if (!googleClientId || !googleAndroidClientId) {
  console.error('Missing required Google OAuth configuration:', {
    webClientId: googleClientId,
    androidClientId: googleAndroidClientId,
    extraConfig: Constants.expoConfig?.extra
  });
}

// Configure the redirect URI based on environment
// For development in Expo Go, we need to handle the specific redirect URI
// that Google is expecting, which appears to be http://localhost:8081
const redirectUri = __DEV__ 
  ? 'http://localhost:8081'
  : makeRedirectUri({
      scheme: Constants.expoConfig?.scheme || 'sempaihq'
    });

console.log('Configured redirect URI:', redirectUri);

// Log configuration
console.log('Android Auth Configuration:', {
  isDev: __DEV__,
  usingExpoProxy: __DEV__,
  redirectUri
});

console.log('Auth Configuration:', {
  platform: Platform.OS,
  androidClientId: finalGoogleAndroidClientId,
  webClientId: finalGoogleClientId,
  redirectUri,
  scheme: Constants.expoConfig?.scheme,
  isDev: __DEV__
});

export const GoogleAuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { createEmbeddedWallet, disconnectWallet } = useContext(EmbeddedWalletContext);

  // Optimized auth request configuration for all environments
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: finalGoogleAndroidClientId,
    webClientId: finalGoogleClientId,
    expoClientId: finalGoogleClientId, // Add this for Expo Go
    responseType: "id_token",
    scopes: ['openid', 'profile', 'email'],
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
    redirectUri: redirectUri,
    // Only use proxy if not using localhost directly
    useProxy: __DEV__ && redirectUri !== 'http://localhost:8081'
  });

  // Add debug logging for configuration
  console.log('Android Auth Configuration:', {
    androidClientId: finalGoogleAndroidClientId,
    usingExpoProxy: __DEV__,
    isDev: __DEV__
  });

  // Handle Google auth response with detailed logging
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      console.log('Successful auth response received');
      handleGoogleResponse(id_token);
    } else if (response?.type === 'error') {
      const errorMsg = response.error?.message || 'Failed to authenticate with Google';
      console.error('Auth Response Error:', {
        error: response.error,
        errorType: response.error?.name,
        errorMessage: response.error?.message,
        redirectUri,
        platform: Platform.OS,
        isDev: __DEV__,
        responseType: response?.type,
        params: response?.params
      });
      setError(errorMsg);
      Alert.alert('Authentication Error', errorMsg);
      setLoading(false);
    } else if (response) {
      console.log('Received response of type:', response.type, response);
    }
  }, [response]);

  const handleGoogleResponse = async (idToken) => {
    try {
      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      setLoading(true);
      setError(null);
      console.log('Starting Supabase sign-in with Google token...');
      
      const { data: { user }, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (signInError) {
        console.error('Supabase sign-in error:', signInError);
        throw signInError;
      }

      console.log('Supabase sign-in successful:', {
        userId: user.id,
        email: user.email,
        provider: user.app_metadata?.provider
      });

      setSession(user);
      await handlePostSignIn({ user });
    } catch (error) {
      const errorMsg = error.message || 'Failed to complete sign in';
      console.error('Error handling Google response:', {
        error,
        errorMessage: error.message,
        errorCode: error.code,
        provider: error.provider
      });
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle wallet creation after successful sign-in
  const handlePostSignIn = async (currentSession) => {
    if (!currentSession?.user?.id) return;

    try {
      // Check if user already has a wallet
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('id', currentSession.user.id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw userError;
      }

      if (!userData?.wallet_address) {
        console.log('Creating new wallet for user:', currentSession.user.id);
        // Generate a deterministic password based on the user's ID
        const password = `${currentSession.user.id}-${Date.now()}`;
        const result = await createEmbeddedWallet(password);
        
        if (result) {
          // Store wallet info in Supabase
          await supabase
            .from('users')
            .update({
              wallet_address: result.publicKey,
              has_updated_profile: false
            })
            .eq('id', currentSession.user.id);

          // Store the password securely
          await SecureStore.setItemAsync(
            `google-auth-wallet-${currentSession.user.id}`,
            password
          );
        }
      }
    } catch (err) {
      console.error('Error in post sign-in handling:', err);
      Alert.alert('Error', 'Failed to setup wallet. Please try again.');
    }
  };

  const cleanupStorage = async () => {
    try {
      // Get the user ID from the current session
      const userId = session?.user?.id;
      if (userId) {
        // Clear the specific wallet password for this user
        const walletKey = `google-auth-wallet-${userId}`;
        await SecureStore.deleteItemAsync(walletKey);
        console.log(`Cleared SecureStore key: ${walletKey}`);
      }

      // Clear AsyncStorage data
      await AsyncStorage.removeItem('walletAddress');
      console.log('Cleared AsyncStorage walletAddress');
    } catch (err) {
      console.error('Error cleaning up storage:', err);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('Starting sign out process');
      
      // First disconnect wallet
      await disconnectWallet();
      console.log('Wallet disconnected');
      
      // Clean up storage
      await cleanupStorage();
      console.log('Storage cleaned up');
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      console.log('Signed out from Supabase');
      
      // Reset session
      setSession(null);
      
      Alert.alert('Success', 'Successfully signed out');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Sign Out Error', 'Failed to sign out completely. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const forceSignOut = async () => {
    try {
      setLoading(true);
      console.log('Starting force sign out process');
      
      // Clean up storage first
      await cleanupStorage();
      console.log('Storage cleaned up');
      
      // Force disconnect wallet
      try {
        await disconnectWallet();
        console.log('Wallet disconnected');
      } catch (walletError) {
        console.warn('Warning: Error disconnecting wallet:', walletError);
        // Continue with sign out even if wallet disconnect fails
      }
      
      // Force sign out from Supabase
      await supabase.auth.signOut();
      console.log('Signed out from Supabase');
      
      // Reset session
      setSession(null);
      
      Alert.alert('Success', 'Successfully force signed out');
    } catch (error) {
      console.error('Force sign out error:', error);
      Alert.alert('Error', 'Failed to force sign out completely. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth state changed:', event);
      if (currentSession) {
        setSession(currentSession);
        await handlePostSignIn(currentSession);
      } else {
        await disconnectWallet();
        setSession(null);
      }
      setLoading(false);
    });

    // Check current session on mount
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (currentSession) {
        setSession(currentSession);
        await handlePostSignIn(currentSession);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      console.log('Starting Google sign-in flow');

      if (!request) {
        console.error('Google Auth request not initialized:', {
          hasAndroidClientId: !!googleAndroidClientId,
          hasWebClientId: !!googleClientId,
          platform: Platform.OS,
          redirectUri: Platform.OS === 'web' ? redirectUri : 'Native auth (no redirect)'
        });
        throw new Error('Google Auth request was not initialized properly');
      }
      
      console.log('Prompting for Google sign-in...', {
        usingExpoProxy: __DEV__
      });
      
      const result = await promptAsync();
      console.log('Google sign-in result:', {
        type: result.type,
        hasParams: !!result.params,
        hasError: !!result.error,
        params: result.params ? Object.keys(result.params) : null
      });
      
      if (result.type === 'success' && result.params?.id_token) {
        // Handle successful sign-in
        console.log('Successfully received id_token, handling Google response');
        await handleGoogleResponse(result.params.id_token);
      } else {
        console.warn('Sign-in was not successful:', result);
        setLoading(false);
      }
    } catch (error) {
      console.error('Sign in error:', {
        error,
        message: error.message,
        code: error.code
      });
      Alert.alert(
        'Sign In Error',
        error.message || 'Failed to sign in with Google. Please try again.'
      );
      setLoading(false);
    }
  };

  return (
    <GoogleAuthContext.Provider
      value={{
        session,
        signInWithGoogle,
        signOut,
        forceSignOut,
        loading,
        error,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
};

export const useGoogleAuth = () => {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}; 