// Start-up self-check for the on-device YAMNet runtime. A fixed, generated test tone (no audio of anyone) is run through the bundled float32 TFLite
// model and the v3 head; the result must match the value recorded from the same float32 model on a desktop TFLite runtime (scripts/yamnet/fixtures/
// synthetic_fixtures.json, fixture "tone-440hz-amp0.3", expectedTflite.headScore). If it does not, the app uses the v1 fallback instead of an unverified
// runtime. This is a sanity check on one input, NOT a parity proof (docs/YAMNET_INTEGRATION.md lists the full on-device check as NOT VERIFIED).
import { YAMNET_PATCH_SAMPLES } from './scorer';

/** Same formula as scripts/yamnet/parity.py _synthetic_waveforms: 0.3 * sin(2 pi 440 t), float32, 16 kHz. */
export function selfCheckTone(): Float32Array {
  const x = new Float32Array(YAMNET_PATCH_SAMPLES);
  for (let i = 0; i < x.length; i++) x[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / 16000);
  return x;
}

/** Head probability of selfCheckTone() from the float32 TFLite file on desktop TensorFlow 2.16.2 (fixture file, 6 decimals). */
export const SELF_CHECK_EXPECTED_HEAD = 0.038618;
/** The pre-registered parity bound for head probability (docs/YAMNET_INTEGRATION.md). */
export const SELF_CHECK_TOLERANCE = 0.01;

export function selfCheckPasses(headProbability: number): boolean {
  return Number.isFinite(headProbability) && Math.abs(headProbability - SELF_CHECK_EXPECTED_HEAD) < SELF_CHECK_TOLERANCE;
}
