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

### 7.1 Results of the v3t retrain (2026-10-16; SYNTHETIC nights and development data only; files in `model/tflite_retrain/`)
* **Fold 5 (touched once for v3t; already burned earlier, so optimistic; 8 snoring clips, 71 positive windows, 3,308 windows):** AUC 0.975 (95% clip-bootstrap 0.929-0.999; NumPy-era v3 0.986),
  recall 0.944 at threshold 0.5085 (0.884-1.0; before 0.887), precision 0.419, window FPR 0.029, bedroom-negative FPR 0.045 (0.030-0.064; before 0.040). 8 kHz phone proxy: AUC 0.971, recall 0.915 (before 0.789), bedroom FPR 0.042.
  Worse than before: breathing-class false-positive rate 35% (was 16%); with white/pink noise at 20 or 10 dB SNR the bedroom FPR rises to 0.094-0.116 (above the 10% level in 2 of 4 conditions; before 0.074-0.087).
* **Operating point by the pre-registered rule (tuning nights, folds 1-2):** t = 0.9, M = 3 flagged windows, 4-of-14 windows (7 s) confirmation. Tuning: 1.75 false segments/h, segment recall 0.915 (43/47 bouts). CHECK nights (folds 3-4, reported once): 1.05 false segments/h (bootstrap over nights 0.0-3.05), segment recall 0.830 (39/47; normal 1.00, quiet 0.56, brief 0.55; CI 0.67-0.96). Pooled 20 nights: 1.40/h, recall 0.872. The NumPy-era point was t = 0.98, M = 3, 2-of-14: 0.85/h and recall 0.915 on tuning, 0.00/h and 0.851 on check.
  Largest false-segment sources: breathing bed (8.25/h over 4 h) and thunderstorm bed (9.5/h over 2 h); both beds are synthetic.
* **Pre-registered proceed criteria (7.3): all met** (AUC >= 0.85; bedroom FPR <= 10% on clean audio; rule met on tuning; check recall 0.83 >= 0.70).
* **Redefined parity (7.4a): met** for the TS head. 7.4b (TS night-logic port) not done. Phone-vs-desktop TFLite agreement: NOT VERIFIED.
* **Blocker unrelated to accuracy:** the TFLite file's official checksum could not be obtained (`docs/YAMNET_INTEGRATION.md`, "Provenance check"), so the model is not bundled into the app and nothing was integrated.

## 8. Stage 3: level-gate (GATE_DB) re-evaluation with the shipped v3 head, pre-registered BEFORE any lowered-gate result was computed
Written 2026-10-19T06:35Z (system clock, UTC). No window below the current gate (floor + 6 dB) had been scored by v3 on the synthetic nights at this time.
1. **Question.** The level gate (`GATE_DB = 6` above the rolling 10th-percentile noise floor) decides which windows are analysed at all; in the labeled sample night only
   21 of about 420 minutes were assessable. Can the gate be lowered, so more of the night is assessable, without losing the operating-point guarantees?
2. **Model and operating point (fixed, not searched).** Original v3 head (float TFLite, parity PASS) at the pre-registered operating point from
   `model/segment_eval.synthetic.json`: flag at head probability >= 0.98, confirm 2-of-14 windows (7 s), segment = at least 3 confirmed windows with gaps <= 10 s.
3. **Candidates.** `GATE_DB` in {0, 1, 2, 3, 4, 6} dB (6 = current). The silence floor (-72 dBFS) and the rolling floor are unchanged. Windows are scored exactly as
   in `scripts/eval/synthetic_nights.py` (same seeds, same out-of-fold heads); one render at the lowest gate supplies the scores of every candidate, because a
   window passes gate G iff level >= max(-72, floor + G).
4. **Rule (lower the gate as far as possible, no further).** On the TUNING nights (folds 1-2 only) the chosen gate is the LOWEST candidate G such that
   (a) false segments per hour <= 2.0 AND (b) segment recall (all bouts, 5 s tolerance as in `segment_eval.py`) is >= the recall at G = 6. If no candidate below 6 meets both,
   GATE_DB stays 6. The CHECK nights (folds 3-4) are reported once and are NOT used to choose. If CHECK false segments per hour at the chosen G exceed 2.0, that is disclosed
   as a failure of generalisation and the gate is NOT lowered (stays 6); there is no second search.
5. **Reported for every candidate, tuning and check:** false segments per hour, segment recall, scored windows, and the assessable fraction
   = scored windows / all windows (and scored / windows above the silence floor). On the sample night (`public/sample-audio` night) the assessable minutes are reported before and after.
6. **What this does NOT show.** Synthetic nights use ESC-50 backgrounds over a constant -62 dBFS pink room tone and 8 snorers per fold; they say nothing about
   how much of a real quiet bedroom becomes assessable, or what a real bedroom's false segments per hour are. That is unknown without device data.

