// Log-mel features: Hann window (400 samples, periodic) -> zero-pad to 512 -> FFT -> power
// spectrum |X|^2 -> HTK mel filterbank (40 bands, 0-8000 Hz) -> ln(energy + LOG_EPS).
// No DOM imports.
import { FRAME_SAMPLES, N_MELS } from '../constants';
import { FFT_SIZE, N_BINS, melFilterbank } from './mel';
import { fft, hannWindow } from './fft';

export const LOG_EPS = 1e-10;

let hann: Float64Array | null = null;

export function logMelFrames(frames: Float32Array): Float32Array {
  if (frames.length % FRAME_SAMPLES !== 0) throw new Error(`frames length ${frames.length} is not a multiple of ${FRAME_SAMPLES}`);
  hann ??= hannWindow(FRAME_SAMPLES);
  const bank = melFilterbank();
  const nFrames = frames.length / FRAME_SAMPLES;
  const out = new Float32Array(nFrames * N_MELS);
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const power = new Float64Array(N_BINS);
  for (let f = 0; f < nFrames; f++) {
    re.fill(0);
    im.fill(0);
    const base = f * FRAME_SAMPLES;
    for (let i = 0; i < FRAME_SAMPLES; i++) re[i] = (frames[base + i] as number) * (hann[i] as number);
    fft(re, im);
    for (let b = 0; b < N_BINS; b++) power[b] = (re[b] as number) ** 2 + (im[b] as number) ** 2;
    for (let m = 0; m < N_MELS; m++) {
      const w = bank[m] as Float64Array;
      let e = 0;
      for (let b = 0; b < N_BINS; b++) e += (w[b] as number) * (power[b] as number);
      out[f * N_MELS + m] = Math.log(e + LOG_EPS);
    }
  }
  return out;
}
