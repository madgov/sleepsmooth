# SleepSmooth Implementation Plan

Status: approved plan, with orchestrator amendments applied (marked "(Amendment N)"). Binding companions: `CLAUDE.md`, `docs/PRD.md`, `docs/SOURCES.md`.

## Eng review changes (2026-10-10)

Each change is applied in the relevant section below and marked "(ER-n)". Existing amendments are kept; where ER-1 changes an amendment's numbers, the amendment text is updated in place.

- **ER-1** Decode on the main thread (`AudioContext`/`decodeAudioData` is unavailable in Web Workers). Cap 30 minutes / ~100 MB, replacing the 60 min / ~200 MB cap everywhere. Guidance: "record 10-30 minutes". (Review decision: 20 min cap, memory; guidance is now "record 10-20 minutes".)
- **ER-2** Dataset confound gate (section 4): per-source metrics, Kaggle non-snore negatives in all splits, source-classifier check, within-Kaggle held-out AUC gate, >= 30 s ESC-50 sanity recording, dedupe by feature hash.
- **ER-3** Evidence rules spec (section 2): exact inputs, first-match-wins rules, invariants, and the updated M3 demo case.
- **ER-4** Frozen contracts written by M0: `src/types/*.ts`, `src/audio/features/index.ts` signatures, `src/audio/constants.ts`, `model.json` schema. Ownership clarified (Agent B: `pages/AudioInput`; Agent A: `pages/Results`).
- **ER-5** Drop tfjs-node: hand-rolled TS training and inference.
- **ER-6** Demo audio: labeled >= 30 s sample assembled from ESC-50 clips.
- **ER-7** Privacy enforcement: CSP meta tag, no network calls with user data, QA checks the network panel.
- **ER-8** Copy rules: "quiet periods", forbidden strings list, all NoSAS/claims text in `src/content/claims.ts`.
- **ER-9** M6 branch when no model ships (`modelVersion` null).
- **ER-10** Model card notes licensing of weight-deriving data (ESC-50 CC BY-NC; Kaggle per user's verification).
- **ER-11** Additional tests (forbidden phrases, mp3/m4a parity, edge cases, no-green property test, session tests, regenerate-confirm test, 30 min performance check).

## Amendments summary

1. Recording length (ER-1): uploads capped at 30 minutes and ~100 MB (was 60 minutes / ~200 MB); `decodeAudioData` cannot stream and is not available in workers.
2. Silent windows: dropped from training and flagged "too quiet to assess" at inference.
3. Model scores are internal; never shown as a percentage or "confidence".
4. Every number from the illustrative demo carries "Synthetic / illustrative" everywhere, including the printed summary.
5. Active instrument is NoSAS; neck circumference optional; no GOAL; never merged with audio.
6. Only the "may say" statements in SOURCES.md; accuracy only as ranges from PMC6977329.

## 1. Directory structure

```
package.json, vite.config.ts, tsconfig.json, vitest.config.ts, index.html
src/
  main.tsx
  App.tsx                    step router: welcome -> questionnaire -> audio -> results -> summary -> next steps
  types/                     evidence.ts, audio.ts, questionnaire.ts, report.ts  (FROZEN in M0, ER-4)
  content/
    claims.ts                all NoSAS / claims / user-facing health text lives here (ER-8)
  questionnaire/
    types.ts                 Instrument interface
    registry.ts              active instrument = one-line swap
    instruments/
      noSas.ts               exact scoring, source citation, cutoff text
    symptomChecklist.ts      team-written, labeled "not a validated instrument"
    score.ts, score.test.ts
  audio/
    constants.ts             FROZEN in M0 (ER-4): SAMPLE_RATE=16000, FRAME_MS=25, HOP_MS=10, WINDOW_SEC=1,
                             WINDOW_HOP_SEC=0.5, SILENCE_FLOOR_DBFS (placeholder; Agent C sets from data),
                             SNORE_FRACTION_OBSERVED
    features/                shared with Node, NO DOM imports
      resample.ts fft.ts mel.ts frame.ts logmel.ts index.ts   (index.ts signatures FROZEN in M0, ER-4:
                             computeLogMel(frames: Float32Array @16 kHz) -> Float32Array, 40 per frame;
                             frameLogMel for a 1 s window -> 100x40)
      *.test.ts
      golden/*.json
    quality.ts               duration, clipping, noise floor, silence ratio -> QualityReport
    loudness.ts              RMS dB per second
    quietGaps.ts             energy-threshold gaps, labeled non-ML
    model/
      model.json, infer.ts  model.json schema FROZEN in M0 (ER-4):
                             {version, featureSpec, silenceFloorDbfs, norm:{mean,std}, layers, threshold, weightsHash, trainedAt}
    analyze.ts               pipeline -> AudioAnalysis; mono samples processed in 30 s chunks (Amendment 1)
    worker.ts                Web Worker (ER-1): receives the transferred mono Float32Array; does resample,
                             chunked features, quality, loudness, quiet periods, inference. No AudioContext here.
    useAnalysis.ts           hook: progress, cancel
    decode.ts                Runs on the MAIN thread (ER-1; AudioContext/decodeAudioData is unavailable in workers).
                             Order: (1) file-size pre-check (~100 MB), reject BEFORE decode; (2) decodeAudioData;
                             (3) enforce 30 min duration cap; (4) downmix to mono Float32Array; (5) transfer the buffer
                             zero-copy to worker.ts. Our own resampler (in the worker, not OfflineAudioContext) is used
                             for parity.
  evidence/
    engine.ts, rules.ts, redFlags.ts, conflicts.ts, *.test.ts
  report/
    generate.ts, generate.test.ts, printCss.css
  demo/
    demoCase.ts              labeled SYNTHETIC; precomputed AudioAnalysis + answers (Amendment 4)
    sample-audio             >= 30 s recording assembled from ESC-50 clips (ER-6); labeled
                             "Sample audio assembled from public ESC-50 clips"; attribution shown (CC BY-NC)
  components/
    EvidenceCard, SourceBadge, DemoBanner, LoudnessChart (SVG, no lib), QualityPanel,
    Stepper, Disclaimer, ConsentGate, ErrorState
  state/
    session.ts               context + sessionStorage; answers only, never audio; "Delete my data"
  pages/
    Welcome, Questionnaire, AudioInput, Results, Summary, NextSteps
scripts/                     Node, run with tsx
  prepare-data.ts            ffmpeg -> 16 kHz mono wav, split, hash lists
  extract-features.ts        uses src/audio/features
  train.ts, evaluate.ts, export-model.ts, make-golden.ts   (hand-rolled TS, no tfjs-node; ER-5)
data/raw/{kaggle-snoring,esc50}   gitignored
model/MODEL_CARD.md, metrics.json
docs/SOURCES.md
```

## 2. Data model

```ts
type Source = 'user-reported' | 'audio-observation' | 'wearable' | 'missing' | 'app-guidance';
type EvidenceState = 'present' | 'absent-unreliable' | 'inconclusive' | 'missing' | 'conflict';

interface EvidenceItem {
  id; source; label; detail; state;
  isSynthetic: boolean;
  limitations: string[];
  citation?;
}

interface Instrument {
  id; version; title;
  citation: { text; url; verified: boolean };
  items: Item[];
  score(a): { total: number | null; complete: boolean; band: string; explanation: string };
  notDiagnostic: true;
}
interface Item { id; text; type: 'yesno' | 'number' | 'choice'; options?; required: boolean }
interface ScreeningResponse { instrumentId; version; answers; completedAt? }
interface SymptomEntry { key; frequency: 'never' | 'sometimes' | 'often' | 'nightly'; userReported: true }

interface QualityReport {
  durationSec; clippingPct; noiseFloorDb; silenceRatio;
  verdict: 'usable' | 'marginal' | 'unusable';
  reasons: string[];
}
interface WindowObs { t0; t1; snoreLike: boolean; score: number }  // internal model output, not apnea probability
interface QuietGap { t0; t1; durSec }                              // NOT an apnea event

interface AudioAnalysis {
  status: 'idle' | 'running' | 'done' | 'error';
  quality; loudness: number[]; windows;
  snoreLikeFraction; quietGaps;
  modelVersion: string | null;
  isSynthetic: boolean;
  limitations: string[];
}

type Conclusion = 'discuss-with-clinician' | 'inconclusive' | 'not-enough-information';
interface EvidenceSummary {
  conclusion; headline; items; missing: string[];
  conflicts; redFlags; uncertaintyNotes: string[];
}                                                                  // no probability field by type

interface CareSummary {
  sections: { id; title; source; text }[];
  generatedAt; userEdited: boolean;
}
interface ConsentRecord { purpose: 'audio-local-analysis' | 'session-storage'; granted: boolean; at }
```

Note: no probability or severity fields exist; `Conclusion` has no "low risk" value.

Types in `src/types/*.ts` are frozen in M0 (ER-4); other agents import them and never edit without orchestrator approval.

### Evidence rules spec (ER-3; Agent A implements exactly this)

**Inputs**

| Input | Values |
|---|---|
| NoSAS state | `atOrAbove` (complete and >= 8, OR incomplete without the neck item but partial total already >= 8); `below` (complete and < 8); `incompleteBelow` (neck missing, partial < 8); `notAnswered` |
| Symptom burden (team-written checklist; documented as an unvalidated heuristic) | Core items: loud snoring, choking/gasping at night, someone noticed breathing pauses, unrefreshing sleep, daytime sleepiness, morning headaches. `high` = >= 2 core items rated often/nightly; `some` = >= 1 item rated sometimes or more; `none` = all never; `notAnswered` |
| Red flag present | e.g. drowsy driving / falling asleep while driving. Wording is generic "talk to a clinician promptly" until the SOURCES.md row is verified |
| Audio | `notProvided`; `unusable`; `usableFewObservations`; `usableSnoreLikeObserved` (snore-like fraction of assessable windows >= `SNORE_FRACTION_OBSERVED`, a documented constant); `noModel` (usable audio but `modelVersion` null: non-ML measures only) |

**Rules (first match wins)**

| # | Condition | Conclusion | Additional output |
|---|---|---|---|
| 1 | NoSAS `notAnswered` AND symptoms `notAnswered` | `not-enough-information` | |
| 2 | Red flag OR NoSAS `atOrAbove` OR symptoms `high` | `discuss-with-clinician` | If audio is `usableFewObservations`, `noModel`, `notProvided`, or `unusable`, add Conflict: "Your symptoms and screening answers suggest this is worth discussing, and a quiet or missing recording cannot rule out sleep apnea." |
| 3 | Audio `usableSnoreLikeObserved` (with NoSAS `below`/`incompleteBelow` and symptoms `none`/`some`) | `discuss-with-clinician` | Note: "snore-like sounds were observed; snoring alone does not mean sleep apnea, but it is worth mentioning." |
| 4 | Otherwise | `inconclusive` | Headline "This screening cannot rule out sleep apnea." List all missing items (neck measurement, audio, unanswered items) |

**Invariants**
- No low-risk / all-clear / green output exists.
- Audio never downgrades a conclusion.
- Every `EvidenceSummary` includes the not-a-diagnosis limitation.
- Missing or unusable inputs always appear in `missing`.

Demo case (M3): persistent daytime sleepiness + unrefreshing sleep rated often (symptoms `high`), NoSAS `incompleteBelow`, audio `usableFewObservations` -> `discuss-with-clinician` plus the conflict text above.

### Copy rules (ER-8)

- Quiet gaps are called "quiet periods" in all UI copy.
- Forbidden strings in UI: "pause", "apnea event", "breathing stopped", "low risk", "safe", "all clear", "probability", "confidence", and "diagnos*" outside disclaimer components. Decision: keep the user-reported checklist item 'someone noticed breathing pauses'. The forbidden-phrase test allowlists the word 'pauses' ONLY in src/questionnaire/symptomChecklist.ts (user-reported symptom wording). It remains forbidden in all app-generated text.
- All NoSAS and claims text lives in `src/content/claims.ts`.

### Data-model and UI rules added by amendments

- **Window scores are internal (Amendment 3).** `WindowObs.score` is never rendered. The UI shows only windows flagged "snore-like pattern observed", plus counts and the fraction of assessable windows. No percentage, no "confidence".
- **Too-quiet windows (Amendment 2).** Windows below the RMS energy floor are marked "too quiet to assess" and excluded from the assessable-window denominator. They are never reported as "no snore". `AudioAnalysis` gains a count of too-quiet windows (e.g. `quietWindowCount`), and `snoreLikeFraction` is computed over assessable windows only.
- **Synthetic labeling (Amendment 4).** `isSynthetic` propagates from the demo case to every derived `EvidenceItem`, to `CareSummary` sections, and to the editable and printed summary. Any number originating from the illustrative case displays "Synthetic / illustrative" beside it.
- **NoSAS incompleteness (Amendment 5).** `score()` returns `total: null`, `complete: false` when the neck circumference is missing, with the explanation "incomplete (maximum 13 without the neck item)". An incomplete score is never displayed as low and never as a band. NoSAS is shown separately from audio; there is no combined score field.

## 3. Milestones

**M0 Scaffold (serial).** Vite, Vitest, ESLint, gitignore.
- Frozen contracts (ER-4), written by the M0 agent; others import and never edit without orchestrator approval: `src/types/*.ts`; `src/audio/features/index.ts` signatures (`computeLogMel(frames: Float32Array @16 kHz) -> Float32Array` of 40 per frame; `frameLogMel` for a 1 s window -> 100x40); `src/audio/constants.ts` (`SAMPLE_RATE=16000`, `FRAME_MS=25`, `HOP_MS=10`, `WINDOW_SEC=1`, `WINDOW_HOP_SEC=0.5`, `SILENCE_FLOOR_DBFS` placeholder set by Agent C from data, `SNORE_FRACTION_OBSERVED`); `model.json` schema `{version, featureSpec, silenceFloorDbfs, norm:{mean,std}, layers, threshold, weightsHash, trainedAt}`.
- Privacy (ER-7): `index.html` carries a CSP meta tag (`default-src 'self'; connect-src 'self'`); no network calls with user data.
- AC: `npm test` and `npm run build` pass.

**M1 Questionnaire to summary.** Instrument interface, NoSAS module, symptom checklist, scoring, session state, welcome with limitations + consent, basic summary generator.
- AC: complete flow; summary separates self-reported content; missing answers handled; instrument swappable via `registry.ts` only.
- Questionnaire specifics (Amendment 5): active instrument is NoSAS (details in SOURCES.md). Neck circumference is an optional measured input with an "I don't know" option; if missing, the score is "incomplete" (max 13 without the neck item) and is never displayed as low. The sex item asks for sex assigned at birth, with a note that the published score was derived using that variable. GOAL is not added. NoSAS is shown separately and never merged with audio into any combined score.
- Tests: `score.test` (every item and cutoff boundary, incomplete case), `generate.test` (snapshot), swap test with a fake instrument.

**M2 Evidence engine.** Rules, red flags, conflicts, conclusions, EvidenceCards with source badges.
- Implements the evidence rules spec in section 2 exactly (ER-3).
- AC: no input yields an all-clear; each conclusion is reachable; "high symptom burden + few acoustic observations" yields `discuss-with-clinician` with the "cannot rule out" conflict (ER-3; was inconclusive).
- Tests: table-driven rules; property test that every output contains the not-a-diagnosis limitation; property test that no `EvidenceSummary` has an ok/green state (ER-11); red-flag wording matches SOURCES.md.

**M3 Demo case (parallel with M4/M5).** Synthetic PRD scenario, banner everywhere.
- AC: one click runs the full flow; all demo-derived numbers carry "Synthetic / illustrative" in Results, the editable summary, and the printed summary (Amendment 4).
- Demo inputs (ER-3): persistent daytime sleepiness + unrefreshing sleep often (symptoms `high`), NoSAS `incompleteBelow`, audio `usableFewObservations`.
- Test (ER-3): demo -> `discuss-with-clinician` + the conflict text "Your symptoms and screening answers suggest this is worth discussing, and a quiet or missing recording cannot rule out sleep apnea." (was "inconclusive + conflict").
- Demo audio (ER-6): a labeled >= 30 s sample recording assembled from ESC-50 clips (attributed, CC BY-NC) for the live demo, since Kaggle clips are 1 s. Label: "Sample audio assembled from public ESC-50 clips".

**M4 Audio features + quality, no ML (Amendment 1 applied).** Features module, quality gate, loudness, quiet periods (ER-8 wording), worker, decode, AudioInput page (owned by Agent B, ER-4) with validation and errors (wrong type, < 30 s, over 30 min or ~100 MB, silent, clipped, decode failure).
- Recording guidance (ER-1): "record 10-30 minutes". Uploads are capped at 30 minutes and ~100 MB (replaces 60 min / ~200 MB). `decodeAudioData` cannot stream; an 8 h recording would need ~5 GB of RAM, so overnight-length decode is not supported in this prototype.
- Threading (ER-1): `decode.ts` runs on the main thread (file-size pre-check before decode, `decodeAudioData`, downmix to mono `Float32Array`, zero-copy transfer to `worker.ts`). The worker does resample, chunked features, quality, loudness, quiet periods, and inference.
- Mono samples are processed in 30 s chunks inside the worker, which drives progress reporting.
- Silence floor (Amendment 2): the same RMS energy floor used in training is applied at inference; windows below it are "too quiet to assess".
- AC: a 10 min file is analyzed with responsive UI and progress; a 30 min synthetic file passes a performance check (ER-11); unusable audio yields a clear error plus an offer to use the demo.
- Tests: FFT vs naive DFT; mel properties; golden-vector parity (Node JSON asserted in Vitest plus a hidden `/parity` page in the browser), including an mp3/m4a fixture in addition to WAV (ER-11); quality on synthetic tones, clipping, and silence; edge cases (ER-11): stereo downmix, 44.1 vs 48 kHz, all-silent, clipping, corrupt file; 30 min synthetic file performance check (ER-11).

**M5 Training pipeline (parallel with M4 once the features API is frozen).**
- Training and inference are hand-rolled in TS: logistic-regression baseline + 40-32-1 MLP, Adam, fixed seed; no tfjs-node (ER-5).
- Must pass the dataset confound gate in section 4 (ER-2).
- AC: `model.json` + model card with real held-out numbers, or a documented decision not to ship. Dropped silent-window counts are reported (Amendment 2).

**M6 Integrate model into worker + Results (needs M4 + M5).**
- Results page is owned by Agent A and uses Agent D's components (ER-4).
- No-model branch (ER-9): if the model is not shipped (`modelVersion` null), Results shows the non-ML measures (quality, loudness, quiet periods) and the line "No trained snore model is included in this build."; the engine treats audio as `noModel`.
- AC: a snoring clip shows observations; ambient noise shows few or none; Results never reads as reassurance; per-window scores are not displayed (Amendment 3).
- Test: `infer.ts` matches Node predictions on fixtures.

**M7 Polish, validation, print.** Editable summary (per-section textarea; edited marker preserved with confirmation on regenerate), print CSS, next-step checklist, delete-data, a11y (labels, focus, contrast, reduced motion, keyboard), responsive. Then gstack `/qa` at mobile + desktop.
- Privacy enforcement (ER-7): CSP meta tag (`default-src 'self'; connect-src 'self'`); no network calls carry user data; QA checks the browser network panel during a full flow.
- Tests (ER-11): forbidden-phrase test over all `src` strings (ER-8 list); session tests (no audio in `sessionStorage`; "Delete my data" clears all); edited-summary regenerate-confirm test.

### Parallelism and file ownership

After M0 and the types freeze:
- **Agent A:** M1 -> M2 (questionnaire, evidence, report, state, pages except AudioInput/Results).
- **Agent A:** also owns `pages/Results` (uses Agent D's components) (ER-4).
- **Agent B:** M4 (`src/audio` except `model/`); owns `pages/AudioInput` (ER-4); delivers `features/index.ts` first (signatures already frozen by M0).
- **Agent C:** M5 (`scripts/`, `model/`, `data/`); imports `features` read-only; sets `SILENCE_FLOOR_DBFS` from data.
- **Agent D:** M3 + `components/` + CSS.
- **Serial:** M0 (writes the frozen contracts, ER-4), then M6, M7, QA.
- Frozen files (`src/types/*.ts`, `src/audio/features/index.ts` signatures, `src/audio/constants.ts`, `model.json` schema) are never edited without orchestrator approval (ER-4).
- `App.tsx` is touched only by Agent A until M6.

## 4. Training pipeline

1. **prepare-data.** ffmpeg to 16 kHz mono. Kaggle: snore = 1, non-snore = 0 (1000 x 1 s). ESC-50 negatives (5 s clips split to 1 s) excluding class "snoring"; keep breathing, coughing, ambient, and fan/rain-like classes.
   - **Silent-window floor (Amendment 2).** ESC-50 5 s clips contain silent padding. When splitting into 1 s windows, drop windows below an RMS energy floor so the model does not learn "silence = not snoring" and inflate metrics. The threshold is a single named constant shared with inference, defined in `src/audio/features` and recorded in `model.json` and the model card (starting value to be chosen from the RMS distribution of the data and documented, e.g. a fixed dBFS value). The number of dropped windows, per class and per split, is reported in `metrics.json` and the model card.
   - **Dedupe (ER-2).** Dedupe Kaggle clips by feature hash; near-duplicates are kept within one split.
   - **Kaggle non-snore clips (ER-2)** are included as negatives in all splits, alongside ESC-50 negatives.
2. **Split** at clip/source level before windowing, fixed seed, 70/15/15; ESC-50 grouped by fold. Flag Kaggle provenance as unknown (test number likely optimistic).
3. **Features.** Shared 40-band log-mel; per-clip mean/std (plus per-window for the MLP); normalize with train stats saved in `model.json`.
4. **Models (ER-5).** Logistic-regression baseline + small MLP (40 -> 32 -> 1), Adam, fixed seed, with training and inference hand-rolled in TypeScript. No tfjs-node and no tfjs bundle; browser inference runs from JSON weights.
5. **Select on validation; report once on test.** Accuracy, precision, recall, F1, ROC-AUC, confusion matrix, validation-chosen threshold, 95% bootstrap CIs; false-positive rate on ESC-50 bedroom-relevant negatives; robustness at 2 SNRs + lowpass (phone proxy).
6. **Gate.** Ship only if AUC >= 0.85, it beats the baseline, and ambient FP rate is acceptable; otherwise do not ship. **Dataset confound gate (ER-2):** positives (Kaggle) and negatives (ESC-50) come from different sources, so the model may learn the source rather than snoring. The gate additionally requires all of:
   - (a) Per-source metrics reported.
   - (b) Kaggle non-snore clips included as negatives in all splits.
   - (c) Source-classifier check: train a classifier to predict dataset source from the same features on negatives only, and report the result. A held-out test restricted to within-Kaggle (snore vs Kaggle non-snore) must also meet the AUC >= 0.85 gate.
   - (d) A >= 30 s sanity recording assembled from ESC-50 snoring clips (held out from training entirely) plus ESC-50 non-snore clips, checked manually.
   - Without (c) passing, do not ship the model.
7. **Model card** (also in-app): intended use, not-for-use, data + licenses, split method, silent-window floor and dropped counts, metrics with CIs (including per-source and within-Kaggle results, ER-2), limitations, threshold, version, weights hash, date. Metrics describe the dataset test split only and are not presented as performance on a user's recording or as clinical accuracy. **Licensing note (ER-10):** model weights derive from CC BY-NC (ESC-50) data and Kaggle data (license per the user's verification); the card states this.

## 5. Risks and fallbacks

- **Kaggle missing or license unusable:** non-ML measures + demo, with "No trained snore model is included in this build." (the engine handles `modelVersion: null` as audio `noModel`; ER-9).
- **Weak model or failed confound gate:** do not ship (ER-2); no energy heuristic posing as snore detection.
- **Safari/iOS decode limits and large files (Amendment 1, ER-1):** friendly error; enforce the ~100 MB size check before decoding and the 30 min cap after.
- **Privacy leakage (ER-7):** CSP meta tag (`default-src 'self'; connect-src 'self'`); no network calls with user data; QA checks the network panel.
- **Parity drift:** 1e-4 tolerance; own resampler in both Node and browser.
- **Red-flag wording:** from AASM/NHLBI/CDC in SOURCES.md with a verified flag; unverified rows ship only as generic "talk to a clinician promptly", no triage rules.
- **Questionnaire citation:** a test fails the build if the active instrument has `citation.verified: false`.
- **Claims drift (Amendment 6):** a test checks that user-visible NoSAS text is drawn only from the SOURCES.md "may say" list; accuracy appears only as ranges from PMC6977329 with setting caveats.
- **Odd judge audio:** quality gate + demo + backup video.

## 6. Demo script (3 min)

| Time | Beat |
|---|---|
| 0:00 | Welcome + limits; "Dana sleeps alone, is exhausted, never tested" (20 s) |
| 0:20 | Questionnaire with "Load illustrative case"; score with citation (30 s) |
| 0:50 | Load the labeled >= 30 s sample ("Sample audio assembled from public ESC-50 clips", ER-6) or upload a real clip live: quality gate, progress, loudness timeline, observations (40 s) |
| 1:30 | Results: source columns, conflict card "cannot rule out", `discuss-with-clinician` conclusion (ER-3), missing items (40 s) |
| 2:10 | Editable summary, edit a line, print preview (30 s) |
| 2:40 | Honest slide: model card numbers, nothing clinically validated (20 s) |

All demo-case numbers are shown with the "Synthetic / illustrative" label, including in the print preview (Amendment 4).

## 7. Finished vs planned

- **Finished (real):** questionnaire scoring, quality gate, features, trained classifier with held-out metrics, rules engine, summary, a11y, tests.
- **Illustrative:** demo case.
- **Planned:** wearables, multi-night, overnight validation, clinical evaluation, PDF beyond print, reminders, accounts, integrations.


**Review decision: 20 min cap, memory.** `MAX_DURATION_SEC` is 1200 s (20 min) because decode peaks near 0.7 GB for 20 min of 48 kHz stereo. Supersedes the 30 min figures above; guidance is "record 10-20 minutes".
