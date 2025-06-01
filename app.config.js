import 'dotenv/config';

export default ({ config }) => {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://xqeimsncmnqsiowftdmz.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxZWltc25jbW5xc2lvd2Z0ZG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgwNDExOTYsImV4cCI6MjA1MzYxNzE5Nn0.B8mZGxtUDp5jC-SwqBj1G5BjZE_A6RC-ZeJtmkq76iY';
  const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID || '63667308763-6kecoi8ndtpqfd065noj278lhlb8j7qt.apps.googleusercontent.com';

  const missingVars = [];
  if (!supabaseUrl) missingVars.push('SUPABASE_URL');
  if (!supabaseKey) missingVars.push('SUPABASE_KEY');
  if (!googleWebClientId) missingVars.push('GOOGLE_WEB_CLIENT_ID');

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. Make sure these are set in your .env file or EAS secrets.`
    );
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
    android: {
      package: 'com.turningpointKS.sempaihq',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#000000',
      },
      permissions: [],
      signingConfig: {
        storeFile: './@david350__sempai-hq.jks',
        storePassword: '3587d1d0fabafa06595914af806bc01c',
        keyAlias: '41349a67d6d871c3e72ec878e54978cc',
        keyPassword: '9d2f6ddaddede1730ccf1880f6a2c2fe'
      }
    },
    scheme: 'com.turningpointks.sempaihq',
    extra: {
      supabaseUrl,
      supabaseKey,
      googleWebClientId,
      eas: {
        projectId: 'c91c4cae-0035-416c-88f2-37b7cbc06248',
      },
    },
    owner: 'david350',
    plugins: [
      'expo-router',
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: true,
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
        },
      ],
    ],
    updates: {
      enabled: true,
      url: 'https://u.expo.dev/c91c4cae-0035-416c-88f2-37b7cbc06248',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  };
};