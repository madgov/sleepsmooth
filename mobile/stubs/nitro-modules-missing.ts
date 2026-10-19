// Build-time stand-in used ONLY when react-native-nitro-modules (the required peer dependency of react-native-fast-tflite) is NOT installed.
// metro.config.js resolves 'react-native-nitro-modules' to this file in that case so the JavaScript bundle still builds. It does nothing useful:
// every call throws, src/capture/yamnetScorer.ts catches that and the night uses the v1 model, recording v1's version. Once the real package is installed
// (cd mobile && npx expo install react-native-nitro-modules) Metro resolves the real one and this file is never used.
export const NitroModules = {
  createHybridObject(name: string): never {
    throw new Error(`react-native-nitro-modules is not installed (needed for ${name}); the YAMNet scorer is unavailable and the v1 model is used`);
  },
};
