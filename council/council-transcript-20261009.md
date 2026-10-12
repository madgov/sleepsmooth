# LLM Council Transcript

Generated 2026-10-09

## Framed question

> FRAMED QUESTION
> 
> A student/solo builder is entering a health hackathon (theme: "Diagnosing sleep apnea and helping smooth it over"). Judging criteria: (1) Idea & Innovation: real problem within theme, innovative, meaningfully different from existing; (2) Implementation: does it work, technically impressive; (3) Health Impact & Rigor: who is it for, would it help, potential; (4) Design & Usability; (5) Presentation: clear problem, demo shows the thing actually working, honesty about finished vs planned. Prizes: 1st/2nd/3rd place credit bundles, plus a special prize "Best No-code AI App built with Momen" ($2000 credits). Workspace is empty; nothing built yet.
> 
> Research finding: the original idea ("AI detects sleep apnea from audio") already has many direct competitors: SnoreLab (snore recording, BreathFlow), Apple Watch sleep apnea notifications (30-day review, doctor export), Sleep Cycle, ResMed myAir (CPAP users), TranSleep AI, Sleep Recorder: Snore Tracker, SLEEP by Cleveland Clinic (risk screening, route to sleep-center appointments), SnoreCare (on-device analysis, 18-question risk assessment, AI coach). Listings show what is advertised, not clinical accuracy. A systematic review found only 8 of 41 digital sleep-apnea screening/diagnosis studies had external validation.
> 
> Proposed pivot: "SleepSmooth: Don't Just Track. Know What to Do Next." A screening evidence engine that prevents false reassurance and gets users evaluated, with audio as just one input:
> 1. Collect validated screening questionnaire + symptom history.
> 2. Analyze a sample/real overnight recording for audible patterns with quality checks.
> 3. Compare with optional wearable data.
> 4. Identify missing/conflicting evidence without claiming to diagnose.
> 5. Generate clinician-ready summary and concrete plan to seek evaluation.
> Demo moment: user whose recording sounds normal but whose symptoms warrant assessment; app explains why a normal-sounding recording cannot rule out apnea and helps them prepare for a clinical evaluation. Differentiator candidates: cross-checking conflicting evidence, diagnosis-navigation workflow, uncertainty engine ("inconclusive" instead of false score), multimodal validation, privacy-first. Author acknowledges it is not guaranteed unique and should not claim to have invented AI apnea detection.
> 
> DECISION: Is this pivot the right strategy to win the hackathon (and be genuinely useful)? What should be built, what should be cut, and how should it be demoed? Stakes: hackathon placement and credibility of a health claim; short build time.

## Anonymization map

A = Executor, B = Contrarian, C = Expansionist, D = First Principles Thinker, E = Outsider

## Advisor responses (anonymized labels)

**Response A:**
Take the pivot, but cut it to what you can ship and demo in one working sitting. Five modules is a plan. You need one thing that runs.

First, a stack warning. The "Best No-code AI App built with Momen" prize is $2000, which is likely worth more than a placement bundle. Build in Momen, and that prize is a second shot on the same project. Its AI-agent and workflow blocks are enough, because the "engine" is rules plus an LLM summary. It does not need custom ML.

Monday morning, in order:
1. Create the Momen project. Build a form with the STOP-Bang questionnaire (8 yes/no items, published and validated) plus a few symptom fields. Score it with a plain rules workflow. About 2 hours.
2. Skip real audio analysis. Offer 3 pre-baked sample "nights" (normal-sounding, snoring, quiet and ambiguous), each with a hand-written quality flag and pattern summary. Say in the demo that these are samples. Faking live detection will cost you Rigor and Honesty. Do not add a real audio ML model.
3. Write the conflict logic as an if/else table: questionnaire high + audio normal = "Inconclusive, audio cannot rule this out, get evaluated". That is your demo moment, about 20 lines of rules.
4. Add one LLM call that generates the clinician-ready summary and a concrete "next steps" checklist (book a PCP or sleep study, what to bring, what to say). Constrain the prompt to never say "diagnosis" or "you have/don't have". Output as a printable page.
5. Cut the wearable integration completely. Show it only as a "planned" slide. Cut accounts and storage. Privacy-first means you store nothing.

Demo script, 3 minutes: the problem (a normal-sounding night gives false reassurance), run the contradicting persona live, show the "inconclusive" result and the clinician handoff, then a finished-versus-planned slide.

