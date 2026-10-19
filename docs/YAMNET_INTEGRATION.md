# YAMNet integration plan (v3 snore-like head and clip tags)

Status: **design only. Nothing in the web bundle or `mobile/` uses YAMNet today.** The v3 head (`src/audio/model/model.v3.json`) and tag
mapping (`src/audio/yamnet/tags.ts`) are pure TypeScript with tests; the thing that is missing is a way to run YAMNet on the phone.

## What the phone must produce
For each analysis window (v1 uses 1 s windows, 0.5 s hop) one YAMNet patch: the **centred 15,600 samples** (0.975 s, 16 kHz mono float in
[-1, 1]) of the window. YAMNet returns 521 sigmoid class scores (and, in some builds, a 1024-d embedding).

* Exported head `sleepsmooth-snore-yamnet-logreg_scores-0.3.0` consumes `scoresToLogits(scores[521])` (`src/audio/yamnet/head.ts`), so it works
  with the **already-downloaded classification TFLite** (`data/raw/yamnet/lite-model_yamnet_classification_tflite_1.tflite`, 4.1 MB). I checked the file:
  its input is a raw 16 kHz waveform (the STFT/mel frontend is inside the graph) and it exposes the class scores only, **not the embedding**.
* The embedding-input heads (logreg/MLP on 1024-d) tested equally well (`model/metrics.v3.json`), but need a YAMNet build that outputs the embedding
  (TF Hub `yamnet/tflite` embedding variant, not downloaded) or a Keras-to-TFLite/Core ML conversion (needs TensorFlow/coremltools). Not needed.
* Tags (`tagClip`) need only the 521 scores per frame, and only for the handful of clips the night selector already saves (see
  `docs/YAMNET_CLIP_CATEGORIES.md`). That is a few hundred patches per night, not 60,000.

## Options for running YAMNet on iPhone
| | A. TFLite via `react-native-fast-tflite` (recommended) | B. Core ML via a custom Expo module |
|---|---|---|
| Model file | the approved 4.1 MB `.tflite` (scores only) | `.mlpackage` from `coremltools` conversion of the Keras model; fp16 weights about 7.5 MB (estimate: 3.72 M params x 2 bytes) |
| Extra installs | one npm package in `mobile/` plus a CocoaPod it pulls in; **nothing new on this Mac** | TensorFlow + coremltools in Python (hundreds of MB, needs approval) and a Swift module; the mel frontend must be rebuilt natively (Accelerate vDSP) because Core ML conversion of the Keras trunk starts after the frontend |
| Native dependency | yes (JSI module, TFLite C runtime; optional Core ML delegate on iOS) | yes (own Swift module; fits the existing `mobile/modules/` pattern) |
| Expo Go | **not compatible** (native code). The app is already a dev-client build (`expo-dev-client`, a local Swift module), so this adds no new limitation | not compatible, same reason |
| Free Apple ID | works: no entitlements or capabilities needed, same 7-day re-sign as the current build (see `mobile/DEVICE_TEST.md`) | works for the same reason |
| Effort | low: bundle the file as an asset, 15,600 floats in, 521 floats out | high: conversion, frontend port, parity testing |
| Risk | library maintenance/compatibility with RN 0.86 and Expo 57 is **unverified** (I did not install it) | conversion fidelity of the frontend is unverified |

Recommendation: **A**, using the approved classification TFLite and the `logreg_scores` head. Fallback if the package does not build against this
RN/Expo version: run YAMNet only on clips (tags) via any approach and keep v1 for continuous scoring.

Do not run YAMNet in the JS thread: 69.2 M multiply-adds per patch (counted from the architecture) is far too slow for continuous use there.

## Size budget (estimates unless stated)
| Item | Size |
|---|---|
| YAMNet classification TFLite | 4.1 MB (measured file size) |
| Head JSON (`model.v3.json`, 521-d logistic regression) | 18 KB (measured) |
| TFLite runtime in the iOS binary | a few MB (estimate, depends on the package version and delegates) |
| Total added to the app | roughly 5 to 10 MB (estimate) |

## CPU / battery per 8 h night (ESTIMATE, not measured on a phone)
* Work: 69.2 M MACs = 0.138 GFLOP per patch (counted). Hop 0.5 s: 57,600 patches per night = **about 8 TFLOP**. Hop 1 s: about 4 TFLOP.
  Only scoring windows above the silence floor, or only windows the existing v1 model flags, would cut this a lot, but that gating changes
  what the head sees and has not been evaluated.
