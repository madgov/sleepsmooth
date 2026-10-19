// On-device YAMNet v3 scorer (react-native-fast-tflite) with an honest v1 fallback.
//
// WHAT THIS DOES: loads the bundled float32 YAMNet TFLite file (assets/models/yamnet_float32.tflite, converted from the provenance-verified Google
// yamnet.h5 by scripts/yamnet/convert_float_tflite.py) and wraps it with the v3 head (src/audio/yamnet). If anything is missing, the night uses the v1
// model instead and the night record says so. Nothing is silently substituted: the version string recorded on the night is the model that actually ran.
//
// FALLBACK (v1) happens in: Expo Go (no native TFLite module), web, a missing react-native-fast-tflite / react-native-nitro-modules install, a model
// that fails to load or has the wrong tensor shapes, and a failed start-up self-check (selfCheck.ts).
//
// NOT VERIFIED: this code has never run on an iPhone. The desktop parity (docs/YAMNET_INTEGRATION.md) is for TensorFlow's desktop interpreter.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import head from '@core/audio/model/model.v3.json';
import type { YamnetHeadModel } from '@core/audio/yamnet/head';
import { YAMNET_NUM_CLASSES } from '@core/audio/yamnet/head';
import { V3_OPERATING_POINT } from '@core/night/operatingPoint';
import { YAMNET_PATCH_SAMPLES, createYamnetScorer, type WindowScorer } from '@core/audio/yamnet/scorer';
import { selfCheckPasses, selfCheckTone } from '@core/audio/yamnet/selfCheck';

export const YAMNET_RUNTIME_LABEL = 'YAMNet float32 (TFLite)';
const HEAD = head as unknown as YamnetHeadModel;

export type FallbackReason = 'web' | 'expo-go' | 'native-module-missing' | 'model-load-failed' | 'tensor-shape' | 'self-check-failed' | 'head-not-shipped';

export interface ScorerLoad {
  scorer: WindowScorer | null;
  /** null when the YAMNet scorer is active. */
  fallbackReason: FallbackReason | null;
  detail: string | null;
}

const fallback = (fallbackReason: FallbackReason, detail: string | null = null): ScorerLoad => ({ scorer: null, fallbackReason, detail });
const prod = (s: readonly number[]) => s.reduce((a, b) => a * b, 1);

let pending: Promise<ScorerLoad> | null = null;

/** Loads once per app run. Never throws: every failure returns the v1 fallback with a reason. */
export function loadYamnetScorer(): Promise<ScorerLoad> {
  pending ??= doLoad().catch((e: unknown) => fallback('model-load-failed', String(e)));
  return pending;
}

async function doLoad(): Promise<ScorerLoad> {
  if (Platform.OS === 'web') return fallback('web');
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return fallback('expo-go');
  if (HEAD.status !== 'shipped') return fallback('head-not-shipped');
  let loadTensorflowModel: (src: number, delegates: string[]) => Promise<{
    inputs: { dataType: string; shape: number[] }[];
    outputs: { dataType: string; shape: number[] }[];
    runSync(input: ArrayBuffer[]): ArrayBuffer[];
  }>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loadTensorflowModel = require('react-native-fast-tflite').loadTensorflowModel;
  } catch (e) {
    return fallback('native-module-missing', String(e));
  }
  let model: Awaited<ReturnType<typeof loadTensorflowModel>>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    model = await loadTensorflowModel(require('../../assets/models/yamnet_float32.tflite'), []); // [] = CPU delegate, no GPU/CoreML
  } catch (e) {
    return fallback('model-load-failed', String(e));
  }
  const inp = model.inputs[0];
  const out = model.outputs[0];
  if (!inp || !out || inp.dataType !== 'float32' || prod(inp.shape) !== YAMNET_PATCH_SAMPLES || out.dataType !== 'float32' || prod(out.shape) !== YAMNET_NUM_CLASSES) {
    return fallback('tensor-shape', JSON.stringify({ in: inp, out }));
  }
  const run = (patch: Float32Array): Float32Array => {
    const bytes = patch.buffer.slice(patch.byteOffset, patch.byteOffset + patch.byteLength) as ArrayBuffer;
    const res = model.runSync([bytes]);
    return new Float32Array(res[0] as ArrayBuffer);
  };
  const scorer = createYamnetScorer(run, HEAD, { flagThreshold: V3_OPERATING_POINT.headThreshold, runtimeLabel: YAMNET_RUNTIME_LABEL });
  try {
    if (!selfCheckPasses(scorer.score(selfCheckTone()))) return fallback('self-check-failed', 'the test tone result differs from the desktop reference');
  } catch (e) {
    return fallback('self-check-failed', String(e));
  }
  return { scorer, fallbackReason: null, detail: null };
}
