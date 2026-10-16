# Academic research: smartphone, acoustic and non-contact OSA screening, and what SleepSmooth can borrow

Research date: 2026-10-15. Web research only. Figures come from pages I fetched or search summaries; anything I could not verify is marked "not verified". Several PDFs (ApneaApp, Han/Xia/Mascolo) could not be text-extracted, so their detailed numbers are not verified.

## Executive summary

1. Phone-audio OSA screening is a real research field, but evidence is small, single-country and mostly single-centre. No source here shows it replaces PSG, and several note level-2 home PSG itself underestimates AHI.
2. Best home-recording result found: Han et al. 2024 (JAMA Otolaryngol), 101 analysed adults, iPhone/Galaxy audio vs unattended level 2 home PSG. Sensitivity 90.9-93.3% across AHI 5/15/30. Single country (Korea), proprietary deep model. https://doi.org/10.1001/jamaoto.2023.3490
3. Independent, more modest home result: Romero et al. 2022, 103 participants, sensitivity 0.79 / specificity 0.80 (moderate OSA). https://doi.org/10.1109/jbhi.2022.3154719 Real-world numbers sit well below the headline ones.
4. A snore-percentage app is not an apnea screen. SnoreLab vs polygraphy (n=19): AHI correlations r = 0.495-0.645, no obstructive-event detection, authors say it should not be used for OSA screening. https://doi.org/10.3390/ijerph18147326 This is SleepSmooth's current approximate capability, so keep claims at "snore-like sounds".
5. Event detection from audio (pause then resume) is the research frontier: smartphone CNN reached sensitivity 0.72 / specificity 0.89 at 60 s windows (Castillo-Escario, EMBC 2022). Quiet or central events are known blind spots.
6. Active sonar (ApneaApp, 18-20 kHz FMCW) and radar/UWB have the strongest AHI agreement numbers but need speaker/hardware transmit or dedicated sensors, and their key results are lab-based.
7. Public data: PSG-Audio (212 PSGs, with audio, ScienceDB) is the practical set. NSRR/SHHS have PSG but I could not confirm audio. MPSSC (828 snore samples) is for snore *location*, not OSA detection.
8. False positives: no paper here claims to solve breath/bang/fan confusion. Credible levers are personalisation, snorer diarisation, multi-night aggregation, and requiring repeated rhythm, as engineering ideas (not literature-verified).
9. Credible validation: subject-wise splits, report at AHI 5/15/30, Bland-Altman, STARD 2015 reporting, and acknowledge night-to-night AHI variability. https://pmc.ncbi.nlm.nih.gov/articles/PMC7339240
10. For SleepSmooth: spend 1-3 days on per-user calibration, multi-night aggregation, a clip-review feedback loop, and an honest "pauses in snoring observed" view. Do NOT output AHI, apnea events, or severity.

## 1. Smartphone and microphone acoustic OSA research

