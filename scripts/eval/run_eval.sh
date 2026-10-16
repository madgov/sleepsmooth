#!/usr/bin/env bash
# Full dev-data evaluation: OOF heads -> error analysis -> 20 SYNTHETIC nights -> segment/grouping experiments.
# Needs data/raw/esc50 and data/processed/yamnet patches (see docs/YAMNET_INTEGRATION.md). About 30-40 min.
set -euo pipefail
cd "$(dirname "$0")/.."/..
PY="${PYTHON:-python3}"
"$PY" -I scripts/eval/oof_heads.py
"$PY" -I scripts/eval/error_analysis.py
"$PY" -I scripts/eval/synthetic_nights.py --workers 4
"$PY" -I scripts/eval/segment_eval.py
