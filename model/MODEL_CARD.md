# Model card: SleepSmooth snore-like window classifier

**Version:** `sleepsmooth-snore-mlp-esc50-0.1.0`  **Date:** 2026-10-10
**Weights hash (sha256):** `c8d009574772...` (full value in `src/audio/model/model.json`, field `weightsHash`)
**Shipped:** v1 (clean-only training). A v2 with augmentation was trained and evaluated and not shipped (see "v1 vs v2").
**Status:** prototype. Not clinically validated. Numbers come from `model/metrics.json` (combined), `metrics.v1.json` and `metrics.v2.json`.

## Intended use
Flag a 1 s audio window as having a **snore-like acoustic pattern** (yes/no against a validation-chosen threshold).
Scores are internal and are never shown as a percentage or "confidence". Windows quieter than
`SILENCE_FLOOR_DBFS = -72 dBFS` are reported as "too quiet to assess", not as "no snoring".

## Not for
Detecting sleep apnea, apnea events, airflow, severity, or risk. Ruling anything out or providing reassurance: a window
with no snore-like pattern says nothing about whether someone has sleep apnea. Not a medical device, not a diagnosis.

## Data and licenses
- **ESC-50** (Piczak 2015, https://github.com/karolpiczak/ESC-50): 2,000 five-second Freesound clips, 50 classes, 5 folds.
  License **CC BY-NC 3.0**: attribution required, non-commercial use only. **The trained weights are derived from this data, so
  the weights are non-commercial too (ER-10).** Per-clip attribution: the ESC-50 `LICENSE` file; see also `data/ATTRIBUTION.md`.
- Positives: class `snoring` (40 clips). Negatives: the other 49 classes (1,960 clips).
- **Kaggle snoring dataset: not used in this build** (folder was empty; license still to be verified by the user). The
  pipeline auto-includes it if present (per-source metrics, within-Kaggle test, source-classifier check, exact-duplicate removal).
  Near-duplicate grouping is not implemented.
- **ER-2 source confound:** positives and negatives both come from ESC-50 here, so the "model learns the dataset source"
  confound does not apply to this build. That does not remove other confounds (clip-level Freesound recording conditions), and the
  sample size is tiny (below).
- Bedroom-relevant negatives (reported separately, weighted 2x in training): breathing, coughing, sneezing, clock_tick,
  clock_alarm, rain, wind, crackling_fire, footsteps, door_wood_creaks, door_wood_knock, keyboard_typing, mouse_click,
  brushing_teeth, vacuum_cleaner, washing_machine, toilet_flush, drinking_sipping, laughing, crying_baby, thunderstorm,
  insects, cat, dog.

## Processing and model
- ffmpeg to 16 kHz mono float. 1 s windows, 0.5 s hop (9 per clip). Features: the shared 40-band log-mel (`frameLogMel`), reduced to
  per-band mean and std over the 100 frames = 80 numbers per window, normalized with training-set mean/std.
- **Silence floor (Amendment 2): -72 dBFS RMS**, shared by training and inference. Chosen as the 1st percentile of window RMS among
  non-digital-silent (>= -90 dBFS) windows of folds 1-4 (p1 = -71.2, p5 = -51.9, p10 = -44.2, median = -24.8 dBFS), floored to 1 dB.
  The RMS distribution has no natural gap, so this is a conservative cut that removes padding and near-silence only.
- **Dropped silent windows:** train/val folds 1-4: 13,116 kept, 1,284 dropped. Test fold 5: 3,308 kept, 292 dropped. Snoring: 350 kept,
  10 dropped of 360. Per-class counts: `metrics.json` -> `droppedSilentWindows`. Quiet classes lose many windows (e.g. coughing 125,
  glass_breaking 176, breathing 62 dropped).
- Models (hand-rolled TypeScript, Adam, L2, fixed seed 20261010, class-balanced sample weights): logistic-regression baseline
  and an 80-32-1 MLP (ReLU, sigmoid output). 30 epochs, lr 1e-3, batch 128.

## Split and selection
- Split by ESC-50 fold (clip level, no clip crosses splits). **Fold 5 = test, used once** (`evaluate.ts` refuses to re-run). It also supplies
  the demo sample recording. Folds 1-4: 4-fold grouped cross-validation (each fold held out in turn) to choose model type and L2, and to
  choose the threshold; final model refit on all of folds 1-4.
- CV AUC (pooled out-of-fold): logistic regression 0.864; MLP 0.907 (L2 1e-4 selected). Threshold 0.795: maximizes Youden J on
  out-of-fold predictions subject to a bedroom-negative window FPR <= 5%.
- Train: 13,116 windows (279 snoring, from 32 clips). Test: 3,308 windows (71 snoring, from 8 clips).

## Test results (fold 5, window level, 95% bootstrap CIs resampled by source clip)
| Metric | MLP (shipped) | 95% CI | Logistic regression baseline |
|---|---|---|---|
| ROC-AUC | 0.919 | 0.823 - 0.978 | 0.879 (CI 0.759 - 0.957) |
| Accuracy | 0.947 | 0.929 - 0.964 | 0.954 |
| Precision | 0.230 | 0.072 - 0.385 | 0.158 |
| Recall | 0.620 | 0.365 - 0.864 | 0.268 |
| F1 | 0.336 | 0.126 - 0.493 | 0.199 |
| False-positive rate (all negatives) | 0.045 | 0.030 - 0.062 | 0.031 |
| FP rate, bedroom-relevant negatives | 0.065 | 0.040 - 0.095 | 0.053 |

MLP confusion matrix (windows): TP 44, FP 147, TN 3,090, FN 27. Precision is low because only 2% of test windows are snoring; at
this base rate roughly three of four flagged windows are not snoring. Worst negative classes at the threshold: mouse_click (30% of
windows flagged), crickets (26%), clock_alarm (19%), crackling_fire (17%).

**Robustness** (same fold-5 windows; noise added at the stated SNR relative to clip level; AUC / recall / FP rate):
clean 0.919 / 0.62 / 0.045; white 20 dB 0.895 / 0.69 / 0.099; white 10 dB 0.887 / 0.48 / 0.041; pink 20 dB 0.911 / 0.72 / 0.085;
pink 10 dB 0.915 / 0.56 / 0.054; **8 kHz sampling rate (4 kHz bandwidth, phone proxy): AUC 0.811, recall 0.00**, i.e. at the fixed
threshold the model flags nothing on band-limited audio. Its features depend on energy above 4 kHz, so narrowband input is a known failure.

**Sample recording check (manual review, not a metric):** the 55 s demo recording (fold-5 clips only) gave 23 of 40 snoring-segment windows
flagged, 2 too quiet, and 0 flagged in breathing, rain, clock_tick, wind and insects segments; 16 of 20 gap windows were "too quiet".
Metrics describe this dataset's test split only. They are not performance on a user's recording and not clinical accuracy.

## Gate (PLAN section 4)
AUC >= 0.85: passed (0.919; lower CI bound 0.82 is below 0.85). Beats baseline: passed (0.919 vs 0.879 test AUC; 0.907 vs 0.864 CV).
Ambient FP: passed (bedroom-negative window FPR 6.5% <= 10% criterion). ER-2 confound checks (b), (c): not applicable (ESC-50 only).
Decision: ship as a **prototype**, with the limitations below.

## v1 vs v2 (band-limited audio follow-up)
**Fold 5 was scored twice (v1, v2); v2 changes were decided on cross-validation only, but the test estimate is now mildly optimistic.**

v2 adds training-time augmentation (3 random copies per window: lowpass with p=0.7, cutoff 3.5-8 kHz; white/pink noise with p=0.7 at 10-30 dB SNR;
gain +/-6 dB). All v2 decisions (architecture, L2 = 1e-3, threshold 0.685) used 4-fold CV on folds 1-4, with each validation fold scored clean AND
through a 4 kHz lowpass. Selection criterion: mean of pooled out-of-fold AUC over the two conditions. Threshold rule: maximize Youden J on the pooled
clean + lowpass out-of-fold scores (equal weight) subject to bedroom-negative FPR <= 5% when feasible.

| | v1 (shipped) | v2 (augmented, not shipped) |
|---|---|---|
| CV AUC clean / lowpass-4kHz / criterion | 0.907 / 0.785 / 0.846 | 0.901 / 0.905 / 0.903 |
| Test AUC (95% CI) | 0.919 (0.823-0.978) | 0.880 (0.767-0.951) |
| Test recall / precision | 0.62 / 0.23 | 0.54 / 0.14 |
| Test FP rate, all / bedroom negatives | 0.045 / 0.065 | 0.073 / 0.104 |
| 8 kHz-proxy AUC / recall / FP rate | 0.811 / **0.00** / 0.007 | 0.901 / **0.39** / 0.037 |
| White 10 dB SNR recall | 0.48 | 0.68 |
| Demo sample: snoring windows flagged / other flagged | 23 of 40 / 0 | 17 of 40 / 2 (1 gap, 1 clock_tick) |
| Gate | pass | **fail** (bedroom FP 10.4% > 10%) |

Decision: v2 is better on the CV criterion and is the only one with non-zero band-limited recall, but it fails the ambient false-positive gate on
fold 5 (by 0.4 points; the gate was not relaxed after seeing the result). Rule: ship the best version that passes the gate, so **v1 ships**.
**v1 has zero recall on 8 kHz-sampled audio; the app should treat band-limited recordings as not assessable.** The v2 weights are not exported.

## Limitations
- **Tiny positive set:** 40 snoring clips (8 in test); wide CIs; results can change a lot with different clips.
- 5 s Freesound clips, not overnight phone audio; unknown devices, microphones, rooms, distances, bed partners, speakers.
- Fails on narrowband (8 kHz-sampled) audio (recall 0.00; see v1 vs v2); sensitive to some click/tonal sounds (mouse clicks, crickets, alarms).
- No demographic information; performance across ages, sexes, body types, and snoring types is unknown.
- Snore-like sound is not apnea: loud snoring is neither necessary nor sufficient for sleep apnea.
- Not clinically validated. Weights are non-commercial (CC BY-NC 3.0). Browser resampling differs slightly from the ffmpeg
  resampling used in training.

## Reproduce
`npm run train:all` (v1: prepare, extract features, train, evaluate once, export, build sample). v2: `npm run train:v2` (augment, train-v2, evaluate with `TRAINED_FILE=trained.v2.json METRICS_FILE=metrics.v2.json`). Sample audio:
`public/sample-audio/esc50-sample.wav` (attribution in the same folder). Raw data and `data/processed/` are git-ignored.

## v3: YAMNet-based snore-like head (evaluated; NOT yet wired into the app)
**Status:** passes the pre-registered gate and has the best CV criterion, so it is the model to ship **once YAMNet can run on-device**
(`docs/YAMNET_INTEGRATION.md`). The shipped app still uses v1 (`src/audio/model/model.json`) until then. Numbers: `model/metrics.v3.json`.
Exported head: `src/audio/model/model.v3.json` (`sleepsmooth-snore-yamnet-logreg_scores-0.3.0`, logistic regression on the logit of YAMNet's 521
class scores, sha256 `a2d15387...`, threshold 0.6495). Pure-TS scorer and tests: `src/audio/yamnet/head.ts`.

**What v3 is.** v1 plus a frozen YAMNet (Google, MobileNet-style audio classifier trained on AudioSet) in front. Same windows, same folds, same
silence floor as v1. YAMNet is run by a **NumPy re-implementation** of the official Keras weights (`scripts/yamnet/yamnet_np.py`; no TF/TFLite
runtime is installed). It passed a functional sanity check (expected AudioSet class in top-5 for 714/832 ESC-50 folds 1-4 clips; snoring 32/32) but
**has not been compared numerically with the official TFLite output**. Everything below is conditional on that.

**Data and licenses.** ESC-50, CC BY-NC 3.0 (as v1): **the v3 head weights are derived from it and are non-commercial.** YAMNet: Apache 2.0.
AudioSet labels: CC BY 4.0. Kaggle snoring dataset: not present in this build (pipeline ready, see below).

**Split and selection (folds 1-4 only; fold 5 untouched until the single evaluation).** Same 4-fold grouped CV as v1. Candidates: YAMNet zero-shot
(Snoring score), and logistic regression / 1-hidden-layer MLP (32) on either the 1024-d embedding or the 521 class-score logits, each with and without the
v2 augmentation. Pre-registered criterion: mean pooled out-of-fold AUC over clean and 4 kHz-lowpass validation (v1: 0.846). Threshold: Youden J on clean
out-of-fold scores with bedroom-negative FPR <= 5%. Normalization fit on training folds only. Winner by criterion: `logreg[scores]+aug l2=0.01` (0.9690),
effectively tied with `logreg[emb]+aug l2=1` (0.9686), `mlp[emb]` (0.9630) and zero-shot (0.9127). The ties mean the head type is not what matters;
I exported the CV winner, which also happens to be the one deployable with the already-downloaded classification TFLite.

**Fold-5 test results** (window level, 3,308 windows, 71 snoring from 8 clips, 95% bootstrap CIs resampled by source clip, one evaluation):
| | v1 (shipped) | YAMNet zero-shot | v3 logreg on scores (export) | logreg on embedding | MLP on embedding |
|---|---|---|---|---|---|
| ROC-AUC | 0.919 (0.828-0.974) | 0.920 (0.848-0.990) | **0.986 (0.968-0.997)** | 0.985 (0.973-0.995) | 0.986 (0.972-0.996) |
| Recall | 0.62 | 0.80 | 0.89 (0.76-1.00) | 0.87 | 0.85 |
| Precision | 0.23 | 0.32 | 0.38 (0.19-0.54) | 0.38 | 0.38 |
| F1 | 0.34 | 0.45 | 0.54 (0.32-0.68) | 0.53 | 0.53 |
| FP rate, all negatives | 0.045 | 0.038 | 0.031 (0.023-0.040) | 0.032 | 0.030 |
| FP rate, bedroom negatives | 0.065 | 0.053 | 0.040 (0.028-0.053) | 0.047 | 0.044 |
| CV AUC clean / lp4k / criterion | 0.907 / 0.785 / 0.846 | 0.918 / 0.908 / 0.913 | 0.971 / 0.967 / 0.969 | 0.970 / 0.967 / 0.969 | 0.967 / 0.959 / 0.963 |
| In-sample train AUC (clean) | n/a | n/a (nothing fitted) | 0.990 | 0.980 | 0.987 |
Paired AUC difference v3-logreg-scores minus v1: +0.067, 95% CI +0.011 to +0.160 (clip bootstrap). v3 vs zero-shot: +0.066 (+0.003 to +0.132).
Precision stays low because 2% of test windows are snoring: about 3 in 5 flags are not snoring. Worst negative classes for the export: breathing 16%,
rooster 16%, door_wood_knock and glass_breaking 15% of windows flagged.

**Overfitting check.** Train (in-sample) 0.990, CV 0.971, test 0.986: a train-CV gap of about 0.02 and no test drop below CV. With 8 positive test clips the
test CI (0.968-0.997) is wide enough that test ~ CV is the honest reading, not "test is better". Fold 5 was scored by v1 and v2 before v3, so the test
number is **mildly optimistic**.

**Robustness** (same fixed thresholds; AUC / recall / FP rate; v1 numbers from `metrics.v1.json`, different noise draw):
| Condition | v1 | zero-shot | v3 export |
|---|---|---|---|
| clean | 0.919 / 0.62 / 0.045 | 0.920 / 0.80 / 0.038 | 0.986 / 0.89 / 0.031 |
| white 20 dB | 0.895 / 0.69 / 0.099 | 0.932 / 0.68 / 0.060 | 0.960 / 0.80 / 0.064 |
| white 10 dB | 0.887 / 0.48 / 0.041 | 0.832 / 0.38 / 0.046 | 0.918 / 0.68 / 0.074 |
| pink 20 dB | 0.911 / 0.72 / 0.085 | 0.948 / 0.83 / 0.055 | 0.979 / 0.90 / 0.057 |
| pink 10 dB | 0.915 / 0.56 / 0.054 | 0.924 / 0.66 / 0.046 | 0.963 / 0.82 / 0.062 |
| 8 kHz sampling (phone proxy) | 0.811 / **0.00** / 0.007 | 0.900 / 0.72 / 0.049 | 0.971 / 0.79 / 0.037 |
Bedroom-negative FP rate of the export under noise rises to 0.07 to 0.09 (still under the 10% criterion, but the criterion was only a gate on clean audio).

**Calibration.** Scores are class-weighted, not probabilities, and are never shown to users. Fixed-width reliability table (export, fold 5):
score 0-0.1: 2,720 windows, 0.07% snoring; 0.5-0.6: 6.7%; 0.7-0.8: 9.7%; 0.8-0.9: 40%; 0.9-1.0: 81% (59 windows). Monotone but far from
the diagonal at mid scores because training up-weights the rare class; do not read a score as a chance.

**Decision v1 vs v3.** Gate (unchanged from v1: AUC >= 0.85, beats baseline, bedroom-negative FPR <= 10%): all five v3 candidates pass; "baseline" for v3 heads
is the YAMNet zero-shot score (test AUC 0.920). Rule fixed before the test fold was read: ship the highest-CV-criterion passing candidate including v1. v3 wins
(0.969 vs 0.846). The decision rests mostly on cross-validation and the lowpass condition, where v1 is clearly worse; the clean fold-5 AUC difference
is real but based on 8 positive clips.

**YAMNet sound-category tags** (no training; `src/audio/yamnet/tags.ts`; fold 5, clip level, 8 positive clips per class; thresholds from folds 1-4,
which for snore-like and cough-like landed on the grid ceiling 0.95): snore-like P 0.88 / R 0.88; cough-like P 1.00 / R 0.50; sneeze-like P 1.00 / R 0.38;
breathing P 0.22 / R 0.50 (hidden). Gasp-like and wheeze-like: **unevaluated** (no ESC-50 ground truth), no threshold, hidden. Speech exclusion: unvalidated.

**Limitations specific to v3.** Tiny positive sets (40 snoring clips overall; 8 in test). ESC-50 clips are Freesound recordings and AudioSet is YouTube, but I
could not check overlap between them; YAMNet may have seen similar material, which could flatter results. No Kaggle data yet, so there is no cross-dataset
evidence. Not overnight phone audio. Embeddings come from a re-implementation (parity unverified). Snore-like sound is not apnea.

**Kaggle snoring dataset (pending).** When `data/raw/kaggle-snoring/` is populated, `npm run yamnet:all` automatically: groups clips (filename stem plus
near-duplicate embeddings) and assigns whole groups to folds; runs a source-confound check (Kaggle vs ESC-50 on negatives, positives, and loudness alone;
flagged if AUC >= 0.95); reports per-source metrics; runs cross-dataset tests (ESC-50 to Kaggle and Kaggle to ESC-50, the main generalization evidence); adds
a within-Kaggle AUC >= 0.85 and not-trivially-separable condition to the gate; writes `model/metrics.v3.kaggle.json`. That path was smoke-tested only on a
synthetic folder built from ESC-50 clips (grouping verified on injected duplicates); the combined-training and evaluation steps have not run on real Kaggle data.
License marked "Unknown, non-commercial research use only, to verify".

**What real validation needs.** Person-level splits on real overnight phone recordings (different phones, rooms, partners), and ideally PSG-Audio (or similar)
with clinician-scored events and metadata, evaluated per person. Until then v3 is a prototype snore-like detector, not a clinical tool.

**Reproduce v3.** `npm run yamnet:all` (about 40 minutes; Python 3.12 + NumPy/SciPy only, run with `python3 -I`).