* If a recent iPhone sustains 5 to 20 GFLOP/s effective on TFLite CPU (assumption, not measured; a Core ML/Neural Engine delegate should be lower energy):
  8 TFLOP takes about 7 to 27 minutes of CPU per night, i.e. a 1.5 to 6 percent duty cycle.
* Energy: at an assumed 1 to 2 W while computing, that is about 0.1 to 0.9 Wh per night against a typical 10 to 13 Wh phone battery
  (assumption), so a few percent. Microphone capture, the audio session and the screen-locked background mode probably cost more.
  **Measure on the device before claiming anything** (Xcode Instruments Energy Log, one 8 h run).
* Reference point measured here: the NumPy re-implementation runs roughly 40 to 60 patches/s on this (busy) Mac CPU.

## Runtime parity (Oct 2026: harness ready, NOT yet run)
`scripts/yamnet/yamnet_np.py` is a NumPy re-implementation built from Google's official Keras weights. It passes a functional sanity check
(`data/processed/yamnet/sanity_classes.json`: the expected AudioSet class is in the top 5 for 714 of 832 ESC-50 folds 1-4 clips over 26 mapped
classes; snoring 32/32) but **has not been compared numerically with the official TFLite output**, and the head was trained on the re-implementation's
scores. The TFLite file's own metadata says it is "8 bit quantized internally", so small score differences are expected; whether they move the head's
decisions near the threshold is the thing to measure. An external reviewer raised this point and we agree.

**Harness:** `scripts/yamnet/parity.py` (shell entry point: `scripts/yamnet/run_parity.sh`).
- `export` (needs only what the repo already uses; no TFLite runtime): picks 200 development windows (folds 1-4 only, fixed seed: 50 snoring, 50 of the
  highest-scoring negatives, 100 random negatives), computes NumPy scores, writes `data/processed/yamnet/parity_waveforms.npz`. Already run.
- `compare` (needs NumPy + a TFLite interpreter): runs the official TFLite on the same 200 waveforms and writes `model/parity.v3.json`:
  max / mean / 99th-percentile absolute score difference over all 521 outputs, top-1 and top-5 agreement, the Snoring-class (38) difference, and the head
  decision agreement (disagreements, how many fall within 0.05 of the threshold, per group). **`model/parity.v3.json` does not exist until a real run;
  its absence means parity is unverified.**
- Read the result as: any disagreement of the head decision on the 50 positives or the 50 hard negatives is a finding. If the decisions disagree on more
  than a small fraction of windows near the threshold, retrain the head on TFLite scores (`extract.py` with the TFLite runtime in place of `yamnet_np`)
  and re-do CV; do not just move the threshold.

**Runtime package (not installed; needs your approval).** This Mac is Intel x86_64 (Core i5-8257U), macOS 15, default Python 3.12.7. There is **no
macOS-x86_64 wheel for Python 3.12** of the small runtimes: `ai-edge-litert` (all versions from 1.1.0 up, latest 2.3.0) ships macOS wheels for arm64
only, and `tflite-runtime` has no macOS wheel newer than 2.5.0 (Python 3.5 to 3.8). Smallest working option found (checked on PyPI metadata, not installed):
- **`ai-edge-litert==1.0.1`**, wheel `ai_edge_litert-1.0.1-cp311-cp311-macosx_10_15_x86_64.whl`, **2,817,400 bytes (2.82 MB)**, requires only `numpy>=1.23.2`.
  Needs Python 3.11; `/usr/local/bin/python3.11` (3.11.5, with NumPy 2.4.1) is already on this machine. Suggested, in a throwaway venv:
  `/usr/local/bin/python3.11 -m venv --system-site-packages /tmp/litert-venv && /tmp/litert-venv/bin/pip install ai-edge-litert==1.0.1 && /tmp/litert-venv/bin/python scripts/yamnet/parity.py compare`.
  Risk, unverified: the wheel was built in Aug 2024 and may have been compiled against NumPy 1.x; if importing it under NumPy 2.4 fails with an ABI error,
  use a venv with `numpy<2` (about 20 MB more) instead.
- Fallback if that fails: `tensorflow==2.16.2` (`tensorflow-2.16.2-cp312-cp312-macosx_10_15_x86_64.whl`, **259.7 MB** wheel plus dependencies), the last
  TensorFlow release with a macOS x86_64 / Python 3.12 wheel. Much larger; only if the small package does not work.
- Apple-silicon machine: `ai-edge-litert==2.3.0` (cp312, macosx_12_0_arm64, 12.83 MB) works with the default Python 3.12 directly.
No runtime was installed or run to produce this section.

