# Clinical review packet

**Purpose:** let a qualified clinician review every health-related statement SleepSmooth shows, in one sitting. Generated from the source files on 2026-10-15 by a script that imports the strings, so the text is exact. Regenerate it after copy changes (the other workstreams edit the model card, the night verdict and the UI; strings that moved after this date may be missing or stale).

**How to review:** for each row tick OK, Edit (write the replacement under Notes) or Remove. Please also answer the open questions at the end. Reviewer name, role, date: ____________________________

**Status of the content:** Prototype. Not clinically validated. Nothing here has been reviewed by a clinician yet. "Source / basis" says where each statement comes from; "Team-written" means no external source and it needs the most scrutiny. Where the source is a secondary summary that the team did not verify against the primary document, the row says so.

**Scope reminder:** the app is positioned as informational and care navigation (see docs/REGULATORY_POSITION.md). It must never diagnose, claim to detect sleep apnea, offer reassurance from a quiet or low-scoring result, or give treatment advice.


## 1. Core disclaimers

| ID | Text shown | Source / basis | Reviewer |
|---|---|---|---|
| C001 | SleepSmooth is informational and is not a diagnosis. It cannot confirm or rule out sleep apnea.<br><sub>claims.ts DISCLAIMER_NOT_DIAGNOSIS</sub> | Team-written; AASM 2017 says questionnaires and similar tools do not diagnose | [ ] OK  [ ] Edit  [ ] Remove |
| C002 | Audio analysis detects acoustic patterns only. It does not directly measure airflow or confirm apnea events.<br><sub>DISCLAIMER_AUDIO</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C003 | A quiet, normal-looking, or inconclusive recording cannot rule out sleep apnea.<br><sub>DISCLAIMER_CANNOT_RULE_OUT</sub> | Team-written; supported by cleared-feature labels (Apple K240929, Samsung DEN230041) saying no alert does not rule it out (secondary source) | [ ] OK  [ ] Edit  [ ] Remove |
| C004 | If you are concerned about your sleep or symptoms, talk to a qualified healthcare professional.<br><sub>DISCLAIMER_SEEK_CARE</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C005 | Snore-like sounds are not the same as sleep apnea, and their absence does not rule it out.<br><sub>SNORE_NOT_APNEA_LINE</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C006 | A lower score cannot rule out sleep apnea. Talk to a clinician if you have symptoms.<br><sub>NOSAS_LOWER_SCORE_CAVEAT</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C007 | A score below the cutoff cannot rule out sleep apnea.<br><sub>NOSAS_BELOW_CANNOT_RULE_OUT</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C008 | Whatever the results looked like, they cannot rule out sleep apnea. If you have symptoms, talk to a clinician.<br><sub>NEXT_STEPS_NOT_REASSURANCE</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |

## 2. "What this cannot tell you" panel

| ID | Text shown | Source / basis | Reviewer |
|---|---|---|---|
| C009 | What this cannot tell you<br><sub>LIMITS_PANEL_TITLE</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C010 | This is not a diagnosis. Only a clinician can diagnose sleep apnea, usually after a sleep test.<br><sub>LIMITS_PANEL_ITEMS[0]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C011 | Sound cannot measure airflow or blood oxygen. This app only notices sound patterns.<br><sub>LIMITS_PANEL_ITEMS[1]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C012 | No flags does not mean no sleep apnea. A quiet recording or a lower score cannot rule it out.<br><sub>LIMITS_PANEL_ITEMS[2]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C013 | A questionnaire cannot diagnose it either. The AASM 2017 guideline advises against using questionnaires to diagnose without a sleep test, and NICE NG202 says a sleepiness questionnaire alone should not decide referral.<br><sub>LIMITS_PANEL_ITEMS[3]</sub> | AASM clinical practice guideline, Kapur et al., J Clin Sleep Med 2017;13(3):479-504; NICE NG202 (2021) | [ ] OK  [ ] Edit  [ ] Remove |
| C014 | Even FDA-cleared or authorized watch features miss many cases. Samsung's instructions for use report that its feature flagged 167 of 202 people (82.7%) whose sleep study showed moderate-to-severe sleep apnea. Apple's is reported at about 66%, but that comes from a secondary summary that we have not checked against the FDA record. Both say that no alert does not mean no sleep apnea.<br><sub>LIMITS_PANEL_WATCH_LINE</sub> | Samsung instructions for use (167/202 = 82.7%); Apple ~66% from a SECONDARY source NOT checked against the FDA record. Please say whether to keep the Apple figure | [ ] OK  [ ] Edit  [ ] Remove |
| C015 | Sources: AASM clinical practice guideline for diagnostic testing in adults (Kapur et al., J Clin Sleep Med 2017;13(3):479-504); NICE NG202 (2021); Samsung Sleep Apnea feature instructions for use (images.samsung.com/samsung-health/ifu/IFU_SLEEP-APNEA_US.pdf); Apple figure from a secondary source (not verified).<br><sub>LIMITS_PANEL_SOURCES</sub> | as listed | [ ] OK  [ ] Edit  [ ] Remove |

## 3. Questionnaire and symptom checklist

NoSAS: Marti-Soler H, et al. Lancet Respir Med 2016;4:742-748, doi:10.1016/S2213-2600(16)30075-3. NoSAS licensing is unconfirmed (docs/outreach/NOSAS_PERMISSION_EMAIL.md).

