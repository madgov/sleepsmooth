# Gap audit: PRD and CLAUDE.md against the code (2026-10-15)

Method: read the ten source-of-truth docs, then verified claims in code (`path:line`). Read-only; nothing run. Statuses: Done, Partial, Missing, Mocked. "Web" = Vite app in `src/`; "iOS" = Expo app in `mobile/`. Tests and release check last passed 2026-10-14 (625 tests); that proves build gates, not device behaviour.

## Executive summary

1. The core safety story is strong and honest: forbidden-phrase test, no "all clear", model card with 62% wrong flags disclosed, claims gated behind `CLAIMS_VERIFIED` flags (all false).
2. The product is two apps with different jobs. Web is a questionnaire, sample or uploaded clip, results, editable summary. iOS is overnight capture, nights list, a non-editable summary. A judge will ask which one is the product.
3. The clinician summary is exportable on both, but differently. Web: `window.print()` only (`src/pages/Summary.tsx:95`), no file or share. iOS: text and PDF share (`mobile/app/summary.tsx:46-63`) but sections are read-only and the web preview cannot share.
4. Wearable manual entry does not exist anywhere. `wearable` is a source label only (`src/types/evidence.ts:4`); no input, no `WearableObservation` type. HealthKit is compiled out (`mobile/app.json:66` `healthkit:false`), and even when on it reads sleep intervals, not SpO2 or heart rate.
5. Multi-night comparison is partial on iOS (list plus counts, `aggregateNights`), missing on web, and there is no night-over-night chart.
6. ConsentRecord is stored on both (web `sessionStorage`, iOS settings file), but only the latest state: no history, and withdrawing overwrites the timestamp.
7. No iPhone device test has been run (release check table: all "Not run"). The core claim, "records all night with the screen locked", is unproven. This is the biggest risk for a live demo.
8. Model evidence is ESC-50 clips only: precision about 0.23 on test, 0.34 out of fold. The app runs v1, the card describes v3, and YAMNet parity is unverified. The in-app model card shows "Test results are not available" instead of the numbers.
9. Accessibility has effort behind it (136 a11y props, font-scale handling) but no VoiceOver pass, no contrast measurement, no localization (en-US hard-coded).
10. Quick wins exist: an unguarded dev route, a `?parity` page shipped to production web, one live TODO, a stale test-run claim in docs, and a missing partner/bystander path in the product itself.

## 1. Requirement matrix

### P0

| Requirement | Status | Evidence |
|---|---|---|
| Landing and safety explanation before data collection | Done (both) | Web `src/pages/Welcome.tsx`, `src/components/Disclaimer.tsx`; iOS `mobile/app/intro.tsx`, `onboarding.tsx`, `consent.tsx` |
| Questionnaire with source and scoring | Done | NoSAS instrument, `src/questionnaire/instruments/noSas.ts:117` (citation, verified true), `score.ts`; iOS reuses via `mobile/src/flow/steps.tsx` |
| Reviewable, editable answers | Done (web), Partial (iOS: review step then save, `mobile/app/questionnaire.tsx`, edits via retake) | AUDIT_BUTTONS retake test |
| Audio upload or labeled sample | Done on web (`src/pages/AudioInput.tsx`, `src/demo/demoCase.ts`); iOS has a labeled sample night (`buildSampleNightView`, used `mobile/app/summary.tsx:36`) and live capture (`mobile/src/capture/controller.ts`) | |
| Real or labeled prototype analysis | Done, but a weak model | `src/audio/model/infer.ts`, `model.json`; model card metrics. 8 positive test clips. Labeled "prototype" |
| Results separating symptoms from audio | Done (web `src/pages/Results.tsx:39`); iOS Checks and Night detail (`mobile/app/check/[id].tsx`, `night/[id].tsx`) | |
| Uncertainty, quality, inconclusive states | Done | `src/evidence/audioState.ts`, `conflicts.ts`; iOS states `not-assessed`, `few-observations`, `model-not-applicable`, `no-model` (`mobile/app/(dev)/gallery.tsx` list) |
| Clinician-ready summary | Done on web (editable, regenerate with keep/replace, `Summary.tsx:34-92`), Partial on iOS (read-only) | |
| Next steps and disclaimer | Done | `src/pages/NextSteps.tsx:35-58` (persisted checklist); `mobile/app/next-steps.tsx` |
| Responsive, polished UI | Done / Partial | iOS polish documented in UI_CRITIQUE; deferred items include Dashboard/Checks/Nights overlap. Web CSS tokens fine, no recent web screenshot audit |
| Demo mode labels all sample data | Done | `src/components/DemoBanner.tsx`, `SourceBadge`; iOS `SourceBadge` kind `sample` |