**Re-validating on the phone (identical audio, expected scores).** `parity.py export` also writes fixtures the app can load and compare:
- `scripts/yamnet/fixtures/synthetic_fixtures.json` (committable; 4 generated waveforms: 440 Hz tone, white noise, amplitude-modulated noise, near-silence).
- `data/processed/yamnet/phone_fixtures.json` (git-ignored; 18 ESC-50-derived windows, CC BY-NC, snoring / hard negative / random negative).
Each fixture holds the exact 15,600 float32 samples (little-endian, base64, plus a sha256 so the phone can prove it fed the same bytes), the 521 expected scores from the
NumPy implementation (`expectedNumpy`), the head score and decision (threshold 0.6495), and, once `compare` has run, the official TFLite reference
(`expectedTflite`). On the device: decode the samples, run the shipped TFLite (no preprocessing, no AGC, 16 kHz mono float in [-1, 1]), and check (1) output
shape 521, (2) max abs score difference to `expectedTflite` (should be ~1e-6 for the same model file on a different CPU; larger for a different
delegate, in which case record it), (3) the head decision equals `expectedTflite.headDecision` for every fixture. Until `expectedTflite` exists, compare to
`expectedNumpy` and expect quantization-sized differences, not identity.

## Other requirements
* The phone resampler (`src/night/resample.ts`) must deliver 16 kHz mono; YAMNet is sensitive to level only through the log-mel, so apply no AGC.
* Keep the existing "too quiet to assess" rule (-72 dBFS) in front of the head.
* Scores are never shown as percentages. A below-threshold result is not reassurance.

## Parity pass criteria (pre-registered)
Written 2026-10-16T06:12:38Z, BEFORE the first real `compare` run (no `model/parity.v3.json` existed at this time). These were not defined elsewhere in the repo.
Windows: the 200 development windows of `parity.py export` (ESC-50 folds 1-4 only) plus the 4 synthetic fixtures. Verdict is PASS only if ALL hold:
1. Head probability: max absolute difference NumPy vs TFLite < 0.01 over the 200 windows.
2. Head decisions identical on at least 99% of windows (>= 198 of 200), evaluated at BOTH the window threshold 0.6495 and the night operating-point
   threshold 0.98 (the one the app will use for segments).
3. No decision disagreement among the 50 snoring-positive windows or the 50 hard negatives at 0.98 beyond 1 window each (a larger count is a FAIL even if 1 and 2 hold).
Reported, not gating: class-score max/mean/p99 absolute difference, top-1 and top-5 agreement, Snoring class (38) difference.
FAIL means: STOP the iPhone integration and report; v3 metrics were computed with the NumPy port and do not transfer.

**First `compare` attempt (Oct 2026): NOT RUN, parity still UNVERIFIED.** `ai-edge-litert==1.0.1` installed (`pip install --user`, Python 3.11.5) but fails at
`Interpreter(...)` with `_ARRAY_API not found` / "module compiled using NumPy 1.x cannot be run in NumPy 2.4.1" (the ABI risk flagged above). The only
workaround is `numpy<2` for cp311 (not installed; no cp311 NumPy 1.x exists on this Mac) or a TensorFlow runtime, neither approved. `model/parity.v3.json` was not written.

**Parity result (Oct 2026): FAIL against the pre-registered criteria.** Runtime: TensorFlow 2.16.2 `tf.lite.Interpreter` (XNNPACK, x86_64) from the existing
`~/tf_env`, run read-only by a TFLite-only script; scores were passed to `parity.py compare` via `PARITY_TFLITE_SCORES`. 200 development windows
(`model/parity.v3.json`): class-score max abs diff 0.975, mean 0.0029, p99 0.058; top-1 agreement 52.5%, top-5 set agreement 11.5%; Snoring (38) max diff
0.854; head probability max abs diff 0.882 (criterion < 0.01); head decisions identical on 83.0% at 0.6495 and 86.5% at 0.98 (criterion >= 99%);
at 0.98 the disagreements are 18 of 50 positives and 7 of 50 hard negatives (criterion <= 1 each). Both implementations rank the snoring class highest on
average for positives (mean score 0.52 NumPy, 0.62 TFLite) so neither is obviously broken, but per-window agreement is far too low for the v3 metrics
(computed with the NumPy port) to transfer to the TFLite runtime. Not diagnosed: whether the cause is the quantized graph, a frontend difference or a harness issue.
Per the protocol the head must be retrained on TFLite scores and re-evaluated before any on-device claim; iPhone integration was NOT started.

