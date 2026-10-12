import { useEffect, useRef, useSyncExternalStore } from 'react';
import { captureController } from '../capture/controller';
import { endListeningActivity, endWithAutoStopped, showListeningActivity, showMorningActivity, startListeningActivity } from '../liveActivity';

/**
 * Mirrors the capture controller into the Live Activity. Start when recording begins (the app is in the foreground then),
 * end when it stops. It never restarts an activity the system ended (8 hour limit) or the user dismissed.
 *
 * Morning: when the controller reports the morning prompt, the activity switches to "Good morning. Stop recording?" with an
 * alert configuration (iOS expands the island briefly, once). Keep recording returns it to "Listening tonight". An automatic
 * stop ends it with the "Auto-stopped at 7:12 am" state, which stays for a few minutes.
 */
export function useLiveActivitySync() {
  const snap = useSyncExternalStore(captureController.subscribe, captureController.getSnapshot, captureController.getSnapshot);
  const live = useRef(false);
  const shown = useRef<'listening' | 'morning'>('listening');
  const recording = snap.status === 'recording' && snap.startedAtMs !== null;
  const startedAtMs = snap.startedAtMs;
  const endAtMs = snap.endAtMs;
  const morning = snap.morning;
  const autoStoppedAtMs = snap.autoStoppedAtMs;

  useEffect(() => {
    if (recording && startedAtMs !== null && !live.current) {
      live.current = true;
      shown.current = 'listening';
      void startListeningActivity(startedAtMs, endAtMs);
    } else if (!recording && live.current) {
      live.current = false;
      if (morning === 'auto-stopped' && autoStoppedAtMs !== null) void endWithAutoStopped(autoStoppedAtMs);
      else void endListeningActivity();
    }
  }, [recording, startedAtMs, endAtMs, morning, autoStoppedAtMs]);

  useEffect(() => {
    if (!recording || !live.current) return;
    if (morning === 'prompt' && shown.current !== 'morning') {
      shown.current = 'morning';
      void showMorningActivity(Date.now(), true); // the alert is attached once, when the prompt first appears
    } else if (morning === 'kept' && shown.current === 'morning') {
      shown.current = 'listening';
      void showListeningActivity();
    }
  }, [recording, morning]);
}
