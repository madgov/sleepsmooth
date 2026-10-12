// Typed boundary between the Results/Audio screens and whatever produces nights.
//
// The SAMPLE night comes from the shared overnight core (`buildSampleNightView` in src/night), which is synthetic and
// labelled as such (isSample: true, "Sample" badge, dashed purple border). A sample never feeds the overview headline
// (the overview calls listRealNights() only, and nightRulesInput ignores synthetic nights for the conclusion).
// Real nights come from the on-device night store (manifest + epoch log per night, no audio), summarized by the core's
// summarizeNight. A night left open by a crash is closed with recoverUnfinishedNight when it is first listed.
//
// Conclusions are never computed here or in the UI. Evidence comes from nightRulesInput() via state/evidence.ts.
import { useCallback, useEffect, useState } from 'react';
import { NIGHT_REASON_TOO_SHORT } from '@core/content/claims';
import { buildSampleNightView, type NightView } from '@core/night';
import { viewForStored } from '@core/mobileLogic/nightSession';
import { captureController } from '../capture/controller';
import { getNightStore } from './nightStoreInstance';

export type NightAudioState = 'snore-like-observed' | 'few-observations' | 'not-assessed' | 'model-not-applicable' | 'no-model' | 'not-recorded';
export type EpochState = 'asleep' | 'uncertain' | 'awake';

export interface NightListItem {
  id: string;
  /** ISO date of the night's start. */
  dateISO: string;
  isSample: boolean;
  recordedMinutes: number;
  state: NightAudioState;
  /** Strings from the core (notAssessedReasons). Non-empty only for not-assessed. */
  notAssessedReasons: string[];
  /** Equal-length display bins across the estimated window. Empty when there is no estimate. */
  epochs: EpochState[];
  epochMinutes: number;
  estimatedWindow: { startMin: number; endMin: number } | null;
  signals: { used: string[]; unavailable: string[]; total: number };
  sensitivity: { likelyAsleep: number; includingUncertain: number } | null;
  snoreWindows: { snoreLike: number; assessable: number; tooQuiet: number } | null;
  /** The core's night view. Evidence is derived from it by nightRulesInput(); the UI never interprets it. */
  view: NightView;
}

export type NightStatus = 'loading' | 'ready' | 'error';

export interface NightSource {
  listRealNights(): Promise<NightListItem[]>;
  getSampleNight(variant?: NightAudioState): NightListItem;
  getNight(id: string): Promise<NightListItem | null>;
  deleteNight(id: string): Promise<void>;
}

export const SAMPLE_NIGHT_ID = 'sample';
const BIN_EPOCHS = 30; // 30 s epochs -> 15 minute display bins
const EPOCH_SEC = 30;

function binStates(view: NightView): EpochState[] {
  const w = view.summary.estimatedWindow;
  if (!w) return [];
  const inWin = view.estimates.map((e, i) => ({ e, t: view.epochs[i]?.t ?? 0 })).filter((x) => x.t >= w.start && x.t < w.end);
  const out: EpochState[] = [];
  for (let i = 0; i < inWin.length; i += BIN_EPOCHS) {
    const chunk = inWin.slice(i, i + BIN_EPOCHS);
    const count = (st: string) => chunk.filter((x) => x.e.state === st).length;
    const asleep = count('likely-asleep');
    const awake = count('likely-awake');
    out.push(asleep >= chunk.length * 0.6 ? 'asleep' : awake >= chunk.length * 0.6 ? 'awake' : 'uncertain');
  }
  return out;
}

function minuteOfDay(ms: number, utc: boolean): number {
  const d = new Date(ms);
  return utc ? d.getUTCHours() * 60 + d.getUTCMinutes() : d.getHours() * 60 + d.getMinutes();
}

/** The label date of a night. Real nights use the LOCAL calendar date of the evening they started (before noon counts as the night before). Samples use UTC. */
function nightDateISO(view: NightView): string {
  const start = new Date(view.record.captureStart);
  if (view.summary.isSynthetic) return start.toISOString();
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() - (start.getHours() < 12 ? 1 : 0));
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
}

