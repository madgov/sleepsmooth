// Native autolinking overrides.
//
// react-native-fast-tflite (the on-device YAMNet runtime) needs react-native-nitro-modules natively: its podspec depends on the
// NitroModules pod. While that package is NOT installed, fast-tflite is kept out of iOS/Android autolinking so `pod install` and the
// native build keep working; the JavaScript side then fails to load the runtime and the app records and uses the v1 model
// (src/capture/yamnetScorer.ts). Install react-native-nitro-modules and rebuild the dev client to enable YAMNet v3 on device.
let nitroInstalled = true;
try {
  require.resolve('react-native-nitro-modules/package.json', { paths: [__dirname] });
} catch {
  nitroInstalled = false;
}

module.exports = nitroInstalled ? {} : { dependencies: { 'react-native-fast-tflite': { platforms: { ios: null, android: null } } } };
