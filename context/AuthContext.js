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
    }
  },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [skippedSignIn, setSkippedSignIn] = useState(false);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userData = session?.user ?? null;
        if (userData) {
          setUser({
            id: userData.id,
            email: userData.email,
            name: userData.user_metadata?.full_name || userData.user_metadata?.name || userData.email.split('@')[0],
            isGuest: false,
          });
          await AsyncStorage.setItem('user', JSON.stringify({
            id: userData.id,
            email: userData.email,
            name: userData.user_metadata?.full_name || userData.user_metadata?.name,
            isGuest: false,
          }));
        }

        const skipped = await AsyncStorage.getItem('skippedSignIn');
        if (skipped === 'true' && !userData) {
          setSkippedSignIn(true);
          const guestUser = {
            id: `guest_${Date.now()}`,
            name: 'Guest',
            email: null,
            isGuest: true,
          };
          await AsyncStorage.setItem('user', JSON.stringify(guestUser));
          setUser(guestUser);
        }
      } catch (error) {
        console.error('[getSession] Error:', error.message);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const userData = session?.user ?? null;
      if (userData) {
        setUser({
          id: userData.id,
          email: userData.email,
          name: userData.user_metadata?.full_name || userData.user_metadata?.name || userData.email.split('@')[0],
          isGuest: false,
        });
        AsyncStorage.setItem('user', JSON.stringify({
          id: userData.id,
          email: userData.email,
          name: userData.user_metadata?.full_name || userData.user_metadata?.name,
          isGuest: false,
        }));
        setSkippedSignIn(false);
      } else {
        const checkSkipped = async () => {
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
        };
        checkSkipped();
      }
      setIsLoading(false);
    });

    return () => authListener.subscription?.unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'sempaihq://auth-callback' },
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[signIn] Error:', error.message);
      return false;
    }
  };

  const signOut = async () => {
    try {
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
    } catch (error) {
      console.error('[signOut] Error:', error.message);
      return false;
    }
  };

  const skipSignIn = async () => {
    try {
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
    } catch (error) {
      console.error('[skipSignIn] Error:', error.message);
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
        isAuthenticated: !!user || skippedSignIn,
        skippedSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;