import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  expo: {
    name: 'Sempai HQ',
    slug: 'sempai-hq',
    version: '1.0.8',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['assets/**/*'],
    platforms: ['android'],
    android: {
      package: 'com.turningpointKS.sempaihq',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: ['NOTIFICATIONS', 'POST_NOTIFICATIONS'],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    owner: 'physionerdy',
    plugins: [
      'expo-router',
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: true,
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 24,
          },
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#ffffff',
        },
      ],
      'expo-font',
      [
        '@react-native-google-signin/google-signin',
        {
          androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
          iosUrlScheme: 'com.googleusercontent.apps.dummy',
        },
      ],
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      solanaNetwork: process.env.EXPO_PUBLIC_SOLANA_NETWORK,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
      eas: {
        projectId: 'd5eca5d1-6fe0-4d21-ae79-dfd681139dd8',
      },
    },
    updates: {
      enabled: true,
      url: 'https://u.expo.dev/d5eca5d1-6fe0-4d21-ae79-dfd681139dd8',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  },
});