| ID | Text shown | Source / basis | Reviewer |
|---|---|---|---|
| C016 | Marti-Soler H, et al. The NoSAS score for screening of sleep-disordered breathing: a derivation and validation study. Lancet Respir Med 2016;4:742-748. doi:10.1016/S2213-2600(16)30075-3.<br><sub>NOSAS_CITATION</sub> | the paper | [ ] OK  [ ] Edit  [ ] Remove |
| C017 | Published cutoff: a total of 8 or more (the total ranges from 0 to 17).<br><sub>NOSAS_CUTOFF_TEXT</sub> | the paper (cutoff 8, range 0-17) | [ ] OK  [ ] Edit  [ ] Remove |
| C018 | Your NoSAS score is 8 of 17. In the studies that tested it, people scoring 8 or more were more likely to have clinically significant sleep-disordered breathing than people scoring lower.<br><sub>nosasScoreStatement(8)</sub> | docs/SOURCES.md "may say" list; the paper and validation cohorts | [ ] OK  [ ] Edit  [ ] Remove |
| C019 | NoSAS (Marti-Soler et al., Lancet Respir Med 2016, doi:10.1016/S2213-2600(16)30075-3) is a screening score. It is not a diagnosis.<br><sub>NOSAS_SCREENING_NOT_DIAGNOSIS</sub> | authors describe it as a screening score; attributed, with not-a-diagnosis | [ ] OK  [ ] Edit  [ ] Remove |
| C020 | Sensitivity {"ahi5":71.2,"ahi15":80.4,"ahi30":83.1}; specificity {"ahi5":62.4,"ahi15":49.3,"ahi30":40.7} (sleep-clinic setting, cutoff 8). results vary by setting and how sleep apnea was defined.<br><sub>NOSAS_ACCURACY</sub> | PMC6977329 (sleep-clinic validation, n = 596). Clinician: is it appropriate to show these ranges? | [ ] OK  [ ] Edit  [ ] Remove |
| C021 | This score is being applied outside the populations in which it was validated.<br><sub>NOSAS_OUTSIDE_VALIDATION_NOTE</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C022 | The NoSAS questions were not answered.<br><sub>NOSAS_DETAIL.notAnswered</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C023 | The score is incomplete, so it cannot be read as low or high.<br><sub>NOSAS_DETAIL.incompleteBelow</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C024 | The score is below the published cutoff. This cannot rule out sleep apnea.<br><sub>NOSAS_DETAIL.below</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C025 | The score is at or above the published cutoff.<br><sub>NOSAS_DETAIL.atOrAbove</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C026 | Neck measurement missing, so the score is incomplete. Without it, the highest possible score is 13.<br><sub>NOSAS_INCOMPLETE_EXPLANATION</sub> | Arithmetic from the NoSAS point table (neck 4 points; max 13 without it) | [ ] OK  [ ] Edit  [ ] Remove |
| C027 | [{"item":"Neck circumference greater than 40 cm","points":4},{"item":"BMI 25 to under 30","points":3},{"item":"BMI 30 or above","points":5},{"item":"Snoring","points":2},{"item":"Age over 55","points":4},{"item":"Male sex (sex assigned at birth)","points":2}]<br><sub>NOSAS_POINTS_TABLE</sub> | the paper | [ ] OK  [ ] Edit  [ ] Remove |
| C028 | I snore loudly<br><sub>symptomChecklist loud-snoring</sub> | Team-written checklist (not a validated instrument) | [ ] OK  [ ] Edit  [ ] Remove |
| C029 | I wake up choking or gasping<br><sub>symptomChecklist choking-gasping</sub> | Team-written checklist (not a validated instrument) | [ ] OK  [ ] Edit  [ ] Remove |
| C030 | Someone has noticed pauses in my breathing during sleep<br><sub>symptomChecklist noticed-breathing-pauses</sub> | Team-written checklist (not a validated instrument) | [ ] OK  [ ] Edit  [ ] Remove |
| C031 | I wake up feeling unrefreshed<br><sub>symptomChecklist unrefreshing-sleep</sub> | Team-written checklist (not a validated instrument) | [ ] OK  [ ] Edit  [ ] Remove |
| C032 | I feel very sleepy during the day<br><sub>symptomChecklist daytime-sleepiness</sub> | Team-written checklist (not a validated instrument) | [ ] OK  [ ] Edit  [ ] Remove |
| C033 | I wake up with headaches<br><sub>symptomChecklist morning-headaches</sub> | Team-written checklist (not a validated instrument) | [ ] OK  [ ] Edit  [ ] Remove |
| C034 | Not a validated instrument<br><sub>SYMPTOM_NOT_VALIDATED</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C035 | We count a high symptom burden when two or more of the six core symptoms are rated often or nightly. This is a team-written rule, not a validated one.<br><sub>SYMPTOM_RULE_NOTE</sub> | Team-written rule: two or more of six symptoms rated often or nightly = "high burden". Please judge whether this is a reasonable discussion trigger | [ ] OK  [ ] Edit  [ ] Remove |
| C036 | The symptom checklist was not answered.<br><sub>SYMPTOM_DETAIL.notAnswered</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C037 | Every core symptom you answered was rated never. Symptoms can be missed or underestimated.<br><sub>SYMPTOM_DETAIL.none</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C038 | You reported at least one core symptom.<br><sub>SYMPTOM_DETAIL.some</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C039 | You rated two or more core symptoms as often or nightly.<br><sub>SYMPTOM_DETAIL.high</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |

