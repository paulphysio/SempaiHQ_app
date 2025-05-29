// app.config.js
import 'dotenv/config';

// Log environment variables for debugging
console.log('Environment check:', {
  hasAndroidClientId: !!process.env.GOOGLE_ANDROID_CLIENT_ID,
  hasWebClientId: !!process.env.GOOGLE_WEB_CLIENT_ID,
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_KEY,
});

export default ({ config }) => {
  // Use process.env with fallback to undefined
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID;
  const googleAndroidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID;

  // Log for debugging
  console.log('Config values:', {
    supabaseUrl,
    supabaseKey,
    googleWebClientId,
    googleAndroidClientId,
  });

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables: SUPABASE_URL and/or SUPABASE_KEY');
  }

  return {
    ...config,
    expo: {
      extra: {
        supabaseUrl,
        supabaseKey,
        googleWebClientId,
        googleAndroidClientId,
        eas: {
          projectId: "fdef0277-afe0-45ee-8751-e94be49c7934",
        },
      },
      name: "Sempai HQ",
      slug: "sempai-hq",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/icon.png",
      primaryColor: "#FF6B00",
      userInterfaceStyle: "dark",
      backgroundColor: "#000000",
      splash: {
        image: "./assets/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#000000",
      },
      scheme: "sempaihq",
      assetBundlePatterns: ["assets/**/*"],
      android: {
        package: "com.turningpointKS.sempaihq",
        versionCode: 1,
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#000000",
        },
        permissions: ["NOTIFICATIONS", "POST_NOTIFICATIONS"],
        intentFilters: [
          {
            action: "VIEW",
            autoVerify: true,
            data: [
              {
                scheme: "https",
                host: "www.sempaihq.xyz",
                pathPrefix: "/auth/callback",
              },
              {
                scheme: "https",
                host: "xqeimsncmnqsiowftdmz.supabase.co",
                pathPrefix: "/auth/v1/callback",
              },
              {
                scheme: "sempaihq",
                host: "*",
              },
            ],
            category: ["BROWSABLE", "DEFAULT"],
          },
        ],
      },
      ios: {
        bundleIdentifier: "com.turningpointKS.sempaihq",
        supportsTablet: true,
      },
      web: {
        favicon: "./assets/favicon.png",
        bundler: "metro",
      },
      owner: "nerdy35",
      plugins: [
        [
          "expo-build-properties",
          {
            "android": {
              "usesCleartextTraffic": true,
            },
          },
        ],
        "expo-router",
        [
          "expo-notifications",
          {
            "icon": "./assets/notification-icon.png",
            "color": "#FF6B00",
          },
        ],
        "expo-font",
      ],
      updates: {
        url: "https://u.expo.dev/fdef0277-afe0-45ee-8751-e94be49c7934",
      },
      runtimeVersion: {
        policy: "sdkVersion",
      },
      newArchEnabled: true,
    },
  };
};