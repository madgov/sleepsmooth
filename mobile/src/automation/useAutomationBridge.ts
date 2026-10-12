// Receives "start" and "stop" commands from the App Intents (plugins/withAppIntents) and acts on them.
//
// Two paths, both needed because iOS may or may not have the JS runtime alive when an intent runs:
//   1. live event: the native module forwards the intent's notification while JS is listening.
//   2. pending flag: the intent also stored the command in UserDefaults; we read it when the app (re)launches or returns
//      to the foreground. A command older than 10 minutes is dropped.
// NOT VERIFIED on a device: whether an intent running while the app is suspended wakes JS, and whether iOS allows the
// microphone to start from the background. Nothing is marked "running" unless recording actually began.
import { useEffect } from 'react';
import { router } from 'expo-router';
import { AppState } from 'react-native';
import { handleAutomationCommand, type AutoRunDeps } from '@core/mobileLogic/autoRecordRun';
import { nativeAutomation } from '../../modules/sleepsmooth-live-activity';
import { captureController } from '../capture/controller';
import { IS_EXPO_GO } from '../native/runtime';
import { checkMic } from '../platform/permissions';
import { getSettings, updateSettings, useSettingsSnapshot } from '../state/settings';

const deps: AutoRunDeps = {
  nowMs: () => Date.now(),
  consentGranted: () => getSettings().consent.granted,
  micGranted: async () => (await checkMic()) === 'granted',
  standingAckAt: () => getSettings().autoRecord.standingAckAt,
  recordingActive: () => {
    const st = captureController.getSnapshot().status;
    return st === 'recording' || st === 'starting' || st === 'stopping';
  },
  startRecording: async () => {
    await captureController.start(getSettings().sleep.wakeMin);
    return captureController.getSnapshot().status === 'recording';
  },
  stopRecording: () => captureController.stop('user-stop'),
  // Live Activity "Stop": the same as the user's own stop. While the morning prompt is showing, the controller counts it as the
  // confirmation for morning learning.
  morningStop: () => captureController.stop('user-stop'),
  // Live Activity "Open": the recording screen while a night is still being recorded, otherwise last night's summary.
  morningOpen: () => {
    const st = captureController.getSnapshot();
    const active = st.status === 'recording' || st.status === 'starting' || st.status === 'stopping';
    router.push(active ? '/recording' : st.nightId ? `/night/${st.nightId}` : '/night/latest');
  },
  report: (outcome, atMs, startedAtMs) =>
    updateSettings((s) => ({
      ...s,
      autoRecord: {
        ...s.autoRecord,
        lastOutcome: outcome,
        lastOutcomeAt: new Date(atMs).toISOString(),
        // The only evidence that automation works: recording really began after an intent start.
        lastAutoStartAt: startedAtMs !== null ? new Date(startedAtMs).toISOString() : s.autoRecord.lastAutoStartAt,
      },
    })),
};

let busy = false;
async function run(raw: unknown) {
  if (busy) return;
  busy = true;
  try {
    await handleAutomationCommand(raw, deps);
  } finally {
    busy = false;
  }
}

export function useAutomationBridge(): void {
  const { status } = useSettingsSnapshot();
  useEffect(() => {
    if (status !== 'ready' || IS_EXPO_GO || !nativeAutomation) return;
    const drain = () => {
      try {
        const raw = nativeAutomation?.consumePendingCommand();
        if (raw) void run(raw);
      } catch {
        /* native module unavailable */
      }
    };
    drain();
    const sub = nativeAutomation.addListener('onCommand', (e) => void run(e.payload));
    const app = AppState.addEventListener('change', (s) => s === 'active' && drain());
    return () => {
      sub.remove();
      app.remove();
    };
  }, [status]);
}
