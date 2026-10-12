// Web preview playback with the browser's own AudioContext (typed locally: the mobile tsconfig has no DOM lib).
import { createPlayer, type PlayEngine } from './playerStore';

interface WebBuffer {
  copyToChannel(src: Float32Array, ch: number): void;
}
interface WebSource {
  buffer: WebBuffer | null;
  onended: (() => void) | null;
  connect(dest: unknown): void;
  start(): void;
  stop(): void;
}
interface WebCtx {
  currentTime: number;
  destination: unknown;
  createBuffer(ch: number, len: number, rate: number): WebBuffer;
  createBufferSource(): WebSource;
  close(): Promise<void>;
}
const Ctor = (globalThis as unknown as { AudioContext?: new () => WebCtx }).AudioContext;

const engine: PlayEngine = {
  available: typeof Ctor === 'function',
  unavailableReason: 'This browser cannot play audio here.',
  start(samples, rate, onProgress, onEnd) {
    const ctx = new Ctor!();
    const buffer = ctx.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples, 0);
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
      void ctx.close();
    };
    src.onended = () => {
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