## 4. Red flag (drowsy driving)

| ID | Text shown | Source / basis | Reviewer |
|---|---|---|---|
| C040 | Have you fallen asleep, or nearly fallen asleep, while driving?<br><sub>RED_FLAG_QUESTION</sub> | Team-written; NICE NG202 (2021) citing UK DVLA guidance (secondary reading) | [ ] OK  [ ] Edit  [ ] Remove |
| C041 | You reported falling asleep, or nearly falling asleep, while driving. Please talk to a clinician promptly.<br><sub>RED_FLAG_WORDING</sub> | Team-written. Is "talk to a clinician promptly" the right level? CLAUDE.md forbids inventing urgent-care triage rules | [ ] OK  [ ] Edit  [ ] Remove |
| C042 | If you feel drowsy while driving, CDC advises getting off the road and resting until you are no longer drowsy. This is general information, not triage guidance.<br><sub>RED_FLAG_NOTE</sub> | CDC drowsy driving advice (get off the road and rest); not re-checked against the CDC page in this pass | [ ] OK  [ ] Edit  [ ] Remove |
| C043 | Drowsy driving<br><sub>NEXT_STEPS_DROWSY_HEADING</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |

## 5. Results headlines and evidence wording

| ID | Text shown | Source / basis | Reviewer |
|---|---|---|---|
| C044 | Based on what you shared, this is worth discussing with a clinician.<br><sub>HEADLINE_DISCUSS</sub> | Team-written rule: NoSAS at or above cutoff, or high symptom burden, or red flag | [ ] OK  [ ] Edit  [ ] Remove |
| C045 | These results cannot rule out sleep apnea.<br><sub>HEADLINE_INCONCLUSIVE</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C046 | There is not enough information yet. These results cannot rule out sleep apnea.<br><sub>HEADLINE_NOT_ENOUGH</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C047 | Your symptoms and questionnaire answers suggest this is worth discussing, and a quiet or missing recording cannot rule out sleep apnea.<br><sub>CONFLICT_QUIET_OR_MISSING_AUDIO</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C048 | Snore-like sounds were observed; snoring alone does not mean sleep apnea, but it is worth mentioning.<br><sub>NOTE_SNORE_LIKE</sub> | Team-written; snoring alone is not diagnostic | [ ] OK  [ ] Edit  [ ] Remove |
| C049 | A recording is never used to lower the conclusion drawn from your answers.<br><sub>NOTE_AUDIO_NEVER_DOWNGRADES</sub> | Product rule | [ ] OK  [ ] Edit  [ ] Remove |
| C050 | Your answers and the recording are shown separately. They are not combined into one score.<br><sub>NOTE_NO_UNIFIED_SCORE</sub> | Product rule (CLAUDE.md: no unified apnea probability) | [ ] OK  [ ] Edit  [ ] Remove |
| C051 | No recording was analyzed. That is a missing piece of information, not a reassuring result.<br><sub>AUDIO_SLOT_EMPTY</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C052 | No recording was analyzed.<br><sub>AUDIO_DETAIL.notProvided</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C053 | The recording could not be assessed (quality too poor).<br><sub>AUDIO_DETAIL.unusable</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C054 | Few snore-like sounds were observed in the assessable parts of the recording.<br><sub>AUDIO_DETAIL.usableFewObservations</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C055 | A snore-like pattern was observed in part of the recording.<br><sub>AUDIO_DETAIL.usableSnoreLikeObserved</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C056 | Quality, loudness, and quiet periods were measured. No snore analysis was run.<br><sub>AUDIO_DETAIL.noModel</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C057 | Quality, loudness, and quiet periods were measured. The sound quality was too limited for snore analysis, so none was run.<br><sub>AUDIO_DETAIL.modelNotApplicable</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C058 | Nothing snore-like was found in the assessable time. That does not rule out sleep apnea, and it says nothing about the time that could not be assessed.<br><sub>NO_SNORE_IN_ASSESSABLE</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C059 | Could not assess. The recording was too quiet, too short or too incomplete to check for snore-like sounds. This is not a sign that all is well.<br><sub>COULD_NOT_ASSESS_LINE</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C060 | A snore-like pattern was observed in repeated stretches. Snoring alone does not mean sleep apnea, but it is worth mentioning to a clinician.<br><sub>NIGHT_SNORE_LIKE_NOTE</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C061 | Few snore-like stretches were observed in the parts of the night that could be analyzed. This cannot rule out sleep apnea.<br><sub>NIGHT_FEW_OBSERVATIONS_NOTE</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C062 | The estimated sleep window comes from sound level, app use and charging. It is an unvalidated estimate and cannot tell sleep from lying quietly awake.<br><sub>NIGHT_LIMITATIONS[0]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C063 | The snore-pattern model was trained on short clips, not overnight bedroom recordings, and has not been validated on overnight phone audio.<br><sub>NIGHT_LIMITATIONS[1]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C064 | Phone placement, bedding and room noise change what the microphone hears.<br><sub>NIGHT_LIMITATIONS[2]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C065 | Parts of the night that were too quiet, or too close to the room's background level, were not analyzed. They are not counted as "no snore".<br><sub>NIGHT_LIMITATIONS[3]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C066 | Estimated sleep window (unvalidated estimate). The phone cannot tell sleep from lying quietly awake.<br><sub>NIGHT_ESTIMATE_LABEL / CAVEAT</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C067 | Snore-like sound paused and then restarted 2 times. This pattern can happen with or without sleep apnea, and phone audio can't tell which. Worth mentioning to a clinician if it happens often.<br><sub>snorePausesLine(2)</sub> | Team-written; NOT shipped by default (SNORE_PAUSES_SHIPPED = false). Please advise whether it should ever ship | [ ] OK  [ ] Edit  [ ] Remove |
| C068 | It was observed on more than one night. This is a description, not a measure of severity.<br><sub>NIGHT_MULTI_RECURRING</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |

## 6. Limits of the phone and model (model card)

Numbers are copied from model/MODEL_CARD.md (ESC-50 fold 5). The model card screen is being edited by another workstream; re-check these rows against model-card.tsx and modelCardInfo.ts before sending to a reviewer.

| ID | Text shown | Source / basis | Reviewer |
|---|---|---|---|
| C069 | Intended use: flag each 1-second window as having a snore-like acoustic pattern or not. Nothing more.<br><sub>MODEL_CARD_INTENDED</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C070 | Not for: detecting sleep apnea, breathing events, airflow, severity, or risk, or for providing reassurance. It is not a medical device and not a diagnosis.<br><sub>MODEL_CARD_NOT_FOR</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C071 | This app runs the first version (v1) of the snore-pattern model.<br><sub>MODEL_CARD_RUNNING_LINE</sub> | model/MODEL_CARD.md | [ ] OK  [ ] Edit  [ ] Remove |
| C072 | The test had only 8 snoring clips (71 one-second windows), so the ranges are wide and results could change a lot with different clips.<br><sub>MODEL_CARD_SMALL_TEST</sub> | model/MODEL_CARD.md | [ ] OK  [ ] Edit  [ ] Remove |
| C073 | Because snoring is rare in the test set, roughly three of four flagged windows were not snoring (44 correct flags and 147 wrong ones).<br><sub>MODEL_CARD_PRECISION_PLAIN</sub> | model/MODEL_CARD.md | [ ] OK  [ ] Edit  [ ] Remove |
| C074 | It has not been tested on recordings made overnight on real phones. All test data are short sound-effect clips.<br><sub>MODEL_CARD_NO_REAL_PHONE</sub> | model/MODEL_CARD.md | [ ] OK  [ ] Edit  [ ] Remove |
| C075 | On 8 kHz phone-call-quality audio (a stand-in for narrowband audio) its recall was 0.00: it flagged none of the snoring. Such recordings are treated as not assessable.<br><sub>MODEL_CARD_PHONE_QUALITY</sub> | model/MODEL_CARD.md | [ ] OK  [ ] Edit  [ ] Remove |
| C076 | Other limits: it was trained on short clips, not overnight bedroom recordings; clicks, crickets and alarms can be flagged by mistake; performance across ages, sexes and body types is unknown; not clinically validated.<br><sub>MODEL_CARD_OTHER_LIMITS</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C077 | The model was trained on ESC-50 clips (CC BY-NC 3.0), so it is for non-commercial use only. Full details: model/MODEL_CARD.md in the project files.<br><sub>MODEL_CARD_LICENSE</sub> | ESC-50 licence CC BY-NC 3.0 (non-commercial); release question for counsel | [ ] OK  [ ] Edit  [ ] Remove |

## 7. Pathway guide: "How sleep apnea is usually checked"