Weak point: nothing here is technically impressive. Win on honesty and Health Impact, not on Implementation. If you cannot finish step 1 and step 3 by end of day one, the project has no clear first step.

**Response B:**
The pivot is better than the original idea, but as framed it will likely lose, and the health claim is the part most likely to hurt you.

1. "Prevents false reassurance" is a clinical claim you can't back. Your demo case is a recording that sounds normal while symptoms say otherwise. That is only a conclusion someone wrote into the data. You have no validation data and no ground truth, and you can't show the engine does this on anyone but your scripted persona. Judges scoring Health Impact & Rigor will see a rules engine over a questionnaire. STOP-BANG and Berlin already do that, and so does the Cleveland Clinic SLEEP app, which also routes users to appointments. Your differentiator is mostly a checklist with a nice summary page.

2. The audio analysis will be the weakest part. In a short build, "audible pattern detection with quality checks" means a snore-detection heuristic or an off-the-shelf model on a sample file. Judges will ask for sensitivity and specificity, and you will have none. The 8-of-41 external validation statistic cuts against you: you are adding one more unvalidated tool.

3. Five features is too many for a short window. Wearable comparison is the first to fail, because without real device data it is fake. Fake integrations will damage your credibility on "honesty about finished vs planned."

4. The clinician summary risks looking like a PDF generator with a disclaimer.

What I'd build:
- One flow: questionnaire, then a recording, then an "inconclusive, here is why, here is what to do" output.
- Real, honestly labeled limits. State that a normal-sounding recording cannot exclude apnea and that the tool does not diagnose.
- Cut the wearable data entirely.
- Use no-code (Momen) for the Momen prize. That is a cheaper bet than placing in the top three.

Demo it live with a real uploaded recording rather than a fake dashboard, and say plainly what is a stub.

**Response C:**
The pivot is right, but it is still too small. Do not pitch a better apnea app. Pitch the missing layer of a whole category: the Evidence Engine for undiagnosed sleep apnea. Roughly 80% of apnea cases go undiagnosed, and the core failure is false reassurance and dropped follow-through, not detection. Every competitor (SnoreLab, Apple Watch, myAir) produces a score. Nobody produces a defensible "inconclusive, and here is why." That uncertainty engine is your moat, so build it as a reusable, source-agnostic evidence-reconciliation layer. Audio, questionnaire, and wearable are plug-in sources. The pitch becomes: any device, including future Apple Watch exports, SnoreLab logs, and home sleep tests, can feed this layer.

Upside nobody is seeing:
1. The clinician-ready summary is the most valuable artifact. Make it a one-page PDF with a conflict matrix, STOP-BANG score, and the exact questions to ask. Pitch it as a referral accelerator for primary care and sleep centers, a B2B2C angle that lifts Health Impact.
2. Add a "why a normal recording cannot rule out apnea" explainer (positional, REM-dependent, mouth-breathing, upper-airway resistance, partner-less sleepers). A shareable educational asset that doubles as marketing.
3. Add an outcome loop: a follow-up nudge at 2 weeks asking "did you book the appointment?" Measure navigation completion, not detection accuracy. A metric nobody else claims.
4. The adjacent wedge is the CPAP-adherence and "smooth it over" half of the theme. A diagnosed user's same engine can flag mask-leak and residual-event conflicts for their clinician. Show it as a roadmap slide only.

Momen prize: build the whole thing no-code (forms, scoring logic, LLM summary) and call it out explicitly. That wins the $2000 special prize and frees time for demo polish.

Demo: three personas, one conflict each, ending with the PDF and the appointment-prep checklist. Be openly honest that audio is simulated.

**Response D:**
You're asking the wrong question. "Is this pivot the right strategy?" assumes the contest is about differentiation. The real question is: what single claim can you prove, live, in 3 minutes, that a judge would believe?

Strip it down. The theme is "diagnosing sleep apnea and smoothing it over." The hard fact in your research is that 33 of 41 digital apnea tools were never externally validated. The market's actual failure isn't missing detection. It's confident outputs with no evidence behind them. Your pivot spots this, but then bolts on five features to address it. That is the trap.

Don't claim "evidence engine." That is a category, not a demo. Claim one falsifiable behavior: the app refuses to output a score when evidence is insufficient or conflicting, and says exactly why. Everything else is scaffolding.

