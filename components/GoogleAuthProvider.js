import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from './ConnectButton';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

export const GoogleAuthContext = createContext();

export const GoogleAuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const { createEmbeddedWallet, disconnectWallet } = useContext(EmbeddedWalletContext);

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

  // Handle deep link URL
  const handleDeepLink = async (url) => {
    if (!url) return;

    try {
      console.log('Handling deep link:', url);
      // Parse the URL parameters
      const params = url.includes('#') 
        ? new URLSearchParams(url.split('#')[1])
        : new URLSearchParams(url.split('?')[1]);
      
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken) {
        console.log('Got access token, setting session...');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) throw error;
        console.log('Session set successfully');
        setSession(data.session);
        await handlePostSignIn(data.session);
      }
    } catch (err) {
      console.error('Error handling deep link:', err);
      Alert.alert('Error', 'Failed to complete sign in. Please try again.');
    }
  };

  // Set up deep linking
  useEffect(() => {
    // Handle incoming links when app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('Received URL through Linking:', url);
      handleDeepLink(url);
    });

    // Handle initial URL that opened the app
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('Got initial URL:', url);
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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

      // First, warmup the browser to improve load time
      await WebBrowser.warmUpAsync();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'sempai-hq://auth/callback',
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline'
          }
        }
      });

      if (error) {
        console.error('Supabase OAuth error:', error);
        throw error;
      }
      
      if (!data?.url) {
        console.error('No OAuth URL returned');
        throw new Error('No OAuth URL returned');
      }

      console.log('Opening auth URL:', data.url);

      // Open URL in WebBrowser
      const authResponse = await WebBrowser.openAuthSessionAsync(
        data.url,
        'sempai-hq://auth/callback'
      );

      // Clean up browser
      await WebBrowser.coolDownAsync();

      console.log('Auth Response:', authResponse);

      if (authResponse.type === 'success' && authResponse.url) {
        const url = authResponse.url;
        console.log('Success URL:', url);

        // Parse the URL parameters
        let params;
        if (url.includes('#')) {
          params = new URLSearchParams(url.split('#')[1]);
        } else if (url.includes('?')) {
          params = new URLSearchParams(url.split('?')[1]);
        } else {
          throw new Error('No authentication parameters found');
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken) {
          throw new Error('No access token received');
        }

        console.log('Setting session with tokens...');
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }

        console.log('Session set successfully');
        setSession(sessionData.session);
        await handlePostSignIn(sessionData.session);
      } else if (authResponse.type === 'success') {
        // If we got success but no URL, check the current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        if (currentSession) {
          console.log('Session found after auth');
          setSession(currentSession);
          await handlePostSignIn(currentSession);
        } else {
          throw new Error('Authentication failed - no session found');
        }
      } else {
        console.log('Auth response type:', authResponse.type);
        throw new Error('Authentication cancelled or failed');
      }

    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert(
        'Sign In Error',
        error.message || 'Failed to sign in with Google. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await disconnectWallet();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Sign Out Error', 'Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GoogleAuthContext.Provider
      value={{
        session,
        signInWithGoogle,
        signOut,
        loading,
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