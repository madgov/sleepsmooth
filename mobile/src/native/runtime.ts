// Runtime detection. SleepSmooth has two ways to run on an iPhone:
//   - the full build (a dev client or release build made with Xcode): microphone, Live Activity, intents, backup flag.
//   - Expo Go (preview): UI only. Native-only modules are replaced by inert stubs and recording is blocked with a clear sheet.
// Nothing in the Expo Go path may import a native-only module at top level; use the wrappers in this folder.
import { isRunningInExpoGo } from 'expo';

/** True when the JS is running inside the Expo Go app. */
export const IS_EXPO_GO: boolean = (() => {
  try {
    return isRunningInExpoGo();
  } catch {
    return false;
  }
})();

export const EXPO_GO_RECORDING_TITLE = 'Recording needs the full SleepSmooth build';
export const EXPO_GO_RECORDING_BODY = "This preview can't use the microphone overnight. Everything else here is real, and the sample night and sample clips are labelled as samples.";
