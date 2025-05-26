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
        eas: {
          projectId: "492f97d1-81c1-4cb2-808f-6cd3f321f1d6"
        }
      },
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
      scheme: 'sempaihq',
      assetBundlePatterns: ['assets/**/*'],
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
        'expo-font',
      ],
      updates: {
        url: 'https://u.expo.dev/492f97d1-81c1-4cb2-808f-6cd3f321f1d6'
      },
      runtimeVersion: {
        policy: 'sdkVersion'
      },
      newArchEnabled: true
    },
  };
};