Build: (1) STOP-BANG questionnaire, a real validated instrument, scored correctly. (2) One audio sample with a quality gate (noise, duration, snore-like energy), reported honestly as "audible pattern present/absent/unusable." (3) A rule layer, not a model, that produces three states: concerning, inconclusive, or no flag, with the conflict shown. (4) A one-page clinician summary.

Cut: wearable integration (unless a mock file import, labeled as such), any accuracy claims, any "AI diagnoses" language. Audio-based AHI estimation is unvalidatable in your timeframe. Don't touch it.

Demo: two personas side by side. Quiet recording plus STOP-BANG 6 produces "Can't rule out. Here's why. Here's your summary." Loud snoring plus low risk produces a different, equally honest result. Then state plainly: "Rules are deterministic. Nothing here is validated. Here's what validation would require." That honesty line scores on Presentation and Rigor simultaneously.

For the Momen prize, build the questionnaire, rule flow, and summary in Momen and keep audio analysis as a thin external call.

**Response E:**
Reading this cold, I can't tell what SleepSmooth is. A judge skimming will have the same problem. "Screening evidence engine," "multimodal validation," "uncertainty engine" and "diagnosis-navigation workflow" are builder jargon. The framed question never says who the user is. Pick one person and name them, for example: "Dana snores, is exhausted every day, and has never been tested."

Here is the plain version a judge would want: "An app that tells you whether you should see a sleep doctor, and hands you a one-page summary to bring." That is understandable and useful. The audio analysis is the least interesting part. Lead with the outcome (a person gets tested), not the pipeline.

The curse-of-knowledge risk is the demo moment. "A normal-sounding recording can't rule out apnea" is obvious to you after the research. A lay judge may hear "your app told me nothing" or "so why did I record?" Show the surprise visibly: a green "sounds normal" next to a red "but your symptoms say get checked," in 10 seconds, without explanation.

"Inconclusive instead of a score" will feel to some judges like the app refuses to answer. Reframe it as the app protecting you from a false all-clear.

Cut anything a stranger can't see working in 2 minutes: wearable integration, privacy-first claims you can't demo, long competitor comparisons.

Build one clean flow: a few questionnaire questions, a pre-recorded sample, a result, and a printable summary. Say aloud what is real and what is mock. Judges reward that honesty, and the criteria ask for it.

Verdict: the pivot is right, but only if you can explain it in one sentence to your grandmother.

## Peer reviews

**Reviewer 1 (general):** Strongest D (one falsifiable demoable behavior, honesty line). Blind spot C (scope expansion, unsourced "80% undiagnosed"). Missed: safety of "no flag" and urgent-symptom escape, real test data, regulatory framing, user testing, Momen feasibility check, "smoothing it over", demo fallback.

