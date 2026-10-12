// "Quiet periods": stretches where the per-second loudness drops well below the recording's
// typical level. NON-ML, energy-threshold only. A quiet period is NOT a breathing measurement
// and says nothing about airflow. UI copy must call these "quiet periods".
import type { QuietGap } from '../types/audio';
import { SILENCE_FLOOR_DBFS } from './constants';

export const QUIET_DROP_DB = 15;
export const MIN_QUIET_PERIOD_SEC = 10;
const MIN_BASELINE_SECONDS = 5;

/**
 * @param loudnessDb RMS dBFS per second.
 * The baseline is the median of seconds above the silence floor; a second is "quiet" when it is
 * more than QUIET_DROP_DB below that baseline. Runs of at least MIN_QUIET_PERIOD_SEC are returned.
 * A recording with no loud-enough baseline yields none (it is "too quiet to assess" instead).
 */
export function findQuietGaps(loudnessDb: readonly number[]): QuietGap[] {
  const loud = loudnessDb.filter((d) => d >= SILENCE_FLOOR_DBFS).sort((a, b) => a - b);
  if (loud.length < MIN_BASELINE_SECONDS) return [];
  const baseline = loud[Math.floor(loud.length / 2)] as number;
  const threshold = baseline - QUIET_DROP_DB;
  const gaps: QuietGap[] = [];
  let start = -1;
  const flush = (end: number) => {
    if (start >= 0 && end - start >= MIN_QUIET_PERIOD_SEC) gaps.push({ t0: start, t1: end, durSec: end - start });
    start = -1;
  };
  for (let i = 0; i < loudnessDb.length; i++) {
    if ((loudnessDb[i] as number) < threshold) {
      if (start < 0) start = i;
    } else flush(i);
  }
  flush(loudnessDb.length);
  return gaps;
}
