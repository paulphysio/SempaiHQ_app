const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for mjs files and lottie assets
config.resolver.sourceExts.push('mjs');
config.resolver.assetExts.push('lottie');

// Add support for common image and font asset types
config.resolver.assetExts.push(
  'png',
  'jpg',
  'jpeg',
  'svg',
  'gif',
  'webp',
  'ico',
  'bmp',
  'ttf',
  'otf',
  'woff',
  'woff2',
  'eot'
);

// Add any additional node_modules folders
config.resolver.nodeModulesPaths = [
  'node_modules',
  '../node_modules',
];

// Ensure proper module resolution
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'abort-controller': require.resolve('abort-controller'),
};

// Web build only: swap phone-only modules for small web versions in web/shims.
// Android/iOS builds are untouched.
const path = require('path');
const WEB_SHIMS = {
  'react-native-pdf': 'react-native-pdf.js',
  'react-native-orientation-locker': 'react-native-orientation-locker.js',
  'react-native-tts': 'react-native-tts.js',
  'react-native-webview': 'react-native-webview.js',
  'react-native-linear-gradient': 'react-native-linear-gradient.js',
  'expo-navigation-bar': 'expo-navigation-bar.js',
  '@react-native-google-signin/google-signin': 'google-signin.js',
  'expo-secure-store': 'expo-secure-store.js',
};
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_SHIMS[moduleName]) {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'web', 'shims', WEB_SHIMS[moduleName]) };
  }
  return defaultResolve
    ? defaultResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
