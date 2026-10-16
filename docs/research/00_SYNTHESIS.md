# Research synthesis: what SleepSmooth is missing (2026-10-15)

Sources: [01 Academic](01_ACADEMIC_ACOUSTIC_OSA.md) · [02 Commercial](02_COMMERCIAL_LANDSCAPE.md) · [03 Clinical](03_CLINICAL_PATHWAY.md) · [04 Gap audit](04_GAP_AUDIT.md). Each claim below is cited in those files. The orchestrator spot-checked three gap-audit items in code and all three were confirmed:
- the model-card metrics TODO at `mobile/app/model-card.tsx:17`
- `healthkit: false` in `mobile/app.json`
- no `__DEV__` guard in `mobile/app/(dev)/gallery.tsx`

It also confirmed that NoSAS is the only bundled questionnaire.

## What the field tells us

- **The cleared products are cautious too.** Apple (K240929) and Samsung (DEN230041) are cleared only as notifications of possible moderate-to-severe obstructive sleep apnea (OSA). Both say that getting no alert does not rule it out. Reported sensitivity is about 66% for Apple (secondary source) and 82.7% for Samsung (its instructions for use). This backs our "cannot rule out" stance.
- **Microphone apps are wellness tools, not medical devices.** SnoreLab, Sleep Cycle, Pillow and ShutEye all work this way. SnoreLab-style snore percentage correlates only weakly with the apnea-hypopnea index (AHI). Our honest ceiling is "snore-like sounds observed".
- **Research shows promise but is small.** Phone-audio research such as Han 2024 (n=101, home sleep study) reports strong sensitivity, but in small single-country studies. Pauses in sound can be spotted, but quiet events and central apnea are blind spots.
- **PSG-Audio is the only practical public dataset with audio.** It covers 212 sleep studies and is the same data as the ScienceDB set. Most of its patients have severe OSA and all come from one site. MPSSC is not useful for detecting OSA.
- **The competitive moat is care navigation, not detection.** Wesper, Sunrise, WatchPAT, Withings Sleep Rx and Lofta, plus Oura's partnership with ResMed, all route people to a home sleep apnea test (HSAT).
- **Licensing is a hidden risk.** The Epworth Sleepiness Scale (ESS), STOP-Bang and OSA-50 need permission to use. NoSAS terms are unverified, so we need to email its authors and log the reply.
- **Guidelines on screening.** AASM 2017 says questionnaires must not diagnose. USPSTF 2022 gives an "I" (insufficient evidence) rating only for adults without symptoms, so our symptomatic users are outside its scope. NICE says the ESS alone should not drive referral.

## Ranked plan (impact vs effort, safe under CLAUDE.md)

| # | Item | Size | Source |
|---|---|---|---|
| 1 | One real overnight device test, with the export log filed. This turns the headline claim into evidence. | M (user + device) | 04 |
| 2 | Honest in-app model card: real precision and recall, "no real-phone data", and v1/v3 wording aligned | S | 04 |
| 3 | "What this cannot tell you" panel, plus "cannot rule out" wording for low NoSAS scores. Cite AASM/NICE and the Apple/Samsung sensitivity figures. | S | 02, 03 |
| 4 | Next-step pathway: what an HSAT is versus a PSG, how to ask for one, cost and wait questions to ask, and a clinician conversation script | S–M | 02, 03 |
| 5 | Bed-partner path: partner-observed snoring, pauses and gasping recorded as user-reported, plus partner-tagged clips | M | 02, 04 |
| 6 | Guideline-backed "discuss with your clinician" checklist covering resistant hypertension, AF, heart failure, stroke, opioids and drowsy driving. Wording: "guidelines suggest discussing", never "you are at risk". | S | 03 |
| 7 | Personal adaptation from "Not snoring" feedback, plus a periodicity gate. These are engineering ideas, not proven in the literature. | M | 01 |
| 8 | "Gaps in snore-like sound" observation (snoring stops, then restarts loudly). Never call these apnea events, and never give a per-hour rate. | M | 01 |
| 9 | Multi-night strip with a "not comparable to a clinical result" note | M | 04, 01 |
| 10 | Exports: a real PDF/download on web, and an editable summary on iOS | S–M | 04 |
| 11 | Wearable manual entry (`WearableObservation`, user-entered, no scoring) | M | 04 |
| 12 | Adults-only gate with exits for children and pregnancy; caveat panel on women, lean-body and older adults | S | 03 |
| 13 | Follow-through reminder to book the appointment, offered as an unproven aid | S | 03 |
| 14 | Hygiene: guard `?parity` and the gallery in production; ConsentRecord history; locale and units | S | 04 |
| 15 | Licensing: email the NoSAS authors and log the reply (user action) | S | 03 |

## Do not build
AHI or events per hour, severity bands, audio-derived risk scores, green reassurance, verbatim ESS/STOP-Bang text without written permission, emitting sonar from the phone speaker, or training a new model without real labelled nights.
