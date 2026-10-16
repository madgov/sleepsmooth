// Reads the stored clip feedback of the real nights on this phone and turns it into the clip-picking adaptation.
// The sample night's feedback lives in memory only and never reaches this file. Nothing here is uploaded or exported.
import { deriveAdaptation, NO_ADAPTATION, type ClipAdaptation, type ReviewedClip } from '@core/mobileLogic/clipAdaptation';
import { getNightStore } from '../data/nightStoreInstance';
import { nightIds, readClipsManifest } from './clipFiles';

const LOAD_TIMEOUT_MS = 1500;

/** Never throws and never delays a recording start by more than LOAD_TIMEOUT_MS. A night that cannot be read is skipped. */
export function loadClipAdaptation(resetAtMs: number | null): Promise<ClipAdaptation> {
  return Promise.race([read(resetAtMs), new Promise<ClipAdaptation>((resolve) => setTimeout(() => resolve(NO_ADAPTATION), LOAD_TIMEOUT_MS))]);
}

async function read(resetAtMs: number | null): Promise<ClipAdaptation> {
  try {
    const store = getNightStore();
    const reviews: ReviewedClip[] = [];
    for (const id of nightIds()) {
      try {
        const [manifest, fb] = await Promise.all([readClipsManifest(id), store.readFeedback(id)]);
        if (!manifest || fb.entries.length === 0) continue;
        const byId = new Map(manifest.clips.map((c) => [c.id, c]));
        for (const entry of fb.entries) {
          const clip = byId.get(entry.clipId);
          if (clip) reviews.push({ nightIsSample: false, clip, entry });
        }
      } catch {
        /* skip this night */
      }
    }
    return deriveAdaptation(reviews, resetAtMs);
  } catch {
    return NO_ADAPTATION;
  }
}
