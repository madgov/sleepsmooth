// Window scorer for the YAMNet v3 head: one 15,600-sample patch (16 kHz) -> 521 YAMNet class scores (any runtime) -> v3 head probability.
// Pure TypeScript. The YAMNet runtime (react-native-fast-tflite on the iPhone) is injected as `run`, so this file and the night pipeline can be tested
// without it. Nothing here claims that an on-device runtime works: that is established only by running it (docs/YAMNET_INTEGRATION.md).
// Scores are internal. They are never shown as percentages or "confidence".
import { scoreEmbedding, scoresToLogits, YAMNET_NUM_CLASSES, type YamnetHeadModel } from './head';

/** One YAMNet patch: 0.975 s at 16 kHz. A 1 s analysis window uses the centred 15,600 samples (offset 200). */
export const YAMNET_PATCH_SAMPLES = 15600;
export const YAMNET_WINDOW_SAMPLES = 16000;
export const YAMNET_PATCH_OFFSET = (YAMNET_WINDOW_SAMPLES - YAMNET_PATCH_SAMPLES) / 2;

/** Runs YAMNet on one patch and returns the 521 class scores in [0, 1]. May throw. */
export type YamnetRunner = (patch: Float32Array) => ArrayLike<number>;

export interface WindowScorer {
  /** Recorded on the night (NightRecord.modelVersion) and shown in the app. */
  readonly version: string;
  /** Flag a scored window when score(...) is at least this (the pre-registered operating point, not the head's own threshold). */
  readonly flagThreshold: number;
  /** Head probability in [0, 1] for one patch of YAMNET_PATCH_SAMPLES samples. Throws on a bad patch or a bad runtime output. */
  score(patch: Float32Array): number;
}

export function createYamnetScorer(run: YamnetRunner, head: YamnetHeadModel, opts: { flagThreshold: number; runtimeLabel: string }): WindowScorer {
  if (head.input.kind !== 'class-score-logits') throw new Error('this scorer needs a head on class-score logits');
  return {
    version: `${head.version} on ${opts.runtimeLabel}`,
    flagThreshold: opts.flagThreshold,
    score(patch: Float32Array): number {
      if (patch.length !== YAMNET_PATCH_SAMPLES) throw new Error(`patch length ${patch.length}, expected ${YAMNET_PATCH_SAMPLES}`);
      const scores = run(patch);
      if (scores.length !== YAMNET_NUM_CLASSES) throw new Error(`YAMNet returned ${scores.length} values, expected ${YAMNET_NUM_CLASSES}`);
      for (let i = 0; i < scores.length; i++) if (!Number.isFinite(scores[i] as number)) throw new Error('YAMNet returned a non-finite value');
      return scoreEmbedding(head, scoresToLogits(scores));
    },
  };
}
