# App Store review readiness

Status: DRAFT for the user. Nothing here has been submitted. Guideline text was read from https://developer.apple.com/app-store/review/guidelines/ on 2026-10-15 (the first ~100,000 characters; the page is longer). Re-read the live page before submitting; Apple changes it often. Not legal advice; see `docs/REGULATORY_POSITION.md`.

## 1. Technical configuration (all through `mobile/app.json`, `mobile/app.config.js` and `mobile/plugins/*`, so it survives `expo prebuild`)

| Item | Where | Value | Status |
|---|---|---|---|
| Privacy manifest | `app.json` `ios.privacyManifests` (merged into `PrivacyInfo.xcprivacy` by Expo's prebuild) | `NSPrivacyTracking` false; no tracking domains; `NSPrivacyCollectedDataTypes` empty; required-reason APIs below | Present in `npx expo config --type introspect`. The generated `.xcprivacy` file in `ios/` is **NOT VERIFIED** until a prebuild is run (not run in this pass) |
| `ITSAppUsesNonExemptEncryption` | `ios.infoPlist` | `false` | Present. Assumes the app and its libraries use only encryption that is exempt (for example HTTPS or OS-provided). **NOT VERIFIED:** the user must confirm the export-compliance answer in App Store Connect |
| Microphone string | `ios.infoPlist.NSMicrophoneUsageDescription` and the `react-native-audio-api` plugin prop `iosMicrophonePermission` (kept identical) | "SleepSmooth uses the microphone during the sleep hours you set, to notice snore-like sounds and show you a summary of your night. The analysis runs on this iPhone." | Names the purpose and when. Does not say "nothing is uploaded" because that is NOT VERIFIED (`CLAIMS_VERIFIED.noUploadNoTrackingVerified` is false) |
| Motion string | `plugins/withMotionUsage.js` | "SleepSmooth reads how long your iPhone was still overnight, only when you tap Find my routine, to suggest your usual sleep hours." | Already specific; unchanged |
| Notifications | No Info.plist key exists for notifications; iOS asks at runtime | Local notifications only (`plugins/withoutPushEntitlement.js` removes `aps-environment`) | n/a |
| HealthKit | `plugins/withHealthKit` (flag `healthkit` in `app.json`, **false**) | When on: entitlement plus `NSHealthShareUsageDescription` (read only). No `NSHealthUpdateUsageDescription` because the app never writes to Health | Flag off, so no HealthKit entitlement or string ships. If turned on, 5.1.3 applies and the privacy policy and label must be updated first |
| Background mode | `ios.infoPlist.UIBackgroundModes: ["audio"]` | See section 3 (2.5.4) | Justified: overnight recording with the screen locked. Locked-screen operation is **NOT VERIFIED on a device** (`DEVICE_TEST.md` Test 1) |
| Live Activity | `plugins/withLiveActivity` (`NSSupportsLiveActivities` true, frequent updates false) | Local-only; no push, no App Group | Widget extension id is `<bundle id>.LiveActivity` |
| App Intents / Shortcuts | `plugins/withAppIntents` | Start/stop recording shortcuts | Describe in review notes (2.3.1) |
| Display name | `app.json` `name` | "SleepSmooth Overnight" | TODO user: confirm the store name (see `APP_STORE_LISTING.md`) |
| Bundle ID | dev: `com.sleepsmooth.overnight.dev` in `app.json`. Production: `APP_VARIANT=production` in `mobile/app.config.js` | `com.sleepsmooth.overnight` (or `SLEEPSMOOTH_BUNDLE_ID`) | Production id is a **placeholder**: the user must register the real id in their Apple Developer account. The Live Activity id follows automatically. Unset `APP_VARIANT` leaves the dev build unchanged |
| Icon | `mobile/assets/icon.png` | 1024x1024 PNG, 8-bit RGB (no alpha channel), checked with `file` | OK on format. **Art quality/branding NOT reviewed**; the user decides if it is final |
| Splash | `expo-splash-screen` plugin with `assets/splash-icon.png` (1024x1024, colormap) | Present, default config | Exists. Not reviewed visually |
| Android assets | adaptive icon files exist | n/a for iOS | Not in scope |

### Required-reason APIs (`NSPrivacyAccessedAPITypes`)
Declared at app level in `app.json`:

| Category | Reasons | Why |
|---|---|---|
| UserDefaults | `CA92.1` (read/write info only accessible to the app itself) | Our own Swift code stores a small pending-command JSON in `UserDefaults.standard` (`modules/sleepsmooth-live-activity/ios/SleepSmoothAutomationModule.swift`, `plugins/withAppIntents/*.swift`). React Native and `expo-notifications` also ship manifests with the same reason |
| File timestamp | `C617.1` (files inside the app container), `3B52.1` (files the user gave the app) | The app reads and writes its own files through `expo-file-system` (night store, settings, clips). React Native and `expo-file-system` ship their own entries. The app's own JS does not read modification dates directly (searched `mobile/src`, `mobile/app`); declared because frameworks used by the app can |
| System boot time | `35F9.1` (measure elapsed time) | `expo-application`, `expo-constants` and React Native timing code; Expo's default template includes it. Our own code does not read boot time directly (searched) |
| Disk space | `E174.1` (check free space before writing), `85F4.1` (show it to the user) | `expo-file-system` ships both reasons. The app's own code does not call a disk-space API (searched); the Settings clip-size estimate is computed from clip counts, not from free space |

Packages in the dependency tree ship their own `PrivacyInfo.xcprivacy` (confirmed present in `node_modules` for `expo-file-system`, `expo-notifications`, `expo-constants`, `expo-application` and React Native). **NOT VERIFIED:** whether `react-native-audio-api`, `react-native-reanimated`, `react-native-screens` and others ship one, and whether the final archive's aggregated manifest passes Apple's validation. Xcode's "Generate Privacy Report" on a real archive is the check.

### Dev-only code in production builds
| Item | State |
|---|---|
| `(dev)/gallery.tsx`, `(dev)/recording-preview.tsx` | Redirect home when `__DEV__` is false. Settings row shown only when `__DEV__` |
| `(dev)/lab.tsx` and the "Developer: device lab" row | Available in dev, and in release **only** when built with `EXPO_PUBLIC_DEVICE_LAB=1`. `app.config.js` now throws if `APP_VARIANT=production` and `EXPO_PUBLIC_DEVICE_LAB=1` are both set |
| `devParams` (`?pauses`, `?scheme`-style web switches, stress nights, font scale) | Gated by `__DEV__` and web-only (`mobile/src/dev/devParams.ts`). `useTheme.tsx` reads `?scheme` on web only |
| Web `?parity` | Gated by `import.meta.env.DEV` in `src/App.tsx` |
| Sample night / sample clips | Allowed, labelled "Sample" (see section 3, 2.1) |
| Metro, dev client | `expo-dev-client` is in the plugin list. A production build should be a Release configuration archive, not a dev client. **NOT VERIFIED** by an actual archive |

### Release checklist (user)
1. Register the bundle ids; set `APP_VARIANT=production`; run `npx expo prebuild --platform ios --clean`; confirm `PrivacyInfo.xcprivacy` exists in `ios/SleepSmoothOvernight/` and the app target.
2. Do **not** set `EXPO_PUBLIC_DEVICE_LAB`.
3. Archive in Release; run Xcode "Generate Privacy Report"; compare to section 4 of this file.
4. Host `public/privacy.html` and `public/support.html`; set `SITE_BASE_URL` in `src/content/claims.ts`; fill every TODO in both pages.
5. Run the device tests in `mobile/DEVICE_TEST.md` and only then consider flipping `CLAIMS_VERIFIED` flags.
6. Resolve counsel questions in `REGULATORY_POSITION.md` (especially the ESC-50 CC BY-NC dataset licence for a store release).

## 2. Guideline map

| Guideline | What it asks (our reading of the live text) | Evidence in the app | Gaps / NOT VERIFIED |
|---|---|---|---|
| **1.4.1** Medical apps | Medical apps that could give inaccurate information or be used to diagnose "may be reviewed with greater scrutiny". Disclose data and methodology for accuracy claims; no sensor-only blood pressure, temperature, glucose, oxygen or x-ray claims; remind users to check with a doctor; submit clearance documents if cleared | The app makes no diagnosis claim and no accuracy claim about health measurements. Disclaimers: `DISCLAIMER_NOT_DIAGNOSIS`, `DISCLAIMER_SEEK_CARE`, limits panel, "cannot rule out" on every result. Model card (`model-card.tsx`, `claims.ts` MODEL_CARD_*) discloses data (ESC-50 sound-effect clips, 8 test snoring clips), wide ranges, and "not tested on overnight phone recordings". No clearance exists and none is claimed. NoSAS is cited (Marti-Soler et al., 2016). No blood oxygen or breathing measurement is claimed | Reviewer may still treat any sleep-apnea topic as medical. The accuracy of the sound model on real phones is unknown (stated in-app). Counsel review pending |
| **2.5.4** Multitasking | Background services only for intended purposes (VoIP, audio playback, location, task completion, local notifications, similar) | `UIBackgroundModes: audio` so the microphone capture started by the user continues while the screen is locked, as an audio-recording app does. Live Activity shows recording status and has a Stop button. The user starts each night; a morning prompt and a hard maximum length end it. Local notifications only | Locked-screen survival NOT VERIFIED on a device. The reviewer should be told why (notes below) |
| **5.1.1(i)** Privacy policy | Link in App Store Connect and in the app; say what is collected and how, retention and deletion, how to revoke consent | `public/privacy.html`; Settings > About > Privacy policy; web footer link. Deletion: Settings > Delete my data; withdraw consent in Settings | URL placeholder `SITE_BASE_URL` and TODO contact must be filled. The page must be live before submission |
| **5.1.1(ii)** Consent | Get consent before collecting; allow easy withdrawal | `consent.tsx` screen, Settings consent row with withdraw; first-night bystander acknowledgement | None known |
| **5.1.1(iii)** Data minimization | Only relevant data | Questionnaire items are optional and skippable. Audio is not saved by default. Clips opt-in, capped (5 clips, 15 s each per night) | Height, weight, neck, age, sex are health data, collected only because NoSAS needs them. The `NOSAS_ENABLED` flag can remove them |
| **5.1.1(v)** Account deletion | If accounts exist, offer deletion | No accounts exist | n/a |
| **5.1.2** Data use and sharing | No sharing without permission; no tracking without ATT; no repurposing | No tracking (`NSPrivacyTracking` false), no third-party SDKs for analytics or ads (checked by `src/mobileLogic/privacy.test.ts` for packages and our code). Sharing happens only through the iOS share sheet at the user's choice | "No network at runtime" is **NOT VERIFIED on a device** (P4/P5 in `docs/PRIVACY_CHECKS.md`) |
| **5.1.3** Health data | Health, fitness and **Motion & Fitness** data must not be used for advertising, marketing or data mining; no false data to HealthKit; no personal health info in iCloud | No advertising or sharing. HealthKit is off and read-only if enabled; app never writes to Health. Motion history used only on the "Find my routine" tap, on device | iCloud: the app does not use iCloud itself, but files in Documents can be included in a user's iCloud device backup (privacy page says so); night manifests are not excluded from backup (documented in PRIVACY_CHECKS "Known limits"). Counsel/user to decide whether to exclude them |
| **2.1** App completeness | Final build, working URLs, no placeholder text, demo mode accepted if no login | No login. Sample night with sample clips is labelled "Sample" and works without the microphone. Placeholders remain only in `SITE_BASE_URL`, the two pages' TODOs, and the production bundle id | Must be cleared before submission: the app currently says "Prototype for a hackathon" in `FOOTER_TEXT` (web) and settings footer. Decide whether that string should ship |
| **4.2** Minimum functionality | More than a repackaged website; useful, unique | Native recording pipeline with on-device analysis, Live Activity, App Intents/Shortcuts, local reminders, per-night summaries, clip playback, clinician summary export | Reviewer sees a simple utility if the microphone is denied; the sample night covers that |
| **2.3.1** Hidden/undocumented features | Describe features in notes; none hidden | App Intents, Live Activity and the dev lab are all described below. The lab is absent from a normal release build | Keep the lab out of production (see checklist) |

## 3. Notes for App Review (paste into App Store Connect > App Review Information > Notes)

> SleepSmooth is an informational app for adults who snore or sleep badly. It listens to sleep sounds on the user's iPhone during sleep hours they choose, shows a plain summary of snore-like sounds, and helps them prepare questions for a clinician. It does not diagnose, detect or monitor sleep apnea and states on every result that it cannot confirm or rule out sleep apnea. It is not a medical device and makes no accuracy claim about health measurements. There is no login, so no demo account is needed.
>
> **How to test without recording overnight:**
> 1. Open the app, read the intro, accept the consent screen.
> 2. In the Nights tab, tap the row labelled "Sample" to open a synthetic sample night. It is clearly labelled "Sample" and its clips are synthetic tones, not recordings of anyone. You can open Checks, the clinician summary, the model card and the next steps guide from there.
> 3. To see recording, tap "Start tonight" on the Dashboard and allow the microphone when asked. Recording runs for as long as you leave it; stop it any time. A short test (a minute or two) is enough to see a result for that night. The result will likely say that little could be assessed.
> 4. Settings > Privacy has "Delete my data". Settings > About links to the privacy policy and support pages.
>
> **Why background audio:** the app records the room sound throughout the user's sleep hours with the screen locked, like a voice-recorder or sleep-sound app. The user starts each night; a Live Activity on the Lock Screen and Dynamic Island shows that recording is active and has a Stop button; the user is asked in the morning whether to stop and a recording always ends by itself after a fixed maximum. The `audio` background mode is used for nothing else.
>
> **Other features:** Shortcuts/App Intents let the user start or stop a night. Local notifications remind the user at their set bedtime; there is no push notification entitlement. "Find my routine" reads Motion & Fitness history only when tapped, to suggest sleep hours. Apple Health is not used in this build.
>
> **Data:** audio is analyzed on device. By default no audio is saved; users can turn on up to five short clips per night, kept on the phone and deletable in Settings. The app contains no analytics, ads or tracking.
>
> **Health disclaimers:** shown on onboarding, on every result, in the clinician summary and in Settings. Sources and the model card (which states its limits and data) are in Settings > About.

TODO user: replace "Prototype for a hackathon" mention decisions; add a reviewer contact phone and email (App Store Connect requires them).

## 4. Draft answers for "App Privacy" (nutrition label)

Apple's definition (App Store Connect help, paraphrased): "collect" means transmitting data off the device in a way that lets you or your third-party partners access it for longer than needed to service the request in real time. Data processed only on the device and never sent to you or a partner is not "collected". On that reading:

| Question | Draft answer | Reason / caveat |
|---|---|---|
| Do you or your third-party partners collect data from this app? | **No, we do not collect data from this app** | All analysis and storage is on the iPhone; no server, account or analytics SDK. **Must be re-checked** if the privacy-traffic test (`DEVICE_TEST.md`) shows any network use, or if any dependency adds telemetry. This is the team's reading of the definition, not Apple's confirmation |
| If a later build adds any server: Health & Fitness, Sensitive Info | Would be "Yes" with purpose App Functionality, not linked to identity unless an account exists, not used for tracking | Not applicable now |
| Tracking | No. No tracking domains; no ATT prompt | `NSPrivacyTracking` false |
| Data types, if Apple's reviewer disagrees about on-device audio | Audio Data (Other Audio Data), Health & Fitness (Health, Fitness), Sensitive Info: all "not collected" | Keep this table to answer follow-ups |
| Privacy policy URL | `<SITE_BASE_URL>/privacy.html` | TODO user |
| User privacy choices URL (optional) | same page | TODO user |

Manifest consistency: App Privacy answers must match `PrivacyInfo.xcprivacy` (empty collected types, tracking false). They do.

## 5. Age rating (see `APP_STORE_LISTING.md` section 6)
Medical/Treatment Information: answer per Apple's current questionnaire (we recommend the more cautious "infrequent/mild" option, because the app discusses medical conditions and testing). **NOT VERIFIED:** Apple revises this questionnaire; answer it as shown on the day.

## 6. Risks a reviewer may raise, and the planned response
- "Medical diagnosis app": point to the absence of any diagnosis or accuracy claim and the disclaimer wording. Do not describe the app as a screening or detection tool in notes, metadata or screenshots.
- "Metadata mentions sleep apnea": it appears only in disclaimers and as the topic of a clinician conversation.
- "Spam / minimum functionality": show the native recording and Live Activity.
- "Privacy label says no data collected but app handles health data": explain the on-device definition; supply the privacy page and the privacy-checks document.
- Brand/legal: the CC BY-NC dataset note. Resolve before launch.
