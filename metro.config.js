const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('taid')) config.resolver.assetExts.push('taid');

module.exports = config;
