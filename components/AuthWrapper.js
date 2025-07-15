import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, StatusBar, Platform, Text, Image, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGoogleAuth } from './GoogleAuthProvider';
import GoogleSignInButton from './GoogleSignInButton';
import * as NavigationBar from 'expo-navigation-bar';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EmbeddedWalletContext } from './EmbeddedWalletProvider';

export const AuthWrapper = ({ children }) => {
  const [showAuth, setShowAuth] = useState(true);
  const { session, loading } = useGoogleAuth();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const { width, height } = Dimensions.get('window');
  const { connect } = useContext(EmbeddedWalletContext);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Only skip the auth screen if the user has explicitly chosen to skip before
        const hasSkippedBefore = await AsyncStorage.getItem('hasSkippedAuth');
        
        // If the user is authenticated or has skipped auth before, hide the auth screen
        if (session || hasSkippedBefore === 'true') {
          setShowAuth(false);
        } else {
          setShowAuth(true);
        }
      } catch (err) {
        console.error('Error checking auth status:', err);
        setShowAuth(true);
      }
    };
    
    checkAuthStatus();
  }, [session]);

  useEffect(() => {
    if (session) {
      if (connect) {
        connect();
      }
    }
  }, [session, connect]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setPositionAsync('absolute');
      NavigationBar.setBehaviorAsync('inset-swipe');
    }
    StatusBar.setHidden(true);

    // Animation sequence
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();

    return () => {
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
        NavigationBar.setPositionAsync('relative');
      }
      StatusBar.setHidden(false);
    };
  }, []);

  const handleSkip = async () => {
    // Mark that the user has skipped authentication
    await AsyncStorage.setItem('hasSkippedAuth', 'true');
    setShowAuth(false);
  };

  if (showAuth) {
    return (
      <LinearGradient 
        colors={['#1A0F24', '#2D1543', '#3D1A5A']} 
        start={{x: 0, y: 0}} 
        end={{x: 1, y: 1}} 
        style={styles.container}
      >
        <StatusBar hidden />
        
        {/* Background elements */}
        <Animated.View style={[styles.backgroundCircle, { 
          opacity: fadeAnim.interpolate({inputRange: [0, 1], outputRange: [0, 0.7]}),
          left: width * 0.7,
          top: -height * 0.1,
        }]} />
        
        <Animated.View style={[styles.backgroundCircle, { 
          opacity: fadeAnim.interpolate({inputRange: [0, 1], outputRange: [0, 0.5]}),
          right: width * 0.7,
          bottom: -height * 0.1,
        }]} />
        
        {/* Logo and content container with animations */}
        <Animated.View 
          style={[
            styles.contentContainer, 
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <BlurView intensity={20} style={styles.blurContainer}>
            <View style={styles.logoContainer}>
              <Image source={require('../assets/logo.jpeg')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.title}>Sempai HQ</Text>
              <Text style={styles.subtitle}>Your digital manga & novel universe</Text>
            </View>
            
            <View style={styles.buttonContainer}>
              <GoogleSignInButton />
              <View style={styles.comingSoonContainer}>
                <Text style={styles.comingSoonText}>Twitter sign in coming soon</Text>
              </View>
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>
      </LinearGradient>
    );
  }

  return children;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backgroundCircle: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#FF5733',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  blurContainer: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    padding: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: '#E8E8FF',
    textAlign: 'center',
    fontWeight: '400',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  comingSoonContainer: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  comingSoonText: {
    color: '#AAAACC',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  skipButtonText: {
    color: '#FF5733',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AuthWrapper;