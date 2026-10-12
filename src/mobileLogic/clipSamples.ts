// SAMPLE clips for the sample night (web preview and Expo Go). They are SYNTHETIC tones generated here, not recordings
// of anyone, and every place that shows them carries the "Sample data" badge. They exist so the player UI can be
// reviewed without a real night. Deterministic: the same call always returns the same samples.
import { CLIP_SAMPLE_RATE, computePeaks, type ClipMeta } from './clips';

function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A low hum with a slow breath-like swell (snore-like), or a short broadband thump (loud sound). Amplitude is modest. */
export function synthSampleClip(kind: 'hum' | 'thump', seconds: number): Float32Array {
  const n = Math.round(seconds * CLIP_SAMPLE_RATE);
  const out = new Float32Array(n);
  const rnd = prng(kind === 'hum' ? 7 : 11);
  for (let i = 0; i < n; i++) {
    const t = i / CLIP_SAMPLE_RATE;
    if (kind === 'hum') {
      const swell = Math.max(0, Math.sin((2 * Math.PI * t) / 3.2)) ** 2;
      const tone = Math.sin(2 * Math.PI * 92 * t) + 0.5 * Math.sin(2 * Math.PI * 184 * t) + 0.25 * Math.sin(2 * Math.PI * 276 * t);
      out[i] = 0.12 * swell * tone * (0.8 + 0.2 * rnd());
    } else {
      const center = seconds * 0.5;
      const env = Math.exp(-Math.abs(t - center) * 6);
      out[i] = 0.3 * env * (rnd() * 2 - 1);
    }
  }
  return out;
}

export interface SampleClip extends ClipMeta {
  isSample: true;
  kind: 'hum' | 'thump';
}

/** Three labelled sample clips, positioned inside a sample night that starts at `nightStartMs`. */
export function sampleClips(nightStartMs: number): SampleClip[] {
  const mk = (id: string, kind: 'hum' | 'thump', category: ClipMeta['category'], tag: ClipMeta['tag'], offsetMin: number, durationSec: number, score: number): SampleClip => ({
    id,
    file: `${id}.wav`,
    category,
    tag,
    startMs: nightStartMs + offsetMin * 60_000,
    durationSec,
    peaks: computePeaks(synthSampleClip(kind, durationSec)),
    score,
    isSample: true,
    kind,
  });
  return [
    mk('sample-a', 'hum', 'snore-like', 'snoring-stopped-restarted', 176, 11, 230),
    mk('sample-b', 'hum', 'snore-like', null, 291, 8, 120),
    mk('sample-c', 'thump', 'loud-other', 'brief-loud-sound', 233, 5, 40),
  ];
}
