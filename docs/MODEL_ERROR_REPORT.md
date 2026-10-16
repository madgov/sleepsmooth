# v3 snore-like model: error analysis and segment-level evaluation

All numbers here come from DEVELOPMENT data only (ESC-50 folds 1-4, out-of-fold predictions, and synthetic nights built from those folds).
**Fold 5 is not used anywhere in this document.** Nothing here is a final test. Nothing here is clinical, and snore-like detection is not
apnea detection (see `docs/EVAL_PROTOCOL.md`).

## 0. Pre-registered operating-point rule (written 2026-10-14T23:05:53Z, BEFORE any synthetic night was generated or scored)

Order of events, stated honestly: I had already read the v3 window-level numbers (`model/metrics.v3.json`) and the app's episode rule
(`src/night/summary.ts`, `constants.ts`) before writing this. I had NOT yet written, run or looked at any synthetic-night result, any
grouping variant, or any false-positive breakdown.

**Data split for the choice.** Synthetic nights are built one ESC-50 fold per night (a night only contains clips of one fold, and is scored
by the head trained WITHOUT that fold). TUNING nights = built from folds 1 and 2. CHECK nights = built from folds 3 and 4. The operating
point is chosen on TUNING nights only and then reported once on CHECK nights. No tuning on CHECK nights.

**Declared grid (all combinations are evaluated; nothing is added after the fact).**
- Window threshold t in {0.6495 (the CV threshold the head ships with), 0.75, 0.85, 0.90, 0.95, 0.98}.
- k-of-n confirmation: a flagged window is "confirmed" if some run of N consecutive 0.5 s window indices that contains it holds at least K
  flagged windows. n (seconds) in {3, 5, 7, 10} with N = 2n; K in {1 (= off), 2, 3, 4, 6, 8, 10} with K <= N.
- Minimum confirmed windows per segment M in {3, 5, 8}; the app today uses M = 5, K = 1, t = 0.6495.
- Segment grouping: confirmed windows with at most 10 s between one window's end and the next one's start belong to one segment (the app's
  `NIGHT_EPISODE_MAX_GAP_SEC = 10`, `findEpisodes`).
- Periodicity check on the segment's snore-score series (unscored windows count as 0), autocorrelation peak at lags 3 to 7 s:
  rho in {off, 0.2, 0.3, 0.4}; segments shorter than 15 s either rejected (policy "strict") or accepted without the check (policy "lenient").

**Definitions.** A *false flagged segment* is a predicted segment that overlaps no ground-truth snoring bout (a bout's interval is first
inserted burst start to last inserted burst end, widened by 5 s each side). A bout is *caught* if at least one predicted segment overlaps it.
Segment precision = predicted segments overlapping a bout / all predicted segments. Rates are per hour of recorded night (all nights are 2 h).

**Rule.** Choose, on TUNING nights, the grid point that MAXIMISES SEGMENT RECALL subject to FALSE FLAGGED SEGMENTS PER HOUR <= 2.0.
Tie-break: if recall differs by less than 0.005, prefer fewer false segments per hour; then the simpler variant, in this order: baseline
(app rule) < threshold only < k-of-n < k-of-n + periodicity. If no grid point reaches <= 2.0 false segments/hour, choose the point with the
lowest false segments/hour among those with segment recall >= 0.50; if there is none, report "no acceptable operating point".
Quiet and brief bouts are reported but are NOT part of the constraint. This 2/hour budget is an engineering choice for a stand-in, not a
clinical or user-research-derived number.

**Disclosures made after section 0 was written.** (1) Before the full run I rendered two 15-minute smoke nights to debug the generator. I looked only at
how many windows passed the level gate (53% on the first, which was too many for a "steady" bed), and as a result normalised every background tile to the same
RMS before tiling. I did not look at any segment metric. (2) The random draw of backgrounds put both breathing-background nights in the TUNING half and none in the
CHECK half (table in section 4), so the CHECK half is easier for the chosen point than the TUNING half; this was not fixed by re-rolling, because that would be
tuning on results. (3) The chosen point sits on the edge of the declared grid (t = 0.98 is the highest threshold tested), so the true optimum under the rule may be further out.
(4) The rule constrains false segments per hour, not window-level recall; the chosen point flags only about 34 to 39% of the positive windows (section 4).