| ID | Text shown | Source / basis | Reviewer |
|---|---|---|---|
| C078 | A general outline. Your clinician decides what fits you.<br><sub>PATHWAY_INTRO</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C079 | **1. Primary care or a sleep specialist.** You usually start with your regular doctor or clinic, or go straight to a sleep specialist if you already have one. They ask about your symptoms, medicines and other health conditions. Testing is meant to follow this kind of full evaluation, not replace it.<br><sub>PATHWAY_STEPS.primary</sub> | AASM adult testing guideline, 2017: https://aasm.org/wp-content/uploads/2017/07/diagnostic-testing-OSA.pdf | [ ] OK  [ ] Edit  [ ] Remove |
| C080 | **2. Possibly a sleep specialist.** Your clinician may refer you to a sleep specialist, or order a test themselves. Whether you need a referral can depend on your clinic and your insurance, so it is worth asking.<br><sub>PATHWAY_STEPS.specialist</sub> | docs/research/03_CLINICAL_PATHWAY.md | [ ] OK  [ ] Edit  [ ] Remove |
| C081 | **3a. Home sleep apnea test (HSAT).** A portable recorder you use in your own bed. AASM accepts it as an option for adults without other major health problems whose clinician thinks they have an increased chance of moderate-to-severe sleep apnea. In the guideline, that means excessive sleepiness plus at least two of: habitual loud snoring, witnessed gasping or choking, and high blood pressure that a clinician has already recorded.<br><sub>PATHWAY_STEPS.hsat</sub> | AASM adult testing guideline, 2017: https://aasm.org/wp-content/uploads/2017/07/diagnostic-testing-OSA.pdf | [ ] OK  [ ] Edit  [ ] Remove |
| C082 | **3b. In-lab sleep study (polysomnography).** An overnight study at a sleep centre, with more sensors than a home test. AASM advises this kind of study rather than a home test for people with significant heart or lung disease, muscle weakness affecting breathing, long-term opioid use, a past stroke, or severe insomnia. It also advises one after a home test that is negative or did not record enough.<br><sub>PATHWAY_STEPS.psg</sub> | AASM-hosted payer scorecard, 2017: https://aasm.org/wp-content/uploads/2020/11/eviCore_Revised_Scorecard_June_2017.pdf | [ ] OK  [ ] Edit  [ ] Remove |
| C083 | **4. Results, then follow-up.** Only a sleep test ordered by a clinician can confirm or exclude sleep apnea. If it is confirmed, your clinician talks through options and follow-up. Which test and which option fit is your clinician’s decision, not this app’s.<br><sub>PATHWAY_STEPS.results</sub> | docs/research/03_CLINICAL_PATHWAY.md | [ ] OK  [ ] Edit  [ ] Remove |
| C084 | Treatments clinicians may discuss. Options to discuss, not advice. This list is not ranked and is not a recommendation. Whether any option applies depends on your test results and health.<br><sub>TREATMENTS_NOTE</sub> | Team-written. Clinician: is a list of treatments appropriate at all in an informational app? | [ ] OK  [ ] Edit  [ ] Remove |
| C085 | **Positive airway pressure (PAP).** A mask worn at night that gently blows air to keep the airway open. AASM-linked guidance supports it for adults who are sleepy because of sleep apnea.<br><sub>TREATMENT_OPTIONS.pap</sub> | BCBSND policy summary of AASM-linked guidance: https://www.bcbsnd.com/providers/policies-precertification/medical-policy/diagnosis-and-treatment-of-obstructive-sleep-apnea-for-adults | [ ] OK  [ ] Edit  [ ] Remove |
| C086 | **Oral appliance.** A custom mouthpiece made by a dentist. It is covered by joint AASM and American Academy of Dental Sleep Medicine guidance from 2015.<br><sub>TREATMENT_OPTIONS.oral</sub> | AASM/AADSM 2015 (content not reviewed for this app): https://aasm.org/wp-content/uploads/2018/01/MedicalTherapyOSA-Guideline-at-a-Glance.pdf | [ ] OK  [ ] Edit  [ ] Remove |
| C087 | **Positional therapy.** Changing sleep position, for example avoiding sleeping on your back. AASM describes it as a secondary or add-on approach.<br><sub>TREATMENT_OPTIONS.positional</sub> | AASM guideline at a glance: https://aasm.org/wp-content/uploads/2018/01/MedicalTherapyOSA-Guideline-at-a-Glance.pdf | [ ] OK  [ ] Edit  [ ] Remove |
| C088 | **Tirzepatide (Zepbound), for obesity-related sleep apnea.** A prescription medicine the FDA approved on 20 December 2024 for adults with obesity and moderate-to-severe sleep apnea, alongside diet and activity. AASM noted it only works for obesity-related sleep apnea and may not cure it. Medicines are a prescriber’s decision.<br><sub>TREATMENT_OPTIONS.tirzepatide</sub> | FDA announcement, Dec 2024: https://www.fda.gov/news-events/press-announcements/fda-approves-first-medication-obstructive-sleep-apnea | [ ] OK  [ ] Edit  [ ] Remove |
| C089 | **Hypoglossal nerve stimulation.** A surgically placed implant. It is generally considered a second-line option for moderate-to-severe sleep apnea when PAP is not tolerated, and insurers’ body-mass limits vary.<br><sub>TREATMENT_OPTIONS.hgns</sub> | AAO-HNS position, via systematic review: https://resolve.cambridge.org/core/services/aop-cambridge-core/content/view/4FD2B80D4B4D04DEC66E2A4C27ECCCCA/S0022215125000295a.pdf/hypoglossal-nerve-stimulation-in-patients-outside-the-star-trial-criteria-a-systematic-review.pdf | [ ] OK  [ ] Edit  [ ] Remove |
| C090 | Is a home test right for me, or should I have a sleep study at a sleep centre?<br><sub>QUESTIONS_LIST[0]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C091 | What is the self-pay price of the test?<br><sub>QUESTIONS_LIST[1]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C092 | Does my insurance need a referral?<br><sub>QUESTIONS_LIST[2]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C093 | Are telehealth options available?<br><sub>QUESTIONS_LIST[3]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C094 | How long is the wait for an appointment and for the test?<br><sub>QUESTIONS_LIST[4]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C095 | Costs and waits vary; ask the clinic and your insurer. No current US price or wait-time figures were verified for this app, so none are shown.<br><sub>QUESTIONS_COST_LINE / SOURCE_NOTE</sub> | No price or wait figures were verified, so none shown | [ ] OK  [ ] Edit  [ ] Remove |
| C096 | Nothing here nags you or counts days. Ticks stay on this device. One small trial found that people attended a sleep assessment more often after receiving education booklets (30% versus 11%); the main barriers were time, symptoms improving and the cost of the test. Whether a tracker like this helps is untested.<br><sub>TRACKER_NOTE</sub> | Randomised trial of booklets and sleep-assessment attendance (PMC7790540): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7790540/ | [ ] OK  [ ] Edit  [ ] Remove |
| C097 | SleepSmooth is for adults. It is not built for children or for pregnancy.<br><sub>SCOPE_ADULTS</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C098 | If a child or teenager snores or sleeps badly, talk to a pediatrician. The American Academy of Pediatrics recommends that children be screened for snoring and prefers an overnight sleep study as the test.<br><sub>SCOPE_CHILDREN</sub> | USPSTF 2022, scope: https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/obstructive-sleep-apnea-in-adults-screening; AAP 2012 (PubMed): https://pubmed.ncbi.nlm.nih.gov/22926173/ | [ ] OK  [ ] Edit  [ ] Remove |
| C099 | If you are pregnant, talk to your prenatal clinician. The US Preventive Services Task Force guidance on adult sleep apnea does not cover pregnancy, and some common questionnaires work less well in pregnancy.<br><sub>SCOPE_PREGNANCY</sub> | https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/obstructive-sleep-apnea-in-adults-screening | [ ] OK  [ ] Edit  [ ] Remove |
| C100 | For everyone: a questionnaire result or a quiet recording cannot rule out sleep apnea, and these groups are where such tools work least well.<br><sub>DIFFERENT_INTRO</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C101 | Women often describe tiredness, trouble sleeping, low mood or poor sleep rather than loud snoring. Sleep apnea in women is thought to be missed more often.<br><sub>DIFFERENT_POINTS[0]</sub> | NICE NG202 rationale (women and STOP-Bang): https://www.nice.org.uk/guidance/ng202/chapter/Rationale-and-impact; NoSAS in older adults (PMC6977329): https://pmc.ncbi.nlm.nih.gov/articles/PMC6977329; Women and sleep apnea review (PMC8461585): https://pmc.ncbi.nlm.nih.gov/articles/PMC8461585 | [ ] OK  [ ] Edit  [ ] Remove |
| C102 | People who are not overweight can have sleep apnea. In one study of younger, leaner people referred to a sleep clinic, a common questionnaire did little better than chance. NoSAS gives a body mass index of 25 to 30 only 3 points, so someone with sleep apnea can still score under its cut-off.<br><sub>DIFFERENT_POINTS[1]</sub> | NICE NG202 rationale (women and STOP-Bang): https://www.nice.org.uk/guidance/ng202/chapter/Rationale-and-impact; NoSAS in older adults (PMC6977329): https://pmc.ncbi.nlm.nih.gov/articles/PMC6977329; Women and sleep apnea review (PMC8461585): https://pmc.ncbi.nlm.nih.gov/articles/PMC8461585 | [ ] OK  [ ] Edit  [ ] Remove |
| C103 | In older adults, NoSAS has been found to be less accurate.<br><sub>DIFFERENT_POINTS[2]</sub> | NICE NG202 rationale (women and STOP-Bang): https://www.nice.org.uk/guidance/ng202/chapter/Rationale-and-impact; NoSAS in older adults (PMC6977329): https://pmc.ncbi.nlm.nih.gov/articles/PMC6977329; Women and sleep apnea review (PMC8461585): https://pmc.ncbi.nlm.nih.gov/articles/PMC8461585 | [ ] OK  [ ] Edit  [ ] Remove |
| C104 | If you feel unrefreshed or sleepy in the day, it is reasonable to raise it with a clinician whatever any result says.<br><sub>DIFFERENT_POINTS[3]</sub> | NICE NG202 rationale (women and STOP-Bang): https://www.nice.org.uk/guidance/ng202/chapter/Rationale-and-impact; NoSAS in older adults (PMC6977329): https://pmc.ncbi.nlm.nih.gov/articles/PMC6977329; Women and sleep apnea review (PMC8461585): https://pmc.ncbi.nlm.nih.gov/articles/PMC8461585 | [ ] OK  [ ] Edit  [ ] Remove |

