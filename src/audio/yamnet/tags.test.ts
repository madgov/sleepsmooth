import { describe, expect, it } from 'vitest';
import { SPEECH_EXCLUDE, TAG_DEFS, YAMNET_CLASS, YAMNET_NUM_CLASSES, tagClip } from './tags';

const frame = (set: Record<number, number> = {}) => {
  const f = new Array<number>(YAMNET_NUM_CLASSES).fill(0);
  for (const [k, v] of Object.entries(set)) f[Number(k)] = v;
  return f;
};
const def = (t: string) => TAG_DEFS.find((d) => d.tag === t)!;

describe('YAMNet tags', () => {
  it('class indices match the official class map', () => {
    expect(YAMNET_CLASS).toMatchObject({ speech: 0, breathing: 36, wheeze: 37, snoring: 38, gasp: 39, snort: 41, cough: 42, sneeze: 44 });
  });
  it('validated tags have a threshold and an evaluation; unvalidated tags have neither and are hidden', () => {
    for (const d of TAG_DEFS) {
      if (d.validated) {
        expect(d.threshold).not.toBeNull();
        expect(d.evaluation).not.toBeNull();
        expect(d.showInApp).toBe((d.evaluation?.precision ?? 0) >= 0.5);
      } else {
        expect(d.threshold).toBeNull();
        expect(d.evaluation).toBeNull();
        expect(d.showInApp).toBe(false);
        expect(d.label).toMatch(/unvalidated/);
      }
    }
    expect(def('gasp-like').validated).toBe(false);
    expect(def('wheeze-like').validated).toBe(false);
  });
  it('tags a clip by the max over frames and mapped classes', () => {
    const t = def('snore-like').threshold!;
    const r = tagClip([frame(), frame({ [YAMNET_CLASS.snort]: t + 0.01 }), frame()]);
    expect(r).toEqual({ excluded: false, excludedReason: null, tags: ['snore-like'] });
    const c = def('cough-like').threshold!;
    expect(tagClip([frame({ [YAMNET_CLASS.cough]: c - 0.01 })]).tags).toEqual([]);
  });
  it('never emits a tag whose showInApp is false (unvalidated or low precision)', () => {
    const hidden = TAG_DEFS.filter((d) => !d.showInApp);
    const f = frame(Object.fromEntries(hidden.flatMap((d) => d.classes.map((c) => [c, 1]))));
    expect(tagClip([f]).tags).toEqual([]);
  });
  it('never emits an unvalidated tag, even at score 1', () => {
    const r = tagClip([frame({ [YAMNET_CLASS.gasp]: 1, [YAMNET_CLASS.wheeze]: 1 })]);
    expect(r.tags).toEqual([]);
  });
  it('excludes clips with speech and clips with no frames', () => {
    expect(tagClip([frame({ [YAMNET_CLASS.speech]: SPEECH_EXCLUDE.threshold, [YAMNET_CLASS.snoring]: 1 })])).toEqual({ excluded: true, excludedReason: 'speech', tags: [] });
    expect(tagClip([])).toEqual({ excluded: true, excludedReason: 'no-frames', tags: [] });
  });
  it('rejects wrongly sized score vectors', () => {
    expect(() => tagClip([[0.1, 0.2]])).toThrow(/521/);
  });
});
