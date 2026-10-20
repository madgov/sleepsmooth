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
if [ -z "${1:-}" ]; then
  # Second pass exercising tier 2 of the adaptive gate (tonal windows 0 to 11 dB over a very quiet floor; the rendered night above passes it vacuously).
  python3 -I - "$TMP/tonal.f32" <<'PY'
import sys, numpy as np
rng = np.random.default_rng(5); n = 16000 * 900; t = np.arange(n) / 16000
x = rng.standard_normal(n) * 10 ** (-90 / 20) + 10 ** ((-66 + 5 * np.sin(2 * np.pi * t / 37)) / 20) * (np.sin(2 * np.pi * 510 * t) + 0.5 * np.sin(2 * np.pi * 1020 * t))
x.astype('<f4').tofile(sys.argv[1])
PY
  npx tsx scripts/eval/verify_port.ts "$TMP/tonal.f32" "$TMP/ts_tonal.json"
  python3 -I scripts/eval/verify_port.py "$TMP/tonal.f32" "$TMP/ts_tonal.json"
fi
