import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  expo: {
    name: 'Sempai HQ',
    slug: 'sempai-hq',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.turningpointKS.sempaihq',
      buildNumber: '1',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.turningpointKS.sempaihq',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: ['NOTIFICATIONS'], // Added for expo-notifications
    },
    web: {
      favicon: './assets/favicon.png',
    },
    owner: 'physiotelli',
    plugins: [
      'expo-router',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png', // Optional: Add a notification icon
          color: '#ffffff',
        },
      ],
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
      backendWalletKeypair: process.env.BACKEND_WALLET_KEYPAIR, // Added
      eas: {
        projectId: 'fcc442fa-fa65-46bb-b9bb-9c3a9aea5bd3',
      },
    },
  },
});