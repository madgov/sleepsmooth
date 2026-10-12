import { describe, expect, it } from 'vitest';
import {
  CLIP_CATEGORY_META,
  CLIP_SCORING,
  ClipEventTracker,
  ClipRecorder,
  ClipSelector,
  MAX_NIGHT_CLIP_BYTES,
  PcmRing,
  clipBytes,
  clipSections,
  clipsToPrune,
  computePeaks,
  decodeWav16,
  encodeWav16,
  estimateStorageBytes,
  formatBytes,
  mergeClipSettings,
  nightClipsState,
  parseClipsManifest,
  type CandidateEvent,
  type ClipMeta,
  type SelectableClip,
  type WindowObs,
} from './clips';

const win = (k: number, o: Partial<WindowObs> = {}): WindowObs => ({ k, status: 'scored', levelDb: -30, floorDb: -50, snoreLike: false, speechLike: false, ...o });
const snoreWin = (k: number) => win(k, { snoreLike: true, levelDb: -35 });

function run(tracker: ClipEventTracker, from: number, to: number, f: (k: number) => WindowObs): CandidateEvent[] {
  const out: CandidateEvent[] = [];
  for (let k = from; k <= to; k++) out.push(...tracker.observe(f(k)));
  return out;
}

describe('ClipEventTracker', () => {
  it('turns a snore-like run into one scored event', () => {
    const t = new ClipEventTracker();
    const ev = [...run(t, 0, 7, snoreWin), ...t.flush()];
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ category: 'snore-like', tag: null });
    expect(ev[0]!.score).toBeGreaterThan(CLIP_SCORING.minSnoreScore);
  });

  it('tags a restart only after a fully observed quiet gap of 10 to 120 s', () => {
    const t = new ClipEventTracker();
    // snoring, 12 s quiet (24 windows), snoring again
    const ev = [...run(t, 0, 5, snoreWin), ...run(t, 6, 29, (k) => win(k, { levelDb: -48 })), ...run(t, 30, 36, snoreWin), ...t.flush()];
    const snores = ev.filter((e) => e.category === 'snore-like');
    expect(snores).toHaveLength(2);
    expect(snores[0]!.tag).toBeNull();
    expect(snores[1]!.tag).toBe('snoring-stopped-restarted');
    expect(snores[1]!.restartGapSec).toBeGreaterThanOrEqual(10);
    expect(snores[1]!.score).toBeGreaterThan(CLIP_SCORING.restartBonus);
  });

  it('does not tag a short pause, and not a gap longer than 120 s', () => {
    const t = new ClipEventTracker();
    const short = [...run(t, 0, 5, snoreWin), ...run(t, 6, 15, (k) => win(k, { levelDb: -48 })), ...run(t, 16, 22, snoreWin), ...t.flush()];
    expect(short.filter((e) => e.tag === 'snoring-stopped-restarted')).toHaveLength(0);
    const t2 = new ClipEventTracker();
    const long = [...run(t2, 0, 5, snoreWin), ...run(t2, 6, 300, (k) => win(k, { levelDb: -48 })), ...run(t2, 301, 307, snoreWin), ...t2.flush()];
    expect(long.filter((e) => e.tag === 'snoring-stopped-restarted')).toHaveLength(0);
  });

  it('never counts unobserved time (skipped windows or a k jump) as snoring stopping', () => {
    const t = new ClipEventTracker();
    const ev = [...run(t, 0, 5, snoreWin), ...run(t, 6, 29, (k) => win(k, { status: 'skipped', levelDb: NaN })), ...run(t, 30, 36, snoreWin), ...t.flush()];
    expect(ev.filter((e) => e.tag === 'snoring-stopped-restarted')).toHaveLength(0);
    const t2 = new ClipEventTracker();
    const ev2 = [...run(t2, 0, 5, snoreWin), ...run(t2, 60, 66, snoreWin), ...t2.flush()];
    expect(ev2.filter((e) => e.tag === 'snoring-stopped-restarted')).toHaveLength(0);
  });

  it('splits a long run into segments no longer than the event cap', () => {
    const t = new ClipEventTracker();
    const ev = [...run(t, 0, 80, snoreWin), ...t.flush()];
    expect(ev.length).toBeGreaterThan(2);
    for (const e of ev) expect(e.endSec - e.startSec).toBeLessThanOrEqual(CLIP_SCORING.maxEventSec + 1);
    // only the first segment after real silence could carry the restart bonus; continuing segments must not
    expect(ev.filter((e) => e.tag === 'snoring-stopped-restarted')).toHaveLength(0);
  });

  it('flags a brief loud non-snore sound and tags it brief', () => {
    const t = new ClipEventTracker();
    const quiet = (k: number) => win(k, { levelDb: -48 });
    const ev = [...run(t, 0, 3, quiet), ...run(t, 4, 5, (k) => win(k, { levelDb: -25 })), ...run(t, 6, 12, quiet), ...t.flush()];
    const loud = ev.filter((e) => e.category === 'loud-other');
    expect(loud).toHaveLength(1);
    expect(loud[0]!.tag).toBe('brief-loud-sound');
  });

  it('excludes speech-like windows from loud sounds and reports overlap', () => {
    const t = new ClipEventTracker();
    const ev = [...run(t, 0, 7, (k) => win(k, { levelDb: -25, speechLike: true })), ...t.flush()];
    expect(ev.filter((e) => e.category === 'loud-other')).toHaveLength(0);
    expect(t.speechOverlaps(0, 3)).toBe(true);
    expect(t.speechOverlaps(100, 110)).toBe(false);
  });
});

