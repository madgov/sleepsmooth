# Release check 2026-10-15

Run at 2026-10-15 02:00 local time. Commit 2b0b4b1 plus uncommitted changes. Command: `npm run release:check`.

**Result: all executed steps passed.** Passing here means the build gates passed. It says nothing about how the app behaves on a phone: every device claim is NOT VERIFIED until the table at the end is filled in.

| Step | Result | Time |
|---|---|---|
| Root typecheck (npm run typecheck) | PASS | 8s |
| Root lint (npm run lint) | PASS | 24s |
| Root tests (npm test) | PASS | 86s |
| Web build (npm run build) | PASS | 9s |
| Forbidden-phrases test | PASS | 4s |
| Mobile typecheck (cd mobile && npx tsc --noEmit) | PASS | 8s |
| Expo export for iOS (npx expo export --platform ios) | PASS | 23s |
| Expo dependency check (npx expo install --check) | PASS | 2s |
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


[2m Test Files [22m [1m[32m63 passed[39m[22m[90m (63)[39m
[2m      Tests [22m [1m[32m690 passed[39m[22m[90m (690)[39m
[2m   Start at [22m 01:57:57
[2m   Duration [22m 84.59s[2m (tests 52%, environment 42%, import 4%, transform 2%)[22m

[2mEnvironment [22m [33mjsdom was created 63 times[39m[2m · 227.77s total, 42% of tracked time[22m
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
dist/assets/InfoViews-CaRWcnLa.js    1.90 kB │ gzip:   0.71 kB
dist/assets/index-Bw62aVq3.js      371.37 kB │ gzip: 129.13 kB
dist/assets/Parity-CpqBxMxD.js     437.89 kB │ gzip:  57.95 kB

[32m✓ built in 537ms[39m
```

### Forbidden-phrases test: PASS

```
[1m[30m[46m RUN [49m[39m[22m [36mv5.0.3 [39m[90m/Users/maadhavgovil/Sleep Apnea[39m


[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m36 passed[39m[22m[90m (36)[39m
[2m   Start at [22m 01:59:32
[2m   Duration [22m 2.86s[2m (import 52%, environment 41%, transform 6%, tests 1%)[22m
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
_expo/static/js/ios/entry-c2539f3261b13e85123d4bfad88a5fdc.hbc (4.8MB)

› Files (1):
metadata.json (1.8KB)

Exported: /var/folders/y0/7k9wwn1s5xg0z_cfv5qwh2800000gp/T/sleepsmooth-export-uoDWSv
```

### Expo dependency check (npx expo install --check): PASS

```
Dependencies are up to date
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
