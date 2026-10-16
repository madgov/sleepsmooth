"""Runtime parity: NumPy YAMNet re-implementation vs the official TFLite classification model, on the same 200 waveforms.

WHY: the v3 head was trained on scores from scripts/yamnet/yamnet_np.py. The phone will run the official TFLite file
(data/raw/yamnet/lite-model_yamnet_classification_tflite_1.tflite, "8 bit quantized internally" per its own metadata). Until the two are compared
numerically, the v3 head's behaviour on-device is UNKNOWN. Nothing here has been run against a real TFLite runtime unless
model/parity.v3.json exists (it is written only by a real `compare`).

Two steps, so that they can run in different interpreters (the TFLite runtime wheel may only exist for another Python, see docs/YAMNET_INTEGRATION.md):
  export   python3 -I scripts/yamnet/parity.py export     needs NumPy + SciPy and the cached YAMNet weights; NO TFLite runtime.
           Picks 200 dev windows (folds 1-4 only, seed fixed), writes data/processed/yamnet/parity_waveforms.npz (waveforms + NumPy scores),
           data/processed/yamnet/phone_fixtures.json (ESC-50-derived, git-ignored, CC BY-NC) and scripts/yamnet/fixtures/synthetic_fixtures.json
           (generated tones/noise, safe to commit).
  compare  <python with ai_edge_litert | tflite_runtime | tensorflow> scripts/yamnet/parity.py compare
           needs only NumPy + a TFLite interpreter. Writes model/parity.v3.json and adds the TFLite scores to the phone fixtures.
  run      python3 -I scripts/yamnet/parity.py run         export if missing, then compare if a runtime can be imported, else explains.
The TFLite file is only ever opened by the TFLite interpreter (it is data, not code); nothing is executed from data/raw.
"""
import base64, hashlib, json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
YDIR = os.path.join(ROOT, 'data/processed/yamnet')
TFLITE = os.path.join(ROOT, 'data/raw/yamnet/lite-model_yamnet_classification_tflite_1.tflite')
HEAD = os.path.join(ROOT, 'src/audio/model/model.v3.json')
WAVES = os.path.join(YDIR, 'parity_waveforms.npz')
PHONE = os.path.join(YDIR, 'phone_fixtures.json')
SYNTH = os.path.join(HERE, 'fixtures', 'synthetic_fixtures.json')
REPORT = os.path.join(ROOT, 'model', 'parity.v3.json')
N_POS, N_HARD, N_RAND = 50, 50, 100          # 200 windows
PATCH = 15600
SEED = 20261014


# ------------------------------------------------------------------ head (pure NumPy copy of src/audio/yamnet/head.ts scoring)
def load_head():
    m = json.load(open(HEAD))
    assert m['input']['kind'] == 'class-score-logits' and m['input']['dim'] == 521 and len(m['layers']) == 1
    return dict(mean=np.array(m['norm']['mean']), std=np.array(m['norm']['std']), w=np.array(m['layers'][0]['weights'][0]),
                b=float(m['layers'][0]['bias'][0]), thr=float(m['threshold']), version=m['version'])


