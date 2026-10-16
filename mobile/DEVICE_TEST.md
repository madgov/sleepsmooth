# SleepSmooth on-device test protocol

Audience: you, on the Mac that holds this repo, with your own iPhone and a free Apple ID.
Purpose: find out, with a real phone, whether an overnight recording survives a locked screen and ordinary interruptions, and how much of the night ends up assessable.

Status of everything below: **NOT VERIFIED**. No test in this file has been run on a device yet. The numbers in the pass/fail table are provisional engineering targets chosen by the developers (see `DEVICE_CRITERIA` in `src/mobileLogic/diagnostics.ts`). They are not clinical thresholds and nothing in the app presents them as such.

The app records no audio to disk except the optional short sound clips, which are off by default (see `docs/PRIVACY_CHECKS.md`). It is not a medical tool and makes no diagnosis.

## What the app records about each night (the "diagnostics")

Every real night gets a technical record at `nights/<id>/diagnostics.json`. It holds timings only, never audio:

- capture start and stop (one entry per recorder run, so a restart inside a night is visible)
- every recording gap: start, end, and the cause when the app can tell (interruption, route change, recorder error, restarted by the user, app closed or crashed and recovered, audio late, unknown)
- battery percentage, charging state and Low Power Mode at the start and end, and a battery note every 30 minutes
- audio-session events: interruption began or ended, route changes (with the iOS reason), recorder errors, app foreground or background
- resume attempts by the app after an interruption, a route change, a recorder error or coming back to the foreground, and whether each one worked
- how many times the night was closed from its epoch log after the app disappeared (a crash, a force-quit or a reboot)
- audio seconds delivered by the recorder, next to captured seconds counted from the epoch log, and the scheduled sleep hours

Limits you should expect to see:

- iOS reports only "an interruption began" and "ended". A phone call, an alarm, Siri and another app taking the microphone all look the same, so the app labels the cause "Interruption" and you note the real cause yourself in the table below.
- If iOS suspends the app after the recorder stopped, JavaScript timers may not run. The app therefore also retries on the events iOS still delivers (interruption ended, route change, coming back to the foreground). Whether that is enough is exactly what this protocol measures.
- A recorder restart can reset the audio clock. The app measures the gap from the phone clock in that case, so the gap length is accurate to a few seconds, not to the sample.

See it on a night: open the night, then Diagnostics (collapsed by default, real nights only). Tap **Export test log** to share a JSON file through the iOS share sheet. The file contains no audio, no waveform peaks and no feature values. It includes coverage seconds, the diagnostics above, the pass/fail result per criterion, and your clip feedback ("Sounds right" / "Not this sound" and what it was). Send it to the developer or attach it to the results table.

## Pass and fail criteria (provisional)

Applies to a full overnight run on a phone that is unplugged at the start and the end, with Low Power Mode off, unless the scenario says otherwise.

| # | Criterion | Pass | Where to read it |
|---|---|---|---|
| C1 | Captured time as a share of the scheduled sleep hours | at least 95% | Diagnostics, "Captured" and `criteriaResult.capturedPct` |
| C2 | Total gap time inside the scheduled hours | under 2% of the window (about 9 min in 8 h) | Diagnostics, "Gaps" and `criteriaResult.gapPct` |
| C3 | Battery used over about 8 hours, unplugged | at most 15 percentage points | Diagnostics, battery rows and `criteriaResult.batteryDrain` |
| C4 | Recording is back after an interruption ends | within 60 s of "interruption ended" | Event list in the exported log (`interruption-ended` then `resume-ok` or the next epoch) |
| C5 | The night is closed correctly after a force-quit or crash | The night appears in Nights with the correct end time, "Recovered" counted at least 1, no audio kept | Diagnostics, "Recovered after a crash or kill" |
| C6 | No audio is written outside the clips folder | No audio-like files outside `nights/<id>/clips/` | Files app or Xcode container download |

C3 is only evaluated when both ends are "unplugged". If the app says "Not enough data" for a criterion, the run does not count for that criterion.

## Setup

Do Setup A to E once. They are the same for every test below.

## Setup A. Fix the Mac first (blocking, found during the simulator attempt)

Xcode 26.1.1 on this Mac reports "iOS 26.1 is not installed" for every iOS destination (simulator and "Any iOS Device"), so no iOS build, simulator or device, can run yet. Only an iOS 26.0.1 simulator runtime is installed (9.4 GB), and the disk has about 9 GB free.

