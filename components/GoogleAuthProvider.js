import React, { createContext, useContext, useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { supabase } from '../services/supabaseClient';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

// Add global error handler for debugging
const logError = (error, context) => {
  console.error(`[${context}] Error:`, error?.message || error);
  console.error('Error details:', JSON.stringify(error, null, 2));
  if (error?.stack) {
    console.error('Stack trace:', error.stack);
  }
};

WebBrowser.maybeCompleteAuthSession();

export const GoogleAuthContext = createContext();

// Move client ID declarations outside try block
const googleClientId = Constants.expoConfig?.extra?.googleClientId || process.env.GOOGLE_WEB_CLIENT_ID;
const googleAndroidClientId = Constants.expoConfig?.extra?.googleAndroidClientId || process.env.GOOGLE_ANDROID_CLIENT_ID;
const redirectUri = makeRedirectUri({
  useProxy: true,
  preferLocalhost: true
});

// Log initialization info
try {
  console.log('=== Google Auth Provider Initialization ===');
  console.log('App Package Name:', Application.applicationId);
  console.log('Expo Constants available:', !!Constants.expoConfig);
  console.log('Google Web Client ID configured:', !!googleClientId);
  console.log('Google Android Client ID configured:', !!googleAndroidClientId);
  console.log('Redirect URI:', redirectUri);
} catch (error) {
  logError(error, 'GoogleAuthProvider Initialization');
}

export const GoogleAuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: googleAndroidClientId,
    webClientId: googleClientId,
    expoClientId: googleClientId,
    responseType: "id_token",
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
    useProxy: true
  });

  useEffect(() => {
    if (response?.type === 'success') {
      console.log('Google Auth Response Success');
      const { id_token } = response.params;
      handleSignIn(id_token);
    } else if (response?.type === 'error') {
      const errorMsg = response.error?.message || 'Unknown error';
      console.error('Google Auth Response Error:', errorMsg);
      logError(response.error, 'Google Auth Response');
      setError('Google authentication failed: ' + errorMsg);
    }
  }, [response]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('Checking Supabase session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        console.log('Session check result:', session ? 'Session found' : 'No session');
        setSession(session);
      } catch (err) {
        logError(err, 'Session Check');
        setError('Failed to check authentication status');
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const handleSignIn = async (idToken) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (signInError) throw signInError;

      setSession(data.session);
      return data.session;
    } catch (err) {
      setError(err.message || 'Failed to sign in');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    try {
      await promptAsync();
    } catch (err) {
      setError('Failed to start sign in process');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
    } catch (err) {
      setError('Failed to sign out');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    session,
    loading,
    error,
    signIn,
    signOut,
  };

  return (
    <GoogleAuthContext.Provider value={value}>
      {children}
    </GoogleAuthContext.Provider>
  );
};

export const useGoogleAuth = () => {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
};

export default GoogleAuthProvider;