def scores_to_logits(p):
    p = np.clip(np.asarray(p, np.float64), 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def head_score(h, scores):
    z = ((scores_to_logits(scores) - h['mean']) / h['std']) @ h['w'] + h['b']
    return 1.0 / (1.0 + np.exp(-z))


# ------------------------------------------------------------------ export (no TFLite runtime needed)
def _b64(a):
    return base64.b64encode(np.ascontiguousarray(a, '<f4').tobytes()).decode()


def _synthetic_waveforms():
    t = np.arange(PATCH) / 16000.0
    rng = np.random.default_rng(SEED)
    return {
        'tone-440hz-amp0.3': (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32),
        'white-noise-rms0.05': (0.05 * rng.standard_normal(PATCH)).astype(np.float32),
        'am-noise-4hz-burst-like': (0.2 * rng.standard_normal(PATCH) * (0.5 + 0.5 * np.sin(2 * np.pi * 4 * t)) ** 2).astype(np.float32),
        'near-silence-rms0.001': (0.001 * rng.standard_normal(PATCH)).astype(np.float32),
    }


def export():
    sys.path.insert(0, HERE)
    from common import window_rows, TRAIN_FOLDS, TEST_FOLD, load_clean, PROC   # SciPy needed here only
    from yamnet_np import YamNet, read_wav_f32, window_to_patch
    rows = [r for r in window_rows() if r['source'] == 'esc50' and r['fold'] in TRAIN_FOLDS]
    assert all(r['fold'] != TEST_FOLD for r in rows)
    _, S = load_clean(rows)
    head = load_head()
    sc_head = head_score(head, S)                       # only used to pick informative windows, not as a result
    y = np.array([r['label'] for r in rows])
    rng = np.random.default_rng(SEED)
    pos = rng.choice(np.where(y == 1)[0], N_POS, replace=False)
    neg = np.where(y == 0)[0]
    hard = neg[np.argsort(-sc_head[neg])[:N_HARD * 3]]  # 150 highest-scoring negatives, subsample 50 (several windows share a clip)
    hard = rng.choice(hard, N_HARD, replace=False)
    rest = np.setdiff1d(neg, hard)
    rand = rng.choice(rest, N_RAND, replace=False)
    sel = [('positive', int(i)) for i in pos] + [('hard-negative', int(i)) for i in hard] + [('random-negative', int(i)) for i in rand]
    net = YamNet()
    cache = {}
    waves, meta = [], []
    for kind, i in sel:
        r = rows[i]
        if r['file'] not in cache:
            cache[r['file']] = read_wav_f32(os.path.join(PROC, r['file']))
        x = cache[r['file']][r['start']:r['start'] + 16000]
        waves.append(window_to_patch(np.pad(x, (0, max(0, 16000 - len(x))))))
        meta.append(dict(group=kind, clip=r['clip'], start=r['start'], cls=r['cls'], label=int(r['label']), file=r['file']))
    W = np.stack(waves).astype(np.float32)
    _, scores = net.embed(W)
    os.makedirs(YDIR, exist_ok=True)
    np.savez(WAVES, waves=W, np_scores=scores, meta=np.array(json.dumps(meta)))
    # phone fixtures: first 6 of each kind are plenty; identical float32 bytes + sha256 so the phone can prove it fed the same audio
    def fixture(name, x, sc, extra=None):
        hs = float(head_score(head, sc[None])[0])
        return dict(name=name, samples=PATCH, sampleRate=16000, pcmF32LE_base64=_b64(x), sha256=hashlib.sha256(np.ascontiguousarray(x, '<f4').tobytes()).hexdigest(),
                    expectedNumpy=dict(scores=[round(float(v), 7) for v in sc], top5=[int(k) for k in np.argsort(-sc)[:5]], headScore=round(hs, 6),
                                       headDecision=bool(hs >= head['thr']), snoringScore38=round(float(sc[38]), 7)), expectedTflite=None, **(extra or {}))
    fx_idx = list(range(0, 6)) + list(range(N_POS, N_POS + 6)) + list(range(N_POS + N_HARD, N_POS + N_HARD + 6))
    phone = dict(label='ESC-50-derived audio (CC BY-NC 3.0, Freesound clips). Do not commit. expectedNumpy = the NumPy re-implementation, NOT official YAMNet.',
                 headVersion=head['version'], headThreshold=head['thr'], fixtures=[fixture(f"{meta[i]['group']}-{k}", W[i], scores[i], dict(source=meta[i])) for k, i in enumerate(fx_idx)])
    json.dump(phone, open(PHONE, 'w'))
    syn = _synthetic_waveforms()
    sx = np.stack(list(syn.values()))
    _, ss = net.embed(sx)
    os.makedirs(os.path.dirname(SYNTH), exist_ok=True)
    json.dump(dict(label='Synthetic generated waveforms (no third-party audio). expectedNumpy = NumPy re-implementation, NOT official YAMNet. Generated by scripts/yamnet/parity.py export.',
                   headVersion=head['version'], headThreshold=head['thr'], fixtures=[fixture(n, x, ss[j]) for j, (n, x) in enumerate(syn.items())]), open(SYNTH, 'w'))
    print(f'export: {len(W)} waveforms -> {WAVES}\n        phone fixtures -> {PHONE} ({len(fx_idx)}), synthetic -> {SYNTH} ({len(syn)})')


# ------------------------------------------------------------------ compare (needs a TFLite runtime, NumPy only otherwise)
def import_interpreter():
    errs = []
    try:        # python -I disables the user site; the approved `pip install --user ai-edge-litert` lives there. Add that one directory back.
        import site
        us = site.getusersitepackages()
        if os.path.isdir(os.path.join(us, 'ai_edge_litert')) and us not in sys.path:
            sys.path.append(us)
    except Exception:       # noqa: BLE001
        pass
    for mod, cls in (('ai_edge_litert.interpreter', 'Interpreter'), ('tflite_runtime.interpreter', 'Interpreter'), ('tensorflow.lite', 'Interpreter')):
        try:
            m = __import__(mod, fromlist=[cls])
            return getattr(m, cls), mod
        except Exception as e:      # noqa: BLE001  (missing module or ABI mismatch)
            errs.append(f'{mod}: {type(e).__name__}: {e}')
    return None, errs


def run_tflite(Interpreter, waves):
    it = Interpreter(model_path=TFLITE)
    it.allocate_tensors()
    inp, out = it.get_input_details()[0], it.get_output_details()
    out = [o for o in out if o['shape'][-1] == 521] or out
    shape = [int(s) for s in inp['shape']]
    if int(np.prod(shape)) != PATCH:
        it.resize_tensor_input(inp['index'], [PATCH] if len(shape) == 1 else [1, PATCH]); it.allocate_tensors(); inp = it.get_input_details()[0]
        shape = [int(s) for s in inp['shape']]
    res = []
    for w in waves:
        it.set_tensor(inp['index'], np.asarray(w, np.float32).reshape(shape))
        it.invoke()
        res.append(np.array(it.get_tensor(out[0]['index'])).reshape(-1)[:521])
    return np.stack(res).astype(np.float32), dict(inputShape=shape, inputDtype=str(inp['dtype']), outputShape=[int(s) for s in out[0]['shape']])


def _external_runner(npz_path):
    """Scores produced elsewhere by a TFLite-only script (e.g. TensorFlow's tf.lite in another environment), keyed by sha256 of the float32 bytes."""
    import hashlib
    z = np.load(npz_path, allow_pickle=False)
    def run(Interpreter, waves):
        return np.stack([z[hashlib.sha256(np.ascontiguousarray(w, '<f4').tobytes()).hexdigest()] for w in waves]).astype(np.float32), dict(external=os.path.basename(npz_path))
    return run


def compare(runtime_name=None):
    global run_tflite
    ext = os.environ.get('PARITY_TFLITE_SCORES')       # path to npz from an external TFLite-only run; bypasses the in-process interpreter
    if ext:
        run_tflite = _external_runner(ext)
        Interpreter, info = object(), 'external tf.lite scores: ' + os.path.basename(ext)
    else:
        Interpreter, info = import_interpreter()
    if Interpreter is None:
        print('compare: no TFLite runtime importable in this interpreter:\n  ' + '\n  '.join(info))
        print('See docs/YAMNET_INTEGRATION.md ("Runtime parity") for the smallest package and how to run this step.')
        return 2
    z = np.load(WAVES, allow_pickle=False)
    waves, np_sc, meta = z['waves'], z['np_scores'], json.loads(str(z['meta']))
    tf_sc, io = run_tflite(Interpreter, waves)
    head = load_head()
    d = np.abs(tf_sc.astype(np.float64) - np_sc.astype(np.float64))
    hs_np, hs_tf = head_score(head, np_sc), head_score(head, tf_sc)
    dec_np, dec_tf = hs_np >= head['thr'], hs_tf >= head['thr']
    near = np.abs(hs_np - head['thr']) < 0.05
    OP_THR = 0.98            # night operating point (model/segment_eval.synthetic.json "chosen")
    d98 = (hs_np >= OP_THR) != (hs_tf >= OP_THR)
    isg = np.array([m['group'] for m in meta])
    groups = np.array([m['group'] for m in meta])
    rep = dict(runtime=info, tflite=os.path.basename(TFLITE), n=len(waves), tfliteIO=io,
               scores=dict(maxAbsDiff=float(d.max()), meanAbsDiff=float(d.mean()), p99AbsDiff=float(np.percentile(d, 99)),
                           top1Agreement=float((tf_sc.argmax(1) == np_sc.argmax(1)).mean()),
                           top5SetAgreement=float(np.mean([set(np.argsort(-a)[:5]) == set(np.argsort(-b)[:5]) for a, b in zip(tf_sc, np_sc)])),
                           snoring38MaxAbsDiff=float(d[:, 38].max()), snoring38MeanAbsDiff=float(d[:, 38].mean())),
               head=dict(version=head['version'], threshold=head['thr'], decisionAgreement=float((dec_np == dec_tf).mean()),
                         disagreements=int((dec_np != dec_tf).sum()), flaggedNumpy=int(dec_np.sum()), flaggedTflite=int(dec_tf.sum()),
                         headScoreMaxAbsDiff=float(np.abs(hs_np - hs_tf).max()), headScoreMeanAbsDiff=float(np.abs(hs_np - hs_tf).mean()),
                         windowsWithin0_05OfThreshold=int(near.sum()), disagreementsAmongThose=int(((dec_np != dec_tf) & near).sum())),
               operatingPoint98=dict(threshold=OP_THR, disagreements=int(d98.sum()), decisionAgreement=float(1 - d98.mean()),
                                     flaggedNumpy=int((hs_np >= OP_THR).sum()), flaggedTflite=int((hs_tf >= OP_THR).sum()),
                                     disagreementsByGroup={g: int(d98[isg == g].sum()) for g in np.unique(isg)},
                                     windowsWithin0_02OfThreshold=int((np.abs(hs_np - OP_THR) < 0.02).sum())),
               perGroup={g: dict(n=int((groups == g).sum()), decisionAgreement=float((dec_np == dec_tf)[groups == g].mean()),
                                 snoringScoreCorr=float(np.corrcoef(np_sc[groups == g, 38], tf_sc[groups == g, 38])[0, 1])) for g in np.unique(groups)},
               note='NumPy YAMNet re-implementation vs the official quantized TFLite. Windows are DEVELOPMENT folds 1-4 only. This checks runtime agreement, not model accuracy.')
    h = rep['head']; o = rep['operatingPoint98']
    crit = dict(headProbMaxAbsDiffLt0_01=bool(h['headScoreMaxAbsDiff'] < 0.01),
                decisionAgreementGe99pct_at0_6495=bool(h['decisionAgreement'] >= 0.99),
                decisionAgreementGe99pct_at0_98=bool(o['decisionAgreement'] >= 0.99),
                atMost1DisagreementPosAndHardNeg_at0_98=bool(o['disagreementsByGroup'].get('positive', 0) <= 1 and o['disagreementsByGroup'].get('hard-negative', 0) <= 1))
    rep['preRegisteredCriteria'] = dict(doc='docs/YAMNET_INTEGRATION.md "Parity pass criteria (pre-registered)"', results=crit, verdict='PASS' if all(crit.values()) else 'FAIL')
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    json.dump(rep, open(REPORT, 'w'), indent=1)
    for p in (PHONE, SYNTH):                     # fill expectedTflite on the fixtures so the phone has the official reference too
        if os.path.exists(p):
            f = json.load(open(p))
            xs = np.stack([np.frombuffer(base64.b64decode(x['pcmF32LE_base64']), '<f4') for x in f['fixtures']])
            sc, _ = run_tflite(Interpreter, xs)
            for x, s in zip(f['fixtures'], sc):
                hs = float(head_score(head, s[None])[0])
                x['expectedTflite'] = dict(scores=[round(float(v), 7) for v in s], top5=[int(k) for k in np.argsort(-s)[:5]], headScore=round(hs, 6), headDecision=bool(hs >= head['thr']))
            json.dump(f, open(p, 'w'))
    print(json.dumps(rep, indent=1))
    return 0


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'run'
    if cmd == 'export':
        export()
    elif cmd == 'compare':
        sys.exit(compare())
    elif cmd == 'run':
        if not os.path.exists(WAVES):
            export()
        sys.exit(compare())
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
