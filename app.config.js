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
    scheme: 'sempai-hq',
    assetBundlePatterns: ['assets/**/*'], // Includes assets/fonts/animeace.ttf
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.turningpointKS.sempaihq',
      buildNumber: '1',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: ['sempai-hq']
          }
        ]
      },
      config: {
        usesNonExemptEncryption: false
      },
      associatedDomains: [
        'applinks:xqeimsncmnqsiowftdmz.supabase.co'
      ]
    },
    android: {
      package: 'com.turningpointKS.sempaihq',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: ['NOTIFICATIONS', 'POST_NOTIFICATIONS'],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "sempai-hq",
              host: "*",
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    owner: 'mbappe350',
    plugins: [
      'expo-router',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#ffffff',
        },
      ],
      'expo-font', // Added for animeace.ttf
    ],
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
      backendWalletKeypair: process.env.BACKEND_WALLET_KEYPAIR,
      eas: {
        projectId: '492f97d1-81c1-4cb2-808f-6cd3f321f1d6',
      },
    },
    newArchEnabled: true,
  },
});