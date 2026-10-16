# SleepSmooth Overnight Mode: Implementation Plan

Status: PLAN ONLY (no app code written). Date: 2026-10-11. Author: planning subagent. Binding companions: `CLAUDE.md`, `docs/PRD.md`, `docs/PLAN.md`, `docs/SOURCES.md`, `model/MODEL_CARD.md`.

Hard rules inherited from CLAUDE.md (all absolute here): never diagnose; never give false reassurance; no apnea probability; label sample data; raw audio is sensitive and not stored by default; audio never downgrades a conclusion; no green "all clear"; do not claim an integration or model works unless it was exercised.

The existing Vite web app (`src/`, `dist/`, `public/`) is the fallback demo. This plan never edits its behavior. Where the plan needs a tiny change to a shared file, it is listed in section 5.4 as an explicit, approval-gated exception with a regression check.

---

## 1. Summary and verdicts

**What we build.** A native Expo / React Native dev-build app in `mobile/` that (1) lets the user set sleep hours once, (2) fires a local bedtime notification, (3) on one tap starts a microphone foreground capture that survives screen lock and backgrounding, (4) processes audio on-device in a streaming way into per-30-second epoch records (loudness, snore-like window flags, handling/speech-like flags, activity, estimated-sleep state), discarding audio within seconds, (5) in the morning shows an "estimated sleep window" and a night summary, and (6) feeds the existing evidence engine, report generator and next-steps content, with no new conclusions.

**Verdicts (details and sources in sections 2 and 3).**

| Question | Verdict |
|---|---|
| Can recording that starts in the foreground continue with the screen locked on iOS? | Yes, with `UIBackgroundModes: audio` and an active record-capable session (Apple docs). Apple DTS: activate the session only in the foreground. |
| Can iOS start the mic from the background or at a scheduled time? | No supported path. Zero-tap on iOS is not possible. |
| Can an Android exact alarm start a mic foreground service with no tap? | No. Android 14+ docs say a `microphone` FGS cannot be created from the background even when a background-start exemption (exact alarm) applies. |
| Is zero-tap on Android possible at all? | Only through a non-documented-for-this-purpose route (alarm-style full-screen-intent activity that makes the app visible). Unverified, sideload-only, high risk. Treat as a stretch goal and cut first. |
| Recommended library | `react-native-audio-api` (Software Mansion) `AudioRecorder` at 16 kHz, with `expo-audio` `useAudioStream` as the first alternative. Final pick is gated by the M1 locked-screen spike on a real phone. |
| Can the existing TS DSP + MLP run on Hermes? | Probably yes at a low duty cycle with two exact optimizations (frame reuse across the 50 percent window overlap, sparse mel) and a loudness gate. The numbers in section 10 are estimates until M0/M2 measure them. |
| Native screens or WebView? | Native screens that reuse the shared pure-TS core (not the React DOM components). A WebView would force changes to the web app, which must stay untouched. |

---

## 2. Verified platform constraints (with sources)

"Verified" means read on the cited page during this research. "Community/unconfirmed" means a forum or third-party claim. "Device test required" means no doc settles it and M1/M2 must test on hardware.

### 2.1 iOS

| # | Constraint | Status | Source |
|---|---|---|---|
| I1 | To keep recording when the app goes to background (for example, screen lock), add `audio` to `UIBackgroundModes`. The `record` category silences other output; Apple recommends `playAndRecord` unless you must prevent unexpected sounds. Phone calls, alarms and other nonmixable sessions can still interrupt. Microphone permission is required. | Verified (Apple docs, copyright 2026) | https://developer.apple.com/tutorials/data/documentation/avfaudio/avaudiosession/category-swift.struct/record.md |
| I2 | Apple DTS (May 2026): requirements are (1) the `audio` background category and (2) "ONLY activate your audio session in the foreground." With an active session the app may stay active indefinitely. CallKit is for VoIP apps only. Higher-level APIs that auto-activate or deactivate sessions must be avoided. | Verified (Apple DTS reply on the forum) | https://developer.apple.com/forums/thread/826462 |
| I3 | A recording started in the foreground continues in the background. Starting a recorder from the background fails (BLE-button case). | Community (older, 2022 to 2024 posts, no Apple answer) | https://developer.apple.com/forums/thread/698253 |
| I4 | `AudioRecordingIntent` (iOS 18+) lets an intent start/stop recording, shows the recording indicator, and requires a Live Activity for the whole recording or the recording stops. A February 2026 forum report of starting it from Shortcuts/Action Button got "Target is not foreground"; the one reply (community, not Apple) says the first start must be in-app. | Docs verified; background-start behavior unconfirmed | https://developer.apple.com/tutorials/data/documentation/appintents/audiorecordingintent.md and https://developer.apple.com/forums/thread/815725 |
| I5 | Interruptions (call, alarm, Siri) interrupt the active session. iOS 26 and earlier: `AVAudioSession.interruptionNotification` (`began`/`ended`, `shouldResume`). iOS 27+: new lifecycle notifications (`didBecomeInactive`, `resumptionRecommendation`) replace it. | Verified | https://developer.apple.com/tutorials/data/documentation/avfaudio/handling-audio-interruptions.md |
| I6 | After a phone call interrupts a background recorder, `.ended` fires but `setActive(true)` fails until the app is opened again (January 2026 report, no replies). Plan for "interrupted, not resumed" as a normal outcome. | Community/unconfirmed; device test required | https://developer.apple.com/forums/thread/813278 |
| I7 | A report of a SIGKILL after about 50 s of background recording on iOS 26.5 was attributed by Apple DTS to something other than the audio system (cause not established; suspected session deactivation by a high-level API). Our soak test must catch this class of failure. | Verified as a report; cause unresolved | https://developer.apple.com/forums/thread/826462 |
| I8 | Orange mic indicator and the audio recording indicator are system-controlled. We cannot and must not hide them. | Docs (I4) plus platform behavior | I4 |
| I9 | Shortcuts personal automation (time of day, Sleep Focus turns on) with "Open App": whether an app can be brought to the foreground while the phone is locked is NOT confirmed. Community reports show time-triggered automations on a locked phone are inconsistent. Even if the app opened, recording must begin while foregrounded, and an unlock is normally needed. | Unconfirmed; do not depend on it | https://talk.automators.fm/t/why-do-some-time-triggered-shortcuts-run-on-a-locked-iphone-and-others-fail/18608 |
| I10 | App Review 2.5.4: multitasking apps may use background services only for their intended purposes (VoIP, audio playback, location, task completion, local notifications, etc.). Overnight microphone capture is a gray area for review. Also 2.5.14 (explicit consent and clear indication when recording), 5.1.1 (consent, data minimization, privacy policy), 1.4.1 (medical accuracy claims get scrutiny; remind users to consult a doctor), 5.1.3 (health data not used for ads/data mining). | Verified text | https://developer.apple.com/app-store/review/guidelines/ |
| I11 | SnoreLab's own docs describe starting a session before bed (optional sleep delay, auto stop alarm). No official statement was found on lock-screen/charging behavior; user reviews report recordings stopping after 1.5 to 3 hours on some devices (anecdotal). Treat "an overnight recorder is accepted by App Review" as unproven for us; the hackathon does not submit to the store. | Partially verified; anecdotes labeled | https://www.snorelab.com/how-snorelab-works |

### 2.2 Android (14, 15, 16)