| Study | Setup | Reported result | Notes |
|---|---|---|---|
| Han et al. 2024, JAMA Otolaryngol Head Neck Surg 150(1):22-29 https://doi.org/10.1001/jamaoto.2023.3490 | Prospective, STARD 2015, 101 analysed of 128, **home**, level 2 PSG at own homes, 2022-23, Korea; iPhone 13 and Galaxy S20 | iOS sensitivity / specificity: AHI5 92.6/84.3, AHI15 90.9/94.4, AHI30 93.3/94.4. Android similar. 4-class accuracy 75.2%. r with home PSG 0.958 (iOS). | Fetched from the JAMA page. Authors list limits: Korean-only, small, AHI only, level 2 PSG underestimates. Participants slept alone (per search summary: https://www.ajmc.com/view/study-validates-smartphone-analysis-for-predicting-obstructive-sleep-apnea). |
| Romero et al. 2022, IEEE JBHI 26(7) https://doi.org/10.1109/jbhi.2022.3154719 | 103 participants, **home** sleep apnea testing, 1-2 nights; whole-night audio split into segments, share of flagged segments gives the screen | Moderate OSA sens 0.79 / spec 0.80; severe sens 0.78 / spec 0.93 | Fetched via White Rose repository: https://eprints.whiterose.ac.uk/id/eprint/184194/. Subject-wise split: not verified. |
| Apneal v0.1, Perez-Villegas et al. (arXiv 2406.16953) https://arxiv.org/abs/2406.16953 | 46 adults, **in-hospital PSG**, proof-of-concept, one centre | Manual scoring AHI>15 sens 0.91 / PPV 0.89; AHI>30 sens 0.85 / PPV 0.94. Automatic model AHI>15 AUC-ROC 0.85, AHI>30 AUC-ROC 0.95 | Preprint. Authors call for a multicentre study. (A search-engine summary quoted different numbers; I used the arXiv abstract.) |
| Han, Xia, Mascolo, IEEE JBHI, "Continuous Mobile Audio Monitoring for Sleep Apnea Detection" https://mobile-systems.cl.cam.ac.uk/papers/JBHI26.pdf | PSG-Audio, 850+ h, 194 subjects, **in-lab**, tracheal vs ambient mic | Best 90.8% accuracy for apnea detection, 83.3% when apnea and hypopnea separated; overnight moderate screening sens 0.93 / spec 1.0, severe sens 0.84 / spec 0.97 (search summary) | Figures from a search summary; PDF unreadable to my tool. Split type and DOI: not verified. In-lab, with severe-OSA-heavy cohort (see PSG-Audio below), so not representative of the general population. |
| Castillo-Escario et al. 2022, EMBC, "CNNs for apnea detection from smartphone audio: effect of window size" https://www.recercat.cat/handle/2445/199384 | Smartphone audio spectrograms vs PSG | 60 s window best: sens 0.72, spec 0.89, AUROC 0.88 | Authors note short windows miss the sound drop; long windows mix events. Per search summary; setting (lab/home) not verified. |
| Castillo-Escario et al. 2019, IEEE Access https://doi.org/10.1109/ACCESS.2019.2939749 | Smartphone audio, entropy features, vs commercial home monitor | Numbers not verified | Cited to show the "silence/entropy" line of work. |
| Klaus et al. 2021, SnoreLab vs polygraphy https://doi.org/10.3390/ijerph18147326 | 19 healthy volunteers, **home**, polygraphy reference | Snoring >50% of night: sens 100%, spec 94.1%. r with polygraphic AHI 0.495-0.645. App did not detect obstructive events. | Authors: should not be used for OSA screening. |

