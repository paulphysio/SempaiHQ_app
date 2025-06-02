// src/context/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const AuthContext = createContext();

const secureStoreWrapper = {
  deleteItemAsync: async (key) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
      console.log(`[secureStoreWrapper] Deleted ${key}`);
    } catch (err) {
      console.error(`[secureStoreWrapper] Error deleting ${key}:`, err.message);
      throw err;
    }
  },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skippedSignIn, setSkippedSignIn] = useState(false);

  const syncUserWithDatabase = async (userData) => {
    if (!userData || userData.isGuest) return null;
    try {
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', userData.id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw userError;
      }

      if (!existingUser) {
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

      return {
        id: userData.id,
        email: userData.email,
        name: userData.user_metadata?.full_name || userData.email.split('@')[0],
        isGuest: false,
      };
    } catch (err) {
      console.error('[syncUserWithDatabase] Error:', err.message);
      throw err;
    }
  };

  useEffect(() => {
    const getSession = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        let userData = session?.user ?? null;

        if (userData) {
          const syncedUser = await syncUserWithDatabase(userData);
          if (syncedUser) {
            setUser(syncedUser);
            await AsyncStorage.setItem('user', JSON.stringify(syncedUser));
            setSkippedSignIn(false);
          }
        } else {
          const skipped = await AsyncStorage.getItem('skippedSignIn');
          if (skipped === 'true') {
            setSkippedSignIn(true);
            const guestUser = {
              id: `guest_${Date.now()}`,
              name: 'Guest',
              email: null,
              isGuest: true,
            };
            await AsyncStorage.setItem('user', JSON.stringify(guestUser));
            setUser(guestUser);
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.error('[getSession] Error:', err.message);
        setError('Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        setIsLoading(true);
        let userData = session?.user ?? null;

        if (userData) {
          const syncedUser = await syncUserWithDatabase(userData);
          if (syncedUser) {
            setUser(syncedUser);
            await AsyncStorage.setItem('user', JSON.stringify(syncedUser));
            setSkippedSignIn(false);
          }
        } else {
          const skipped = await AsyncStorage.getItem('skippedSignIn');
          if (skipped === 'true') {
            setSkippedSignIn(true);
            const guestUser = {
              id: `guest_${Date.now()}`,
              name: 'Guest',
              email: null,
              isGuest: true,
            };
            await AsyncStorage.setItem('user', JSON.stringify(guestUser));
            setUser(guestUser);
          } else {
            setUser(null);
            setSkippedSignIn(false);
            await AsyncStorage.removeItem('user');
          }
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'sempaihq://auth-callback' },
      });
      if (error) throw error;
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
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('skippedSignIn');
      await AsyncStorage.removeItem('walletAddress');
      await secureStoreWrapper.deleteItemAsync('walletPublicKey');
      await secureStoreWrapper.deleteItemAsync('walletPrivateKey');
      await secureStoreWrapper.deleteItemAsync('walletAddress');
      setUser(null);
      setSkippedSignIn(false);
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
      await AsyncStorage.setItem('skippedSignIn', 'true');
      setSkippedSignIn(true);
      const guestUser = {
        id: `guest_${Date.now()}`,
        name: 'Guest',
        email: null,
        isGuest: true,
      };
      await AsyncStorage.setItem('user', JSON.stringify(guestUser));
      setUser(guestUser);
      await AsyncStorage.removeItem('walletAddress');
      await secureStoreWrapper.deleteItemAsync('walletPublicKey');
      await secureStoreWrapper.deleteItemAsync('walletPrivateKey');
      await secureStoreWrapper.deleteItemAsync('walletAddress');
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