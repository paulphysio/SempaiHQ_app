const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for mjs files and lottie assets
config.resolver.sourceExts.push('mjs');
config.resolver.assetExts.push('lottie');

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

module.exports = config;