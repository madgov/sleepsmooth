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
