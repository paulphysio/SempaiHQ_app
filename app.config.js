import 'dotenv/config';

// Log environment variables (without sensitive data)
console.log('Environment check:', {
  hasAndroidClientId: !!process.env.GOOGLE_ANDROID_CLIENT_ID,
  hasWebClientId: !!process.env.GOOGLE_WEB_CLIENT_ID,
});

export default ({ config }) => {
  // Initialize config.expo and extra if they don't exist
  const expoConfig = config.expo || {};
  const extraConfig = expoConfig.extra || {};

  // Add environment variables to config
  return {
    ...config,
    expo: {
      ...expoConfig,
      extra: {
        ...extraConfig,
        googleClientId: process.env.GOOGLE_WEB_CLIENT_ID,
        googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_KEY,
        eas: {
          projectId: "f617e5a0-2bd4-4d93-8b00-49a589518469"
        }
      },
      name: 'Sempai HQ',
      slug: 'sempai-hq',
      version: '1.0.0',
      orientation: 'portrait',
      icon: './assets/icon.png',
      primaryColor: '#FF6B00', // Orange accent color
      userInterfaceStyle: 'dark',
      backgroundColor: '#000000',
      splash: {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#000000',
      },
      scheme: 'sempaihq',
      assetBundlePatterns: ['assets/**/*'],
      android: {
        package: 'com.turningpointKS.sempaihq',
        versionCode: 1,
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#000000',
        },
        permissions: ['NOTIFICATIONS', 'POST_NOTIFICATIONS'],
        intentFilters: [
          {
            action: "VIEW",
            autoVerify: true,
            data: [
              {
                scheme: "https",
                host: "www.sempaihq.xyz",
                pathPrefix: "/auth/callback"
              },
              {
                scheme: "https",
                host: "xqeimsncmnqsiowftdmz.supabase.co",
                pathPrefix: "/auth/v1/callback"
              }
            ],
            category: ["BROWSABLE", "DEFAULT"]
          }
        ],
      },
      ios: {
        bundleIdentifier: 'com.turningpointKS.sempaihq',
        supportsTablet: true,
      },
      web: {
        favicon: './assets/favicon.png',
        bundler: 'metro'
      },
      owner: 'draray',
      plugins: [
        [
          "expo-build-properties",
          {
            "android": {
              "usesCleartextTraffic": true
            }
          }
        ],
        "expo-router",
        [
          "expo-notifications",
          {
            "icon": "./assets/notification-icon.png",
            "color": "#FF6B00"
          }
        ],
        "expo-font"
      ],
      updates: {
        url: 'https://u.expo.dev/f617e5a0-2bd4-4d93-8b00-49a589518469'
      },
      runtimeVersion: {
        policy: 'sdkVersion'
      },
      newArchEnabled: true
    },
  };
};