### P1

| Requirement | Status | Evidence |
|---|---|---|
| Multi-night comparison | Partial iOS, Missing web | `mobile/app/(tabs)/nights.tsx:33` uses `aggregateNights` (`src/night/adapter.ts:97`, "recurring" = observed on 2+ nights). No per-night trend or side-by-side. Web is single-session |
| Wearable import or manual entry | Mocked / Missing | Label only (`src/components/SourceBadge.tsx:12`). HealthKit read wrapper `mobile/src/health/index.ts` is disabled by `app.json:66`, never exercised on device. Reads sleep stretches (`:57`), not oximetry |
| Follow-up checklist and reminders | Partial | Checklist done (web/iOS). Reminder is a bedtime recording prompt (`mobile/src/platform/reminder.ts`), not a follow-through reminder for seeing a clinician |
| Exportable report | Partial | See section 2 |
| Privacy controls and deletion | Done, test-verified in memory | `mobile/app/(tabs)/settings.tsx:64-69`; web `AppFooter.tsx:52`; `docs/PRIVACY_CHECKS.md` P1-P3. Real iOS file system unproven |

### Data model

| Type | Status | Evidence |
|---|---|---|
| ScreeningResponse | Done | `src/types/questionnaire.ts:31` (id, version, answers, completedAt). Usage appears to be via `answers` record rather than the typed object everywhere |
| SymptomEntry | Partial | `:40` has key, frequency, `userReported`. Missing the CLAUDE.md fields duration and timestamp |
| AudioAnalysis | Done | `src/types/audio.ts:27`; night-level equivalent `src/night/types.ts` |
| WearableObservation | Missing | No type found |
| EvidenceSummary | Done | `src/types/evidence.ts:21`, engine `src/evidence/engine.ts` |
| CareSummary | Done | `src/types/report.ts:13`; builder `src/report/generate.ts`, shared `src/mobileLogic/summaryText.ts:69` |
| ConsentRecord | Partial | Web `:46` (purpose, granted, at), persisted in session (`src/state/storage.ts:12,57`), tab-scoped `sessionStorage`. iOS inside settings with a version (`mobile/src/state/settings.ts:18`). Single latest value, no audit trail |

### Web versus iOS feature differences

| Feature | Web | iOS |
|---|---|---|
| Audio source | Upload or sample clip | Live overnight capture, sample night |
| Editable summary | Yes | No |
| Summary export | Browser print only | Text and PDF share sheet |
| Multi-night | No | Counts and list |
| Persistence | `sessionStorage`, lost on tab close | File store, survives restarts |
| Reminders | None | Local bedtime notification |
| Clips, auto-record, Live Activity | None | Yes (device-only, unverified) |
| Health | None | Sleep read, disabled in config |

## 2. Judge-facing gaps