**Reviewer 2 (skeptical judge):** Strongest D, A close second. Blind spot C (scope inflation, unsourced stat). Missed: red-flag safety, which STOP-BANG items need measurements, judge skepticism of hand-written samples (use public labeled audio or the judge's voice), 60-second backup video, treatment half of theme, 3-person user check.

**Reviewer 3 (clinician):** Strongest D, A close. Blind spot C (platform pitch, unsourced stat, CPAP claim). Missed: safety-net red flags and "no flag" needing a "does not rule out" label, STOP-Bang validation limits (moderate specificity, women), synthetic-data labeling, disclaimers/SaMD, home test vs polysomnography guidance, access/equity, LLM hallucination testing, persona bias.

**Reviewer 4 (product/UX):** Strongest D (two-direction demo). Blind spot C (scope, unsourced stat, "any device" unbuilt). Missed: high-stakes edge-case UX (drowsy driving, no doctor access), judges testing with their own input and unusable-audio behavior, first 10 seconds of pitch and Momen story, STOP-Bang self-reported measurements and population mismatch.

**Reviewer 5 (competition strategy):** Strongest D, A best runnable plan. Blind spot C. Missed: Implementation is scored and nobody proposes a cheap real technical differentiator (browser-side audio feature extraction with visible quality gate), "Diagnosing" half of theme, safety/escalation, showing the Momen workflow in demo, backup demo video, clinician sanity check.

# COUNCIL VERDICT (Chairman)

## Where the Council Agrees
- **Take the pivot, but shrink it.** All five say the "evidence engine" idea beats "AI detects apnea", and all five say five modules is too many for a short build.
- **Cut the wearable integration.** Every advisor that addressed it says it is fake without real device data, and fake integrations cost you on the "honest about finished vs planned" criterion. Show it only as a roadmap slide.
- **The demo is the contradiction case.** Quiet/normal-sounding recording plus a high-risk questionnaire produces "can't rule out, here's why, here's your summary".
- **Honesty is the scoring weapon.** Say aloud what is real, what is a sample and what is unvalidated. The criteria reward this under Presentation and Rigor.
- **Build the core in Momen.** The $2000 special prize is a second shot on the same project, and the core (form, rules, LLM summary) fits no-code.
- **Never say "diagnosis" and make no accuracy claims.**

## Where the Council Clashes
- **How real should the audio be?** The Executor and Expansionist say use pre-baked sample nights and label them as samples. The Contrarian wants a live demo with a real uploaded recording. First Principles wants a real quality gate (noise, duration, snore-like energy). Pre-baked is fast and honest but looks scripted; real is more credible but riskier to build. The peer reviewers added that judges may upload their own audio, so the quality gate must handle unusable audio gracefully.
- **Scope ambition.** The Expansionist wants a platform ("any device feeds it"), a B2B2C referral angle and a 2-week outcome loop. Everyone else says that is scope creep. Reviewers unanimously called it the biggest blind spot, and its "80% undiagnosed" figure is unsourced.
- **Is it a real contribution or a checklist?** The Contrarian says STOP-BANG scoring plus a summary page is a rules engine over a questionnaire that Cleveland Clinic's app already approximates. The others say the refusal-to-score behavior is the differentiator. Both are partly right: it is modest on Implementation, so the project wins on Health Impact, Presentation and honesty, not technical depth.

## Blind Spots the Council Caught
Raised in peer review, missed by all five advisors:
1. **Safety escalation.** Red flags (drowsy driving, gasping/choking, witnessed apneas) must trigger urgent-care language, never a calm "inconclusive". The "no flag" state is itself a false-reassurance risk and needs a "does not rule out" label.
2. **STOP-Bang limits.** Needs measured BMI, neck size and blood pressure (will be self-reported), has moderate specificity and is less accurate in women. Cite cutoffs and define how missing items are handled.
3. **Judges will test it.** Someone may upload their own audio or take the questionnaire. Define behavior for unusable audio and don't hardcode outcomes.
4. **Demo resilience.** Record a 60-second backup video, and verify early that Momen supports file upload, LLM calls and printable output.
5. **Show Momen in the demo** (flash the workflow), since the special prize is judged on the no-code build.
6. **LLM guardrails.** A prompt constraint is not enough; test the clinician summary for hallucinated claims.
7. **Label synthetic data** and add medical/wellness disclaimers. Do not use real patient data.
8. **"Diagnosing" and "smoothing it over".** The theme has two halves. A compact "what test next (home sleep test vs lab)" step and a one-line treatment-adherence roadmap slide cover both without scope creep.
9. **Quick credibility check.** A 3-person usability test or a clinician sanity check, even informal.

## The Recommendation
Pivot to SleepSmooth, but pitch and build exactly one falsifiable behavior: **the app refuses to give a reassuring score when evidence is thin or conflicting, and tells you exactly why.**

Build in Momen:
1. Real STOP-Bang (8 items) plus a few symptom and red-flag fields, scored by a deterministic rules workflow.
2. One audio input with a real quality gate, reported as "pattern present / absent / unusable". Offer 2-3 labeled sample nights as a fallback, and let a judge upload their own.
3. A three-state rule layer: concerning, inconclusive, no flag (always labeled "does not rule out apnea"), with the conflict shown. Red flags override to urgent.
4. An LLM-written one-page clinician summary and next-steps checklist (what to bring, home sleep test vs lab), constrained against diagnostic language.

Cut: wearables, accounts and storage, the platform and B2B story, outcome loop (all go on a "planned" slide with CPAP adherence). Pitch it to one named person ("Dana snores, is exhausted, never tested") in one sentence: *an app that tells you whether to see a sleep doctor and hands you the page to bring.* Frame "inconclusive" as protecting you from a false all-clear. Close with: "Rules are deterministic. Nothing here is validated. Here is what validation would take."

Expect to win on Presentation, Health Impact and the Momen prize rather than Implementation. That is the realistic route.

## The One Thing to Do First
Create the Momen project and, in the first sitting, get the STOP-Bang form scoring correctly plus the single contradiction rule ("high risk + normal-sounding audio = inconclusive, get evaluated") producing its result screen. In the same hour, confirm Momen can handle audio upload, an LLM call and a printable page.
