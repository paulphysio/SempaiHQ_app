import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  expo: {
    name: 'Sempai HQ',
    slug: 'sempai-hq',
    version: '1.0.1', // ⬅️ Bump this
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
      versionCode: 6, // ⬅️ Must be > 5
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: ['NOTIFICATIONS', 'POST_NOTIFICATIONS'],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    owner: 'physiotelli350',
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
      supabaseKey: process.env.SUPABASE_KEY,
      backendWalletKeypair: process.env.BACKEND_WALLET_PRIVATE_KEY,
      solanaNetwork: process.env.EXPO_PUBLIC_SOLANA_NETWORK,
      solanaApiKey: process.env.SOLANA_API_KEY,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
      eas: {
        projectId: '1add05f5-c57a-41f9-8a38-57625c724beb',
      },
    },
    updates: {
      enabled: true,
      url: 'https://u.expo.dev/1add05f5-c57a-41f9-8a38-57625c724beb',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  },
});