## 1. Window-level false positives (development folds 1-4, out-of-fold, v3 export head)
Every dev window is scored by a head that never saw its clip (`scripts/eval/oof_heads.py`; reproduces the CV AUC 0.9713 and the shipped threshold 0.6495).
Threshold = the shipped 0.6495. Fold 5 is not used.

- 13,116 windows, 279 snoring windows (32 clips, 8 per fold). TP 218, FP 426, FN 61, TN 12,411. **Precision 0.34** (so 66.1% of flagged windows are not snoring), recall 0.78, false-positive rate 3.3% (bedroom negatives 4.3%). Per fold FP: fold 1: 137, fold 2: 75, fold 3: 110, fold 4: 104. This is the same pattern the external reviewer saw on fold 5 (63 TP vs 101 FP): more false flags than correct ones.
- False flags are spread out but clustered: 426 FP windows come from 225 of 1,567 negative clips; 59 clips carry half of them, 140 carry 80%.

**By acoustic type** (one primary type per ESC-50 class, `scripts/eval/esc_types.py`; a judgement call, several classes straddle two types):

| Acoustic type | Negative windows | FP windows | FP rate | Share of all FPs | Clips with an FP / clips | Classes |
|---|---|---|---|---|---|---|
| transient/impact | 2,977 | 135 | 4.5% | 31.7% | 76 / 384 | can_opening, clapping, clock_tick, crackling_fire, door_wood_creaks, door_wood_knock, fireworks, footsteps, glass_breaking, keyboard_typing, mouse_click, water_drops |
| breathing/respiratory | 575 | 115 | 20.0% | 27.0% | 51 / 96 | breathing, coughing, sneezing |
| animal | 3,176 | 85 | 2.7% | 20.0% | 39 / 383 | cat, chirping_birds, cow, crickets, crow, dog, frog, hen, insects, pig, rooster, sheep |
| weather/water/other ambient | 2,223 | 49 | 2.2% | 11.5% | 31 / 256 | brushing_teeth, drinking_sipping, pouring_water, rain, sea_waves, thunderstorm, toilet_flush, wind |
| mechanical/fan | 2,275 | 21 | 0.9% | 4.9% | 15 / 256 | airplane, chainsaw, engine, hand_saw, helicopter, train, vacuum_cleaner, washing_machine |
| speech-like vocal | 539 | 15 | 2.8% | 3.5% | 9 / 64 | crying_baby, laughing |
| tonal | 1,072 | 6 | 0.6% | 1.4% | 4 / 128 | car_horn, church_bells, clock_alarm, siren |

**Worst classes** (FP windows at the threshold):

| Class | Type | Negative windows | FP windows | FP rate | Clips with an FP / clips |
|---|---|---|---|---|---|
| breathing | breathing/respiratory | 229 | 64 | 27.9% | 19 / 32 |
| sneezing | breathing/respiratory | 161 | 33 | 20.5% | 18 / 32 |
| can_opening | transient/impact | 206 | 28 | 13.6% | 13 / 32 |
| fireworks | transient/impact | 286 | 27 | 9.4% | 12 / 32 |
| drinking_sipping | weather/water/other ambient | 239 | 24 | 10.0% | 11 / 32 |
| door_wood_knock | transient/impact | 182 | 23 | 12.6% | 14 / 32 |
| cat | animal | 257 | 19 | 7.4% | 8 / 32 |
| coughing | breathing/respiratory | 185 | 18 | 9.7% | 14 / 32 |
| cow | animal | 259 | 17 | 6.6% | 5 / 32 |
| mouse_click | transient/impact | 235 | 16 | 6.8% | 10 / 32 |
| water_drops | transient/impact | 235 | 15 | 6.4% | 9 / 32 |
| door_wood_creaks | transient/impact | 264 | 13 | 4.9% | 8 / 32 |
| laughing | speech-like vocal | 257 | 13 | 5.1% | 7 / 32 |
| insects | animal | 274 | 12 | 4.4% | 4 / 32 |

