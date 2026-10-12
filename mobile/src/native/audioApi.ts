// Lazy wrapper around react-native-audio-api. In Expo Go the native module does not exist, so the real package is never
// evaluated there: the inert web stub is returned instead (same pattern as the web preview). Both requires are static,
// so Metro bundles them, but only the chosen one runs.
import { IS_EXPO_GO } from './runtime';

export type AudioApi = typeof import('react-native-audio-api');

/* eslint-disable @typescript-eslint/no-require-imports */
export const audioApi: AudioApi = IS_EXPO_GO ? (require('../../web-stubs/audio-api') as AudioApi) : (require('react-native-audio-api') as AudioApi);
