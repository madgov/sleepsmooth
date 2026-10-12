// Cheap audio cues for the sleep-state estimate. All thresholds are PROVISIONAL (constants.ts).
// These are acoustic heuristics, not speech recognition: nothing is transcribed or stored, and the only
// output is a yes/no per 0.5 s block that is summed into `speechLikeSec` per epoch.
import { N_MELS, SAMPLE_RATE } from '../audio/constants';
import { melFilterbank } from '../audio/features/mel';
import { SPEECH_BAND_HZ, SPEECH_ENV_STD, SPEECH_FLUX_MIN, SPEECH_MOD_FRACTION } from './constants';

let speechBands: number[] | null = null;
/** Indices of the mel bands whose center lies in the speech band (300 to 3400 Hz). */
function bands(): number[] {
  if (speechBands) return speechBands;
  const bank = melFilterbank();
  const binHz = SAMPLE_RATE / 512;
  const idx: number[] = [];
  for (let m = 0; m < N_MELS; m++) {
    const w = bank[m] as Float64Array;
    let best = 0;
    let bestBin = 0;
    for (let b = 0; b < w.length; b++) if ((w[b] as number) > best) {
      best = w[b] as number;
      bestBin = b;
    }
    const hz = bestBin * binHz;
    if (hz >= SPEECH_BAND_HZ.lo && hz <= SPEECH_BAND_HZ.hi) idx.push(m);
  }
  speechBands = idx;
  return idx;
}

/**
 * Speech-like test on one 0.5 s block of consecutive 10 ms frames (50 envelopes and the matching log-mel rows).
 * All three must hold: the 300 to 3400 Hz band envelope varies enough (not a steady hum), that variation
 * sits mostly at syllable-like rates (2 to 8 Hz, after removing a linear trend so a single onset ramp does
 * not count), and the spectral shape changes frame to frame (not a fixed tone).
 */
export function isSpeechLikeBlock(env: ArrayLike<number>, mel: ArrayLike<Float32Array>): boolean {
  const n = env.length;
  if (n < 20) return false;
  // Linear detrend of the envelope.
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const y = env[i] as number;
    sx += i; sy += y; sxx += i * i; sxy += i * y;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const icpt = (sy - slope * sx) / n;
  const e = new Float64Array(n);
  let varSum = 0;
  for (let i = 0; i < n; i++) {
    e[i] = (env[i] as number) - (icpt + slope * i);
    varSum += (e[i] as number) ** 2;
  }
  const std = Math.sqrt(varSum / n);
  if (std < SPEECH_ENV_STD) return false;
  // DFT at the block's own harmonics: bin k <-> k x (100 Hz / n) cycles per second.
  let mod = 0;
  let all = 0;
  const half = Math.floor(n / 2);
  for (let k = 1; k <= half; k++) {
    let cr = 0, ci = 0;
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * k * i) / n;
      cr += (e[i] as number) * Math.cos(ang);
      ci -= (e[i] as number) * Math.sin(ang);
    }
    const p = cr * cr + ci * ci;
    all += p;
    const hz = (k * 100) / n;
    if (hz >= 2 && hz <= 8) mod += p;
  }
  if (all <= 0 || mod / all < SPEECH_MOD_FRACTION) return false;
  // Spectral-shape change: log-mel with the per-frame mean over speech bands removed.
  const sb = bands();
  if (sb.length === 0 || mel.length < 2) return false;
  let flux = 0;
  let prev: number[] | null = null;
  for (let f = 0; f < mel.length; f++) {
    const row = mel[f] as Float32Array;
    let mean = 0;
    for (const m of sb) mean += row[m] as number;
    mean /= sb.length;
    const cur = sb.map((m) => (row[m] as number) - mean);
    if (prev) {
      let d = 0;
      for (let i = 0; i < cur.length; i++) d += Math.abs((cur[i] as number) - (prev[i] as number));
      flux += d / cur.length;
    }
    prev = cur;
  }
  flux /= mel.length - 1;
  return flux >= SPEECH_FLUX_MIN;
}