Reading it (these are counts, not explanations):
- **Breathing-like sounds are the problem class** for a bedroom product: 20.0% of breathing/respiratory windows are flagged (breathing 27.9%, sneezing 20.5%, coughing 9.7%), and they are 27% of all FPs from 4% of negative windows. Breathing is also what every real bedroom recording contains.
- **Transient/impact sounds** produce the most FPs in absolute terms (32% of FPs; can opening 13.6%, door knock 12.6%, fireworks 9.4%, mouse click 6.8%) at a lower rate (4.5%).
- Animal sounds (cat 7.4%, cow 6.6%, insects 4.4%) and drinking/sipping (10.0%) follow. Mechanical/fan sounds (0.9%) and tonal sounds (0.6%) are rarely flagged in this OOF set, so the v1-era worry about alarms and fans is not what drives v3's errors.
- Top-50 highest-scoring FP windows (at most 2 per clip, so the list is varied): breathing/respiratory 20, animal 11, transient/impact 9, mechanical/fan 5, ambient 5, speech-like 0, tonal 0.
- Caveats: the type labels are the ESC-50 class names, not a listening review of each clip; the ESC-50 clips are 5 s Freesound recordings with a different mix of sounds from a phone on a nightstand.

**Listening list for human review:** `docs/MODEL_ERROR_LISTENING_LIST.csv` (50 false-positive windows with the original ESC-50 file path and the offset in seconds, 25 missed snoring windows). Paths and offsets only, no audio copied. First ten false positives:

| # | File (under data/raw/esc50/ESC-50-master/audio/) | Offset (s) | Class | OOF score |
|---|---|---|---|---|
| 1 | 3-171937-A-34.wav | 2.5 | can_opening | 0.9969 |
| 2 | 2-99955-C-7.wav | 2.5 | insects | 0.9961 |
| 3 | 4-205526-B-23.wav | 3.5 | breathing | 0.9958 |
| 4 | 2-99955-C-7.wav | 0.0 | insects | 0.9952 |
| 5 | 2-84965-A-23.wav | 0.0 | breathing | 0.9945 |
| 6 | 1-67230-A-29.wav | 0.5 | drinking_sipping | 0.9943 |
| 7 | 3-143119-A-21.wav | 0.0 | sneezing | 0.9938 |
| 8 | 1-202111-A-3.wav | 0.5 | cow | 0.9937 |
| 9 | 1-30709-A-23.wav | 4.0 | breathing | 0.993 |
| 10 | 1-202111-A-3.wav | 0.0 | cow | 0.9873 |

## 2. Window-level false negatives (same out-of-fold set)
61 of 279 snoring windows are missed (recall 0.78). **Every one of the 32 snoring clips has at least one flagged window** (clip-level recall 32/32), so the misses are
windows inside clips, not whole clips. Caution: in this dataset every window of a snoring clip is labelled positive, including windows between snores, so some "misses" are windows with little audible snoring.
The categories below are signal-level proxies computed from the clip envelope, not listening labels, and they overlap:

| Category | Snoring windows | Missed | Miss rate |
|---|---|---|---|
| quiet window (RMS <= -41.4 dBFS, bottom quartile of snoring windows) | 70 | 24 | 34.3% |
| brief snore (< 25% of the window within 12 dB of the clip peak level) | 102 | 41 | 40.2% |
| snore on steady background (clip dynamic range p95-p10 < 20 dB) | 81 | 7 | 8.6% |
| loud, sustained, high-contrast (none of the above) | 103 | 12 | 11.7% |

