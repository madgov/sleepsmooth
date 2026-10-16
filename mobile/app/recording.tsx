
import { useEffect, useRef } from 'react';
import { useSafeRouter } from '../src/nav/useSafeRouter';
import { captureController } from '../src/capture/controller';
import { useCapture } from '../src/hooks/useCapture';
import { useRecordAction } from '../src/hooks/useRecordAction';
import { RecordingView } from '../src/ui/RecordingView';

/** Full-screen recording state. Dismisses itself once capture is no longer active. */
export default function Recording() {
  const router = useSafeRouter();
  const capture = useCapture();
  const { active, confirmStop } = useRecordAction();
  const seen = useRef(false);
  useEffect(() => {
    if (active) seen.current = true;
    else if (seen.current || capture.status === 'idle') router.back();
  }, [active, capture.status, router]);
  const state = capture.status === 'starting' ? 'starting' : capture.status === 'stopping' ? 'stopping' : 'recording';
  return (
    <RecordingView
      state={state}
      elapsedSec={capture.elapsedSec}
      endAtMs={capture.endAtMs}
      levels={capture.levels}
      band={capture.band}
      stale={capture.liveness !== 'receiving'}
      onStop={confirmStop}
      onHide={() => router.back()}
      {...(capture.morning === 'prompt' ? { morning: { onStop: () => void capture.stop(), onKeep: () => captureController.keepRecording() } } : {})}
    />
  );
}
