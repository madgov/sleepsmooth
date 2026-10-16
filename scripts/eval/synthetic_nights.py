"""SYNTHETIC NIGHTS: a STAND-IN until real overnight phone recordings exist. NOT real data, NOT validated, NOT clinical.

Builds long "nights" (default 20 nights x 2 h) from ESC-50 DEVELOPMENT clips (folds 1-4 only; fold 5 is never opened):
  * bed        : a bedroom background (rain, wind, clock tick, breathing, insects, crickets, washing machine, sea waves, quiet) tiled across the
                 whole night with crossfades and slow level drift, over a constant -62 dBFS pink-noise room tone;
  * bouts      : rhythmic snoring bouts. Snore BURSTS are cut from the fold's real ESC-50 snoring clips (envelope detection) and re-placed once per
                 breath cycle (3.5 to 6.5 s, jittered) with silence/bed between them. Bouts differ in length (brief = 2 to 4 cycles), level above
                 the bed (quiet = 3 to 9 dB, normal = 10 to 24 dB) and burst source;
  * distractors: ESC-50 events from other classes (75 % bedroom-relevant) dropped in at about 22 per hour, never inside a bout (+/- 8 s);
  * ground truth: every burst / bout / distractor has known start and end.
One night uses clips of ONE fold only, and is scored by the head trained WITHOUT that fold (oof_heads.json), so no clip is scored by a head that
saw it. The audio then goes through a port of the app's level gate (night_logic.window_status) and, for windows that pass, the real window
classifier: NumPy YAMNet (patch = centred 15,600 samples of the 1 s window) -> v3 logistic-regression head.

LIMITS (read before quoting any number): only 8 distinct snoring clips per fold (32 in total), so bouts REUSE a few real snorers/bursts: the
number of bouts is not the number of independent snorers. Rhythm is imposed by the generator (a regular breath cycle), which flatters any
periodicity check. Backgrounds are ESC-50 clips, not phone recordings. Distractors never overlap bouts. Window labels: a window is positive if
it overlaps an inserted snore burst (core + 0.3 s pad) by >= 0.5 s.

Run:  python3 -I scripts/eval/synthetic_nights.py [--nights 20] [--hours 2] [--workers 4] [--out DIR] [--smoke]
Output (git-ignored): data/processed/synthetic_nights/night_XX.npz + night_XX.json
"""
import os, sys, json, argparse, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'yamnet'))
sys.path.insert(0, HERE)
os.environ.setdefault('VECLIB_MAXIMUM_THREADS', '2')
import numpy as np
from multiprocessing import Pool
from common import PROC, YDIR, load_manifest, TRAIN_FOLDS, TEST_FOLD
from yamnet_np import read_wav_f32, window_to_patch
from yamnet_backend import YamNet
from esc_types import TYPE, BEDROOM
import night_logic as NL

SEED = 20261014
SR = 16000
OUTDIR = os.path.join(PROC, 'synthetic_nights')
ROOM_TONE_DB = -62.0
BED_CLASSES = ['rain', 'wind', 'clock_tick', 'breathing', 'insects', 'crickets', 'washing_machine', 'sea_waves', 'thunderstorm', 'vacuum_cleaner']
BED_WEIGHTS = [3, 3, 2, 2, 1, 1, 1, 1, 0.5, 0.5]
BED_LEVEL_DB = (-55.0, -40.0)
LOGIT = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))


def db(x):
    return 20 * np.log10(max(float(x), 1e-12))


class Pool_:
    """Clips of one development fold, loaded lazily."""
    def __init__(self, fold, man):
        assert fold in TRAIN_FOLDS and fold != TEST_FOLD
        self.fold = fold
        self.by_cls = {}
        for c in man['clips']:
            if c['source'] == 'esc50' and c['fold'] == fold:
                self.by_cls.setdefault(c['cls'], []).append(c)
        self.cache = {}

    def wave(self, c):
        if c['id'] not in self.cache:
            self.cache[c['id']] = read_wav_f32(os.path.join(PROC, c['file']))
        return self.cache[c['id']]

    def pick(self, cls, rng):
        lst = self.by_cls[cls]
        return lst[int(rng.integers(len(lst)))]


def trim_active(x, thr_db=-70.0):
    n = len(x) // 800
    e = 10 * np.log10(np.maximum((x[:n * 800].astype(np.float64).reshape(n, 800) ** 2).mean(1), 1e-12))
    idx = np.where(e > thr_db)[0]
    if len(idx) == 0:
        return x[:0]
    return x[idx[0] * 800:(idx[-1] + 1) * 800]


