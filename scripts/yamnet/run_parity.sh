#!/usr/bin/env bash
# Runtime parity: NumPy YAMNet vs official TFLite (see docs/YAMNET_INTEGRATION.md "Runtime parity").
# Usage: scripts/yamnet/run_parity.sh [python-with-a-tflite-runtime]
#   step 1 always runs with the project Python (export, no TFLite runtime needed)
#   step 2 runs with $1 (or python3) and succeeds only if ai_edge_litert / tflite_runtime / tensorflow can be imported there.
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 -I scripts/yamnet/parity.py export
"${1:-python3}" -I scripts/yamnet/parity.py compare || { echo "parity NOT verified: no TFLite runtime in ${1:-python3}. See docs/YAMNET_INTEGRATION.md."; exit 2; }
