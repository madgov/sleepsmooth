"""SMOKE-TEST FIXTURE ONLY. Builds a fake 'Kaggle-like' folder (1 s PCM16 WAV clips cut from ESC-50 snoring / other clips, with shared
filename stems and a few near-duplicates) so the Kaggle code path can be exercised end to end before the real dataset arrives.
The labels and sources are NOT real: never report numbers from a run on this folder.
  python3 -I scripts/yamnet/synthetic_kaggle_smoke.py <out_dir>"""
import sys, os, wave
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
from yamnet_np import read_wav_f32

out = sys.argv[1]
os.makedirs(os.path.join(out, '1'), exist_ok=True); os.makedirs(os.path.join(out, '0'), exist_ok=True)
man = load_manifest()
rng = np.random.default_rng(1)


def write(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())

n = 0
for label, pool in ((1, [c for c in man['clips'] if c['cls'] == 'snoring']), (0, [c for c in man['clips'] if c['cls'] in ('rain', 'wind', 'cat', 'door_wood_knock', 'clock_tick')])):
    for gi, c in enumerate(pool[:16]):
        x = read_wav_f32(os.path.join(PROC, c['file']))
        stem = f"{'snore' if label else 'other'}_src{gi:02d}_"
        for k in range(4):                      # four 1 s cuts from the same source -> same stem, must land in one fold
            s = int(rng.integers(0, max(1, len(x) - 16000)))
            seg = x[s:s + 16000]
            if len(seg) < 16000: continue
            write(os.path.join(out, str(label), f'{stem}{k:03d}.wav'), seg); n += 1
        # near-duplicate under an UNRELATED name: gain-changed copy of the first cut
        write(os.path.join(out, str(label), f'zz{gi}{label}x.wav'), np.clip(x[:16000] * 0.9, -1, 1)); n += 1
        write(os.path.join(out, str(label), f'aa{gi}{label}y.wav'), x[:16000]); n += 1
print('wrote', n, 'files to', out)
