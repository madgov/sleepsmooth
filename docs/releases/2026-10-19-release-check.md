# Release check 2026-10-19

Run at 2026-10-19 21:07 local time. Commit 9a6d0bb plus uncommitted changes. Command: `npm run release:check`.

**Result: all executed steps passed.** Passing here means the build gates passed. It says nothing about how the app behaves on a phone: every device claim is NOT VERIFIED until the table at the end is filled in.

| Step | Result | Time |
|---|---|---|
| Root typecheck (npm run typecheck) | PASS | 8s |
| Root lint (npm run lint) | PASS | 24s |
| Root tests (npm test) | PASS | 74s |
| Web build (npm run build) | PASS | 9s |
| Forbidden-phrases test | PASS | 4s |
| docs/CLINICAL_REVIEW_PACKET.md is up to date with the source copy (npm run docs:clinical) | PASS | 1s |
| Mobile typecheck (cd mobile && npx tsc --noEmit) | PASS | 8s |
| Expo export for iOS (npx expo export --platform ios) | PASS | 44s |
| Expo dependency check (npx expo install --check) | PASS | 1s |
| Model files the app bundles (v1 JSON, v3 head JSON, YAMNet TFLite) match model/MODEL_CARD.md (version, hash, metrics) | PASS | 0s |

## Output (last lines of each step)

### Root typecheck (npm run typecheck): PASS

```
> sleepsmooth@0.0.0 typecheck
> tsc --noEmit
```

### Root lint (npm run lint): PASS

```
> sleepsmooth@0.0.0 lint
> eslint .
```

### Root tests (npm test): PASS

```
> sleepsmooth@0.0.0 test
> vitest run


[1m[30m[46m RUN [49m[39m[22m [36mv5.0.3 [39m[90m/Users/maadhavgovil/Sleep Apnea[39m


[2m Test Files [22m [1m[32m78 passed[39m[22m[90m (78)[39m
[2m      Tests [22m [1m[32m1356 passed[39m[22m[90m (1356)[39m
[2m   Start at [22m 21:05:07
[2m   Duration [22m 73.21s[2m (environment 47%, tests 47%, import 4%, transform 2%)[22m

[2mEnvironment [22m [33mjsdom was created 78 times[39m[2m · 224.53s total, 47% of tracked time[22m
[2m            [22m [2mcreate it once per worker with [22m[33mpool: 'vmThreads'[39m[2m (keeps per-file isolation) or [22m[33misolate: false[39m[2m (shares it across files)[22m
[2m            [22m [2mlearn more: https://vitest.dev/guide/improving-performance#test-environments[22m
```

### Web build (npm run build): PASS

```
> sleepsmooth@0.0.0 build
> tsc --noEmit && vite build

[36mvite v8.3.4 [32mbuilding client environment for production...[36m[39m
transforming...
✓ 119 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                      1.81 kB │ gzip:   0.86 kB
dist/sw.js                           3.42 kB
dist/assets/parity-hLjHNuKS.mp3     48.94 kB
dist/assets/parity-4Ca6RDhA.m4a     49.15 kB
dist/assets/worker-N0HqG8J5.js      63.89 kB
dist/assets/index-CR3Hmm9w.css      24.50 kB │ gzip:   6.00 kB
dist/assets/InfoViews-G9WqtFvc.js    1.89 kB │ gzip:   0.71 kB
dist/assets/index-BNJyhPOX.js      390.22 kB │ gzip: 135.38 kB
dist/assets/Parity-QyFayjHY.js     435.16 kB │ gzip:  56.31 kB

[32m✓ built in 549ms[39m
```

### Forbidden-phrases test: PASS

```
[1m[30m[46m RUN [49m[39m[22m [36mv5.0.3 [39m[90m/Users/maadhavgovil/Sleep Apnea[39m


[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m44 passed[39m[22m[90m (44)[39m
[2m   Start at [22m 21:06:30
[2m   Duration [22m 3.05s[2m (import 53%, environment 40%, transform 6%, tests 1%)[22m
```

### docs/CLINICAL_REVIEW_PACKET.md is up to date with the source copy (npm run docs:clinical): PASS

```
docs/CLINICAL_REVIEW_PACKET.md is up to date (246 lines).
```

### Mobile typecheck (cd mobile && npx tsc --noEmit): PASS

```
(no output)
```

### Expo export for iOS (npx expo export --platform ios): PASS

```
assets/models/yamnet_float32.tflite (16MB)
node_modules/expo-router/assets/arrow_down.png (9.5KB)
node_modules/expo-router/assets/error.png (469B)
node_modules/expo-router/assets/file.png (138B)
node_modules/expo-router/assets/forward.png (188B)
node_modules/expo-router/assets/pkg.png (364B)
node_modules/expo-router/assets/react-navigation/elements/back-icon-mask.png (653B)
node_modules/expo-router/assets/react-navigation/elements/back-icon.png (4 variations | 566B)
node_modules/expo-router/assets/react-navigation/elements/clear-icon.png (4 variations | 425B)
node_modules/expo-router/assets/react-navigation/elements/close-icon.png (4 variations | 235B)
node_modules/expo-router/assets/react-navigation/elements/search-icon.png (3 variations | 582B)
node_modules/expo-router/assets/sitemap.png (465B)
node_modules/expo-router/assets/unmatched.png (4.8KB)
node_modules/react-native-audio-api/src/Audio/controls/icons/pause.png (465B)
node_modules/react-native-audio-api/src/Audio/controls/icons/play.png (658B)
node_modules/react-native-audio-api/src/Audio/controls/icons/speaker-x.png (725B)
node_modules/react-native-audio-api/src/Audio/controls/icons/speaker.png (565B)

› ios bundles (1):
_expo/static/js/ios/entry-6e61d465cf193e5936c59cf39546e11b.hbc (4.9MB)

› Files (1):
metadata.json (1.9KB)

Exported: /var/folders/y0/7k9wwn1s5xg0z_cfv5qwh2800000gp/T/sleepsmooth-export-mOGj1G
```

### Expo dependency check (npx expo install --check): PASS

```
Dependencies are up to date
```

### Model files the app bundles (v1 JSON, v3 head JSON, YAMNet TFLite) match model/MODEL_CARD.md (version, hash, metrics): PASS

```
ok   mobile imports src/audio/model/model.json (from mobile/src/capture/controller.ts, mobile/src/debug/runModelCheck.ts)
ok   mobile imports src/audio/model/model.v3.json (from mobile/src/capture/yamnetScorer.ts)
ok   src/audio/model/model.json: version sleepsmooth-snore-mlp-esc50-0.1.0, weightsHash c8d009574772... matches the card
ok   src/audio/model/model.v3.json: version sleepsmooth-snore-yamnet-logreg_scores-0.3.0, weightsHash a2d153876ad8... matches the card
ok   mobile/assets/models/yamnet_float32.tflite: sha256 c318dadf42d4... (15,973,484 bytes) matches the card
ok   the model card screen shows hand-written V1_EVALUATION numbers, pinned to model/MODEL_CARD.md by modelCardInfo.test.ts, for sleepsmooth-snore-mlp-esc50-0.1.0
ok   the model card screen shows hand-written V3_EVALUATION numbers, pinned to model/MODEL_CARD.md by modelCardInfo.test.ts, for sleepsmooth-snore-yamnet-logreg_scores-0.3.0
```

## Device tests

Copied from `mobile/DEVICE_TEST.md`. Fill in on the device and keep this file with the release. "Not run" means no claim is made.

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
