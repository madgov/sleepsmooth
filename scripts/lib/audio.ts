import { SAMPLE_RATE, WINDOW_HOP_SEC, WINDOW_SEC } from '../../src/audio/constants';

export const WIN = SAMPLE_RATE * WINDOW_SEC;
export const HOP = Math.round(SAMPLE_RATE * WINDOW_HOP_SEC);

export function windowStarts(n: number): number[] {
  const out: number[] = [];
  for (let s = 0; s + WIN <= n; s += HOP) out.push(s);
  return out;
}

export function rmsDbfs(x: Float32Array, start: number, len: number): number {
  let s = 0;
  for (let i = start; i < start + len; i++) s += (x[i] ?? 0) ** 2;
  const rms = Math.sqrt(s / len);
  return rms > 0 ? Math.max(-120, 20 * Math.log10(rms)) : -120;
}