1. Free space. You want at least 20 GB free before downloading. Candidates: the old iOS 26.0.1 runtime (Xcode > Settings > Components, or `xcrun simctl runtime list` then `xcrun simctl runtime delete <id>`), `~/Library/Developer/Xcode/DerivedData`, Downloads, Trash.
2. Xcode > Settings > Components > iOS 26.1 > Get. (CLI equivalent: `xcodebuild -downloadPlatform iOS`.) This is a multi-GB download from Apple.
3. Confirm it worked: `xcodebuild -showdestinations -project "mobile/ios/SleepSmoothOvernight.xcodeproj" -scheme SleepSmoothOvernight` should now list simulators and "Any iOS Device".
4. Your iPhone's iOS version must be one this Xcode supports (iOS 26.1 or older). If the phone is on a newer iOS, update Xcode first.

Also run once, in a terminal: `cd "mobile" && npm install` (only needed if `mobile/node_modules` is missing).

## Setup B. Prepare the iPhone

1. Connect the iPhone to the Mac with a cable. Unlock it and tap Trust when asked ("Trust This Computer"), then enter the passcode.
2. Enable Developer Mode: Settings > Privacy & Security > Developer Mode > on. The phone restarts. After the restart, unlock it and confirm "Turn On". (The Developer Mode switch only appears after the phone has been connected to Xcode once; if it is missing, open Xcode with the phone connected, wait for "Preparing device", then look again.)
3. Optional but recommended for the first test: turn Low Power Mode off, and plug the phone into a charger for the 30 minute test so battery is not a variable.

## Setup C. Sign in to Xcode with the free Apple ID

1. Xcode > Settings > Accounts > + > Apple ID. Sign in with your Apple ID (a free one is fine; no paid Developer Program needed).
2. Open the workspace: `open "mobile/ios/SleepSmoothOvernight.xcworkspace"` (generated by `expo prebuild`; if the `ios` folder is missing, run `cd mobile && npx expo prebuild -p ios` first).
3. In the left sidebar select the blue project "SleepSmoothOvernight" > target "SleepSmoothOvernight" > "Signing & Capabilities".
4. Leave "Automatically manage signing" ticked. Set Team to "<Your Name> (Personal Team)".
5. Bundle identifier: the app uses `com.sleepsmooth.overnight.dev`. A free account must use an identifier nobody else registered. If Xcode says it "cannot be registered" or "is not available", pick a unique one, for example `com.<yourname>.sleepsmooth.overnight`. Change it in `mobile/app.json` (`expo.ios.bundleIdentifier`) so it survives regeneration, then run `cd mobile && npx expo prebuild -p ios` and reselect the team.
6. To keep the team selected after regeneration, add `"appleTeamId": "<your 10-character team id>"` under `expo.ios` in `mobile/app.json`. (Team id: developer.apple.com > Membership, or Xcode shows it in the team popup details.)
7. Capabilities: this project needs none. Its entitlements file is empty on purpose. Background Modes > Audio is set through Info.plist (`UIBackgroundModes: audio`), which free accounts allow. Do not add Push Notifications, Time Sensitive Notifications, or iCloud; free accounts cannot sign those.

## Setup D. Build and run on the iPhone

Use a Release build for both tests. It embeds the JavaScript bundle (no Metro server needed while the phone is locked) and it is the only configuration whose timing means anything (a Debug/dev bundle is several times slower).

```
cd "mobile"
npx expo run:ios --device --configuration Release
```

Pick your iPhone from the list. The first build takes 10 to 25 minutes (CocoaPods and native compile). If the command stalls on "Waiting for device", unlock the phone and keep it on the Home Screen. Alternative: press Run in Xcode with your iPhone selected as the destination and the scheme's Build Configuration set to Release (Product > Scheme > Edit Scheme > Run > Build Configuration).

## Setup E. Trust the developer certificate on the phone

First launch will fail with "Untrusted Developer". On the iPhone: Settings > General > VPN & Device Management > under "Developer App" tap your Apple ID > Trust > Trust. Then open the app named "SleepSmooth Overnight". Free-account builds stop launching after about 7 days; rebuild (Setup D) to renew. A free account also limits how many apps and app IDs you can sign per week.


## Test 1. Full locked-screen night (baseline)

Goal: C1, C2, C3 over a real night with nothing deliberately going wrong.

1. Charge to at least 90%. Unplug. Turn Low Power Mode off. Leave Airplane mode and Wi-Fi as you normally sleep.
2. Open SleepSmooth. Note the battery percentage and the time in the results table.
3. Start a recording from the app, with the app on screen. Do not start it from the lock screen. Confirm the orange microphone dot is showing.
4. Lock the phone with the side button. Put it on the bedside surface, microphone not covered, not on a charger.
5. Sleep normally. Do not open the app during the night.
6. In the morning: unlock, open SleepSmooth, and look at the night. Note the time and the battery percentage.
7. Open the night, expand Diagnostics, read C1 to C3, and export the test log.

