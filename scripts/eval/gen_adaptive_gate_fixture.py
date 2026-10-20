"""Writes src/night/adaptiveGate.fixture.json: reference outputs of scripts/eval/adaptive_gate.py (flatness_of, rolling_floors) for the TypeScript port
(src/night/adaptiveGate.ts, tested by adaptiveGate.test.ts). Inputs are deterministic integer recipes (an LCG), reproduced in the test, so the fixture stores only outputs.
Run: python3 -I scripts/eval/gen_adaptive_gate_fixture.py"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'yamnet'))
import numpy as np
import adaptive_gate as AG

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))


def lcg(seed):
    s = seed & 0xFFFFFFFF
    while True:
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        yield s


def signal(kind, n=24000):
    g = lcg(777)
    nz = np.array([((next(g) >> 8) & 0xFFFF) - 32768 for _ in range(n)], np.int64)       # white, +-32768
    if kind == 'white':
        x = nz // 4
    elif kind == 'colored':                                                              # 16-tap moving average of white noise, then x4
        c = np.concatenate([[0], np.cumsum(nz)])
        x = (c[16:] - c[:-16]) // 4
        x = np.concatenate([x, np.zeros(n - len(x), np.int64)])
    elif kind == 'tonal':                                                                # square wave (period 80) plus faint noise
        x = np.where((np.arange(n) // 40) % 2 == 0, 1600, -1600) + (nz >> 6)
    else:
        raise ValueError(kind)
    return x.astype(np.float64) / 32768.0


def sec_series(n=3000):
    g = lcg(4242)
    return np.array([-80.0 + ((next(g) >> 8) & 1023) / 1024.0 * 40.0 for _ in range(n)])


out = dict(label='Reference outputs of scripts/eval/adaptive_gate.py. Inputs are integer LCG recipes reproduced in adaptiveGate.test.ts.', flatness=[], floors={})
for kind in ('white', 'colored', 'tonal'):
    x = signal(kind)
    for start in (0, 5000, 8000):
        out['flatness'].append(dict(kind=kind, start=start, value=AG.flatness_of(x[start:start + 16000])))
sd = sec_series()
for R in (180, 300, 600):
    out['floors'][str(R)] = [float(v) for v in AG.rolling_floors(sd, R)]
json.dump(out, open(os.path.join(ROOT, 'src', 'night', 'adaptiveGate.fixture.json'), 'w'))
print('wrote fixture', {k: len(v) for k, v in out['floors'].items()}, [round(f['value'], 4) for f in out['flatness']])
