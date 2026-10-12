"""Group-aware fold assignment for the Kaggle snoring clips (runs only if Kaggle clips are in the manifest).

The 1 s Kaggle clips may be cut from the same longer recordings, so clips are grouped before folds are assigned, and a whole group goes
to ONE fold. Groups are the connected components of two linkage rules:
  (A) same filename stem after removing trailing digits/separators (e.g. snore_001, snore_002 -> 'snore'); stems that are purely
      numeric/empty are NOT linked (they carry no information);
  (B) near-duplicate audio: cosine similarity >= NEAR_DUP_COS between MEAN-CENTRED YAMNet embeddings (centring removes the large shared
      offset of post-ReLU embeddings), over all Kaggle clips.
Exact PCM duplicates were already removed in prepare-data.ts. Folds: greedy stratified group assignment (largest groups first, to the fold
with the fewest clips of that label) using a fixed seed. Writes data/processed/yamnet/kaggle_folds.json and kaggle_groups.json.
Residual risk (reported, not solved): clips cut from the same recording but with unrelated filenames and different content windows will not
be linked by either rule."""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from common import *

NEAR_DUP_COS = 0.95


def stem(clip_id):
    base = clip_id.split('/', 1)[1]
    base = re.sub(r'-[0-9a-f]{6}$', '', base)             # remove the hash suffix added by prepare-data
    s = re.sub(r'[\s_\-\.]*\d+$', '', base.lower())          # trailing numbering
    s = re.sub(r'[\s_\-\.]*(copy|cut|part|clip)$', '', s)
    return s if re.search(r'[a-z]', s) and len(s) >= 3 else None


def main():
    man = load_manifest()
    k = [c for c in man['clips'] if c['source'] == 'kaggle']
    if not k:
        print('no Kaggle clips in manifest: nothing to do'); return
    rows = [r for r in window_rows(man) if r['source'] == 'kaggle']
    E, _ = load_clean(rows)
    by_clip = {}
    for i, r in enumerate(rows): by_clip.setdefault(r['clip'], []).append(i)
    ids = [c['id'] for c in k]
    emb = np.stack([E[by_clip[c]].mean(0) if c in by_clip else np.zeros(1024, np.float32) for c in ids])
    has = np.array([c in by_clip for c in ids])
    Z = emb - emb[has].mean(0); Z /= np.linalg.norm(Z, axis=1, keepdims=True) + 1e-9
    sim = Z @ Z.T
    np.fill_diagonal(sim, -1)
    parent = list(range(len(ids)))
    def find(a):
        while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
        return a
    def union(a, b): parent[find(a)] = find(b)
    stems = {}
    n_stem = n_dup = 0
    for i, c in enumerate(ids):
        s = stem(c)
        if s: 
            if s in stems: union(i, stems[s]); n_stem += 1
            else: stems[s] = i
    ii, jj = np.where(np.triu(sim >= NEAR_DUP_COS, 1) & has[:, None] & has[None, :])
    for a, b in zip(ii, jj): union(int(a), int(b)); n_dup += 1
    groups = {}
    for i in range(len(ids)): groups.setdefault(find(i), []).append(i)
    labels = np.array([c['label'] for c in k])
    rng = np.random.default_rng(SEED)
    order = sorted(groups.values(), key=lambda g: (-len(g), rng.random()))
    load = {lab: np.zeros(5) for lab in (0, 1)}
    fold_of = {}
    for g in order:
        lab = int(np.round(labels[g].mean()))
        f = int(np.argmin(load[lab] + rng.random(5) * 1e-3))
        load[lab][f] += len(g)
        for i in g: fold_of[ids[i]] = f + 1
    mixed = sum(1 for g in groups.values() if len(set(labels[g])) > 1)
    json.dump(fold_of, open(os.path.join(YDIR, 'kaggle_folds.json'), 'w'))
    sizes = sorted((len(g) for g in groups.values()), reverse=True)
    info = dict(clips=len(ids), groups=len(groups), largestGroups=sizes[:10], linksByStem=n_stem, linksByNearDupPairs=n_dup, nearDupCosine=NEAR_DUP_COS,
                groupsWithMixedLabels=mixed, foldCounts={lab: load[lab].tolist() for lab in (0, 1)},
                note='Clips in one group share a fold. Residual risk: same-recording clips with unrelated names/content are not linked.')
    json.dump(info, open(os.path.join(YDIR, 'kaggle_groups.json'), 'w'), indent=1)
    print(json.dumps(info))


if __name__ == '__main__':
    main()
