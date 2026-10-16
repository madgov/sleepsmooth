# Regulatory position: SleepSmooth wording and FDA device risk

**Not legal advice. This needs regulatory counsel (a US FDA digital-health lawyer or consultant) before any public launch.** It is an engineering team's reading of public FDA guidance, written to choose safer wording. It does not decide whether SleepSmooth is or is not a device.

Date of research: 2026-10-15. Status of every statement below is marked **Verified in the guidance text**, **Secondary source** or **NOT VERIFIED**.

## 1. What FDA guidance says (with citations)

### 1.1 Policy for Device Software Functions and Mobile Medical Applications (final, September 2022, docket FDA-2011-D-0530)
URL: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/policy-device-software-functions-and-mobile-medical-applications (PDF: https://www.fda.gov/media/80958/download). Read from the PDF text on 2026-10-15. **Verified in the guidance text.**

- FDA focuses oversight on software that meets the device definition and whose failure could harm patient safety. The deciding factor is **intended use**, shown by labeling, advertising and what the company says and does.
- **Appendix C (software functions that are the focus of FDA oversight)** lists, among others: "Software functions that use a sensor ... attached to the mobile platform or tools within the mobile platform itself (e.g., accelerometer, microphone) to measure physiological parameters ... during sleep and are intended for use in diagnosis of specific diseases or conditions such as sleep apnea." It also names, in the "transform the mobile platform into a regulated medical device" list, "a software function that uses the built-in accelerometer on a mobile platform to collect motion information for monitoring sleep apnea."
- **Appendix A (not medical devices)** includes software that helps "healthy people track the quantity or quality of their normal sleep patterns," and general wellness and lifestyle logging functions.
- **Appendix B (enforcement discretion)** includes, among others, software that uses "a checklist of common signs and symptoms to provide a list of possible medical conditions and advice on when to consult a health care professional," software that "guide[s] a user through a questionnaire of signs and symptoms to provide a recommendation for the type of health care facility most appropriate," and software that helps patients communicate with providers. FDA says some functions in Appendix B "may" meet the device definition but it does not intend to enforce requirements.
- Takeaway: the sleep-apnea example is the closest match to SleepSmooth. It is a device example when the **intended use is diagnosis** of sleep apnea. Questionnaire and symptom-checklist care navigation sits nearer the enforcement-discretion list. A microphone sound summary framed as sleep-sound awareness sits nearer the wellness list. Counsel must confirm how these map to SleepSmooth.

### 1.2 General Wellness: Policy for Low Risk Devices (final, revised January 2026, docket FDA-2014-N-1039)
URL: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices. The FDA landing page was read on 2026-10-15; the full text was **not** retrieved.

- **Verified (landing page):** the guidance explains CDRH's compliance policy for low-risk products that promote a healthy lifestyle; section 3060(a) of the 21st Century Cures Act (enacted 13 December 2016) removed software "for maintaining or encouraging a healthy lifestyle" and "unrelated to the diagnosis, cure, mitigation, prevention, or treatment of a disease or condition" from the device definition.
- **Secondary source (law-firm commentary, not the FDA text):** the 6 January 2026 revision was issued without draft or comment, and mainly addresses non-invasive wearables that estimate physiologic parameters; commentators say whether such a product is a general wellness product depends on how it is advertised and promoted, not only on whether its output is "inherently associated" with a disease. Sources: https://www.ropesgray.com/en/insights/alerts/2026/01/fda-adapts-with-the-times-on-digital-health-updated-guidances-on-general-wellness-products ; https://www.cov.com/en/news-and-insights/insights/2026/01/fda-issues-revised-guidance-on-general-wellness-products ; https://www.loeb.com/en/insights/passle/2026/01/fda-updates-its-general-wellness-device-frameworkwhat-companies-need-to-know
- **NOT VERIFIED (from the earlier 2019 version, not re-read in the 2026 text):** the policy has two categories: (1) products with an intended use relating only to general wellness (a general state of health) that are low risk, and (2) products whose intended use relates a healthy lifestyle to reducing the risk or impact of certain chronic diseases where that association is well understood. A claim to detect, diagnose, screen for or treat a specific disease puts a product outside the wellness policy. Counsel must confirm this against the January 2026 text.

### 1.3 Other sources already in the repo
- Apple (K240929) and Samsung (DEN230041) obtained clearance/authorization only as notifications of possible moderate-to-severe OSA, with no-alert-is-not-reassurance language (docs/research/00_SYNTHESIS.md, 02_COMMERCIAL_LANDSCAPE.md). That is evidence that **disease-specific microphone/sensor claims are regulated product territory**.
- Competing sleep-sound apps (SnoreLab, Sleep Cycle, Pillow, ShutEye) are positioned as wellness (02_COMMERCIAL_LANDSCAPE.md; **Secondary source**, not independently checked here).

## 2. Assessment of the current wording

| Where the wording appeared | Risk | Why |
|---|---|---|
| "Screening for possible sleep apnea", "screening questions", "Your screening questions" (claims.ts, onboarding, Questionnaire page, Checks tab) | **Higher** | Reads as a function intended to screen for a specific disease. Screening is a recognised clinical function. |
| "detects", "detection" of sleep apnea | **Higher** | Disease detection claim. Already forbidden by the repo's own tests, except in a disclaimer. |
| "NoSAS ... is a screening score" | **Lower, if attributed** | It is how the instrument's authors describe it (paper title). Accurate attribution is fine; the app must not adopt it as its own claim ("we screen you"). |
| Snore-like sound summary | **Lower** | Describes sound, not breathing or disease. Careful with the word "snore" in a clinical context; keep "sound pattern" framing. |
| "Worth discussing with a clinician" headline | **Medium** | A recommendation to seek care is care navigation, close to Appendix B examples, but the trigger is a questionnaire cutoff. Keep it tied to "what you shared" and never to a disease probability. |
| "Cannot rule out sleep apnea" | **Low** | A limitation. Safe and required by CLAUDE.md. Do not remove. |
| Bed-partner reports of "pauses in breathing" | **Medium** | User-reported, unscored, labelled. Keep the labelling. |
| ESC-50 model card, "not a medical device" | **Low** | Disclaimer only. Stating "not a medical device" is not itself protective; intended use is judged by what the product does and says. |

Features that would raise the risk and are **not built** (keep it that way): AHI or events-per-hour, severity bands, risk scores, probability, "apnea detected", reassurance (green indicator), treatment or CPAP advice. See docs/research/00_SYNTHESIS.md "Do not build".

## 3. Recommended positioning

Lead with **three things SleepSmooth does**, none of which names a disease as the thing it finds:
1. **Education**: plain-language information on how sleep apnea is usually evaluated (pathway guide, sources).
2. **Sleep-sound awareness**: summarises sounds the phone heard (snore-like sound patterns, quiet and loud stretches) with the limits shown.
3. **Care navigation**: helps the user organise what they noticed into a summary and questions to bring to a clinician.

Words to prefer: "sleep sounds", "snore-like sounds", "what you reported", "questionnaire score", "worth discussing with a clinician", "prepare for an appointment", "informational".
Words to avoid in app copy, store listing and marketing: "screen for", "detect", "diagnose", "test for", "sleep apnea checker", "your risk of", "monitor your apnea", "AI sleep apnea".

When naming the disease, name it as the topic of the clinician conversation, always with the limit ("cannot confirm or rule out sleep apnea").

## 4. Wording changes applied (this pass)
Small edits to existing strings, safety disclaimers untouched:
- `src/content/claims.ts`: "screening questions" to "questions"; "This screening cannot rule out" to "These results cannot rule out" (and the "not enough information" variant); "screening answers" to "questionnaire answers"; "NoSAS screening questions" to "NoSAS questions"; "Screening score (NoSAS)" to "Questionnaire score (NoSAS)"; sources intro now says "the questionnaire score".
- Titles "NoSAS screening score" to "NoSAS questionnaire score" in the instrument, evidence engine, Sources page, Checks tab, onboarding card and web Info view; "Your screening questions" to "Your questions" on the web.
- Kept, on purpose: the NoSAS paper title and the sentence "NoSAS ... is a screening score. It is not a diagnosis." These attribute the word to the authors and carry the not-a-diagnosis statement.
- New forbidden-phrase tests (`src/content/forbiddenPhrases.test.ts`): screen for sleep apnea, detect sleep apnea (allowed only in the claims.ts model-card disclaimer "Not for: detecting sleep apnea"), test or check for sleep apnea, at risk of sleep apnea.

Remaining items for counsel: the headline "Based on what you shared, this is worth discussing with a clinician" (derived from the NoSAS cutoff and symptom rule); the "red flag" drowsy-driving text; the file names and docs that still say "screening" (internal only).

## 5. Open questions for counsel
1. Does the combination of a NoSAS cutoff, a symptom rule and a "worth discussing" headline amount to a function intended to screen for or aid diagnosis of sleep apnea, or is it within the Appendix B questionnaire/care-navigation examples?
2. Does a microphone-based "snore-like sound" summary with no breathing claims remain within general wellness if the user is a person worried about sleep apnea?
3. How do the January 2026 general wellness revisions apply to a microphone app (the commentary focuses on wearables)?
4. Is the "not a medical device" disclaimer helpful, neutral or harmful to the intended-use analysis?
5. State law (consumer health data laws such as Washington's My Health My Data Act) and, if distributed outside the US, EU/UK software-as-medical-device rules. **NOT VERIFIED and not researched here.**
6. The sound model was trained on ESC-50 clips licensed CC BY-NC 3.0 (claims.ts `MODEL_CARD_LICENSE`). A non-commercial dataset licence can conflict with commercial distribution, including a free app with a business purpose. Counsel should review before any App Store release.

## 6. What this document does not say
It does not say SleepSmooth is exempt from FDA oversight. It says only that the less disease-specific the claims, the further the product sits from the examples FDA lists as device functions, and that FDA decides on **intended use** across all statements, including the App Store page, website and marketing.
