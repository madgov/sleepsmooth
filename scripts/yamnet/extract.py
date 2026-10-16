"""Compute YAMNet embeddings + class scores for every kept 1 s window.
  python3 -I scripts/yamnet/extract.py clean   # clean audio, all clips (ESC-50 + Kaggle if present). Cached per (clip,start).
  python3 -I scripts/yamnet/extract.py aug     # folds 1-4 only: lp4k copy + K=3 random augmentation copies (v2 scheme). Cached.
Windows are exactly the v1 windows (manifest.json); YAMNet sees the centred 15600 of the 16000 samples. The test fold is embedded
here only because tag/robustness evaluation needs it later; no labels are used in this stage."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from multiprocessing import Pool
from common import *
from yamnet_np import read_wav_f32, window_to_patch
from yamnet_backend import YamNet

K_AUG = 3
_M = None


def _model():
    global _M
    if _M is None:
        _M = YamNet()
    return _M


def _clean_job(args):
    cid, file, starts = args
    x = read_wav_f32(os.path.join(PROC, file))
    P = np.stack([window_to_patch(np.pad(x[s:s + 16000], (0, max(0, 16000 - len(x[s:s + 16000]))))) for s in starts])
    e, s = _model().embed(P)
    return cid, starts, e, s


def _aug_job(args):
    cid, file, starts = args
    x = read_wav_f32(os.path.join(PROC, file))
    rng = clip_rng(cid, SEED + 5)
    sig = np.sqrt(np.mean(np.concatenate([x[s:s + 16000] for s in starts]).astype(np.float64) ** 2))
    versions = {'lp4k': lowpass(x, 4000)}
    for k in range(K_AUG):
        y = x
        if rng.random() < 0.7:
            fc = 3500 + rng.random() * 4500
            if fc < 7500: y = lowpass(y, fc)
        if rng.random() < 0.7:
            nz = white_noise(len(y), rng) if rng.random() < 0.5 else pink_noise(len(y), rng)
            y = add_noise(y, nz, sig, 10 + rng.random() * 20)
        g = 10 ** ((rng.random() * 12 - 6) / 20)
        versions[f'aug{k}'] = (y * g).astype(np.float32)
    out = []
    for kind, y in versions.items():
        P = np.stack([window_to_patch(np.pad(y[s:s + 16000], (0, max(0, 16000 - len(y[s:s + 16000]))))) for s in starts])
        e, sc = _model().embed(P)
        out.append((kind, e, sc))
    return cid, starts, out


def main(stage):
    os.environ.setdefault('VECLIB_MAXIMUM_THREADS', '2')
    man = load_manifest()
    rows = window_rows(man)
    clips = {}
    for r in rows:
        if stage == 'aug' and r['fold'] not in TRAIN_FOLDS: continue
        clips.setdefault(r['clip'], (r['file'], []))[1].append(r['start'])
    name = 'clean.npz' if stage == 'clean' else 'aug.npz'
    idx, emb, sc = load_cache(name)
    keys = list(idx.keys()); embs = [emb]; scs = [sc]
    todo = [(c, f, st) for c, (f, st) in clips.items() if f"{c}|{st[0]}" + ('' if stage == 'clean' else '|lp4k') not in idx]
    print(f'{stage}: {len(clips)} clips, {len(todo)} to compute, {sum(len(t[2]) for t in todo)} windows', flush=True)
    done = 0
    with Pool(int(os.environ.get('YAMNET_WORKERS', 4))) as pool:
        for res in pool.imap_unordered(_clean_job if stage == 'clean' else _aug_job, todo, chunksize=4):
            if stage == 'clean':
                cid, st, e, s = res
                keys += [f'{cid}|{t}' for t in st]; embs.append(e); scs.append(s)
            else:
                cid, st, out = res
                for kind, e, s in out:
                    keys += [f'{cid}|{t}|{kind}' for t in st]; embs.append(e); scs.append(s)
            done += 1
            if done % 100 == 0: print(f'  {done}/{len(todo)} clips', flush=True)
    if todo:
        save_cache(name, keys, np.concatenate(embs), np.concatenate(scs))
    print(f'{stage}: cache has {len(keys)} entries', flush=True)


if __name__ == '__main__':
    main(sys.argv[1])
