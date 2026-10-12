"""Export src/audio/model/model.v3.json (+ parity fixture) and src/audio/yamnet/tags.ts from trained.v3.json and model/metrics.v3.json.
Run after evaluate_test.py. The exported head is the pre-registered CV winner among {logreg, mlp}; its `status` says whether it actually
passed the gate AND beat v1 on the CV criterion. Nothing here changes which model the app uses (that remains src/audio/model/model.json)."""
import sys, os, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from common import *

TRAINED = os.environ.get('TRAINED_V3', 'trained.v3.json')
METRICS = os.path.join(MODEL_DIR, os.environ.get('METRICS_FILE', 'metrics.v3.json'))
T = json.load(open(os.path.join(YDIR, TRAINED))); M = json.load(open(METRICS))
fam = max([k for k in T['chosen'] if k != 'zeroshot'], key=lambda f: T['chosen'][f]['cvCriterion'])
ent = T['chosen'][fam]
shipped = M['decision']['shipped']
status = 'shipped' if shipped == fam else 'candidate-not-shipped'
r8 = lambda a: [[float('%.8g' % v) for v in row] for row in a]
layers = []
for W, b, a in zip(ent['net']['W'], ent['net']['b'], ent['net']['act']):
    layers.append(dict(type='dense', weights=r8(np.atleast_2d(W)), bias=[float('%.8g' % v) for v in np.ravel(b)], activation=a))
norm = dict(mean=[float('%.8g' % v) for v in ent['norm']['mean']], std=[float('%.8g' % v) for v in ent['norm']['std']])
model = dict(schema='sleepsmooth-yamnet-head/1', version=f"sleepsmooth-snore-yamnet-{fam}-0.3.0", kind=fam,
             input=dict(kind='embedding' if ent['feat'] == 'emb' else 'class-score-logits', dim=1024 if ent['feat'] == 'emb' else 521, windowSamples=15600, sampleRate=16000,
                        note='Trained on YAMNet outputs from the NumPy re-implementation in scripts/yamnet/yamnet_np.py (official Keras weights), one 15600-sample patch per 1 s window. Not yet checked against the official TFLite output: re-validate with real on-device outputs before relying on this head.'),
             norm=norm, layers=layers, threshold=ent['threshold'], weightsHash='', trainedAt=M['generatedAt'], status=status,
             licenses=dict(trainingData='ESC-50 CC BY-NC 3.0 (non-commercial; weights are therefore non-commercial)' + ('; Kaggle snoring dataset license Unknown' if T['useKaggle'] else ''),
                           embeddingModel='YAMNet, Apache 2.0 (Google)', labels='AudioSet ontology/labels, CC BY 4.0'))
out = os.path.join(ROOT, 'src/audio/model/model.v3.json')
json.dump(model, open(out, 'w'))
print(subprocess.run(['npx', 'tsx', os.path.join(HERE, 'hash-model.ts'), out], cwd=ROOT, capture_output=True, text=True).stdout.strip())

# parity fixture: 12 clean embeddings (float32-rounded) + reference scores from the ROUNDED exported weights, float64
rows = [r for r in window_rows() if r['source'] == 'esc50']
E, S_ = load_clean(rows)
if ent['feat'] != 'emb':
    E = np.log(np.clip(S_, 1e-6, 1 - 1e-6) / (1 - np.clip(S_, 1e-6, 1 - 1e-6)))
pick = np.linspace(0, len(rows) - 1, 12).astype(int)
net = dict(W=[np.array(l['weights']) for l in layers], b=[np.array(l['bias']) for l in layers], act=[l['activation'] for l in layers])
emb = np.array([[float('%.7g' % v) for v in E[i]] for i in pick])
exp = head_forward(net, (emb - np.array(norm['mean'])) / np.array(norm['std']))
json.dump([dict(input=e.tolist(), expected=float(s)) for e, s in zip(emb, exp)], open(os.path.join(ROOT, 'src/audio/model/head.v3.fixture.json'), 'w'))

# ---- tags.ts
tg = M['tags']
LABEL = {'snore-like': 'Snore-like pattern', 'cough-like': 'Cough-like sound', 'sneeze-like': 'Sneeze-like sound', 'breathing': 'Breathing sound',
         'gasp-like': 'Gasp-like (unvalidated)', 'wheeze-like': 'Wheeze-like (unvalidated)'}
CLIPCAT = {'snore-like': 'snore-like', 'cough-like': 'cough-like', 'sneeze-like': None, 'breathing': None, 'gasp-like': 'gasp-like', 'wheeze-like': 'wheeze-like'}
def ev(tag):
    t = tg[tag]
    if not t.get('evaluated'): return 'null'
    f = lambda x: 'null' if x != x else f'{x:.3f}'
    ci = t['ci95']
    return (f"{{ escClass: '{t['escClass']}', testPositiveClips: {t['positivesInTest']}, precision: {f(t['precision'])}, recall: {f(t['recall'])}, "
            f"precisionCi95: [{f(ci['precision'][0])}, {f(ci['precision'][1])}], recallCi95: [{f(ci['recall'][0])}, {f(ci['recall'][1])}], "
            f"confusion: {{ tp: {t['confusion']['tp']}, fp: {t['confusion']['fp']}, tn: {t['confusion']['tn']}, fn: {t['confusion']['fn']} }} }}")
def show(tag):
    t = tg[tag]
    return bool(t.get('evaluated') and t['precision'] == t['precision'] and t['precision'] >= 0.5)
