# Privacy checks

Each promise SleepSmooth makes about data, how it is checked, and where it stands today. "Test" means an automated test that runs in `npm test` (no phone needed). "Device" means only a real iPhone can prove it. A promise that needs a device stays unproven, its `CLAIMS_VERIFIED` flag in `mobile/src/content/flags.ts` stays `false`, and the matching sentence is not shown in the app until the flag is flipped on purpose.

Status values: **Verified by test**, **Partly verified (test)**, **NOT VERIFIED (device needed)**.

| # | Promise | How it is checked | Status |
|---|---|---|---|
| P1 | Deleting a night removes its clips, clip feedback and diagnostics | Test: `src/mobileLogic/privacy.test.ts` seeds two nights (with a clips folder, `feedback.json`, `diagnostics.json`), deletes one, and asserts every file of that night is gone and the other night is untouched. A second assertion reads the night back and finds no diagnostics or feedback. | Verified by test (in-memory file system) |
| P2 | "Delete my data" removes everything: nights, epochs, clips, feedback, diagnostics | Test: `removeAll()` leaves nothing under the store, including a folder this build does not know about. A static test checks that `settings.tsx` `doDelete` calls `discardAll`, `removeAll`, `clearClipTemp` and `deleteAllSettings`, and that `nightSource.deleteNight` calls `remove(id)`. | Verified by test. The real iOS file system is not exercised: NOT VERIFIED on a device |
| P3 | "Delete all clips" removes the feedback that belongs to the clips | Test: clips folder removal also removes `clips/feedback.json` (feedback lives inside the clips folder by design). | Verified by test |
| P4 | The app code makes no network calls | Test: a TypeScript syntax scan of `mobile/app`, `mobile/src`, `mobile/modules`, `mobile/plugins`, `src/mobileLogic` and `src/night` for `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `axios`, URL literals and imports of network, analytics or tracking packages. A second test scans the Swift sources for `URLSession`, `URLRequest` and similar. A third checks `mobile/package.json` for networking, analytics and crash-reporting packages. | Partly verified (test): our own code. See "Allowed exceptions" and "What a static scan cannot show". Flag `noNetworkVerified` stays false |
| P5 | Nothing is uploaded, no accounts, no tracking | Follows from P4 only for our own code. Third-party native libraries and Expo tooling are not covered. | NOT VERIFIED (device needed: watch traffic on the phone during a night). Flag `noUploadNoTrackingVerified` stays false. The sentence "Nothing is uploaded" is hidden until it is true (clip feedback note and privacy rows) |
| P6 | Clips folder is kept out of iPhone backups | Test: `excludeClipsFolder` passes the decoded folder path to the native call and reports excluded, failed or unavailable honestly; `finalizeClips` calls it on the night's clips folder; the Swift module defines `setExcludedFromBackup` and sets `NSURLIsExcludedFromBackupKey`. | Partly verified (test): the call is made. NOT VERIFIED (device needed): that the flag is really set on the folder. Flag `clipsLocalOnlyVerified` stays false and the sentence "Clips are kept out of iPhone backups" is hidden |
| P7 | No audio is written unless Sound clips is on | Test: the night store writes only a manifest, an epoch log, diagnostics and feedback (a night-store test lists every file written). Clips default to off in settings. The exported test log is checked to contain no audio, peaks, scores or samples. | Partly verified (test). Flag `audioNotWrittenVerified` stays false: needs a file-system diff on a device after a real night |
| P8 | The exported test log contains no audio and no sample-night data | Test: `exportLog.test.ts` asserts that no peaks, scores, samples, `scoreQ` or `scoredMask` appear and that synthetic nights are excluded. The user chooses the destination in the iOS share sheet. The app sends nothing itself. | Verified by test |
| P9 | Clip feedback stays on the phone with the clip | Test: feedback is written to `nights/<id>/clips/feedback.json` through the same store as everything else (P1 to P3). It leaves the phone only inside a test log the user exports. | Verified by test (storage location). Sharing is the user's choice |
| P10 | Recording keeps running with the screen locked | Device only. | NOT VERIFIED (device needed). Flag `lockedScreenVerified` stays false. See `mobile/DEVICE_TEST.md` Test 1 |

## Allowed exceptions to the "no network" scan

The test names these explicitly. Anything else fails the test.

- `mobile/src/debug/runModelCheck.ts` calls `fetch` on a bundled local asset URI. It belongs to the developer lab screen, which a Release build can only reach when built with `EXPO_PUBLIC_DEVICE_LAB=1`. A test checks that it is a single `fetch(` of a local asset and that the flag lives in `mobile/src/config/devLab.ts`.
- Expo dev tooling (Metro, the dev client and Expo Go) uses the network to load the JavaScript bundle in development. It is not in our code, so the scan does not see it, and it is not present in a Release build. NOT VERIFIED on a device that a Release build carries none of it.

## What a static scan cannot show

- Network use inside third-party packages or native frameworks. The scan checks our code and the dependency list, not every line of every package.
- Runtime behaviour. Only watching the phone's traffic during a real night would show it. That is why P4 and P5 are not marked verified.

## Known limits the app should not hide

- The epoch log and night manifests (`nights/<id>/manifest.json`, `epochs.jsonl`, `diagnostics.json`) are not excluded from device backups. They contain timings and sound-level summaries, not audio. No promise in the app says otherwise.
- Clip feedback and diagnostics are not encrypted beyond iOS's normal file protection.

## How to re-run

```
npx vitest run src/mobileLogic/privacy.test.ts
```

`npm run release:check` runs it as part of the full suite and records the outcome in `docs/releases/`.
