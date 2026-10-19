"""Stage 3b (docs/EVAL_PROTOCOL.md section 8.1, pre-registered): re-derive NIGHT_MIN_EPISODES / NIGHT_MIN_EPISODE_SEC for the v3 operating point on the SYNTHETIC nights.

  python3 -I scripts/eval/night_rule_sweep.py [--gate 6]   -> model/night_rule_sweep.synthetic.json

Uses the lowered-gate render (data/processed/synthetic_nights_gate0, see gate_sweep.py) masked to the given gate. SYNTHETIC data only; carries no clinical meaning.
"""
import os, sys, json, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'yamnet'))
sys.path.insert(0, HERE)
import numpy as np
import night_logic as NL
import segment_eval as SE
import gate_sweep as GS
from common import ROOT

ES = [1, 2, 3, 4, 5]
SS = [10, 20, 30, 45, 60, 90, 120]


def seg_flagged_sec(conf_idx, s):
    ks = [k for k in conf_idx if s[3] <= k <= s[4]]
    return 1.0 + sum(min(1.0, (b - a) * 0.5) for a, b in zip(ks, ks[1:]))     # union of 1 s windows on a 0.5 s hop, as summary.findEpisodes


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--gate', type=float, default=6.0); a = ap.parse_args()
    SE.NIGHTS = GS.OUT0
    nts = SE.load()
    rows = []
    for nt in nts:
        z = np.load(os.path.join(GS.OUT0, f"night_{nt['meta']['night']:02d}.npz"))
        level, floor = z['level'].astype(np.float64), z['floor'].astype(np.float64)
        scored = (level >= NL.SILENCE_FLOOR_DBFS) & (level >= np.maximum(NL.SILENCE_FLOOR_DBFS, floor + a.gate)) & ~np.isnan(nt['score'])
        nt['scored'] = scored
        flag = scored & (nt['score'] >= GS.OP['thr'])
        conf = NL.kofn_confirm(flag, GS.OP['n'], GS.OP['K'])
        cidx = np.where(conf)[0]
        segs = NL.find_segments(cidx, min_flagged=GS.OP['M'])
        hit, _ = SE.score_night(nt, segs)
        rows.append(dict(fold=nt['fold'], hours=nt['meta']['seconds'] / 3600, segs=[(float(seg_flagged_sec(cidx, s)), bool(h)) for s, h in zip(segs, hit)]))
    def fires(segs, E, S):
        return len(segs) >= E and sum(f for f, _ in segs) >= S
    out = dict(label='SYNTHETIC nights. Not real-world performance. No clinical meaning.', gate=a.gate, operatingPoint=GS.OP, candidates={})
    def split(grp):
        tr = [r for r in rows if r['fold'] in grp]
        return tr
    groups = {'tuning': split((1, 2)), 'check': split((3, 4))}
    for E in ES:
        for S in SS:
            c = {}
            for name, g in groups.items():
                fa = sum(fires(r['segs'], E, S) for r in g)
                ff = sum(fires([x for x in r['segs'] if not x[1]], E, S) for r in g)
                c[name] = dict(nights=len(g), fireAll=fa, fireFalseOnly=ff)
            out['candidates'][f'E{E}_S{S}'] = c
    adm = [(E, S) for E in ES for S in SS if out['candidates'][f'E{E}_S{S}']['tuning']['fireFalseOnly'] == 0]
    if adm:
        best = max(adm, key=lambda es: (out['candidates'][f'E{es[0]}_S{es[1]}']['tuning']['fireAll'], es[0], es[1]))
        chosen = dict(E=best[0], S=best[1], keptOld=False)
    else:
        chosen = dict(E=3, S=120, keptOld=True)
    out['chosen'] = chosen
    for name, g in groups.items():
        tf = [f for r in g for f, h in r['segs'] if h]; ff = [f for r in g for f, h in r['segs'] if not h]
        q = lambda v: None if not v else dict(n=len(v), min=min(v), median=float(np.median(v)), max=max(v))
        out.setdefault('flaggedSecPerSegment', {})[name] = dict(trueSegments=q(tf), falseSegments=q(ff))
        out.setdefault('falseSegmentsPerHour', {})[name] = sum(1 for r in g for f, h in r['segs'] if not h) / sum(r['hours'] for r in g)
    json.dump(out, open(os.path.join(ROOT, 'model', 'night_rule_sweep.synthetic.json'), 'w'), indent=1)
    print('chosen', chosen); print('flagged sec per segment', json.dumps(out['flaggedSecPerSegment']))
    print('E S | tuning fireAll fireFalse | check fireAll fireFalse')
    for E in ES:
        for S in SS:
            c = out['candidates'][f'E{E}_S{S}']
            print(f"{E} {S:3d} | {c['tuning']['fireAll']:2d}/{c['tuning']['nights']} {c['tuning']['fireFalseOnly']:2d} | {c['check']['fireAll']:2d}/{c['check']['nights']} {c['check']['fireFalseOnly']:2d}")


if __name__ == '__main__':
    main()