describe('ClipSelector', () => {
  const c = (id: string, category: SelectableClip['category'], score: number, startSec: number): SelectableClip => ({ id, category, score, startSec });

  it('keeps the top-2 snore-like and returns evicted clips', () => {
    const s = new ClipSelector<SelectableClip>();
    expect(s.offer(c('a', 'snore-like', 50, 0)).accept).toBe(true);
    expect(s.offer(c('b', 'snore-like', 40, 1000)).accept).toBe(true);
    const p = s.offer(c('c', 'snore-like', 60, 2000));
    expect(p.accept).toBe(true);
    expect(p.evict.map((x) => x.id)).toEqual(['b']);
    expect(s.offer(c('d', 'snore-like', 10, 3000)).accept).toBe(false);
    expect(s.selected().map((x) => x.id)).toEqual(['c', 'a']);
  });

  it('a better nearby clip replaces its neighbour instead of taking a second slot', () => {
    const s = new ClipSelector<SelectableClip>();
    s.offer(c('a', 'snore-like', 50, 0));
    const p = s.offer(c('b', 'snore-like', 70, 60));
    expect(p.evict.map((x) => x.id)).toEqual(['a']);
    expect(s.selected()).toHaveLength(1);
    expect(s.offer(c('weak', 'snore-like', 20, 120)).accept).toBe(false);
  });

  it('breaks ties toward the earlier clip', () => {
    const s = new ClipSelector<SelectableClip>();
    s.offer(c('early', 'snore-like', 50, 0));
    expect(s.offer(c('late', 'snore-like', 50, 100)).accept).toBe(false);
  });

  it('allows 3 other-sound slots and refuses reserved categories', () => {
    const s = new ClipSelector<SelectableClip>();
    for (let i = 0; i < 4; i++) s.offer(c(`l${i}`, 'loud-other', 20 + i, i * 1000));
    expect(s.selected().filter((x) => x.category === 'loud-other')).toHaveLength(3);
    expect(s.offer(c('g', 'gasp-like', 999, 5000)).accept).toBe(false);
    expect(CLIP_CATEGORY_META['sleep-talking'].needsOwnOptIn).toBe(true);
    expect(CLIP_CATEGORY_META['cough-like'].implemented).toBe(false);
  });
});

describe('PcmRing', () => {
  it('reads back what was written and refuses overwritten or future ranges', () => {
    const r = new PcmRing(10);
    r.push(Float32Array.from([1, 2, 3, 4, 5, 6]));
    expect(Array.from(r.read(2, 5)!)).toEqual([3, 4, 5]);
    r.push(Float32Array.from([7, 8, 9, 10, 11, 12]));
    expect(r.read(0, 3)).toBeNull(); // overwritten
    expect(r.read(5, 20)).toBeNull(); // not arrived
    expect(Array.from(r.read(8, 12)!)).toEqual([9, 10, 11, 12]);
  });
  it('advance fills a gap with silence on the same timeline', () => {
    const r = new PcmRing(10);
    r.push(Float32Array.from([1, 1]));
    r.advance(3);
    expect(r.headSample).toBe(5);
    expect(Array.from(r.read(0, 5)!)).toEqual([1, 1, 0, 0, 0]);
  });
});

