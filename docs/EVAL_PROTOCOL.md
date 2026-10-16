# Evaluation protocol for the snore-like detector (locked-test rules for future data)

Status: **protocol, written Oct 2026. Nothing here has been executed on real overnight data yet.** It exists so that the next round of
evidence cannot be re-used, tuned against, or quietly padded. The scope of the thing being evaluated is a *snore-like acoustic pattern detector*
(a model that flags 1 s windows, grouped into segments by the app's episode rule in `src/night`). It is not an apnea detector (section 6).

## 0. What counts as evidence today, and what does not

| Data | Role | Fresh? |
|---|---|---|
| ESC-50 folds 1-4 (32 snoring clips) | development: training, CV, threshold, error analysis, synthetic nights | no, used for every decision |
| ESC-50 fold 5 (8 snoring clips) | was the single test for v1, v2 and v3 | **burned**: do not call it a test again |
| Synthetic nights (`scripts/eval/synthetic_nights.py`) | stand-in for per-hour metrics until real nights exist; built from folds 1-4 only | never a test: the generator author chose the rhythm and levels |
| Real overnight phone recordings, Kaggle snoring set, PSG-audio set, team recordings | **not yet ingested** | this protocol governs them |

## 1. Real-data intake

Candidate sources (all unverified by this repo; the intake record below must settle each before any number is produced):
Kaggle snoring dataset (license "unknown, non-commercial research only, to verify" in the model card); the ScienceDB PSG-audio dataset
(doi:10.57760/sciencedb.19070; contents, license, sampling rate, event labels and consent terms must be read from the dataset record, not assumed);
the team's own recordings (phone model, room and bed partner noted; consent recorded).

**Intake record** (one JSON/markdown file per source, committed under `data/ATTRIBUTION.md` or `docs/`, audio itself never committed): source and URL/DOI,
license text copied, access date, file count, total hours, sampling rate(s), channels, who/what is labelled and how (label definition, annotator,
agreement if known), any personal-data or consent restrictions, sha256 of every file.

**Grouping unit = person (preferred) or recording session.** Every file gets `person_id` and `recording_id`. If the source gives no person id, the
conservative proxy is: one source file = one person unless metadata or acoustic similarity says otherwise. Re-recordings of the same person or room
are the same group. A group lives in exactly one split.

**De-duplication before splitting** (same ideas as `scripts/yamnet/kaggle_groups.py`): exact duplicates by sha256 and by decoded-PCM hash; near duplicates by
filename stem plus embedding cosine similarity above a conservative cut; the same clip cut into overlapping pieces counts as one group; clips from the
same long recording count as one group. Record how many were removed and why. Never split overlapping windows of one clip across splits (the current
8-test-clip, 71-window figure is an example of strongly correlated windows).

**Splits.** Assign whole groups, stratified by source and by positive/negative content, with a fixed seed recorded in the manifest:
1. `dev` - anything may be fit, tuned and inspected.
2. `validation` - may be scored repeatedly while choosing between candidates; every score is logged.
3. `locked_test` - **scored once per release candidate.** The model hash, threshold, grouping rule and code commit are written down BEFORE scoring;
   the result is reported whatever it is; afterwards the model that was tested is frozen. A second look at the same locked set after any change makes
   it a validation set. Access is logged (date, person, model hash, purpose). When a locked set has been used for a release decision and a new
   release is planned, it is retired to `validation` and a new one must be drawn from newly collected people.
Frozen manifests (file ids, group ids, split, sha256) are committed; the audio is not.

**Minimum size before any headline number is quoted** (planning assumptions, not validated values; revisit after the first pilot shows the
between-person variance): at least 30 distinct people in `locked_test`, including people with and without habitual snoring, and enough annotated
non-snoring night time to measure a per-hour false-segment rate with a confidence interval that excludes zero. With fewer people, report the numbers
as a pilot and say so.

**Labels.** Snoring bouts are annotated as time intervals (start, end) by at least two reviewers on a subset, with agreement reported; ambiguous
intervals ("could be breathing") get their own class and are excluded from precision/recall but counted in a separate "ambiguous" tally. For
PSG-based sources use the dataset's own scored events and state which channel defines the label.

## 2. Required metrics (every report, every release candidate)

Primary, at the operating point fixed in advance (rule: `docs/MODEL_ERROR_REPORT.md` section 0 style, written down before scoring):
1. **False flagged segments per recorded hour**, overall and per person (median, interquartile range, worst person). Hours = recorded hours, not scored
   hours; also report scored fraction (windows passing the level gate).
2. **Segment recall** (annotated snoring bouts overlapped by at least one predicted segment), overall, per person, and split by quiet, brief and
   normal bouts (definitions as in the error report; quiet = lowest-quartile level above the room, brief = a few breath cycles).
3. **Segment precision** (predicted segments that overlap an annotated bout).
4. Window-level precision, recall and false-positive rate.
Secondary: ROC-AUC (never the headline; it ignores the threshold and the base rate).
Uncertainty: 95% intervals by bootstrap **over people** (not over windows or clips); say how many people and how many bouts each number rests on.
Breakdowns: by source, device/phone model, room/bed-partner noise if known, bed noise type, and by false-positive acoustic category
(breathing, impacts, tonal, animal, mechanical, speech-like).
No metric may be reported without its denominator. "Accuracy" is not used: with about 2% positive windows it is dominated by the negatives.

## 3. Shortcut guard (source-balance and trivial-baseline checks)

Run before training and again on every locked test; a failure blocks the headline number.
- **Per-source class balance table:** positives and negatives per source, per person and per device. A source that contains only positives or only
  negatives is flagged, because the model can score "which dataset" instead of "which sound". Prefer training/evaluating on sources that contain both.
- **Source classifier:** can a simple classifier (logistic regression on embeddings) tell source A from source B using negatives only, positives only,
  and loudness alone? AUC >= 0.95 on any of those is flagged "trivially separable" (the check in `scripts/yamnet/kaggle_checks.py`).
- **Trivial baselines must lose:** a loudness-only, bandwidth-only and duration-only baseline are scored on the same split; the model must beat all three
  by a margin that is reported. Remember the current fold-5 and CV numbers have never been compared with such baselines on real recordings.
- **Cross-source test:** train on source A, test on source B and vice versa; this is the main generalisation evidence. In-source scores are reported
  separately and never pooled with cross-source ones.
- **Per-person view:** if a handful of people carry most of the positives or most of the false positives, say so (the error report's concentration table
  is the template).

## 4. Phone-in-the-loop requirement

A model is not evaluated until its scores come from the runtime that ships. Before using real phone data for anything: run the runtime parity check
(`scripts/yamnet/parity.py`, `docs/YAMNET_INTEGRATION.md`) and record the result in `model/parity.v3.json`. If NumPy-versus-TFLite decisions disagree
on more than a small, documented fraction of windows near the threshold, retrain the head on TFLite outputs before anything is measured.

## 5. Release gate (draft; thresholds are engineering choices and must be agreed before the first locked-test run)

- Parity checked on the shipping runtime; the locked-test model hash equals the shipped model hash.
- Per-hour false segments and segment recall reported on `locked_test` with person-level intervals; the operating point was fixed before scoring.
- Shortcut guard passed; per-source and per-person breakdowns published in the model card.
- User-facing text keeps its current limits: snore-like observation only, never reassurance from a quiet night, never an apnea claim.

## 6. Scope boundary: snore-like detection is NOT apnea detection

Nothing in this protocol, and no number produced under it, supports a statement that SleepSmooth detects sleep apnea, apnea events, severity, risk, or
the absence of any of these. Loud snoring is neither necessary nor sufficient for sleep apnea, and a night with no snore-like segments says nothing
about whether someone has it.

**Apnea-event detection from audio is a separate milestone.** It would need: audio recorded alongside polysomnography with clinician-scored respiratory
events (obstructive/central apnea, hypopnea, with the scoring rules used), time-aligned to the audio; a new task definition (event detection or event-rate
estimation, not 1 s snore windows); separate training; separate validation against PSG on held-out people with its own metrics (event-level sensitivity and
false alarms per hour, and agreement with PSG-derived indices if an index is ever claimed); and a separate clinical, regulatory and wording review. The
snore-like model may be an input feature to that work but earns no credit for it. Until then the app presents evidence as "acoustic pattern observed" and
as a prompt for a conversation with a clinician, nothing more.

## 7. TFLite retrain (v3t): pre-registered BEFORE any TFLite-feature result was computed
Written 2026-10-16T06:21:49Z. Context: `model/parity.v3.json` shows the shipped int8 TFLite YAMNet disagrees with the NumPy port (diagnosis: the NumPy port equals
float TensorFlow ops to 1e-5 or better; the TFLite file is a post-training-quantised variant whose class scores differ per window). The on-device
runtime is the TFLite file, so features must come from it. Scores only (the file exposes no embedding), so only the `scores` candidates are trained.
1. **Procedure**: identical to `scripts/yamnet/train_cv.py` / `evaluate_test.py` / `scripts/eval/*`: same windows, same folds 1-4 for everything chosen
   (augmentation scheme, L2, head family, threshold: Youden J with bedroom-negative FPR <= 5% on clean out-of-fold scores), same pre-registered CV
   criterion (mean pooled OOF AUC over clean and 4 kHz low-passed), fold 5 touched once by `evaluate_test.py`. Fold 5 was already scored by v1, v2 and v3
   (NumPy), so its estimate is optimistic; it is reported as such. Only the feature source changes (`YAMNET_BACKEND=tflite`, TensorFlow 2.16.2
   `tf.lite.Interpreter` from the existing `~/tf_env`, run read-only).
2. **Operating-point rule (unchanged from `docs/MODEL_ERROR_REPORT.md` section 0)**: on the TUNING synthetic nights (folds 1 and 2) choose the configuration
   with maximum segment recall subject to <= 2 false segments per hour, ties broken by the existing simplicity order in `segment_eval.py`; the CHECK
   nights (folds 3 and 4) are reported once and never used to choose. The same grid is searched. The chosen point may differ from the NumPy-era
   t=0.98, M=3, 2-of-14 windows; whatever the rule selects is adopted.
3. **Proceed-to-app criteria** (all must hold, else the iPhone integration stops): fold-5 AUC >= 0.85; fold-5 bedroom-negative FPR <= 10% (the
   existing v3 gate); a configuration exists that meets the rule with tuning false segments/h <= 2; CHECK-night segment recall >= 0.70 and CHECK-night
   false segments/h reported (no bound, but a value above 2 is disclosed as a failure of generalisation).
4. **Redefined parity** (the NumPy port is no longer the reference): (a) the TypeScript head (`src/audio/yamnet/head.ts` on the exported JSON) must reproduce
   the Python head (same rounded weights, float64) on the TFLite scores of the 200 parity windows and 22 fixtures: max abs probability difference < 1e-6 and
   100% identical decisions at both the window threshold and the operating-point threshold; (b) the TS night-logic port must reproduce `night_logic.py`
   segments exactly on the synthetic-night fixtures. On-device (iPhone) TFLite vs desktop TFLite agreement is NOT checkable here and stays unverified.
