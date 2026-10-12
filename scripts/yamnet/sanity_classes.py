"""Sanity evidence for yamnet_np.py (folds 1-4 only): for ESC-50 classes with an obvious AudioSet counterpart, how often is the
expected AudioSet class inside YAMNet's top-5 for the clip (max over windows)? A broken frontend/weight mapping would give near-zero
agreement. This is NOT a bit-parity test against the official TFLite model."""
import sys, os, csv, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from common import *
names = [r['display_name'] for r in csv.DictReader(open(os.path.join(ROOT, 'data/raw/yamnet/yamnet_class_map.csv')))]
ix = {n: i for i, n in enumerate(names)}
MAP = {'dog': 'Dog', 'rooster': 'Chicken, rooster', 'cat': 'Cat', 'cow': 'Cattle, bovinae', 'sheep': 'Sheep', 'crow': 'Crow', 'rain': 'Rain', 'thunderstorm': 'Thunderstorm',
       'clock_alarm': 'Alarm clock', 'siren': 'Siren', 'church_bells': 'Bell', 'coughing': 'Cough', 'sneezing': 'Sneeze', 'snoring': 'Snoring', 'breathing': 'Breathing',
       'keyboard_typing': 'Computer keyboard', 'door_wood_knock': 'Knock', 'vacuum_cleaner': 'Vacuum cleaner', 'toilet_flush': 'Toilet flush', 'laughing': 'Laughter',
       'crying_baby': 'Baby cry, infant cry', 'helicopter': 'Helicopter', 'train': 'Train', 'clapping': 'Clapping', 'footsteps': 'Walk, footsteps', 'water_drops': 'Drip'}
rows = [r for r in window_rows() if r['source'] == 'esc50' and r['fold'] in TRAIN_FOLDS]
_, S = load_clean(rows)
byc = {}
for i, r in enumerate(rows): byc.setdefault((r['cls'], r['clip']), []).append(i)
out = {}
for cls, want in MAP.items():
    if want not in ix: out[cls] = dict(expected=want, note='class name not found'); continue
    clips = [v for (c, _), v in byc.items() if c == cls]
    hit = sum(1 for v in clips if ix[want] in np.argsort(-S[v].max(0))[:5])
    out[cls] = dict(expected=want, clips=len(clips), expectedInTop5=hit, rate=round(hit / max(1, len(clips)), 2))
json.dump(out, open(os.path.join(YDIR, 'sanity_classes.json'), 'w'), indent=1)
for k, v in out.items(): print(f"{k:16s} {v.get('expected'):24s} {v.get('expectedInTop5')}/{v.get('clips')}")
tot = [v for v in out.values() if 'clips' in v]
print('overall', sum(v['expectedInTop5'] for v in tot), '/', sum(v['clips'] for v in tot))
