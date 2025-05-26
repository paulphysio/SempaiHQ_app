import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Linking, ActivityIndicator, Alert } from 'react-native';
import { useGoogleAuth } from './GoogleAuthProvider';
import { useSystemUi } from '../App';
import styles from '../styles/SignInStyles';

const SignIn = ({ onSkip }) => {
  const { signInWithGoogle, loading } = useGoogleAuth();
  const { setIsSystemUiVisible } = useSystemUi();
  
  // Handle skip functionality
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };
  
  // Hide system UI when component mounts
  useEffect(() => {
    setIsSystemUiVisible(false);
    return () => setIsSystemUiVisible(true);
  }, []);
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to SempaiHQ</Text>
        
        {/* Google Sign In Button */}
        <TouchableOpacity 
          style={[styles.authButton, styles.googleButton]} 
          onPress={signInWithGoogle}
          disabled={loading}
        >
          <Image 
            source={{ uri: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_24dp.png' }}
            style={styles.icon}
          />
          <Text style={styles.buttonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Twitter Sign In Button */}
        <TouchableOpacity 
          style={[styles.authButton, styles.twitterButton]} 
          onPress={() => Alert.alert('Coming Soon', 'Twitter sign-in will be available soon!')}
          disabled={loading}
        >
          <Image 
            source={{ uri: 'https://abs.twimg.com/responsive-web/client-web/icon-ios.svg' }}
            style={styles.icon}
          />
          <Text style={styles.buttonText}>Continue with Twitter</Text>
        </TouchableOpacity>

        {/* Terms and Conditions */}
        {/* Skip Button */}
        <TouchableOpacity 
          style={styles.skipButton} 
          onPress={handleSkip}
          disabled={loading}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
        
        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF9900" />
            <Text style={styles.loadingText}>Signing you in...</Text>
          </View>
        )}

        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.sempaihq.xyz/terms')}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.termsLink} onPress={() => Linking.openURL('https://www.sempaihq.xyz/privacy-policy')}>
              Privacy Policy
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

export default SignIn;
