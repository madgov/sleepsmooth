# CLAUDE.md — SleepSmooth

## Project Overview
SleepSmooth is a hackathon project exploring how an AI-assisted product can help people recognize possible signs of obstructive sleep apnea and navigate appropriate professional evaluation.

The core product concept is an evidence-aware screening and care-navigation experience. It is not a medical diagnostic tool. The central differentiator is helping users understand what available evidence does and does not show, avoiding false reassurance when signals conflict or are incomplete, and helping users take a sensible next step.

## Product Principles
1. **Never claim to diagnose sleep apnea.** Consumer audio, questionnaires, and wearable data cannot independently establish a clinical diagnosis.
2. **Avoid false reassurance.** A quiet recording, normal-looking wearable reading, or low screening score must not be presented as proof that the user does not have sleep apnea.
3. **Show evidence and uncertainty.** Distinguish user-reported symptoms, detected acoustic observations, wearable readings, and generated guidance.
4. **Be honest about implementation.** Clearly label demo/sample data. Never imply a model or integration works if it is mocked.
5. **Prefer a complete user journey over feature sprawl.** Screening → evidence review → clinician-ready summary → next-step guidance.
6. **Protect sensitive data.** Collect only what is necessary, explain why it is needed, and provide clear deletion and consent controls.
7. **Accessible, calm UX.** Use plain language, readable visualizations, clear hierarchy, keyboard-friendly controls, and mobile-first layouts.

## Target User
People who are concerned about possible sleep apnea, including those experiencing snoring, unrefreshing sleep, daytime sleepiness, or symptoms noticed by another person, but who have not yet received a professional evaluation.

## Core User Journey
1. User sees a clear explanation of what SleepSmooth can and cannot do.
2. User completes a brief evidence-based screening questionnaire and symptom history.
3. User optionally provides a supported recording or sample recording for acoustic analysis.
4. App displays observations, data quality, missing information, and uncertainty.
5. App explains that the findings are not a diagnosis and cannot rule out sleep apnea.
6. App creates a concise summary the user can discuss with a qualified clinician.
7. App provides general guidance on seeking professional evaluation and optionally tracks follow-through.

## MVP Priorities
### P0 — Required
- Landing / safety explanation.
- Symptom and screening questionnaire, with source and scoring logic documented.
- Audio upload or a clearly labeled sample-recording demo.
- Real or explicitly labeled prototype acoustic analysis; never fabricate model results.
- Results view that separates reported symptoms from audio observations.
- Uncertainty and recording-quality states, including “inconclusive.”
- Clinician-ready report or summary.
- Clear next steps and medical disclaimer.
- Responsive, polished interface.
- Demo mode that identifies all synthetic/sample data.

### P1 — If time allows
- Multi-night comparison.
- Optional import or manual entry of wearable metrics.
- Follow-up checklist and reminders.
- Exportable report.
- Privacy controls and data deletion.

### Out of Scope for Hackathon MVP
- Claiming a definitive diagnosis or apnea severity from phone audio.
- Recommending, prescribing, or changing CPAP settings or medication.
- Replacing a clinician or sleep study.
- Claims of clinical accuracy without suitable validation.
- Silent collection or sharing of raw audio or health information.

## Health Safety Requirements
- State clearly that SleepSmooth is informational and is not a diagnosis.
- Explain that audio analysis detects acoustic patterns only; it does not directly measure airflow or confirm apnea events.
- A normal or inconclusive recording must never be interpreted as ruling out sleep apnea.
- Encourage users with concerning symptoms to seek evaluation from a qualified healthcare professional.
- Do not invent medical facts, risk scores, sensitivity, specificity, or validation results.
- If a screening questionnaire is used, preserve its intended wording and scoring rules, cite its source in the product, and do not represent it as diagnostic.
- Do not create urgent-care triage rules unless grounded in authoritative clinical guidance.
- Treat health and audio data as sensitive. Avoid storing raw recordings by default where feasible.

## Implementation Guidance
- Inspect the existing repository and follow its current framework, package manager, linting, and code conventions before making changes.
- Keep UI components small and reusable.
- Separate data collection, analysis, interpretation, and presentation.
- Use typed schemas for questionnaire answers, audio-analysis outputs, source labels, and uncertainty states.
- Make mock data unmistakable in the interface and code.
- Handle empty, invalid, unsupported, noisy, and incomplete inputs gracefully.
- Include loading, error, empty, and success states.
- Avoid unnecessary dependencies and do not add secrets or API keys to source control.
- Never state that an integration is connected unless it is actually connected and tested.

## Suggested Data Model
- `ScreeningResponse`: questionnaire identifier/version, answers, completion timestamp.
- `SymptomEntry`: symptom, frequency, duration, user-reported source, timestamp.
- `AudioAnalysis`: input identifier, processing status, quality indicators, detected acoustic observations, model/version, limitations.
- `WearableObservation`: metric, value, unit, source/device, timestamp, user-entered vs imported.
- `EvidenceSummary`: evidence items, missing items, conflicting items, uncertainty notes.
- `CareSummary`: user-reported concerns, observations, limitations, questions for clinician, generated timestamp.
- `ConsentRecord`: consent purpose, status, timestamp.

Do not calculate a unified “apnea probability” unless there is a validated and appropriately governed method supporting that exact claim.

## UI and Content Style
- Calm, reassuring, professional, and non-alarmist.
- Prefer “acoustic pattern observed” over “apnea detected.”
- Prefer “this recording cannot rule out sleep apnea” over “you are safe.”
- Explain technical terms in everyday language.
- Never use green “all clear” indicators for a negative consumer screen.
- Use explicit labels such as “Sample data,” “User-reported,” “Audio observation,” and “Not a diagnosis.”

## Definition of Done
A feature is complete only when:
- Its main flow works end to end.
- Loading, empty, invalid, and error states are handled.
- Data sources and demo data are labeled.
- Health claims are appropriately qualified.
- The interface works on common mobile and desktop sizes.
- No secret keys or unnecessary sensitive data are exposed.
- Any claimed model output or integration has actually been exercised.

## Working Style for Claude
- First inspect the repository and summarize the existing architecture.
- Before large changes, provide a short implementation plan.
- Build the smallest complete vertical slice first.
- Do not silently replace real functionality with mocks.
- Do not add features outside the PRD without explaining why.
- Run relevant tests, lint, and build commands when available; report exactly what ran and what failed.
- If a requirement conflicts with medical safety or the PRD, explain the conflict and propose a safer alternative.
