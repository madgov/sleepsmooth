"""Shared helpers for the YAMNet (v3) pipeline: paths, data loading, metrics, bootstrap, heads, augmentation.
NumPy + SciPy only (sklearn/h5py in this environment are binary-incompatible with NumPy 2.4)."""
import json, os, sys, zlib
import numpy as np
from scipy.optimize import minimize
from scipy.stats import rankdata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PROC = os.environ.get('SLEEP_PROC_DIR', os.path.join(ROOT, 'data/processed'))
YDIR = os.path.join(PROC, 'yamnet')
MODEL_DIR = os.environ.get('SLEEP_MODEL_DIR', os.path.join(ROOT, 'model'))
SEED = 20261010
TEST_FOLD = 5
TRAIN_FOLDS = [1, 2, 3, 4]
BEDROOM_NEG_WEIGHT = 2.0
os.makedirs(YDIR, exist_ok=True)


# ------------------------------------------------------------------ data
def load_manifest():
    return json.load(open(os.path.join(PROC, 'manifest.json')))


def kaggle_fold_override():
    p = os.path.join(YDIR, 'kaggle_folds.json')
    return json.load(open(p)) if os.path.exists(p) else {}


def window_rows(man=None):
    """One dict per kept window, manifest order (identical to scripts/extract-features.ts for ESC-50)."""
    man = man or load_manifest()
    ov = kaggle_fold_override()
    rows = []
    for c in man['clips']:
        fold = ov.get(c['id'], c['fold']) if c['source'] == 'kaggle' else c['fold']
        for w in c['windows']:
            if w['kept']:
                rows.append(dict(clip=c['id'], start=w['start'], label=c['label'], fold=fold, source=c['source'], cls=c['cls'],
                                 bedroom=bool(c['bedroom']), rms=w['rmsDbfs'], file=c['file']))
    return rows


def load_cache(name):
    p = os.path.join(YDIR, name)
    if not os.path.exists(p):
        return {}, np.zeros((0, 1024), np.float32), np.zeros((0, 521), np.float32)
    z = np.load(p, allow_pickle=False)
    keys = z['keys'].tolist()
    return {k: i for i, k in enumerate(keys)}, z['emb'], z['scores']


def save_cache(name, keys, emb, scores):
    np.savez(os.path.join(YDIR, name), keys=np.array(keys), emb=emb, scores=scores)


def load_clean(rows):
    """Embeddings (N,1024) and scores (N,521) aligned with `rows` (clean condition)."""
    idx, emb, sc = load_cache('clean.npz')
    sel = [idx[f"{r['clip']}|{r['start']}"] for r in rows]
    return emb[sel], sc[sel]


def load_aug(rows, kinds=('lp4k', 'aug0', 'aug1', 'aug2')):
    """Returns {kind: (row_index_array, emb, scores)} for rows that exist in the aug cache."""
    idx, emb, sc = load_cache('aug.npz')
    out = {}
    for k in kinds:
        ri, ci = [], []
        for i, r in enumerate(rows):
            j = idx.get(f"{r['clip']}|{r['start']}|{k}")
            if j is not None:
                ri.append(i); ci.append(j)
        out[k] = (np.array(ri, int), emb[ci], sc[ci])
    return out


# ------------------------------------------------------------------ metrics
def roc_auc(s, y, w=None):
    s, y = np.asarray(s, float), np.asarray(y)
    pos, neg = y == 1, y == 0
    if pos.sum() == 0 or neg.sum() == 0:
        return float('nan')
    if w is None:
        r = rankdata(s)
        return float((r[pos].sum() - pos.sum() * (pos.sum() + 1) / 2) / (pos.sum() * neg.sum()))
    w = np.asarray(w, float)
    o = np.argsort(s, kind='stable'); s, y, w = s[o], y[o], w[o]
    _, start = np.unique(s, return_index=True)
    gp = np.add.reduceat(w * (y == 1), start); gn = np.add.reduceat(w * (y == 0), start)
    below = np.concatenate([[0.0], np.cumsum(gn)[:-1]])
    return float((gp * (below + gn / 2)).sum() / (gp.sum() * gn.sum()))


def confusion(s, y, thr):
    s, y = np.asarray(s), np.asarray(y)
    p = s >= thr
    return dict(tp=int((p & (y == 1)).sum()), fp=int((p & (y == 0)).sum()), tn=int((~p & (y == 0)).sum()), fn=int((~p & (y == 1)).sum()))


def prf(c):
    d = lambda a, b: a / b if b else float('nan')
    p, r = d(c['tp'], c['tp'] + c['fp']), d(c['tp'], c['tp'] + c['fn'])
    return dict(accuracy=d(c['tp'] + c['tn'], sum(c.values())), precision=p, recall=r, f1=d(2 * p * r, p + r) if p == p and r == r else float('nan'),
                fpr=d(c['fp'], c['fp'] + c['tn']))


