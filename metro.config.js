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

module.exports = config;
