"""False-positive / false-negative error analysis for the v3 snore-like head. DEVELOPMENT data only: folds 1-4 out-of-fold predictions
(scripts/eval/oof_heads.py). Fold 5 is not read. Writes model/error_analysis.v3.json and docs/MODEL_ERROR_LISTENING_LIST.csv
(paths and offsets only, no audio copies). Run: python3 -I scripts/eval/error_analysis.py
"""
import os, sys, json, csv
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'yamnet'))
sys.path.insert(0, HERE)
import numpy as np
from common import *   # noqa: F401,F403
from yamnet_np import read_wav_f32

from esc_types import TYPE, STRADDLE
RAW = os.path.join(ROOT, 'data/raw/esc50/ESC-50-master/audio')
THR = json.load(open(os.path.join(YDIR, 'trained.v3.json')))['chosen']['logreg_scores']['threshold']


def raw_path(clip):
    return os.path.join('data/raw/esc50/ESC-50-master/audio', clip.split('/')[1] + '.wav')


def envelope_stats(file):
    """50 ms RMS envelope (dB) of a processed clip -> per-window helpers."""
    x = read_wav_f32(os.path.join(PROC, file)).astype(np.float64)
    n = len(x) // 800
    e = 10 * np.log10(np.maximum((x[:n * 800].reshape(n, 800) ** 2).mean(1), 1e-12))
    return e


