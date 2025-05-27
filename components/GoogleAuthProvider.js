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
import { useAuth } from '../context/AuthContext';

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

// Configure the redirect URI
// For mobile, let Expo handle the auth session with its proxy
// For web, use localhost or a production domain depending on environment
const redirectUri = makeRedirectUri({
  useProxy: Platform.OS !== 'web',
  preferLocalhost: __DEV__ && Platform.OS === 'web'
});

// Log the redirect URI being used for debugging
console.log(`Using redirect URI: ${redirectUri} on platform: ${Platform.OS}`);

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
  const { signIn } = useAuth();

  // Optimized auth request configuration for Expo builds
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: finalGoogleAndroidClientId,
    webClientId: finalGoogleClientId,
    expoClientId: finalGoogleClientId, // For Expo Go
    responseType: "id_token",
    scopes: ['openid', 'profile', 'email'],
    extraParams: {
      access_type: 'offline',
      prompt: 'select_account',  // Force account selection every time
    },
    redirectUri: redirectUri,
    // Always use Expo's auth proxy for all platforms to ensure popup behavior
    useProxy: true
  });
  
  // Log important configuration details
  console.log('Google Auth Configuration:', {
    platform: Platform.OS,
    isDev: __DEV__,
    usingProxy: Platform.OS !== 'web' || (__DEV__ && Platform.OS === 'web'),
    redirectUri: redirectUri
  });

  // Add debug logging for configuration
  console.log('Android Auth Configuration:', {
    androidClientId: finalGoogleAndroidClientId,
    usingExpoProxy: Platform.OS !== 'web' || __DEV__,
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

      // Update the session state
      setSession(user);
      
      // Also update the main AuthContext to reflect the signed-in state
      // This will cause the App.js to re-render and redirect to Home
      await signIn({
        id: user.id,
        email: user.email,
        provider: user.app_metadata?.provider
      });
      
      // Handle wallet creation and other post-signin operations
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
      // Check if user exists in the database
      const { data: userExists, error: checkError } = await supabase
        .from('users')
        .select('id, wallet_address, email')
        .eq('id', currentSession.user.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      let userWalletAddress = null;
      let newUserCreated = false;

      // If user doesn't exist, create a new user record
      if (!userExists) {
        console.log('Creating new user account:', currentSession.user.id);
        
        // Generate a deterministic password based on the user's ID
        const password = `${currentSession.user.id}-${Date.now()}`;
        const walletResult = await createEmbeddedWallet(password);
        
        if (!walletResult) {
          throw new Error('Failed to create wallet for new user');
        }

        userWalletAddress = walletResult.publicKey;
        
        // Create new user in the database
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: currentSession.user.id,
            email: currentSession.user.email,
            name: currentSession.user.user_metadata?.full_name || currentSession.user.email?.split('@')[0],
            image: currentSession.user.user_metadata?.avatar_url,
            wallet_address: userWalletAddress,
            has_updated_profile: false,
            isWriter: false,
            isArtist: false,
            isSuperuser: false,
            balance: 0,
            weekly_points: 0
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        console.log('New user created successfully:', newUser.id);
        newUserCreated = true;
        
        // Store the wallet password securely
        await SecureStore.setItemAsync(
          `google-auth-wallet-${currentSession.user.id}`,
          password
        );
      } else if (!userExists.wallet_address) {
        // User exists but doesn't have a wallet
        console.log('Creating new wallet for existing user:', currentSession.user.id);
        const password = `${currentSession.user.id}-${Date.now()}`;
        const walletResult = await createEmbeddedWallet(password);
        
        if (walletResult) {
          userWalletAddress = walletResult.publicKey;
          
          // Update existing user with wallet address
          await supabase
            .from('users')
            .update({
              wallet_address: userWalletAddress,
              has_updated_profile: false
            })
            .eq('id', currentSession.user.id);

          // Store the password securely
          await SecureStore.setItemAsync(
            `google-auth-wallet-${currentSession.user.id}`,
            password
          );
        }
      } else {
        userWalletAddress = userExists.wallet_address;
      }

      // Create wallet balances for the user if a new user was created or wallet was updated
      if ((newUserCreated || !userExists.wallet_address) && userWalletAddress) {
        console.log('Setting up wallet balances for:', currentSession.user.id);
        
        // Create wallet balances for different currencies
        const walletBalances = [
          {
            user_id: currentSession.user.id,
            wallet_address: userWalletAddress,
            chain: 'solana',
            currency: 'SOL',
            amount: 0,
            decimals: 9
          },
          {
            user_id: currentSession.user.id,
            wallet_address: userWalletAddress,
            chain: 'solana',
            currency: 'USDC',
            amount: 0,
            decimals: 6
          }
        ];

        const { error: balancesError } = await supabase
          .from('wallet_balances')
          .insert(walletBalances);

        if (balancesError) {
          console.error('Error creating wallet balances:', balancesError);
          // Continue anyway since the user account is created
        } else {
          console.log('Wallet balances created successfully');
        }
      }
    } catch (err) {
      console.error('Error in post sign-in handling:', err);
      Alert.alert('Error', 'Failed to setup user account or wallet. Please try again.');
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
          redirectUri: redirectUri
        });
        throw new Error('Google Auth request was not initialized properly');
      }
      
      console.log('Prompting for Google sign-in with popup flow...');
      
      // Use a configuration that ensures popup behavior
      const result = await promptAsync({
        useProxy: true,
        showInRecents: true
      });
      
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
      } else if (result.type === 'error') {
        console.error('Sign-in error:', result.error);
        Alert.alert('Sign In Error', 'Failed to sign in with Google. ' + (result.error?.message || 'Please try again.'));
        setLoading(false);
      } else if (result.type === 'dismiss') {
        // Handle user dismissal of the popup
        console.log('User dismissed the authentication popup');
        setLoading(false);
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