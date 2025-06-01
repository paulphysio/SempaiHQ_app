import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, Platform, TouchableOpacity, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGoogleAuth } from './GoogleAuthProvider';
import GoogleSignInButton from './GoogleSignInButton';
import * as NavigationBar from 'expo-navigation-bar';

export const AuthWrapper = ({ children }) => {
  const [showAuth, setShowAuth] = useState(true);
  const { signIn, loading } = useGoogleAuth();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setPositionAsync('absolute');
      NavigationBar.setBehaviorAsync('inset-swipe');
    }
    StatusBar.setHidden(true);
    return () => {
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
        NavigationBar.setPositionAsync('relative');
      }
      StatusBar.setHidden(false);
    };
  }, []);

  const handleSkip = () => {
    setShowAuth(false);
  };

  if (showAuth) {
    return (
      <LinearGradient colors={['#000000', '#121212']} style={styles.container}>
        <StatusBar hidden />
        <View style={styles.logoContainer}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Sempai HQ</Text>
          <Text style={styles.subtitle}>Your digital manga & novel universe</Text>
        </View>
        <View style={styles.buttonContainer}>
          <GoogleSignInButton />
          <TouchableOpacity style={styles.twitterButton} disabled={true}>
            <Text style={styles.twitterButtonText}>Sign in with Twitter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
  },
  twitterButton: {
    backgroundColor: '#1DA1F2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 12,
    opacity: 0.6,
  },
  twitterButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#FF6B00',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AuthWrapper;