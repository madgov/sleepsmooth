#!/usr/bin/env bash
# End-to-end v3 (YAMNet) pipeline. Safe to re-run: embeddings are cached, and the test fold is evaluated once per data configuration
# (model/metrics.v3.json for ESC-50 only; model/metrics.v3.kaggle.json when data/raw/kaggle-snoring is populated). Raw data is only ever
# decoded by ffmpeg and read by NumPy (np.load without pickle); nothing from data/raw is executed. Python runs with -I.
set -euo pipefail
cd "$(dirname "$0")/../.."
PY="python3 -I"
[ -f data/processed/yamnet/weights.npz ] || $PY scripts/yamnet/convert_h5.py > /dev/null
KEEP_SILENCE_FLOOR=1 npx tsx scripts/prepare-data.ts          # picks up Kaggle clips if present; keeps the shipped silence floor
HAVE_KAGGLE=$(find "${SLEEP_KAGGLE_DIR:-data/raw/kaggle-snoring}" -type f \( -iname '*.wav' -o -iname '*.mp3' -o -iname '*.ogg' -o -iname '*.flac' -o -iname '*.m4a' \) 2>/dev/null | head -1 || true)
$PY scripts/yamnet/extract.py clean
[ -n "$HAVE_KAGGLE" ] && $PY scripts/yamnet/kaggle_groups.py
$PY scripts/yamnet/extract.py aug
$PY scripts/yamnet/sanity_classes.py > /dev/null
$PY scripts/yamnet/train_cv.py                                 # ESC-50 only -> trained.v3.json
if [ -n "$HAVE_KAGGLE" ]; then
  USE_KAGGLE=1 TRAINED_V3=trained.v3.kaggle.json $PY scripts/yamnet/train_cv.py
  $PY scripts/yamnet/kaggle_checks.py
  TRAINED_V3=trained.v3.kaggle.json METRICS_FILE=metrics.v3.kaggle.json $PY scripts/yamnet/evaluate_test.py
  TRAINED_V3=trained.v3.kaggle.json METRICS_FILE=metrics.v3.kaggle.json $PY scripts/yamnet/export.py
else
  $PY scripts/yamnet/evaluate_test.py
  $PY scripts/yamnet/export.py
fi
