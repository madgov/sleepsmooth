"""Out-of-fold (OOF) predictions for the exported v3 head configuration, on DEVELOPMENT folds 1-4 ONLY.

Config (copied from data/processed/yamnet/trained.v3.json -> chosen.logreg_scores, i.e. what ships in src/audio/model/model.v3.json):
logistic regression on logit(YAMNet 521 class scores), v2 augmentation copies in the training part, L2 = 0.01, class-balanced weights.
For each held-out fold f in {1,2,3,4} a head is fit on the other three folds (clean + augmentation copies) and scores fold f.
So every dev window is scored by a head that never saw its clip. Fold 5 is never read (window_rows is filtered, asserted).

Outputs (git-ignored, data/processed/yamnet/):  oof_v3.npz (per-window OOF scores) and oof_heads.json (the four held-out-fold heads).
Run: python3 -I scripts/eval/oof_heads.py
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'yamnet'))
import numpy as np
from common import *   # noqa: F401,F403

OUT_NPZ = os.path.join(YDIR, 'oof_v3.npz')
OUT_HEADS = os.path.join(YDIR, 'oof_heads.json')
logit = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))


def main():
    T = json.load(open(os.path.join(YDIR, 'trained.v3.json')))['chosen']['logreg_scores']
    assert T['kind'] == 'logreg' and T['feat'] == 'scores' and T['augment'] and abs(T['l2'] - 0.01) < 1e-12
    rows = [r for r in window_rows() if r['source'] == 'esc50' and r['fold'] in TRAIN_FOLDS]
    assert all(r['fold'] != TEST_FOLD for r in rows)
    _, S = load_clean(rows)
    y = np.array([r['label'] for r in rows]); fold = np.array([r['fold'] for r in rows]); bedr = np.array([r['bedroom'] for r in rows])
    aug = load_aug(rows)
    aug_idx = [aug[f'aug{k}'][0] for k in range(3)]
    aug_X = [logit(aug[f'aug{k}'][2]) for k in range(3)]
    X = logit(S)
    oof = np.full(len(rows), np.nan)
    heads = {}
    for vf in TRAIN_FOLDS:
        tr = np.where(fold != vf)[0]
        Xtr, ytr, btr = X[tr], y[tr], bedr[tr]
        for ai, ae in zip(aug_idx, aug_X):
            m = fold[ai] != vf
            Xtr = np.concatenate([Xtr, ae[m]]); ytr = np.concatenate([ytr, y[ai[m]]]); btr = np.concatenate([btr, bedr[ai[m]]])
        mdl = fit_head('logreg', Xtr, ytr, btr, T['l2'])
        va = np.where(fold == vf)[0]
        oof[va] = score_head(mdl, X[va])
        heads[str(vf)] = dict(norm=dict(mean=mdl['norm']['mean'].tolist(), std=mdl['norm']['std'].tolist()),
                              W=np.asarray(mdl['net']['W'][0]).tolist(), b=np.asarray(mdl['net']['b'][0]).tolist())
        print(f'fold {vf}: trained on {len(ytr)} windows, scored {len(va)}; fold AUC {roc_auc(oof[va], y[va]):.4f}', flush=True)
    bedneg = bedr & (y == 0)
    thr = pick_threshold(oof, y, bedneg, 0.05)
    print(f'pooled OOF AUC {roc_auc(oof, y):.4f} (trained.v3.json cvAucClean {T["cvAucClean"]:.4f}); threshold from OOF {thr:.4f} (shipped {T["threshold"]:.4f})')
    np.savez(OUT_NPZ, clip=np.array([r['clip'] for r in rows]), start=np.array([r['start'] for r in rows]), score=oof, y=y, fold=fold,
             cls=np.array([r['cls'] for r in rows]), bedroom=bedr, rms=np.array([r['rms'] for r in rows]), wavfile=np.array([r['file'] for r in rows]))
    json.dump(dict(threshold=T['threshold'], heads=heads, note='head trained WITHOUT the named fold; folds 1-4 only'), open(OUT_HEADS, 'w'))
    print('wrote', OUT_NPZ, OUT_HEADS)


if __name__ == '__main__':
    main()