## Provenance check of the YAMNet files (2026-10-15)
* `yamnet.h5`: md5 `8234225c045859752bd4a2e101f8cd1a`, 15,296,092 bytes. Matches the ETag / `x-goog-hash` md5 (`gjQiXARYWXUr1KLhAfjNGg==`) returned by a HEAD request to
  `https://storage.googleapis.com/audioset/yamnet.h5`. VERIFIED against Google's object metadata.
* `lite-model_yamnet_classification_tflite_1.tflite` (sha256 `10c95ea3eb9a7bb4cb8bddf6feb023250381008177ac162ce169694d05c317de`, 4,126,810 bytes): **NOT VERIFIED.**
  The old TF Hub bucket paths (`storage.googleapis.com/tfhub-lite-models/...`) now return 403 for anonymous callers, `tfhub.dev` returns 404, and the Kaggle Models page
  (`kaggle.com/models/google/yamnet/tfLite/classification-tflite/1`) only serves a `.tar.gz` bundle (3,240,957 bytes, md5 `uE8DZmydcMuFuelFZ6+FMA==`, crc32c `SZQBBw==`
  from a 1-byte ranged GET). That is the hash of the archive, not of the .tflite inside it, so it cannot be compared with our file without downloading and unpacking the
  archive. No official per-file hash is published. The file is therefore NOT pinned and NOT copied into `mobile/assets`.

## Parity diagnosis (2026-10-16): the NumPy port is correct; the TFLite file is a different (quantised) model
Run in `~/tf_env` (read-only, TensorFlow 2.16.2), same 200 windows (`model/parity.v3.json` for the first comparison):
* NumPy port vs the same weights run with `tf.nn` ops and the official `tf.signal` frontend (STFT 400/160/512, mel 125-7500 Hz x64, log(x+0.001)): class-score max abs diff 0.0000 (float32 rounding), top-1 agreement 100%. Frontend log-mel max diff 1.7e-3 (FFT precision). So the port is faithful.
* TFLite graph (`tf.lite.experimental.Analyzer`): input `waveform_binary` float32 [15600]; frontend in float (frame 400/hop 160 via GATHER, Hann, RFFT 512, COMPLEX_ABS, 64x257 mel, LOG, 96x64 patch); then QUANTIZE to int8 (scale 0.048, zero point 16, range [-6.92, 5.33], no saturation on these windows); the whole conv tower is int8 with ReLU6-fused layers; the logistic output is int8 with scale 1/256 (scores come in steps of 0.0039 and cannot exceed 0.996).
* TFLite frontend (tensor 27) vs `tf.signal`: max diff 1.1e-3, so the frontend agrees; the divergence is in the int8 tower. Float tower with ReLU6 vs float tower with ReLU: top-1 agrees 96.5% (so ReLU6 alone is minor); Keras-float vs TFLite: top-1 agrees 53.5%, max diff 0.975, snoring-class correlation 0.82 on positives, 0.68 on hard negatives, 0.14 on random negatives.
* Conclusion: the deviation is in the quantised TFLite model, not the NumPy port. v3 metrics hold for float YAMNet and say nothing certain about the TFLite file; hence the retrain below.
* Reproduce: `scripts/yamnet/run_tflite_retrain.sh` (TFLite features, outputs under `data/processed_tflite/` and `model/tflite_retrain/`, nothing shipped is overwritten).

### v3t: head retrained on TFLite class scores (pre-registered in `docs/EVAL_PROTOCOL.md` section 7)
* CV (folds 1-4, same grid): best by the pre-registered criterion = logistic regression on logit(scores), augmentation copies, L2 = 0.1 (criterion 0.9800; the NumPy-era head was chosen with L2 = 0.01). Threshold 0.5085 (clean OOF, bedroom-negative FPR <= 5%).
* Redefined parity (item 4a): the TypeScript head (`head.ts` on `model/tflite_retrain/model.v3t.json`) reproduces the Python head on the TFLite scores of 204 distinct windows (200 parity + fixtures): max abs probability diff 8.9e-16, 0 decision disagreements at 0.5085, 0.9 and 0.98. This only proves the TS port, NOT that a phone's TFLite output equals the desktop one (NOT VERIFIED).

