"""ONE evaluation on the held-out test fold (fold 5) for: v1 (shipped baseline), YAMNet zero-shot, YAMNet-embedding logistic regression,
YAMNet-embedding MLP. Refuses to overwrite its metrics file unless EVAL_FORCE=1 (a crash before the file is written is not a re-run).
Everything selected before this script runs: heads, L2, augmentation, thresholds, tag thresholds (train_cv.py, folds 1-4 only).
Also: robustness (noise / 8 kHz band-limit), calibration reliability table, overfitting table, YAMNet sound-category tag evaluation, and
(if Kaggle clips are present) per-source metrics, the confound gate and the cross-dataset results from kaggle_checks.py.

NOTE ON OPTIMISM: fold 5 (ESC-50) was already scored twice (v1, v2). v3 changes were chosen on folds 1-4 only, but the fold-5 estimate for
v3 is still mildly optimistic because the same fold has been looked at by earlier versions of this project."""
import sys, os, json, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from common import *
from yamnet_np import read_wav_f32, window_to_patch
from yamnet_backend import YamNet, SCORES_ONLY

METRICS = os.path.join(MODEL_DIR, os.environ.get('METRICS_FILE', 'metrics.v3.json'))
TRAINED = os.environ.get('TRAINED_V3', 'trained.v3.json')
FFMPEG = os.environ.get('FFMPEG', '/usr/local/bin/ffmpeg')
if os.path.exists(METRICS) and not os.environ.get('EVAL_FORCE'):
    raise SystemExit(f'{METRICS} exists: the test fold is evaluated once. Set EVAL_FORCE=1 to re-run deliberately.')

T = json.load(open(os.path.join(YDIR, TRAINED)))
USE_KAGGLE = T['useKaggle']
rows_all = window_rows()
rows = [r for r in rows_all if USE_KAGGLE or r['source'] == 'esc50']
te = [i for i, r in enumerate(rows) if r['fold'] == TEST_FOLD]
R = [rows[i] for i in te]
E_all, S_all = load_clean(rows)
E, S = E_all[te], S_all[te]
y = np.array([r['label'] for r in R]); clip = np.array([r['clip'] for r in R]); cls = np.array([r['cls'] for r in R]); src = np.array([r['source'] for r in R])
bedneg = np.array([r['bedroom'] and r['label'] == 0 for r in R])
print(f'test windows {len(R)} positives {int(y.sum())} (clips {len(set(clip))}, positive clips {len(set(clip[y == 1]))})', flush=True)


def head_model(entry):
    return dict(norm=dict(mean=np.array(entry['norm']['mean']), std=np.array(entry['norm']['std'])), net=dict(W=entry['net']['W'], b=entry['net']['b'], act=entry['net']['act']))

# ---------- candidate scores on test
cands = {}
zs = T['chosen']['zeroshot']
cands['zeroshot'] = dict(entry=zs, score=lambda E_, S_: S_[:, zs['classes']].max(1))
logit = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
HEADS = [k for k in T['chosen'] if k != 'zeroshot']
for fam in HEADS:
    ent = T['chosen'][fam]; hm = head_model(ent)
    pick_in = (lambda E_, S_: E_) if ent['feat'] == 'emb' else (lambda E_, S_: logit(S_))
    cands[fam] = dict(entry=ent, score=(lambda hm_, pk: (lambda E_, S_: score_head(hm_, pk(E_, S_))))(hm, pick_in), model=hm)
test_scores = {k: v['score'](E, S) for k, v in cands.items()}

