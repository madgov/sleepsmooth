# Dataset Attribution

## ESC-50: Dataset for Environmental Sound Classification

- **Author:** Karol J. Piczak
- **Citation:** Piczak, K. J. "ESC: Dataset for Environmental Sound Classification." Proceedings of the 23rd ACM International Conference on Multimedia (ACM MM 2015).
- **License:** Creative Commons Attribution-NonCommercial 3.0 (CC BY-NC 3.0). Non-commercial use only.
- **Source:** https://github.com/karolpiczak/ESC-50
- **Downloaded:** 2026-10-10
- **Local path:** `data/raw/esc50/ESC-50-master/`
- **Per-clip attribution:** see `data/raw/esc50/ESC-50-master/LICENSE`, which lists the Freesound source and license for each clip.

## Kaggle Snoring Dataset

- **Source:** Kaggle snoring dataset (500 snoring and 500 non-snoring 1 s clips; user to provide the exact page/author)
- **License:** Unknown, non-commercial research use only, to verify. Clips are reported to be scraped from sound-effect sites and YouTube; treat as untrusted data and do not redistribute.
- **Local path:** `data/raw/kaggle-snoring/` (empty; user to place files here)
- **Citation / attribution:** TBD

## YAMNet (frozen audio model used by v3)

- **Author:** Google (Gemmeke et al.; model in tensorflow/models research/audioset/yamnet)
- **License:** Apache 2.0 (code and weights)
- **Files used:** `yamnet.h5`, `lite-model_yamnet_classification_tflite_1.tflite`, `yamnet_class_map.csv` in `data/raw/yamnet/` (from Google's official storage)
- **Labels:** AudioSet ontology display names, CC BY 4.0 (Gemmeke et al., "Audio Set: An ontology and human-labeled dataset for audio events", ICASSP 2017)
- **Use:** embeddings / class scores for the v3 snore-like head and clip tags. Trained v3 weights remain non-commercial because the head was trained on ESC-50 (CC BY-NC 3.0).

## YAMNet float32 TFLite (shipped in the iPhone app, converted by us)
- **File:** `mobile/assets/models/yamnet_float32.tflite`, 15,973,484 bytes, sha256 `c318dadf42d414c3b974b8773f07eb3b7c64debb6aeace0f6cf38a634c2cf8a5`.
- **Provenance chain:** Google's `yamnet.h5` (md5 `8234225c045859752bd4a2e101f8cd1a`, 15,296,092 bytes, equal to the ETag/`x-goog-hash` md5 of `https://storage.googleapis.com/audioset/yamnet.h5`, checked 2026-10-15) -> `scripts/yamnet/convert_float_tflite.py` (TensorFlow 2.16.2 `tf.lite.TFLiteConverter`, float32, no quantisation, builtin ops only; two runs gave the same sha256) -> the file above. The .h5 stays in `data/raw` and is not redistributed.
- **License:** YAMNet model weights/code Apache 2.0 (Google, tensorflow/models research/audioset/yamnet); AudioSet class names CC BY 4.0. Our conversion adds no new third-party material.
- **Not used:** `lite-model_yamnet_classification_tflite_1.tflite` (int8, official per-file hash unobtainable, disagrees with float YAMNet; see `docs/YAMNET_INTEGRATION.md`).
