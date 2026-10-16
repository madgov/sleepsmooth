# Commercial and Regulated Landscape for OSA Screening (research, 2026-10-15)

Method: web search plus page fetches. Where a figure came only from a search summary or a secondary source, it is marked "secondary". "Not verified" means I could not confirm it. Apple's validation PDF and the FDA DEN230041 PDF could not be text-extracted, so their numbers come from secondary summaries.

## Executive summary

1. The regulated consumer tier is wrist/ring sensors (Apple, Samsung). Both are software-only, over-the-counter "risk" notifications for moderate-to-severe OSA, not diagnoses. Apple 510(k) K240929 (Sep 2024); Samsung De Novo DEN230041 (Feb 2024). https://fda.innolitics.com/device/K240929 ; https://news.samsung.com/us/samsung-sleep-apnea-feature-galaxy-watch-first-its-kind-authorized-us-fda
2. Their "no alert" copy is explicit: Apple's indications say the absence of a notification does not indicate absence of sleep apnea (per innolitics summary of the FDA record). This is the pattern SleepSmooth already follows.
3. Both are tuned for few false alarms and accept missed cases. Apple's reported sensitivity is about 66% at about 98.5% specificity (secondary); Samsung's is 82.7% / 87.7% (Samsung IFU). Neither can honestly say "you're fine".
4. Samsung's Galaxy Ring cleared (K261011, reported July 2026) with a multi-input v2.0 algorithm. K-number is from a secondary source; verify on FDA. https://www.ubergizmo.com/2026/07/galaxy-ring-to-become-first-smart-ring-with-fda-cleared-sleep-apnea-detection/
5. Microphone-only apps (SnoreLab, Sleep Cycle, Pillow, ShutEye) are unregulated wellness tools. They record and score snoring, play clips, and use "not a medical device" disclaimers. A 60-person PSG study found snore counts and scores correlate with PSG. https://www.dovepress.com/validation-of-downloadable-mobile-snore-applications-by-polysomnograph-peer-reviewed-fulltext-article-NSS
6. The real "next step" market is home sleep apnea tests (HSATs): Wesper, Sunrise, WatchPAT, Withings Sleep Rx, Lofta. All are cleared diagnostic aids that a clinician orders. This is where a screening app should hand off.
7. Oura took a different route in May 2026: no clearance, but a breathing-disturbance alert paired with a Resmed care pathway and a doctor-conversation guide. https://ouraring.com/blog/resmed-partnership/
8. The common UX gap in microphone apps is a clinician-oriented handoff. SleepSmooth's clinician summary and STOP-Bang combination is a real differentiator. Not verified: that no competitor offers a questionnaire plus clips plus summary.
9. SleepSmooth's biggest missing pieces: a visible validation/limitations page, partner mode, a trend view across nights, a concrete "ask for a sleep test" path (telehealth/HSAT explainer), and a plain-language "what a miss looks like" statement with real published sensitivity numbers of others.
10. Highest risk for a hackathon: anything that outputs an AHI, severity, or "risk level" from phone audio. Reframe as observations plus coverage plus next step.

## Product-by-product