| # | Constraint | Status | Source |
|---|---|---|---|
| A1 | `microphone` FGS type needs manifest `foregroundServiceType="microphone"`, permissions `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, and runtime `RECORD_AUDIO` granted before start. `RECORD_AUDIO` is subject to while-in-use restrictions: a microphone FGS cannot be started from the background. Cannot be launched from a `BOOT_COMPLETED` receiver except in listed cases. No Android 15/16 changes specific to the microphone type are listed on that page (page updated 2026). | Verified | https://developer.android.com/develop/background-work/services/fgs/service-types |
| A2 | Rule (Android 14+, apps targeting 14+): if an FGS needs a while-in-use permission (microphone, camera, location, body sensors), `startForegroundService()` or `bindService()` must be called while the app has a visible activity, "even when the app qualifies for a background-start exemption." Creating it from the background throws `SecurityException`. Exemptions that can start it from the background: system component; app widget interaction; **interaction with a notification**; PendingIntent sent from a different visible app; device-owner DPC; VoiceInteractionService app; `START_ACTIVITIES_FROM_BACKGROUND`. Exact alarm is NOT in this list. Page last updated 2026-10-01. | Verified | https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start |
| A3 | Generic background-FGS-start exemptions (Android 12+) include "exact alarm to complete an action the user requested" and "user interacts with a notification", but these generic exemptions do not lift the while-in-use rule in A2. | Verified (A2 page) | https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start |
| A4 | `SCHEDULE_EXACT_ALARM` is denied by default for apps targeting 13+, user must grant in "Alarms & reminders". `USE_EXACT_ALARM` is granted at install but Google Play allows it only for calendar/alarm-clock apps. Alarms set with `setAlarmClock()` keep firing in Doze. Without the permission, `setExact`, `setExactAndAllowWhileIdle`, `setAlarmClock` throw `SecurityException`. | Verified | https://developer.android.com/about/versions/14/changes/schedule-exact-alarms and https://developer.android.com/training/monitoring-device-state/doze-standby |
| A5 | Background activity starts: allowed when the app has a visible window, when started from a system-sent PendingIntent such as a notification tap, with `SYSTEM_ALERT_WINDOW`, etc. Android 14 added sender opt-in and Android 15 creator opt-in for PendingIntent BAL privileges. The page does not address alarms or full-screen intents. | Verified for the listed rules; alarm/FSI behavior unconfirmed | https://developer.android.com/guide/components/activities/background-starts |
| A6 | `USE_FULL_SCREEN_INTENT` for apps targeting Android 14+ is limited to apps providing calling and alarms; Play revokes it otherwise; users can toggle it; `NotificationManager.canUseFullScreenIntent()` and `ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT` exist. | Verified | https://developer.android.com/about/versions/14/behavior-changes-14 |
| A7 | Only `dataSync` and `mediaProcessing` FGS types have the 6 h per 24 h timeout (Android 15+). `microphone` is not subject to it. | Verified | https://developer.android.com/develop/background-work/services/fgs/timeout |
| A8 | Doze defers standard alarms, ignores wake locks, suspends network and blocks JobScheduler/WorkManager. App Standby treats an app with a running foreground service as active. The Doze page does not state whether a microphone FGS keeps the CPU running with the screen off; this is a device test (use `adb shell dumpsys deviceidle force-idle`). | Partly verified; device test required | https://developer.android.com/training/monitoring-device-state/doze-standby |
| A9 | Sensors: on Android 9+, background apps get no accelerometer/gyroscope events; the docs recommend detecting sensor events in the foreground or as part of a foreground service. Android 12+ rate limit 200 Hz. | Verified | https://developer.android.com/develop/sensors-and-location/sensors/sensors_overview |
| A10 | OEM killers: dontkillmyapp.com ranks Huawei, Xiaomi, OnePlus, Samsung worst (score 5 of 5) and Pixel/AOSP, Nokia, HTC best. Expect to need user-side "don't optimize/never sleep" settings on non-Pixel devices. | Third-party, labeled | https://dontkillmyapp.com/ |
| A11 | Play Console requires a foreground-service type declaration (and, per a third-party vendor, a demo video for the microphone permission). Not needed for a sideloaded hackathon build; relevant only if ever published. | Partly verified | https://support.google.com/googleplay/android-developer/answer/13392821 |

### 2.3 Expo / React Native modules (checked via npm and Expo docs on 2026-10-11)

| Module | Version / status | Notes | Source |
|---|---|---|---|
| Expo SDK | `expo` 57.0.27 (npm latest); SDK 58 packages exist. Plan pins SDK 57. | Dev build required (not Expo Go) for background modes and custom plugins. | npm registry |
| `expo-audio` | 57.0.5, modified 2026-10-09 | Background recording via `enableBackgroundRecording` config plugin (Android FGS "Recording audio" with stop button; iOS `audio` mode) and `setAudioModeAsync({allowsBackgroundRecording:true})`; added in 55.0.0 (2026-01-21). `useAudioStream` (PCM float32/int16, `onBuffer`) added in 56.0.0 (2026-05-05). Stream `sampleRate` defaults to 48000 and "may differ if hardware cannot deliver it". **The docs document background only for file recording, not for streams.** Android stream fix in 58.0.2. | https://docs.expo.dev/versions/latest/sdk/audio.md and https://raw.githubusercontent.com/expo/expo/main/packages/expo-audio/CHANGELOG.md |
| `react-native-audio-api` | 0.13.6, modified 2026-10-11, 848 stars, 22 open issues (pre-1.0, expect API churn) | `AudioRecorder.onAudioReady` gives Float32 PCM buffers; `sampleRate` (requested) and `bufferLength` options (example uses 16000); documented background requirements (iOS audio mode; Android foreground service `microphone`, `androidFSStopWithTask`); Expo config plugin options `iosBackgroundMode`, `androidForegroundService`, `androidFSTypes`; `AudioManager.setAudioSessionOptions({iosCategory, iosMode, ...})` (lets us pick `measurement` mode; must be verified); `isRecordingOngoing()`; says starting a recording from the background is not possible. | https://docs.swmansion.com/react-native-audio-api/docs/inputs/audio-recorder |
| `@siteed/audio-studio` (formerly expo-audio-stream / expo-audio-studio) | 3.2.1 (2026-08-23), `@siteed/expo-audio-studio` 3.2.2 (2026-06-20), 345 stars, 1 open issue, Expo >= 52 | Float32 streaming, listed interruption auto pause/resume, 16 kHz examples; README did not document the background config or plugin options. Single-maintainer risk. | https://github.com/deeeed/audiolab |
| `react-native-live-audio-stream` | 1.1.1, last release 2022-05-14 | Stale; reject. | npm registry |
| `react-native-background-actions` | 4.1.0 (2026-04-07) | Generic Android FGS/iOS background task helper, not microphone-typed; only a last-resort wrapper. | npm registry |
| `expo-notifications` | 57.0.22 | Daily trigger (iOS and Android); categories with action buttons incl. `opensAppToForeground`; Android exact times need `SCHEDULE_EXACT_ALARM`; iOS interruption levels incl. `timeSensitive`; on Android only, a registered background task runs on action tap while backgrounded/terminated. | https://docs.expo.dev/versions/latest/sdk/notifications.md |
| `expo-sensors` | 57.0.3 | Accelerometer; background delivery on iOS is a device test; Android needs the FGS (A9). | npm + A9 |
| `expo-battery` | 57.0.3 | Battery level/state/low power mode. Works while the process lives. Thermal state is not exposed (gap). | npm registry |
| `expo-keep-awake`, `expo-task-manager` | 57.0.x | Not needed on the main path (task manager cannot start a mic FGS from the background, A2). | npm registry |
| Custom Expo native module (Swift/Kotlin) | n/a | Last resort (about 1 day): `AVAudioEngine` tap + `AudioRecord` in a microphone FGS, plus an Android partial `WakeLock` if the device test shows CPU sleeping. | n/a |

---

## 3. Zero-tap verdict

**Zero-tap start is not possible on iOS and is not achievable by documented means on Android. One tap at bedtime stays the contract.**

iOS:
- Apple's record-category docs and DTS reply allow background *continuation* of a session started in the foreground; DTS says to activate the session only in the foreground (I1, I2).
- No scheduling API starts the mic. `AudioRecordingIntent` needs a Live Activity and a live report shows a background start failing (I4). Shortcuts "Open App" from a locked phone is unconfirmed (I9). We do not build on either.
- The supported one-tap path: a local notification (daily trigger) whose tap opens the app in the foreground (notification response), where the app starts recording immediately and then the user locks the phone. On a locked phone the tap normally includes an unlock.

Android:
- A2 says the microphone FGS must be created while the app has a visible activity (or via the listed exemptions). The exact-alarm exemption in the general list (A3) does not override this, so `setAlarmClock` / `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` alone cannot start a microphone FGS.
- The listed exemption that works without opening the app is "interaction with a notification" (A2). That is still one tap (a notification action).
- Possible stretch route (UNVERIFIED): at bedtime an exact alarm posts a full-screen-intent notification that launches an activity over the lock screen (alarm-clock behavior), making the app visible, and the activity starts the FGS. Needs `SCHEDULE_EXACT_ALARM` and `USE_FULL_SCREEN_INTENT` (restricted by Play to calling/alarm apps, A6; user can toggle for a sideloaded build), and the BAL rules for alarm-launched activities are not covered by the pages read (A5). Estimated 2 to 3 hours plus device testing; it would also wake the screen at bedtime and look like an alarm. Cut first; label as an experiment in any demo.

Wording for the product and demo: "Tap once at bedtime to start; recording continues with the screen locked." Never "automatic recording."

---

## 4. Library choice

Recommendation: **`react-native-audio-api` `AudioRecorder` at a requested 16 kHz** (mono, 1 s buffers), configured through its Expo config plugin (`iosBackgroundMode`, `androidForegroundService`, `androidFSTypes: ["microphone"]`, `androidFSStopWithTask: false`).

Why it is first:
1. Background recording is a documented, first-class path for the callback mode (not just file mode), including the Android foreground-service and iOS mode requirements.
2. It documents a requested `sampleRate` (16 kHz example) and `bufferLength`, which matters: the DSP is calibrated at 16 kHz and resampling a night of 48 kHz in Hermes costs real CPU (section 10).
3. It exposes the iOS session mode, so we can try `measurement` (less system processing). Needs verification that it works with the recorder.
4. Actively maintained (published the day of this research).

Why it is not certain: pre-1.0 (0.13.x), 22 open issues, and its docs do not cover our 8-hour case. Hence M1 is a gate with a pass/fail on hardware.

| Rank | Option | Strengths | Weaknesses | Use if |
|---|---|---|---|---|
| 1 | `react-native-audio-api` | Documented background + callback + 16 kHz + plugin; `iosMode` | Pre-1.0 churn; requested rate not guaranteed | Default |
| 2 | `expo-audio` `useAudioStream` | First-party, SDK-pinned, plugin adds FGS; PCM float32 | Stream background behavior undocumented; default 48 kHz; stream API only since SDK 56 | RNAA fails the M1 soak or won't build |
| 3 | `@siteed/audio-studio` | Rich (interruption handling, analysis) | Background/plugin undocumented in README; one maintainer | Both above fail |
| 4 | File-chunk fallback with `expo-audio` file recording | Documented background path | Writes raw audio to disk (privacy cost), must be chunked/deleted quickly; recorder lacks documented rotation | Last resort; if used, delete each chunk within seconds of analysis, say so in the UI |
| 5 | Custom native module | Full control | About 1 day, Swift and Kotlin | All else fails |
| Rejected | `react-native-live-audio-stream` | n/a | Last release 2022 | Never |

Supporting modules: `expo-notifications` (bedtime prompt), `expo-battery` (charging, level, low power), `expo-sensors` Accelerometer (optional; may be unavailable and must degrade), `expo-file-system` (append-only epoch log), `expo-asset` (bundled sample audio for the M0 check), `expo-secure-store` only if we ever store keys (we do not).

---

## 5. Architecture

### 5.1 Repository layout and code sharing

```
Sleep Apnea/
  src/                 EXISTING web app + pure core (unchanged behavior)
    types/ evidence/ questionnaire/ report/ content/ audio/features audio/model audio/(quality,loudness,bandwidth,...)
    night/             NEW pure-TS overnight core (no DOM, no React, no Expo imports): epoch aggregation,
                       streaming pipeline, sleep estimate, night summary, adapters, claims. Tested by web vitest.
  mobile/              NEW Expo SDK 57 dev-client app (own package.json, own node_modules, own React/RN)
    app.config.ts, metro.config.js, tsconfig.json
    src/ screens/ capture/ (native audio glue) storage/ schedule/ ui/
  scripts/             existing + new: night-replay.ts, build-sample-night.ts (Node, tsx)
  docs/OVERNIGHT_PLAN.md