describe('WAV and peaks', () => {
  it('round-trips 16-bit mono PCM within quantisation error', () => {
    const x = Float32Array.from([0, 0.5, -0.5, 1, -1, 0.123]);
    const bytes = encodeWav16(x, 16000);
    expect(bytes.length).toBe(clipBytes(x.length / 16000));
    const d = decodeWav16(bytes)!;
    expect(d.rate).toBe(16000);
    for (let i = 0; i < x.length; i++) expect(Math.abs(d.samples[i]! - x[i]!)).toBeLessThan(1 / 16000);
  });
  it('rejects non-WAV data without throwing', () => {
    expect(decodeWav16(new Uint8Array(10))).toBeNull();
    expect(decodeWav16(new Uint8Array(100))).toBeNull();
  });
  it('computePeaks returns the requested bar count in 0..100', () => {
    const x = new Float32Array(16000).map((_, i) => Math.sin(i / 20) * (i / 16000));
    const p = computePeaks(x, 48);
    expect(p).toHaveLength(48);
    expect(Math.max(...p)).toBe(100);
    expect(Math.min(...p)).toBeGreaterThanOrEqual(0);
    expect(computePeaks(new Float32Array(0))).toEqual([]);
  });
});

describe('storage budget and retention', () => {
  it('worst case is 5 clips of 15 s, about 2.4 MB per night', () => {
    expect(clipBytes(15)).toBe(480_044);
    expect(MAX_NIGHT_CLIP_BYTES).toBe(5 * 480_044);
    expect(formatBytes(MAX_NIGHT_CLIP_BYTES)).toBe('2.3 MB'); // 2,400,220 bytes in MiB; ~2.4 MB decimal
    expect(estimateStorageBytes(90)).toBe(90 * MAX_NIGHT_CLIP_BYTES);
  });
  it('prunes only nights older than the horizon', () => {
    const now = Date.UTC(2026, 5, 30);
    const day = 86_400_000;
    const nights = [
      { id: 'old', startMs: now - 40 * day },
      { id: 'edge', startMs: now - 29 * day },
      { id: 'new', startMs: now - 1 * day },
    ];
    expect(clipsToPrune(nights, now, 30)).toEqual(['old']);
    expect(clipsToPrune(nights, now, 7)).toEqual(['old', 'edge']);
  });
  it('merges clip settings defensively; saving is off by default', () => {
    expect(mergeClipSettings(undefined)).toEqual({ enabled: false, retentionDays: 30, decidedAt: null });
    expect(mergeClipSettings({ enabled: 'yes', retentionDays: 5 }).enabled).toBe(false);
    expect(mergeClipSettings({ enabled: true, retentionDays: 90, decidedAt: 'x' })).toEqual({ enabled: true, retentionDays: 90, decidedAt: 'x' });
  });
});

