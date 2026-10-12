import { mulberry32 } from './rng';

export function rocAuc(scores: number[], labels: number[], weights?: number[]): number {
  // Mann-Whitney with ties = 0.5, optionally weighted.
  const idx = scores.map((_, i) => i).sort((a, b) => scores[a]! - scores[b]!);
  let wPos = 0, wNeg = 0;
  labels.forEach((l, i) => { const w = weights?.[i] ?? 1; if (l) wPos += w; else wNeg += w; });
  if (!wPos || !wNeg) return NaN;
  let acc = 0, negBelow = 0, i = 0;
  while (i < idx.length) {
    let j = i, gNeg = 0, gPos = 0;
    while (j < idx.length && scores[idx[j]!] === scores[idx[i]!]) {
      const k = idx[j]!; const w = weights?.[k] ?? 1;
      if (labels[k]) gPos += w; else gNeg += w;
      j++;
    }
    acc += gPos * (negBelow + gNeg / 2);
    negBelow += gNeg;
    i = j;
  }
  return acc / (wPos * wNeg);
}

export interface Conf { tp: number; fp: number; tn: number; fn: number }
export function confusion(scores: number[], labels: number[], thr: number): Conf {
  const c = { tp: 0, fp: 0, tn: 0, fn: 0 };
  scores.forEach((s, i) => {
    const pred = s >= thr ? 1 : 0;
    if (pred && labels[i]) c.tp++; else if (pred) c.fp++; else if (labels[i]) c.fn++; else c.tn++;
  });
  return c;
}
export function prf(c: Conf) {
  const d = (a: number, b: number) => (b ? a / b : NaN);
  const precision = d(c.tp, c.tp + c.fp), recall = d(c.tp, c.tp + c.fn);
  return {
    accuracy: d(c.tp + c.tn, c.tp + c.tn + c.fp + c.fn), precision, recall,
    f1: d(2 * precision * recall, precision + recall), fpr: d(c.fp, c.fp + c.tn),
  };
}

/** Pick threshold maximizing Youden J, subject to bedroom-negative FPR <= maxBedroomFpr when feasible. */
export function pickThreshold(scores: number[], labels: number[], bedroom: boolean[], maxBedroomFpr: number): number {
  const cands = Array.from(new Set(scores)).sort((a, b) => a - b);
  let best = { thr: 0.5, j: -Infinity, feasible: false };
  for (const thr of cands) {
    const c = confusion(scores, labels, thr);
    const j = c.tp / Math.max(1, c.tp + c.fn) - c.fp / Math.max(1, c.fp + c.tn);
    let bn = 0, bf = 0;
    scores.forEach((s, i) => { if (bedroom[i] && !labels[i]) { bn++; if (s >= thr) bf++; } });
    const feasible = bn === 0 || bf / bn <= maxBedroomFpr;
    if ((feasible && !best.feasible) || (feasible === best.feasible && j > best.j)) best = { thr, j, feasible };
  }
  return best.thr;
}

/** Bootstrap by clip: resample clips with replacement, keep all their windows. Returns [lo, hi] 95%. */
export function bootstrapCi(clipIds: string[], stat: (sel: number[]) => number, B = 1000, seed = 7): [number, number] {
  const byClip = new Map<string, number[]>();
  clipIds.forEach((c, i) => { (byClip.get(c) ?? byClip.set(c, []).get(c)!).push(i); });
  const ids = [...byClip.keys()];
  const r = mulberry32(seed);
  const vals: number[] = [];
  for (let b = 0; b < B; b++) {
    const sel: number[] = [];
    for (let k = 0; k < ids.length; k++) sel.push(...byClip.get(ids[Math.floor(r() * ids.length)]!)!);
    const v = stat(sel);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  if (!vals.length) return [NaN, NaN];
  return [vals[Math.floor(0.025 * (vals.length - 1))]!, vals[Math.ceil(0.975 * (vals.length - 1))]!];
}
