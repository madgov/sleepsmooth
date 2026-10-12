// Clip playback through react-native-audio-api (the same library that records). NOT VERIFIED on a device: whether an
// AudioContext created here coexists with the recording audio session is untested, so the UI disables playback while
// a night is being recorded. In Expo Go the native module is absent, so playback is reported unavailable.
import { audioApi } from '../native/audioApi';
import { IS_EXPO_GO } from '../native/runtime';
import { createPlayer, type PlayEngine } from './playerStore';

const engine: PlayEngine = {
  available: !IS_EXPO_GO,
  unavailableReason: 'Playback needs the full SleepSmooth build. This preview cannot play audio.',
  start(samples, rate, onProgress, onEnd) {
    const ctx = new audioApi.AudioContext();
    const buffer = ctx.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const t0 = ctx.currentTime;
    const dur = samples.length / rate;
    const timer = setInterval(() => onProgress((ctx.currentTime - t0) / dur), 100);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      void ctx.close().catch(() => undefined);
    };
    src.onEnded = () => {
      finish();
      onEnd();
    };
    src.start();
    return {
      stop() {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
        finish();
      },
    };
  },
};

export const clipPlayer = createPlayer(engine);