def pick_threshold(s, y, bedroom_neg, max_bed_fpr):
    """Port of scripts/lib/metrics.ts pickThreshold: maximise Youden J subject to bedroom-negative FPR <= max when feasible."""
    s, y, bed = np.asarray(s, float), np.asarray(y), np.asarray(bedroom_neg, bool)
    cands = np.unique(s)
    P, N = max(1, (y == 1).sum()), max(1, (y == 0).sum())
    sp, sn = np.sort(s[y == 1]), np.sort(s[y == 0])
    tpr = 1 - np.searchsorted(sp, cands, 'left') / P
    fpr = 1 - np.searchsorted(sn, cands, 'left') / N
    sb = np.sort(s[bed])
    bfpr = (1 - np.searchsorted(sb, cands, 'left') / len(sb)) if len(sb) else np.zeros(len(cands))
    J = tpr - fpr
    feas = bfpr <= max_bed_fpr
    if feas.any():
        k = np.where(feas)[0][np.argmax(J[feas])]
    else:
        k = int(np.argmax(J))
    return float(cands[k])


def sample_weights(y, bedroom):
    """Class-balanced (each class sums to 0.5 then x N so mean weight = 1); bedroom negatives count 2x within negatives."""
    y = np.asarray(y); raw = np.where(y == 1, 1.0, np.where(np.asarray(bedroom), BEDROOM_NEG_WEIGHT, 1.0))
    w = np.where(y == 1, raw / raw[y == 1].sum(), raw / raw[y == 0].sum()) * 0.5
    return w * len(y)


def bootstrap(clips, fn, B=1000, seed=7):
    """Resample CLIPS with replacement (all windows of a clip stay together). fn(idx)->dict of stats. Returns {stat:[lo,hi]}."""
    clips = np.asarray(clips)
    uniq, inv = np.unique(clips, return_inverse=True)
    groups = [np.where(inv == g)[0] for g in range(len(uniq))]
    rng = np.random.default_rng(seed)
    acc = {}
    for _ in range(B):
        pick = rng.integers(0, len(groups), len(groups))
        idx = np.concatenate([groups[g] for g in pick])
        for k, v in fn(idx).items():
            if v == v:
                acc.setdefault(k, []).append(v)
    return {k: [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))] for k, v in acc.items()}


def full_report(s, y, clips, thr, bedroom_neg=None, B=1000):
    """Overall metrics + 95% clip-bootstrap CIs (+ bedroom-negative FPR)."""
    s, y = np.asarray(s, float), np.asarray(y)
    bed = np.asarray(bedroom_neg) if bedroom_neg is not None else np.zeros(len(y), bool)

    def stats(idx):
        c = confusion(s[idx], y[idx], thr); m = prf(c)
        nb = bed[idx].sum()
        return dict(auc=roc_auc(s[idx], y[idx]), precision=m['precision'], recall=m['recall'], f1=m['f1'], fpr=m['fpr'],
                    bedroomFpr=((s[idx][bed[idx]] >= thr).sum() / nb) if nb else float('nan'))
    base = stats(np.arange(len(y)))
    c = confusion(s, y, thr)
    return dict(n=len(y), positives=int((y == 1).sum()), threshold=thr, confusion=c, **base, accuracy=prf(c)['accuracy'],
                ci95=bootstrap(clips, stats, B), bedroomWindows=int(bed.sum()))


def paired_auc_diff(s_a, s_b, y, clips, B=1000):
    s_a, s_b, y = np.asarray(s_a), np.asarray(s_b), np.asarray(y)
    f = lambda idx: dict(d=roc_auc(s_a[idx], y[idx]) - roc_auc(s_b[idx], y[idx]))
    return dict(diff=roc_auc(s_a, y) - roc_auc(s_b, y), ci95=bootstrap(clips, f, B)['d'])


def reliability(s, y, bins=10):
    """Fixed-width bins on the raw score. Shows observed positive fraction per bin. Scores are class-weighted, so they are NOT
    probabilities at the real base rate; the table documents that rather than correcting it."""
    s, y = np.asarray(s, float), np.asarray(y)
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for i in range(bins):
        m = (s >= edges[i]) & ((s < edges[i + 1]) if i < bins - 1 else (s <= 1.0))
        out.append(dict(lo=float(edges[i]), hi=float(edges[i + 1]), n=int(m.sum()), meanScore=float(s[m].mean()) if m.any() else None,
                        observedPositiveFraction=float(y[m].mean()) if m.any() else None))
    return out


# ------------------------------------------------------------------ heads
def fit_norm(X):
    return X.mean(0), X.std(0) + 1e-6


def _sig(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -60, 60)))


