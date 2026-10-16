// The clip-picking adaptation learned from this phone's stored feedback, plus Reset. Display and clip choice only.
import { useCallback, useEffect, useState } from 'react';
import { NO_ADAPTATION, type ClipAdaptation } from '@core/mobileLogic/clipAdaptation';
import { updateSettings, useSettings } from '../state/settings';
import { loadClipAdaptation } from './clipAdaptationStore';

export function useClipAdaptation(refreshKey: number | string = 0): { adaptation: ClipAdaptation; reset: () => void } {
  const resetAt = useSettings().clips.adaptResetAtMs;
  const [adaptation, setAdaptation] = useState<ClipAdaptation>(NO_ADAPTATION);
  useEffect(() => {
    let live = true;
    void loadClipAdaptation(resetAt).then((a) => live && setAdaptation(a));
    return () => {
      live = false;
    };
  }, [resetAt, refreshKey]);
  const reset = useCallback(() => updateSettings((p) => ({ ...p, clips: { ...p.clips, adaptResetAtMs: Date.now() } })), []);
  return { adaptation, reset };
}
