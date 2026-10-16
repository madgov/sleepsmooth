#!/usr/bin/env bash
# Verifies scripts/eval/night_logic.py against the real TypeScript night pipeline (src/night, not modified).
# Usage: scripts/eval/verify_port.sh [night.f32]   (default: renders a 15-minute synthetic night into a temp dir)
set -euo pipefail
cd "$(dirname "$0")/../.."
TMP="${TMPDIR:-/tmp}/sleepsmooth-verify-port"; mkdir -p "$TMP"
F32="${1:-}"
if [ -z "$F32" ]; then
  NIGHT_DUMP_AUDIO_DIR="$TMP/audio" python3 -I scripts/eval/synthetic_nights.py --smoke --out "$TMP/smoke" > /dev/null
  F32="$TMP/audio/night_00.f32"
fi
npx tsx scripts/eval/verify_port.ts "$F32" "$TMP/ts.json"
python3 -I scripts/eval/verify_port.py "$F32" "$TMP/ts.json"