- **Quiet and brief snores are missed most** (34% and 40%), against about 12% for loud, sustained ones. "Snore on a steady background" is not harder in this proxy (9%).
- Clips with 4 or more missed windows: 3-130998-A-28 (7/9, mean -26 dBFS), 3-124795-A-28 (4/6, mean -49 dBFS), 2-114609-B-28 (5/9, mean -28 dBFS), 1-47923-A-28 (4/9, mean -33 dBFS), 2-114609-A-28 (4/9, mean -34 dBFS), 2-52001-A-28 (4/9, mean -47 dBFS), 3-130998-B-28 (4/9, mean -19 dBFS), 3-151557-A-28 (4/9, mean -35 dBFS). Loud clips can be missed too (3-130998-A at -26 dBFS: 7 of 9), so level alone does not explain it; this clip is a good one to listen to.
- Because snoring is one burst every few seconds, a window-level recall of 0.78 does not mean 22% of snoring episodes are missed. Section 4 measures that.


## 3. Synthetic nights (SYNTHETIC: a stand-in until real overnight recordings exist)
**Everything in sections 3 to 5 is on synthetic audio. It is not real-world performance and it is not a validation.** `scripts/eval/synthetic_nights.py` assembles 20 nights of 2 h
(40 h) from ESC-50 development clips (folds 1-4): a bedroom background (rain, wind, clock tick, breathing, insects, crickets, washing machine, sea waves,
thunderstorm, vacuum cleaner) over a -62 dBFS room tone, rhythmic snoring bouts built from real snore bursts cut out of the fold's snoring clips (one burst per breath cycle of 3.5 to 6.5 s,
brief = 2 to 4 cycles, quiet = 3 to 9 dB above the background, normal = 10 to 24 dB), and about 22 distractor events per hour (75% bedroom-relevant classes). Ground truth is known for every
burst, bout and distractor. A night uses one fold only and is scored by the head trained without that fold. The audio goes through a port of the app's level gate
(`scripts/eval/night_logic.py`; verified against the TypeScript, below) and then the real window classifier (NumPy YAMNet + v3 head). Windows below the gate are not scored, exactly as in the app.
Segments are built with the app's episode rule (`findEpisodes`: flagged windows, gaps up to 10 s, at least 5 flagged windows) or one of the experimental variants.

Known limitations of the synthetic nights: only 32 distinct snoring clips exist in development (8 per fold), so the 94 bouts reuse a handful of real snorers' bursts; the rhythm is
imposed by the generator (breath cycle with +/-20% jitter); the backgrounds are ESC-50 clips and some are not bedroom-typical (vacuum cleaner, sea waves, thunderstorm for 2 h); there are no snore-free nights, so a
night-level false-alarm rate cannot be read off (false segments per hour counts only segments that do not touch a bout, so it is valid for snore-free time); distractors never overlap bouts.

**Port check.** `scripts/eval/verify_port.sh` runs the real `NightPipeline` and `findEpisodes` from `src/night` (read-only) over a rendered night and compares with the Python port. 15-minute night: 1,799 of 1,799 window statuses, levels and floors identical; 60 random flag sets: identical episodes. 2-hour night (night 00): 14,399 of 14,399 window statuses identical (status counts [0, 13574, 825] in both), 60 random flag sets: identical episodes, 0 mismatches.

## 4. Results
Definitions and the selection rule are in section 0. TUNING = 10 nights built from folds 1-2 (47 bouts); CHECK = 10 nights from folds 3-4 (47 bouts). The candidates were evaluated on TUNING; the chosen point was then re-scored once on CHECK.

### 4.1 Headline: the app rule today versus the chosen point

| Variant | TUNE false seg/h | TUNE seg. recall (bouts) | TUNE seg. precision | CHECK false seg/h | CHECK seg. recall (bouts) | CHECK seg. precision |
|---|---|---|---|---|---|---|
| App rule today: t = 0.6495, >= 5 flagged windows, gap <= 10 s | 9.15 | 0.98 (46/47) | 0.30 | 12.90 | 0.91 (43/47) | 0.24 |
| CHOSEN: t = 0.98, >= 3 confirmed windows, confirmed = 2 flagged within 7 s | 0.85 | 0.91 (43/47) | 0.88 | 0.00 | 0.85 (40/47) | 1.00 |

