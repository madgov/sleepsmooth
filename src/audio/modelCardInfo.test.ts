// Keeps the hand-written in-app model-card numbers honest: every value must appear in model/MODEL_CARD.md,
// and the v1 values must also match model/metrics.json (the raw evaluation output).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MODEL_CARD_FACTS,
  V1_EVALUATION,
  V3_OFFLINE_EVALUATION,
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
    for (const m of V3_OFFLINE_EVALUATION.metrics) expect(card).toContain(find(m));
    expect(card).toContain(`\`${V3_OFFLINE_EVALUATION.version}\``);
    expect(formatRange(V3_OFFLINE_EVALUATION.metrics[1]!)).toBe('0.76 to 1.00');
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
    expect(card).toContain('The app currently runs v1');
  });
});
