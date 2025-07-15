import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AUTH_STORAGE_KEY = 'authSession';
const USER_STORAGE_KEY = 'user';
const SKIP_STORAGE_KEY = 'skippedSignIn';
const SESSION_EXPIRY_BUFFER = 60 * 60 * 1000; // 1 hour buffer before session expiry

const AuthContext = createContext();

const secureStore = {
  setItemAsync: async (key, value) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error(`Error storing ${key}:`, error);
      // Fall back to AsyncStorage
      await AsyncStorage.setItem(key, value);
    }
  },
  getItemAsync: async (key) => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      } else {
        const value = await SecureStore.getItemAsync(key);
        return value;
      }
    } catch (error) {
      console.error(`Error retrieving ${key}:`, error);
      // Fall back to AsyncStorage
      return await AsyncStorage.getItem(key);
    }
  },
  deleteItemAsync: async (key) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
      // Fall back to AsyncStorage
      await AsyncStorage.removeItem(key);
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skippedSignIn, setSkippedSignIn] = useState(false);

  // Store session securely
  const persistSession = async (session) => {
    if (!session) return;
    
    try {
      const sessionString = JSON.stringify(session);
      await secureStore.setItemAsync(AUTH_STORAGE_KEY, sessionString);
      console.log('[persistSession] Session stored securely');
    } catch (err) {
      console.error('[persistSession] Error storing session:', err.message);
    }
  };

  // Retrieve stored session
  const getPersistedSession = async () => {
    try {
      const sessionString = await secureStore.getItemAsync(AUTH_STORAGE_KEY);
      if (!sessionString) return null;
      
      const session = JSON.parse(sessionString);
      
      // Check if session is expired or about to expire
      if (session.expires_at) {
        const expiresAt = new Date(session.expires_at).getTime();
        const now = Date.now();
        
        // If expired or about to expire within buffer time, return null
        if (expiresAt - now < SESSION_EXPIRY_BUFFER) {
          console.log('[getPersistedSession] Session expired or about to expire');
          await secureStore.deleteItemAsync(AUTH_STORAGE_KEY);
          return null;
        }
      }
      
      return session;
    } catch (err) {
      console.error('[getPersistedSession] Error retrieving session:', err.message);
      return null;
    }
  };

  const syncUserWithDatabase = async (userData) => {
    if (!userData || userData.isGuest) return null;
    try {
      console.log('[syncUserWithDatabase] Syncing user:', userData.id);
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', userData.id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw userError;
      }

      if (!existingUser) {
        console.log('[syncUserWithDatabase] Creating new user entry');
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userData.id,
            email: userData.email,
            name: userData.user_metadata?.full_name || userData.email.split('@')[0],
            has_updated_profile: false,
          });
        if (insertError) throw insertError;
      }

      const syncedUser = {
        id: userData.id,
        email: userData.email,
        name: userData.user_metadata?.full_name || userData.email.split('@')[0],
        isGuest: false,
      };
      console.log('[syncUserWithDatabase] Synced user:', syncedUser);
      return syncedUser;
    } catch (err) {
      console.error('[syncUserWithDatabase] Error:', err.message);
      throw err;
    }
  };

  // Refresh session if needed
  const refreshSessionIfNeeded = async (currentSession) => {
    if (!currentSession) return null;
    
    try {
      // Check if session is close to expiry
      const expiresAt = new Date(currentSession.expires_at).getTime();
      const now = Date.now();
      
      // If session is valid for more than buffer time, return it
      if (expiresAt - now > SESSION_EXPIRY_BUFFER) {
        return currentSession;
      }
      
      console.log('[refreshSessionIfNeeded] Refreshing session');
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[refreshSessionIfNeeded] Error refreshing session:', error.message);
        throw error;
      }
      
      if (data.session) {
        console.log('[refreshSessionIfNeeded] Session refreshed successfully');
        await persistSession(data.session);
        return data.session;
      }
      
      return null;
    } catch (err) {
      console.error('[refreshSessionIfNeeded] Error:', err.message);
      return null;
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        setIsLoading(true);
        console.log('[restoreSession] Starting session restore');

        // Check for stored user data
        const storedUserString = await AsyncStorage.getItem(USER_STORAGE_KEY);
        const skipped = await AsyncStorage.getItem(SKIP_STORAGE_KEY);
        console.log('[restoreSession] Stored User:', storedUserString, 'Skipped:', skipped);
        
        // Try to get persisted session
        let session = await getPersistedSession();
        
        // Refresh the session if it exists
        if (session) {
          session = await refreshSessionIfNeeded(session);
        }
        
        // If session exists, use it
        if (session && session.user) {
          console.log('[restoreSession] Valid session found, syncing with database');
          const syncedUser = await syncUserWithDatabase(session.user);
          if (syncedUser) {
            setUser(syncedUser);
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(syncedUser));
            setSkippedSignIn(false);
          }
        } 
        // If no session but stored user exists
        else if (storedUserString) {
          const parsedUser = JSON.parse(storedUserString);
          
          // If the stored user is not a guest, check with Supabase
          if (!parsedUser.isGuest) {
            // Try to get current session from Supabase
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            
            if (currentSession) {
              // If Supabase has a session, sync and persist it
              const syncedUser = await syncUserWithDatabase(currentSession.user);
              if (syncedUser) {
                setUser(syncedUser);
                await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(syncedUser));
                await persistSession(currentSession);
                setSkippedSignIn(false);
              }
            } else {
              // No Supabase session but we have stored user, keep as guest
              setUser(parsedUser);
              setSkippedSignIn(skipped === 'true');
            }
          } else {
            // Guest user, just use stored data
            setUser(parsedUser);
            setSkippedSignIn(true);
          }
        } 
        // Create guest user if skipped sign-in
        else if (skipped === 'true') {
          const guestUser = {
            id: `guest_${Date.now()}`,
            name: 'Guest',
            email: null,
            isGuest: true,
          };
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(guestUser));
          setUser(guestUser);
          setSkippedSignIn(true);
        } 
        // No user info anywhere
        else {
          setUser(null);
          setSkippedSignIn(false);
        }
      } catch (err) {
        console.error('[restoreSession] Error:', err.message);
        setError('Failed to restore session');
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        console.log('[onAuthStateChange] Event:', event, 'Session:', !!session);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session) {
            setIsLoading(true);
            await persistSession(session);
            const syncedUser = await syncUserWithDatabase(session.user);
            if (syncedUser) {
              setUser(syncedUser);
              await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(syncedUser));
              setSkippedSignIn(false);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          await secureStore.deleteItemAsync(AUTH_STORAGE_KEY);
          // Don't clear the user data here to avoid forcing re-login
          // Only clear when explicitly signing out via the signOut function
        }
      } catch (err) {
        console.error('[onAuthStateChange] Error:', err.message);
        setError('Authentication state change failed');
      } finally {
        setIsLoading(false);
      }
    });

    return () => authListener.subscription?.unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      setError(null);
      console.log('[signIn] Initiating OAuth sign-in');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: 'sempaihq://auth-callback',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });
      if (error) throw error;
      console.log('[signIn] OAuth sign-in initiated successfully');
      return true;
    } catch (err) {
      console.error('[signIn] Error:', err.message);
      setError(`Sign-in failed: ${err.message}`);
      return false;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      console.log('[signOut] Signing out user:', user?.id);
      await supabase.auth.signOut();
      
      // Clear all stored data on explicit sign-out
      await secureStore.deleteItemAsync(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      await AsyncStorage.removeItem(SKIP_STORAGE_KEY);
      await AsyncStorage.removeItem('walletAddress');
      await AsyncStorage.removeItem('hasReferralCode');
      
      try {
        await secureStore.deleteItemAsync('walletData');
        await secureStore.deleteItemAsync('useBiometrics');
      } catch (err) {
        console.error('[signOut] Error clearing wallet data:', err.message);
      }
      
      setUser(null);
      setSkippedSignIn(false);
      console.log('[signOut] Sign-out completed');
      return true;
    } catch (err) {
      console.error('[signOut] Error:', err.message);
      setError(`Sign-out failed: ${err.message}`);
      return false;
    }
  };

  const skipSignIn = async () => {
    try {
      setError(null);
      console.log('[skipSignIn] Creating guest user');
      await AsyncStorage.setItem(SKIP_STORAGE_KEY, 'true');
      setSkippedSignIn(true);
      const guestUser = {
        id: `guest_${Date.now()}`,
        name: 'Guest',
        email: null,
        isGuest: true,
      };
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(guestUser));
      setUser(guestUser);
      console.log('[skipSignIn] Guest user created:', guestUser);
      return true;
    } catch (err) {
      console.error('[skipSignIn] Error:', err.message);
      setError(`Guest sign-in failed: ${err.message}`);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signOut,
        skipSignIn,
        isAuthenticated: !!user && !user.isGuest,
        skippedSignIn,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;