| Window-level (all scored windows of the nights) | TUNE precision | TUNE recall of positive windows | TUNE AUC | CHECK precision | CHECK recall of positive windows | CHECK AUC |
|---|---|---|---|---|---|---|
| App rule today | 0.44 | 0.63 | 0.84 | 0.26 | 0.63 | 0.78 |
| Chosen | 0.85 | 0.34 | 0.84 | 0.90 | 0.39 | 0.78 |

Window recall counts windows that did not pass the level gate as missed; AUC is over scored windows only and does not depend on the operating point (so it is the same row twice). Window AUC on the synthetic nights is
0.84 (TUNING) and 0.78 (CHECK), against 0.971 on clean clips: mixing snoring into noisy backgrounds, and labelling gaps between bursts as not-snoring, is a much harder test than the clip-level AUC, which is one reason AUC alone is the wrong headline.

- **The app rule produces far more false segments than correct ones.** At today's threshold and rule: 183 false segments in 20 h on TUNING (9.15/h) and 258 in 20 h on CHECK (12.90/h); segment precision 0.30 / 0.24. Bootstrap over nights, 95% interval CHECK: 4.0 to 22.1 false segments/h.
- Segment recall at the app rule is high (0.98 / 0.91) because a snoring bout is long and any few windows trigger a segment. The 5 bouts it misses (1 on TUNING, 4 on CHECK) are quiet or brief; this is checked against the per-tag recall below.
- Most false segments come from the BACKGROUND, not from distractor events (all 20 nights, 441 false segments: sea waves 162, breathing 86, wind 71, vacuum cleaner 61, thunderstorm 46; see the per-background table in 4.3): beds with changing loudness pass the level gate and the classifier flags windows of them repeatedly.
- The chosen point: **0.85 false segments/h on TUNING (rule: <= 2.0) and 0.00 on CHECK, with segment recall 0.91 / 0.85**. The CHECK result of zero false segments in 20 h is partly luck of the bed draw (below) and its bootstrap interval is degenerate; with zero events in 20 h, a rough Poisson upper bound is about 0.15/h, which assumes independence the data do not have.
- Pooled over all 40 h (post hoc, not a selection input): app rule 11.03 false segments/h, recall 0.95; chosen 0.42/h, recall 0.88 (83/94 bouts).

### 4.2 Trade-off curves (recall versus false segments per hour), all variants
Each table shows, for each false-segment budget, the best TUNING recall reachable with that family of variants and everything simpler, and the same configuration re-scored on CHECK. Simpler families are in the cumulative tables below it.

| Variant | TUNE false seg/h | TUNE seg. recall | TUNE seg. precision | CHECK false seg/h | CHECK seg. recall | CHECK seg. precision |
|---|---|---|---|---|---|---|
| App rule today (t=0.6495, 5 flagged windows, gap <= 10 s) | 9.15 | 0.98 (46/47) | 0.30 | 12.90 | 0.91 (43/47) | 0.24 |
| CHOSEN: t=0.98 M=3 2-of-14w(7s) | 0.85 | 0.91 (43/47) | 0.88 | 0.00 | 0.85 (40/47) | 1.00 |

**Best achievable with threshold only (tuning-optimal per budget; CHECK = same config re-scored):**

| False-seg/h budget (tuning) | Config | TUNE fp/h | TUNE recall | CHECK fp/h | CHECK recall | CHECK recall normal / quiet / brief |
|---|---|---|---|---|---|---|
| <= 0.5 | none reaches it | | | | | |
| <= 1 | t=0.98 M=5 | 0.55 | 0.74 | 0.00 | 0.79 | 1.00 / 0.44 / 0.45 |
| <= 2 | t=0.95 M=5 | 1.70 | 0.87 | 0.10 | 0.81 | 1.00 / 0.44 / 0.55 |
| <= 3 | t=0.95 M=5 | 1.70 | 0.87 | 0.10 | 0.81 | 1.00 / 0.44 / 0.55 |
| <= 5 | t=0.9 M=5 | 3.35 | 0.89 | 2.10 | 0.87 | 1.00 / 0.56 / 0.73 |
| <= 10 | t=0.6495 M=5 | 9.15 | 0.98 | 12.90 | 0.91 | 1.00 / 0.78 / 0.73 |
| any | t=0.6495 M=5 | 9.15 | 0.98 | 12.90 | 0.91 | 1.00 / 0.78 / 0.73 |