def fit_logreg(X, y, w, l2):
    """Weighted logistic regression, objective (1/N) sum w_i logloss_i + (l2/2)||beta||^2 (intercept unpenalised). L-BFGS."""
    n, d = X.shape; y = y.astype(float)

    def f(p):
        b, b0 = p[:d], p[d]
        z = X @ b + b0
        ll = np.logaddexp(0, z) - y * z
        g = (w * (_sig(z) - y)) / n
        return (w * ll).sum() / n + 0.5 * l2 * b @ b, np.concatenate([X.T @ g + l2 * b, [g.sum()]])
    r = minimize(f, np.zeros(d + 1), jac=True, method='L-BFGS-B', options=dict(maxiter=500))
    return dict(W=[r.x[:d][None, :]], b=[np.array([r.x[d]])], act=['sigmoid'])


def fit_mlp(X, y, w, l2, hidden=32, epochs=30, lr=1e-3, batch=128, seed=SEED):
    rng = np.random.default_rng(seed)
    n, d = X.shape; y = y.astype(np.float32)
    W1 = (rng.standard_normal((d, hidden)) * np.sqrt(2.0 / d)).astype(np.float32); b1 = np.zeros(hidden, np.float32)
    W2 = (rng.standard_normal((hidden, 1)) * np.sqrt(1.0 / hidden)).astype(np.float32); b2 = np.zeros(1, np.float32)
    P = [W1, b1, W2, b2]; m = [np.zeros_like(p) for p in P]; v = [np.zeros_like(p) for p in P]; t = 0
    X = X.astype(np.float32); w = w.astype(np.float32)
    for _ in range(epochs):
        order = rng.permutation(n)
        for i in range(0, n, batch):
            ix = order[i:i + batch]; xb, yb, wb = X[ix], y[ix], w[ix]
            h = np.maximum(xb @ P[0] + P[1], 0); z = (h @ P[2] + P[3])[:, 0]; p = 1 / (1 + np.exp(-np.clip(z, -60, 60)))
            dz = (wb * (p - yb) / len(ix))[:, None]
            gW2 = h.T @ dz + l2 * P[2]; gb2 = dz.sum(0)
            dh = (dz @ P[2].T) * (h > 0)
            gW1 = xb.T @ dh + l2 * P[0]; gb1 = dh.sum(0)
            t += 1
            for k, g in enumerate([gW1, gb1, gW2, gb2]):
                m[k] = 0.9 * m[k] + 0.1 * g; v[k] = 0.999 * v[k] + 0.001 * g * g
                P[k] -= lr * (m[k] / (1 - 0.9 ** t)) / (np.sqrt(v[k] / (1 - 0.999 ** t)) + 1e-8)
    return dict(W=[P[0].T.astype(float), P[2].T.astype(float)], b=[P[1].astype(float), P[3].astype(float)], act=['relu', 'sigmoid'])


def head_forward(net, X):
    h = np.asarray(X, float)
    for W, b, a in zip(net['W'], net['b'], net['act']):
        z = h @ np.asarray(W).T + np.asarray(b)
        h = np.maximum(z, 0) if a == 'relu' else _sig(z) if a == 'sigmoid' else z
    return h[:, 0]


def fit_head(kind, X, y, bedroom, l2, hidden=32, epochs=30):
    """Fit norm on THIS training set only, then the head. Returns dict with norm + net."""
    mean, std = fit_norm(X)
    Z = (X - mean) / std
    w = sample_weights(y, bedroom)
    net = fit_logreg(Z, y, w, l2) if kind == 'logreg' else fit_mlp(Z, y, w, l2, hidden, epochs)
    return dict(kind=kind, norm=dict(mean=mean, std=std), net=net)


def score_head(m, X):
    return head_forward(m['net'], (X - m['norm']['mean']) / m['norm']['std'])


# ------------------------------------------------------------------ audio perturbations (NumPy port of scripts/lib/dsp.ts)
def lowpass(x, fc, rate=16000, taps=127):
    n = np.arange(taps) - (taps - 1) / 2
    f = fc / rate
    h = np.where(n == 0, 2 * f, np.sin(2 * np.pi * f * n) / (np.pi * np.where(n == 0, 1, n)))
    i = np.arange(taps)
    h = h * (0.42 - 0.5 * np.cos(2 * np.pi * i / (taps - 1)) + 0.08 * np.cos(4 * np.pi * i / (taps - 1)))
    h = h / h.sum()
    return np.convolve(x, h, mode='same').astype(np.float32)


def white_noise(n, rng):
    return rng.standard_normal(n).astype(np.float32)


def pink_noise(n, rng):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.arange(len(spec)); f[0] = 1
    out = np.fft.irfft(spec / np.sqrt(f), n)
    return (out / out.std()).astype(np.float32)


def add_noise(x, noise, sig_rms, snr_db):
    g = sig_rms / 10 ** (snr_db / 20) / np.sqrt(np.mean(noise.astype(np.float64) ** 2))
    return (x + g * noise).astype(np.float32)


def clip_rng(clip_id, salt):
    return np.random.default_rng([salt, zlib.crc32(clip_id.encode())])