# v1 (shipped): same windows, its own 80-d features
v1j = json.load(open(os.path.join(ROOT, 'src/audio/model/model.json')))
feat_idx = json.load(open(os.path.join(PROC, 'features.index.json')))
fb = np.fromfile(os.path.join(PROC, 'features.bin'), '<f4').reshape(len(feat_idx), -1)
fkey = {f"{r['clip']}|{r['start']}": i for i, r in enumerate(feat_idx)}
v1_ok = np.array([f"{r['clip']}|{r['start']}" in fkey for r in R])
v1net = dict(W=[np.array(l['weights']) for l in v1j['layers']], b=[np.array(l['bias']) for l in v1j['layers']], act=[l['activation'] for l in v1j['layers']])
v1_scores = np.full(len(R), np.nan)
v1_scores[v1_ok] = head_forward(v1net, (fb[[fkey[f"{r['clip']}|{r['start']}"] for r, ok in zip(R, v1_ok) if ok]] - np.array(v1j['norm']['mean'])) / np.array(v1j['norm']['std']))
v1m = json.load(open(os.path.join(MODEL_DIR, 'metrics.v1.json')))
V1_THR = v1j['threshold']
ref = T['v1Reference']

# ---------- headline table
report = {}
for k, sc in test_scores.items():
    thr = cands[k]['entry']['threshold']
    rep = full_report(sc, y, clip, thr, bedneg)
    cls_f = {}
    for c in np.unique(cls[y == 0]):
        m = (cls == c) & (y == 0); cls_f[c] = float((sc[m] >= thr).mean())
    rep['worstNegativeClasses'] = [dict(cls=c, fpr=v) for c, v in sorted(cls_f.items(), key=lambda kv: -kv[1])[:8]]
    rep['cvAucClean'] = cands[k]['entry']['cvAucClean']; rep['cvAucLp4k'] = cands[k]['entry']['cvAucLp4k']; rep['cvCriterion'] = cands[k]['entry']['cvCriterion']
    rep['trainAucInSample'] = cands[k]['entry']['trainAuc']; rep['name'] = cands[k]['entry']['name']
    rep['reliability'] = reliability(sc, y) if k != 'zeroshot' else reliability(sc, y)
    if USE_KAGGLE:
        rep['perSource'] = {}
        for so in ('esc50', 'kaggle'):
            m = src == so
            if m.any(): rep['perSource'][so] = full_report(sc[m], y[m], clip[m], thr, bedneg[m], B=500)
    report[k] = rep
ok1 = v1_ok
rep1 = full_report(v1_scores[ok1], y[ok1], clip[ok1], V1_THR, bedneg[ok1])
rep1['cvAucClean'] = ref['cvAucClean']; rep1['cvAucLp4k'] = ref['cvAucLp4k']; rep1['cvCriterion'] = ref['cvCriterion']; rep1['name'] = v1j['version']
report['v1'] = rep1
pair = {}
for k in ['zeroshot'] + HEADS:
    pair[f'{k}_minus_v1'] = paired_auc_diff(test_scores[k][ok1], v1_scores[ok1], y[ok1], clip[ok1])
for k in HEADS:
    pair[f'{k}_minus_zeroshot'] = paired_auc_diff(test_scores[k], test_scores['zeroshot'], y, clip)
if not SCORES_ONLY:
    pair['mlp_minus_logreg'] = paired_auc_diff(test_scores['mlp'], test_scores['logreg'], y, clip)
    pair['mlp_scores_minus_mlp'] = paired_auc_diff(test_scores['mlp_scores'], test_scores['mlp'], y, clip)
else:
    pair['mlp_scores_minus_logreg_scores'] = paired_auc_diff(test_scores['mlp_scores'], test_scores['logreg_scores'], y, clip)

# ---------- gate (preregistered; identical to v1's three conditions)
kc = json.load(open(os.path.join(YDIR, 'kaggle_checks.json'))) if USE_KAGGLE and os.path.exists(os.path.join(YDIR, 'kaggle_checks.json')) else None
gates = {}
for k in ['zeroshot'] + HEADS:
    r = report[k]
    g = dict(aucAtLeast085=r['auc'] >= 0.85, ambientFpAtMost10=r['bedroomFpr'] <= 0.10)
    g['beatsBaseline'] = True if k == 'zeroshot' else bool(r['auc'] > report['zeroshot']['auc'])
    g['beatsBaselineNote'] = 'baseline = YAMNet zero-shot Snoring score; zero-shot is itself the baseline' if k == 'zeroshot' else f"{k} test AUC {r['auc']:.3f} vs zero-shot {report['zeroshot']['auc']:.3f}"
    if USE_KAGGLE:
        wk = r.get('perSource', {}).get('kaggle')
        g['withinKaggleAucAtLeast085'] = bool(wk and wk['auc'] >= 0.85)
        sc_auc = (kc or {}).get('sourceConfound', {}).get('negativesOnly')
        g['sourceNotTriviallySeparable'] = bool(sc_auc and sc_auc['embeddingAuc'] < 0.95)
    g['pass'] = all(v for kk, v in g.items() if isinstance(v, bool))
    gates[k] = g
