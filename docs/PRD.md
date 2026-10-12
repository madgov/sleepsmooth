# SleepSmooth PRD (authoritative; supplied by user 2026-10-10)

## Product summary
SleepSmooth is an AI-assisted sleep-health screening support and care-navigation app for people concerned about possible sleep apnea who have not yet been professionally evaluated.
The app helps users organize symptoms, review limited observations from optional overnight audio, understand uncertainty and missing evidence, and prepare a clinician-ready summary.
**Critical safety rule:** SleepSmooth does not diagnose sleep apnea, determine clinical severity, or rule out the condition. Audio observations are not confirmed respiratory events. A quiet recording or normal consumer wearable data must never be presented as proof that the user is fine.

## Product differentiator
Build an evidence-aware workflow that:
- Separates user-reported symptoms, acoustic observations, and optional wearable data.
- Clearly identifies missing, low-quality, inconclusive, or conflicting evidence.
- Avoids unsupported apnea probabilities and false reassurance.
- Generates an editable summary for a healthcare professional.
- Gives calm, practical guidance on seeking professional evaluation.
- Clearly labels synthetic sample data and any unvalidated analysis.
Do not claim that the idea is globally unique or clinically validated.

## Target users
People experiencing symptoms such as snoring, unrefreshing sleep, or daytime sleepiness who want to organize their concerns and understand sensible next steps. Includes people who sleep alone and lack a bed partner to observe nighttime symptoms.

## Required MVP flow
1. Welcome screen explaining the app's purpose and limitations.
2. Symptom questionnaire with reviewable and editable answers.
3. Optional audio input or clearly labeled sample-data demo.
4. Input validation and only genuinely supported audio analysis.
5. Results page separating evidence by source and explaining uncertainty.
6. Editable clinician-ready summary.
7. Next-step checklist for discussing concerns with a healthcare professional.

## P0 requirements
- Visible medical limitations before data collection.
- Symptom questionnaire with documented scoring if a validated instrument is used.
- Audio validation and useful error states.
- No fabricated analysis presented as real results.
- Explicit missing-data and inconclusive states.
- No "all clear" result based on normal audio or wearable signals.
- Summary distinguishes self-reported information from app-generated observations.
- Responsive, accessible UI with loading, empty, error, and completion states.
- Privacy-conscious handling of recordings and user data.

## Later priorities (only after core flow works)
- Multi-night timeline. Optional wearable-data entry. Report export. Follow-up checklist and reminders. Future clinical validation and secure health-data integrations.

## Suggested architecture
Reusable frontend components, typed evidence records, a questionnaire module, an audio-analysis module that only exposes supported outputs, a deterministic report generator, and minimal persistence. Sample cases must be labeled synthetic or illustrative.

## Demo scenario
Explicitly labeled illustrative case: user reports persistent daytime sleepiness, but the recording produces few notable acoustic observations or an inconclusive result. Explain why this does not rule out sleep apnea, identify missing information, generate the clinician-ready summary, and show next steps. Do not imply the demo establishes clinical accuracy.

## Success criteria
- A first-time user can finish the end-to-end flow.
- The report is generated correctly from entered information.
- Users can distinguish self-reported symptoms from app-observed information.
- Users understand the product is not diagnostic and a normal recording cannot rule out apnea.
- Valid and invalid inputs are handled reliably.

## Build order
1. Questionnaire-to-summary flow. 2. Evidence labels and uncertainty states. 3. Genuine audio-analysis slice if feasible, otherwise a labeled demo. 4. Polished results and report. 5. Validation and error states. 6. Optional features only after the core flow works.

## Technology stack
Vite + React + TypeScript (repo is empty, so this is the stack).
- Styling: lightweight, consistent option.
- Audio input: Browser File API and Web Audio API for loading, decoding, basic signal inspection.
- Audio analysis: only measurable acoustic features that can be explained and tested. Do not treat simple sound analysis as apnea detection. If no validated model or suitable dataset is available, use an explicitly labeled sample-data demo.
- Charts: lightweight library only if it improves the evidence timeline.
- Persistence: minimal; minimize sensitive data storage; no backend unless required.
- Reports: structured, editable summary first; PDF export if time permits.

## Implementation instructions
Build one complete, polished vertical slice before optional features. Prioritize calm, trustworthy interface, mobile responsiveness, accessible controls, source-labeled evidence, uncertainty explanations, useful error states. Do not fabricate model outputs, clinical validation, accuracy statistics, or medical conclusions. Make explicit the distinction between a functional prototype and clinically validated software.
