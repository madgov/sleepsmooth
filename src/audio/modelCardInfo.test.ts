// Keeps the hand-written in-app model-card numbers honest: every value must appear in model/MODEL_CARD.md,
// and the v1 values must also match model/metrics.json (the raw evaluation output).
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MODEL_CARD_FACTS,
  V1_EVALUATION,
  V3_EVALUATION,
  V3_SYNTHETIC_NIGHTS,
  formatRange,
  formatValue,
  type ModelCardEvaluation,
} from './modelCardInfo';

const ROOT = process.cwd();
const card = readFileSync(join(ROOT, 'model/MODEL_CARD.md'), 'utf8');
const metrics = JSON.parse(readFileSync(join(ROOT, 'model/metrics.json'), 'utf8')) as {
  v1: { test: { mlp: { overall: { auc: number; precision: number; recall: number; positives: number; n: number; confusion: { tp: number; fp: number }; ci95: Record<string, [number, number]> } } } };
};
const overall = metrics.v1.test.mlp.overall;

const round = (n: number, d: number) => Number(n.toFixed(d));

describe('in-app model card numbers match model/MODEL_CARD.md', () => {
  it('v1 version string is the one on the card', () => {
    expect(card).toContain(`\`${V1_EVALUATION.version}\``);
  });

  it('v1 values and ranges equal model/metrics.json (rounded as printed)', () => {
    const [auc, recall, precision] = V1_EVALUATION.metrics;
    expect(auc?.value).toBe(round(overall.auc, 3));
    expect(recall?.value).toBe(round(overall.recall, 3));
    expect(precision?.value).toBe(round(overall.precision, 3));
    const ranges = [overall.ci95.auc, overall.ci95.recall, overall.ci95.precision];
    [auc, recall, precision].forEach((m, i) => {
      expect(m?.range?.[0]).toBe(round(ranges[i]?.[0] ?? NaN, 3));
      expect(m?.range?.[1]).toBe(round(ranges[i]?.[1] ?? NaN, 3));
    });
  });

  it('v1 values appear in the card table (value and range)', () => {
    for (const m of V1_EVALUATION.metrics) {
      const [lo, hi] = m.range ?? [NaN, NaN];
      expect(card).toContain(`${formatValue(m)} | ${lo.toFixed(m.decimals)} - ${hi.toFixed(m.decimals)}`);
    }
  });

  it('v3 values and ranges appear in the card (offline numbers)', () => {
    const find = (m: ModelCardEvaluation['metrics'][number]) => {
      const [lo, hi] = m.range ?? [NaN, NaN];
      return `${formatValue(m)} (${lo.toFixed(m.decimals)}-${hi.toFixed(m.decimals)})`;
    };
    for (const m of V3_EVALUATION.metrics) expect(card).toContain(find(m));
    expect(card).toContain(`\`${V3_EVALUATION.version}\``);
    expect(formatRange(V3_EVALUATION.metrics[1]!)).toBe('0.76 to 1.00');
  });

  it('prose facts match the card and metrics.json', () => {
    expect(overall.positives).toBe(MODEL_CARD_FACTS.positiveTestWindows);
    expect(overall.n).toBe(MODEL_CARD_FACTS.testWindows);
    expect(overall.confusion.tp).toBe(MODEL_CARD_FACTS.v1TruePositives);
    expect(overall.confusion.fp).toBe(MODEL_CARD_FACTS.v1FalsePositives);
    expect(card).toContain(`TP ${MODEL_CARD_FACTS.v1TruePositives}, FP ${MODEL_CARD_FACTS.v1FalsePositives}`);
    expect(card).toContain(`Only ${MODEL_CARD_FACTS.positiveTestClips} positive test clips`);
    expect(card).toContain(`${MODEL_CARD_FACTS.positiveTestWindows} snoring, from ${MODEL_CARD_FACTS.positiveTestClips} clips`);
    expect(card).toContain(`AUC ${MODEL_CARD_FACTS.v1Auc8kHz}, recall 0.00`);
    expect(card).toContain('The app runs v3 on iPhone when the runtime loads, v1 otherwise and on web.');
  });

  it('the shipped model files are the ones these numbers describe', () => {
    const v1 = JSON.parse(readFileSync(join(ROOT, 'src/audio/model/model.json'), 'utf8')) as { version: string };
    const v3 = JSON.parse(readFileSync(join(ROOT, 'src/audio/model/model.v3.json'), 'utf8')) as { version: string; status: string };
    expect(V1_EVALUATION.version).toBe(v1.version);
    expect(V3_EVALUATION.version).toBe(v3.version);
    expect(V3_SYNTHETIC_NIGHTS.version).toBe(v3.version);
    expect(v3.status).toBe('shipped');
  });

  it('the bundled YAMNet TFLite file has the size and sha256 stated on the card', () => {
    const f = join(ROOT, 'mobile/assets/models/yamnet_float32.tflite');
    expect(statSync(f).size).toBe(MODEL_CARD_FACTS.yamnetTfliteBytes);
    expect(createHash('sha256').update(readFileSync(f)).digest('hex')).toBe(MODEL_CARD_FACTS.yamnetTfliteSha256);
    expect(card).toContain(MODEL_CARD_FACTS.yamnetTfliteSha256);
    expect(card).toContain(`${MODEL_CARD_FACTS.yamnetTfliteBytes.toLocaleString('en-US')} bytes`);
    expect(card).toContain('CPU and battery cost of v3 over a night: NOT VERIFIED');
  });

  it('synthetic-night numbers equal the evaluation outputs (rounded as shown)', () => {
    type Agg = { fpPerHour: number; recall: number; caught: { all: number }; bouts: { all: number } };
    const seg = JSON.parse(readFileSync(join(ROOT, 'model/segment_eval.synthetic.json'), 'utf8')) as {
      chosen: { cfg: { thr: number; K: number; n: number; M: number }; tuning: Agg; check: Agg };
    };
    const gate = JSON.parse(readFileSync(join(ROOT, 'model/gate_sweep.synthetic.json'), 'utf8')) as {
      adopted: number;
      candidates: Record<string, { tuning: Agg & { assessableFraction: number }; check: Agg & { assessableFraction: number } }>;
    };
    expect(seg.chosen.cfg).toMatchObject({ thr: 0.98, K: 2, n: 7, M: 3 });
    const atGate = gate.candidates[gate.adopted.toFixed(1)]!;
    // The gate sweep at the adopted gate reproduces the original synthetic-night evaluation.
    expect(atGate.tuning.fpPerHour).toBe(seg.chosen.tuning.fpPerHour);
    expect(atGate.check.fpPerHour).toBe(seg.chosen.check.fpPerHour);
    const [tfp, trec, cfp, crec, cassess] = V3_SYNTHETIC_NIGHTS.metrics;
    expect(tfp?.value).toBe(round(seg.chosen.tuning.fpPerHour, 2));
    expect(trec?.value).toBe(round(seg.chosen.tuning.recall, 2));
    expect(trec?.label).toContain(`${seg.chosen.tuning.caught.all} of ${seg.chosen.tuning.bouts.all}`);
    expect(cfp?.value).toBe(round(seg.chosen.check.fpPerHour, 2));
    expect(crec?.value).toBe(round(seg.chosen.check.recall, 2));
    expect(crec?.label).toContain(`${seg.chosen.check.caught.all} of ${seg.chosen.check.bouts.all}`);
    expect(cassess?.value).toBe(round(atGate.check.assessableFraction, 2));
    expect(V3_SYNTHETIC_NIGHTS.testSet).toMatch(/SYNTHETIC/);
  });
});
