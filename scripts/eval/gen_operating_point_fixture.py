"""Writes src/night/operatingPoint.fixture.json: reference outputs of scripts/eval/night_logic.py (kofn_confirm, find_segments) for the TypeScript port
(src/night/operatingPoint.ts, tested by operatingPoint.test.ts). Inputs: seeded random flag sets, hand-built edge cases and the flagged windows
(score >= 0.98) of three SYNTHETIC nights (data/processed/synthetic_nights, git-ignored; regenerate with scripts/eval/synthetic_nights.py).
Run: python3 -I scripts/eval/gen_operating_point_fixture.py"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
import night_logic as NL

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))


def case(name, flags_idx, nwin, N=14, K=2, M=3):
    flag = np.zeros(nwin, bool); flag[list(flags_idx)] = True
    conf = NL.kofn_confirm(flag, N / 2, K)
    segs = NL.find_segments(np.where(conf)[0], min_flagged=M)
    return dict(name=name, nWindows=nwin, flagged=sorted(int(i) for i in flags_idx), N=N, K=K, M=M,
                confirmed=[int(i) for i in np.where(conf)[0]],
                segments=[dict(t0=float(s[0]), t1=float(s[1]), n=int(s[2]), k0=int(s[3]), k1=int(s[4])) for s in segs])


cases = []
rng = np.random.default_rng(20261019)
for c in range(40):
    ks = set()
    for _ in range(int(rng.integers(1, 9))):
        s0 = int(rng.integers(0, 2500)); L = int(rng.integers(1, 30))
        for j in range(L):
            if rng.random() < 0.7: ks.add(s0 + j * int(rng.integers(1, 4)))
    for K, N in ((2, 14), (1, 14), (3, 14), (2, 6)):
        cases.append(case(f'random{c}-K{K}-N{N}', ks, 2600, N=N, K=K))
cases.append(case('empty', [], 100))
cases.append(case('single', [50], 100))
cases.append(case('pair-at-13', [10, 23], 100))
cases.append(case('pair-at-14', [10, 24], 100))
cases.append(case('gap-exactly-10s', [0, 1, 2, 23, 24, 25], 100))
cases.append(case('gap-over-10s', [0, 1, 2, 24, 25, 26], 100))
ndir = os.path.join(ROOT, 'data', 'processed', 'synthetic_nights')
for i in (0, 2, 7):
    p = os.path.join(ndir, f'night_{i:02d}.npz')
    if not os.path.exists(p): continue
    z = np.load(p); sc = z['score']; st = z['status']
    flag = (st == NL.STATUS_SCORED) & (sc >= 0.98)
    n = min(len(flag), 7200)
    cases.append(case(f'synthetic-night-{i}-first-hour', np.where(flag[:n])[0], n))
out = os.path.join(ROOT, 'src', 'night', 'operatingPoint.fixture.json')
json.dump(dict(label='Reference outputs of scripts/eval/night_logic.py (kofn_confirm, find_segments). Inputs are synthetic.', cases=cases), open(out, 'w'))
print(len(cases), 'cases ->', out, os.path.getsize(out), 'bytes')
