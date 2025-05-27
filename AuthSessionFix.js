// AuthSessionFix.js - Compatibility wrapper for expo-auth-session
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Always call this at the top level of your app
WebBrowser.maybeCompleteAuthSession();

// Custom implementation to avoid import issues
export const makeRedirectUri = (options = {}) => {
  const scheme = Constants.expoConfig?.scheme || 'sempaihq';
  const useProxy = options?.useProxy ?? (Platform.OS !== 'web');
  
  if (Platform.OS === 'web') {
    // For web use standard URLs
    return window.location.origin;
  }
  
  // For native, use either proxy or direct scheme
  if (useProxy) {
    return 'https://auth.expo.io/@draray/sempai-hq';
  }
  
  // Direct URI scheme
  return `${scheme}://`;
};

// Google auth configuration helpers
export const getGoogleAuthConfig = (androidClientId, webClientId) => {
  return {
    androidClientId,
    webClientId,
    scopes: ['profile', 'email'],
    redirectUri: makeRedirectUri({ useProxy: true }),
    responseType: 'id_token',
    prompt: 'select_account',
    useProxy: true,
  };
};

// Helper for sign-in prompt
export const promptGoogleSignIn = async (promptAsync) => {
  try {
    // Always use popup mode for consistent experience
    const result = await promptAsync({
      useProxy: true,
      showInRecents: true,
      presentationStyle: 'popup'
    });
    
    return result;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

export default {
  makeRedirectUri,
  getGoogleAuthConfig,
  promptGoogleSignIn
};
