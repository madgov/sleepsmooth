// Web preview stub (dev only). The browser build never records. It exists so the UI can be reviewed in a browser.
export const AudioManager = {
  checkRecordingPermissions: async () => 'Undetermined',
  requestRecordingPermissions: async () => 'Denied',
  setAudioSessionOptions: () => undefined,
  setAudioSessionActivity: async () => false,
  observeAudioInterruptions: () => undefined,
  addSystemEventListener: () => ({ remove: () => undefined }),
};
export class AudioRecorder {
  onAudioReady() {}
  onError() {}
  start() { return { status: 'error' }; }
  stop() {}
}
export class AudioContext {
  sampleRate = 48000;
  close() { return Promise.resolve(); }
}
export type IOSCategory = string;
export type IOSMode = string;
