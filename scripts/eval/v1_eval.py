"""Section 10 of docs/EVAL_PROTOCOL.md (pre-registered): the v1 fallback model under the v3 night rule, on the SYNTHETIC nights. NOT real data, NOT clinical.
v1 scores come from the REAL TypeScript pipeline (scripts/eval/v1_scores.ts, no gate) over the rendered audio; gates are applied here as masks.
  python3 -I scripts/eval/v1_eval.py baseline [--gate ref|R,X,C]    # shared constants: t1 = model threshold, M = 3, E = 5, S = 60
  python3 -I scripts/eval/v1_eval.py sweep    [--gate ref|R,X,C]    # only if v1 is 'clearly worse' (section 10.2): grid of section 10.3 -> model/v1_night_eval.synthetic.json
"""
import os, sys, json, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'yamnet')); sys.path.insert(0, HERE)
import numpy as np
import night_logic as NL
import adaptive_gate as AG
import segment_eval as SE
from common import PROC, ROOT

V1DIR = os.path.join(PROC, 'synthetic_nights_v1')
V1_THR = json.load(open(os.path.join(ROOT, 'src/audio/model/model.json')))['threshold']
TS = [round(V1_THR, 4), 0.85, 0.90, 0.95, 0.98]
MS = [3, 5, 8, 12]
ES = [1, 2, 3, 4, 5]
SS = [10, 20, 30, 45, 60, 90, 120]
FP_BUDGET = 2.0


def load(gate):
    nts = AG.load()
    for nt in nts:
        v = np.fromfile(os.path.join(V1DIR, f"night_{nt['meta']['night']:02d}.v1.f32"), '<f4').astype(np.float64)
        assert len(v) == len(nt['level']), (len(v), len(nt['level']))
        if gate == 'ref':
            sc = AG.mask(nt, 600, None, None)
        else:
            R, X, C = gate.split(','); sc = AG.mask(nt, int(R), float(X), float(C))
        # v1 score exists for every window above the silence floor (no gate in the TS run); the v3 score is NaN where YAMNet did not run, which cannot happen under the full render
        nt['v1'] = v
        nt['gmask'] = sc & ~np.isnan(v)
    return nts


def night_segs(nt, t1, M):
    flag = nt['gmask'] & (nt['v1'] >= t1)
    cidx = np.where(flag)[0]
    segs = NL.find_segments(cidx, min_flagged=M)
    hit, cg = SE.score_night(nt, segs)
    sf = [(float(AG.seg_flagged_sec(cidx, s)), bool(h)) for s, h in zip(segs, hit)]
    return sf, cg


def evaluate(nts, t1, M, E, S):
    fp = tp = caught = bouts = fa = ff = 0
    hours = 0.0
    for nt in nts:
        sf, cg = night_segs(nt, t1, M)
        fp += sum(1 for _, h in sf if not h); tp += sum(1 for _, h in sf if h)
        caught += int(cg.sum()); bouts += len(cg); hours += nt['meta']['seconds'] / 3600
        fa += int(len(sf) >= E and sum(f for f, _ in sf) >= S)
        fl = [x for x in sf if not x[1]]
        ff += int(len(fl) >= E and sum(f for f, _ in fl) >= S)
    return dict(fpPerHour=fp / hours, fp=fp, tp=tp, recall=caught / bouts, caught=caught, bouts=bouts, nights=len(nts), nightsFireAll=fa, nightsFireFalseOnly=ff, hours=hours)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd', choices=['baseline', 'sweep']); ap.add_argument('--gate', default='ref'); a = ap.parse_args()
    nts = load(a.gate)
    tun = [n for n in nts if n['fold'] in (1, 2)]; chk = [n for n in nts if n['fold'] in (3, 4)]
    if a.cmd == 'baseline':
        out = dict(label='SYNTHETIC nights. Not real-world performance. No clinical meaning.', gate=a.gate, v1Threshold=V1_THR, shared=dict(M=3, E=5, S=60),
                   tuning=evaluate(tun, V1_THR, 3, 5, 60), check=evaluate(chk, V1_THR, 3, 5, 60))
        t = out['tuning']
        out['clearlyWorse'] = bool(t['fpPerHour'] > FP_BUDGET or t['nightsFireFalseOnly'] >= 1)
        json.dump(out, open(os.path.join(ROOT, 'model', f"v1_night_baseline.synthetic.{'ref' if a.gate == 'ref' else 'adaptive'}.json"), 'w'), indent=1)
        print(json.dumps(out, indent=1))
        return
    cands = {}
    for t1 in TS:
        for M in MS:
            for E in ES:
                for S in SS:
                    cands[(t1, M, E, S)] = evaluate(tun, t1, M, E, S)
    adm = [k for k, v in cands.items() if v['fpPerHour'] <= FP_BUDGET and v['nightsFireFalseOnly'] == 0]
    chosen = None
    if adm:
        chosen = max(adm, key=lambda k: (cands[k]['nightsFireAll'], cands[k]['recall'], -abs(k[0] - TS[0]), -k[1], k[2], k[3]))
    out = dict(label='SYNTHETIC nights. Not real-world performance. No clinical meaning.', rule='docs/EVAL_PROTOCOL.md section 10.3', gate=a.gate, admissibleCount=len(adm),
               chosen=None if chosen is None else dict(t1=chosen[0], M=chosen[1], E=chosen[2], S=chosen[3]), tuning=None, check=None)
    if chosen:
        out['tuning'] = cands[chosen]
        out['check'] = dict(chosen=evaluate(chk, *chosen), shared=evaluate(chk, V1_THR, 3, 5, 60))
    out['tuningSharedConstants'] = cands[(TS[0], 3, 5, 60)]
    top = sorted(adm, key=lambda k: (-cands[k]['nightsFireAll'], -cands[k]['recall']))[:10]
    out['topAdmissible'] = [dict(t1=k[0], M=k[1], E=k[2], S=k[3], **cands[k]) for k in top]
    json.dump(out, open(os.path.join(ROOT, 'model', 'v1_night_eval.synthetic.json'), 'w'), indent=1)
    print(json.dumps({k: v for k, v in out.items() if k != 'topAdmissible'}, indent=1)); print(len(adm), 'admissible of', len(cands))


if __name__ == '__main__':
    main()
