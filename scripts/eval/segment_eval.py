"""Segment-level / per-hour evaluation on the SYNTHETIC nights (a stand-in until real overnight recordings exist), plus grouping and
threshold experiments, with the operating point chosen by the rule written in docs/MODEL_ERROR_REPORT.md section 0 BEFORE any night was scored.

Inputs : data/processed/synthetic_nights/night_XX.{npz,json}  (scripts/eval/synthetic_nights.py)
Outputs: model/segment_eval.synthetic.json (all numbers) and data/processed/synthetic_nights/segment_tables.md (markdown tables, pasted into docs/MODEL_ERROR_REPORT.md by hand)
Run    : python3 -I scripts/eval/segment_eval.py
TUNING nights = built from ESC-50 folds 1 and 2; CHECK nights = folds 3 and 4. The point is chosen on TUNING only and reported once on CHECK.
DEVELOPMENT data only. Nothing here is real-world performance.
"""
import os, sys, json, glob, itertools
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'yamnet'))
sys.path.insert(0, HERE)
import numpy as np
from common import PROC, MODEL_DIR, ROOT, roc_auc
import night_logic as NL

NIGHTS = os.path.join(PROC, 'synthetic_nights')
BASE_THR = json.load(open(os.environ.get('V3_JSON', os.path.join(ROOT, 'src/audio/model/model.v3.json'))))['threshold']
THRS = [round(BASE_THR, 4), 0.75, 0.85, 0.90, 0.95, 0.98]
NS = [3, 5, 7, 10]
KS = [1, 2, 3, 4, 6, 8, 10]
MS = [3, 5, 8]
RHOS = [None, 0.2, 0.3, 0.4]
POLICIES = ['strict', 'lenient']
TOL = 5.0
FP_BUDGET = 2.0


def load():
    nights = []
    for p in sorted(glob.glob(os.path.join(NIGHTS, 'night_*.json'))):
        meta = json.load(open(p)); z = np.load(p.replace('.json', '.npz'))
        sc = z['score'].astype(np.float64)
        nights.append(dict(meta=meta, score=sc, scored=z['status'] == NL.STATUS_SCORED, y=z['ytrue'], dwin=z['distractor'], status=z['status'],
                           series=np.nan_to_num(sc, nan=0.0), fold=meta['fold']))
    return nights


def complexity(c):
    return 3 if c['rho'] is not None else 2 if c['K'] > 1 else 1 if (c['thr'] != THRS[0]) else 0


def run_night(nt, c, cache):
    """Segments for one night under config c -> list of dict(t0,t1,k0,k1,n)."""
    key = (id(nt), c['thr'], c['n'], c['K'], c['M'])
    if key not in cache:
        flag = nt['scored'] & (nt['score'] >= c['thr'])
        conf = NL.kofn_confirm(flag, c['n'], c['K']) if c['K'] > 1 else flag
        cache[key] = NL.find_segments(np.where(conf)[0], min_flagged=c['M'])
    segs = cache[key]
    if c['rho'] is None:
        return segs
    keep = []
    for s in segs:
        pk = NL.periodicity_peak(nt['series'][s[3]:s[4] + 1])
        ok = (pk >= c['rho']) if pk is not None else (c['policy'] == 'lenient')
        if ok:
            keep.append(s)
    return keep


def score_night(nt, segs):
    bouts = nt['meta']['bouts']
    b0 = np.array([b['t0'] - TOL for b in bouts]); b1 = np.array([b['t1'] + TOL for b in bouts])
    if segs:
        s0 = np.array([s[0] for s in segs]); s1 = np.array([s[1] for s in segs])
        ov = (s0[:, None] <= b1[None, :]) & (s1[:, None] >= b0[None, :])
        hit = ov.any(1); caught = ov.any(0)
    else:
        hit = np.zeros(0, bool); caught = np.zeros(len(bouts), bool)
    return hit, caught


