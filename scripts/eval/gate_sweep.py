"""Stage 3 (docs/EVAL_PROTOCOL.md section 8, pre-registered): re-evaluate the level gate (GATE_DB) with the shipped v3 head on the SYNTHETIC nights.

  python3 -I scripts/eval/gate_sweep.py render [--workers 5]   # one render at GATE_DB = 0 (superset of scored windows) -> data/processed/synthetic_nights_gate0
  python3 -I scripts/eval/gate_sweep.py eval                   # candidate gates {0,1,2,3,4,6}, fixed operating point t=0.98, 2-of-14, M=3 -> model/gate_sweep.synthetic.json

Rendering reuses scripts/eval/synthetic_nights.build_night unchanged (same seeds, same out-of-fold heads) with night_logic.GATE_DB patched to 0. A window passes
gate G iff level >= max(-72, floor + G), so the scores of every candidate come from that one render. SYNTHETIC data only: says nothing about real bedrooms.
"""
import os, sys, json, glob, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'yamnet'))
sys.path.insert(0, HERE)
import numpy as np
from multiprocessing import Pool
import night_logic as NL
from common import PROC, ROOT

OUT0 = os.path.join(PROC, 'synthetic_nights_gate0')
ORIG = os.path.join(PROC, 'synthetic_nights')
CANDIDATES = [0.0, 1.0, 2.0, 3.0, 4.0, 6.0]
OP = dict(thr=0.98, n=7, K=2, M=3, rho=None, policy='-')      # pre-registered operating point (model/segment_eval.synthetic.json)
FP_BUDGET = 2.0


def _work(job):
    import synthetic_nights as SN
    NL.GATE_DB = 0.0                                           # window_status reads this module global at call time
    return SN.build_night(job)


def render(workers):
    import synthetic_nights as SN
    jobs = [(i, SN.TRAIN_FOLDS[i % 4], 2.0, OUT0) for i in range(20)]
    with Pool(min(workers, len(jobs))) as p:
        for i, m in p.imap_unordered(_work, jobs):
            print(f"night {i:02d} fold {m['fold']} windows {m['nWindows']} scored@0dB {m['nScored']} ({m['renderSeconds']}s)", flush=True)


def evaluate():
    import segment_eval as SE
    SE.NIGHTS = ORIG
    base = SE.load()                                           # original nights (gate 6) for the consistency check
    SE.NIGHTS = OUT0
    sup = SE.load()
    assert len(base) == len(sup) == 20, (len(base), len(sup))
    res = {}
    for g in CANDIDATES:
        nts = []
        for b, s in zip(base, sup):
            lv = np.load(os.path.join(OUT0, f"night_{s['meta']['night']:02d}.npz"))
            level, floor = lv['level'].astype(np.float64), lv['floor'].astype(np.float64)
            scored = (level >= NL.SILENCE_FLOOR_DBFS) & (level >= np.maximum(NL.SILENCE_FLOOR_DBFS, floor + g))
            if g == 6.0:                                       # consistency with the original gate-6 render: float32 level storage allows a few rounding flips
                diff = int((scored != b['scored']).sum())
                assert diff <= 3, f"night {s['meta']['night']}: {diff} windows differ from the original gate-6 render"
            nt = dict(s); nt['scored'] = scored & ~np.isnan(s['score'])
            nts.append(nt)
        tun = [n for n in nts if n['fold'] in (1, 2)]; chk = [n for n in nts if n['fold'] in (3, 4)]
        row = {}
        for name, grp in (('tuning', tun), ('check', chk)):
            a = SE.aggregate(grp, OP, {})
            nwin = sum(int(len(n['scored'])) for n in grp); nsc = sum(int(n['scored'].sum()) for n in grp)
            above = sum(int((np.load(os.path.join(OUT0, f"night_{n['meta']['night']:02d}.npz"))['level'] >= NL.SILENCE_FLOOR_DBFS).sum()) for n in grp)
            row[name] = dict(fpPerHour=a['fpPerHour'], fp=a['fp'], tp=a['tp'], hours=a['hours'], recall=a['recall'], bouts=a['bouts'].get('all'), caught=a['caught'].get('all'),
                             scoredWindows=nsc, allWindows=nwin, assessableFraction=nsc / nwin, assessableOfAboveSilenceFloor=nsc / above)
        res[str(g)] = row
    ref = res['6.0']['tuning']['recall']
    ok = [g for g in CANDIDATES if res[str(g)]['tuning']['fpPerHour'] <= FP_BUDGET and res[str(g)]['tuning']['recall'] >= ref - 1e-12]
    chosen = min(ok) if ok else 6.0
    chk_fp = res[str(chosen)]['check']['fpPerHour']
    adopted = chosen if (chosen < 6.0 and chk_fp <= FP_BUDGET) else 6.0
    out = dict(label='SYNTHETIC nights (stand-in for real overnight recordings). Not real-world performance.', rule='docs/EVAL_PROTOCOL.md section 8', operatingPoint=OP,
               candidates=res, chosenByTuningRule=chosen, checkFpPerHourAtChosen=chk_fp, adopted=adopted)
    json.dump(out, open(os.path.join(ROOT, 'model', 'gate_sweep.synthetic.json'), 'w'), indent=1)
    print(f"{'G':>4} | {'tune fp/h':>9} {'tune rec':>8} {'tune assess':>11} | {'chk fp/h':>8} {'chk rec':>7} {'chk assess':>10}")
    for g in CANDIDATES:
        r = res[str(g)]
        print(f"{g:4.0f} | {r['tuning']['fpPerHour']:9.2f} {r['tuning']['recall']:8.3f} {r['tuning']['assessableFraction']:11.3f} | {r['check']['fpPerHour']:8.2f} {r['check']['recall']:7.3f} {r['check']['assessableFraction']:10.3f}")
    print('chosen by tuning rule:', chosen, '| check fp/h at chosen:', round(chk_fp, 3), '| adopted:', adopted)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('cmd', choices=['render', 'eval']); ap.add_argument('--workers', type=int, default=5)
    a = ap.parse_args()
    render(a.workers) if a.cmd == 'render' else evaluate()