### Apple Watch Sleep Apnea Notifications
- Signal: wrist accelerometer; "breathing disturbances" metric during sleep. https://www.apple.com/healthcare/ (feature pages); summary at https://sleepreviewmag.com/sleep-diagnostics/consumer-sleep-tracking/wearable-sleep-trackers/apple-watch-sleep-apnea-detection-feature/
- Claim wording: nightly "Elevated" / "Not Elevated" in Health; notification after consistent elevated signs over 30 days (secondary, MedTech Dive https://medtechdive.com/news/apple-watches-sleep-apnea-hearing-features/726523). Indications: identify patterns "suggestive of moderate-to-severe sleep apnea" and "not intended to diagnose" (https://fda.innolitics.com/device/K240929).
- Regulatory: 510(k) K240929, cleared 2024-09-13, product code QZW, 21 CFR 868.2378 OTC device to assess risk of sleep apnea, predicated on Samsung's De Novo (same URL).
- Validation: Apple white paper (https://apple.com/health/pdf/sleep-apnea/Sleep_Apnea_Notifications_on_Apple_Watch_September_2024.pdf). Secondary: validation cohort about 1,500; sensitivity 66.3% (CI 62.2-70.3), specificity 98.5% for AHI >= 15; operating point deliberately favors specificity. Moderate-severity sensitivity only 43.4% (secondary search summary of FDA/Apple documents; not verified against the PDF).
- UX: passive, no onboarding burden beyond a questionnaire; trend of nightly flags; shareable to doctor via Health (not verified for this feature).

### Samsung Galaxy Watch (and Ring)
- Signal: SpO2 (v1.0); multiple inputs in v2.0 (secondary). Two nights within 10 days, >4h each, adults 22+ without diagnosis. https://news.samsung.com/us/samsung-sleep-apnea-feature-galaxy-watch-first-its-kind-authorized-us-fda
- Claim: detect "signs of moderate to severe" OSA via "significant breathing disruptions"; not a substitute for clinician diagnosis (same URL; FDA summary https://www.accessdata.fda.gov/cdrh_docs/reviews/DEN230041.pdf).
- Regulatory: De Novo DEN230041; v2.0 510(k) K261011 reported 2026-07-20 (secondary, https://www.androidauthority.com/samsung-galaxy-ring-sleep-apnea-3690304/).
- Validation: N=620 PSG study; sensitivity 82.7% (167/202), specificity 87.7% (235/268), vs eAHI >= 15 (Samsung IFU https://images.samsung.com/samsung-health/ifu/IFU_SLEEP-APNEA_US.pdf).
- UX: explicit two-night protocol, user-initiated "on demand" run, three result levels for v2.0 (secondary).

### Withings Sleep Analyzer / Sleep Rx
- Signal: under-mattress pneumatic sensor (respiratory rate, movement, heart rate) plus sound for snoring. https://www.mobihealthnews.com/news/emea/french-firm-withings-launches-under-mattress-sleep-tracking-mat
- Claim: Sleep Rx cleared as aid for diagnosis of OSA in adults with suspected sleep breathing disorders. Regulatory: 510(k) announced 2024-09-09; K-number not verified. https://www.mobihealthnews.com/news/withings-sleep-rx-mat-receives-fda-510k-clearance ; prescription in the US (secondary).
- Validation: earlier Sleep Analyzer: 118 patients vs PSG, company-reported (https://mobihealthnews.com/node/148062).
- UX: results shareable with physicians via Health Mate (https://www.med-technews.com/news/withings-launches-sleep-apnoea-tracker-and-analyser/).

### SnoreLab
- Signal: phone microphone; Snore Score. Wellness app, not a medical device; disclaimer says not designed to diagnose or treat sleep apnea (App Store listing https://apps.apple.com/app/id529443604).
- Marketing says data can help in consultations. Validation: peer-reviewed 60-participant PSG study with Sleep Cycle and Anti Snore Solution; snore counts correlated with PSG (Dovepress link above). Note the authors' own "predicting OSA above moderate levels" language is exactly what SleepSmooth must not repeat.
- UX: clip playback and score history (from listing/secondary; details not verified).

### Sleep Cycle
- Signal: microphone ("Who's Snoring?" frequency and intensity; listen to recordings next morning). https://sleepcycle.com/the-app/sounds
- No apnea claim or doctor-sharing found (secondary search). Regulatory: wellness; not verified beyond that. Validation: included in the 2024 study above.

### Pillow
- Signal: Apple Watch/iPhone sensors and microphone; says on-device ML records snoring, "sleep apnea" and sleep-talking sounds (https://apps.apple.com/app/id878691772). Trends by week/month/year. Regulatory/validation: none found. Note the label "sleep apnea sounds" is a diagnosis-adjacent claim; avoid.

### ShutEye
- Sound detection of snoring and CBT-I coaching per a marketing blog only (https://animasmarketing.com/navigating-cutting-edge-sleep-tech-user-friendly-features-in-sleep-apps). Primary listing not verified.

### Wesper
- Signal: chest and abdominal patches plus pulse oximeter. 510(k) K221816 (date sources differ), intended to assist trained personnel in diagnosing OSA in adults; "does not issue any alarms". https://510k.innolitics.com/device/K221816 ; https://respiratory-therapy.com/products-treatment/industry-regulatory-news/fda-approvals/fda-clears-wireless-patch-home-sleep-test-by-wesper/ . Validation: not verified.

### Sunrise
- Signal: chin sensor (jaw movement); 2023 clearance; next-generation Sunrise Air cleared May 2026 adds airflow thermistors, SpO2/pulse, microphone for snoring. https://www.businesswire.com/news/home/20230213005361/en/Sunrise-Receives-FDA-Clearance-for-Its-At-home-Sleep-Apnea-Test ; https://www.businesswire.com/news/home/20260519001071/en/Sunrise-Receives-FDA-Clearance-for-Its-New-Rechargeable-At-Home-Sleep-Test-Marking-a-Major-Advancement-in-Home-Sleep-Testing-Technology . K-numbers and validation not verified.

### WatchPAT ONE
- Signal: peripheral arterial tone, oximetry, chest sensor with snoring and body position. 510(k) K183559, later K223675; "diagnostic aid" for sleep-related breathing disorders. https://fda.innolitics.com/device/K183559 . Disposable, app-paired, cloud analysis (https://wearable-technologies.com/2019/06/watchpat-one-a-fully-disposable-home-sleep-apnea-test-receives-fda-510k-clearance). Validation: not verified.

### Lofta (and similar HSAT services)
- Service wrapper around a cleared HSAT (WatchPAT One). Requires a telehealth review to approve the test; free retest offered. https://lofta.com/products/sleep-apnea-test . It says "FDA-approved" while such devices are normally "cleared" (my inference). A third-party "98% accuracy" claim is unsourced; ignore.

### Google/Fitbit
- No FDA-cleared sleep apnea feature found. Fitbit's older SpO2 view was an "Estimated Oxygen Variation" graph, not a diagnosis (https://www.fiercehealthcare.com/tech/fitbit-rolls-out-blood-oxygen-tracking-with-an-eye-toward-fda-clearance-for-sleep-apnea-diagnosis). 2025-2026 announcements: not verified.

### Oura
- Signal: ring-based breathing disturbance tracking; no clearance found. May 2026 Resmed partnership: on elevated disturbances, notify, suggest talking to a provider, link to assessment, doctor guide, telehealth. https://www.globenewswire.com/news-release/2026/05/19/3297582/0/en/Resmed-and-Oura.html . A claimed 339-participant estimated-AHI study was in one secondary article and is not verified.

### New 2025-2026 entrants
- Galaxy Ring (cleared, rollout pending), Sunrise Air (May 2026), Oura-Resmed (May 2026), Apple expansion to more countries (e.g., India per https://www.republicworld.com/tech/your-apple-watch-can-now-alert-you-to-sleep-apnoea-in-india-here-s-how-it-actually-works-2026-05-22-125312). Other entrants: not verified.

## Feature gap table

| Capability | Best in class | SleepSmooth today | Gap |
|---|---|---|---|
| Regulatory clearance | Apple/Samsung (OTC risk notification) | None, and correctly says so | Not closable; just state it |
| Published validation | Samsung IFU with counts; Apple white paper | None for own model (do not invent) | Show model card honestly and cite others' limits |
| Multi-night protocol | Samsung 2 nights/10 days; Apple 30-day trend | Nightly nights list | Need explicit "how many nights is useful" guidance |
| Clip review | SnoreLab, Sleep Cycle | Has flagged clips | Parity; add partner-labeled clips |
| Partner mode | Sleep Cycle "who's snoring" concept | Not present | Gap |
| Negative-result wording | Apple indications | Rule exists | Make visible in-product |
| Clinician report | Withings (share with physician), Oura doctor guide | Clinician summary | Check export (PDF/share sheet) |
| Test pathway nudge | Oura-Resmed, Lofta | Care-finding | Add HSAT explainer and telehealth handoff text |
| Questionnaire | Few apps | STOP-Bang-style | Advantage |
| Privacy/on-device | Pillow (claims on-device) | On-device, no backend | Advantage; make it a headline |
| Oximetry/SpO2 | Samsung, WatchPAT | Optional HealthKit read | Show HealthKit SpO2 if present, labeled |

## Safety and disclaimer copy patterns
- Apple: absence of notification "is not intended to indicate the absence of sleep apnea" (paraphrased from https://fda.innolitics.com/device/K240929; quote not verified verbatim from FDA document).
- Samsung: not to replace traditional diagnosis by a qualified clinician (https://news.samsung.com/us/samsung-sleep-apnea-feature-galaxy-watch-first-its-kind-authorized-us-fda).
- SnoreLab: "not a medical device" and not designed to diagnose or treat sleep apnea (App Store listing).
- Wesper: "does not issue any alarms" (device description, secondary).
- Oura: alert is a prompt to "consider talking to a healthcare provider" (paraphrase, https://ouraring.com/blog/resmed-partnership/).
- Pattern across all: verb is "assess risk", "detect signs", "suggestive of"; never "detect apnea". Negative results are never celebrated. Apple's own operating point favors specificity, so a quiet outcome is weak evidence.

## Impressive but risky for a hackathon
- Estimating AHI or severity from phone audio (breaks rule; unvalidated).
- Training a custom apnea-event model with a "validated" label.
- Live HealthKit apnea/SpO2 interpretation without clinical grounding.
- "Partner can hear you stop breathing" gap detection claims (observes silence, not airflow).
- Booking real sleep tests or e-prescription flows (regulatory and partner dependencies).
- Autopilot Shortcuts demo reliability on stage (iOS background limits).

## Ranked list of 10 changes (judge impact vs effort, 1-3 days)

1. **"What this cannot tell you" panel** with others' published miss rates (Apple about 66% sensitivity, Samsung 82.7%, secondary/IFU, cited) so a quiet night visibly cannot reassure. Effort low. Impact high. Safe.
2. **Clinician summary export as PDF/share sheet**, with questionnaire items, flagged clips count, coverage, limits, and "questions to ask". Effort low-med. Impact high. Safe.
3. **Test-pathway explainer** ("what is a home sleep apnea test", how telehealth services like Lofta work, in-lab vs home, no endorsement). Effort low. Impact high. Safe.
4. **Multi-night trend view** with coverage and "nights recorded vs suggested". Effort med. Impact med-high. Reframe: show clip counts and coverage, never a trend score or "improving".
5. **Partner mode**: second person tags clips ("I heard gasping/pauses") as user-reported by partner. Effort med. Impact high. Safe, labeled "Partner-reported".
6. **Visible model card and sample-data labels** on every result screen, with limitations and false-alarm rates of snore detection as measured on your own held-out data (only if measured; otherwise "not measured"). Effort low. Impact medium. Safe.
7. **Plain-language "if you have symptoms, see a clinician now" static guidance** grounded in cited guidance (e.g., AASM), no custom triage. Effort low. Impact medium. Safe.
8. **Pre-visit prep card**: top 3 observations to say aloud to a doctor. Effort low. Impact medium. Safe.
9. **Optional HealthKit SpO2/sleep read shown as raw readings** with a "readings alone can't confirm or exclude" note. Effort med. Impact medium. Reframe from "oxygen risk" to "your readings, unlabeled by severity".
10. **Risky: "severity" or "risk level" output.** Rank last on purpose. Breaks the no-diagnosis rule. Safe reframing: show "observations: N flagged clips, M% coverage, STOP-Bang items answered" and one sentence "These observations are a reason to discuss testing; they do not indicate severity."

Also mark in the ranking any idea that outputs a number: anything resembling AHI, "breathing events per hour", or a green/amber/red band breaks the rule; reframe to counts of clips with "snore-like sound" and coverage percentages.