export function toNightListItem(view: NightView): NightListItem {
  const s = view.summary;
  const utc = s.isSynthetic;
  const assessed = s.nightState !== 'not-assessed' && s.nightState !== 'not-recorded';
  const asleepLine = s.sensitivity.asleepOnly;
  const withUncertain = s.sensitivity.withUncertain;
  return {
    id: s.isSynthetic ? SAMPLE_NIGHT_ID : s.nightId,
    dateISO: nightDateISO(view),
    isSample: s.isSynthetic,
    recordedMinutes: Math.round(s.recordedSec / 60),
    state: s.nightState,
    notAssessedReasons: s.nightState === 'not-assessed' ? s.notAssessedReasons : [],
    epochs: binStates(view),
    epochMinutes: (BIN_EPOCHS * EPOCH_SEC) / 60,
    estimatedWindow: s.estimatedWindow ? { startMin: minuteOfDay(s.estimatedWindow.start, utc), endMin: minuteOfDay(s.estimatedWindow.end, utc) } : null,
    signals: {
      used: s.signalsUsed.filter((x) => x.usable).map((x) => x.name),
      unavailable: s.signalsUsed.filter((x) => !x.usable).map((x) => x.name),
      total: s.signalsUsed.length,
    },
    sensitivity: assessed ? { likelyAsleep: asleepLine.snoreLikeWindows, includingUncertain: withUncertain.snoreLikeWindows } : null,
    snoreWindows:
      assessed && s.nightState !== 'no-model' && s.nightState !== 'model-not-applicable'
        ? { snoreLike: s.snoreLikeWindows, assessable: s.assessableWindows, tooQuiet: s.unscoredWindows.tooQuiet }
        : null,
    view,
  };
}

/**
 * Sample for any display state. The two states the core can build (snore-like-observed, few-observations) use its sample
 * views directly. The remaining states are gallery previews: the same synthetic view with only its state label changed,
 * so every state card can be reviewed. They are always isSample.
 */
function buildSample(variant: NightAudioState): NightListItem {
  const base = buildSampleNightView(variant === 'snore-like-observed' ? 'snore-episodes' : 'quiet');
  if (variant === 'snore-like-observed' || variant === 'few-observations') return toNightListItem(base);
  const view: NightView = {
    ...base,
    summary: {
      ...base.summary,
      nightState: variant,
      notAssessedReasons: variant === 'not-assessed' ? [NIGHT_REASON_TOO_SHORT] : [],
    },
  };
  const item = toNightListItem(view);
  return variant === 'not-assessed' || variant === 'not-recorded' ? { ...item, epochs: [], estimatedWindow: null, sensitivity: null, snoreWindows: null } : item;
}

async function loadStored(): Promise<NightListItem[]> {
  await captureController.finalizePaused();
  const stored = await getNightStore().list(captureController.activeNightId() ? [captureController.activeNightId() as string] : []);
  const items: NightListItem[] = [];
  for (const n of stored) {
    try {
      items.push(toNightListItem(viewForStored(n)));
    } catch {
      // A night that cannot be summarized is left out rather than shown wrong.
    }
  }
  return items;
}

export const nightSource: NightSource = {
  /** Real, on-device nights only. The sample night is never in this list. */
  async listRealNights() {
    return loadStored();
  },
  getSampleNight(variant = 'snore-like-observed') {
    return buildSample(variant);
  },
  async getNight(id) {
    if (id === SAMPLE_NIGHT_ID) return buildSample('snore-like-observed');
    return (await loadStored()).find((n) => n.id === id) ?? null;
  },
  async deleteNight(id) {
    getNightStore().remove(id);
  },
};

export function useRealNights(): { status: NightStatus; nights: NightListItem[]; reload: () => void } {
  const [state, setState] = useState<{ status: NightStatus; nights: NightListItem[] }>({ status: 'loading', nights: [] });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load: show the loading state before awaiting
    setState((s) => ({ ...s, status: 'loading' }));
    nightSource
      .listRealNights()
      .then((nights) => live && setState({ status: 'ready', nights }))
      .catch(() => live && setState({ status: 'error', nights: [] }));
    return () => {
      live = false;
    };
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
