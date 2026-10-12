"""v3 model selection on folds 1-4 ONLY (fold 5 and any other test fold are never read here).

Candidates, all on identical grouped folds (the ESC-50 folds; each validation fold held out in turn):
  zero-shot  : YAMNet's own class score(s), no training
  logreg     : standardised 1024-d YAMNet embedding -> weighted logistic regression, L2 from CV
  mlp32      : 1024-32-1 MLP, L2 from CV
each with and without the v2 augmentation scheme (3 random copies/window: lowpass 3.5-8 kHz p=0.7, white/pink noise 10-30 dB SNR
p=0.7, gain +/-6 dB). Every validation fold is scored clean AND through a 4 kHz lowpass. PRE-REGISTERED selection criterion (same as v2):
mean of pooled out-of-fold AUC over (clean, lp4k). Threshold: Youden J on clean out-of-fold scores subject to bedroom-negative FPR <= 5%.
Normalisation is fit on the training part of each split only. Writes data/processed/yamnet/trained.v3.json.

If Kaggle data is present the same procedure runs on ESC-50 + Kaggle rows (folds jointly) and writes trained.v3.kaggle.json."""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from common import *

OUT = os.environ.get('TRAINED_V3', 'trained.v3.json')
USE_KAGGLE = os.environ.get('USE_KAGGLE', '0') == '1'
rows_all = window_rows()
if not USE_KAGGLE:
    rows_all = [r for r in rows_all if r['source'] == 'esc50']
rows = [r for r in rows_all if r['fold'] in TRAIN_FOLDS]            # fold 5 is dropped here, not just ignored
assert all(r['fold'] != TEST_FOLD for r in rows)
E, S = load_clean(rows)
y = np.array([r['label'] for r in rows]); fold = np.array([r['fold'] for r in rows]); bedr = np.array([r['bedroom'] for r in rows])
bedneg = bedr & (y == 0)
aug = load_aug(rows)
lp_i, lp_E, lp_S = aug['lp4k']
logit = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
# two input choices: 'emb' = 1024-d YAMNet embedding; 'scores' = 521-d logit of YAMNet class scores (deployable with the approved
# classification-only TFLite file, which exposes scores but not embeddings)
FEAT = dict(emb=dict(clean=E, lp=lp_E, augs=[aug[f'aug{k}'][1] for k in range(3)]),
            scores=dict(clean=logit(S), lp=logit(lp_S), augs=[logit(aug[f'aug{k}'][2]) for k in range(3)]))
aug_idx = [aug[f'aug{k}'][0] for k in range(3)]
assert len(lp_i) == len(rows), 'run extract.py aug first'
print(f'rows {len(rows)} (pos {int(y.sum())}), lp4k {len(lp_i)}, aug {sum(len(a) for a in aug_idx)}', flush=True)

# ---- zero-shot candidates (no fitting: the "out-of-fold" score is just the score)
zs = {'zeroshot class38 (Snoring)': (lambda s: s[:, 38]), 'zeroshot max(38 Snoring, 41 Snort)': (lambda s: s[:, [38, 41]].max(1))}
results = []
for name, f in zs.items():
    c, l = f(S), np.empty(len(rows)); l[lp_i] = f(lp_S)
    ac, al = roc_auc(c, y), roc_auc(l, y)
    results.append(dict(name=name, family='zeroshot', augment=False, l2=None, aucClean=ac, aucLp=al, crit=(ac + al) / 2,
                        folds=[(roc_auc(c[fold == v], y[fold == v]) + roc_auc(l[fold == v], y[fold == v])) / 2 for v in TRAIN_FOLDS], oofClean=c, oofLp=l))
    print(f"{name:44s} CV AUC clean {ac:.4f} lp4k {al:.4f} mean {(ac + al) / 2:.4f}", flush=True)

grid = []
for feat in ('emb', 'scores'):
    for aug_on in (False, True):
        for l2 in (1e-3, 1e-2, 1e-1, 1.0): grid.append(dict(kind='logreg', feat=feat, l2=l2, augment=aug_on, hidden=0, epochs=0))
        for l2 in (1e-3, 1e-2, 1e-1): grid.append(dict(kind='mlp', feat=feat, l2=l2, augment=aug_on, hidden=32, epochs=12 if aug_on else 30))

for g in grid:
    t0 = time.time()
    oc, ol = np.full(len(rows), np.nan), np.full(len(rows), np.nan)
    F = FEAT[g['feat']]
    for vf in TRAIN_FOLDS:
        tr = np.where(fold != vf)[0]
        Xtr, ytr, btr = F['clean'][tr], y[tr], bedr[tr]
        if g['augment']:
            for ai, ae in zip(aug_idx, F['augs']):
                msk = fold[ai] != vf
                Xtr = np.concatenate([Xtr, ae[msk]]); ytr = np.concatenate([ytr, y[ai[msk]]]); btr = np.concatenate([btr, bedr[ai[msk]]])
        m = fit_head(g['kind'], Xtr, ytr, btr, g['l2'], g['hidden'], g['epochs'])
        va = np.where(fold == vf)[0]
        oc[va] = score_head(m, F['clean'][va])
        ol[lp_i[fold[lp_i] == vf]] = score_head(m, F['lp'][fold[lp_i] == vf])
    ac, al = roc_auc(oc, y), roc_auc(ol, y)
    name = f"{g['kind']}{'32' if g['kind'] == 'mlp' else ''}[{g['feat']}]{'+aug' if g['augment'] else ''} l2={g['l2']}"
    results.append(dict(name=name, family=g['kind'] + ('_scores' if g['feat'] == 'scores' else ''), feat=g['feat'], kind=g['kind'], augment=g['augment'], l2=g['l2'], hidden=g['hidden'], epochs=g['epochs'], aucClean=ac, aucLp=al,
                        crit=(ac + al) / 2, folds=[(roc_auc(oc[fold == v], y[fold == v]) + roc_auc(ol[fold == v], y[fold == v])) / 2 for v in TRAIN_FOLDS],
                        oofClean=oc, oofLp=ol))
    print(f"{name:44s} CV AUC clean {ac:.4f} lp4k {al:.4f} mean {(ac + al) / 2:.4f}  ({time.time() - t0:.0f}s)", flush=True)

