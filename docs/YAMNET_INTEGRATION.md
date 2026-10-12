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

## Parity gap you must close before shipping
`scripts/yamnet/yamnet_np.py` is a NumPy re-implementation built from Google's official Keras weights. It passes a functional sanity check
(`data/processed/yamnet/sanity_classes.json`: the expected AudioSet class is in the top 5 for 714 of 832 ESC-50 folds 1-4 clips over 26 mapped
classes; snoring 32/32) but **has not been compared numerically with the official TFLite output**. The head was trained on the re-implementation's
scores. Before trusting the head on-device: run the TFLite on a few hundred ESC-50 windows, compare score vectors (expect small differences from
quantization and resampling), and re-run `evaluate_test.py`-style checks on TFLite-derived scores. If they differ, retrain the head on TFLite outputs.

## Other requirements
* The phone resampler (`src/night/resample.ts`) must deliver 16 kHz mono; YAMNet is sensitive to level only through the log-mel, so apply no AGC.
* Keep the existing "too quiet to assess" rule (-72 dBFS) in front of the head.
* Scores are never shown as percentages. A below-threshold result is not reassurance.
