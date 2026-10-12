# SleepSmooth Sources and Claims Register

Binding companion to `CLAUDE.md` and `docs/PRD.md`. Nothing in the product may state a clinical fact, accuracy figure, or red-flag rule that is not listed here as verified.

## 1. NoSAS (active instrument)

**Citation.** Marti-Soler H, et al. The NoSAS score for screening of sleep-disordered breathing: a derivation and validation study. *Lancet Respir Med* 2016;4:742-748. doi:10.1016/S2213-2600(16)30075-3.

**URLs.**
- https://iris.unil.ch/handle/iris/57504
- https://pmc.ncbi.nlm.nih.gov/articles/PMC6977329

**Scoring (total 0-17, cutoff >= 8).**

| Item | Points |
|---|---|
| Neck circumference > 40 cm | 4 |
| BMI 25 to < 30 | 3 |
| BMI >= 30 | 5 |
| Snoring | 2 |
| Age > 55 | 4 |
| Male sex | 2 |

**Status.** Scoring corroborated by two sources (verified: true for scoring).

**Validation summary.**
- Derivation: HypnoLaus (n = 2,121, population-based), AUC 0.74.
- External validation: EPISONO, AUC 0.81 (sample size unverified).
- The original paper reports NoSAS outperforming STOP-Bang and Berlin.
- Sleep-clinic study (PMC6977329, n = 596), at cutoff >= 8:
  - Sensitivity 71.2% / 80.4% / 83.1% at AHI >= 5 / 15 / 30.
  - Specificity 62.4% / 49.3% / 40.7% at AHI >= 5 / 15 / 30.

**Licensing.** Article is all rights reserved. No license or permission requirement was found for the published scoring formula. Residual uncertainty is low but nonzero. Attribute in-app; consider emailing the corresponding author.

**Unverified (do not use in product).** Original-paper sensitivity/specificity, EPISONO sample size, the SDB definition used.

### Allowed in-app statements (the "may say" list)

1. "Your NoSAS score is X of 17. In the studies that tested it, people scoring 8 or more were more likely to have clinically significant sleep-disordered breathing than people scoring lower."
2. "NoSAS ... is a screening score. It is not a diagnosis."
3. Accuracy only as ranges from PMC6977329 (sleep-clinic setting), with: "results vary by setting and how sleep apnea was defined."
4. "A lower score does not rule out sleep apnea. Talk to a clinician if you have symptoms."
5. A note that the score is applied outside its validation populations.
6. (Incomplete score, partial total already at or above cutoff) "Even without a neck measurement, your score is already at or above the published cutoff of 8."

### Forbidden

Diagnosis; probability; severity; "low risk" / "safe" / "all clear" / green indicators; accuracy figures applied to this user or to the app; "replaces a sleep study"; a score merged with audio or wearable data; implied endorsement by the authors or journal.

## 2. Excluded instruments and why

| Instrument | Reason excluded | Reference |
|---|---|---|
| STOP-Bang and STOP | Requires UHN permission | https://site.thoracic.org/assemblies/srn/sleep-related-questionnaires/stop-bang |
| Epworth Sleepiness Scale | Mapi license required for organizations | https://site.thoracic.org/assemblies/srn/sleep-related-questionnaires/ess |
| Berlin | Requires Netzer permission; ATS copyright | n/a |
| No-Apnea | Needs neck measurement for nearly all points; weaker later validation | n/a |
| GOAL | Not used, to limit scope; no independent external validation found | n/a |
| P-SAP | Contains clinical-exam items | n/a |

## 3. Datasets

| Dataset | Source | License | Use | Status |
|---|---|---|---|---|
| ESC-50 | Piczak 2015, https://github.com/karolpiczak/ESC-50 | CC BY-NC 3.0 | Negatives (excluding class "snoring") | Attribution required; non-commercial |
| Kaggle Snoring Dataset | Khan | TBD; user to verify before training | Snore / non-snore positives and negatives | PENDING |

## 4. Red-flag wording

Wording stays "talk to a clinician promptly"-style. No triage rules and no emergency guidance. A row is `verified: true` only if the page was actually fetched. `In app` says whether the app asks the question as a red-flag item.

| Flag | Wording (as shown in app) | Source guidance | Source URL | Verified | In app |
|---|---|---|---|---|---|
| Falling asleep or nearly falling asleep while driving | "You reported falling asleep, or nearly falling asleep, while driving. Please talk to a clinician promptly." plus "If you feel drowsy while driving, CDC advises getting off the road and resting until you are no longer drowsy." | CDC MMWR: drivers with untreated sleep disorders are at increased risk; advises "seek treatment for sleep disorders" and to "get off the road and rest until no longer drowsy". NHS: if excessive sleepiness is confirmed, "you must not drive until symptoms like feeling very tired are under control" (UK rule, not quoted in app). | https://www.cdc.gov/mmwr/preview/mmwrhtml/mm6151a1.htm ; https://www.nhs.uk/conditions/sleep-apnoea/ | true (fetched) | yes (red flag) |
| Witnessed choking or gasping in sleep | Generic: "talk to a clinician" (shown as a core symptom, not a red flag) | NHS (paraphrase): GP advice includes making gasping, snorting or choking noises in sleep. NHLBI: "Talk to your healthcare provider about your symptoms." Gasping is listed there; choking is not. | https://www.nhs.uk/conditions/sleep-apnoea/ ; https://www.nhlbi.nih.gov/health/sleep-apnea/symptoms | true (fetched) | no (core symptom only) |
| Severe daytime sleepiness affecting safety at work | Generic fallback only | No authoritative statement found in the fetched pages. NHS and NHLBI mention daytime tiredness only. | n/a | false | no |

Note: the CDC drowsy-driving page https://www.cdc.gov/sleep/about/drowsy-driving.html returned 404 when fetched, so it is not cited.
