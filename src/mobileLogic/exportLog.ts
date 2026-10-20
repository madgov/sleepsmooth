// "Export test log": one JSON document for the person running a device test. It holds timings, gaps, battery,
// coverage numbers and the user's own clip feedback. It holds NO audio, no waveform peaks and no feature values, and it
// only covers real recorded nights (never the sample night). It is shared only through the iOS share sheet, by the user.
import { TEST_LOG_NOTE } from '../content/claims';
import type { NightView } from '../night/summary';
import { computeCoverage } from './coverage';
import { DEVICE_CRITERIA, diagnosticsNumbers, evaluateCriteria, type NightDiagnostics } from './diagnostics';
import type { FeedbackFile } from './clipFeedback';
import type { ClipMeta } from './clips';
import { WEARABLE_SOURCE_LABEL } from '../content/wearable';
import type { WearableObservation } from '../types/wearable';

export const TEST_LOG_VERSION = 1;

export interface TestLogInput {
  exportedAtMs: number;
  app: { version: string; deviceModel: string; os: string };
  /** User-entered wearable readings, included as typed. Omitted from the log when empty. */
  wearable?: readonly WearableObservation[];
  nights: { view: NightView; diagnostics: NightDiagnostics | null; feedback: FeedbackFile | null; clips: readonly ClipMeta[] }[];
}

export function buildTestLog(input: TestLogInput): Record<string, unknown> {
  const real = input.nights.filter((n) => !n.view.record.isSynthetic);
  return {
    kind: 'sleepsmooth-test-log',
    v: TEST_LOG_VERSION,
    note: TEST_LOG_NOTE,
    exportedAt: new Date(input.exportedAtMs).toISOString(),
    app: input.app,
    criteria: DEVICE_CRITERIA,
    ...(input.wearable && input.wearable.length > 0 ? { wearableReadings: { note: WEARABLE_SOURCE_LABEL, entries: input.wearable } } : {}),
    nights: real.map((n) => {
      const r = n.view.record;
      const s = n.view.summary;
      const cov = computeCoverage(n.view.epochs, n.view.schedule);
      const capturedSec = n.view.epochs.reduce((a, e) => a + e.cap, 0);
      const nums = n.diagnostics ? diagnosticsNumbers(n.diagnostics, capturedSec) : null;
      return {
        id: r.id,
        captureStart: new Date(r.captureStart).toISOString(),
        captureEnd: r.captureEnd === null ? null : new Date(r.captureEnd).toISOString(),
        endReason: r.endReason,
        modelVersion: r.modelVersion,
        device: { model: r.deviceModel, os: r.osVersion, app: r.appVersion },
        coverageSec: cov.seconds,
        windows: { scored: cov.scoredWindows, snoreLike: cov.snoreLikeWindows, snoreLikeInAwakeGuess: s.sensitivity.inLikelyAwake.snoreLikeWindows },
        nightState: s.nightState,
        diagnostics: n.diagnostics,
        diagnosticsNumbers: nums,
        criteriaResult: nums ? evaluateCriteria(nums) : null,
        clipFeedback: (n.feedback?.entries ?? []).map((e) => {
          const c = n.clips.find((x) => x.id === e.clipId);
          return { clipId: e.clipId, verdict: e.verdict, kind: e.kind, at: new Date(e.atMs).toISOString(), category: c?.category ?? null, clipStart: c ? new Date(c.startMs).toISOString() : null, durationSec: c?.durationSec ?? null };
        }),
      };
    }),
  };
}

export const serializeTestLog = (input: TestLogInput): string => JSON.stringify(buildTestLog(input), null, 2);
