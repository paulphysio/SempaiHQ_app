import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  name: 'Sempai HQ',
  slug: 'sempai-hq',
  version: '1.2',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    // Brand ink — matches the app's first frame so launch has no white flash.
    backgroundColor: '#0B0B14',
  },
  assetBundlePatterns: ['assets/**/*'],
  platforms: ['android'],
  android: {
    package: 'com.turningpointKS.sempaihq',
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
  },
  web: { favicon: './assets/favicon.png', name: 'SempaiHQ', shortName: 'SempaiHQ', themeColor: '#0B0B14', backgroundColor: '#0B0B14', description: 'Read novels and manga from independent creators — and earn SMP.' },
  // Web build for sempaihq.com: files are served from /web-app (set by scripts/build-web.sh).
  ...(process.env.SEMPAI_WEB_BASE ? { experiments: { ...(config.experiments || {}), baseUrl: process.env.SEMPAI_WEB_BASE } } : {}),
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
        sounds: ['./notification_sound.mp3']
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
    eas: { projectId: 'd5eca5d1-6fe0-4d21-ae79-dfd681139dd8' },
  },
  updates: {
    enabled: true,
    url: 'https://u.expo.dev/d5eca5d1-6fe0-4d21-ae79-dfd681139dd8',
  },
  runtimeVersion: '1.0.1',
});