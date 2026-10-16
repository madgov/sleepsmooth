# App Store listing draft

DRAFT, not submitted. Wording follows `docs/REGULATORY_POSITION.md`: education, sleep-sound awareness, care navigation. The words "screen", "detect", "diagnose", "test for" and "monitor sleep apnea" are not used. Counsel should review before submission. Character limits are Apple's published limits as we know them (name 30, subtitle 30, keywords 100, promotional text 170, description 4000): **NOT VERIFIED** against the current App Store Connect form.

## 1. Metadata

| Field | Draft | Count |
|---|---|---|
| App name | SleepSmooth Overnight (TODO user: or "SleepSmooth" if the name is free in the store) | 21 |
| Subtitle | Sleep sounds, in plain words | 28 |
| Promotional text (can change without review) | Notice what the night sounded like, and bring a clear summary to your next appointment. Informational only. Not a diagnosis. | ~125 |
| Keywords | snore,sleep sounds,snoring,sleep,night,bedtime,sleep diary,tired,sleepy,sleep log,clinician | 91 |
| Support URL | `<SITE_BASE_URL>/support.html` | TODO user |
| Marketing URL | optional | TODO user |
| Privacy policy URL | `<SITE_BASE_URL>/privacy.html` | TODO user |
| Copyright | TODO user | |

Keywords deliberately omit disease names and "apnea": Apple may read them as a disease claim, and `REGULATORY_POSITION.md` advises against targeting the disease term.

## 2. Description

> **Understand your nights. Know what to ask.**
>
> SleepSmooth is an informational app for adults who snore, wake unrefreshed, or are told they sound different at night. It listens to the sounds in your room during the sleep hours you choose, shows you a plain summary of snore-like sounds, and helps you prepare for a conversation with a clinician.
>
> **What you can do**
> - Set your sleep hours and start a night. A Lock Screen and Dynamic Island indicator shows that recording is on and lets you stop it.
> - See a simple summary of each night: how much of the night could be checked, and where snore-like sounds were noticed.
> - Optionally save a few short clips each night to listen back. This is off by default.
> - Answer a short questionnaire and symptom checklist if you like. Everything is optional.
> - Read a plain-language guide to how sleep problems are usually looked into, with sources.
> - Prepare a summary and a list of questions to bring to an appointment.
> - Explore a clearly labelled sample night first, without recording anything.
>
> **What SleepSmooth is not**
> SleepSmooth is not a medical device. It does not diagnose, treat or monitor any condition, and it does not measure breathing or airflow. A quiet, normal-looking or unclear night cannot rule out sleep apnea or any other condition. Phone sound has limits that are explained in the app. If you are concerned about your sleep or symptoms, talk to a qualified healthcare professional.
>
> **Privacy**
> The app is designed to keep your information on your iPhone. There are no accounts. You can delete your data at any time in Settings. Recording picks up everyone in the room, so tell anyone you share a room with.
>
> **Please note**
> Microphone access is needed only for the sleep hours you set and only after you start a night. Overnight recording uses battery; plugging in is recommended.

Review notes: every sentence above is a statement the code supports except "designed to keep your information on your iPhone", which is hedged because the no-upload check is NOT VERIFIED on a device (`docs/PRIVACY_CHECKS.md` P4, P5). Do not remove "designed to" until `noUploadNoTrackingVerified` is true. "Optionally save a few short clips" matches `CLIP_TOGGLE_DETAIL` (up to 5 clips). "A questionnaire" does not name a disease. Do not add a claim of accuracy, "AI-powered detection", or any percentage.

## 3. Category: recommend **Health & Fitness** (primary); do not choose Medical
- Reason 1: the app describes sounds and helps prepare for a visit; it makes no diagnosis, measurement of a health parameter or treatment claim. "Medical" signals clinical use, invites the greater scrutiny described in guideline 1.4.1, and sets an expectation of clinical validation and, in the US, may be read as regulatory intent (see `REGULATORY_POSITION.md`).
- Reason 2: comparable sleep-sound and snore apps (SnoreLab, Sleep Cycle, Pillow) are in Health & Fitness (**Secondary source:** docs/research/02_COMMERCIAL_LANDSCAPE.md; not independently re-checked in the store).
- Secondary category (optional): Lifestyle. Avoid Medical as secondary too.
- The choice does not change what guideline 1.4.1 requires of the content.

## 4. Pricing and distribution notes
- Price/IAP: none planned. TODO user.
- Possible blocker (**NOT VERIFIED, needs counsel**): the bundled sound model was trained on ESC-50 clips licensed CC BY-NC 3.0 (`MODEL_CARD_LICENSE`). A store release may be "commercial". Resolve or retrain on permissively licensed data first.
- Possible blocker: NoSAS reuse terms unconfirmed (`docs/outreach/NOSAS_PERMISSION_EMAIL.md`). If unresolved, set `NOSAS_ENABLED=false`.

## 5. Age rating answers (draft; Apple's questionnaire changes, answer it as shown)
| Question | Draft answer | Why |
|---|---|---|
| Medical or treatment information | Infrequent/mild (the cautious choice) | The app discusses medical topics (how sleep problems are evaluated) but gives no treatment advice (it lists treatments that clinicians "may discuss", unranked, with sources) |
| Alcohol, tobacco, drugs references | None | The "discuss with a clinician" checklist mentions opioid medicine as a health history item, not as drug content. Mention in notes if asked |
| Violence, sexual content, profanity, horror, gambling, contests | None | |
| Unrestricted web access | No | Links open the system browser only (sources page, policy page) |
| User-generated content / chat | No | |
| In-app purchases | None | |
Expected result: the lowest rating tier or close to it. **NOT VERIFIED:** the rating is computed by App Store Connect. The app also says it is for adults; consider setting a higher age if counsel prefers (children are directed away in the app: `SCOPE_CHILDREN`).

## 6. Screenshot plan (6.9" and 6.5" iPhone sets required; produced by the user from a device or the simulator)
Every screenshot that shows data must show the sample night with its "Sample" label visible. Captions are overlay text; they use only safe wording.

| # | Screen | Caption | Must show |
|---|---|---|---|
| 1 | Intro / dashboard empty state with "Start tonight" | Notice your nights | No health claims; "Informational" |
| 2 | Sample night summary (coverage timeline) | See how much of the night could be checked | "Sample" chip |
| 3 | Night details with snore-like stretches | Snore-like sounds, described plainly | "Not a diagnosis" line; "Sample" |
| 4 | Clips list (sample clips) | Optionally listen back | Sample note |
| 5 | Clinician summary | Bring a clear summary to your visit | "Not a diagnosis"; "Sample" |
| 6 | Limits panel "What this cannot tell you" | Honest about what phones cannot show | Full panel |
| 7 | Settings > Privacy (Delete my data) | You stay in control | |
| 8 | Live Activity on Lock Screen | Stop any time from the Lock Screen | Recording state |

Do not use: a green check, a risk meter, a "score" headline, any mention of "detected", numbers implying accuracy, or the model-card ranges in marketing.
Capture the device screenshots after the other agents' UI changes land; none were produced in this pass.
