// app.config.js
import 'dotenv/config';

export default ({ config }) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID;
  const googleAndroidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID;

  const missingVars = [];
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!supabaseKey) missingVars.push('SUPABASE_KEY');
  if (!googleWebClientId) missingVars.push('GOOGLE_WEB_CLIENT_ID');
  if (!googleAndroidClientId) missingVars.push('GOOGLE_ANDROID_CLIENT_ID');

  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}. Ensure these are set in your .env file.`);
    throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
  }

  return {
    ...config,
    name: 'Sempai HQ',
    slug: 'sempai-hq',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.turningpointKS.sempaihq',
    },
    android: {
      package: 'com.turningpointKS.sempaihq',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#000000',
      },
      permissions: [],
    },
    scheme: 'com.turningpointks.sempaihq',
    extra: {
      supabaseUrl,
      supabaseKey,
      googleWebClientId,
      googleAndroidClientId,
      eas: {
        projectId: '1add05f5-c57a-41f9-8a38-57625c724beb',
      },
    },
    owner: 'physiotelli350',
    plugins: [
      'expo-router',
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: true,
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            minSdkVersion: 21,
          },
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#FF6B00',
        },
      ],
      'expo-font',
      [
        '@react-native-google-signin/google-signin',
        {
          webClientId: googleWebClientId,
          androidClientId: googleAndroidClientId, // Explicitly set Android client ID
        },
      ],
    ],
    updates: {
      enabled: true,
      url: 'https://u.expo.dev/1add05f5-c57a-41f9-8a38-57625c724beb',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  };
};