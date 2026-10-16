// Web preview: clips and feedback are not stored, so there is nothing to adapt to. A dev-only URL switch (?adapt=4) fakes
// "4 clips reviewed" so the note and Reset can be seen. Never active in a release build or on a device.
import { NO_ADAPTATION, type ClipAdaptation } from '@core/mobileLogic/clipAdaptation';
import { devAdaptReviewed } from '../dev/devParams';

export async function loadClipAdaptation(resetAtMs: number | null): Promise<ClipAdaptation> {
  const n = devAdaptReviewed();
  if (n === null || resetAtMs !== null) return NO_ADAPTATION;
  return { reviewed: n, loud: n >= 3 ? { eventSec: 3, aboveFloorDb: 20 } : null, snoreMinMeanScore: null };
}