defs = []
for tag in ('snore-like', 'cough-like', 'sneeze-like', 'breathing', 'gasp-like', 'wheeze-like'):
    d = T['tags'][tag]
    thr = 'null' if d['threshold'] is None else repr(d['threshold'])
    cat = CLIPCAT[tag]
    defs.append(f"""  {{
    tag: '{tag}',
    label: '{LABEL[tag]}',
    classes: [{', '.join(map(str, d['classes']))}],
    threshold: {thr},
    validated: {'true' if d['evaluated'] else 'false'},
    showInApp: {'true' if show(tag) else 'false'},
    mobileClipCategory: {"'" + cat + "'" if cat else 'null'},
    evaluation: {ev(tag)},
  }},""")
sp = tg['_speechExclusion']
ts = f"""// GENERATED by scripts/yamnet/export.py from data/processed/yamnet/{TRAINED} and model/{os.path.basename(METRICS)}. Do not edit by hand.
//
// YAMNet sound-category tags for short clips. NO training: tags come from YAMNet's own 521 class scores (AudioSet, CC BY 4.0 labels;
// YAMNet weights Apache 2.0). A tag means "this clip contains a sound YAMNet scores like <category>". It is NOT a diagnosis, NOT an
// apnea event, and the absence of a tag says nothing about sleep apnea. Thresholds were chosen on ESC-50 folds 1-4 (F0.5 per tag, clip
// level = max over windows) and evaluated once on fold 5; the evaluation numbers below are tiny-sample ESC-50 results, not performance
// on phone audio. Gasp-like and wheeze-like have NO ground truth in ESC-50: they are unvalidated, have no threshold, and are never emitted.
// Speech is used only to EXCLUDE a clip (privacy); that rule is also unvalidated.

export const YAMNET_NUM_CLASSES = 521;
/** Indices in data/raw/yamnet/yamnet_class_map.csv (AudioSet display names in comments). */
export const YAMNET_CLASS = {{ speech: 0, breathing: 36, wheeze: 37, snoring: 38, gasp: 39, snort: 41, cough: 42, sneeze: 44 }} as const;

export type SoundTag = 'snore-like' | 'cough-like' | 'sneeze-like' | 'breathing' | 'gasp-like' | 'wheeze-like';
/** The subset of src/mobileLogic/clips.ts ClipCategory that a tag can map to (see docs/YAMNET_CLIP_CATEGORIES.md). */
export type MappedClipCategory = 'snore-like' | 'cough-like' | 'gasp-like' | 'wheeze-like';

export interface TagEvaluation {{
  /** ESC-50 class used as ground truth. */
  escClass: string;
  testPositiveClips: number;
  precision: number | null;
  recall: number | null;
  precisionCi95: [number | null, number | null];
  recallCi95: [number | null, number | null];
  confusion: {{ tp: number; fp: number; tn: number; fn: number }};
}}
export interface TagDef {{
  tag: SoundTag;
  /** User-facing label. Unvalidated tags carry "(unvalidated)". */
  label: string;
  /** YAMNet class indices; clip score = max over windows of max over these classes. */
  classes: readonly number[];
  /** null = never emitted (unvalidated). */
  threshold: number | null;
  validated: boolean;
  /** Recommendation: shown only if validated AND fold-5 precision point estimate >= 0.5 (a product rule set after the fact, not a validated cut). */
  showInApp: boolean;
  mobileClipCategory: MappedClipCategory | null;
  evaluation: TagEvaluation | null;
}}

export const TAG_DEFS: readonly TagDef[] = [
{chr(10).join(defs)}
];

/** A clip whose max Speech score is at or above this is dropped (no tags, and the app should not keep the audio for tagging). */
export const SPEECH_EXCLUDE = {{ classIndex: YAMNET_CLASS.speech, threshold: {T['speechExcludeThreshold']}, validated: false }} as const;

export interface ClipTags {{
  excluded: boolean;
  excludedReason: 'speech' | 'no-frames' | null;
  tags: SoundTag[];
}}

/** `frameScores`: one 521-long YAMNet score vector per 0.48 s frame of the clip. Pure; no side effects. */
export function tagClip(frameScores: ArrayLike<number>[]): ClipTags {{
  if (frameScores.length === 0) return {{ excluded: true, excludedReason: 'no-frames', tags: [] }};
  const max = (classes: readonly number[]) => {{
    let m = 0;
    for (const f of frameScores) {{
      if (f.length !== YAMNET_NUM_CLASSES) throw new Error(`expected ${{YAMNET_NUM_CLASSES}} class scores, got ${{f.length}}`);
      for (const c of classes) m = Math.max(m, f[c] as number);
    }}
    return m;
  }};
  if (max([SPEECH_EXCLUDE.classIndex]) >= SPEECH_EXCLUDE.threshold) return {{ excluded: true, excludedReason: 'speech', tags: [] }};
  const tags: SoundTag[] = [];
  for (const d of TAG_DEFS) if (d.threshold !== null && d.validated && d.showInApp && max(d.classes) >= d.threshold) tags.push(d.tag);
  return {{ excluded: false, excludedReason: null, tags }};
}}
"""
open(os.path.join(ROOT, 'src/audio/yamnet/tags.ts'), 'w').write(ts)
print('exported model.v3.json status', status, 'family', fam, '; tags.ts written; speech note:', sp['note'][:40])
