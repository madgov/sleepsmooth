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
