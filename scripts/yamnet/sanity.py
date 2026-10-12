"""Functional sanity check of yamnet_np.py (not a parity proof): top YAMNet class per ESC-50 category on a few clips."""
import sys, os, csv, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from yamnet_np import YamNet, read_wav_f32, window_to_patch
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
names = [r['display_name'] for r in csv.DictReader(open(os.path.join(ROOT, 'data/raw/yamnet/yamnet_class_map.csv')))]
m = YamNet()
man = json.load(open(os.path.join(ROOT, 'data/processed/manifest.json')))
want = ['dog', 'rooster', 'snoring', 'coughing', 'sneezing', 'crying_baby', 'clock_alarm', 'rain', 'door_wood_knock', 'laughing', 'siren', 'church_bells']
import time; t = time.time(); n = 0
for cls in want:
    clips = [c for c in man['clips'] if c['cls'] == cls and c['fold'] == 1][:4]
    tops = []
    for c in clips:
        x = read_wav_f32(os.path.join(ROOT, 'data/processed', c['file']))
        ws = [window_to_patch(x[w['start']:w['start'] + 16000]) for w in c['windows'] if w['kept']]
        if not ws: continue
        _, s = m.embed(np.stack(ws)); n += len(ws)
        tops.append(names[int(np.argmax(s.max(axis=0)))])
    print(f'{cls:16s} -> {tops}')
print('patches', n, 'sec', round(time.time() - t, 1))