def core_rms_db(x):
    """RMS (dBFS) over 50 ms blocks within 20 dB of the clip's 95th-percentile block level (the 'core' of an event)."""
    n = len(x) // 800
    if n == 0:
        return -120.0
    b = (x[:n * 800].astype(np.float64).reshape(n, 800) ** 2).mean(1)
    e = 10 * np.log10(np.maximum(b, 1e-12))
    core = e >= np.percentile(e, 95) - 20
    return float(10 * np.log10(max(b[core].mean(), 1e-12)))


def fade(x, ms=30):
    n = min(len(x) // 2, int(SR * ms / 1000))
    if n > 0:
        w = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
        x = x.copy(); x[:n] *= w; x[-n:] *= w[::-1]
    return x


def snore_bursts(pool, rng):
    """Cut snore bursts from the fold's snoring clips: 50 ms envelope, active = within 12 dB of the clip's p95 block level, merge gaps < 0.3 s,
    pad 0.3 s each side, cap 3 s. Continuous clips yield one random 2 s excerpt."""
    out = []
    for c in pool.by_cls['snoring']:
        x = pool.wave(c)
        n = len(x) // 800
        e = 10 * np.log10(np.maximum((x[:n * 800].astype(np.float64).reshape(n, 800) ** 2).mean(1), 1e-12))
        act = e >= np.percentile(e, 95) - 12
        runs, i = [], 0
        while i < n:
            if act[i]:
                j = i
                while j < n and act[j]:
                    j += 1
                runs.append([i, j]); i = j
            else:
                i += 1
        merged = []
        for r in runs:
            if merged and r[0] - merged[-1][1] < 6:
                merged[-1][1] = r[1]
            else:
                merged.append(r)
        for a, b in merged:
            if (b - a) * 0.05 < 0.15:
                continue
            if (b - a) * 0.05 > 3.0:
                a = int(rng.integers(a, max(a + 1, b - 40))); b = a + 40
            s0, s1 = max(0, a * 800 - 4800), min(len(x), b * 800 + 4800)
            seg = x[s0:s1].copy()
            core = x[a * 800:b * 800]
            out.append(dict(clip=c['id'], audio=fade(seg), core_db=core_rms_db(core), core_len=len(core), pad=a * 800 - s0))
    return out


def make_bed(pool, classes, n, rng, level_db):
    """Tile random clips of the given classes over n samples with 0.5 s crossfades; overall RMS (non-silent) set to level_db."""
    bed = np.zeros(n, np.float32)
    pos, xf = 0, SR // 2
    while pos < n:
        cls = classes[int(rng.integers(len(classes)))]
        c = pool.pick(cls, rng)
        x = trim_active(pool.wave(c))
        if len(x) < 2 * xf:
            continue
        x = x.astype(np.float32)
        x = x / np.float32(max(np.sqrt(np.mean(x.astype(np.float64) ** 2)), 1e-9))     # every tile at the same RMS: a steady environment
        seg = x[:n - pos] if pos + len(x) > n else x
        w = np.ones(len(seg), np.float32)
        k = min(xf, len(seg) // 2)
        w[:k] = np.sin(np.linspace(0, np.pi / 2, k)); w[-k:] = np.cos(np.linspace(0, np.pi / 2, k))
        bed[pos:pos + len(seg)] += seg * w
        pos += max(len(seg) - xf, SR)
    rms = np.sqrt(np.mean(bed.astype(np.float64) ** 2))
    bed *= np.float32(10 ** (level_db / 20) / max(rms, 1e-9))
    return bed


def drift(n, rng, std_db=2.0, sec_step=30):
    """Smooth slow gain drift in dB, one control point per 30 s."""
    pts = np.cumsum(rng.standard_normal(n // (SR * sec_step) + 2))
    pts = (pts - pts.mean()) / max(pts.std(), 1e-9) * std_db
    return pts


def pink(n, rng):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.arange(len(spec)); f[0] = 1
    y = np.fft.irfft(spec / np.sqrt(f), n)
    return (y / y.std()).astype(np.float32)


def build_night(args):
    idx, fold, hours, outdir = args
    t0 = time.time()
    rng = np.random.default_rng([SEED, idx])
    man = load_manifest()
    pool = Pool_(fold, man)
    N = int(hours * 3600 * SR)
    # ---- bed + room tone
    names = [c for c in BED_CLASSES]
    p = np.array(BED_WEIGHTS) / sum(BED_WEIGHTS)
    primary = str(rng.choice(names, p=p))
    bed_cls = [primary] + ([str(rng.choice(['clock_tick', 'breathing', 'insects']))] if rng.random() < 0.3 else [])
    bed_db = float(rng.uniform(*BED_LEVEL_DB))
    bed = make_bed(pool, bed_cls, N, rng, bed_db)
    g = drift(N, rng)
    gx = np.arange(len(g)) * SR * 30
    chunk = SR * 600
    for a in range(0, N, chunk):
        b = min(N, a + chunk)
        bed[a:b] *= (10 ** (np.interp(np.arange(a, b), gx, g) / 20)).astype(np.float32)
    out = bed
    rt = pink(SR * 120, rng) * np.float32(10 ** (ROOM_TONE_DB / 20))
    for a in range(0, N, len(rt)):
        b = min(N, a + len(rt))
        out[a:b] += np.roll(rt, int(rng.integers(len(rt))))[:b - a]
    # ---- bouts
    bursts = snore_bursts(pool, rng)
    assert len(bursts) >= 4, 'not enough snore bursts in fold'
    n_bouts = int(rng.integers(4, 8))
    bouts, burst_gt, taken = [], [], []
    for _ in range(n_bouts):
        brief = bool(rng.random() < 0.3); quiet = bool(rng.random() < 0.3)
        T = float(rng.uniform(3.5, 6.5))
        cycles = int(rng.integers(2, 5)) if brief else int(rng.integers(10, 61))
        delta = float(rng.uniform(3, 9)) if quiet else float(rng.uniform(10, 24))
        dur = cycles * T
        for _try in range(200):
            s = float(rng.uniform(300, N / SR - 300 - dur))
            if all(s > b1 + 60 or s + dur < b0 - 60 for b0, b1 in taken):
                break
        else:
            continue
        taken.append((s, s + dur))
        first, last = None, None
        for i in range(cycles):
            tb = s + i * T + float(rng.uniform(-0.2, 0.2)) * T
            bu = bursts[int(rng.integers(len(bursts)))]
            gain_db = bed_db + delta + float(rng.normal(0, 2.0)) - bu['core_db']
            gain = min(10 ** (gain_db / 20), 0.95 / max(np.abs(bu['audio']).max(), 1e-6))
            a0 = int(tb * SR)
            seg = bu['audio'] * np.float32(gain)
            if a0 + len(seg) >= N:
                continue
            out[a0:a0 + len(seg)] += seg
            core0, core1 = (a0 + bu['pad']) / SR, (a0 + bu['pad'] + bu['core_len']) / SR
            burst_gt.append(dict(t0=a0 / SR, t1=(a0 + len(seg)) / SR, core0=core0, core1=core1, clip=bu['clip'], bout=len(bouts)))
            first = a0 / SR if first is None else first
            last = (a0 + len(seg)) / SR
        bouts.append(dict(t0=first, t1=last, cycles=cycles, cycleSec=T, deltaDbAboveBed=delta, brief=brief, quiet=quiet,
                          tag=('quiet+brief' if quiet and brief else 'quiet' if quiet else 'brief' if brief else 'normal')))
    # ---- distractors
    others = [c for c in pool.by_cls if c not in ('snoring',) and c not in bed_cls]
    bed_rel = [c for c in others if c in BEDROOM]
    n_d = int(rng.poisson(22 * hours))
    dis = []
    for _ in range(n_d):
        cls = str(rng.choice(bed_rel if rng.random() < 0.75 else others))
        c = pool.pick(cls, rng)
        x = trim_active(pool.wave(c))
        if len(x) < 4000:
            continue
        x = fade(x[:SR * 5].astype(np.float32))
        for _try in range(50):
            s = float(rng.uniform(60, N / SR - 70))
            if all(s > b1 + 8 or s + len(x) / SR < b0 - 8 for b0, b1 in [(b['t0'], b['t1']) for b in bouts]):
                break
        else:
            continue
        gain_db = min(bed_db + float(rng.uniform(8, 30)), -8.0) - core_rms_db(x)
        gain = min(10 ** (gain_db / 20), 0.95 / max(np.abs(x).max(), 1e-6))
        a0 = int(s * SR)
        out[a0:a0 + len(x)] += x * np.float32(gain)
        dis.append(dict(t0=s, t1=s + len(x) / SR, cls=cls, type=TYPE[cls], clip=c['id'], coreDb=float(core_rms_db(x * np.float32(gain)))))
    np.clip(out, -1.0, 1.0, out=out)
    dump = os.environ.get('NIGHT_DUMP_AUDIO_DIR')           # scratch only: used by scripts/eval/verify_port.sh to compare against the TypeScript
    if dump:
        os.makedirs(dump, exist_ok=True); out.astype('<f4').tofile(os.path.join(dump, f'night_{idx:02d}.f32'))
    # ---- app gate (port), then the real window classifier on the windows that pass
    level, floor_k, status = NL.window_status(NL.block_sums(out))
    nwin = len(level)
    heads = json.load(open(os.path.join(YDIR, 'oof_heads.json')))['heads'][str(fold)]
    hd = dict(mean=np.array(heads['norm']['mean']), std=np.array(heads['norm']['std']), w=np.array(heads['W']).reshape(-1), b=float(np.array(heads['b']).reshape(-1)[0]))
    yam = YamNet()
    scored = np.where(status == NL.STATUS_SCORED)[0]
    score = np.full(nwin, np.nan, np.float32)
    top1 = np.full(nwin, -1, np.int16)
    for a in range(0, len(scored), 128):
        ks = scored[a:a + 128]
        P = np.stack([window_to_patch(out[k * NL.HOP:k * NL.HOP + NL.WIN]) for k in ks])
        _, sc = yam.embed(P)
        z = ((LOGIT(sc.astype(np.float64)) - hd['mean']) / hd['std']) @ hd['w'] + hd['b']
        score[ks] = 1 / (1 + np.exp(-z))
        top1[ks] = sc.argmax(1)
    # ground-truth window label: overlap with a burst's [core0-0.3, core1+0.3] >= 0.5 s
    ytrue = np.zeros(nwin, bool)
    for bg in burst_gt:
        lo, hi = bg['t0'], bg['t1']
        k0 = max(0, int(np.floor(lo / 0.5)) - 2); k1 = min(nwin, int(np.ceil(hi / 0.5)) + 1)
        for k in range(k0, k1):
            ov = min(k * 0.5 + 1.0, hi) - max(k * 0.5, lo)
            if ov >= 0.5:
                ytrue[k] = True
    # distractor id per window (for FP attribution): index of the distractor overlapping the window the most, -1 none
    dwin = np.full(nwin, -1, np.int16)
    for i, d in enumerate(dis):
        k0 = max(0, int(np.floor(d['t0'] / 0.5)) - 2); k1 = min(nwin, int(np.ceil(d['t1'] / 0.5)) + 1)
        for k in range(k0, k1):
            if min(k * 0.5 + 1.0, d['t1']) - max(k * 0.5, d['t0']) > 0.1:
                dwin[k] = i
    meta = dict(label='SYNTHETIC night (stand-in, not real data)', night=idx, fold=fold, hours=hours, seconds=N / SR, bed=bed_cls, bedDb=bed_db,
                bouts=bouts, bursts=burst_gt, distractors=dis, nWindows=int(nwin), nScored=int(len(scored)), nTooQuiet=int((status == 0).sum()),
                nBelowGate=int((status == 1).sum()), seedPair=[SEED, idx], renderSeconds=round(time.time() - t0, 1))
    os.makedirs(outdir, exist_ok=True)
    np.savez(os.path.join(outdir, f'night_{idx:02d}.npz'), level=level.astype(np.float32), floor=floor_k.astype(np.float32), status=status, score=score,
             ytrue=ytrue, distractor=dwin, top1=top1)
    json.dump(meta, open(os.path.join(outdir, f'night_{idx:02d}.json'), 'w'))
    return idx, meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--nights', type=int, default=20)
    ap.add_argument('--hours', type=float, default=2.0)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--out', default=OUTDIR)
    ap.add_argument('--smoke', action='store_true', help='1 night of 0.25 h in a scratch dir')
    a = ap.parse_args()
    if a.smoke:
        a.nights, a.hours = 1, 0.25
    jobs = [(i, TRAIN_FOLDS[i % 4], a.hours, a.out) for i in range(a.nights)]
    with Pool(min(a.workers, len(jobs))) as p:
        for i, m in p.imap_unordered(build_night, jobs):
            print(f"night {i:02d} fold {m['fold']} bed {m['bed']} bouts {len(m['bouts'])} distractors {len(m['distractors'])} windows {m['nWindows']} "
                  f"scored {m['nScored']} belowGate {m['nBelowGate']} tooQuiet {m['nTooQuiet']} ({m['renderSeconds']}s)", flush=True)


if __name__ == '__main__':
    main()
