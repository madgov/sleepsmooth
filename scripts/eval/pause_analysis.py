"""Docs/OVERNIGHT_PLAN.md snore-pause note: how often does src/night/snorePauses.countSnorePauses fire on SYNTHETIC nights at the v3 operating point
(t = 0.98, 2-of-14 confirmation; the earlier look used t = 0.649)? Window sets come from the full render (scripts/eval/adaptive_gate.py render) masked by
the gate in force; the count itself is the REAL TypeScript function (scripts/eval/pause_analysis.ts). 'False-only' = confirmed windows farther than 5 s
from every annotated bout. SYNTHETIC data; says nothing about real nights.
  python3 -I scripts/eval/pause_analysis.py [--thr 0.98] [--gate ref|R,X,C] -> model/snore_pauses.synthetic.json
"""
import os, sys, json, argparse, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'yamnet')); sys.path.insert(0, HERE)
import numpy as np
import night_logic as NL
import adaptive_gate as AG
from common import ROOT

ap = argparse.ArgumentParser(); ap.add_argument('--thr', type=float, default=0.98); ap.add_argument('--gate', default='ref'); ap.add_argument('--n', type=int, default=7)
ap.add_argument('--k', type=int, default=2); ap.add_argument('--out', default=os.path.join(ROOT, 'model', 'snore_pauses.synthetic.json'))
a = ap.parse_args()
nts = AG.load()
rows = []
for nt in nts:
    if a.gate == 'ref':
        sc = AG.mask(nt, 600, None, None)
    else:
        R, X, C = a.gate.split(','); sc = AG.mask(nt, int(R), float(X), float(C))
    flag = sc & (nt['score'] >= a.thr)
    conf = NL.kofn_confirm(flag, a.n, a.k) if a.k > 1 else flag
    cidx = np.where(conf)[0]
    bouts = nt['meta']['bouts']
    t_mid = cidx * 0.5 + 0.5
    near = np.zeros(len(cidx), bool)
    for b in bouts:
        near |= (t_mid >= b['t0'] - 5) & (t_mid <= b['t1'] + 5)
    rows.append(dict(night=nt['meta']['night'], fold=nt['fold'], hours=nt['meta']['seconds'] / 3600, nWindows=len(sc), scored=np.where(sc)[0].tolist(),
                     flaggedTrue=cidx[near].tolist(), flaggedFalse=cidx[~near].tolist()))
d = tempfile.mkdtemp()
json.dump(rows, open(os.path.join(d, 'in.json'), 'w'))
subprocess.run(['npx', 'tsx', 'scripts/eval/pause_analysis.ts', os.path.join(d, 'in.json'), os.path.join(d, 'out.json')], cwd=ROOT, check=True)
res = json.load(open(os.path.join(d, 'out.json')))
for r in res:
    r['confirmedFalseWindows'] = len(next(x for x in rows if x['night'] == r['night'])['flaggedFalse'])
def tot(g, key): return sum(r[key]['count'] for r in res if r['fold'] in g)
out = dict(label='SYNTHETIC nights. Not real-world performance. No clinical meaning.', thr=a.thr, confirm=f'{a.k}-of-{2 * a.n}', gate=a.gate, nights=res,
           totals={name: dict(nights=sum(1 for r in res if r['fold'] in g), hours=sum(r['hours'] for r in res if r['fold'] in g), pausesAll=tot(g, 'all'), pausesFalseOnly=tot(g, 'falseOnly'),
                              nightsWithFalseOnlyPause=sum(1 for r in res if r['fold'] in g and r['falseOnly']['count'] > 0)) for name, g in (('tuning', (1, 2)), ('check', (3, 4)))})
json.dump(out, open(a.out, 'w'), indent=1)
print(json.dumps(out['totals']))
print('night fold h | pauses all / falseOnly / trueOnly | confirmed false windows')
for r in res: print(f"{r['night']:2d} {r['fold']} {r['hours']:.1f} | {r['all']['count']:3d} {r['falseOnly']['count']:3d} {r['trueOnly']['count']:3d} | {r['confirmedFalseWindows']}")
