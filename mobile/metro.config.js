const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const coreRoot = path.resolve(projectRoot, '../src');
const publicRoot = path.resolve(projectRoot, '../public');

const config = getDefaultConfig(projectRoot);

// Import the shared pure-TS core from ../src without copying it.
config.watchFolders = [...(config.watchFolders ?? []), coreRoot, publicRoot];

// Resolve third-party packages only from mobile/node_modules (the root web app has its own React).
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

// '@core/x' -> '../src/x'
const upstreamResolve = config.resolver.resolveRequest;
// Web preview only (dev tool): native-only packages resolve to inert stubs so the UI can be reviewed in a browser.
const WEB_STUBS = {
  'react-native-audio-api': 'web-stubs/audio-api.ts',
  'expo-notifications': 'web-stubs/notifications.ts',
  'expo-print': 'web-stubs/print.ts',
  'expo-file-system': 'web-stubs/file-system.ts',
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS[moduleName]) {
    return { type: 'sourceFile', filePath: path.join(projectRoot, WEB_STUBS[moduleName]) };
  }
  if (moduleName.startsWith('@core/')) {
    const mapped = path.join(coreRoot, moduleName.slice('@core/'.length));
    return (upstreamResolve ?? context.resolveRequest)(context, mapped, platform);
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

// Keep tests and the web app out of the mobile bundle graph.
const escape = (p) => p.replace(/[/\\]/g, '[/\\\\]');
config.resolver.blockList = [
  new RegExp(`${escape(coreRoot)}[/\\\\].*\\.test\\.tsx?$`),
  new RegExp(`${escape(path.resolve(projectRoot, '../node_modules'))}[/\\\\].*`),
  new RegExp(`${escape(path.resolve(projectRoot, '../dist'))}[/\\\\].*`),
];

module.exports = config;
