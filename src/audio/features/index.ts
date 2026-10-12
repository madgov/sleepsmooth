// FROZEN CONTRACT (ER-4): signatures are frozen; bodies delegate to the modules in this folder.
// NO DOM imports (shared with Node).
import { N_MELS } from '../constants';
import { resampleAll } from './resample';
import { logMelFrames } from './logmel';
import { frameWindow } from './frame';

/** Resample mono audio to 16 kHz using our own resampler (same code in Node and browser). */
export function resampleTo16k(samples: Float32Array, sourceRate: number): Float32Array {
  return resampleAll(samples, sourceRate);
}

/**
 * `frames` is a flat Float32Array of `nFrames * FRAME_SAMPLES` samples at 16 kHz
 * (400 samples per 25 ms frame). Returns a flat Float32Array of `nFrames * N_MELS (40)` log-mel values.
 */
export function computeLogMel(frames: Float32Array): Float32Array {
  return logMelFrames(frames);
}

/**
 * `window` is 1 s of mono audio at 16 kHz (16000 samples).
 * Returns FRAMES_PER_WINDOW (100) x N_MELS (40) log-mel, flat row-major (length 4000).
 */
export function frameLogMel(window: Float32Array): Float32Array {
  return logMelFrames(frameWindow(window));
}

export const LOGMEL_BANDS = N_MELS;