Typical health-hackathon rubrics (Mount Sinai scoresheet, Brunel's equal tech, impact, presentation split, Kennesaw, Qatar) weigh: clinical relevance backed by evidence, working demo and technical sophistication, UX, feasibility or validation, and a clear pitch ([Mount Sinai scoring](https://icahn.mssm.edu/files/ISMMS/Assets/About%20the%20School/Sinainnovations/Hackathon/health_hackathon_scoring.pdf), [Brunel](https://brunel.ac.uk/news-and-events/events/2023/Hacking-the-Digital-Health-Hackathon), [Qatar](https://www.qu.edu.qa/en-us/competition/HealthHackathon/HealthHackathon2025/Pages/Prizes-and-Partners.aspx)). Where a judge will poke:

- **Demo story.** There is no single 90-second path. The PRD demo is "sleepy but quiet recording" on web; the engineering effort went into the iPhone overnight app, which cannot be demonstrated live (a night takes eight hours). A pre-recorded real night or the labeled sample night must carry it, and the sample night is explicitly never "your result". Decide the headline: the web flow is the dependable demo, the iOS app is the depth proof.
- **Evidence of real use.** None. No real night captured, no user feedback, no clinician quote. DEVICE_TEST.md is entirely "Not run". Even one real 8-hour overnight log with the export would change the pitch from "plan" to "evidence".
- **Metric honesty.** The docs are unusually honest (62% of flags wrong, 8 positive clips, fold 5 reused, no real-phone data, 8 kHz recall 0.00 for v1). That is a strength if pitched deliberately. Weak spots a judge will find: the app ships v1 while the card headlines v3; the card is `model/MODEL_CARD.md` yet the in-app card hides all numbers (`mobile/app/model-card.tsx:17` TODO); the model is trained on ESC-50 CC BY-NC weights (non-commercial), which blocks any "startup" answer; the Kaggle snoring set was empty. Snore detection is also only loosely related to apnea, which the app says; judges will ask "so what does it add over a questionnaire".
- **Offline.** On-device by design and the no-network scan covers own code (P4), but "nothing uploaded" is hidden until device-verified. Web: the app needs no server, yet there is no service worker or PWA manifest, so it fails when offline from a cold start. State this honestly rather than claim "works offline".
- **Accessibility.** Positive: a11y roles and labels (136 occurrences in `mobile/src`), font-scale support and stacking (`src/mobileLogic/index.ts:122`), reduce-motion handling in several components, focus-moves-to-heading on web. Gaps: no recorded VoiceOver walk-through, no contrast numbers (the glass UI over gradients is the usual failure), Dynamic Type verified only with a web `fontscale` param, no evidence of a web axe or Lighthouse run.
- **Partner or bed-partner.** Mentioned only as a checklist line and a clinician-question (`src/content/claims.ts:316`). No partner observation capture (witnessed pauses, gasping) even though it is the clinically strongest informal signal in NoSAS-adjacent workflows, and no "recording someone else" consent beyond a bystander acknowledgement (`mobile/app/start-sheet.tsx`). The PRD names people who sleep alone; the app handles that only in copy.
- **Localization.** None. Dates hard-code `en-US` (`mobile/app/(tabs)/dashboard.tsx:73,138`, `summaryText.ts:59`), strings live in `claims.ts`/`copy.ts` (good for later extraction), no locale or RTL handling. Unit entry in the questionnaire (height, weight, neck) needs a metric and imperial check.
- **Clinical grounding.** Red-flag logic exists (`src/evidence/redFlags.ts`); CLAUDE.md forbids urgent-care rules without authoritative grounding. Confirm every red-flag item cites a source in the UI.

## 3. Quick wins and hygiene

- One live TODO: render evaluated ranges in `mobile/app/model-card.tsx:17`. The fix means bundling a small JSON of the model card numbers, and the release check explicitly asserts none are bundled (it would need updating).
- Placeholder comment `src/audio/constants.ts:18` ("PROVISIONAL placeholder ... set by Agent C") is stale: the silence floor is now fixed at -72 dBFS per the model card. Fix the comment.
- `src/mobileLogic/clips.ts:20` reserves classes the selector "refuses"; fine, but confirm no UI can reach it.
- Production web exposes `?parity` (`src/App.tsx:119-121`), shipping a 438 kB QA page with golden fixtures and an audio parity mp3/m4a (build output). Gate on `import.meta.env.DEV` or leave it and say so.
- iOS dev routes: `(dev)/gallery.tsx` has no `__DEV__` guard in the file, only a guarded link (`settings.tsx:249`) and a registered screen (`_layout.tsx:78`). A deep link `sleepsmooth://(dev)/gallery` likely opens it in release, showing sample UI (harmless, but unpolished). `(dev)/recording-preview` returns null outside dev (good). `(dev)/lab` is reachable in release when `EXPO_PUBLIC_DEVICE_LAB=1`, which DEVICE_TEST requires; ensure the final demo build does not set it.
- Bundle ID is `com.sleepsmooth.overnight.dev` and app name "SleepSmooth Overnight"; fine for sideload, odd on stage.
- Working tree has about 70 uncommitted modified files and 3 deletions on top of one commit, so "what we shipped" is not reproducible. Commit before the demo.
- `docs/OVERNIGHT_PLAN.md` is 12,600 words and still headed "PLAN ONLY (no app code written)"; a judge opening the repo sees a contradiction. Add a status line or archive it.
- Release check run happened before today; rerun after final changes.

## 4. Top 15 gaps, ranked (judge impact against effort)

| # | Gap | Size | Files |
|---|---|---|---|
| 1 | Run one real overnight device test (T1 locked screen) and file the export log. Converts the headline claim from unverified to evidence | M | `mobile/DEVICE_TEST.md`, `docs/releases/`, `mobile/src/content/flags.ts` |
| 2 | Pick and script one demo path (web flow with the PRD sleepy-but-quiet case, plus a short real iOS clip recording), with a fallback video | S | `src/demo/demoCase.ts`, README/pitch |
| 3 | Put honest model numbers in the app model card (precision, recall, 8 positive clips, no real-phone data) and align v1 versus v3 wording | S | `mobile/app/model-card.tsx:17`, `src/content/claims.ts:243`, `src/audio/modelCardInfo.ts`, release-check script |
| 4 | Make the iOS summary editable, matching web (the PRD says "editable") | M | `mobile/app/summary.tsx`, `src/mobileLogic/summaryText.ts`, `src/state/session.tsx` patterns |
| 5 | Web export: Blob download of text or a proper PDF/file, not only `window.print()` | S | `src/pages/Summary.tsx:95`, `src/styles/print.css` |
| 6 | Wearable manual entry (a short form: SpO2 low, resting HR, device name, entered-by-user) with `WearableObservation` type, source label, summary section, no scoring | M | `src/types/evidence.ts`, `src/evidence/engine.ts`, `src/pages/Questionnaire.tsx` or new page, `src/report/generate.ts`, `mobile/app/(tabs)/checks.tsx` |
| 7 | Multi-night view: per-night strip with state per night and an explicit "not comparable to a clinical result" note | M | `mobile/app/(tabs)/nights.tsx`, `src/night/adapter.ts`, `mobile/src/ui/CoverageTimeline.tsx` |
| 8 | Partner/bed-partner path: partner observations (snoring, pauses, gasping) as `user-reported` in questionnaire and summary; "sleep alone" branch | M | `src/questionnaire/symptomChecklist.ts`, `src/content/claims.ts:316`, `src/report/generate.ts` |
| 9 | Accessibility evidence: VoiceOver walk on a device, contrast check of glass cards (4.5:1), axe pass on web; record results in a doc | M | `mobile/src/theme/tokens.ts`, `mobile/src/ui/*`, `src/styles/tokens.css` |
| 10 | Commit and tag a clean release; reconcile `OVERNIGHT_PLAN.md` status | S | repo root, `docs/OVERNIGHT_PLAN.md` |
| 11 | ConsentRecord history (append-only list with version, purpose, status, timestamp), shown in Settings | S | `src/types/questionnaire.ts:46`, `src/state/storage.ts`, `mobile/src/state/settings.ts:18`, `settings.tsx:216` |
| 12 | Guard `?parity` and the iOS gallery in production | S | `src/App.tsx:119`, `mobile/app/(dev)/gallery.tsx`, `mobile/app/_layout.tsx:78` |
| 13 | Web persistence/offline: PWA manifest plus service worker, and a short "works offline" statement that is true | M | `index.html`, `vite.config`, `src/state/storage.ts` |
| 14 | Follow-through reminder (appointment-booking nudge) instead of only bedtime prompts | S | `mobile/src/platform/reminder.ts`, `mobile/app/next-steps.tsx`, `src/pages/NextSteps.tsx` |
| 15 | Localization groundwork: replace hard-coded `en-US` with device locale, unit toggle for height, weight and neck | S | `mobile/app/(tabs)/dashboard.tsx:73,138`, `src/mobileLogic/summaryText.ts:59`, `mobile/src/flow/steps.tsx:62` |

Not recommended before the demo: enabling HealthKit (needs entitlement, device test, and adds a claim to defend), training a new model (no new real data to validate it), and merging Dashboard, Checks and Nights (product call, deferred in UI_CRITIQUE).

## Caveats

Line numbers were taken from the working tree on 2026-10-15; the tree has large uncommitted changes. I did not run the app, tests or a device. "Done" for iOS means the code path exists, not that it works on a phone. Gallery reachability by deep link is inferred from route registration, not tested.
