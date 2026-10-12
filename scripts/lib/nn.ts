// Hand-rolled logistic regression and MLP (ER-5). Float64, Adam, L2, fixed seed, sample weights.
import { mulberry32, randn } from './rng';

export interface Dense { W: number[][]; b: number[]; act: 'relu' | 'sigmoid' | 'linear' }
export interface Net { layers: Dense[] }
export interface Norm { mean: number[]; std: number[] }

export function fitNorm(X: ArrayLike<number>[]): Norm {
  const d = X[0]?.length ?? 0;
  const mean = new Array<number>(d).fill(0);
  const std = new Array<number>(d).fill(0);
  for (const x of X) for (let i = 0; i < d; i++) mean[i]! += x[i]!;
  for (let i = 0; i < d; i++) mean[i]! /= X.length;
  for (const x of X) for (let i = 0; i < d; i++) std[i]! += (x[i]! - mean[i]!) ** 2;
  for (let i = 0; i < d; i++) std[i] = Math.max(Math.sqrt(std[i]! / X.length), 1e-6);
  return { mean, std };
}
export function applyNorm(x: ArrayLike<number>, n: Norm): number[] {
  return Array.from({ length: x.length }, (_, i) => (x[i]! - n.mean[i]!) / n.std[i]!);
}

export function forward(net: Net, input: number[]): number {
  let h = input;
  for (const L of net.layers) {
    const next = new Array<number>(L.b.length);
    for (let o = 0; o < next.length; o++) {
      const w = L.W[o]!;
      let z = L.b[o]!;
      for (let i = 0; i < h.length; i++) z += w[i]! * h[i]!;
      next[o] = L.act === 'relu' ? Math.max(0, z) : L.act === 'sigmoid' ? 1 / (1 + Math.exp(-z)) : z;
    }
    h = next;
  }
  return h[0]!;
}

export interface TrainOpts { hidden: number; l2: number; epochs: number; lr: number; batch: number; seed: number }

export function initNet(dim: number, hidden: number, seed: number): Net {
  const r = mulberry32(seed);
  const dense = (inD: number, outD: number, act: Dense['act']): Dense => ({
    W: Array.from({ length: outD }, () => Array.from({ length: inD }, () => randn(r) * Math.sqrt(2 / inD))),
    b: new Array<number>(outD).fill(0),
    act,
  });
  return hidden > 0 ? { layers: [dense(dim, hidden, 'relu'), dense(hidden, 1, 'sigmoid')] } : { layers: [dense(dim, 1, 'sigmoid')] };
}

/** Weighted binary cross-entropy, mini-batch Adam, L2 on weights. hidden = 0 gives logistic regression. */
export function train(X: number[][], y: number[], w: number[], o: TrainOpts): Net {
  const net = initNet(X[0]!.length, o.hidden, o.seed);
  const r = mulberry32(o.seed + 1);
  const params = net.layers.flatMap((L) => [L.W.flat().length, L.b.length]);
  const m = params.map((n) => new Float64Array(n));
  const v = params.map((n) => new Float64Array(n));
  const wsum = w.reduce((a, b) => a + b, 0);
  const wMean = wsum / w.length;
  let t = 0;
  const idx = Array.from({ length: X.length }, (_, i) => i);
  for (let ep = 0; ep < o.epochs; ep++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j]!, idx[i]!]; }
    for (let s = 0; s < idx.length; s += o.batch) {
      const batch = idx.slice(s, s + o.batch);
      const gW = net.layers.map((L) => L.W.map((row) => new Float64Array(row.length)));
      const gB = net.layers.map((L) => new Float64Array(L.b.length));
      for (const n of batch) {
        // forward with cache
        const acts: number[][] = [X[n]!];
        for (const L of net.layers) {
          const h = acts[acts.length - 1]!;
          acts.push(L.b.map((bb, oi) => {
            let z = bb;
            const wr = L.W[oi]!;
            for (let i = 0; i < h.length; i++) z += wr[i]! * h[i]!;
            return L.act === 'relu' ? Math.max(0, z) : L.act === 'sigmoid' ? 1 / (1 + Math.exp(-z)) : z;
          }));
        }
        const p = acts[acts.length - 1]![0]!;
        let delta = [((p - y[n]!) * w[n]!) / wMean]; // dL/dz at sigmoid output with BCE
        for (let li = net.layers.length - 1; li >= 0; li--) {
          const L = net.layers[li]!;
          const hin = acts[li]!;
          const prev = new Array<number>(hin.length).fill(0);
          for (let oi = 0; oi < L.b.length; oi++) {
            const d = delta[oi]!;
            gB[li]![oi]! += d;
            for (let i = 0; i < hin.length; i++) { gW[li]![oi]![i]! += d * hin[i]!; prev[i]! += d * L.W[oi]![i]!; }
          }
          if (li > 0) delta = prev.map((g, i) => (acts[li]![i]! > 0 ? g : 0)); // relu'
        }
      }
      t++;
      const bs = batch.length;
      let pi = 0;
      const step = (arr: Float64Array, get: (i: number) => number, set: (i: number, val: number) => void, l2: boolean) => {
        const mm = m[pi]!; const vv = v[pi]!; pi++;
        for (let i = 0; i < arr.length; i++) {
          const g = arr[i]! / bs + (l2 ? o.l2 * get(i) : 0);
          mm[i] = 0.9 * mm[i]! + 0.1 * g;
          vv[i] = 0.999 * vv[i]! + 0.001 * g * g;
          const mh = mm[i]! / (1 - 0.9 ** t);
          const vh = vv[i]! / (1 - 0.999 ** t);
          set(i, get(i) - (o.lr * mh) / (Math.sqrt(vh) + 1e-8));
        }
      };
      net.layers.forEach((L, li) => {
        const flatG = Float64Array.from(gW[li]!.flatMap((row) => Array.from(row)));
        const inD = L.W[0]!.length;
        step(flatG, (i) => L.W[Math.floor(i / inD)]![i % inD]!, (i, val) => { L.W[Math.floor(i / inD)]![i % inD] = val; }, true);
        step(gB[li]!, (i) => L.b[i]!, (i, val) => { L.b[i] = val; }, false);
      });
    }
  }
  return net;
}