best = lambda fam: max([r for r in results if r['family'] == fam], key=lambda r: r['crit'])
chosen = {'zeroshot': best('zeroshot'), 'logreg': best('logreg'), 'mlp': best('mlp'), 'logreg_scores': best('logreg_scores'), 'mlp_scores': best('mlp_scores')}
final = {}
for fam, r in chosen.items():
    thr = pick_threshold(r['oofClean'], y, bedneg, 0.05)
    entry = dict(name=r['name'], family=fam, augment=r['augment'], l2=r['l2'], threshold=thr, cvAucClean=r['aucClean'], cvAucLp4k=r['aucLp'],
                 cvCriterion=r['crit'], cvAucFolds=r['folds'])
    if fam == 'zeroshot':
        entry['classes'] = [38] if 'class38' in r['name'] else [38, 41]
        entry['trainAuc'] = r['aucClean']  # nothing is fitted
    else:
        F = FEAT[r['feat']]
        Xtr, ytr, btr = F['clean'], y, bedr
        if r['augment']:
            for ai, ae in zip(aug_idx, F['augs']):
                Xtr = np.concatenate([Xtr, ae]); ytr = np.concatenate([ytr, y[ai]]); btr = np.concatenate([btr, bedr[ai]])
        m = fit_head(r['kind'], Xtr, ytr, btr, r['l2'], r.get('hidden', 0) or 32, r.get('epochs', 30))
        entry['feat'] = r['feat']; entry['kind'] = r['kind']
        entry['norm'] = dict(mean=m['norm']['mean'].tolist(), std=m['norm']['std'].tolist())
        entry['net'] = dict(W=[np.asarray(w).tolist() for w in m['net']['W']], b=[np.asarray(b).tolist() for b in m['net']['b']], act=m['net']['act'])
        entry['hidden'] = r.get('hidden', 0); entry['epochs'] = r.get('epochs', 30)
        entry['trainAuc'] = roc_auc(score_head(m, F['clean']), y)   # in-sample on clean training windows
        entry['trainWindows'] = int(len(ytr)); entry['trainPositiveWindows'] = int(ytr.sum())
    final[fam] = entry
    print(f'chosen {fam}: {r["name"]} thr {thr:.4f} CV crit {r["crit"]:.4f}', flush=True)

# ---- YAMNet sound-category tags: thresholds from folds 1-4 clips only (clip score = max over kept windows of max over mapped classes)
TAGS = {'snore-like': dict(cls=[38, 41], esc='snoring'), 'cough-like': dict(cls=[42], esc='coughing'), 'sneeze-like': dict(cls=[44], esc='sneezing'),
        'breathing': dict(cls=[36], esc='breathing'), 'gasp-like': dict(cls=[39], esc=None), 'wheeze-like': dict(cls=[37], esc=None)}
clips = {}
for i, r in enumerate(rows): clips.setdefault(r['clip'], []).append(i)
cids = list(clips)
ccls = np.array([rows[clips[c][0]]['cls'] for c in cids])
tag_out = {}
for tag, d in TAGS.items():
    if d['esc'] is None:
        tag_out[tag] = dict(classes=d['cls'], threshold=None, evaluated=False, note='no ESC-50 ground truth class; not evaluated; not enabled'); continue
    cs = np.array([S[clips[c]][:, d['cls']].max() for c in cids]); t = (ccls == d['esc']).astype(int)
    best_t, best_f = None, -1
    for th in np.round(np.arange(0.02, 0.96, 0.01), 2):
        p = cs >= th; tp = (p & (t == 1)).sum(); fp = (p & (t == 0)).sum(); fn = (~p & (t == 1)).sum()
        f05 = (1.25 * tp) / (1.25 * tp + 0.25 * fn + fp) if tp else 0.0
        if f05 > best_f: best_t, best_f = float(th), float(f05)
    tag_out[tag] = dict(classes=d['cls'], threshold=best_t, evaluated=True, escClass=d['esc'], trainFoldsF05=best_f, trainFoldClips=len(cids), positives=int(t.sum()))
    print(f'tag {tag}: thr {best_t} F0.5(folds1-4) {best_f:.3f}', flush=True)

json.dump(dict(
    useKaggle=USE_KAGGLE, trainFolds=TRAIN_FOLDS, rule='ship the highest-CV-criterion candidate (incl. v1) that passes the fold-5 gate; criterion = mean pooled OOF AUC over (clean, lp4k); preregistered before the test fold was touched',
    v1Reference=json.load(open(os.path.join(PROC, 'trained.v2.json')))['v1Reference'] if os.path.exists(os.path.join(PROC, 'trained.v2.json')) else dict(cvAucClean=0.907, cvAucLp4k=0.785, cvCriterion=0.846),
    grid=[{k: v for k, v in r.items() if not k.startswith('oof')} for r in results], chosen=final, tags=tag_out, speechExcludeThreshold=0.5,
), open(os.path.join(YDIR, OUT), 'w'))
print('wrote', os.path.join(YDIR, OUT))
