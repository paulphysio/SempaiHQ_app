import React, { createContext, useContext, useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
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
    const trySilentSignIn = async () => {
      try {
        // Try to get current user silently
        const userInfo = await GoogleSignin.signInSilently();
        if (userInfo) {
          const idToken = userInfo.idToken;
          if (idToken) {
            setLoading(true);
            // Sign in to Supabase with the Google idToken
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
            setSession(data.session);
            await AsyncStorage.setItem('@user', JSON.stringify(userInfo.user));
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.log('Silent Google sign-in failed:', err.message);
        // Not fatal, user will need to sign in manually
      }
    };

    trySilentSignIn();
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      setSession(session);

      // Save user ID to AsyncStorage for offline access
      if (session?.user?.id) {
        try {
          await AsyncStorage.setItem('offline_user_id', session.user.id);
          console.log('[GoogleAuthProvider] Saved user ID for offline access:', session.user.id);
        } catch (e) {
          console.error('[GoogleAuthProvider] Failed to save user ID:', e);
        }
      }
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
      backdropOpacity.value = withTiming(1, { duration: 400 });
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

    // Web: Google's normal browser sign-in (redirect). The session comes back
    // in the URL and onAuthStateChange picks it up.
    if (Platform.OS === 'web') {
      try {
        isSigningIn = true;
        const here = window.location.origin + window.location.pathname;
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: here, queryParams: { prompt: 'select_account' } },
        });
        if (oauthError) throw oauthError;
      } catch (err) {
        isSigningIn = false;
        logError(err, 'Google Sign In (web)');
        setError(`Google Sign-In failed: ${err.message}`);
      }
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
              colors={['rgba(243, 99, 22, 0.35)', 'rgba(255, 147, 0, 0.35)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalBackground}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Sempai HQ Awaits!</Text>
                <Text style={styles.modalSubtitle}>Unleash Your Anime Adventure!</Text>
              </View>
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Animated.View style={[styles.googleButtonContainer, animatedButtonStyle]}>
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleSignIn}
                  disabled={loading || isSigningIn}
                >
                  <LinearGradient
                    colors={['#FF4500', '#FF8C00', '#FFC857']}
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
    backgroundColor: 'rgba(5, 5, 10, 0.72)', // dims the app behind; fades in with the pop-up
  },
  modalContent: {
    backgroundColor: 'rgba(12, 12, 18, 0.98)',
    borderRadius: 18,
    width: '78%',
    maxWidth: 300,
    alignItems: 'center',
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 0, 0.45)',
    overflow: 'hidden',
  },
  modalBackground: {
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    width: '100%',
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: ' Yoruka',
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(255, 69, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  modalSubtitle: {
    fontFamily: ' Yoruka',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  errorText: {
    fontFamily: ' Yoruka',
    fontSize: 12,
    color: '#FF6B6B',
    marginBottom: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(255, 51, 51, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
  googleButtonContainer: {
    width: '100%',
    marginBottom: 10,
  },
  googleButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.4)',
  },
  googleButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
  },
  googleLogo: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    fontFamily: ' Yoruka',
    fontSize: 14,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontFamily: ' Yoruka',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
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
