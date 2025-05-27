import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  StatusBar, 
  Platform, 
  TouchableOpacity, 
  Text,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useGoogleAuth } from './GoogleAuthProvider';
import GoogleSignInButton from './GoogleSignInButton';
import * as NavigationBar from 'expo-navigation-bar';
import Constants from 'expo-constants';

// Wrapper component to ensure the welcome/sign-in screen appears every time the app is opened
export const AuthWrapper = ({ children }) => {
  const [showAuth, setShowAuth] = useState(true);
  const { signInWithGoogle, loading } = useGoogleAuth();

  useEffect(() => {
    // Hide system navigation on Android for immersive experience
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setPositionAsync('absolute');
      NavigationBar.setBehaviorAsync('inset-swipe');
    }
    
    // Hide status bar
    StatusBar.setHidden(true);
    
    return () => {
      // Restore system navigation bars when component unmounts
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
        NavigationBar.setPositionAsync('relative');
      }
      StatusBar.setHidden(false);
    };
  }, []);

  // Handle skip authentication
  const handleSkip = () => {
    setShowAuth(false);
  };

  // If authentication screen should be shown, render it
  if (showAuth) {
    return (
      <LinearGradient
        colors={['#000000', '#121212']}
        style={styles.container}
      >
        <StatusBar hidden />
        
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Sempai HQ</Text>
          <Text style={styles.subtitle}>Your digital manga & novel universe</Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <GoogleSignInButton 
            onPress={signInWithGoogle}
            loading={loading}
          />
          
          <TouchableOpacity 
            style={styles.twitterButton}
            disabled={true} // Placeholder for Twitter auth
          >
            <Text style={styles.twitterButtonText}>Sign in with Twitter</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={handleSkip}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }
  
  // If authentication is skipped or completed, render the app
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
    opacity: 0.6, // Dimmed as placeholder
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
    color: '#FF6B00', // Orange accent color
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AuthWrapper;
