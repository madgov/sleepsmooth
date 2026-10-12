import type { AudioAnalysis } from '../types/audio';

export type WorkerRequest =
  | { type: 'analyze'; samples: Float32Array; sampleRate: number; isSynthetic?: boolean }
  | { type: 'cancel' };

export type WorkerResponse =
  | { type: 'progress'; fraction: number; stage: string }
  | { type: 'done'; analysis: AudioAnalysis }
  | { type: 'cancelled' }
  | { type: 'error'; message: string };
