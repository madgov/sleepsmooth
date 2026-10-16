// The user's own feedback on saved clips. Real nights keep it in nights/<id>/clips/feedback.json (on this phone only,
// removed with the clips or the night). The sample night keeps it in memory only and it is never exported.
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyFeedback, setKind, toggleVerdict, type FeedbackFile, type FeedbackKind, type FeedbackVerdict } from '@core/mobileLogic/clipFeedback';
import { getNightStore } from '../data/nightStoreInstance';

export interface ClipFeedbackApi {
  file: FeedbackFile;
  /** False when the last save did not work. The choice is still shown for this visit. */
  saved: boolean;
  verdict: (clipId: string, v: FeedbackVerdict) => void;
  kind: (clipId: string, k: FeedbackKind) => void;
}

export function useClipFeedback(nightId: string, isSample: boolean): ClipFeedbackApi {
  const [file, setFile] = useState<FeedbackFile>(emptyFeedback(nightId));
  const [saved, setSaved] = useState(true);
  const latest = useRef(file);
  useEffect(() => {
    latest.current = file;
  }, [file]);

  useEffect(() => {
    if (isSample) return;
    let live = true;
    getNightStore()
      .readFeedback(nightId)
      .then((f) => live && setFile(f))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [nightId, isSample]);

  const commit = useCallback(
    (next: FeedbackFile) => {
      latest.current = next;
      setFile(next);
      if (isSample) return;
      try {
        getNightStore().writeFeedback(nightId, next);
        setSaved(true);
      } catch {
        setSaved(false);
      }
    },
    [nightId, isSample],
  );

  return {
    file,
    saved,
    verdict: (clipId, v) => commit(toggleVerdict(latest.current, clipId, v, Date.now())),
    kind: (clipId, k) => commit(setKind(latest.current, clipId, k, Date.now())),
  };
}
