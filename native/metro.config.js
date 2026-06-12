// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle the poetry corpus (assets/poems.pf) as a runtime asset rather than
// inlining ~31 MB of JSON into the JS bundle. src/data/corpus.ts reads it via
// expo-asset + expo-file-system. `pf` = "poetry feed" (it's plain JSON text).
config.resolver.assetExts.push('pf');

module.exports = config;