**Best achievable with threshold + min windows (tuning-optimal per budget; CHECK = same config re-scored):**

| False-seg/h budget (tuning) | Config | TUNE fp/h | TUNE recall | CHECK fp/h | CHECK recall | CHECK recall normal / quiet / brief |
|---|---|---|---|---|---|---|
| <= 0.5 | t=0.95 M=8 | 0.50 | 0.70 | 0.05 | 0.72 | 0.97 / 0.33 / 0.27 |
| <= 1 | t=0.98 M=5 | 0.55 | 0.74 | 0.00 | 0.79 | 1.00 / 0.44 / 0.45 |
| <= 2 | t=0.98 M=3 | 1.20 | 0.91 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| <= 3 | t=0.98 M=3 | 1.20 | 0.91 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| <= 5 | t=0.95 M=3 | 4.00 | 0.94 | 0.85 | 0.89 | 1.00 / 0.67 / 0.82 |
| <= 10 | t=0.6495 M=5 | 9.15 | 0.98 | 12.90 | 0.91 | 1.00 / 0.78 / 0.73 |
| any | t=0.6495 M=5 | 9.15 | 0.98 | 12.90 | 0.91 | 1.00 / 0.78 / 0.73 |

**Best achievable with k-of-n (tuning-optimal per budget; CHECK = same config re-scored):**

| False-seg/h budget (tuning) | Config | TUNE fp/h | TUNE recall | CHECK fp/h | CHECK recall | CHECK recall normal / quiet / brief |
|---|---|---|---|---|---|---|
| <= 0.5 | t=0.98 M=3 2-of-6w(3s) | 0.45 | 0.87 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| <= 1 | t=0.98 M=3 2-of-14w(7s) | 0.85 | 0.91 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| <= 2 | t=0.98 M=3 2-of-14w(7s) | 0.85 | 0.91 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| <= 3 | t=0.98 M=3 2-of-14w(7s) | 0.85 | 0.91 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| <= 5 | t=0.95 M=3 | 4.00 | 0.94 | 0.85 | 0.89 | 1.00 / 0.67 / 0.82 |
| <= 10 | t=0.6495 M=5 2-of-6w(3s) | 8.50 | 0.98 | 15.70 | 0.89 | 1.00 / 0.67 / 0.73 |
| any | t=0.6495 M=5 2-of-6w(3s) | 8.50 | 0.98 | 15.70 | 0.89 | 1.00 / 0.67 / 0.73 |

**Best achievable with periodicity (+k-of-n optional) (tuning-optimal per budget; CHECK = same config re-scored):**

| False-seg/h budget (tuning) | Config | TUNE fp/h | TUNE recall | CHECK fp/h | CHECK recall | CHECK recall normal / quiet / brief |
|---|---|---|---|---|---|---|
| <= 0.5 | t=0.98 M=3 2-of-6w(3s) | 0.45 | 0.87 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| <= 1 | t=0.98 M=3 2-of-14w(7s) | 0.85 | 0.91 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| <= 2 | t=0.98 M=3 2-of-14w(7s) | 0.85 | 0.91 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| <= 3 | t=0.98 M=3 2-of-14w(7s) | 0.85 | 0.91 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| <= 5 | t=0.95 M=3 | 4.00 | 0.94 | 0.85 | 0.89 | 1.00 / 0.67 / 0.82 |
| <= 10 | t=0.6495 M=5 2-of-6w(3s) | 8.50 | 0.98 | 15.70 | 0.89 | 1.00 / 0.67 / 0.73 |
| any | t=0.6495 M=5 2-of-6w(3s) | 8.50 | 0.98 | 15.70 | 0.89 | 1.00 / 0.67 / 0.73 |