**Snore-sound excitation location and VOTE.** VOTE (Velum, Oropharynx, Tongue base, Epiglottis) labels are assigned by ENT experts during drug-induced sleep endoscopy (DISE) (Kezirian et al. 2011; stated in the MPSSC description). Qian et al. 2017 (IEEE TBME) classified snore excitation location from 40 male patients recorded during DISE, best result 78% UAR under subject-independent validation (https://doi.org/10.1109/TBME.2016.2619675, via https://pure.bit.edu.cn/en/publications/classification-of-the-excitation-location-of-snore-sounds-in-the-/). The MPSSC (Janott et al. 2018, https://doi.org/10.1016/j.compbiomed.2018.01.007) has 828 samples (V 484, O 216, T 39, E 89) from three German centres, fixed 283/282/263 train/dev/test partitions (Interspeech 2017 challenge). Reported later UAR varied widely (a survey cites 67.0-87.5%; some challenge systems 49.6-65.6% on the dev set), see https://www.isca-archive.org/interspeech_2017/janott17_interspeech.html and https://arxiv.org/pdf/2408.16030. Takeaway: this is a snore-*site* research tool requiring DISE ground truth. It is irrelevant to detecting OSA from a phone and should not be borrowed as a feature.

## 2. Active sonar and non-contact sensing

- **ApneaApp (UW, MobiSys 2015)**, Nandakumar, Gollakota, Watson. Phone speaker emits 18-20 kHz FMCW chirps; microphone listens to reflections of chest/abdomen motion. Targets apnea, hypopnea and central apnea. Inaudible band helps ignore speech, traffic, fans (UW coverage). https://homes.cs.washington.edu/~gshyam/Papers/apneaapp.pdf Reported: 37 patients at Harborview sleep lab, correlation >0.95 vs PSG, from a researcher profile (https://risingstars-eecs.mit.edu/?p=752); the "98%" in press (https://www.washington.edu/news/2015/04/27/new-uw-app-can-detect-sleep-apnea-events-via-smartphone/) is a different metric. Both unverified against the paper text. Licensed to ResMed (SleepScore); consumer product is marketed as sleep tracking, not diagnosis (https://comotion.uw.edu/press_release/non-contact-sleep-tracking-mobile-app-sleepscore-inspired-in-part-by-apneaapp-research-performed-by-university-of-washington-researchers).
- **UWB radar**: multicentre, 291 participants (115 train, 176 validation), ICC 0.98 for AHI vs PSG in validation (https://jtd.amegroups.org/article/view/38166/html). Hanyang 94-patient study: ICC 0.927; accuracy 0.93 / 0.91 / 1 at AHI 5 / 15 / 30 (https://scholarworks.bwise.kr/hanyang/handle/2021.sw.hanyang/10670).
- **Sleepiz One+ radar**: 141 adults, AHI r = 0.94 (with SpO2) and 0.87 (without); Bland-Altman agreement good, errors larger at higher severity (https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11303430/).
- **Wi-Fi sensing**: I found no AHI-validated study. Not verified.
- Caveat: sonar uses an inaudible speaker emission the phone user did not consent to in the current flow, needs hardware-specific calibration, and no iPhone-sonar validation exists that I found. Out of scope for 1-3 days.

## 3. Public datasets

| Dataset | Size | Audio? | License / access |
|---|---|---|---|
| **PSG-Audio** (Korompili et al., Sci Data 2021) https://doi.org/10.1038/s41597-021-00977-w | 212 PSGs, Athens, one centre; ~76% male; ~88.7% severe OSA, <=1.4% normal; first ~4 h of each study | Yes: tracheal and ambient mics, 48 kHz (stored 16-bit EDF) | Hosted on Science Data Bank, DOI 10.11922/sciencedb.00345 (also called "ScienceDB OSA dataset"). Article CC BY 4.0, metadata CC0; dataset-file licence not stated on the paper page. https://pmc.ncbi.nlm.nih.gov/articles/PMC8333307/ |
| **MPSSC** | 828 snore samples, DISE-labelled | Yes (snore clips) | Distributed via Interspeech 2017 ComParE challenge; current licence and access route not verified. Contact authors (TUM/Schuller group). |
| **NSRR** (incl. SHHS, 8,000+ studies in first release) https://aasm.org/national-sleep-research-resource-launched-as-resource-for-the-sleep-community/ | Large | Raw audio: not verified | Free but requires an account and data-access request. PhysioNet hosts a small open SHHS subset: https://physionet.org/content/shhpsgdb/ |
| **SSBPR** snoring-position dataset https://arxiv.org/abs/2307.13346 | 7,570 snore recordings, 6 body positions | Yes | Licence and download link not found. Not OSA labels. |
| OSA-related snore from ceiling mic + PSG https://arxiv.org/abs/2102.12829 | Size not verified | Yes | Access not verified. Leave-one-patient-out CV; ~87% snore identification. |

Practical note for SleepSmooth: PSG-Audio is heavily severe-OSA, single-site, clinical-microphone data. It can test pause detection on ambient audio, but it cannot estimate the false-flag rate in normal bedrooms with a phone on a nightstand. Do not train a "probability" on it.

## 4. Reducing false positives

Evidence is thin; this section separates literature from my suggestions.

- **Inaudible-band sensing** sidesteps audible noise (ApneaApp), see above.
- **Snorer diarisation / who-is-snoring**: DNN estimates number of concurrent snorers in mono audio (ICASSP 2020, https://rc.signalprocessingsociety.org/conferences/icassp-2020/spsicassp20vid0173); snore-based user recognition (https://arxiv.org/pdf/2301.12209). Partner snoring is a recognised interference problem (https://jtd.amegroups.org/article/view/42773/html). Both are research, no validation numbers verified.
- **Accelerometry** has been proposed to complement audio (same commentary).
- **Multi-night aggregation**: single-night AHI misclassifies. In 10,340 adults with three nights, correlations between nights r = 0.87-0.89 but roughly 20% of first-night mild/moderate were misclassified (https://pmc.ncbi.nlm.nih.gov/articles/PMC7339240, attribution via search summary). A 2025 ERS abstract: 33% changed classification between nights (https://publications.ersnet.org/lookup/doi/10.1183/13993003.congress-2025.OA3308, not verified in full).
- **Engineering ideas, not literature-verified**: per-user onboarding sample ("this is my snoring"); require quasi-periodic recurrence (snores repeat at breathing rate; bangs do not); gate on user "Not snoring" feedback to adapt threshold; separate "loud sound" from "snore-like"; room-noise baseline per night.
- Known limit: an event detector keyed on quiet periods fails on events with no sound and on central/mixed events (https://jtd.amegroups.org/article/view/42773/html).

## 5. Validation the field considers credible

- **Subject-wise splits**: no recording from a test participant in training. Qian et al. used subject-independent validation; Romero and Han JBHI split types are not verified. Segment-level random splits inflate results.
- **Report at multiple AHI thresholds** (5/15/30), as Han 2024 and the UWB studies do, with sensitivity, specificity, PPV/NPV and prevalence.
- **Agreement**: Bland-Altman and ICC for continuous AHI, as in Sleepiz One+; a standardised framework for sleep-tracker testing includes discrepancy and Bland-Altman analysis (https://www.sri.com/publication/biosciences-health-pubs/a-standardized-framework-for-testing-the-performance-of-sleep-tracking-technology-step-by-step-guidelines-and-open-source-code/).
- **Reporting**: STARD 2015 (https://pmc.ncbi.nlm.nih.gov/articles/PMC4779779; 30-item checklist, from search summary).
- **Reference standard**: say whether PSG is level 1 or 2 and in-lab or home. Home level 2 underestimates AHI (Han 2024).
- **Context**: AASM 2018 states consumer sleep technology cannot be used to diagnose or treat sleep disorders now (https://sleepreviewmag.com/2018/05/aasm-consumer-sleep-technology-no-substitute-medical-evaluation/).

**A credible student "early evidence" study (not a clinical claim):**
1. Pre-register the question: "How often do flagged clips match what a human listener hears as snoring?" That is a *sound-classification* claim, not a disease claim.
2. Recruit 5-10 consenting adults and a few bed partners; record 3+ nights each in their own bedrooms.
3. Two independent human labellers annotate a random sample of flagged and unflagged 15 s clips; report inter-rater kappa.
4. Report precision/recall of the snore detector at the clip level with person-wise cross-validation, per-night false-flag rates, and a confusion table (snore, breathing, speech, bang, fan, pet).
5. State sample size, no PSG, no AHI, no diagnostic accuracy; present as a "pilot, n=...". If PSG owners exist, a purely descriptive agreement note is acceptable, not a performance claim.

## 6. Ranked recommendations for SleepSmooth

Rank = impact / effort for 1-3 days. "Rule check" is against the no-diagnosis, no-AHI, no-green rules.

| # | Recommendation | Effort | Rule check |
|---|---|---|---|
| 1 | **Use the clip-review feedback ("Not snoring") to adapt per-user threshold and to compute a precision readout** ("of 20 clips you reviewed, 14 sounded right"). Add a confusion-type chip (breathing, bang, speech, fan). | 0.5-1 d | Safe. Report as user-confirmed. |
| 2 | **Periodicity gate**: require repeated roughly 3-6 s recurrence before labelling a segment snore-like, and down-rank single loud bangs. Engineering idea; test on your own labelled clips. | 0.5-1 d | Safe. |
| 3 | **Multi-night summary**: show per-night snore-like minutes and a "varies a lot night to night" note, citing night-to-night variability (Punjabi et al.). | 0.5 d | Safe; reduces overconfidence. |
| 4 | **Reframe the "pause" view**: show "gaps in snore-like sound observed (could be normal breathing, position change, or the phone missing quiet sounds)". Use the 60 s window finding to explain why gaps are ambiguous. | 1 d | Safe only with this wording. Never "apnea events", count per hour, or AHI. |
| 5 | **Small labelled pilot** (section 5) with kappa and per-class false-flag table; put results in an "Evidence we have" card. | 1-2 d | Safe if labelled as pilot, no diagnostic accuracy. |
| 6 | Quiet-night honesty: add a "recording was too quiet to judge" state; never present low snore minutes as reassuring (quiet snorers and non-snoring apnea exist). | 0.25 d | Required by rules; no green indicator. |
| 7 | Partner-snore caution: ask "is anyone else sleeping nearby?" in setup and carry it into the clinician summary. Diarisation itself is research-grade. | 0.25 d | Safe. |
| 8 | Evaluate the detector on PSG-Audio ambient channel, for pause-pattern sanity only. Needs download, access check, mismatched mic/hardware, severe-heavy cohort. | 1-2 d | Safe if described as a technical check. |
| 9 | Add accelerometer "restless vs still" context to flagged clips (already have motion). | 0.5 d | Safe if not framed as breathing. |

**Would violate the no-diagnosis rule (do not build):**
- Estimating or displaying AHI, events per hour, or severity bands (even "mild/moderate/severe").
- Any probability or risk score derived from audio, or "apnea detected/events" wording.
- Quoting Han 2024 or Romero 2022 sensitivity as if it were SleepSmooth's accuracy (different model, different phones, unvalidated).
- Green "all clear" or "low risk" after a quiet night.
- Using ApneaApp-style sonar claims, which would also require an unvalidated, mocked-or-untested implementation.

**Safe language**: "snore-like sounds observed", "pauses in snore-like sound observed (unclear cause)", "this recording cannot rule out sleep apnea", "bring this summary to a clinician".

## Source gaps (not verified)

Han/Xia/Mascolo split design and DOI; ApneaApp paper numbers; MPSSC current licence; NSRR audio availability; any Wi-Fi AHI study; PSG-Audio dataset-file licence.
