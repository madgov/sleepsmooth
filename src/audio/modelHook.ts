// InferenceHook backed by the shipped MLP (M6). Pure TS; used by the worker and by Node tests.
// Windows are 1 s with a 0.5 s hop. Windows below SILENCE_FLOOR_DBFS are skipped here and counted as
// "too quiet to assess" by analyze.ts (Amendment 2). Scores stay internal (Amendment 3).
import type { WindowObs } from '../types/audio';
import type { InferenceHook } from './analyze';
import { SAMPLE_RATE, SILENCE_FLOOR_DBFS, WINDOW_HOP_SEC, WINDOW_SEC } from './constants';
import { frameLogMel } from './features';
import { isSnoreLike, loadShippedModel, rmsDbfs, scoreWindow } from './model/infer';
import type { ModelJson } from './model/schema';

const WIN = Math.round(WINDOW_SEC * SAMPLE_RATE);
const HOP = Math.round(WINDOW_HOP_SEC * SAMPLE_RATE);
const CHUNK_HOPS = 60; // 30 s / 0.5 s

export function createModelHook(model: ModelJson): InferenceHook {
  return {
    modelVersion: model.version,
    run(chunk16k: Float32Array, t0Sec: number): WindowObs[] {
      const out: WindowObs[] = [];
      for (let k = 0; k < CHUNK_HOPS; k++) {
        const s = k * HOP;
        if (s + WIN > chunk16k.length) break;
        if (rmsDbfs(chunk16k, s, WIN) < SILENCE_FLOOR_DBFS) continue; // too quiet to assess
        const score = scoreWindow(model, frameLogMel(chunk16k.subarray(s, s + WIN)));
        const t0 = t0Sec + s / SAMPLE_RATE;
        out.push({ t0, t1: t0 + WINDOW_SEC, snoreLike: isSnoreLike(model, score), score });
      }
      return out;
    },
  };
}

/** Hook for the model included in this build, or null when none ships (ER-9). */
export function shippedModelHook(): InferenceHook | null {
  const m = loadShippedModel();
  return m ? createModelHook(m) : null;
}
