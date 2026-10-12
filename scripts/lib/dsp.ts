import { randn } from './rng';

/** Blackman-windowed sinc lowpass FIR (zero-phase via centered taps). */
export function lowpass(x: Float32Array, cutoffHz: number, rate = 16000, taps = 127): Float32Array {
  const h = new Float64Array(taps);
  const mid = (taps - 1) / 2;
  const fc = cutoffHz / rate;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const n = i - mid;
    const sinc = n === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * n) / (Math.PI * n);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (taps - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (taps - 1));
    h[i] = sinc * w;
    sum += h[i]!;
  }
  for (let i = 0; i < taps; i++) h[i]! /= sum;
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let a = 0;
    const lo = Math.max(0, mid - i), hi = Math.min(taps, x.length - i + mid);
    for (let k = lo; k < hi; k++) a += h[k]! * x[i + k - mid]!;
    out[i] = a;
  }
  return out;
}

export function whiteNoise(n: number, r: () => number): Float32Array {
  return Float32Array.from({ length: n }, () => randn(r));
}

export function pinkNoise(n: number, r: () => number): Float32Array {
  const o = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = randn(r);
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    o[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
  }
  return o;
}

/** Add noise so signal-RMS / noise-RMS = snrDb. `sigRms` is measured by the caller (kept windows). */
export function addNoise(x: Float32Array, noise: Float32Array, sigRms: number, snrDb: number): Float32Array {
  let ne = 0;
  for (const v of noise) ne += v * v;
  const g = sigRms / 10 ** (snrDb / 20) / Math.sqrt(ne / noise.length);
  return Float32Array.from(x, (v, i) => v + g * noise[i]!);
}
