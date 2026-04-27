const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Metro resolves `require('./support/isBuffer')` but util/package.json's browser
// field maps `./support/isBuffer.js` (with extension). The mismatch means Metro
// never applies the alias. We redirect it manually to the browser-safe version.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === './support/isBuffer') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/util/support/isBufferBrowser.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
