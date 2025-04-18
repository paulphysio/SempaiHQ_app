import 'dotenv/config';     // ← loads your .env into process.env

export default ({ config }) => ({
  ...config,

  expo: {
    ...config.expo,

    // your existing settings:
    name:           'Solana Wallet App',
    slug:           'solana-wallet-app',
    version:        '1.0.0',
    orientation:    'portrait',
    icon:           './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image:          './assets/splash.png',
      resizeMode:     'contain',
      backgroundColor:'#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios:   { supportsTablet: true },
    android: {
      adaptiveIcon: {
        foregroundImage:'./assets/adaptive-icon.png',
        backgroundColor:'#ffffff',
      },
    },
    web: { favicon: './assets/favicon.png' },

    // ← this is what we care about
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
    },
  },

  // → And for Expo Web builds (so process.env.* is available there too):
  web: {
    ...config.web,
    build: {
      ...(config.web?.build || {}),
      environment: {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_KEY: process.env.SUPABASE_KEY,
      },
    },
  },
});
