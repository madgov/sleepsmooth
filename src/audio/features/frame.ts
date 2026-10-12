// Framing helpers. No DOM imports.
import { FRAME_SAMPLES, HOP_SAMPLES, FRAMES_PER_WINDOW } from '../constants';

/** Number of full frames available in `length` samples (no padding). */
export function countFrames(length: number): number {
  return length < FRAME_SAMPLES ? 0 : Math.floor((length - FRAME_SAMPLES) / HOP_SAMPLES) + 1;
}

/** Flat nFrames * FRAME_SAMPLES array of un-padded 25 ms frames at a 10 ms hop. */
export function frameSignal(signal: Float32Array): Float32Array {
  const n = countFrames(signal.length);
  const out = new Float32Array(n * FRAME_SAMPLES);
  for (let i = 0; i < n; i++) out.set(signal.subarray(i * HOP_SAMPLES, i * HOP_SAMPLES + FRAME_SAMPLES), i * FRAME_SAMPLES);
  return out;
}

/**
 * Frames for a 1 s window with FRAMES_PER_WINDOW (100) rows. A 16000-sample window only has 98
 * full frames, so the window is zero-padded symmetrically by (99 * hop + frame - length) / 2
 * = 120 samples per side (centered framing).
 */
export function frameWindow(window: Float32Array): Float32Array {
  const padTotal = (FRAMES_PER_WINDOW - 1) * HOP_SAMPLES + FRAME_SAMPLES - window.length;
  if (padTotal < 0 || padTotal % 2 !== 0) throw new Error(`Window of ${window.length} samples cannot be framed into ${FRAMES_PER_WINDOW} frames`);
  const pad = padTotal / 2;
  const padded = new Float32Array(window.length + padTotal);
  padded.set(window, pad);
  return frameSignal(padded);
}
