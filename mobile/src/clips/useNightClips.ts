// Loads the clips of one night for display. Real nights read nights/<id>/clips/clips.json; the sample night gets
// synthetic, labelled sample clips. Playback samples are decoded on demand.
import { useEffect, useState } from 'react';
import { decodeWav16, nightClipsState, type ClipMeta, type NightClipsState } from '@core/mobileLogic/clips';
import { sampleClips, synthSampleClip } from '@core/mobileLogic/clipSamples';
import { readClipBytes, readClipsManifest } from './clipFiles';
import type { ClipSamples } from './playerStore';

export type NightClipsLoad = { status: 'loading' } | { status: 'ready'; state: NightClipsState; clips: ClipMeta[]; sample: boolean };

export function useNightClips(nightId: string, isSample: boolean, nightStartMs: number): NightClipsLoad {
  const [load, setLoad] = useState<NightClipsLoad>(
    isSample ? { status: 'ready', state: 'has-clips', clips: sampleClips(nightStartMs), sample: true } : { status: 'loading' },
  );
  useEffect(() => {
    if (isSample) return;
    let live = true;
    readClipsManifest(nightId)
      .then((m) => live && setLoad({ status: 'ready', state: nightClipsState(m), clips: m?.clips ?? [], sample: false }))
      .catch(() => live && setLoad({ status: 'ready', state: 'saving-off', clips: [], sample: false }));
    return () => {
      live = false;
    };
  }, [nightId, isSample]);
  return load;
}

/** Decode one clip for the player. Sample clips are synthesized, real clips are read from the night's clips folder. */
export async function loadClipSamples(nightId: string, clip: ClipMeta, sample: boolean): Promise<ClipSamples | null> {
  if (sample) {
    const s = sampleClips(0).find((c) => c.id === clip.id);
    return s ? { samples: synthSampleClip(s.kind, s.durationSec), rate: 16000 } : null;
  }
  const bytes = await readClipBytes(nightId, clip.file);
  const d = bytes ? decodeWav16(bytes) : null;
  return d ? { samples: d.samples, rate: d.rate } : null;
}
