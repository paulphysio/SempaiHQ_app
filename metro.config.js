const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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