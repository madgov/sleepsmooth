"""Compare night_logic.py with the TypeScript app logic. Input: the .f32 night and the JSON written by verify_port.ts. Exit code 1 on any mismatch."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
import night_logic as NL

f32, js = sys.argv[1], sys.argv[2]
x = np.fromfile(f32, '<f4')
level, floor_k, status = NL.window_status(NL.block_sums(x))
d = json.load(open(js))
names = {'tooQuiet': NL.STATUS_TOO_QUIET, 'belowGate': NL.STATUS_BELOW_GATE, 'scored': NL.STATUS_SCORED}
ts = {int(k): (names[s], lv, fl) for k, s, lv, fl in d['windows']}
bad = 0
for k, (st, lv, fl) in ts.items():
    if k >= len(status) or st != status[k] or abs(lv - level[k]) > 1e-3 or (fl is not None and abs(fl - floor_k[k]) > 1e-6):
        bad += 1
        if bad <= 5:
            print('window mismatch', k, (st, lv, fl), (None if k >= len(status) else (int(status[k]), float(level[k]), float(floor_k[k]))))
missing = set(range(len(status))) - set(ts)
print(f'windows: TS {len(ts)}, Python {len(status)}; mismatches {bad}; Python windows absent from TS {len(missing)} '
      f'(status counts TS {np.bincount([v[0] for v in ts.values()], minlength=3).tolist()}, Python {np.bincount(status, minlength=3).tolist()})')
ebad = 0
for c in d['episodeCases']:
    py = NL.find_segments(c['flagged'])
    mine = [[a, b, n] for a, b, n, _, _ in py]
    if mine != [[round(e[0], 3), round(e[1], 3), e[2]] for e in c['episodes']] and mine != c['episodes']:
        ebad += 1
        if ebad <= 3:
            print('episode mismatch', mine[:3], c['episodes'][:3])
print(f"episodes: {len(d['episodeCases'])} random cases, mismatches {ebad}")
sys.exit(1 if bad or missing or ebad else 0)