def aggregate(nts, c, cache):
    tp = fp = 0; hours = 0.0
    tags = {}
    for nt in nts:
        segs = run_night(nt, c, cache)
        hit, caught = score_night(nt, segs)
        tp += int(hit.sum()); fp += int((~hit).sum()); hours += nt['meta']['seconds'] / 3600
        for b, cg in zip(nt['meta']['bouts'], caught):
            for t in {'normal': ['normal'], 'quiet': ['quiet'], 'brief': ['brief'], 'quiet+brief': ['quiet', 'brief']}[b['tag']] + ['all']:
                d = tags.setdefault(t, [0, 0]); d[0] += int(cg); d[1] += 1
    rec = {t: (v[0] / v[1] if v[1] else float('nan')) for t, v in tags.items()}
    return dict(fp=fp, tp=tp, hours=hours, fpPerHour=fp / hours, recall=rec.get('all', float('nan')), precision=(tp / (tp + fp)) if tp + fp else float('nan'),
                bouts={t: v[1] for t, v in tags.items()}, caught={t: v[0] for t, v in tags.items()}, tagRecall=rec, nSegments=tp + fp)


def configs():
    out = []
    for thr in THRS:
        for n in NS:
            for K in KS:
                if K > 2 * n or (K == 1 and n != NS[0]):
                    continue                         # K=1 does not depend on n: evaluate once
                for M in MS:
                    for rho in RHOS:
                        for pol in (POLICIES if rho is not None else ['-']):
                            out.append(dict(thr=thr, n=n if K > 1 else 0, K=K, M=M, rho=rho, policy=pol))
    return out


def family(c):
    if c['rho'] is not None: return 'periodicity (+k-of-n optional)'
    if c['K'] > 1: return 'k-of-n'
    if c['M'] != 5: return 'threshold + min windows'
    if c['thr'] != THRS[0]: return 'threshold only'
    return 'app rule'


def label(c):
    s = f"t={c['thr']:.4g} M={c['M']}"
    if c['K'] > 1: s += f" {c['K']}-of-{2 * c['n']}w({c['n']}s)"
    if c['rho'] is not None: s += f" rho>={c['rho']} {c['policy']}"
    return s


def window_metrics(nts, c, cache):
    tp = fp = fn = tn_ = 0; ys = []; ss = []
    for nt in nts:
        flag = nt['scored'] & (nt['score'] >= c['thr'])
        conf = NL.kofn_confirm(flag, c['n'], c['K']) if c['K'] > 1 else flag
        if c['rho'] is not None or c['M'] != 1:      # keep only confirmed windows that belong to a surviving segment
            keep = np.zeros(len(flag), bool)
            for s in run_night(nt, c, cache):
                m = conf.copy(); m[:s[3]] = False; m[s[4] + 1:] = False; keep |= m
            conf = keep
        y = nt['y']
        tp += int((conf & y).sum()); fp += int((conf & ~y).sum()); fn += int((~conf & y).sum())
        ys.append(y[nt['scored']]); ss.append(nt['score'][nt['scored']])
    ys, ss = np.concatenate(ys), np.concatenate(ss)
    return dict(windowPrecision=tp / (tp + fp) if tp + fp else float('nan'), windowRecallAllWindows=tp / (tp + fn) if tp + fn else float('nan'),
                flaggedWindows=tp + fp, falseFlaggedWindows=fp, positiveWindows=tp + fn,
                aucScoredWindows=float(roc_auc(ss, ys.astype(int))), scoredWindows=int(len(ys)), scoredPositiveWindows=int(ys.sum()))


def attribute_fp(nts, c, cache):
    """What do false segments overlap? Distractor types, else the bed."""
    cnt = {}
    for nt in nts:
        segs = run_night(nt, c, cache); hit, _ = score_night(nt, segs)
        for s, h in zip(segs, hit):
            if h: continue
            ids = nt['dwin'][s[3]:s[4] + 2]; ids = ids[ids >= 0]
            if len(ids):
                d = nt['meta']['distractors'][int(np.bincount(ids).argmax())]; k = f"distractor: {d['type']}"
            else:
                k = f"background: {nt['meta']['bed'][0]}"
            cnt[k] = cnt.get(k, 0) + 1
    return dict(sorted(cnt.items(), key=lambda kv: -kv[1]))


def bootstrap_nights(nts, c, cache, B=2000, seed=11):
    rng = np.random.default_rng(seed)
    per = []
    for nt in nts:
        segs = run_night(nt, c, cache); hit, caught = score_night(nt, segs)
        per.append((int((~hit).sum()), nt['meta']['seconds'] / 3600, int(caught.sum()), len(caught)))
    per = np.array(per, float)
    fph, rec = [], []
    for _ in range(B):
        i = rng.integers(0, len(per), len(per)); p = per[i]
        fph.append(p[:, 0].sum() / p[:, 1].sum()); rec.append(p[:, 2].sum() / max(p[:, 3].sum(), 1))
    q = lambda v: [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))]
    return dict(fpPerHourCI95=q(fph), recallCI95=q(rec), note='bootstrap over nights; nights share a few source snoring clips, so the true uncertainty is larger')