Record whatever you noticed that the app did not: a call or message that woke you, the phone getting warm, the orange dot missing.

## Test 2. Scripted interruptions (about 40 minutes, do them in this order)

Do each one while a recording is running and the phone is locked, unless the row says otherwise. Between scenarios wait at least 2 minutes so each gap stands alone. Write the exact clock time of each action on paper or on another device. A timer on this phone would itself interrupt the recording, so use another device.

| ID | Scenario | What to do | Expected | How to judge |
|---|---|---|---|---|
| I1 | Incoming call | From another phone, call this phone. Let it ring 10 s, then decline. Repeat once and answer for 20 s. | An interruption event, a gap of the call length plus resume time | C4 |
| I2 | Alarm | Set an alarm on this phone for 2 minutes ahead. Let it ring for 20 s, then stop it. | An interruption event, resume after the alarm stops | C4 |
| I3 | AirPods connect | Put AirPods in your ears near the phone so they connect. | A route-change event. Recording continues or resumes | C4. Also check the recording kept using the right microphone |
| I4 | AirPods disconnect | Put the AirPods in the case. | A route-change event. Recording continues or resumes | C4 |
| I5 | Siri | Say "Hey Siri, what time is it" and wait for the answer. | An interruption, then resume | C4 |
| I6 | Low Power Mode | Turn Low Power Mode on in Settings, wait 5 minutes, then turn it off. | A low-power-mode event each way. No gap, or a gap that closes | C2. Note the battery effect separately |
| I7 | Force-quit | Swipe the app away from the app switcher. Wait 1 minute. Open the app again. | Recording stops (iOS ends the app). The night is closed from its epoch log at next launch | C5 |
| I8 | Start from the lock screen | Try to start a recording from a notification while locked. | iOS does not allow it. The app should say so clearly and not pretend to record | Pass if no recording starts and the message is plain |

After the last scenario, stop the recording and export the test log. For each scenario, find its gap in the log (the cause is "Interruption" or "Audio route change", or "App closed" for I7) and compare the gap length with what you did.

## Reading the exported log

- `criteria` echoes the provisional targets that were in force.
- `nights[].diagnostics.gaps[]` has `startMs`, `endMs` and `cause`. `events[]` has the audio-session timeline in order.
- `nights[].coverageSec` has scheduled, recorded in window, assessable, not assessable and not recorded seconds. "Assessable" is audio only: the share of windows the snore model could score. It is not a sleep estimate.
- `nights[].windows.snoreLikeIncludingAwakeGuess` counts snore-like windows in all captured in-window time, including time the unvalidated sleep guess labelled awake.
- `nights[].clipFeedback[]` is your own feedback on saved clips, joined with each clip's category and time.

## Results table (fill in one row per test and per device)

Copy the table into your notes or the release check file. Write **Pass**, **Fail** or **Not run**. "Pass" means the criterion in this file was met with the number written in the cell. Do not write Pass without a number.

<!-- DEVICE-TESTS-TABLE:START -->
| Test | Device and iOS | Date | Scenario | C1 captured % | C2 gap % | C3 battery drain | C4 resume (s) | C5 recovery | Result | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 full night | | | Locked screen, unplugged | | | | | n/a | Not run | |
| I1 incoming call | | | Call declined, call answered | n/a | | n/a | | n/a | Not run | |
| I2 alarm | | | Alarm rings 20 s | n/a | | n/a | | n/a | Not run | |
| I3 AirPods connect | | | Route change | n/a | | n/a | | n/a | Not run | |
| I4 AirPods disconnect | | | Route change | n/a | | n/a | | n/a | Not run | |
| I5 Siri | | | Voice assistant | n/a | | n/a | | n/a | Not run | |
| I6 Low Power Mode | | | On 5 minutes then off | n/a | | n/a | | n/a | Not run | |
| I7 force-quit | | | App swiped away | n/a | | n/a | n/a | | Not run | |
| I8 lock-screen start | | | Try to start while locked | n/a | n/a | n/a | n/a | n/a | Not run | |
<!-- DEVICE-TESTS-TABLE:END -->

## What to send back

1. The exported test log (JSON) for Test 1 and for Test 2.
2. The filled results table, with the phone model and iOS version.
3. Anything odd: the phone got warm, the orange dot disappeared, an alert appeared, the app was gone when you unlocked.
4. If any criterion fails, do not change the targets to make it pass. Say which one failed and by how much.

## Legacy lab screens (M0 model speed, M1 capture spike)

