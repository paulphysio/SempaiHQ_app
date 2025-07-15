import React, { createContext, useContext, useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../services/supabaseClient';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  Easing, 
  interpolate,
  Extrapolate,
  runOnJS,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';

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

let isSigningIn = false;

GoogleSignin.configure({
  webClientId: googleWebClientId,
  androidClientId: googleAndroidClientId,
  scopes: ['profile', 'email', 'openid'],
  offlineAccess: false,
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

  // Animation values
  const modalScale = useSharedValue(0.6);
  const modalOpacity = useSharedValue(0);
  const buttonGlow = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);

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
      // Trigger animations
      modalScale.value = withSpring(1, { damping: 10, stiffness: 120 });
      modalOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.exp) });
      backdropOpacity.value = withTiming(0.8, { duration: 500 });
      buttonGlow.value = withTiming(1, { 
        duration: 1000, 
        easing: Easing.inOut(Easing.sin),
        loop: true 
      });
      buttonScale.value = withTiming(1.05, { 
        duration: 600, 
        easing: Easing.inOut(Easing.quad),
        loop: true,
        direction: 'alternate'
      });
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

      const idToken = userInfo.idToken;
      if (!idToken) {
        throw new Error('No ID token returned from Google Sign-In');
      }

      console.log('ID Token acquired:', idToken.substring(0, 20) + '...');

      setLoading(true);

      const email = userInfo.user.email;
      const { data: existingUser, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (userCheckError && userCheckError.code !== 'PGRST116') {
        throw userCheckError;
      }

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

  const closeModal = () => {
    setModalVisible(false);
  };

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: modalScale.value },
      { rotate: `${interpolate(modalScale.value, [0.6, 1], [-0.05, 0], Extrapolate.CLAMP)}rad` },
    ],
    opacity: modalOpacity.value,
    shadowOpacity: interpolate(modalScale.value, [0.6, 1], [0.3, 0.5], Extrapolate.CLAMP),
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    shadowOpacity: buttonGlow.value * 0.5,
    elevation: 10 + buttonGlow.value * 10,
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

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
        animationType="none"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          if (!isSigningIn) {
            modalScale.value = withSpring(0.6);
            modalOpacity.value = withTiming(0);
            backdropOpacity.value = withTiming(0, { duration: 300 }, () => {
              runOnJS(closeModal)();
            });
          }
        }}
      >
        <Animated.View style={[styles.modalContainer, animatedBackdropStyle]}>
          <Animated.View style={[styles.modalContent, animatedModalStyle]}>
            <LinearGradient
              colors={['rgba(255, 87, 51, 0.3)', 'rgba(255, 147, 0, 0.3)']}
              style={styles.modalBackground}
            >
              <Text style={styles.modalTitle}>Sempai HQ Awaits!</Text>
              <Text style={styles.modalSubtitle}>Unleash Your Anime Adventure!</Text>
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Animated.View style={[styles.googleButtonContainer, animatedButtonStyle]}>
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleSignIn}
                  disabled={loading || isSigningIn}
                >
                  <LinearGradient
                    colors={['#FF4500', '#FF8C00', '#FFD700']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.googleButtonGradient}
                  >
                    <Image
                      source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/1200px-Google_%22G%22_Logo.svg.png' }}
                      style={styles.googleLogo}
                    />
                    <Text style={styles.googleButtonText}>
                      {loading ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  if (!isSigningIn) {
                    modalScale.value = withSpring(0.6);
                    modalOpacity.value = withTiming(0);
                    backdropOpacity.value = withTiming(0, { duration: 300 }, () => {
                      runOnJS(closeModal)();
                    });
                  }
                }}
                disabled={loading || isSigningIn}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </Animated.View>
      </Modal>
    </GoogleAuthContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0)', // Animated backdrop
  },
  modalBackground: {
    borderRadius: 28,
    padding: 28,
    width: '100%',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // Stronger glassmorphism
    borderRadius: 28,
    width: '92%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 69, 0, 0.4)',
    overflow: 'hidden',
  },
  modalTitle: {
    fontFamily: 'AnimeAce',
    fontSize: 28,
    fontWeight: '900',
    color: '#1A1A1A',
    marginBottom: 16,
    textShadowColor: 'rgba(255, 69, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  modalSubtitle: {
    fontFamily: 'AnimeAce',
    fontSize: 18,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 26,
    fontWeight: '600',
    textShadowColor: 'rgba(255, 147, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  errorText: {
    fontFamily: 'AnimeAce',
    fontSize: 16,
    color: '#FF3333',
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(255, 51, 51, 0.2)',
    padding: 10,
    borderRadius: 10,
    fontWeight: '600',
  },
  googleButtonContainer: {
    width: '100%',
    marginBottom: 20,
  },
  googleButton: {
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  googleButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
    justifyContent: 'center',
    borderRadius: 20,
  },
  googleLogo: {
    width: 32,
    height: 32,
    marginRight: 14,
  },
  googleButtonText: {
    fontFamily: 'AnimeAce',
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 69, 0, 0.5)',
  },
  cancelButtonText: {
    fontFamily: 'AnimeAce',
    fontSize: 17,
    fontWeight: '700',
    color: '#FF4500',
    textShadowColor: 'rgba(255, 69, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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