const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('taid')) config.resolver.assetExts.push('taid');
if (!config.resolver.assetExts.includes('onnx')) config.resolver.assetExts.push('onnx');
if (!config.resolver.assetExts.includes('bin')) config.resolver.assetExts.push('bin');

module.exports = config;