gates['v1'] = {'pass': bool(v1m['gate']['pass']), 'note': 'v1 gate result from model/metrics.v1.json (fold 5, scored previously)'}
passing = [(k, report[k]['cvCriterion']) for k in ['v1', 'zeroshot'] + HEADS if gates[k]['pass']]
shipped = max(passing, key=lambda kv: kv[1])[0] if passing else None
decision = dict(rule=T['rule'], candidatesPassingGate=passing, shipped=shipped)

# ---------- robustness: perturb fold-5 audio, re-embed, score with the fixed thresholds
man = load_manifest()
files = {c['id']: c['file'] for c in man['clips']}
CONDS = [('clean', None), ('white noise SNR 20 dB', ('white', 20)), ('white noise SNR 10 dB', ('white', 10)), ('pink noise SNR 20 dB', ('pink', 20)),
         ('pink noise SNR 10 dB', ('pink', 10)), ('8 kHz sampling rate (4 kHz bandwidth, phone proxy)', ('lp8k', None))]
net = YamNet()
by_clip = {}
for i, r in enumerate(R): by_clip.setdefault(r['clip'], []).append(i)


def lp8k(path):
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, 'a.wav'), os.path.join(d, 'b.wav')
        subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', path, '-ar', '8000', a], check=True)
        subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', a, '-ar', '16000', '-c:a', 'pcm_f32le', b], check=True)
        return read_wav_f32(b)

robust = {}
for ci, (cname, spec) in enumerate(CONDS):
    if spec is None:
        Ec, Sc = E, S
    else:
        Ec = np.zeros_like(E); Sc = np.zeros_like(S)
        for cid, ix in by_clip.items():
            x = read_wav_f32(os.path.join(PROC, files[cid]))
            starts = [R[i]['start'] for i in ix]
            if spec[0] == 'lp8k': x = lp8k(os.path.join(PROC, files[cid]))
            else:
                rng = clip_rng(cid, SEED + 99 + ci)
                sig = np.sqrt(np.mean(np.concatenate([x[s:s + 16000] for s in starts]).astype(np.float64) ** 2))
                x = add_noise(x, (white_noise if spec[0] == 'white' else pink_noise)(len(x), rng), sig, spec[1])
            P = np.stack([window_to_patch(np.pad(x[s:s + 16000], (0, max(0, 16000 - len(x[s:s + 16000]))))) for s in starts])
            e, s_ = net.embed(P)
            Ec[ix] = e; Sc[ix] = s_
    rc = {}
    for k, c in cands.items():
        sc = c['score'](Ec, Sc); thr = c['entry']['threshold']
        cf = prf(confusion(sc, y, thr))
        rc[k] = dict(auc=roc_auc(sc, y), recall=cf['recall'], fpr=cf['fpr'], bedroomFpr=float((sc[bedneg] >= thr).mean()), precision=cf['precision'])
    robust[cname] = rc
    print('robust', cname, {k: round(v['auc'], 3) for k, v in rc.items()}, flush=True)
v1rob = v1m['robustnessWinner']