def fmt(a, d=2):
    return 'n/a' if a is None or a != a else f'{a:.{d}f}'


def main():
    nights = load()
    assert nights, 'no synthetic nights; run scripts/eval/synthetic_nights.py'
    tune = [n for n in nights if n['fold'] in (1, 2)]; check = [n for n in nights if n['fold'] in (3, 4)]
    print(f'{len(nights)} nights ({sum(n["meta"]["seconds"] for n in nights) / 3600:.1f} h): tuning {len(tune)} (folds 1-2), check {len(check)} (folds 3-4)')
    cache = {}
    cfgs = configs()
    print(len(cfgs), 'configs', flush=True)
    res = []
    for i, c in enumerate(cfgs):
        r = aggregate(tune, c, cache); r['cfg'] = c; res.append(r)
        if i % 400 == 0: print(i, flush=True)
    # ---- selection rule (docs/MODEL_ERROR_REPORT.md section 0)
    ok = [r for r in res if r['fpPerHour'] <= FP_BUDGET]
    rule_note = ''
    if ok:
        best = max(r['recall'] for r in ok)
        near = [r for r in ok if best - r['recall'] < 0.005]
        near.sort(key=lambda r: (r['fpPerHour'], complexity(r['cfg'])))
        chosen = near[0]
    else:
        fb = [r for r in res if r['recall'] >= 0.5]
        chosen = min(fb, key=lambda r: r['fpPerHour']) if fb else None
        rule_note = 'no grid point reached the 2/h budget; fell back to the rule\'s second clause' if chosen else 'NO ACCEPTABLE OPERATING POINT'
    base_cfg = dict(thr=THRS[0], n=0, K=1, M=5, rho=None, policy='-')
    base_t = aggregate(tune, base_cfg, cache); base_c = aggregate(check, base_cfg, cache)
    out = dict(label='SYNTHETIC nights (stand-in for real overnight recordings). DEVELOPMENT data (ESC-50 folds 1-4). Not real-world performance.',
               nights=dict(total=len(nights), hours=sum(n['meta']['seconds'] for n in nights) / 3600, tuning=len(tune), check=len(check),
                           bouts=dict(tuning=sum(len(n['meta']['bouts']) for n in tune), check=sum(len(n['meta']['bouts']) for n in check)),
                           distinctSnoringSourceClips=32),
               rule=dict(fpBudgetPerHour=FP_BUDGET, note=rule_note, doc='docs/MODEL_ERROR_REPORT.md section 0'), grid=dict(thr=THRS, n=NS, K=KS, M=MS, rho=RHOS, policies=POLICIES, configs=len(cfgs)))
    out['baselineApp'] = dict(cfg=base_cfg, tuning=base_t, check=base_c)
    if chosen:
        cc = chosen['cfg']
        out['chosen'] = dict(cfg=cc, label=label(cc), tuning=chosen, check=aggregate(check, cc, cache),
                             windowTuning=window_metrics(tune, cc, cache), windowCheck=window_metrics(check, cc, cache),
                             bootstrapCheck=bootstrap_nights(check, cc, cache), bootstrapTuning=bootstrap_nights(tune, cc, cache),
                             falseSegmentSources=dict(tuning=attribute_fp(tune, cc, cache), check=attribute_fp(check, cc, cache)))
    out['baselineApp'].update(windowTuning=window_metrics(tune, base_cfg, cache), windowCheck=window_metrics(check, base_cfg, cache),
                              bootstrapCheck=bootstrap_nights(check, base_cfg, cache), bootstrapTuning=bootstrap_nights(tune, base_cfg, cache),
                              falseSegmentSources=dict(tuning=attribute_fp(tune, base_cfg, cache), check=attribute_fp(check, base_cfg, cache)))
    # ---- trade-off curves per family: best tuning recall within each FP/h budget, then the same config on CHECK
    budgets = [0.5, 1.0, 2.0, 3.0, 5.0, 10.0, 1e9]
    curves = {}
    fams = sorted({family(r['cfg']) for r in res})
    for fam in fams:
        rows = []
        pool = [r for r in res if family(r['cfg']) == fam or (fam != 'app rule' and False)]
        # cumulative: a family includes the simpler ones (e.g. k-of-n may pick K=1) only if explicitly in it; keep strict families
        for b in budgets:
            cand = [r for r in pool if r['fpPerHour'] <= b]
            if not cand:
                rows.append(dict(budget=b, none=True)); continue
            bestr = max(r['recall'] for r in cand)
            near = sorted([r for r in cand if bestr - r['recall'] < 0.005], key=lambda r: (r['fpPerHour'], complexity(r['cfg'])))[0]
            chk = aggregate(check, near['cfg'], cache)
            rows.append(dict(budget=b, label=label(near['cfg']), cfg=near['cfg'], tuning=near, check=chk))
        curves[fam] = rows
    # cumulative "any variant up to this complexity" curves (what an engineer would actually ask: best you can do with X)
    cum = {}
    order = ['app rule', 'threshold only', 'threshold + min windows', 'k-of-n', 'periodicity (+k-of-n optional)']
    for upto in range(1, len(order)):
        allowed = set(order[:upto + 1]) | ({'app rule'})
        rows = []
        for b in budgets:
            cand = [r for r in res if family(r['cfg']) in allowed and r['fpPerHour'] <= b]
            if not cand: rows.append(dict(budget=b, none=True)); continue
            bestr = max(r['recall'] for r in cand)
            near = sorted([r for r in cand if bestr - r['recall'] < 0.005], key=lambda r: (r['fpPerHour'], complexity(r['cfg'])))[0]
            rows.append(dict(budget=b, label=label(near['cfg']), cfg=near['cfg'], tuning=near, check=aggregate(check, near['cfg'], cache)))
        cum[order[upto]] = rows
    out['tradeoffByFamily'] = curves
    out['tradeoffCumulative'] = cum
    # ---- extras (reported, NOT used for selection): pooled all-20-nights, per-bed breakdown, periodicity effect, bed-realism sensitivity
    extras = {}
    cfg_named = {'baseline': base_cfg}
    if chosen: cfg_named['chosen'] = chosen['cfg']
    extras['pooledAll20Nights'] = {k: aggregate(nights, c, cache) for k, c in cfg_named.items()}
    beds = {}
    for nt in nights:
        b = nt['meta']['bed'][0]
        d = beds.setdefault(b, dict(nights=0, hours=0.0, bouts=0, folds=[]))
        d['nights'] += 1; d['hours'] += nt['meta']['seconds'] / 3600; d['bouts'] += len(nt['meta']['bouts']); d['folds'].append(nt['fold'])
        for k, c in cfg_named.items():
            segs = run_night(nt, c, cache); hit, caught = score_night(nt, segs)
            d[k + 'Fp'] = d.get(k + 'Fp', 0) + int((~hit).sum()); d[k + 'Caught'] = d.get(k + 'Caught', 0) + int(caught.sum())
    extras['perBed'] = beds
    pe = {}
    for k, c in cfg_named.items():
        rows = []
        for rho, pol in [(None, '-')] + [(r, q) for r in (0.2, 0.3, 0.4) for q in POLICIES]:
            cc = dict(c, rho=rho, policy=pol)
            rows.append(dict(rho=rho, policy=pol, tuning=aggregate(tune, cc, cache), check=aggregate(check, cc, cache)))
        pe[k] = rows
    extras['periodicityEffect'] = pe
    unreal = {'vacuum_cleaner', 'thunderstorm', 'sea_waves'}
    sub = [nt for nt in nights if nt['meta']['bed'][0] not in unreal and not (set(nt['meta']['bed']) & unreal)]
    extras['sensitivityWithoutVacuumThunderSeaBeds'] = dict(note='POST HOC, after seeing results; not used for selection', nights=len(sub), hours=sum(n['meta']['seconds'] for n in sub) / 3600,
                                                          **{k: aggregate(sub, c, cache) for k, c in cfg_named.items()})
    out['extras'] = extras
    # periodicity cost: bouts caught by the best non-periodic point at the same budget but lost by periodicity (quiet/brief)
    json.dump(out, open(os.path.join(MODEL_DIR, 'segment_eval.synthetic.json'), 'w'), indent=1, default=lambda o: None if o != o else str(o))
    # ---- markdown
    L = []
    def row(name, a, b):
        return (f"| {name} | {fmt(a['fpPerHour'])} | {fmt(a['recall'])} ({a['caught']['all']}/{a['bouts']['all']}) | {fmt(a['precision'])} | "
                f"{fmt(b['fpPerHour'])} | {fmt(b['recall'])} ({b['caught']['all']}/{b['bouts']['all']}) | {fmt(b['precision'])} |")
    L.append('| Variant | TUNE false seg/h | TUNE seg. recall | TUNE seg. precision | CHECK false seg/h | CHECK seg. recall | CHECK seg. precision |\n|---|---|---|---|---|---|---|')
    L.append(row('App rule today (t=0.6495, 5 flagged windows, gap <= 10 s)', base_t, base_c))
    if chosen: L.append(row('CHOSEN: ' + label(chosen['cfg']), chosen, out['chosen']['check']))
    L.append('')
    for nm, d in cum.items():
        L.append(f'\n**Best achievable with {nm} (tuning-optimal per budget; CHECK = same config re-scored):**\n')
        L.append('| False-seg/h budget (tuning) | Config | TUNE fp/h | TUNE recall | CHECK fp/h | CHECK recall | CHECK recall normal / quiet / brief |\n|---|---|---|---|---|---|---|')
        for r in d:
            if r.get('none'): L.append(f"| <= {r['budget']:g} | none reaches it | | | | | |"); continue
            ck = r['check']; tr = r['tuning']
            tg = ck['tagRecall']
            L.append(f"| {'any' if r['budget'] > 1e8 else '<= ' + format(r['budget'], 'g')} | {r['label']} | {fmt(tr['fpPerHour'])} | {fmt(tr['recall'])} | {fmt(ck['fpPerHour'])} | {fmt(ck['recall'])} | "
                     f"{fmt(tg.get('normal'))} / {fmt(tg.get('quiet'))} / {fmt(tg.get('brief'))} |")
    L.append('\n**Per primary bed (all 20 nights; baseline = app rule today, chosen = selected point):**\n')
    L.append('| Bed | Nights | Hours | Bouts | App-rule false seg. | App-rule fp/h | App-rule bouts caught | Chosen false seg. | Chosen fp/h | Chosen bouts caught |\n|---|---|---|---|---|---|---|---|---|---|')
    for b, d in sorted(extras['perBed'].items(), key=lambda kv: -kv[1].get('baselineFp', 0)):
        L.append(f"| {b} | {d['nights']} (folds {','.join(map(str, d['folds']))}) | {d['hours']:.0f} | {d['bouts']} | {d.get('baselineFp', 0)} | {d.get('baselineFp', 0) / d['hours']:.2f} | {d.get('baselineCaught', 0)} | "
                 f"{d.get('chosenFp', 0)} | {d.get('chosenFp', 0) / d['hours']:.2f} | {d.get('chosenCaught', 0)} |")
    L.append('\n**Periodicity check on top of a fixed grouping (3 to 7 s autocorrelation of the snore-score series):**\n')
    L.append('| Base | rho / short-segment policy | TUNE fp/h | TUNE recall | CHECK fp/h | CHECK recall | CHECK recall normal / quiet / brief |\n|---|---|---|---|---|---|---|')
    for k, rows in extras['periodicityEffect'].items():
        for r in rows:
            tg = r['check']['tagRecall']
            L.append(f"| {k} | {'off' if r['rho'] is None else str(r['rho']) + ' ' + r['policy']} | {fmt(r['tuning']['fpPerHour'])} | {fmt(r['tuning']['recall'])} | {fmt(r['check']['fpPerHour'])} | {fmt(r['check']['recall'])} | {fmt(tg.get('normal'))} / {fmt(tg.get('quiet'))} / {fmt(tg.get('brief'))} |")
    open(os.path.join(NIGHTS, 'segment_tables.md'), 'w').write('\n'.join(L))
    print('\n'.join(L))
    if chosen:
        print('chosen', label(chosen['cfg']), 'tune', fmt(chosen['fpPerHour']), fmt(chosen['recall']), 'check', fmt(out['chosen']['check']['fpPerHour']), fmt(out['chosen']['check']['recall']))


if __name__ == '__main__':
    main()