### 4.3 Per-background breakdown and what filtering removes

**Per primary background** (all 20 nights; the app rule versus the chosen point). Bed is whatever the night was tiled from; a second bed was added on 30% of nights and is not listed.

| Background | Nights (folds) | Hours | Bouts | App-rule false segments (per h) | App-rule bouts caught | Chosen false segments (per h) | Chosen bouts caught |
|---|---|---|---|---|---|---|---|
| sea_waves | 4 (4,2,2,2) | 8 | 21 | 162 (20.2) | 21 | 1 (0.12) | 20 |
| breathing | 2 (2,1) | 4 | 9 | 86 (21.5) | 9 | 15 (3.75) | 9 |
| wind | 3 (1,3,1) | 6 | 13 | 71 (11.8) | 13 | 0 (0.00) | 12 |
| vacuum_cleaner | 2 (3,4) | 4 | 9 | 61 (15.2) | 9 | 0 (0.00) | 6 |
| thunderstorm | 1 (4) | 2 | 6 | 46 (23.0) | 6 | 0 (0.00) | 6 |
| rain | 3 (4,4,1) | 6 | 12 | 9 (1.5) | 11 | 0 (0.00) | 10 |
| crickets | 2 (1,2) | 4 | 9 | 3 (0.8) | 9 | 1 (0.25) | 9 |
| washing_machine | 1 (3) | 2 | 5 | 3 (1.5) | 3 | 0 (0.00) | 3 |
| clock_tick | 2 (3,3) | 4 | 10 | 0 (0.0) | 8 | 0 (0.00) | 8 |

- **The breathing background is the one that survives the high threshold**: 15 of the chosen point's 17 false segments are on the 4 h of nights with breathing as the background (3.75/h). Both such nights are in TUNING; none is in CHECK. This matches the window-level finding (breathing is the worst class), and it is the realistic case, because the sleeper's own breathing is in every real recording. The CHECK zero should therefore not be read as "0 per hour in a bedroom".
- Post hoc sensitivity (not used for selection): dropping the three least bedroom-like backgrounds (vacuum cleaner, thunderstorm, sea waves) leaves 13 nights / 26 h: app rule 6.62 false segments/h (recall 0.91); chosen 0.62/h (recall 0.88).
- **Quiet and brief snores removed by the filtering** (chosen point versus the app rule, all 20 nights): quiet bouts caught 12/19 (app rule 16/19), brief bouts 21/28 (app rule 25/28), normal bouts 53/53 (unchanged). So filtering to 0.4 false segments/h costs 6 of the 94 bouts (89 caught by the app rule, 83 by the chosen point), all quiet or brief (the tags overlap, so the quiet and brief counts do not add up to 6); the app rule itself already misses 5 (quiet or brief). In a real recording the quiet/brief snorers are exactly the ones a screening aid most wants to notice, so this is a real cost, not a rounding error.
- **Periodicity check (breathing-rhythm, 3 to 7 s cycle on the snore score) did not help.** Added to the app rule it cuts false segments (12.9 to 3.3/h on CHECK at rho 0.2, strict) but removes about half the true bouts (recall 0.91 to 0.45; normal bouts 1.00 to 0.57) because it cannot be measured on short segments and the score series is noisy; added to the chosen point it only lowers recall. Under the declared rule it was never selected. Details in the table below. The generator's +/-20% cycle jitter and the use of a thresholded score series make this a harsh test of the idea, and a version based on the energy envelope might behave differently; it needs real nights to judge.

Periodicity on top of a fixed grouping:

| Base grouping | rho / policy for segments shorter than 15 s | TUNE fp/h | TUNE recall | CHECK fp/h | CHECK recall | CHECK recall normal / quiet / brief |
|---|---|---|---|---|---|---|
| app rule | off | 9.15 | 0.98 | 12.90 | 0.91 | 1.00 / 0.78 / 0.73 |
| app rule | 0.2 strict | 1.85 | 0.49 | 3.25 | 0.45 | 0.57 / 0.33 / 0.18 |
| app rule | 0.2 lenient | 4.65 | 0.68 | 6.15 | 0.60 | 0.63 / 0.44 / 0.55 |
| app rule | 0.3 strict | 0.90 | 0.17 | 1.55 | 0.17 | 0.20 / 0.11 / 0.09 |
| app rule | 0.3 lenient | 3.70 | 0.45 | 4.45 | 0.38 | 0.37 / 0.22 / 0.45 |
| app rule | 0.4 strict | 0.25 | 0.04 | 0.40 | 0.04 | 0.07 / 0.00 / 0.00 |
| app rule | 0.4 lenient | 3.05 | 0.36 | 3.30 | 0.28 | 0.27 / 0.11 / 0.36 |
| chosen | off | 0.85 | 0.91 | 0.00 | 0.85 | 1.00 / 0.56 / 0.64 |
| chosen | 0.2 strict | 0.05 | 0.47 | 0.00 | 0.51 | 0.73 / 0.11 / 0.09 |
| chosen | 0.2 lenient | 0.65 | 0.87 | 0.00 | 0.81 | 0.97 / 0.44 / 0.64 |
| chosen | 0.3 strict | 0.05 | 0.34 | 0.00 | 0.30 | 0.40 / 0.11 / 0.09 |
| chosen | 0.3 lenient | 0.65 | 0.81 | 0.00 | 0.74 | 0.87 / 0.44 / 0.64 |
| chosen | 0.4 strict | 0.05 | 0.17 | 0.00 | 0.11 | 0.17 / 0.00 / 0.00 |
| chosen | 0.4 lenient | 0.65 | 0.77 | 0.00 | 0.60 | 0.70 / 0.33 / 0.55 |

## 5. Chosen operating point and what it would change
Rule (section 0), applied once to the TUNING nights: the highest segment recall subject to <= 2.0 false flagged segments per hour. Result: **t = 0.98, k-of-n confirmation 2 flagged windows within 14 consecutive window indices (7 s), at least 3 confirmed windows per segment, no periodicity check.** TUNING: 0.85 false segments/h, recall 0.91 (43/47). CHECK: 0.00/h, recall 0.85 (40/47), segment precision 1.00.

What this is and is not:
- It is a *candidate* for the next real-data round, not a decision. The app is unchanged (this task did not edit `src/night` or `mobile/`). Adopting it would change the meaning of `findEpisodes` and of the night rules built on it (`NIGHT_MIN_EPISODES = 3`, `NIGHT_MIN_EPISODE_SEC = 120`, both PROVISIONAL), because at t = 0.98 each bout yields fewer flagged seconds, so those constants would have to be re-derived on real nights.
- The threshold is at the top of the declared grid and the score scale is saturating (scores are class-weighted logistic outputs, not probabilities). On the development windows, t = 0.98 keeps 140 of 279 snoring windows with 15 false ones (precision 0.90, recall 0.50), whereas the shipped 0.6495 keeps 218 with 426 false ones (precision 0.34, recall 0.78).
- v3 has not been compared with the deployed TFLite (parity unverified), so scores on a phone may differ and an operating point tuned on NumPy scores may not transfer.
- 94 bouts built from 32 real snoring clips are not 94 independent snorers; the intervals above are bootstrap-over-nights and understate the uncertainty.

## 6. Reproduce
`scripts/eval/run_eval.sh` (about 30 to 40 minutes on this Mac; Python 3.12 with NumPy and SciPy only, run with `python3 -I`): `oof_heads.py` (OOF scores and per-fold heads), `error_analysis.py` (sections 1 and 2,
`model/error_analysis.v3.json`, the listening list), `synthetic_nights.py` (20 nights, about 8 minutes with 4 workers), `segment_eval.py` (sections 4 and 5, `model/segment_eval.synthetic.json`). Port check: `scripts/eval/verify_port.sh`.
Nothing was committed and no model, app or threshold was changed.
