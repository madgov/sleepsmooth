// Runs the REAL src/night/snorePauses.ts countSnorePauses over SYNTHETIC-night window sets prepared by scripts/eval/pause_analysis.py. Usage:
//   tsx scripts/eval/pause_analysis.ts <in.json> <out.json>
// Input per night: scored window indices and the confirmed (flagged) window indices, split into those inside an annotated bout (+-5 s) and those outside.
import { readFileSync, writeFileSync } from 'node:fs';
import { encodeBits } from '../../src/night/codec';
import { WINDOWS_PER_EPOCH } from '../../src/night/constants';
import { countSnorePauses } from '../../src/night/snorePauses';
import type { EpochRecord } from '../../src/night/types';

interface NightIn {
  night: number;
  fold: number;
  hours: number;
  nWindows: number;
  scored: number[];
  flaggedTrue: number[];
  flaggedFalse: number[];
}

function epochsFor(n: NightIn, flagged: Set<number>): EpochRecord[] {
  const byEpoch = new Map<number, number[]>();
  for (const k of n.scored) {
    const e = Math.floor(k / WINDOWS_PER_EPOCH);
    const a = byEpoch.get(e) ?? [];
    a.push(k);
    byEpoch.set(e, a);
  }
  const out: EpochRecord[] = [];
  const nEpochs = Math.ceil(n.nWindows / WINDOWS_PER_EPOCH);
  for (let e = 0; e < nEpochs; e++) {
    const ks = byEpoch.get(e) ?? [];
    const mask = new Array<boolean>(WINDOWS_PER_EPOCH).fill(false);
    const flags: boolean[] = [];
    for (const k of ks) {
      mask[k % WINDOWS_PER_EPOCH] = true;
      flags.push(flagged.has(k));
    }
    out.push({ i: e, cap: 30, win: { total: WINDOWS_PER_EPOCH, belowGate: 0, tooQuiet: 0, scored: ks.length, snoreLike: flags.filter(Boolean).length }, scoredMask: encodeBits(mask), snoreBits: encodeBits(flags) } as unknown as EpochRecord);
  }
  return out;
}

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) throw new Error('usage: tsx scripts/eval/pause_analysis.ts <in.json> <out.json>');
const nights = JSON.parse(readFileSync(inPath, 'utf8')) as NightIn[];
const res = nights.map((n) => {
  const all = new Set([...n.flaggedTrue, ...n.flaggedFalse]);
  const f = new Set(n.flaggedFalse);
  const t = new Set(n.flaggedTrue);
  return {
    night: n.night,
    fold: n.fold,
    hours: n.hours,
    all: countSnorePauses(epochsFor(n, all)),
    falseOnly: countSnorePauses(epochsFor(n, f)),
    trueOnly: countSnorePauses(epochsFor(n, t)),
  };
});
writeFileSync(outPath, JSON.stringify(res));
console.log(`nights ${res.length}`);
