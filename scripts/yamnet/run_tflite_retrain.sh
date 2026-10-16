#!/usr/bin/env bash
# v3t: retrain + evaluate the v3 head on features from the OFFICIAL TFLite YAMNet (docs/EVAL_PROTOCOL.md section 7, pre-registered).
# Needs a Python with TensorFlow + SciPy (default: ~/tf_env, used read-only; nothing is installed). Outputs go to data/processed_tflite and model/tflite_retrain,
# NOT over the shipped v3 files. Usage: scripts/yamnet/run_tflite_retrain.sh [stage ...]   stages: clean aug train eval oof nights segments (default: all)
set -euo pipefail
cd "$(dirname "$0")/../.."
PY="${TFL_PYTHON:-$HOME/tf_env/bin/python}"
export YAMNET_BACKEND=tflite SLEEP_PROC_DIR="$PWD/data/processed_tflite" SLEEP_MODEL_DIR="$PWD/model/tflite_retrain" YAMNET_WORKERS=1 TF_CPP_MIN_LOG_LEVEL=2
export V3_JSON="$PWD/model/tflite_retrain/model.v3t.json"
stages="${*:-clean aug train eval oof nights segments}"
for s in $stages; do
  echo "== $s"
  case $s in
    clean) "$PY" -I scripts/yamnet/extract.py clean ;;
    aug) "$PY" -I scripts/yamnet/extract.py aug ;;
    train) "$PY" -I scripts/yamnet/train_cv.py ;;
    eval) "$PY" -I scripts/yamnet/evaluate_test.py ;;
    oof) "$PY" -I scripts/eval/oof_heads.py ;;
    nights) "$PY" -I scripts/eval/synthetic_nights.py --workers 4 ;;
    segments) "$PY" -I scripts/eval/segment_eval.py ;;
  esac
done