describe('ClipRecorder end to end', () => {
  function makeSink() {
    const files = new Map<string, Uint8Array>();
    return { files, sink: { writeTemp: (id: string, w: Uint8Array) => void files.set(id, w), removeTemp: (id: string) => void files.delete(id) } };
  }
  /** Feed N seconds of 16 kHz audio and the matching windows. `kind(sec)` says what each second is. */
  function feed(rec: ClipRecorder, seconds: number, kind: (sec: number) => 'quiet' | 'snore' | 'loud' | 'speech', startK = 0) {
    for (let s = 0; s < seconds; s++) {
      const k = startK + s * 2;
      const kd = kind(s);
      const amp = kd === 'quiet' ? 0.001 : 0.2;
      rec.pushAudio(new Float32Array(16000).fill(amp), 16000);
      for (const kk of [k, k + 1]) {
        rec.onWindow(
          kd === 'snore'
            ? win(kk, { snoreLike: true, levelDb: -35 })
            : kd === 'loud'
              ? win(kk, { levelDb: -25 })
              : kd === 'speech'
                ? win(kk, { levelDb: -25, speechLike: true })
                : win(kk, { levelDb: -50, floorDb: -50 }),
        );
      }
    }
  }

  it('saves a snore-like clip with pre and post roll and no more than the cap', () => {
    const { files, sink } = makeSink();
    const rec = new ClipRecorder(1_000_000, sink);
    feed(rec, 60, (s) => (s >= 20 && s < 28 ? 'snore' : 'quiet'));
    const out = rec.finish();
    expect(out).toHaveLength(1);
    expect(out[0]!.category).toBe('snore-like');
    expect(out[0]!.durationSec).toBeGreaterThan(8);
    expect(out[0]!.durationSec).toBeLessThanOrEqual(CLIP_SCORING.maxClipSec);
    expect(out[0]!.peaks).toHaveLength(48);
    expect(files.size).toBe(1);
    expect(decodeWav16(files.get(out[0]!.id)!)!.samples.length).toBe(Math.round(out[0]!.durationSec * 16000));
  });

  it('writes nothing when no clip qualifies', () => {
    const { files, sink } = makeSink();
    const rec = new ClipRecorder(0, sink);
    feed(rec, 40, () => 'quiet');
    expect(rec.finish()).toEqual([]);
    expect(files.size).toBe(0);
    expect(rec.stats.tempWrites).toBe(0);
  });

  it('drops speech-like stretches and never writes them', () => {
    const { files, sink } = makeSink();
    const rec = new ClipRecorder(0, sink);
    feed(rec, 40, (s) => (s >= 10 && s < 14 ? 'speech' : s >= 15 && s < 20 ? 'loud' : 'quiet'));
    rec.finish();
    // the loud stretch at 15-20 s has a post/pre-roll that overlaps speech ending at 14 s, so it is dropped
    expect(rec.stats.droppedSpeech).toBeGreaterThan(0);
    expect(files.size).toBe(0);
  });

  it('deletes replaced temp files immediately and keeps at most 5 on disk', () => {
    const { files, sink } = makeSink();
    const rec = new ClipRecorder(0, sink);
    // eight well-separated snore bouts of increasing loudness cannot be expressed with fixed levels, so use length
    let startK = 0;
    for (let bout = 0; bout < 8; bout++) {
      const len = 4 + bout; // longer bouts score higher
      feed(rec, len, () => 'snore', startK);
      startK += len * 2;
      feed(rec, 330, () => 'quiet', startK);
      startK += 330 * 2;
    }
    const out = rec.finish();
    expect(out.filter((c) => c.category === 'snore-like')).toHaveLength(2);
    expect(files.size).toBe(out.length);
    expect(files.size).toBeLessThanOrEqual(5);
    expect(rec.stats.tempRemovals).toBeGreaterThan(0);
  });

  it('discard removes every temp file', () => {
    const { files, sink } = makeSink();
    const rec = new ClipRecorder(0, sink);
    feed(rec, 40, (s) => (s >= 10 && s < 18 ? 'snore' : 'quiet'));
    rec.finish();
    expect(files.size).toBe(1);
    rec.discard();
    expect(files.size).toBe(0);
  });

  it('a capture gap keeps the ring on the pipeline timeline', () => {
    const { sink } = makeSink();
    const rec = new ClipRecorder(0, sink);
    feed(rec, 10, () => 'quiet');
    rec.markGap(5);
    feed(rec, 10, () => 'quiet', 30);
    expect(() => rec.finish()).not.toThrow();
  });
});

describe('manifest', () => {
  const clip: ClipMeta = { id: 'c0', file: 'c0.wav', category: 'snore-like', tag: null, startMs: 1, durationSec: 5, peaks: [1, 2], score: 10 };
  it('parses a valid manifest and drops invalid clips', () => {
    const m = parseClipsManifest(JSON.stringify({ v: 1, nightId: 'n', createdAt: 1, clips: [clip, { ...clip, file: '../evil.wav' }, { ...clip, category: 'gasp-like' }] }));
    expect(m!.clips).toHaveLength(1);
  });
  it('returns null for junk', () => {
    expect(parseClipsManifest('nope')).toBeNull();
    expect(parseClipsManifest('{"v":2}')).toBeNull();
  });
  it('distinguishes saving-off, none-picked and has-clips', () => {
    expect(nightClipsState(null)).toBe('saving-off');
    expect(nightClipsState({ v: 1, nightId: 'n', createdAt: 0, clips: [] })).toBe('none-picked');
    expect(nightClipsState({ v: 1, nightId: 'n', createdAt: 0, clips: [clip] })).toBe('has-clips');
  });
  it('sorts sections by score and splits them', () => {
    const s = clipSections([clip, { ...clip, id: 'c1', file: 'c1.wav', score: 30 }, { ...clip, id: 'c2', file: 'c2.wav', category: 'loud-other' }]);
    expect(s.snore.map((c) => c.id)).toEqual(['c1', 'c0']);
    expect(s.other.map((c) => c.id)).toEqual(['c2']);
  });
});

describe('sample clips', () => {
  it('are deterministic, labelled sample, and non-empty', async () => {
    const { sampleClips, synthSampleClip } = await import('./clipSamples');
    const a = sampleClips(0);
    expect(a.every((c) => c.isSample === true)).toBe(true);
    expect(a).toHaveLength(3);
    expect(a[0]!.peaks).toHaveLength(48);
    expect(Array.from(synthSampleClip('hum', 1).subarray(0, 8))).toEqual(Array.from(synthSampleClip('hum', 1).subarray(0, 8)));
    expect(Math.max(...synthSampleClip('thump', 1))).toBeGreaterThan(0.05);
  });
});