```

Rationale for `src/night/`: the root `vitest` and `tsc` already cover `src/`, Node scripts import it for replay and sample generation, and the web bundle never imports it (so the web app's behavior and bundle are unchanged; M0 records `dist` size before and after). Alternative if the user prefers zero additions under `src/`: a top-level `core-night/`; same code, one config line different. Open question Q6.

**Metro resolution.** `mobile/` does not use npm workspaces (the root web app has its own React 19.3 and Vite toolchain; keeping `mobile/` independent avoids a second React copy and version conflict).
- `mobile/tsconfig.json`: `extends: "expo/tsconfig.base"`, `compilerOptions.paths: { "@core/*": ["../src/*"] }` (Expo resolves tsconfig `paths` in Metro; confirm in M0), `include` the mobile sources plus `../src/{types,content,questionnaire,evidence,report,night}` and `../src/audio/{constants,features,model,quality,loudness,quietGaps,bandwidth,analyze,modelHook}.ts`. No DOM lib, which makes any browser API in shared code a compile error: this is the purity guard.
- `mobile/metro.config.js`: `config.watchFolders = [path.resolve(__dirname, '../src'), path.resolve(__dirname, '../model')]`; `config.resolver.blockList` excludes the root `node_modules` and `dist`, plus `*.test.ts(x)`; `resolver.nodeModulesPaths = [path.resolve(__dirname,'node_modules')]`. Shared files have no third-party imports, so nothing needs hoisting.
- Excluded from the mobile graph by design: `audio/worker.ts`, `audio/decode.ts`, `audio/useAnalysis.ts`, `audio/modelCardInfo.ts`, `pages/`, `components/`, `state/`, `App.tsx`, `main.tsx`.
- A purity test (new, `src/night/purity.test.ts`) scans the shared-core file list and fails on `window.`, `document.`, `Worker`, `AudioContext`, `localStorage`, `sessionStorage`, `from 'react'`, or `import.meta` (with the two known `import.meta.glob` sites allowlisted until 5.4 resolves them).

### 5.2 Runtime diagram

```
 USER SETUP (once)                      BEDTIME                                  OVERNIGHT (screen locked)
 sleep hours, consent  ---------->  OS local notification  --tap/unlock-->  app foreground: start capture
 (SQLite/JSON, no audio)            (daily trigger,                         (iOS: audio session activated NOW;
                                     Android exact alarm perm)               Android: microphone FGS starts NOW)
                                                                                     |
                                                                       user locks phone; app backgrounds
                                                                                     v
  +------------------ native audio thread ------------------+      +------------------- JS (Hermes) -------------------+
  | mic -> AudioRecorder (16 kHz mono float32, ~1 s bufs)   | ---> | CaptureController (mobile/src/capture)            |
  | iOS: UIBackgroundModes audio | Android: mic FGS + notif |      |  - timestamps, gap detector (wall clock)          |
  +---------------------------------------------------------+      |  - 100 ms RMS at capture rate (cheap gate input)   |
                                                                   |  - ring buffer <= 10 s (RAM only, never to disk)   |
   other signals (RAM only):                                       +------------------------+--------------------------+
   AppState, expo-battery (charging/level/LPM),                                             | 1 s chunks
   expo-sensors accelerometer (optional) ---------------------------> src/night (pure TS) <-+
                                                                   | level gate -> [gate open?]                         |
                                                                   |   yes: streaming frame log-mel (reuse overlap),    |
                                                                   |        windowFeatures, scoreWindow (existing MLP)  |
                                                                   |        speech-like / handling flags                |
                                                                   |   no : count window as "below gate"                |
                                                                   | EpochAggregator (30 s) -> EpochRecord              |
                                                                   | SleepEstimator (hysteresis state machine)          |
                                                                   +------------------------+--------------------------+
                                                                                            | append-only JSONL, 1 line/epoch
                                                                                            v
                                                          app sandbox: nights/<id>/epochs.jsonl  (+ manifest.json)
 MORNING / ON STOP                                                                           |
 finalizeNight() -> NightSummary -> nightToAudioAnalysis() / nightAudioState() --------------+
        -> existing buildRulesInput(...) with audio overridden -> existing evaluate() -> EvidenceSummary
        -> existing report generate() (+ overnight sections) -> native screens, share-as-text, delete
```

### 5.3 Native screens versus WebView (recommendation: native)

Native screens (React Native), reusing `evaluate`, `buildRulesInput`, `activeInstrument`, `symptomChecklist`, `generate`, and `content/claims` as data. Only presentational components are rewritten (about six small RN components: EvidenceCard, SourceBadge, Banner, Timeline, Disclaimer, ConsentGate).

WebView of the existing app is rejected:
- The web app only accepts audio through its own `AudioInput` + worker pipeline and `session` state; injecting a night analysis needs a code change in `state/session.tsx` or `pages/*`, violating "existing web app untouched."
- Its CSP is `default-src 'self'; connect-src 'self'` and it expects an http(s) origin; local file loading, workers and `sessionStorage` behave differently in a WebView.
- Navigation, keyboard, accessibility and print inside a WebView on a phone are weaker, and we cannot verify the combination in 1 to 3 days.
Fallback: if the native questionnaire is cut, open the deployed/local web app in the system browser for the questionnaire and summary. No integration.

### 5.4 Required changes to shared files (approval-gated, with regression check)

1. `src/audio/model/infer.ts` and `src/audio/modelCardInfo.ts` contain `import.meta.glob`. First try (no source change): enable Expo's `import.meta` transform in the Metro/Babel config and rely on the existing `try/catch` returning `null`; the mobile app never calls `loadShippedModel` and instead calls `createModelHook(require('../../model.json'))`. If the transform is unavailable or the bundler rejects the syntax, the fallback is a 2-file refactor that moves `loadShippedModel` to `src/audio/model/shipped.ts` and updates `modelHook.ts`. Regression check for any such edit: root `npm test`, `npm run typecheck`, `npm run build` all pass with the same test count, and the web `dist` is rebuilt. This needs user approval (Q7).
2. No change to frozen contracts `src/types/*.ts`, `constants.ts`, `features/index.ts` signatures. New types live in `src/night/types.ts` and adapt into the frozen ones.

---

## 6. Data model additions (all in `src/night/types.ts`, new)

```ts
export type SleepWindowSettings = {
  bedtimeLocal: string;     // "23:00"
  wakeLocal: string;        // "07:00"
  tz: string;               // IANA, captured at setup; re-read each night
  remindEnabled: boolean;
  promptLeadMin: number;    // notification this many minutes before bedtime (default 0)
};

export type OvernightConsent = {
  purpose: 'overnight-local-capture';
  granted: boolean;
  version: string;          // consent text version
  at: string;               // ISO
  bystanderNoticeAckAt: string | null;
  mobileOnlyStorageAckAt: string | null;
};

export type CaptureEndReason =
  | 'user-stop' | 'scheduled-end' | 'interrupted-call-or-alarm' | 'os-killed-or-crash-recovered'
  | 'low-battery' | 'mic-lost' | 'storage-error';

export type EpochState = 'likely-awake' | 'likely-asleep' | 'uncertain' | 'outside-window' | 'not-captured';

export type SignalAvailability = {   // which independent signals existed this epoch
  schedule: true; appState: boolean; charging: boolean | 'unavailable';
  motion: boolean | 'unavailable'; audioLevel: boolean;
};

export type EpochRecord = {          // 30 s; ~150-200 bytes JSON; the ONLY per-time data persisted by default
  i: number;                         // epoch index from capture start
  t: number;                         // epoch start, unix ms
  cap: number;                       // seconds actually captured in the epoch (0..30)
  lvl: { p10: number; p50: number; p90: number };   // dBFS of 1 s RMS
  floor: number;                     // rolling noise floor estimate dBFS
  win: { total: number; belowGate: number; tooQuiet: number; scored: number; snoreLike: number };
  snoreBits?: string;                // base64 bitset of snore-like flags for scored windows (<= 60 bits)
  scoreQ?: string;                   // base64 uint8 quantized internal scores (never displayed; kept so the
                                     // night can be mapped to AudioAnalysis.windows without inventing scores)
  speechLikeSec: number; handlingEvents: number; loudNonSnoreSec: number;
  motionSec: number | null;          // null = accelerometer unavailable
  charging: boolean | null; appActive: boolean; battery: number | null;
  state: EpochState; reasons: SleepReason[];
  bwHz?: number;                     // effective bandwidth sample (feeds modelApplicable)
};

export type SleepReason =
  | 'in-window' | 'out-of-window' | 'screen-or-app-active' | 'charging' | 'still' | 'sustained-quiet'
  | 'speech-like' | 'handling-sounds' | 'loud-non-snore' | 'motion' | 'plug-change' | 'onset-pending';

export type CaptureGap = { t0: number; t1: number; cause: CaptureEndReason | 'digital-silence' | 'late-buffers' | 'overload' };

export type NightRecord = {          // manifest.json
  id: string; deviceModel: string; osVersion: string; appVersion: string;
  modelVersion: string | null; nightHeuristicsVersion: string;
  settings: SleepWindowSettings; captureStart: number; captureEnd: number | null;
  endReason: CaptureEndReason | null; gaps: CaptureGap[]; sampleRateReported: number;
  isSynthetic: boolean;              // true for the labeled sample night
  source: 'device-recording' | 'sample-assembled';
  retention: { epochs: true; windowFeatures: false /* dev toggle */ };
};

export type NightSummary = {         // computed, never persisted as truth (recomputed from epochs)
  nightId: string; recordedSec: number; inWindowSec: number;
  estimatedAsleepSec: number; uncertainSec: number; awakeSec: number; notCapturedSec: number;
  estimatedWindow: { start: number; end: number } | null;   // "Estimated sleep window"
  signalsUsed: { name: string; usable: boolean }[];         // shown instead of any "confidence"
  assessedSec: number;               // time in epochs analysed for snore-like patterns
  assessableWindows: number; snoreLikeWindows: number;
  episodes: { t0: number; t1: number; flagged: number }[];
  episodeQualifiedFraction: number;
  bandwidthApplicable: boolean;
  nightState: NightAudioState;       // see section 8
  notAssessedReasons: string[];
  limitations: string[];
};

export type NightAudioState =
  | 'not-recorded' | 'not-assessed' | 'model-not-applicable' | 'no-model'
  | 'few-observations' | 'snore-like-observed';
