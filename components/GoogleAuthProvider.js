import React, { createContext, useContext, useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../services/supabaseClient';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isDev = process.env.NODE_ENV !== 'production';

const logError = (error, context) => {
  if (isDev) {
    console.error(`[${context}] Error:`, error?.message || error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
};

export const GoogleAuthContext = createContext();

const googleWebClientId = Constants.expoConfig?.extra?.googleWebClientId || '63667308763-6kecoi8ndtpqfd065noj278lhlb8j7qt.apps.googleusercontent.com';
const googleAndroidClientId = Constants.expoConfig?.extra?.googleAndroidClientId || '63667308763-kkqi7s6s2ftqg6ksvqnsgkkq8am9fmnl.apps.googleusercontent.com';

// Track sign-in state
let isSigningIn = false;

GoogleSignin.configure({
  webClientId: googleWebClientId,
  androidClientId: googleAndroidClientId,
  scopes: ['profile', 'email', 'openid'],
  offlineAccess: false, // Set to true if you need a server auth code
});

console.log('=== Google Auth Provider Initialization ===');
console.log('Platform: Android');
console.log('Web Client ID:', googleWebClientId);
console.log('Android Client ID:', googleAndroidClientId);

export const GoogleAuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true);
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        setSession(session);
      } catch (err) {
        logError(err, 'Session Check');
        setError('Failed to check authentication status');
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      setSession(session);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signIn = async () => {
    if (isSigningIn) {
      console.log('Sign-in already in progress, please wait...');
      return;
    }

    try {
      setError(null);
      setModalVisible(true);
    } catch (err) {
      logError(err, 'Sign In Start');
      setError('Failed to start sign in process');
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) {
      console.log('Google Sign-In already in progress, please wait...');
      return;
    }

    try {
      isSigningIn = true;
      console.log('Checking Google Play Services...');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      console.log('Google Play Services available');

      console.log('Initiating Google Sign-In...');
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign-In Response:', JSON.stringify(userInfo, null, 2));

      // Access idToken directly from userInfo
      const idToken = userInfo.idToken;
      if (!idToken) {
        throw new Error('No ID token returned from Google Sign-In');
      }

      console.log('ID Token acquired:', idToken.substring(0, 20) + '...');

      setLoading(true);

      // Check if user already exists in Supabase
      const email = userInfo.user.email;
      const { data: existingUser, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (userCheckError && userCheckError.code !== 'PGRST116') {
        throw userCheckError;
      }

      // Sign in with Supabase
      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (signInError) {
        if (signInError.message.includes('duplicate key value violates unique constraint')) {
          console.log('User already exists, proceeding with sign-in...');
        } else {
          throw signInError;
        }
      }

      console.log('Supabase Sign-In successful:', !!data.session);
      setSession(data.session);
      await AsyncStorage.setItem('@user', JSON.stringify(userInfo.user));
    } catch (err) {
      logError(err, 'Google Sign In');
      console.log('Google Sign-In Error Code:', err.code || 'undefined');
      console.log('Google Sign-In Error Details:', JSON.stringify(err));
      setError(`Google Sign-In failed: ${err.message}`);
    } finally {
      isSigningIn = false;
      setModalVisible(false);
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await GoogleSignin.signOut();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await AsyncStorage.removeItem('@user');
      setSession(null);
    } catch (err) {
      logError(err, 'Sign Out');
      setError('Sign out failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GoogleAuthContext.Provider
      value={{
        session,
        loading,
        error,
        signIn,
        signOut,
      }}
    >
      {children}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          if (!isSigningIn) setModalVisible(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Sign In with Google</Text>
            <GoogleSigninButton
              style={styles.googleButton}
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Light}
              onPress={handleGoogleSignIn}
              disabled={loading || isSigningIn}
            />
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                if (!isSigningIn) setModalVisible(false);
              }}
              disabled={loading || isSigningIn}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </GoogleAuthContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalText: {
    fontSize: 18,
    marginBottom: 15,
    fontWeight: 'bold',
  },
  googleButton: {
    width: 250,
    height: 48,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 10,
    borderRadius: 5,
    width: 250,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export const useGoogleAuth = () => {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
};

export default GoogleAuthProvider;