# ---------- YAMNet sound-category tags (clip level = max over kept windows). Thresholds fixed on folds 1-4 in train_cv.py.
tags_eval = {}
cids = list(by_clip)
cc = np.array([R[by_clip[c][0]]['cls'] for c in cids])
csrc = np.array([R[by_clip[c][0]]['source'] for c in cids])
sp_thr = T['speechExcludeThreshold']
speech = np.array([S[by_clip[c]][:, 0].max() for c in cids])
excluded = speech >= sp_thr
for tag, d in T['tags'].items():
    sc = np.array([S[by_clip[c]][:, d['classes']].max() for c in cids])
    if not d['evaluated']:
        fires = sc >= 0.5
        tags_eval[tag] = dict(evaluated=False, note=d['note'], classes=d['classes'], descriptiveOnly=dict(clipsScoringAtLeast0_5=int(fires.sum()), byEscClass={c: int((fires & (cc == c)).sum()) for c in np.unique(cc[fires])}))
        continue
    t = (cc == d['escClass']).astype(int); thr = d['threshold']
    ev = ~excluded   # speech-excluded clips are not tagged
    pred = (sc >= thr) & ev
    c = confusion(pred.astype(float), t, 0.5); m = prf(c)
    pre_excl = prf(confusion((sc >= thr).astype(float), t, 0.5))

    def st(idx):
        cf = prf(confusion(pred[idx].astype(float), t[idx], 0.5)); return dict(precision=cf['precision'], recall=cf['recall'], f1=cf['f1'])
    ci = bootstrap(np.arange(len(cids)).astype(str), st, 1000)
    fp_cls = {c_: int((pred & (t == 0) & (cc == c_)).sum()) for c_ in np.unique(cc[pred & (t == 0)])}
    tags_eval[tag] = dict(evaluated=True, escClass=d['escClass'], classes=d['classes'], threshold=thr, positivesInTest=int(t.sum()), confusion=c, **m, ci95=ci,
                          withoutSpeechExclusion=dict(precision=pre_excl['precision'], recall=pre_excl['recall']),
                          falsePositivesByEscClass=dict(sorted(fp_cls.items(), key=lambda kv: -kv[1])[:6]),
                          positivesExcludedBySpeechRule=int(((sc >= thr) & excluded & (t == 1)).sum()))
tags_eval['_speechExclusion'] = dict(threshold=sp_thr, clipsExcluded=int(excluded.sum()), clipsTotal=len(cids), validated=False,
                                     byEscClass={c: int((excluded & (cc == c)).sum()) for c in np.unique(cc[excluded])},
                                     note='No ESC-50 speech class, so speech detection is unvalidated. The rule is used only to drop clips, never to label.')
all_test_clips = {r['clip'] for r in rows_all if r['fold'] == TEST_FOLD and r['source'] == 'esc50'}
tags_eval['_coverage'] = dict(testClipsWithAtLeastOneAssessableWindow=len({c for c in by_clip if R[by_clip[c][0]]['source'] == 'esc50'}), testClipsTotal=len(all_test_clips),
                              note='Clips whose every window is below the silence floor receive no tags ("too quiet to assess").')

out = dict(generatedAt=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(), trainedFile=TRAINED, useKaggle=USE_KAGGLE,
           testFold=TEST_FOLD, nTestWindows=len(R), nTestPositiveWindows=int(y.sum()), nTestPositiveClips=len(set(clip[y == 1])),
           optimismNote='Fold 5 was scored by v1 and v2 before v3; v3 choices used folds 1-4 only, but the fold-5 estimate is mildly optimistic.',
           selection=dict(grid=T['grid'], chosen={k: {kk: vv for kk, vv in v.items() if kk not in ('norm', 'net')} for k, v in T['chosen'].items()}),
           test=report, pairedAucDifferences=pair, gates=gates, decision=decision, robustness=robust, v1RobustnessFromMetricsV1=v1rob,
           tags=tags_eval, kaggleChecks=kc)
os.makedirs(MODEL_DIR, exist_ok=True)
json.dump(out, open(METRICS, 'w'), indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
print(json.dumps(dict(decision=decision, gates=gates, auc={k: round(v['auc'], 3) for k, v in report.items()}), indent=1, default=str))