```

Storage per night (8 h = 960 epochs): about 960 x 200 B = ~190 KB for `EpochRecord`s (including quantized scores), manifest <2 KB. Optional dev toggle "retain window features for re-analysis": 57,600 windows x 80 int8 = ~4.6 MB per night, off by default, auto-deleted after 7 days. Raw audio is never written (8 h at 16 kHz int16 would be ~922 MB; section 10).

---

## 7. Sleep-estimation heuristic spec

Purpose: choose which epochs are analyzed for snore-like patterns, and show the user an *estimated* window. It is not a sleep tracker and the product never says "sleep detected", "you slept", "sleep quality/score/efficiency" or reports stages. It is an unvalidated heuristic from audio level, app state, charging, optional motion and the user's schedule.

### 7.1 Epochs and signals

Epoch = 30 s (matches the existing `CHUNK_SEC`). A noise floor is tracked as the rolling 10-minute 10th percentile of per-second RMS dBFS (with a floor at `SILENCE_FLOOR_DBFS`).

| Signal | Source | Role | Failure mode |
|---|---|---|---|
| In scheduled window | user setting | Required for `likely-*`; outside = `outside-window` (never analyzed) | User sleeps outside hours |
| App/screen state | `AppState` (background/inactive = locked or other app) | Awake indicator when `active` (phone in use) | iOS/Android cannot report "screen on while locked"; weak |
| Charging | `expo-battery` | Supportive (on charger on nightstand), neutral if not charging; plug/unplug event = awake indicator | Not charging is common, so never penalized |
| Motion (optional) | `expo-sensors` accelerometer (needs FGS on Android, A9; iOS background delivery is a device test) | Awake indicator if phone handled; supportive if still | Often unavailable; epoch marks `motion: 'unavailable'` and the signal is simply not counted |
| Sustained quiet | audio level vs floor | Supportive when p90 < floor + 8 dB for 10 min | Fan/white noise masks; quiet awake reading in bed looks identical to sleep |
| Speech-like sound | cheap detector on the 300 to 3400 Hz band envelope: sustained energy with 2 to 8 Hz syllabic modulation and frame-to-frame spectral change; runs only when the gate is open | Strong awake indicator (>= 5 s in an epoch) | Unvalidated; TV, podcasts, partner talking in sleep; the snore model was never trained on speech |
| Handling/footstep transients | count of short (< 1 s) bursts >= floor + 15 dB | Weak awake indicator (>= 3 per epoch) | Pets, partner moving |
| Loud non-snore sustained | >= 10 s above floor + 15 dB while < 50 percent of scored windows are snore-like | Weak awake indicator | Traffic, storms |

All thresholds above are named constants in `src/night/constants.ts`, labeled PROVISIONAL, with the rule: they are tuned only against the user's own labeled nights and the ESC-50 sample, never claimed as validated.

### 7.2 State machine (per epoch)

1. `outside-window` if the epoch start is outside [bedtime, wake + 30 min grace]. Never analyzed.
2. `not-captured` if captured seconds < 15 of 30 (gap, interruption). Never analyzed; counted in "not assessed".
3. Awake indicators: strong = speech-like >= 5 s, app `active`, plug-change, motion >= 10 s; weak = handling >= 3, loud non-snore >= 10 s. `likely-awake` if >= 1 strong or >= 2 weak. Wake requires the indicator on 1 epoch (strong) or 2 consecutive (weak).
4. Otherwise, onset logic: the epoch is `likely-asleep` only after >= 20 consecutive epochs (10 min) with no awake indicator, the app in background continuously, and at least one of {charging, still, sustained-quiet} true. The first 10 minutes before that are retroactively `uncertain` (label `onset-pending`), not asleep.
5. Otherwise `uncertain` (in window, no awake indicators, but too few supporting signals, for example no charging, no motion, noisy room).

Snore-like windows are deliberately NOT used as evidence of sleep (circularity). A snore-like dominated epoch is classified by the other signals; if those are inconclusive it is `uncertain`, which is still analyzed.

### 7.3 What the estimate controls

| Epoch state | Analyzed for snore-like patterns | Counts toward "assessed time" |
|---|---|---|
| likely-asleep | yes | yes |
| uncertain (no awake indicators) | yes, reported separately and in the sensitivity line | yes, but flagged |
| likely-awake | no (excluded) | no |
| outside-window, not-captured | no | no |

A night-level "sensitivity" line always shows the snore-like windows counted if only `likely-asleep` epochs are used, versus `likely-asleep` + `uncertain`, so the user and clinician can see whether the estimate matters.

### 7.4 Showing uncertainty

- Text: "Estimated sleep window (unvalidated estimate): 11:42 pm to 6:20 am. The phone cannot tell sleep from lying quietly awake."
- Timeline strip, one cell per epoch, three visual styles that do not rely on color alone: solid (estimated asleep), hatched (uncertain), outlined/empty (awake or not captured), with a legend and a screen-reader summary (hours per state).
- "Signals used tonight: schedule, app state, audio level (3 of 5). Charging and motion were not available." (This replaces any "confidence" wording, which is on the forbidden list.)
- Optional morning check "Does this match your night? Yes / Roughly / No" stored on-device and used only for developer tuning notes; it is never used to claim accuracy.
- Validation honesty: no accuracy figure is stated. Planned work (not in the hackathon scope): compare against self-reported times and a wearable.

---

## 8. What the night dictates: evidence mapping

Principle: do not invent conclusions. Everything funnels into the existing `AudioEvidenceState` (`notProvided | unusable | usableFewObservations | usableSnoreLikeObserved | noModel | modelNotApplicable`) and the existing rules (`matchRule`, first match wins). No engine change. Audio never downgrades because rules 1 to 3 are decided by NoSAS/symptoms/red flag first, and the only audio-driven rule (3) can only raise `inconclusive` to `discuss-with-clinician`.

### 8.1 Night to state

Implemented as pure functions in `src/night/` (new), unit-tested:

| Night condition (evaluated in this order) | `NightAudioState` | Maps to `AudioEvidenceState` |
|---|---|---|
| No capture at all | not-recorded | `notProvided` |
| `modelVersion` null | no-model | `noModel` |
| assessed time < `NIGHT_MIN_ASSESSED_SEC` (provisional 2 h) OR in-window coverage < 50 percent OR quality unusable (clipping, digital silence, mic lost) OR no assessable windows | not-assessed | `unusable` |
| Effective bandwidth < existing `MIN_EFFECTIVE_BANDWIDTH_HZ` (existing `BandwidthEstimator`, accumulated over gate-open frames) | model-not-applicable | `modelNotApplicable` |
| >= `NIGHT_MIN_EPISODES` episodes and episode-qualified fraction >= `NIGHT_SNORE_FRACTION_OBSERVED` | snore-like-observed | `usableSnoreLikeObserved` |
| otherwise | few-observations | `usableFewObservations` |

"Too short, interrupted, too noisy" (including constant loud noise such as a TV, high noise floor, heavy clipping) all land in `not-assessed` -> `unusable`, which the engine already renders as "not assessed" with a missing-item line and never as reassurance. `usableFewObservations` is also non-reassuring in the existing copy ("cannot rule out").

### 8.2 Why a separate night threshold

The existing `SNORE_FRACTION_OBSERVED = 0.1` was set for 10 to 20 minute clips and is shared with the web app, so we do not change it. For 8-hour audio the model card's window-level numbers (test false-positive rate 4.5 percent overall and 6.5 percent on bedroom-relevant negatives, precision 0.23 at the test base rate, mouse clicks flagged in 30 percent of windows) mean thousands of windows will be flagged by chance. So the night rule needs temporal structure:
- Episode = a run of flagged windows with gaps <= 10 s between consecutive flagged windows and >= `NIGHT_EPISODE_MIN_FLAGGED` (provisional 5) flagged windows.
- `snoreLikeFraction` handed to the adapter = flagged windows inside episodes / assessable windows (a stricter number than raw fraction).
- Provisional constants: `NIGHT_MIN_EPISODES = 3`, `NIGHT_SNORE_FRACTION_OBSERVED = 0.02`. They are tuned in M3 so that (a) the labeled ESC-50 sample night yields `snore-like-observed`, (b) the user's own quiet-room night does not, and (c) they are documented as pragmatic and unvalidated. A wrong constant can only change whether rule 3 fires for people with low NoSAS and low symptoms; the copy always says "snoring alone does not mean sleep apnea."

### 8.3 Adapter to the existing `AudioAnalysis`

`nightToAudioAnalysis(summary, epochs): AudioAnalysis` (so existing `report/generate` and any engine consumer work unchanged):
- `status:'done'`, `modelVersion`, `modelApplicable`, `isSynthetic` from the night.
- `quality`: `durationSec` = assessed seconds; `silenceRatio`, `noiseFloorDb`, `clippingPct` aggregated; `verdict` per 8.1; `reasons` list the exact causes.
- `windows`: assessable windows in analyzed epochs with real quantized scores from `scoreQ` and flags from `snoreBits` (windows below the level gate are counted but not listed as scored; see 10.2 for how they enter denominators).
- `snoreLikeFraction`: episode-qualified (8.2). `quietWindowCount`: too-quiet windows.
- `quietGaps: []` and the UI never shows "quiet periods" for nights. Reason: the existing quiet-period detector is a 15 dB drop below the median for >= 10 s; over 8 hours in a room it fires constantly and would be a meaningless, potentially alarming number.
- `loudness`: per-second dBFS is NOT stored; the display uses per-epoch p10/p50/p90 lines.
- `limitations` always include the existing audio disclaimers plus new night limitations (phone placement, unvalidated sleep estimate, unvalidated model on overnight audio).

The orchestration for the morning screen: `buildRulesInput(...)` (existing) is called with the adapted analysis, then `input.audio` is overridden with the mapped night state before `evaluate(...)`. Tests prove the override equals `audioStateFrom(adapted)` except in the cases where the night rule is stricter by design.

### 8.4 Multi-night consistency

Per-night state list -> aggregate `AudioEvidenceState` for the engine:
- Only nights not `not-assessed` count as assessed. If none are assessed but some were recorded: `unusable` (never "few observations"). If none recorded: `notProvided`.
- Any assessed night `snore-like-observed`: aggregate `usableSnoreLikeObserved`, with text "observed on k of m assessed nights" and a "recurring" note when k >= 2 (descriptive, no threshold claim).
- All assessed nights `few-observations`: `usableFewObservations`, plus the unassessed-night count as missing items, plus "A quiet or unremarkable recording cannot rule out sleep apnea."
- Band-limited on all assessed nights: `modelNotApplicable`.
- Night-to-night differences are expected (position, alcohol, congestion are not asked, so we do not speculate). Inconsistency is shown as a neutral "varied" row in an `uncertaintyNotes`-style panel in the mobile layer, not as an engine `Conflict`, and not as a reason to lower any conclusion.
- The per-night table (date, recorded hours, estimated asleep window, assessed hours, state) is mobile-layer content. Extra `EvidenceItem`s (`source:'audio-observation'`, one per night, `isSynthetic` for the sample) are appended after `evaluate`. The clinician summary gets an added "Overnight audio" section from `src/night/report.ts`; `generate()` is unchanged.

### 8.5 Invariants (each has a test)

1. For every NoSAS x symptoms x red-flag x night-state combination, the conclusion with a night present is never lower than with no audio (extends the existing property).
2. No night state produces `inconclusive -> lower` or any "low risk"/green output; no new `Conclusion` value.
3. `not-assessed`, `no-model`, `model-not-applicable` always add a `missing` line and never produce rule 3.
4. `isSynthetic` propagates from sample nights to every item, the report and the timeline, and sample nights are never used for the conclusion (same pattern as the web `audioIsSample`).
5. No field named probability/severity/score/confidence exists in night types or UI strings.

---

## 9. Privacy, consent, bystanders, deletion

- **Audio is never written to disk by default, and is never uploaded.** Capture buffers live in RAM (ring buffer <= 10 s) and are overwritten. Persisted data: `EpochRecord`s (levels, counts, flags, quantized internal scores, state), the manifest, schedule, consent. No analytics SDK, no crash-reporting SDK, no network calls with user data in release; test asserts the mobile source has no `fetch`/`XMLHttpRequest`/`WebSocket` (dev-client Metro traffic is the only network use in development, which is stated in the README, not a product claim).
- **Consent screens (first run, versioned):** purpose in plain words; what is captured and for how long; "audio is analyzed on this phone and discarded within seconds; we do not save recordings"; "this is a screening-support tool, not a diagnosis"; the permission prompts' purpose strings repeat this. Consent can be withdrawn in Settings, which stops capture and offers deletion.
- **Honest scope of the claim:** "No recording is saved" is only true if the M2 test proves no audio file is created (file-system diff test) and the fallback "file-chunk" library option (Section 4 rank 4) is not in use. If it is used, the UI says audio is briefly written and deleted, and the claim changes.
- **Bystander/partner notice (distinct from user consent):** at first run and on every start sheet (compact after night 3): "Others sleeping in the room may be audible. Tell them before you record. Recording laws vary by place. SleepSmooth does not keep audio." A checkbox "I have told anyone sharing the room" is recorded in `OvernightConsent.bystanderNoticeAckAt`. We do not attempt speaker identification or speech transcription; speech-like detection only produces a boolean per epoch and is never stored as content.
- **System indicators:** iOS orange dot and Android notification "Recording audio" are shown and described in onboarding. They are not hidden.
- **Delete:** per-night delete; "Delete all overnight data" (nights, settings, consent, scheduled notifications) with confirmation; deletion verified by test (directory empty, notifications cancelled). Parity with the web "Delete my data."
- **Backup exclusion:** Android `allowBackup:false`; iOS night files stored where they are not synced to iCloud backup (verify the exact API in M2; if Expo FileSystem cannot set the exclude flag, use the Caches directory and say nights can be purged by the OS). Open question Q9.
- **Data sensitivity:** health-related; no sharing. The "share" action exports only the user-edited text summary through the OS share sheet after a confirmation; no automatic export.
- **App Review/Play:** not submitting. If ever submitted: privacy policy, purpose strings, 2.5.4 justification for background audio, Play FGS declaration. These are post-hackathon risks, recorded, not mitigated.

---

## 10. Compute, battery, thermal, storage

### 10.1 DSP cost on Hermes (estimates until measured)

Existing pipeline (read from `src/audio/features/logmel.ts`, `modelHook.ts`, `analyze.ts`): per 1 s window with 0.5 s hop it computes 100 frames of Hann(400) -> zero-pad 512 -> radix-2 FFT -> 257-bin power -> a dense 40 x 257 mel multiply -> `ln`, then 80-d mean/std and a 80-32-1 MLP.
- Per frame: FFT about 2,304 butterflies x ~10 flops = ~23 kflop; dense mel 40 x 257 MAC = ~20.5 kflop; window/power/log ~1.5 kflop. Total about 45 kflop per frame.
- Per second of audio at 2 windows per second computed independently: 200 frames = ~9 Mflop/s of audio.
- 8 h = 28,800 s, if every window were processed: ~260 Gflop. At an assumed effective Hermes rate of 20 to 100 Mflop/s (Hermes has no JIT; M0 measures the real number), that is 43 to 217 minutes of one core: too heavy to leave unoptimized.

Two exact optimizations (output bit-identical or within 1e-6 to the existing path; verified by test):
1. **Frame reuse across the 50 percent overlap.** Because the hop (8000 samples) is a multiple of the frame hop (160), frames 1 to 98 of consecutive windows are the same frames; only the two zero-padded edge frames differ. Compute log-mel once per 10 ms frame and reuse: about 104 frames per second of audio instead of 200 (about 1.9x less).
2. **Sparse mel.** HTK triangular filters touch a handful of bins each; loop only over non-zero spans. Mel cost drops from ~20.5 kflop to ~1 kflop per frame; per frame about 26 kflop total (about 1.7x less).
Combined: about 2.7 Mflop per audio-second (3.3x less than 9). If the device cannot deliver 16 kHz, resampling by our windowed-sinc (about 50 taps per output sample) adds ~1.6 Mflop per second; avoid by requesting 16 kHz natively and, if forced to resample, resample only gate-open segments after computing level at the native rate.

Reduced-duty design (the "level gate"): per-second RMS is computed at the capture rate for every second (trivial). Features and MLP run only when the second's RMS >= `max(SILENCE_FLOOR_DBFS, rollingFloor + GATE_DB)` (provisional `GATE_DB = 6`). Gated-off windows are counted as `belowGate`, never scored, and are not described as "no snoring". Honest side effect: very faint snoring near room noise is not analyzed. Gate-off windows are included as non-snore-like in the assessable denominator (they are explicitly not scored; an alternative is excluding them, which would inflate the fraction). Both numbers are available in the summary. A parity test runs the streaming pipeline with the gate disabled against the existing `analyzeAudio` + `createModelHook` on `public/sample-audio/esc50-sample.wav`: scores equal within 1e-4 per window.

Estimated budget at 2.7 Mflop per audio-second: 20 to 100 Mflop/s -> 3 to 14 percent of one core while gate-open; if the gate is open 25 percent of the night, an average of ~1 to 4 percent of one core, about 2 to 8 CPU-minutes for the night in feature work plus JS overhead for 1 s callbacks. Target: M2 on-device measurement shows < 10 percent average CPU of one core over a 1 h soak with a representative noise mix, else the gate threshold is raised or the sparse/optimization work is extended. Overload policy: if the processing queue exceeds 60 s, skip gate-open work for the oldest chunks, record `CaptureGap(cause:'overload')`, and report them as not assessed.

JS thread blocking: process in slices of <= 250 ms of audio work with `await` yields so the JS thread stays responsive for notifications and the stop action.

### 10.2 Battery and thermal

I did not find authoritative per-hour battery figures for microphone foreground services, so none are asserted. Cost components: mic and audio DSP in the OS (small but constant), our JS work (section 10.1), and wake time (the OS must keep the CPU running; Android may require a partial wake lock, A8, device test). Plan:
- Recommend charging overnight; show a start-sheet notice when unplugged and battery < 60 percent ("recording overnight may drain the battery; charging is recommended").
- Not charging: still allowed. On Low Power Mode / battery saver, show a warning (these modes may reduce background activity; behavior is a device test). Auto-stop gracefully at battery <= 10 percent with `endReason:'low-battery'` and the summary labeled "ended early."
- Thermal: the OS does not expose thermal state in Expo (gap). Mitigations: low duty cycle, guidance "leave the phone uncovered on a hard surface, not under a pillow," and a measured temperature note from the soak test (touch/Xcode energy gauge / `adb shell dumpsys thermalservice` on Android).
- Measurement protocol (M2/M6): record start/end battery %, charging state, ambient, device, OS, library; run 1 h unplugged soak at screen off and the full night plugged in; log in `docs/` (new, only after measurement). Acceptance for the demo is "documented measurement", not a target number.
- iOS energy: use Xcode Energy gauge during the soak.

### 10.3 Storage

Per night: ~190 KB epochs + <2 KB manifest, or ~195 KB (about 5.8 MB for 30 nights). Optional dev feature retention +4.6 MB per night. In RAM: <= 10 s ring buffer (16 kHz float32 = 640 KB).

---

## 11. Milestones

Sizing assumes one engineer working with subagents, on a Mac with Xcode 26.1.1 (observed; no iPhone is connected, no Android SDK/adb, Node 22.15). Hours are focused work. Every milestone leaves something demoable. Gates are marked.

### Critical-path schedule

| Day | Goal |
|---|---|
| Day 1 | M0, M1 (gate), M2. End of day: a build that can record a real night. Record night 1 that evening (even if the UI is rough). |
| Day 2 | M3, M4, M5-lite. Use night 1 data to tune constants. Record night 2 with the improved build. |
| Day 3 | M5, M6. Demo rehearsal, backups. |
If only 1 day exists: do M0, M1, M2 and a minimal M3 (summary screen with state + evidence mapping), record one night, and use the web app for the rest. If 2 days: M0 to M4 plus M5-lite.

### M0. Mobile shell + shared core on Hermes (about 3 h)
Build: `mobile/` Expo SDK 57 dev client (iOS first), `metro.config.js`, tsconfig paths, `@core` imports; a debug screen that loads `model.json`, runs the existing `createModelHook` over the bundled `esc50-sample.wav` (via `expo-asset`) and prints window count, snore-like count, and ms per window. Decide the `import.meta` option (5.4). Record `dist` size before/after.
Demo: "The same model and DSP as the web app run natively on a phone."
Acceptance:
- `mobile` typechecks with no DOM lib; Metro bundles; app launches on a physical device or the simulator.
- In-app results equal Node results for the sample within 1e-4 per window (reuse `infer.fixture.json` and golden vectors).
- ms per window measured and written to the decision log; root `npm test`, `npm run typecheck`, `npm run build` unchanged and passing.
Tests: Node: golden/infer fixture parity (existing). Device: parity screen asserts and shows PASS/FAIL. New purity test.

### M1. Locked-screen capture spike (DECISION GATE, about 4 h)
Build: `CaptureController` using `react-native-audio-api` at requested 16 kHz; plugin config; start button; per-second RMS and sample counter in RAM; stop button; writes a minimal log (second index, RMS, wall-clock, reported sampleRate). Foreground notification on Android. Tests the permission/purpose strings.
Demo: Start, lock the phone, wait, unlock, stop; the log shows gapless seconds with the system mic indicator visible during the run.
Acceptance (on a real phone):
- 30 min with screen locked: no gap > 2 s, buffers continue, process not killed.
- Reported sample rate recorded (16 kHz or what the device gave).
- Interruption test: a timer alarm and a call (or simulated Siri) mid-run: behavior recorded (`began`/`ended`, whether `setActive` can resume); the end is recorded as `interrupted` if it cannot resume.
- `iosMode: measurement` effect noted if configurable.
- If it fails: switch to `expo-audio` stream, then `@siteed/audio-studio`, then the file-chunk fallback; record the decision and evidence in `docs/` (new decision log). Never claim a library works that failed.
Tests: manual device test script + log analyzer in `scripts/` (Node) asserting gaps and monotonic timestamps.

### M2. Streaming night pipeline + persistence (about 5 h)
Build in `src/night/`: gate, streaming frame log-mel with overlap reuse and sparse mel, `windowFeatures`/`scoreWindow` (existing), speech-like/handling/loudness features, `EpochAggregator`, append-only JSONL writer interface (the Expo file writer lives in `mobile/`), crash-recovery of an unfinished night, gap/overload detection, bandwidth accumulation. `scripts/night-replay.ts` runs a WAV through the same code in Node. Wire into the app as "Tonight" with a live epoch counter.
Demo: record 10 minutes locked, then see epoch records and snore-like counts; `night-replay` of the ESC-50 sample shows flagged windows.
Acceptance:
- Streaming vs existing batch parity: gate disabled, scores within 1e-4 on the sample; optimizations bit-equal or within 1e-6 of the unoptimized path.
- 1 h on-device soak locked screen: no process kill, epochs continuous, average CPU < 10 percent of one core (else tune), epoch file size within the estimate, memory flat.
- File-system diff test: no audio file created anywhere in the app sandbox.
- Kill the app mid-night (swipe on iOS, or kill on Android): the next launch recovers the partial night as `os-killed-or-crash-recovered`.
Tests (Vitest, Node): frame-reuse equality vs `frameLogMel`; gate unit tests; epoch aggregation on synthetic signals (tones, noise bursts, silence); gap/overload detection; JSONL recovery with a truncated last line; bandwidth reuse.

### M3. Sleep estimate, night summary, evidence mapping (about 4 h)
Build in `src/night/`: `SleepEstimator` state machine, `summarizeNight`, `nightToAudioAnalysis`, `nightAudioState`, `aggregateNights`, night claims content, forbidden-phrase extension. `scripts/build-sample-night.ts` produces the labeled synthetic sample night by running the real pipeline over an assembled long recording (public ESC-50 clips plus synthetic room tone). Morning screen: estimated window text, timeline strip, signals-used line, night state, and the evidence cards via existing `buildRulesInput` + `evaluate` with the audio override.
Demo: open the sample night (clearly labeled) and last night's real recording (after night 1) and see the evidence panel; the short test recording shows "not assessed" honestly.
Acceptance:
- Every row of the 8.1 table has a test; 8.5 invariants pass; the sample night yields `snore-like-observed` and a quiet-room control yields `few-observations`; a 5-minute recording yields `not-assessed`.
- Forbidden-phrase test covers all new strings (adds "sleep detected", "you slept", "sleep score/quality/efficiency", "stages" to the list; "asleep" allowed only after "estimated"/"likely").
- `isSynthetic` visible on every sample-night element.
Tests: table-driven state machine tests (onset, hysteresis, outside window, unavailable signals); property tests for invariant 8.5.1 across all combinations; sensitivity-line test; adapter tests; multi-night aggregation tests.

### M4. Schedule, notification, consent, controls (about 4 h)
Build: onboarding (consent, bystander notice, permission rationale), sleep-hours setup (once), daily local notification via `expo-notifications` (iOS `timeSensitive` if the signing allows, else `active`; Android exact alarm permission flow), notification tap opens the app and shows a start sheet (auto-start after a visible 3 s countdown with cancel), automatic stop at wake time + grace, morning notification, delete per night and all, Settings (withdraw consent). Battery and Low Power warnings.
Demo: the full bedtime loop: notification -> tap -> start -> lock -> (shortened wake time for the demo) stop -> summary.
Acceptance: notification fires within 1 minute of the scheduled time on device with the phone locked (both platforms tested if both exist); tap opens the app and starts capture; delete leaves no files and no scheduled notifications; consent withdrawal stops capture.
Tests: unit tests for schedule math (DST, midnight wrap, time zone change); device checklist for notification delivery under Sleep Focus/Do Not Disturb (iOS) and Doze (Android); the delete test.

### M5. Clinician summary, questionnaire, multi-night (about 5 h; lite = 2 h)
Build: native questionnaire from the shared instrument items (NoSAS + symptom checklist), the existing `generate()` plus the Overnight audio section, the next-steps content, share as text, multi-night list with aggregate state. Lite version: reuse the demo case answers and skip the native questionnaire (labeled).
Demo: night summary -> evidence -> editable clinician summary -> next steps.
Acceptance: end-to-end flow on device; red-flag wording unchanged (comes from the shared content); copy passes the forbidden-phrase test; all disclaimers present; mobile layout checked at small and large phone sizes, Dynamic Type/large fonts, and VoiceOver/TalkBack labels on the timeline.
Tests: snapshot of the report with a night section (synthetic and real-labeled), RN component tests for ConsentGate/Timeline, accessibility labels.

### M6. Demo hardening (about 3 h)
Build: demo runbook, backup screen recording, labeled-sample toggles, battery and thermal measurements logged, final QA via gstack `/qa` on the web fallback (to prove it is intact) and a device pass on mobile. Pre-warm checklist (charge, notifications allowed, mic permission, Sleep Focus allowlist, "Never sleeping apps" on Samsung, etc.).
Acceptance: web app tests/build identical to M0 baseline; mobile 3-minute demo run twice end to end; backup video exists.

### Stretch (only if all above are done)
Android zero-tap full-screen-intent experiment (2 to 3 h, labeled experimental). Accelerometer stillness if not already working. Optional window-feature retention for re-analysis (dev toggle).

---

## 12. Demo plan for judges

| Time | Beat | Honest framing |
|---|---|---|
| 0:00 | Problem and what the product is not | "Screening support. Not a diagnosis. Cannot rule out sleep apnea." |
| 0:30 | Live: tap the bedtime notification (pre-scheduled for the room) -> app opens -> countdown -> recording starts -> lock the phone; show the orange mic indicator and the notification | "One tap at bedtime. iOS and Android do not allow an app to start the microphone by itself." |
| 1:10 | Wait about 30 to 40 s locked; unlock; stop. The summary says "not assessed: recording too short to estimate" | Shows the honest "not assessed" path in front of the judges |
| 1:40 | Open last night's REAL recording (recorded the night before on this phone, device and date shown): estimated sleep window with hatched uncertainty, assessed hours, snore-like episodes count, "signals used" line | "Recorded on [device] on [date]; unvalidated estimate; we do not store audio, only these flags" |
| 2:20 | Evidence screen with a user-reported symptom case and conflict card "a quiet or missing recording cannot rule out sleep apnea"; show the sample night alongside, with its "Sample data (assembled from public ESC-50 clips)" banner | The conclusion comes from the existing engine; audio never lowers it |
| 2:50 | Clinician summary and next steps | Questions for a clinician |
| 3:00 | One honest slide: what was validated (the questionnaire scoring and unit tests), what was not (sleep estimate, overnight audio accuracy, battery over many devices) | Model card numbers are dataset-split numbers, not performance on overnight phone audio |

Assets to prepare: (1) the real night recorded the night before with a build at least at M2 (use night 1 for tuning, night 2 as the demo night; never use the same night for tuning and for any displayed statistic); (2) the labeled sample night; (3) a screen recording of the whole flow as backup; (4) the web app on a laptop as the fallback (`dist/` already built).
Do not show the user's real night with raw timestamps if they would rather not; the only data stored is flags and levels, but it is still health-related, so ask first (Q10).

---

## 13. Risks and cut list

### Top risks

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| 1 | Background capture dies on a real phone (OS kill, session deactivated, OEM killer, interruption not resumable, I6, I7, A8, A10) | Medium / Critical | M1 is a pass/fail gate; library fallbacks; foreground-lit fallback mode (keep the app foreground with a dimmed screen, like many snoring apps) so the demo still works; document the interruption outcome |
| 2 | The snore model is weak on overnight phone audio: trained on 5 s Freesound clips, 40 positives, fails on band-limited audio (recall 0.00 at 8 kHz), flags clicks/alarms; phone mic processing unknown | High / High for correctness, bounded for safety | Episode rule; bandwidth applicability check; "observed" copy with the precision caveat; audio can only raise (never lower) conclusions; measure the room noise floor and processing on the demo phone in M1; do not overclaim |
| 3 | The sleep estimate is a guess and could mislabel or be misread as sleep tracking | High / Medium | Wording rules and forbidden phrases; uncertainty strip and signals-used line; it only excludes epochs from analysis and never creates a conclusion |
| 4 | Schedule: native toolchain and unknowns (Xcode signing/free-team limits, no Android SDK/adb here, EAS account, Hermes speed, Metro `import.meta`) | High / High | M0/M1 gates; iOS-first with Android via EAS if a device exists; 1-day and 2-day cut lines; the web app stays the fallback |
| 5 | Safety/privacy/claims drift or a false "no audio is saved" claim; bystander recording; App Review (2.5.4) if ever published | Medium / High | Single claims file with forbidden-phrase tests; file-system diff test before making the claim; bystander acknowledgment; no store submission; consent versioning |
| 6 | Notification missed (Sleep Focus/Do Not Disturb, Android Doze, exact alarm not granted) | Medium / Medium | Time-sensitive level (needs signing capability), exact-alarm permission flow, allowlisting steps, in-app "Start now" button as a manual path |
| 7 | CPU/battery/thermal heavier than estimated (Hermes no JIT) | Medium / Medium | Gate, overlap reuse, sparse mel, overload policy, on-device soak before night 1 |
| 8 | Unfilled expectation that tuning constants are validated | Medium / Medium | Every constant labeled PROVISIONAL in code and doc; tuning only on the user's own labeled nights; no accuracy claims |

### Cut list (cut from the top first)
1. Android zero-tap (full-screen-intent) experiment.
2. Optional window-feature retention and dev tooling beyond logs.
3. Accelerometer stillness (rely on app state, charging, audio level).
4. Speech-like detector (use loud-non-snore and handling counts only; sleep estimate gets weaker and the signals-used line says so).
5. Multi-night comparison beyond a simple list and the aggregate rule.
6. Native questionnaire (use the labeled demo case answers, or open the web app in a browser).
7. Share/export (show on screen only).
8. Battery/thermal telemetry beyond a manual note.
9. Android entirely (iOS-only demo), or iOS entirely if no iPhone/signing is available and an Android device is.
Never cut: consent/bystander notice, deletion, forbidden-phrase tests, "not assessed" handling, sample-data labeling, the engine invariants.

---

## 14. Open questions for the user

1. Which phone(s) will you demo on and record the real night with (model, OS version)? Is there an Android device as well? (No phone is currently connected to this Mac; Xcode 26.1.1 is installed; Android Studio/adb are not.)
2. Do you have a paid Apple Developer account, or only a free Apple ID (Personal Team)? A free team can build and run on your own iPhone with `audio` background mode but profiles expire after about 7 days and some capabilities (for example Time Sensitive notifications) may be unavailable. TestFlight/EAS iOS builds need the paid program.
3. Do you have an Expo account for EAS (needed for a cloud Android dev build without installing the Android SDK)?
4. What sleep hours should the demo use, and will the phone be charging on a nightstand (recommended)? Is a partner/roommate in the room (consent and the bystander notice apply)?
5. Are you comfortable having the app run with a persistent system mic indicator and a visible Android notification during the demo?
6. OK to add the pure-TS `src/night/` folder (new files only, covered by the web test run) rather than a separate top-level folder?
7. If Metro cannot bundle `import.meta.glob` files, may we make the 2-file refactor of `infer.ts`/`modelCardInfo.ts` (with the web regression run), or must web source remain byte-identical (then the mobile app imports a mobile-only wrapper copy of just `loadShippedModel`, a small duplication)?
8. May the real overnight recording's summary (flags, estimated window, no audio) be shown on screen to judges? Anything you want redacted (dates, times)?
9. For stored nights on iOS: is it acceptable to store them in a location the OS may purge (not backed up), or should they be in the backed-up Documents directory? Any iCloud concern?
10. ESC-50 clips and the trained weights are CC BY-NC; fine for the hackathon, but do you intend any commercial use later (model card already flags it)?
11. Is one-night-only acceptable for the live demo with the second night as a stretch, given the tuning-versus-demo-night separation in section 12?
12. Do you want me to prioritize iOS and treat Android as best-effort, since Android needs extra device setup here?

---

## Appendix A. Sources (all fetched 2026-10-11 unless noted)

- Apple, AVAudioSession.Category.record: https://developer.apple.com/tutorials/data/documentation/avfaudio/avaudiosession/category-swift.struct/record.md
- Apple DTS thread (iOS 26.5 background recording, May 2026): https://developer.apple.com/forums/thread/826462
- Apple, Handling audio interruptions: https://developer.apple.com/tutorials/data/documentation/avfaudio/handling-audio-interruptions.md
- Apple, AudioRecordingIntent: https://developer.apple.com/tutorials/data/documentation/appintents/audiorecordingintent.md
- Apple forums: https://developer.apple.com/forums/thread/815725 , https://developer.apple.com/forums/thread/813278 , https://developer.apple.com/forums/thread/698253
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Android, FGS types: https://developer.android.com/develop/background-work/services/fgs/service-types
- Android, restrictions on starting FGS from the background: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- Android, FGS timeouts: https://developer.android.com/develop/background-work/services/fgs/timeout
- Android, exact alarms: https://developer.android.com/about/versions/14/changes/schedule-exact-alarms
- Android, Doze and App Standby: https://developer.android.com/training/monitoring-device-state/doze-standby
- Android, background activity starts: https://developer.android.com/guide/components/activities/background-starts
- Android 14 behavior changes (full-screen intents): https://developer.android.com/about/versions/14/behavior-changes-14
- Android, sensors overview: https://developer.android.com/develop/sensors-and-location/sensors/sensors_overview
- Google Play, FGS requirements: https://support.google.com/googleplay/android-developer/answer/13392821
- Expo audio docs (SDK 57): https://docs.expo.dev/versions/latest/sdk/audio.md ; changelog: https://raw.githubusercontent.com/expo/expo/main/packages/expo-audio/CHANGELOG.md
- Expo notifications docs: https://docs.expo.dev/versions/latest/sdk/notifications.md
- react-native-audio-api: https://docs.swmansion.com/react-native-audio-api/docs/inputs/audio-recorder , https://github.com/software-mansion/react-native-audio-api
- @siteed/audio-studio: https://github.com/deeeed/audiolab
- SnoreLab: https://www.snorelab.com/how-snorelab-works
- DontKillMyApp: https://dontkillmyapp.com/
- npm registry (versions/dates via `npm view`): expo, expo-audio, expo-notifications, expo-sensors, expo-battery, react-native-audio-api, @siteed/audio-studio, react-native-live-audio-stream, react-native-background-actions
- Repo files read for this plan: `CLAUDE.md`, `docs/PRD.md`, `docs/PLAN.md`, `docs/SOURCES.md`, `model/MODEL_CARD.md`, `src/types/{audio,evidence}.ts`, `src/audio/{constants,analyze,quality,loudness,quietGaps,bandwidth,modelHook}.ts`, `src/audio/features/{index,logmel,frame,resample}.ts`, `src/audio/model/infer.ts`, `src/evidence/{audioState,rules,input,engine}.ts`

## Appendix B. Things deliberately not asserted

No battery-hours figure, no sleep-estimate accuracy, no overnight snore-detection accuracy, no claim that any library works for 8 hours before M1/M2 hardware tests, no claim about Shortcuts/Focus automation behavior, no claim that Android alarm-launched full-screen-intent activities can start the microphone FGS.

---

## Review amendments

Source: gstack `/plan-eng-review` run on this document on 2026-10-11 (non-interactive: the caller asked for findings only, so the skill's interactive decision briefs, review log and ledger were not run and no decision here was approved by the user; all items below are recommendations pending orchestrator/user sign-off). Scope Challenge, Architecture, Code quality, Test and Performance sections were applied by hand against the repo files named in Appendix A. Where an amendment (ER-n below) conflicts with earlier text, the amendment wins.

### Scope challenge (what already exists, what is too much)

Reused as-is: `createModelHook`, `scoreWindow`, `windowFeatures`, `rmsDbfs`, `BandwidthEstimator`, `audioStateFrom`/`matchRule`/`evaluate`/`buildRulesInput`, `generate()`, `content/claims`, `activeInstrument`. Genuinely new: streaming pipeline, epoch aggregation, sleep-state machine, night adapter, native capture glue, schedule/notification, native screens. The plan is about 30 focused hours of device-dependent work for a 1 to 3 day window, so the schedule is the main engineering risk, not the design. Smallest complete slice that still proves the idea: M0, M1, M2 (capture + epochs), a thin M3 (state + evidence), and one real night. Everything else is cuttable in the order of section 13.

### ER-1 (critical path): do not make night 1 depend on a finished model pipeline

Finding: audio is never stored, so a night recorded before M2 is complete cannot be re-analyzed later; a bug in the gate, threshold or sleep rules found on Day 2 wastes night 1.
Amendment: M2 persists, per scored window, the 80-d `windowFeatures` vector quantized to int8 (about 4.6 MB per 8 h night) in the user's own tuning builds, with an in-app toggle, a "developer data" label, auto-delete after 7 days, and the same delete button. The vector is the existing per-band mean/std of log-mel over 1 s; it cannot reconstruct speech, but the consent text still states that it is stored. With it, gate level, model threshold, episode rule and sleep rules can all be replayed offline (`scripts/night-replay.ts` accepts either a WAV or a feature file). This supersedes "optional/stretch" in sections 6, 9 and 11. Raw audio retention stays out of scope. A capture-only fallback build (levels + epoch aggregates + feature retention, no on-device scoring) is acceptable for night 1 if the MLP path is not ready.

### ER-2 (schedule): parallelize device-independent work

Finding: the plan is written as a serial chain, but `src/night/` is pure TypeScript and testable in Node with no device.
Amendment, three lanes from hour 0:
- Lane A (device, serial): M0 -> M1 -> M4 (permissions, signing, builds, notification, locked-screen tests). Wall-clock waiting (30 min locked tests, soak) overlaps lane B.
- Lane B (pure TS, Node): M2 pipeline, M3 estimator/adapter/aggregation, `night-replay`, `build-sample-night`. Needs only the frozen contracts and existing core.
- Lane C (content/UI): claims + forbidden-phrase extension, native component skeletons against fixtures, demo runbook.
Add a time buffer: M0 +2 h (first Xcode signing, prebuild, native compile are 15 to 30 min each; free-team provisioning quirks), M1 +1 h. Revised totals: about 34 h across lanes, about 3 days for one engineer, about 2 days with subagents running lane B and C.

### ER-3 (correctness): fix the gate granularity and the denominator

Finding 1: the plan gates per second but the model's window grid is 1 s windows on a 0.5 s hop (`WINDOW_HOP_SEC`), and `analyze.ts` computes quiet windows from 0.5 s half-block energies. A per-second gate would misalign with that grid and break the bit-parity test.
Amendment: evaluate the gate per 0.5 s half-block, window-open = `max(SILENCE_FLOOR_DBFS, rollingFloor + GATE_DB)` exceeded by the window RMS built from its two half-blocks (same arithmetic as `analyze.ts`). The streaming scheduler must emit windows at t0 = k x 0.5 s from capture start with zero-padded `frameWindow` edges exactly as `createModelHook` does.
Finding 2: section 10.1 counts gate-off windows as non-snore-like in the denominator. That contradicts PLAN Amendment 2 ("too quiet" windows are excluded and never reported as "no snore") and would let an unscored window read as a negative.
Amendment: gate-off windows are excluded from the scored denominator exactly like too-quiet windows and reported as `belowGate` ("not analyzed"). The night rule uses absolute quantities rather than the fraction, so it does not depend on how aggressive the gate is: `snore-like-observed` iff episodes >= `NIGHT_MIN_EPISODES` AND total flagged seconds inside episodes >= `NIGHT_MIN_EPISODE_SEC`. The adapter still fills `AudioAnalysis.snoreLikeFraction` (episode-qualified flagged / scored windows) for display and report compatibility, but the night state is decided by `nightAudioState`, not by `audioStateFrom`. Replace the provisional `NIGHT_SNORE_FRACTION_OBSERVED = 0.02` with `NIGHT_MIN_EPISODE_SEC = 120` (provisional, to be tuned only on the sample night and the user's own nights).

### ER-4 (correctness): night quality thresholds are not the clip thresholds

Finding: `QUALITY_THRESHOLDS` (`unusableSilenceRatio` 0.95, `marginalNoiseFloorDb` -35, duration 120 s) were set for 10 to 20 minute clips. A quiet bedroom with a phone mic may sit near or below the `-72 dBFS` floor for most of the night and would be judged `unusable` ("almost entirely silent") for a reason unrelated to quality.
Amendment: `src/night/constants.ts` defines `NIGHT_QUALITY` separately (digital-silence gaps, clipping %, capture coverage, a night noise floor reported not gated). M1 logs the demo room's per-second level distribution on the actual phone and the iOS processing mode; thresholds are set from that and written down. Constant-loud nights (TV, fan at high level) are `not-assessed` by a documented rule (p10 level above a named ceiling for most of the night), not by the clip silence ratio.

### ER-5 (platform): timing and lifecycle details the plan glossed over

1. Scheduled stop must not rely on `setTimeout`. Decide end of capture inside the audio buffer callback using the buffer's wall-clock and monotonic timestamps (JS timers in a backgrounded app are not guaranteed). Durations use the monotonic clock; wall clock is for labels only (time zone change, NTP jump, DST on the schedule). Add tests with a fake clock.
2. Cold start from the bedtime notification: the response arrives after launch; use the "last notification response" API as well as the listener, and start capture only once the app is `active`. Never let the audio library or `AppState` handlers activate/deactivate the iOS session after the app backgrounds (Apple DTS: activate only in the foreground; the 50 s SIGKILL thread suggests session churn is the failure to avoid). M1 logs every session event.
3. Do not install two audio libraries that each add a microphone foreground service/background mode to the same dev build (duplicate services, manifest merge conflicts). Spike alternatives in separate branches or build profiles.
4. `react-native-audio-api` lists `react-native-worklets >= 0.7.0` as a peer dependency (checked with `npm view`); M0 must confirm it resolves and builds on Expo SDK 57 (React Native 0.87.x line) before any other work depends on it. If it does not, switch to the `expo-audio` stream immediately rather than debugging the integration.
5. Optional: schedule a single "your overnight summary is ready" local notification at the wake time as a safety net; it also tells a user whose process was killed to open the app. Do not try to detect kills with a per-epoch rescheduled notification (it would wake the user).
6. iOS Low Power Mode and Android battery saver behavior with an active audio session is unverified; M2's soak covers it with both on.

### ER-6 (tests): additions to every milestone's test plan

- Streaming-vs-batch parity must cover the window grid, edge zero-padding (each window's frames 0 and 99 are zero-padded and therefore never reusable; a window's interior frames 51 to 98 equal the next window's frames 1 to 48 exactly, and the reuse test asserts this), gate on and off, chunk boundaries at arbitrary buffer sizes (feed the same signal in 1 s, 0.37 s and 4 s buffers and require identical output).
- Sparse mel must be tested against the dense implementation with random spectra, not just the sample file.
- Long-run test: 8 h synthetic signal through the Node pipeline (estimated minutes; mark as an opt-in script) plus a 30 min variant in the normal suite. Assert bounded memory and linear time.
- Persistence: truncated last JSONL line, duplicated epoch index after a crash, power-cut between manifest and epoch writes, schema version bump.
- Estimator: scripted scenarios (reading in bed with charging and no motion must be `uncertain` or `asleep` per spec but never produce a conclusion change; phone picked up; TV on; snore-dominated epoch classified by other signals; every signal unavailable).
- Property test across NoSAS x symptoms x red flag x all six night states x single/multi-night proving the conclusion never decreases relative to no audio (ER invariant 8.5.1), and that `isSynthetic` sample nights never influence `input.audio`.
- Privacy tests: file-system diff (no audio-like file; no file larger than a bound), no network symbols in `mobile/src`, delete removes epochs, manifest, feature files and cancels notifications.
- Purity test must also forbid Expo/React Native imports inside `src/night`.
- Accessibility: timeline has a text alternative; patterns do not depend on color; Dynamic Type at the largest sizes.

### ER-7 (code quality)

- Single source for constants: `src/night/constants.ts` re-exports `SAMPLE_RATE`, `WINDOW_SEC`, `WINDOW_HOP_SEC`, `SILENCE_FLOOR_DBFS` from `audio/constants` and never redefines them.
- The mobile app has no business logic beyond glue: capture controller, file writer, notification scheduling, screens. All thresholds, state machines and mapping stay in `src/night` so they are tested in Node.
- Version everything persisted: `nightHeuristicsVersion`, `epochSchemaVersion`, `modelVersion`; summaries are always recomputed from epochs, never stored, so a heuristic fix applies to old nights.
- Do not add a database. Append-only JSONL plus a manifest is enough for 960 lines per night.

### ER-8 (performance and battery)

- The Hermes cost numbers remain estimates. M0 must publish a measured "ms per 1 s window, current code, and after sparse mel + frame reuse" so the budget can be checked before the gate design is finalized.
- Enforce the overload policy with a test (inject a slow processor; queue never exceeds 60 s; skipped audio is recorded as a gap).
- Android: M1 must test whether an active microphone FGS keeps the CPU running with the screen off and Doze forced (`dumpsys deviceidle force-idle`); only if not, add a small native partial wake lock (about 30 lines Kotlin module).

### Failure modes (new per codepath, with the planned handling)

| Codepath | Realistic failure | Test | Handling | User sees |
|---|---|---|---|---|
| Notification tap -> start | Notification not delivered (Focus/DND, exact alarm denied) | device checklist | In-app "Start now"; permission flow; docs | Nothing at bedtime, manual start works |
| Capture | Interrupted by call/alarm and not resumable (I6) | M1 interruption test | End night as `interrupted`, remaining hours "not captured" | Clear "ended at HH:MM" |
| Capture | OS kills process | M2 kill test | Recover partial night | "Recording ended unexpectedly" |
| Pipeline | Hermes too slow, queue grows | overload test | Skip + gap | "Part of the night not analyzed" |
| Estimator | All optional signals missing | scenario test | Mostly `uncertain` | Signals-used line shows what was missing |
| Evidence mapping | Over-flagging by false positives | episode rule + sample-night tuning | Can only raise to discuss-with-clinician; copy has the precision caveat | "Snore-like pattern observed; snoring alone does not mean sleep apnea" |
| Persistence | Disk full / write error | injected error test | End night `storage-error`, keep what exists | Partial night, clearly labeled |

Critical gaps (no handling AND no test AND silent): none after amendments ER-1 to ER-8. The two highest-residual items are device-only and cannot be fully tested in Node: lock-screen survival and OEM killing.

### NOT in scope (confirmed)

Validation of the sleep estimate or the snore model on overnight phone audio; any apnea event, airflow, severity or probability output; store submission; push notifications or any server; wearable import; Android zero-tap beyond the labeled experiment; speaker identification or speech transcription; raw audio retention.

### Updated milestone hours (replaces the per-milestone hours in section 11; acceptance criteria unchanged except as amended above)

M0 5 h, M1 5 h, M2 6 h (feature retention included), M3 4 h, M4 4 h, M5 5 h (lite 2 h), M6 3 h. Lane B work (M2 pipeline core, M3) can start at hour 0 and finish before M1's device results arrive.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| Eng Review | /plan-eng-review | Lock in architecture, tests and schedule before building | 1 | DONE_WITH_CONCERNS (non-interactive; recommendations only) | 8 amendments (ER-1 to ER-8): feature retention for night-1 tuning, three parallel lanes, gate granularity and denominator fix, night-specific quality thresholds, lifecycle/timing details, expanded tests, code-quality rules, perf checks. 0 critical gaps remaining after amendments. |

VERDICT: ENG REVIEW PASSED WITH AMENDMENTS. OUTSIDE COVERAGE / CROSS-MODEL: not run (non-interactive subagent invocation).

**UNRESOLVED DECISIONS:**
- Q6 (src/night/ location), Q7 (permission to refactor `import.meta.glob` sites), and approval of ER-1 (storing int8 window features in the user's own tuning builds) need the user's decision.

---

## ADDENDUM 2026-10-14: sleep-state filter audit, coverage view, diagnostics

**Question audited:** can the (unvalidated) sleep-state estimate hide useful audio?
**Test:** `src/night/sleepFilterAudit.test.ts` (uses the existing testkit).

Findings:

1. Uncertain time is already counted by default. The headline, the night state and the episode rule use the "including uncertain" set, and that set includes the first 10 minutes ("onset-pending") of a night.
2. Epochs the estimate labels likely-awake inside the scheduled window (screen on, handling the phone, 10 s or more of motion) were not counted. Snore-like windows there were silently left out of the totals.
3. Worst case: the app left on screen all night makes every epoch likely-awake. Nothing is assessable by the old rule, so the night read as not-assessed although the whole night was recorded and scored.

Decision: the verdict rules were **not** changed. They are unvalidated either way, and changing what counts as snore-like on a hunch would be a new, untested claim. Instead:

- `NightSummary.sensitivity.allInWindow` (new, additive) counts every captured epoch inside the scheduled window, whatever the estimate says.
- Night detail shows, under Details, how many more snore-like windows were found in time the phone guessed was awake ("They are not in the totals above, but they were not discarded").
- The estimate is now secondary: recording duration and coverage are the primary facts, and the estimate sits under "Rough estimate (unvalidated)".

Coverage view (`src/mobileLogic/coverage.ts`): four kinds of time, never merged or graded: recorded and assessable, recorded but not assessable, not recorded (gap), outside the sleep hours. "Assessable" means the share of an epoch's windows the snore model could score. It does not depend on the sleep estimate. A bar is drawn as assessable once a quarter of its recorded time was scored, because most windows in a quiet room sit under the level gate and a majority rule would hide real stretches of analysed time. "Nothing snore-like was found in the assessable time" and "Could not assess" are separate sentences, and neither reads as "all clear".

Diagnostics and the test protocol: `mobile/DEVICE_TEST.md`. Privacy promises and their status: `docs/PRIVACY_CHECKS.md`. Reproducible release check: `npm run release:check`, output in `docs/releases/`.