def main():
    z = np.load(os.path.join(YDIR, 'oof_v3.npz'))
    clip, start, s, y, fold, cls, rms, file = (z[k] for k in ('clip', 'start', 'score', 'y', 'fold', 'cls', 'rms', 'wavfile'))
    assert fold.min() >= 1 and fold.max() <= 4
    pred = s >= THR
    n = len(y)
    out = dict(label='DEVELOPMENT folds 1-4 out-of-fold; fold 5 not used', threshold=THR, windows=int(n), positives=int((y == 1).sum()),
               tp=int((pred & (y == 1)).sum()), fp=int((pred & (y == 0)).sum()), fn=int((~pred & (y == 1)).sum()), tn=int((~pred & (y == 0)).sum()),
               pooledOofAuc=roc_auc(s, y))
    out['precision'] = out['tp'] / (out['tp'] + out['fp']); out['recall'] = out['tp'] / (out['tp'] + out['fn']); out['fpr'] = out['fp'] / (out['fp'] + out['tn'])
    out['perFold'] = {int(f): dict(tp=int((pred & (y == 1) & (fold == f)).sum()), fp=int((pred & (y == 0) & (fold == f)).sum()),
                                  positives=int(((y == 1) & (fold == f)).sum()), positiveClips=len(set(clip[(y == 1) & (fold == f)]))) for f in TRAIN_FOLDS}
    neg = y == 0
    ntypes = np.array([TYPE.get(c, 'snoring' if c == 'snoring' else '??') for c in cls])
    assert '??' not in set(ntypes[neg]), set(cls[neg & (ntypes == '??')])
    # ---- FP by class and by type
    byclass = []
    for c in sorted(set(cls[neg])):
        m = neg & (cls == c)
        byclass.append(dict(cls=str(c), type=TYPE[c], negWindows=int(m.sum()), fp=int((pred & m).sum()), rate=float((pred & m).sum() / m.sum()),
                            clips=len(set(clip[m])), clipsWithFp=len(set(clip[pred & m])), share=float((pred & m).sum() / max(1, out['fp']))))
    byclass.sort(key=lambda d: -d['fp'])
    bytype = []
    for t in sorted(set(TYPE.values())):
        m = neg & (ntypes == t)
        bytype.append(dict(type=t, negWindows=int(m.sum()), fp=int((pred & m).sum()), rate=float((pred & m).sum() / m.sum()), share=float((pred & m).sum() / out['fp']),
                           clips=len(set(clip[m])), clipsWithFp=len(set(clip[pred & m])), classes=sorted(set(cls[m]))))
    bytype.sort(key=lambda d: -d['fp'])
    bed = np.array([bool(b) for b in z['bedroom']])
    out['byClass'], out['byType'] = byclass, bytype
    out['bedroomNegFpr'] = float((pred & neg & bed).sum() / (neg & bed).sum())
    # concentration: how many clips carry half of the FP windows
    fpclip = {}
    for c in clip[pred & neg]: fpclip[c] = fpclip.get(c, 0) + 1
    cnt = np.array(sorted(fpclip.values(), reverse=True)); cum = np.cumsum(cnt) / cnt.sum()
    out['fpConcentration'] = dict(fpWindows=int(cnt.sum()), clipsWithFp=len(cnt), clipsFor50pct=int(np.searchsorted(cum, 0.5) + 1), clipsFor80pct=int(np.searchsorted(cum, 0.8) + 1),
                                  negativeClips=len(set(clip[neg])))
    # ---- top-50 FP listening list: highest scores, at most 2 windows per clip (adjacent windows overlap by half; this keeps the list varied)
    order = np.argsort(-np.where(pred & neg, s, -1))
    per, top = {}, []
    for i in order:
        if not (pred[i] and neg[i]): break
        if per.get(clip[i], 0) >= 2: continue
        per[clip[i]] = per.get(clip[i], 0) + 1
        top.append(i)
        if len(top) == 50: break
    # ---- FN: quiet / short / background (proxies computed from the clip envelope; no listening labels exist)
    pos = np.where(y == 1)[0]
    env_cache = {}
    feats = {}
    for i in pos:
        f = str(file[i])
        if f not in env_cache: env_cache[f] = envelope_stats(f)
        e = env_cache[f]
        a = int(start[i] / 800); w = e[a:a + 20]
        p95, p10 = np.percentile(e, 95), np.percentile(e, 10)
        active = float(np.mean(w >= p95 - 12))
        feats[i] = dict(rms=float(rms[i]), active=active, dyn=float(p95 - p10))
    r_all = np.array([feats[i]['rms'] for i in pos]); act = np.array([feats[i]['active'] for i in pos]); dyn = np.array([feats[i]['dyn'] for i in pos])
    fnm = ~pred[pos]
    q_thr = float(np.percentile(r_all, 25))
    cats = {
        f'quiet window (RMS <= {q_thr:.1f} dBFS, bottom quartile of snoring windows)': r_all <= q_thr,
        'brief snore (< 25% of the window within 12 dB of the clip peak level)': act < 0.25,
        'snore on steady background (clip dynamic range p95-p10 < 20 dB)': dyn < 20,
        'loud, sustained, high-contrast (none of the above)': (r_all > q_thr) & (act >= 0.25) & (dyn >= 20),
    }
    out['fn'] = dict(total=int(fnm.sum()), positives=int(len(pos)), recall=float(1 - fnm.mean()), categories={
        k: dict(windows=int(m.sum()), fn=int((fnm & m).sum()), missRate=float((fnm & m).sum() / max(1, m.sum()))) for k, m in cats.items()},
        note='Categories are proxies computed from signal level, not listening labels; they overlap. Quiet-quartile cut is relative to this dataset.')
    pc = []
    for c in sorted(set(clip[pos])):
        m = (clip == c) & (y == 1)
        pc.append(dict(clip=str(c), fold=int(fold[m][0]), windows=int(m.sum()), missed=int((~pred & m).sum()), meanRms=float(rms[m].mean()), maxScore=float(s[m].max())))
    out['fn']['perClip'] = sorted(pc, key=lambda d: -d['missed'] / d['windows'])
    clipsAllMissed = [d for d in pc if d['missed'] == d['windows']]
    out['fn']['clipsFullyMissed'] = len(clipsAllMissed); out['fn']['clipsWithAnyFlag'] = sum(1 for d in pc if d['missed'] < d['windows']); out['fn']['positiveClips'] = len(pc)
    # FN listening list: the 25 lowest-scoring missed positive windows, max 2 per clip
    fn_idx = [i for i in pos if not pred[i]]
    fn_idx.sort(key=lambda i: s[i]); per = {}; fn_top = []
    for i in fn_idx:
        if per.get(clip[i], 0) >= 2: continue
        per[clip[i]] = per.get(clip[i], 0) + 1; fn_top.append(i)
        if len(fn_top) == 25: break
    rows = []
    for rank, i in enumerate(top, 1):
        rows.append(dict(list='false_positive', rank=rank, esc50_file=raw_path(clip[i]), offset_s=start[i] / 16000, duration_s=1.0, cls=cls[i], type=TYPE[cls[i]], fold=int(fold[i]), oof_score=round(float(s[i]), 4), rms_dbfs=round(float(rms[i]), 1)))
    for rank, i in enumerate(fn_top, 1):
        rows.append(dict(list='false_negative', rank=rank, esc50_file=raw_path(clip[i]), offset_s=start[i] / 16000, duration_s=1.0, cls=cls[i], type='snoring (missed)', fold=int(fold[i]), oof_score=round(float(s[i]), 4), rms_dbfs=round(float(rms[i]), 1)))
    out['listening'] = rows
    out['topFpByType'] = {t: sum(1 for r in rows if r['list'] == 'false_positive' and r['type'] == t) for t in sorted(set(TYPE.values()))}
    json.dump(out, open(os.path.join(MODEL_DIR, 'error_analysis.v3.json'), 'w'), indent=1)
    with open(os.path.join(ROOT, 'docs/MODEL_ERROR_LISTENING_LIST.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print(json.dumps({k: v for k, v in out.items() if k not in ('listening', 'byClass', 'fn')}, indent=1))
    print(json.dumps(out['fn']['categories'], indent=1), out['fn']['clipsFullyMissed'], out['fn']['positiveClips'])
    print('top classes', [(d['cls'], d['fp'], round(d['rate'], 3)) for d in byclass[:15]])


if __name__ == '__main__':
    main()
