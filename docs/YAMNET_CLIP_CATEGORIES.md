# Proposal: extending `ClipCategory` with YAMNet sound tags (not applied)

Target file (owned by the mobile agent): `src/mobileLogic/clips.ts`. This document changes nothing. Mapping and thresholds live in
`src/audio/yamnet/tags.ts` (typed, tested, generated from `model/metrics.v3.json`).

## Evidence (ESC-50 fold 5, clip level, 8 positive clips per class, thresholds fixed on folds 1-4)
| Tag | YAMNet classes | Precision (95% CI) | Recall (95% CI) | Recommendation |
|---|---|---|---|---|
| snore-like | 38 Snoring, 41 Snort | 0.88 (0.60-1.00) | 0.88 (0.60-1.00) | usable for labelling a saved clip |
| cough-like | 42 Cough | 1.00 (1.00-1.00, 4 TP, 0 FP) | 0.50 (0.14-0.88) | usable; misses half, never present it as complete |
| sneeze-like | 44 Sneeze | 1.00 (3 TP, 0 FP) | 0.38 (0.00-0.75) | not a clip category the app needs; keep internal |
| breathing | 36 Breathing | 0.22 (0.05-0.40) | 0.50 (0.14-0.86) | **do not show** (mostly fires on snoring, teeth brushing) |
| gasp-like | 39 Gasp | not evaluated: ESC-50 has no gasp class | | **omit**; if ever shown the label must read "Gasp-like (unvalidated)" |
| wheeze-like | 37 Wheeze | not evaluated: no ground truth | | **omit**, same rule |
| speech | 0 Speech | unvalidated | | used only to EXCLUDE a clip (threshold 0.5) |

Recommendation on gasp/wheeze: **omit them from the UI**. Without a labelled reference there is no basis for any claim, and "gasp" invites the
reading "apnea event". Keep them reserved in the type.

## Suggested change
1. Move `'cough-like'` from `ReservedClipCategory` to `ImplementedClipCategory`; `CLIP_CATEGORY_META['cough-like'] = { chip: 'Cough-like', implemented: true, slots: 1, needsOwnOptIn: false, section: 'other' }`.
2. Keep `'gasp-like'`, `'wheeze-like'` reserved/unimplemented. Keep `'sleep-talking'` out: speech clips are *excluded*, not labelled.
3. Tag only the clips the selector already chose (at most a handful per night): run YAMNet on each ring-buffer clip (about 2 patches per second of clip),
   call `tagClip(frameScores)`. `excluded: true` with reason `'speech'` means: do not save that clip. Cost is a few hundred patches per night.
4. Add `yamnetTags?: SoundTag[]` to the stored clip and render chips from `TAG_DEFS[...].label` only when `showInApp` is true.
5. Copy: "A sound the on-device classifier scores like a cough. Not a medical finding. It can miss coughs and cannot rule anything out."
6. Tests: a clip with a speech score at or above `SPEECH_EXCLUDE.threshold` is never saved; unvalidated tags never render; absence of a tag renders nothing (no "all clear").

Privacy note: this adds a YAMNet pass over audio that may contain a bystander's voice. The speech rule is unvalidated (ESC-50 has no speech class); it
errs toward dropping clips (30 of 400 fold-5 clips tripped it, including 3 of 8 coughing and 3 of 8 sneezing clips, which also lowers tag recall).
