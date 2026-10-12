import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { meterBand, pushLevel, type MeterBand } from '@core/mobileLogic/index';
import { captureController, type CaptureSnapshot } from '../capture/controller';

const BARS = 24;
const ZEROS = Array.from({ length: BARS }, () => 0);

export interface UseCapture extends CaptureSnapshot {
  /** 24 values in 0..1 drawn by the meter. Updated without React state. */
  levels: SharedValue<number[]>;
  /** Coarse spoken band; changes only when the category changes. */
  band: MeterBand;
  /** Seconds since start, ticking once per second (the only per-second React state on the Audio screen). */
  elapsedSec: number;
  start: (wakeMin: number) => Promise<void>;
  stop: () => Promise<void>;
}

export function useCapture(): UseCapture {
  const snap = useSyncExternalStore(captureController.subscribe, captureController.getSnapshot, captureController.getSnapshot);
  const levels = useSharedValue<number[]>(ZEROS);
  const [band, setBand] = useState<MeterBand>('low');
  const [elapsedSec, setElapsed] = useState(0);

  useEffect(() => {
    let lastBand: MeterBand = 'low';
    return captureController.subscribeLevel((lvl) => {
      levels.set(pushLevel(levels.get(), lvl, BARS));
      const b = meterBand(lvl);
      if (b !== lastBand) {
        lastBand = b;
        setBand(b);
      }
    });
  }, [levels]);

  // Quiet the meter when nothing is arriving: bars return to baseline, never a hole.
  useEffect(() => {
    if (snap.status !== 'recording' || snap.liveness !== 'receiving') levels.set(ZEROS);
  }, [snap.status, snap.liveness, levels]);

  useEffect(() => {
    if (snap.status !== 'recording' || snap.startedAtMs === null) {
      return;
    }
    const startedAt = snap.startedAtMs;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [snap.status, snap.startedAtMs]);

  return { ...snap, levels, band, elapsedSec, start: (w) => captureController.start(w), stop: () => captureController.stop('user-stop') };
}