The earlier lab screens still exist at the `(dev)/lab` route. They show in dev builds and, in a Release build, only when the bundle is built with `EXPO_PUBLIC_DEVICE_LAB=1` (Settings > About > "Developer: device lab"). Without that variable a Release build has no way to reach them.

- M0 (model speed): open "M0 Model on device". Bundle must say "Release", Engine "Hermes", "Training-side fixture parity" and "Shared InferenceHook equals direct" must say PASS. Write down the ms per 1 s window. This is a speed check on a public sample clip, not an accuracy check.
- M1 (capture spike): a 30 minute locked-screen run that logs `[GATE]`. Test 1 above replaces it for the overnight question; the spike remains useful for isolating capture from the rest of the app. Tags in its log: GAP_AUDIO (samples really lost), GAP_ARRIVAL (no buffer for over 2 s, possibly a JavaScript delay), INTERRUPTION, ROUTE, DIGITAL_SILENCE, RECORDER_ERROR, SUMMARY, GATE.

## Notes for later milestones (free Apple ID)

- `UIBackgroundModes: audio` and the microphone usage string are plain Info.plist keys, so they work with free signing. Whether audio keeps running with the screen locked is exactly what Test 1 measures: NOT VERIFIED.
- Local notifications do not need a signing capability. The Time Sensitive interruption level does (entitlement `com.apple.developer.usernotifications.time-sensitive`), so it is unavailable; use the normal `active` level and tell the user to allow SleepSmooth through their Sleep Focus.
- Do not touch the iOS entitlements file. Free accounts cannot sign push or iCloud entitlements.
- Builds expire after about 7 days. For the demo day, rebuild the day before.

## Troubleshooting

- "Untrusted Developer": Setup E.
- "Failed to register bundle identifier": change the bundle id (Setup C, item 5).
- "Developer Mode disabled": Setup B, item 2.
- "No profiles for ... were found" or a team error: re-open Settings > Accounts, click Download Manual Profiles, reselect the team.
- Device not listed by `expo run:ios --device`: unlock the phone, replug, tap Trust, and check Xcode > Window > Devices and Simulators shows it as connected.
- Microphone denied earlier: iPhone Settings > SleepSmooth Overnight > Microphone > on.
- Build fails with "iOS 26.1 is not installed": Setup A.
- The app shows a red error screen about Metro: you installed a Debug build; use Release (Setup D).

## Developer lab in Release builds

The M0/M1 spike screens (model check, capture spike) live at the `(dev)/lab` route. They show in dev builds and, in a Release
build, only when the bundle is built with `EXPO_PUBLIC_DEVICE_LAB=1` (Settings > About > "Developer: device lab"). Without that
variable a Release build has no way to reach them.

## Expo Go preview mode (no Xcode needed)

Use this to look at the whole UI on your phone while Xcode is unavailable. It cannot record.

1. Install Expo Go from the App Store (it must support SDK 57).
2. On the Mac: `cd mobile && npm run go` (runs `expo start --go --lan`).
3. Phone and Mac on the same Wi-Fi: scan the QR code with the Camera app.
4. If the phone cannot reach the Mac (guest or corporate Wi-Fi), run `npx expo start --go --tunnel` instead (Expo may offer to install `@expo/ngrok`).

What you get: every screen, the sample night, and the sample clips (labelled "Sample"). Tapping Record or the moon opens a sheet saying recording needs the full SleepSmooth build. No fake recording and no fake data.

What does not work in Expo Go: microphone capture, overnight background audio, the Live Activity, Shortcuts automatic recording (the settings row is hidden), saved clips, clip playback of real clips, and `react-native-audio-api` (it is not bundled in Expo Go; the app never loads it there). Local notifications may work, NOT VERIFIED.

Status: bundles build (`expo export` for ios and web, `expo install --check` clean). Nothing here has been run inside Expo Go on a phone: NOT VERIFIED.

## Automatic recording at bedtime (Shortcuts) and sound clips

All NOT VERIFIED on a device (Xcode cannot build here). After the first real build:
- Settings > Bedtime > Automatic recording > set up the Shortcuts automation. The row says "Set up, not yet seen running" until an intent actually starts a recording, then "Last ran ...".
- iOS 18+ uses an AudioRecordingIntent; iOS 16.4 to 17 falls back to an intent that opens the app. Check that the intent appears in Shortcuts under SleepSmooth.
- Turn on Sound clips in the first-entry primer or Settings, record a short noisy test, and check nights/<id>/clips/ exists and the backup exclusion flag is set (SleepSmoothAutomation.setExcludedFromBackup).
- Worst case storage is about 2.4 MB per night (5 clips x 15 s, 16 kHz, 16-bit mono).