## 8. Checklist and clinician-discussion items

| ID | Text shown | Source / basis | Reviewer |
|---|---|---|---|
| C105 | Who to contact: Contact your regular doctor or primary care clinic and ask for an appointment about your sleep and tiredness.<br><sub>NEXT_STEPS_GROUPS.contact.contact-primary</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C106 | Who to contact: If you already see a sleep specialist, tell their office you would like to discuss these symptoms.<br><sub>NEXT_STEPS_GROUPS.contact.contact-sleep</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C107 | What to bring: This summary, printed or saved as a PDF. Tell the clinician which parts are your own reports and which are app observations.<br><sub>NEXT_STEPS_GROUPS.bring.bring-summary</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C108 | What to bring: A short list of your symptoms and when they happen, including daytime sleepiness.<br><sub>NEXT_STEPS_GROUPS.bring.bring-symptoms</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C109 | What to bring: Your medicines and any health conditions you want to mention.<br><sub>NEXT_STEPS_GROUPS.bring.bring-meds</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C110 | What to bring: Observations from a partner or housemate, if you have one. If you sleep alone, say so; that is common and the clinician can work with it.<br><sub>NEXT_STEPS_GROUPS.bring.bring-partner</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C111 | What to ask: Ask whether an evaluation for sleep apnea is appropriate for you.<br><sub>NEXT_STEPS_GROUPS.ask.ask-eval</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C112 | What to ask: Ask about testing options, such as a home sleep apnea test or an in-lab sleep study. Which one fits is a decision for your clinician.<br><sub>NEXT_STEPS_GROUPS.ask.ask-testing</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C113 | What to ask: Ask what the next step is and when to follow up.<br><sub>NEXT_STEPS_GROUPS.ask.ask-follow</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C114 | Bring or share the summary from this app, and tell the clinician which parts are your own reports.<br><sub>NEXT_STEPS_CHECKLIST[0]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C115 | Ask whether an evaluation for sleep apnea is appropriate for you.<br><sub>NEXT_STEPS_CHECKLIST[1]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C116 | If someone has noticed your sleep, ask them to describe what they saw.<br><sub>NEXT_STEPS_CHECKLIST[2]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C117 | Write down when you feel sleepy during the day, including any time at the wheel.<br><sub>NEXT_STEPS_CHECKLIST[3]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C118 | Note any medicines or conditions you want to mention.<br><sub>NEXT_STEPS_CHECKLIST[4]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C119 | Ask what the next step is and when to follow up.<br><sub>NEXT_STEPS_CHECKLIST[5]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C120 | These are general suggestions for preparing to talk with a qualified healthcare professional. They are not medical instructions.<br><sub>NEXT_STEPS_INTRO</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C121 | Guidelines suggest discussing a sleep evaluation with a clinician if any of these apply to you. This is not a score, a risk estimate or triage, and leaving all of them unticked tells you nothing either way. Tick only what you want to share.<br><sub>DISCUSS_INTRO</sub> | AHA scientific statement 2021; AASM 2017; NICE NG202 (2021) | [ ] OK  [ ] Edit  [ ] Remove |
| C122 | High blood pressure that stays high despite treatment<br><sub>DISCUSS_ITEMS.resistant_hypertension</sub> | AHA scientific statement on sleep apnea and heart disease, 2021 | [ ] OK  [ ] Edit  [ ] Remove |
| C123 | Atrial fibrillation (AF) that came back after cardioversion or ablation<br><sub>DISCUSS_ITEMS.atrial_fibrillation</sub> | AHA scientific statement on sleep apnea and heart disease, 2021 | [ ] OK  [ ] Edit  [ ] Remove |
| C124 | Heart failure<br><sub>DISCUSS_ITEMS.heart_failure</sub> | AHA scientific statement on sleep apnea and heart disease, 2021 | [ ] OK  [ ] Edit  [ ] Remove |
| C125 | A past stroke<br><sub>DISCUSS_ITEMS.stroke</sub> | AASM 2017 guideline: affects which sleep test a clinician chooses | [ ] OK  [ ] Edit  [ ] Remove |
| C126 | Regular use of opioid pain medicine<br><sub>DISCUSS_ITEMS.opioids</sub> | AASM 2017 guideline: affects which sleep test a clinician chooses | [ ] OK  [ ] Edit  [ ] Remove |
| C127 | Sleepiness that affects your driving<br><sub>DISCUSS_ITEMS.drowsy_driving</sub> | NICE NG202 (2021), citing UK DVLA guidance | [ ] OK  [ ] Edit  [ ] Remove |
| C128 | Sources: AHA scientific statement on obstructive sleep apnea and cardiovascular disease (2021); AASM clinical practice guideline for diagnostic testing in adults (2017); NICE NG202 (2021), which cites UK DVLA guidance. General information to help you prepare for a conversation, not medical advice.<br><sub>DISCUSS_SOURCE_LINE</sub> | as listed (the AHA statement itself was not re-read in this pass) | [ ] OK  [ ] Edit  [ ] Remove |