### 8.1 Night rule (NIGHT_MIN_EPISODES, NIGHT_MIN_EPISODE_SEC) re-derivation, pre-registered BEFORE any segment duration at the v3 operating point was tabulated
Written 2026-10-19T06:50Z (system clock, UTC); the lowered-gate render was still running and no flagged-seconds distribution had been computed.
1. **Context.** The night state `snore-like-observed` fires iff `episodes >= NIGHT_MIN_EPISODES` AND `episodeFlaggedSec >= NIGHT_MIN_EPISODE_SEC`. The old values (3 and 120 s) were set for the v1 flags; at t=0.98 with 2-of-14 confirmation, each bout yields far fewer flagged seconds (window recall of all positive windows is about 0.35 to 0.39), so 120 s may be unreachable. `flaggedSec` is the union of the flagged windows' time exactly as `findEpisodes` computes it.
2. **Inputs.** Segments at the operating point (t=0.98, 2-of-14, M=3) on the SYNTHETIC nights at the gate adopted in section 8. Each night is a unit; a segment is TRUE if it overlaps a bout (5 s tolerance, as in `segment_eval.py`), else FALSE.
3. **Candidates.** E in {1, 2, 3, 4, 5}, S in {10, 20, 30, 45, 60, 90, 120} seconds.
4. **Rule.** On the TUNING nights (folds 1-2) a candidate is admissible if NO tuning night fires from its FALSE segments alone (false-fire nights = 0). Among admissible candidates choose the one that fires on the most tuning nights from all segments; ties go to the larger E, then the larger S. If none is admissible the old values (3, 120) are kept. CHECK nights (folds 3-4) are reported once and not used to choose.
5. **Reported:** per candidate, tuning and check: nights firing (all segments), nights firing from false segments alone, and the false segments per hour. Also the distribution (min, median, max) of flagged seconds per TRUE and per FALSE segment.
6. **Limits.** With 10 tuning nights and a handful of false segments, the false-fire count has almost no statistical power; this is a documented engineering choice on synthetic data and carries no clinical meaning. It does not estimate how often a real night without snoring would fire.

### 8.2 Results (computed 2026-10-19 after sections 8 and 8.1 were written; SYNTHETIC nights only; `model/gate_sweep.synthetic.json`, `model/night_rule_sweep.synthetic.json`)
Order of events, stated plainly: the gate-0 render (`gate_sweep.py render`) was started at about 06:33Z, section 8 was written at 06:35Z while the first nights were
still rendering, section 8.1 at 06:50Z; no lowered-gate score, segment or flagged-seconds number was looked at before both were written. Each sweep was run once.

**Gate (section 8).** Fixed operating point t=0.98, 2-of-14, M=3. Consistency check passed: at G=6 the gate-0 render reproduces the original synthetic-night
result (tuning 0.85 false segments/h, recall 0.915; check 0.00/h, 0.851).

| GATE_DB | Tuning false seg/h | Tuning recall | Tuning assessable | Check false seg/h | Check recall | Check assessable |
|---|---|---|---|---|---|---|
| 0 | 12.15 | 0.915 (43/47) | 0.872 | 0.00 | 0.851 (40/47) | 0.894 |
| 1 | 11.85 | 0.915 | 0.695 | 0.00 | 0.851 | 0.816 |
| 2 | 10.65 | 0.915 | 0.522 | 0.00 | 0.851 | 0.701 |
| 3 | 8.30 | 0.915 | 0.400 | 0.00 | 0.851 | 0.569 |
| 4 | 5.10 | 0.915 | 0.309 | 0.00 | 0.851 | 0.445 |
| **6 (kept)** | **0.85** | **0.915** | **0.184** | **0.00** | **0.851** | **0.278** |

"Assessable" = scored windows / all windows (every synthetic window is above the -72 dBFS silence floor, so scored / above-floor is the same number).
**Decision by the rule: no candidate below 6 dB meets <= 2.0 false segments/h on the tuning nights, so GATE_DB stays 6.** Lowering the gate buys analysed time
(pooled 23% of windows at 6 dB, up to 88% at 0 dB) but no recall at this operating point, while false segments on the tuning nights rise 6- to 14-fold. Sources of the extra false segments were not broken down.
The app's labelled sample night (about 28 of 480 minutes assessable, `src/night/sample.ts`) is a hand-built illustration, not a rendered recording, so it does
not respond to `GATE_DB` and is unchanged. How much of a real quiet bedroom passes the gate is unknown.

**Night rule (section 8.1), at GATE_DB 6.** Chosen by the rule: **NIGHT_MIN_EPISODES = 5, NIGHT_MIN_EPISODE_SEC = 60 s** (old 3 / 120 s). Tuning: 7/10 nights fire,
0/10 fire from false segments alone; check: 8/10 and 0/10 (old values: 4/10 and 4/10, 0 false-only). Every candidate with S <= 45 s (any E) had 1-2 tuning nights firing
from false segments alone. Flagged seconds per segment (union of windows, as `findEpisodes`): TRUE segments median 5.0 s (tuning, n=130, range 2.0-52.0) and
5.5 s (check, n=118, 2.0-81.5); FALSE segments median 3.5 s (tuning, n=17, range 2.5-13.5; none on check). False segments per hour: tuning 0.85, check 0.00.
The episode minimum (`NIGHT_EPISODE_MIN_FLAGGED`) was set to 3 so the summary's episodes are exactly the operating point's segments (M=3); it is not a searched value.
**Caveat (thin margin):** the worst tuning night (breathing background, 2 h) had 11 false segments with 53 s of false flagged time; a real 7-8 h night with a
similar sound would very likely exceed 60 s and read "snore-like observed". That error direction prompts a clinician conversation rather than reassuring anyone,
but it is still a false observation. 20 synthetic nights from 32 snoring clips cannot estimate real-night rates.
