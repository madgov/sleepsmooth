# Release check 2026-10-15

Run at 2026-10-15 23:38 local time. Commit 945c95c plus uncommitted changes. Command: `npm run release:check`.

**Result: 1 step(s) failed: expo-install-check.** Passing here means the build gates passed. It says nothing about how the app behaves on a phone: every device claim is NOT VERIFIED until the table at the end is filled in.

| Step | Result | Time |
|---|---|---|
| Root typecheck (npm run typecheck) | PASS | 9s |
| Root lint (npm run lint) | PASS | 26s |
| Root tests (npm test) | PASS | 78s |
| Web build (npm run build) | PASS | 10s |
| Forbidden-phrases test | PASS | 5s |
| Mobile typecheck (cd mobile && npx tsc --noEmit) | PASS | 9s |
| Expo export for iOS (npx expo export --platform ios) | PASS | 25s |
| Expo dependency check (npx expo install --check) | FAIL | 2s |
| Model file the app imports matches model/MODEL_CARD.md (version, hash, metrics) | PASS | 0s |

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


[2m Test Files [22m [1m[32m65 passed[39m[22m[90m (65)[39m
[2m      Tests [22m [1m[32m1070 passed[39m[22m[90m (1070)[39m
[2m   Start at [22m 23:36:25
[2m   Duration [22m 76.34s[2m (tests 48%, environment 45%, import 4%, transform 2%)[22m

[2mEnvironment [22m [33mjsdom was created 65 times[39m[2m · 222.20s total, 45% of tracked time[22m
[2m            [22m [2mcreate it once per worker with [22m[33mpool: 'vmThreads'[39m[2m (keeps per-file isolation) or [22m[33misolate: false[39m[2m (shares it across files)[22m
[2m            [22m [2mlearn more: https://vitest.dev/guide/improving-performance#test-environments[22m
```

### Web build (npm run build): PASS

```
> sleepsmooth@0.0.0 build
> tsc --noEmit && vite build

[36mvite v8.3.4 [32mbuilding client environment for production...[36m[39m
transforming...
✓ 89 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                      1.60 kB │ gzip:   0.79 kB
dist/assets/parity-hLjHNuKS.mp3     48.94 kB
dist/assets/parity-4Ca6RDhA.m4a     49.15 kB
dist/assets/worker-N0HqG8J5.js      63.89 kB
dist/assets/index-DBV_6MQK.css      24.01 kB │ gzip:   5.92 kB
dist/assets/InfoViews-DmlMmUWr.js    1.90 kB │ gzip:   0.71 kB
dist/assets/index-BDvk10Ah.js      371.56 kB │ gzip: 129.24 kB
dist/assets/Parity-CcLpZL9D.js     437.89 kB │ gzip:  57.95 kB

[32m✓ built in 594ms[39m
```

### Forbidden-phrases test: PASS

```
[1m[30m[46m RUN [49m[39m[22m [36mv5.0.3 [39m[90m/Users/maadhavgovil/Sleep Apnea[39m


[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m44 passed[39m[22m[90m (44)[39m
[2m   Start at [22m 23:37:53
[2m   Duration [22m 3.40s[2m (import 52%, environment 42%, transform 6%, tests 1%)[22m
```

### Mobile typecheck (cd mobile && npx tsc --noEmit): PASS

```
(no output)
```

### Expo export for iOS (npx expo export --platform ios): PASS

```
› Assets (27):
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
_expo/static/js/ios/entry-8646f2a115f9a4d65e5c0f3fa43ba7b6.hbc (4.8MB)

› Files (1):
metadata.json (1.8KB)

Exported: /var/folders/y0/7k9wwn1s5xg0z_cfv5qwh2800000gp/T/sleepsmooth-export-4vY4CM
```

### Expo dependency check (npx expo install --check): FAIL

```
The following packages should be updated for best compatibility with the installed expo version:
  expo@57.0.29 - expected version: ~57.0.30
  expo-router@57.0.27 - expected version: ~57.0.28
Your project may not work correctly until you install the expected versions of the packages.
Found outdated dependencies
```

### Model file the app imports matches model/MODEL_CARD.md (version, hash, metrics): PASS

```
ok   mobile imports src/audio/model/model.json (from mobile/src/capture/controller.ts, mobile/src/debug/runModelCheck.ts)
ok   version sleepsmooth-snore-mlp-esc50-0.1.0 matches the model card
ok   weightsHash c8d009574772... matches the card prefix c8d009574772
ok   the model card screen shows hand-written v1 numbers (src/audio/modelCardInfo.ts), pinned to model/MODEL_CARD.md by modelCardInfo.test.ts, for sleepsmooth-snore-mlp-esc50-0.1.0
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