## 9. Summary template (what the user brings to a clinician)

| ID | Text shown | Source / basis | Reviewer |
|---|---|---|---|
| C129 | What I reported<br><sub>SUMMARY_SECTION_TITLES.reported</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C130 | Questionnaire score (NoSAS)<br><sub>SUMMARY_SECTION_TITLES.screening</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C131 | Recording observations<br><sub>SUMMARY_SECTION_TITLES.audio</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C132 | What this app can and cannot say<br><sub>SUMMARY_SECTION_TITLES.guidance</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C133 | Questions for my clinician<br><sub>SUMMARY_SECTION_TITLES.questions</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C134 | Limitations<br><sub>SUMMARY_SECTION_TITLES.limits</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C135 | Given my symptoms, is an evaluation for sleep apnea appropriate for me?<br><sub>CLINICIAN_QUESTIONS[0]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C136 | What kind of sleep testing, if any, would you suggest?<br><sub>CLINICIAN_QUESTIONS[1]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C137 | Could anything else be causing my tiredness or snoring?<br><sub>CLINICIAN_QUESTIONS[2]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C138 | What should I watch for before my next visit?<br><sub>CLINICIAN_QUESTIONS[3]</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C139 | This summary was generated from your answers by fixed rules, not by a clinician. You can edit any section.<br><sub>SUMMARY_GENERATED_NOTE</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C140 | Not a diagnosis. Prepared by an informational prototype, not by a clinician.<br><sub>SUMMARY_PRINT_NOT_DIAGNOSIS</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C141 | I ticked these in the app. Guidelines suggest discussing a sleep evaluation if they apply.<br><sub>DISCUSS_SUMMARY_LEAD</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C142 | Hello. I would like to talk about my sleep and whether an evaluation for sleep apnea makes sense for me. (further lines are built from the user's own answers)<br><sub>Clinician script opener (pathwayScript.ts)</sub> | Team-written; not tested with clinicians (SCRIPT_BASIS_NOTE) | [ ] OK  [ ] Edit  [ ] Remove |
| C143 | Reports like these cannot confirm or rule out sleep apnea. Ask the partner to describe what they saw directly to the clinician if possible.<br><sub>PARTNER_SUMMARY_CAVEAT</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C144 | Without a partner, the overnight recording and the morning clip review are the main way to notice snoring. Having no one to report on your sleep does not rule anything out.<br><sub>PARTNER_ALONE_NOTE</sub> | Team-written | [ ] OK  [ ] Edit  [ ] Remove |
| C145 | Loud snoring<br><sub>PARTNER_ITEM_LABELS.loud-snoring</sub> | Team-written (user-reported by someone else, unscored) | [ ] OK  [ ] Edit  [ ] Remove |
| C146 | Pauses in breathing<br><sub>PARTNER_ITEM_LABELS.breathing-pauses</sub> | Team-written (user-reported by someone else, unscored) | [ ] OK  [ ] Edit  [ ] Remove |
| C147 | Gasping or choking<br><sub>PARTNER_ITEM_LABELS.gasping-choking</sub> | Team-written (user-reported by someone else, unscored) | [ ] OK  [ ] Edit  [ ] Remove |
| C148 | Restless sleep<br><sub>PARTNER_ITEM_LABELS.restless-sleep</sub> | Team-written (user-reported by someone else, unscored) | [ ] OK  [ ] Edit  [ ] Remove |
| C149 | Nothing noticed<br><sub>PARTNER_ITEM_LABELS.nothing</sub> | Team-written (user-reported by someone else, unscored) | [ ] OK  [ ] Edit  [ ] Remove |

## 10. Welcome, consent and scope statements

| ID | Text shown | Source / basis | Reviewer |
|---|---|---|---|
| C150 | SleepSmooth helps you organize what you notice about your sleep, see what the available information does and does not show, and prepare a summary to discuss with a clinician.<br><sub>WELCOME_PURPOSE</sub> | Positioning, see REGULATORY_POSITION.md | [ ] OK  [ ] Edit  [ ] Remove |
| C151 | Helps you decide whether to talk to a clinician about sleep apnea, and gives you a summary to bring.<br><sub>WELCOME_VALUE_PROP</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C152 | Ask a short set of questions and a symptom checklist.<br><sub>WELCOME_CAN[0]</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C153 | Optionally look at a recording of your sleep sounds for acoustic patterns, on your own device.<br><sub>WELCOME_CAN[1]</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C154 | Show what each piece of information shows, what is missing, and where it is uncertain.<br><sub>WELCOME_CAN[2]</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C155 | Prepare a summary you can edit and bring to an appointment.<br><sub>WELCOME_CAN[3]</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C156 | It cannot tell you whether you have sleep apnea, or how severe it might be.<br><sub>WELCOME_CANNOT[0]</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C157 | It cannot rule out sleep apnea, whatever the result looks like.<br><sub>WELCOME_CANNOT[1]</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C158 | It does not replace a clinician or a sleep study.<br><sub>WELCOME_CANNOT[2]</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C159 | It does not measure breathing or airflow.<br><sub>WELCOME_CANNOT[3]</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C160 | I understand these limits. I agree that my answers may be kept in this browser tab until I close it or choose "Delete my data".<br><sub>CONSENT_LABEL</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C161 | Picked automatically from sound patterns. Not a diagnosis. The night may contain other events that were not saved.<br><sub>CLIP_FOOTNOTE</sub> |  | [ ] OK  [ ] Edit  [ ] Remove |
| C162 | If clip saving is on, short stretches of sound from the room may be saved on this iPhone, and may include other people. Speech-like stretches are skipped.<br><sub>CLIP_BYSTANDER_EXTRA</sub> | Privacy / consent counsel | [ ] OK  [ ] Edit  [ ] Remove |
| C163 | Looks at how long this iPhone sat still overnight during the last 7 days to suggest sleep hours. It is an estimate from the phone, not a record of sleep. iOS will ask for Motion & Fitness access.<br><sub>ROUTINE_FIND_BODY</sub> | Unvalidated estimate, labelled | [ ] OK  [ ] Edit  [ ] Remove |
| C164 | SleepSmooth asks you at your wake time, or earlier if the phone sees movement and pickups after a quiet night. After 3 mornings in a row where you stop within 30 minutes of that signal, it can stop by itself 10 minutes after it. The signal is an unvalidated gu...<br><sub>MORNING_ROW_FOOTER (first sentences)</sub> | Unvalidated estimate, labelled | [ ] OK  [ ] Edit  [ ] Remove |

## Open questions for the clinician reviewer
1. Is the "worth discussing with a clinician" trigger (NoSAS at or above 8, or two or more of six symptoms rated often or nightly, or the drowsy-driving answer) reasonable as a prompt to talk to a clinician? Is any part inappropriate to show?
2. Is the drowsy-driving wording adequate, or should it be removed rather than risk implying triage?
3. Is it appropriate for an informational app to list treatment options (section 7) and to name a specific medicine?
4. Are the NoSAS accuracy ranges and the Apple/Samsung watch figures appropriate to show to lay users, and is the Apple figure acceptable while it comes from a secondary source?
5. Does anything read as a diagnosis, reassurance, or advice to change treatment?
6. Missing: anything a clinician would want in the summary that is absent (medications, BMI, blood pressure)?
7. Is the bed-partner wording ("pauses in breathing", "gasping or choking") acceptable as user-reported and unscored?

## Reviewer sign-off
Name: ______________________  Role/credentials: ______________________  Date: __________
Overall: [ ] Approved as is  [ ] Approved with the edits above  [ ] Not approved

Items in the packet: 164.
