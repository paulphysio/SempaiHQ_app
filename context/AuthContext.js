import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skippedSignIn, setSkippedSignIn] = useState(false);

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

  useEffect(() => {
    const restoreSession = async () => {
      try {
        setIsLoading(true);
        console.log('[restoreSession] Starting session restore');

        // Check for stored user data first
        const storedUser = await AsyncStorage.getItem('user');
        const skipped = await AsyncStorage.getItem('skippedSignIn');
        console.log('[restoreSession] Stored User:', storedUser, 'Skipped:', skipped);

        if (storedUser) {
          // Restore user from AsyncStorage if available
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setSkippedSignIn(skipped === 'true');
          console.log('[restoreSession] Restored user from AsyncStorage:', parsedUser);
        }

        // Check Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[restoreSession] Supabase Session:', session);
        let userData = session?.user ?? null;

        if (userData) {
          // If there's a valid Supabase session, sync with database
          const syncedUser = await syncUserWithDatabase(userData);
          if (syncedUser) {
            setUser(syncedUser);
            await AsyncStorage.setItem('user', JSON.stringify(syncedUser));
            setSkippedSignIn(false);
            console.log('[restoreSession] Synced user from Supabase:', syncedUser);
          }
        } else if (!storedUser && skipped === 'true') {
          // If no session but skippedSignIn is true, restore guest user
          const guestUser = {
            id: `guest_${Date.now()}`,
            name: 'Guest',
            email: null,
            isGuest: true,
          };
          await AsyncStorage.setItem('user', JSON.stringify(guestUser));
          setUser(guestUser);
          setSkippedSignIn(true);
          console.log('[restoreSession] Created new guest user:', guestUser);
        } else if (!storedUser && !skipped) {
          // No session, no stored user, and no skipped sign-in: set user to null
          setUser(null);
          setSkippedSignIn(false);
          console.log('[restoreSession] No user or session found');
        }
      } catch (err) {
        console.error('[restoreSession] Error:', err.message);
        setError('Failed to restore session');
      } finally {
        setIsLoading(false);
        console.log('[restoreSession] Completed, User:', user);
      }
    };

    restoreSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        setIsLoading(true);
        console.log('[onAuthStateChange] Event:', event, 'Session:', session);
        let userData = session?.user ?? null;

        // Always check stored user first
        const storedUser = await AsyncStorage.getItem('user');
        const skipped = await AsyncStorage.getItem('skippedSignIn');
        console.log('[onAuthStateChange] Stored User:', storedUser, 'Skipped:', skipped);

        if (userData) {
          // If there's a valid session, sync with database
          const syncedUser = await syncUserWithDatabase(userData);
          if (syncedUser) {
            setUser(syncedUser);
            await AsyncStorage.setItem('user', JSON.stringify(syncedUser));
            setSkippedSignIn(false);
            console.log('[onAuthStateChange] Synced user:', syncedUser);
          }
        } else if (storedUser) {
          // If no session but stored user exists, restore it
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setSkippedSignIn(skipped === 'true');
          console.log('[onAuthStateChange] Restored user from AsyncStorage:', parsedUser);
        } else if (skipped === 'true') {
          // If no session or stored user but skippedSignIn is true, create guest user
          const guestUser = {
            id: `guest_${Date.now()}`,
            name: 'Guest',
            email: null,
            isGuest: true,
          };
          await AsyncStorage.setItem('user', JSON.stringify(guestUser));
          setUser(guestUser);
          setSkippedSignIn(true);
          console.log('[onAuthStateChange] Created new guest user:', guestUser);
        } else {
          // No session, no stored user, no skipped sign-in: set user to null
          setUser(null);
          setSkippedSignIn(false);
          console.log('[onAuthStateChange] No user or session found');
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
        options: { redirectTo: 'sempaihq://auth-callback' },
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
      // Clear all stored data only on explicit sign-out
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('skippedSignIn');
      await AsyncStorage.removeItem('walletAddress');
      await AsyncStorage.removeItem('hasReferralCode');
      await secureStoreWrapper.deleteItemAsync('walletPublicKey');
      await secureStoreWrapper.deleteItemAsync('walletPrivateKey');
      await secureStoreWrapper.deleteItemAsync('walletAddress');
      await secureStoreWrapper.deleteItemAsync('transactionPassword');
      await secureStoreWrapper.deleteItemAsync('useBiometrics');
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