## DECISION (2026-10-18): ship a float32 TFLite converted from the verified .h5, with the ORIGINAL v3 head
* **Conversion:** `scripts/yamnet/convert_float_tflite.py` (run with `~/tf_env/bin/python -I`, TensorFlow 2.16.2, h5py read-only) builds the official tf.signal-equivalent frontend (framing, Hann, real DFT as two matmuls so only builtin TFLite ops are needed, magnitude, mel 125-7500 Hz x 64, log(x+0.001)) and the 14-layer tower from `yamnet.h5`, and converts with no quantisation. Output `mobile/assets/models/yamnet_float32.tflite`: 15,973,484 bytes, sha256 `c318dadf42d414c3b974b8773f07eb3b7c64debb6aeace0f6cf38a634c2cf8a5`, deterministic (two runs, same hash). Input float32 [15600], output float32 [1, 521].
* **Provenance chain:** h5 md5 equals Google's object md5 -> deterministic conversion script -> output sha256 above. The .h5 itself stays in `data/raw`. License Apache 2.0. Listed in `data/ATTRIBUTION.md`.
* **Parity vs the NumPy port (pre-registered criteria above), 200 development windows + fixtures: PASS.** Class scores: max abs diff 2.25e-05, mean 3.2e-08, p99 6.5e-07, top-1 agreement 100%, top-5 set 99%. Head probability max abs diff 7.8e-05 (criterion < 0.01). Decisions identical on 200/200 at 0.6495 and at 0.98 (0 disagreements among positives, hard negatives, random negatives). So the original v3 metrics and the pre-registered operating point transfer to this file *on the desktop TFLite runtime*. Result: `model/parity.v3.json`; the earlier int8 FAIL is kept as `model/parity.v3.int8.json`.
* **v3t (int8 retrain, `model/tflite_retrain/`)** stays documented as an evaluated alternative and is NOT shipped.
* **NOT VERIFIED:** iPhone fast-tflite output vs this desktop run (the fixtures in `scripts/yamnet/fixtures/synthetic_fixtures.json` now carry `expectedTflite` from the float file for that check).

## App integration (2026-10-19)
* **Runtime:** `react-native-fast-tflite` 3.0.1, CPU delegate only (no Core ML / Metal), loading `mobile/assets/models/yamnet_float32.tflite` as a Metro asset
  (`tflite` added to `assetExts` in `mobile/metro.config.js`). Loader: `mobile/src/capture/yamnetScorer.ts`. It checks the tensor types and shapes (float32 [15600] in,
  float32 [1, 521] out), wraps the runtime with the v3 head (`src/audio/yamnet/scorer.ts`) and runs a start-up self-check: a generated 440 Hz tone
  (`src/audio/yamnet/selfCheck.ts`, the fixture `tone-440hz-amp0.3`) must give a head output within 0.01 of the desktop float32 TFLite value (0.038618).
  This is one input, not a parity proof.
* **Framing (matches training):** the night pipeline's 1 s windows on a 0.5 s hop at 16 kHz; YAMNet sees the centred 15,600 samples (offset 200) of each
  window, exactly as `scripts/yamnet/yamnet_np.window_to_patch` did for training and for the synthetic nights.
* **Energy pre-gate:** YAMNet runs only on windows that pass the existing level gate (above -72 dBFS and at least `GATE_DB` above the rolling 10th-percentile
  floor). Silent and below-gate windows never reach it (test: `src/night/pipelineScorer.test.ts`).
* **Night logic:** flag at head output >= 0.98, confirm 2-of-14 windows (7 s), segment = at least 3 confirmed windows with gaps <= 10 s
  (`src/night/operatingPoint.ts`, a port of `scripts/eval/night_logic.py`; `src/night/operatingPoint.test.ts` reproduces the Python outputs on 169 fixture cases,
  including the first hour of three synthetic nights). An epoch closes 13 windows (6.5 s) late so confirmation can look ahead across epoch boundaries.
  A window on which the runtime throws is counted as skipped (not analysed), never as "no snore".
* **Fallback to v1** (night records the v1 version): web (platform file `yamnetScorer.web.ts`, so the web bundle carries neither the runtime nor the 16 MB file),
  Expo Go, native module missing, model load failure, wrong tensor shapes, failed self-check.
* **BLOCKER for on-device v3:** `react-native-fast-tflite` 3.x is a Nitro module; its required native peer `react-native-nitro-modules` is NOT installed
  (no new installs were allowed in this round). Without it, autolinking fast-tflite would break `pod install` (the podspec depends on the `NitroModules` pod), so
  `mobile/react-native.config.js` keeps fast-tflite out of native autolinking until that package is present, and Metro resolves the JS import to a throwing
  stub (`mobile/stubs/nitro-modules-missing.ts`). Result today: every iPhone night falls back to v1 with reason `native-module-missing`. To enable v3:
  `cd mobile && npx expo install react-native-nitro-modules`, then rebuild the dev client; nothing else changes.
* **NOT VERIFIED:** on-iPhone inference at all; iPhone vs desktop output agreement beyond the one self-check tone; CPU time per window, thermal and battery cost
  over a night; behaviour on real bedroom audio.
