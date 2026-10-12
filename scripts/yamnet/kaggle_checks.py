"""Kaggle-specific generalisation evidence (runs only when Kaggle clips are in the manifest). Uses folds 1-4 for any fitting that is
used for decisions; cross-dataset TEST sets are the other dataset. Writes data/processed/yamnet/kaggle_checks.json.

  1. Source-confound check: can a classifier tell Kaggle from ESC-50 (negatives only; positives only; and from loudness alone)?
     AUC >= 0.95 is flagged 'trivially separable'. 5-fold pooled out-of-fold, using each dataset's own fold ids.
  2. Cross-dataset (the main generalisation evidence): train on ESC-50 folds 1-4 -> test on ALL Kaggle clips; train on Kaggle folds 1-4
     -> test on ALL ESC-50 clips. Hyper-parameters are the ones CV chose on ESC-50 (trained.v3.json), not re-tuned on the target.
  3. Within-Kaggle: the combined (ESC+Kaggle) model is scored on Kaggle fold 5 in evaluate_test.py.
Metric tables use clip-bootstrap CIs. Thresholds: ESC->Kaggle uses the ESC-chosen threshold (shows calibration shift);
Kaggle->ESC uses a Youden threshold from Kaggle folds 1-4 out-of-fold scores."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from common import *

rows = window_rows()
if not any(r['source'] == 'kaggle' for r in rows):
    print('no Kaggle rows: nothing to do'); sys.exit(0)
T = json.load(open(os.path.join(YDIR, 'trained.v3.json')))          # ESC-only selection
E, S = load_clean(rows)
y = np.array([r['label'] for r in rows]); fold = np.array([r['fold'] for r in rows]); src = np.array([r['source'] for r in rows])
clip = np.array([r['clip'] for r in rows]); rms = np.array([r['rms'] for r in rows])
isk = src == 'kaggle'
aug = load_aug(rows)
out = {}


def oof_auc(X, t, folds, l2=1e-2):
    o = np.full(len(t), np.nan)
    for f in np.unique(folds):
        tr, te = folds != f, folds == f
        if len(np.unique(t[tr])) < 2 or te.sum() == 0: continue
        m = fit_head('logreg', X[tr], t[tr], np.zeros(tr.sum(), bool), l2)
        o[te] = score_head(m, X[te])
    ok = ~np.isnan(o)
    return float(roc_auc(o[ok], t[ok]))


conf = {}
for name, sel in (('negativesOnly', y == 0), ('positivesOnly', y == 1)):
    t = isk[sel].astype(int)
    if t.sum() < 5 or (1 - t).sum() < 5: conf[name] = None; continue
    conf[name] = dict(embeddingAuc=oof_auc(E[sel], t, fold[sel]), loudnessOnlyAuc=oof_auc(rms[sel][:, None], t, fold[sel]), n=int(sel.sum()),
                      kaggleWindows=int(t.sum()))
vals = [v['embeddingAuc'] for v in conf.values() if v]
conf['triviallySeparable'] = bool(vals and max(vals) >= 0.95)
conf['note'] = 'AUC ~0.5 = sources indistinguishable on this feature; >= 0.95 flagged. Embedding-based: a high value means dataset source is encoded in the features and cross-dataset numbers matter more than within-dataset ones.'
out['sourceConfound'] = conf


logit = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
Xof = lambda entry: E if entry['feat'] == 'emb' else logit(S)


def fit_cfg(entry, tr):
    """Refit a CV-chosen head on the index set `tr` (clean rows plus augmented copies of those rows if the config uses augmentation)."""
    XA = Xof(entry)
    X, t, b = XA[tr], y[tr], np.array([r['bedroom'] for r in rows])[tr]
    if entry['augment']:
        trset = set(np.where(tr)[0].tolist())
        for k in ('aug0', 'aug1', 'aug2'):
            ri, ae, asc = aug[k]
            ae = ae if entry['feat'] == 'emb' else logit(asc)
            keep = np.array([i in trset for i in ri], bool)
            X = np.concatenate([X, ae[keep]]); t = np.concatenate([t, y[ri[keep]]]); b = np.concatenate([b, np.array([rows[i]['bedroom'] for i in ri[keep]])])
    return fit_head(entry['kind'], X, t, b, entry['l2'], entry.get('hidden') or 32, entry.get('epochs', 30))


def report(s, t, c, thr):
    return full_report(s, t, c, thr, B=500)


cross = {}
trainable = fold != TEST_FOLD
esc_tr = (~isk) & np.isin(fold, TRAIN_FOLDS); k_tr = isk & np.isin(fold, TRAIN_FOLDS)
for fam in [k for k in T['chosen'] if k != 'zeroshot']:
    ent = T['chosen'][fam]
    XA = Xof(ent)
    m = fit_cfg(ent, esc_tr)
    s = score_head(m, XA[isk])
    a = report(s, y[isk], clip[isk], ent['threshold'])
    mk = fit_cfg(ent, k_tr)
    # threshold for Kaggle->ESC: Youden J on Kaggle folds 1-4 out-of-fold scores
    oo = np.full(len(rows), np.nan)
    for f in TRAIN_FOLDS:
        tr = isk & np.isin(fold, [g for g in TRAIN_FOLDS if g != f]); va = isk & (fold == f)
        if va.sum() and len(np.unique(y[tr])) == 2:
            oo[va] = score_head(fit_cfg(ent, tr), XA[va])
    ok = ~np.isnan(oo)
    thr_k = pick_threshold(oo[ok], y[ok], np.zeros(ok.sum(), bool), 1.0)
    s2 = score_head(mk, XA[~isk])
    bedneg = np.array([r['bedroom'] and r['label'] == 0 for r in rows])[~isk]
    b = full_report(s2, y[~isk], clip[~isk], thr_k, bedneg, B=500)
    cross[fam] = dict(config=ent['name'], escToKaggle={**a, 'threshold': ent['threshold']}, kaggleToEsc={**b, 'threshold': thr_k})
    print(fam, 'ESC->Kaggle AUC', round(a['auc'], 3), 'Kaggle->ESC AUC', round(b['auc'], 3), flush=True)
zs = T['chosen']['zeroshot']
s_all = S[:, zs['classes']].max(1)
cross['zeroshot'] = dict(config=zs['name'], onKaggle=report(s_all[isk], y[isk], clip[isk], zs['threshold']), onEsc=full_report(
    s_all[~isk], y[~isk], clip[~isk], zs['threshold'], np.array([r['bedroom'] and r['label'] == 0 for r in rows])[~isk], B=500))
out['crossDataset'] = cross
json.dump(out, open(os.path.join(YDIR, 'kaggle_checks.json'), 'w'), indent=1)
print('wrote kaggle_checks.json')
