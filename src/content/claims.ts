// All NoSAS / claims / health text lives here (ER-8). Strings are copied verbatim from
// docs/SOURCES.md "Allowed in-app statements (the may say list)". Do not paraphrase.

export const NOSAS_CITATION =
  'Marti-Soler H, et al. The NoSAS score for screening of sleep-disordered breathing: a derivation and validation study. Lancet Respir Med 2016;4:742-748. doi:10.1016/S2213-2600(16)30075-3.';

export const NOSAS_URLS = [
  'https://iris.unil.ch/handle/iris/57504',
  'https://pmc.ncbi.nlm.nih.gov/articles/PMC6977329',
] as const;

/** May-say 1. `score` is the NoSAS total. */
export const nosasScoreStatement = (score: number): string =>
  `Your NoSAS score is ${score} of 17. In the studies that tested it, people scoring 8 or more were more likely to have clinically significant sleep-disordered breathing than people scoring lower.`;

/** May-say 2. */
export const NOSAS_SCREENING_NOT_DIAGNOSIS =
  'NoSAS (Marti-Soler et al., Lancet Respir Med 2016, doi:10.1016/S2213-2600(16)30075-3) is a screening score. It is not a diagnosis.';

/** May-say 3 (accuracy only as ranges from PMC6977329, sleep-clinic setting, n = 596, cutoff >= 8). */
export const NOSAS_ACCURACY_RANGES = {
  sensitivityPct: { ahi5: 71.2, ahi15: 80.4, ahi30: 83.1 },
  specificityPct: { ahi5: 62.4, ahi15: 49.3, ahi30: 40.7 },
  source: 'PMC6977329',
  setting: 'sleep-clinic',
} as const;
export const NOSAS_ACCURACY_CAVEAT = 'results vary by setting and how sleep apnea was defined.';

/** May-say 4. */
export const NOSAS_LOWER_SCORE_CAVEAT =
  'A lower score does not rule out sleep apnea. Talk to a clinician if you have symptoms.';

/** May-say 5 (wording is ours; the SOURCES.md entry only requires a note of this kind). */
export const NOSAS_OUTSIDE_VALIDATION_NOTE =
  'This score is being applied outside the populations in which it was validated.';

/** May-say 6 (incomplete score, partial total already at or above cutoff). */
export const NOSAS_INCOMPLETE_AT_OR_ABOVE =
  'Even without a neck measurement, your score is already at or above the published cutoff of 8.';

/** Amendment 5: incomplete explanation. */
export const NOSAS_INCOMPLETE_EXPLANATION = 'Neck measurement missing, so the score is incomplete. Without it, the highest possible score is 13.';

// Shared disclaimer strings (CLAUDE.md health safety requirements).
export const PROTOTYPE_BANNER = 'Prototype - not a diagnosis';
export const DISCLAIMER_NOT_DIAGNOSIS =
  'SleepSmooth is informational and is not a diagnosis. It cannot confirm or rule out sleep apnea.';
export const DISCLAIMER_AUDIO =
  'Audio analysis detects acoustic patterns only. It does not directly measure airflow or confirm apnea events.';
export const DISCLAIMER_CANNOT_RULE_OUT =
  'A quiet, normal-looking, or inconclusive recording cannot rule out sleep apnea.';
export const DISCLAIMER_SEEK_CARE =
  'If you are concerned about your sleep or symptoms, talk to a qualified healthcare professional.';
export const NO_MODEL_LINE = 'No trained snore model is included in this build.';
export const SYNTHETIC_LABEL = 'Synthetic / illustrative';

// ---------------------------------------------------------------------------
// M1/M2 additions (Agent A). All user-facing health text is kept here (ER-8).
// ---------------------------------------------------------------------------

export const NOSAS_CUTOFF = 8;
export const NOSAS_CUTOFF_TEXT = 'Published cutoff: a total of 8 or more (the total ranges from 0 to 17).';
export const NOSAS_BAND_AT_OR_ABOVE = 'At or above the published cutoff of 8';
export const NOSAS_BAND_BELOW = 'Below the published cutoff of 8';
export const NOSAS_BAND_INCOMPLETE = 'Incomplete';
export const NOSAS_BAND_NOT_ANSWERED = 'Not answered';
export const NOSAS_NOT_ANSWERED_EXPLANATION = 'No NoSAS questions have been answered yet.';
export const NOSAS_OTHER_ITEMS_MISSING = 'Some other items were also not answered.';

/** Item list with points, shown in the questionnaire UI next to the citation. */
export const NOSAS_POINTS_TABLE: { item: string; points: number }[] = [
  { item: 'Neck circumference greater than 40 cm', points: 4 },
  { item: 'BMI 25 to under 30', points: 3 },
  { item: 'BMI 30 or above', points: 5 },
  { item: 'Snoring', points: 2 },
  { item: 'Age over 55', points: 4 },
  { item: 'Male sex (sex assigned at birth)', points: 2 },
];

export const NOSAS_QUESTIONS = {
  units: 'Which units do you want to use?',
  height: 'Height',
  weight: 'Weight',
  neck: 'Neck circumference (optional, measured around the middle of the neck)',
  neckUnknown: "I don't know my neck measurement",
  snoring: 'Do you snore?',
  age: 'Age in years',
  sex: 'Sex assigned at birth',
  sexNote: 'The published score was derived using sex assigned at birth, so we ask for that variable.',
} as const;

export const NOSAS_ITEM_SKIPPED_NOTE =
  'Skipped or unknown items count as unanswered. They are never counted as zero points when a score is shown as complete.';

/** Explanation for a complete score (May-say 1, 2, 4, 5). */
export const nosasCompleteExplanation = (total: number): string =>
  [
    nosasScoreStatement(total),
    total >= NOSAS_CUTOFF ? '' : NOSAS_LOWER_SCORE_CAVEAT,
    NOSAS_SCREENING_NOT_DIAGNOSIS,
    NOSAS_OUTSIDE_VALIDATION_NOTE,
  ]
    .filter(Boolean)
    .join(' ');

// Symptom checklist (team-written, unvalidated).
export const SYMPTOM_NOT_VALIDATED = 'Not a validated instrument';
export const SYMPTOM_CHECKLIST_NOTE =
  'This checklist was written by the SleepSmooth team to organize what you want to discuss with a clinician. It is an unvalidated heuristic, not a published questionnaire.';
export const SYMPTOM_RULE_NOTE =
  'We count a high symptom burden when two or more of the six core symptoms are rated often or nightly. This is a team-written rule, not a validated one.';
export const RED_FLAG_WORDING =
  'You reported falling asleep, or nearly falling asleep, while driving. Please talk to a clinician promptly.';
export const RED_FLAG_QUESTION = 'Have you fallen asleep, or nearly fallen asleep, while driving?';
export const RED_FLAG_NOTE =
  'If you feel drowsy while driving, CDC advises getting off the road and resting until you are no longer drowsy. This is general information, not triage guidance.';

// Welcome page.
export const WELCOME_PURPOSE =
  'SleepSmooth helps you organize what you notice about your sleep, see what the available information does and does not show, and prepare a summary to discuss with a clinician.';
export const WELCOME_CAN = [
  'Ask a short set of screening questions and a symptom checklist.',
  'Optionally look at a recording of your sleep sounds for acoustic patterns, on your own device.',
  'Show what each piece of information shows, what is missing, and where it is uncertain.',
  'Prepare a summary you can edit and bring to an appointment.',
];
export const WELCOME_CANNOT = [
  'It cannot tell you whether you have sleep apnea, or how severe it might be.',
  'It cannot rule out sleep apnea, whatever the result looks like.',
  'It does not replace a clinician or a sleep study.',
  'It does not measure breathing or airflow.',
];
export const CONSENT_LABEL =
  'I understand these limits. I agree that my answers may be kept in this browser tab until I close it or choose "Delete my data".';
export const CONSENT_DETAIL =
  'Answers are kept in your browser session storage only. Nothing is sent anywhere. Recordings are analyzed in your browser and are never stored.';

// Results.
export const HEADLINE_DISCUSS = 'Based on what you shared, this is worth discussing with a clinician.';
export const HEADLINE_INCONCLUSIVE = 'This screening cannot rule out sleep apnea.';
export const HEADLINE_NOT_ENOUGH = 'There is not enough information yet. This screening cannot rule out sleep apnea.';
export const CONFLICT_QUIET_OR_MISSING_AUDIO =
  'Your symptoms and screening answers suggest this is worth discussing, and a quiet or missing recording cannot rule out sleep apnea.';
export const NOTE_SNORE_LIKE =
  'Snore-like sounds were observed; snoring alone does not mean sleep apnea, but it is worth mentioning.';
export const NOTE_AUDIO_NEVER_DOWNGRADES =
  'A recording is never used to lower the conclusion drawn from your answers.';
export const NOTE_NO_UNIFIED_SCORE =
  'Your answers and the recording are shown separately. They are not combined into one score.';
export const AUDIO_SLOT_LABEL = 'Audio evidence';
export const AUDIO_SLOT_EMPTY = 'No recording was analyzed. That is a missing piece of information, not a reassuring result.';

export const MISSING_NECK = 'Neck circumference (NoSAS item)';
export const MISSING_NOSAS = 'NoSAS screening questions';
export const MISSING_SYMPTOMS = 'Symptom checklist';
export const MISSING_AUDIO = 'Audio recording (optional)';
export const MISSING_AUDIO_UNUSABLE = 'A usable recording (the recording could not be assessed)';
export const MISSING_MODEL = 'Snore pattern analysis (no trained model in this build)';
export const MISSING_MODEL_NOT_APPLICABLE = 'Snore-pattern check not assessed: this recording\'s sound quality is too limited (for example phone-call quality). This does not count as reassurance.';
export const MODEL_NOT_APPLICABLE =
  "This recording's sound quality is too limited (e.g. phone-call quality) for the snore-pattern model; no snore-like observations were assessed.";

export const AUDIO_DETAIL = {
  notProvided: 'No recording was analyzed.',
  unusable: 'The recording could not be assessed (quality too poor).',
  usableFewObservations: 'Few snore-like sounds were observed in the assessable parts of the recording.',
  usableSnoreLikeObserved: 'A snore-like pattern was observed in part of the recording.',
  noModel: 'Quality, loudness, and quiet periods were measured. No snore analysis was run.',
  modelNotApplicable: 'Quality, loudness, and quiet periods were measured. The sound quality was too limited for snore analysis, so none was run.',
} as const;
export const NOSAS_DETAIL = {
  notAnswered: 'The NoSAS questions were not answered.',
  incompleteBelow: 'The score is incomplete, so it cannot be read as low or high.',
  below: 'The score is below the published cutoff. This is not reassurance.',
  atOrAbove: 'The score is at or above the published cutoff.',
} as const;
export const SYMPTOM_DETAIL = {
  notAnswered: 'The symptom checklist was not answered.',
  none: 'Every core symptom you answered was rated never. Symptoms can be missed or underestimated.',
  some: 'You reported at least one core symptom.',
  high: 'You rated two or more core symptoms as often or nightly.',
} as const;

export const SYNTHETIC_PREFIX = `${SYNTHETIC_LABEL}: `;

// Summary and next steps.
export const SUMMARY_SECTION_TITLES = {
  reported: 'What I reported',
  screening: 'Screening score (NoSAS)',
  audio: 'Recording observations',
  guidance: 'What this app can and cannot say',
  questions: 'Questions for my clinician',
  limits: 'Limitations',
} as const;
export const CLINICIAN_QUESTIONS = [
  'Given my symptoms, is an evaluation for sleep apnea appropriate for me?',
  'What kind of sleep testing, if any, would you suggest?',
  'Could anything else be causing my tiredness or snoring?',
  'What should I watch for before my next visit?',
];
export const SUMMARY_NOT_PROVIDED = 'Not provided.';
export const SUMMARY_REGENERATE_CONFIRM =
  'You have edited this summary. Replace your edits with a fresh version, or keep your edits and refresh only the sections you did not edit?';
export const SUMMARY_EDITED_MARKER = 'Edited by you';
export const SUMMARY_GENERATED_NOTE =
  'This summary was generated from your answers by fixed rules, not by a clinician. You can edit any section.';

export const NEXT_STEPS_INTRO =
  'These are general suggestions for preparing to talk with a qualified healthcare professional. They are not medical instructions.';
export const NEXT_STEPS_CHECKLIST = [
  'Bring or share the summary from this app, and tell the clinician which parts are your own reports.',
  'Ask whether an evaluation for sleep apnea is appropriate for you.',
  'If someone has noticed your sleep, ask them to describe what they saw.',
  'Write down when you feel sleepy during the day, including any time at the wheel.',
  'Note any medicines or conditions you want to mention.',
  'Ask what the next step is and when to follow up.',
];
export const NEXT_STEPS_NOT_REASSURANCE =
  'Whatever the results looked like, they cannot rule out sleep apnea. If you have symptoms, talk to a clinician.';

export const DELETE_DATA_LABEL = 'Delete my data';
export const DELETE_DATA_DONE = 'Your data was deleted from this browser tab.';

// M6: snore model results on the Results page (ER-8 copy; no percentages, no scores).
export const SNORE_NOT_APNEA_LINE = 'Snore-like sounds are not the same as sleep apnea, and their absence does not rule it out.';
export const MODEL_NOT_APPLICABLE_RESULT = MODEL_NOT_APPLICABLE;
export const snoreWindowsLine = (snoreLike: number, assessable: number): string =>
  `A snore-like pattern was observed in ${snoreLike} of ${assessable} assessable 1-second windows.`;
export const tooQuietLine = (n: number): string => `${n} ${n === 1 ? 'window was' : 'windows were'} too quiet to assess. These are not counted as "no snore".`;
export const SNORE_NONE_ASSESSABLE_LINE = 'No part of the recording was loud enough to assess for a snore-like pattern. This is not a sign that all is well.';
export const modelVersionLine = (v: string): string => `Snore model version: ${v}`;
export const MODEL_CARD_HEADING = 'About the snore-pattern model';
export const MODEL_CARD_INTENDED = 'Intended use: flag each 1-second window as having a snore-like acoustic pattern or not. Nothing more.';
export const MODEL_CARD_NOT_FOR =
  'Not for: detecting sleep apnea, breathing events, airflow, severity, or risk, or for providing reassurance. It is not a medical device and not a diagnosis.';
export const MODEL_CARD_METRICS_INTRO =
  'Tested on 5-second sound-effect clips from the ESC-50 dataset (8 test snoring clips). Ranges are 95% bootstrap intervals (low to high); they are wide because the data set is small. They are not performance on your recording.';
export const MODEL_CARD_METRIC_LABELS = {
  recall: 'Share of snoring windows that were flagged',
  precision: 'Share of flagged windows that really were snoring',
  fpr: 'Share of other-sound windows wrongly flagged',
} as const;
export const MODEL_CARD_METRICS_UNAVAILABLE = 'Test results are not available in this build.';
export const MODEL_CARD_PHONE_WEAKNESS =
  'Known weakness: on phone-call-quality (narrowband) audio, the model flags nothing. For such recordings it is not run.';
export const MODEL_CARD_OTHER_LIMITS =
  'Other limits: it was trained on short clips, not overnight bedroom recordings; clicks, crickets and alarms can be flagged by mistake; performance across ages, sexes and body types is unknown; not clinically validated.';
export const MODEL_CARD_PATH = 'model/MODEL_CARD.md';

// ---------------------------------------------------------------------------
// M7 polish additions: welcome paths, sample recording, footer, next steps, print.
// ---------------------------------------------------------------------------

export const WELCOME_TITLE = 'Welcome to SleepSmooth';
export const WELCOME_VALUE_PROP =
  'Helps you decide whether to talk to a clinician about sleep apnea, and gives you a summary to bring.';
export const WELCOME_LIMITS_HEADING = 'Please read this first';
export const WELCOME_TRY_EXAMPLE = 'Try the illustrative example (synthetic data)';
export const WELCOME_TRY_EXAMPLE_NOTE =
  'Loads a made-up person, "Dana", so you can see every screen without entering anything about yourself.';
export const WELCOME_START_OWN = 'Start my own check';
export const WELCOME_START_OWN_NOTE = 'About 3 minutes. Your answers stay in this browser tab.';
export const WELCOME_NEEDS_CONSENT = 'Tick the box above to start your own check.';

export const SAMPLE_AUDIO_NOT_USED = 'This is public sample audio, not a recording of your sleep, so it is not used in your result.';
export const SAMPLE_AUDIO_LABEL = 'Sample audio assembled from public ESC-50 clips';
export const SAMPLE_AUDIO_URL = 'sample-audio/esc50-sample.wav';
export const SAMPLE_AUDIO_BUTTON = 'Analyze sample recording';
export const SAMPLE_AUDIO_NOTE =
  'Runs the same analysis as your own file on a short sample made from public sound clips. It is not an overnight recording and it is not your sleep.';
export const SAMPLE_AUDIO_LOADING = 'Loading the sample recording...';
export const SAMPLE_AUDIO_ERROR = 'The sample recording could not be loaded.';
export const SAMPLE_AUDIO_ERROR_RECOVERY = 'Check your connection to this page and try again, or use the synthetic example instead.';
export const SAMPLE_AUDIO_ATTRIBUTION =
  'ESC-50 (Piczak, ACM MM 2015, https://github.com/karolpiczak/ESC-50). Clips are CC BY-NC 3.0; see the attribution file with the sample for each clip.';
export const SYNTHETIC_CASE_BUTTON = 'Use the synthetic example case (Dana)';
export const SYNTHETIC_CASE_NOTE =
  'Replaces your answers with a made-up case and a precomputed example analysis. Everything it produces is labeled "Synthetic / illustrative".';
export const OWN_RECORDING_HEADING = 'Or use your own recording';

export const FOOTER_TEXT = 'Prototype for a hackathon. Not a medical device. Not a diagnosis.';
export const FOOTER_SOURCES = 'Sources';
export const FOOTER_MODEL_CARD = 'Model card';

export const SOURCES_TITLE = 'Sources and claims';
export const SOURCES_INTRO =
  'Everything this prototype says about screening comes from the sources below. Nothing here is clinically validated for this app.';
export const MODEL_CARD_TITLE = 'Model card (summary)';
export const MODEL_CARD_LICENSE =
  'The model was trained on ESC-50 clips (CC BY-NC 3.0), so it is for non-commercial use only. Full details: model/MODEL_CARD.md in the project files.';
export const BACK_TO_CHECK = 'Back to your check';

export const SUMMARY_PRINT_BUTTON = 'Print / Save as PDF';
export const SUMMARY_PRINT_TITLE = 'SleepSmooth: summary to discuss with a clinician';
export const SUMMARY_PRINT_NOT_DIAGNOSIS = 'Not a diagnosis. Prepared by an informational prototype, not by a clinician.';
export const SUMMARY_PRINT_SOURCES = 'Sources';

export const NEXT_STEPS_STORAGE_NOTE = 'Ticks are saved in this browser tab only and are removed by "Delete my data".';
export const NEXT_STEPS_MEMORY_NOTE = 'Ticks are kept on this page only and are lost when you leave it.';
export const NEXT_STEPS_GROUPS: { id: string; title: string; items: { id: string; text: string }[] }[] = [
  {
    id: 'contact',
    title: 'Who to contact',
    items: [
      { id: 'contact-primary', text: 'Contact your regular doctor or primary care clinic and ask for an appointment about your sleep and tiredness.' },
      { id: 'contact-sleep', text: 'If you already see a sleep specialist, tell their office you would like to discuss these symptoms.' },
    ],
  },
  {
    id: 'bring',
    title: 'What to bring',
    items: [
      { id: 'bring-summary', text: 'This summary, printed or saved as a PDF. Tell the clinician which parts are your own reports and which are app observations.' },
      { id: 'bring-symptoms', text: 'A short list of your symptoms and when they happen, including daytime sleepiness.' },
      { id: 'bring-meds', text: 'Your medicines and any health conditions you want to mention.' },
      { id: 'bring-partner', text: "Observations from a partner or housemate, if you have one. If you sleep alone, say so; that is common and the clinician can work with it." },
    ],
  },
  {
    id: 'ask',
    title: 'What to ask',
    items: [
      { id: 'ask-eval', text: 'Ask whether an evaluation for sleep apnea is appropriate for you.' },
      { id: 'ask-testing', text: 'Ask about testing options, such as a home sleep apnea test or an in-lab sleep study. Which one fits is a decision for your clinician.' },
      { id: 'ask-follow', text: 'Ask what the next step is and when to follow up.' },
    ],
  },
];
export const NEXT_STEPS_DROWSY_HEADING = 'Drowsy driving';
export const NEXT_STEPS_PROGRESS = (done: number, total: number): string => `${done} of ${total} steps ticked`;

export const ERROR_BOUNDARY_TITLE = 'Something went wrong on this page';
export const ERROR_BOUNDARY_MESSAGE = 'Your answers are not lost unless you choose to delete them. You can reload the page, or delete your data and start again.';
export const ERROR_BOUNDARY_ACTION = 'Reload the page';
export const FORM_ERROR_SUMMARY = 'Please fix the highlighted answers before continuing.';
export const FIELD_ERROR_POSITIVE = 'Please enter a number above zero.';
export const SKIP_LINK = 'Skip to main content';
export const RESULTS_EMPTY_TITLE = 'Nothing to review yet';
export const RESULTS_EMPTY_MESSAGE = 'You have not answered the questions or added a recording. Without them there is nothing to show, and that is not a reassuring result.';
export const RESULTS_EMPTY_ACTION = 'Go to the questions';
export const RESULTS_DETAILS_HEADING = 'About this result and its limits';
export const RESULTS_AUDIO_DETAILS_HEADING = 'Recording details';

// ---------------------------------------------------------------------------
// Overnight mode (new entries only; nothing above this line was changed).
// The sleep window is an unvalidated estimate. Never "sleep detected", "you slept", sleep score, quality,
// efficiency or stages. "Asleep" appears only after "estimated" or "likely".
// ---------------------------------------------------------------------------
export const NIGHT_ESTIMATE_LABEL = 'Estimated sleep window (unvalidated estimate)';
export const NIGHT_ESTIMATE_CAVEAT = 'The phone cannot tell sleep from lying quietly awake.';
export const NIGHT_ESTIMATE_NONE = 'No estimated sleep window: there was not enough evidence in the recorded signals to estimate one.';
export const NIGHT_SAMPLE_LABEL = 'Sample night (synthetic). Not a recording of anyone\'s sleep.';
export const NIGHT_SAMPLE_NOT_USED = 'This sample night is generated example data. It is shown for illustration and is not used in your result.';
export const NIGHT_NOT_RECORDED = 'No overnight recording was made. That is a missing piece of information, not a reassuring result.';
export const NIGHT_REASON_TOO_SHORT = 'Too little of the night could be analyzed (less than 2 hours) to look for a pattern.';
export const NIGHT_REASON_LOW_COVERAGE = 'Less than half of your planned sleep hours were recorded.';
export const NIGHT_REASON_CLIPPING = 'The audio was heavily distorted (clipped) for much of the night.';
export const NIGHT_REASON_SILENT = 'The microphone picked up digital silence for much of the night.';
export const NIGHT_REASON_CONSTANT_LOUD = 'The room was loud for most of the night (for example a TV or a loud fan), so the recording could not be assessed.';
export const NIGHT_REASON_NO_WINDOWS = 'No part of the night was loud enough, compared with the room, to check for a snore-like pattern. This is not a sign that all is well.';
export const NIGHT_REASON_NO_RECORDING = 'No overnight recording was made.';
export const NIGHT_MARGINAL_CLIPPING = 'Some of the night\'s audio was clipped, which can hide detail.';
export const NIGHT_MARGINAL_COVERAGE = 'Some of your planned sleep hours were not recorded.';
export const NIGHT_MARGINAL_ENDED_EARLY = 'The recording ended before the planned wake time.';
export const NIGHT_MARGINAL_BAND_LIMITED = 'The sound quality was too limited for the snore-pattern model.';
export const NIGHT_LIMITATIONS = [
  'The estimated sleep window comes from sound level, app use and charging. It is an unvalidated estimate and cannot tell sleep from lying quietly awake.',
  'The snore-pattern model was trained on short clips, not overnight bedroom recordings, and has not been validated on overnight phone audio.',
  'Phone placement, bedding and room noise change what the microphone hears.',
  'Parts of the night that were too quiet, or too close to the room\'s background level, were not analyzed. They are not counted as "no snore".',
];
export const NIGHT_SNORE_LIKE_NOTE = 'A snore-like pattern was observed in repeated stretches. Snoring alone does not mean sleep apnea, but it is worth mentioning to a clinician.';
export const NIGHT_FEW_OBSERVATIONS_NOTE = 'Few snore-like stretches were observed in the parts of the night that could be analyzed. This cannot rule out sleep apnea.';
export const nightEpisodesLine = (episodes: number, flaggedSec: number): string =>
  `${episodes} ${episodes === 1 ? 'stretch' : 'stretches'} with a repeated snore-like pattern, about ${Math.round(flaggedSec)} seconds in total.`;
export const nightUnanalyzedLine = (n: number): string =>
  `${n} ${n === 1 ? 'window was' : 'windows were'} not analyzed (too quiet or close to the room's background level). These are not counted as "no snore".`;
export const nightSensitivityLine = (a: number, b: number): string =>
  `Snore-like windows counted using only the likely-asleep part of the night: ${a}. Including the uncertain part: ${b}.`;
export const nightMultiLine = (observed: number, assessed: number): string =>
  `A snore-like pattern was observed on ${observed} of ${assessed} nights that could be analyzed.`;
export const NIGHT_MULTI_RECURRING = 'It was observed on more than one night. This is a description, not a measure of severity.';
export const nightNotAssessedNightsLine = (n: number): string => `${n} ${n === 1 ? 'night' : 'nights'} could not be analyzed.`;

/** Dashboard empty state (mobile). Calm wording; keeps the no-false-reassurance intent. */
export const DASHBOARD_EMPTY_MESSAGE = "Answer a few questions or record a night to see your summary here. An empty page doesn't rule anything out.";

// ---- Opt-in sound clips (mobile). Clips are short stretches picked by sound-pattern rules. They are not events found,
// ---- not a count of anything, and not a diagnosis. Saving is off by default and clips stay on the phone.
export const CLIP_SECTION_HEADING = 'Clips to listen to';
export const CLIP_FOOTNOTE = 'Picked automatically from sound patterns. Not a diagnosis. The night may contain other events that were not saved.';
export const CLIP_SNORE_HEADING = 'Most notable snore-like stretches';
export const CLIP_OTHER_HEADING = 'Other loud sounds';
export const CLIP_OFF_TITLE = 'Clip saving is off';
export const CLIP_OFF_BODY = 'No audio was saved for this night. You can turn on clip saving for future nights. Clips would stay on this iPhone.';
export const CLIP_OFF_BODY_ENABLED_LATER = 'Clip saving was off when this night was recorded, so no audio was saved for it.';
export const CLIP_OFF_ACTION = 'Turn on for future nights';
export const CLIP_NONE_TITLE = 'No clips were picked this night';
export const CLIP_NONE_BODY = "That doesn't rule anything out. Clips are only picked from stretches that stood out from the room's background sound.";
export const CLIP_SAMPLE_NOTE = 'These clips are synthetic tones made for this preview. They are not recordings of anyone.';
export const CLIP_PLAYBACK_BLOCKED_WHILE_RECORDING = 'Clips can be played once the recording has stopped.';
export const CLIP_TOGGLE_TITLE = 'Save a few short clips each night';
export const CLIP_TOGGLE_BODY = 'So you can listen back. Clips stay on this iPhone. Nothing is uploaded or shared unless you choose to.';
export const CLIP_TOGGLE_DETAIL = 'Up to 5 clips of at most 15 seconds each, about 2.4 MB per night at most. Turning this off stops new clips. It does not delete the ones already saved.';
export const CLIP_RETENTION_TITLE = 'Keep clips for';
export const CLIP_DELETE_ALL = 'Delete all clips';
export const CLIP_DELETE_ALL_CONFIRM = 'Delete every saved clip from this iPhone? The nights themselves are kept. This cannot be undone.';
export const CLIP_BYSTANDER_EXTRA = 'If clip saving is on, short stretches of sound from the room may be saved on this iPhone, and may include other people. Speech-like stretches are skipped.';

// ---- Morning stop, routine suggestion and Apple Health (mobile, v5). Appended; nothing above was changed.
// ---- The wake signal and the phone-stillness routine are unvalidated estimates. Apple Health is a separate source that is
// ---- shown next to our estimate and never merged with it. None of these lines says what the user did while asleep.
export const MORNING_PROMPT = 'Good morning. Stop recording?';
export const MORNING_ALERT_TITLE = 'Good morning';
export const MORNING_ALERT_BODY = 'Stop recording?';
export const morningAutoStoppedLine = (clock: string): string => `Auto-stopped at ${clock}`;
export const MORNING_ROW_TITLE = 'Morning stop';
export const MORNING_ROW_FOOTER =
  'SleepSmooth asks you at your wake time, or earlier if the phone sees movement and pickups after a quiet night. After 3 mornings in a row where you stop within 30 minutes of that signal, it can stop by itself 10 minutes after it. The signal is an unvalidated guess, not a measurement. Tapping Keep recording starts the learning over. A recording always ends by itself 30 minutes after your wake time.';
export const MORNING_ALWAYS_ASK_TITLE = 'Always ask me';
export const MORNING_ALWAYS_ASK_BODY = 'Never stop automatically, even after several mornings.';
export const MORNING_PREVIEW_LABEL = 'Preview of the Dynamic Island';
export const MORNING_PREVIEW_NOTE = 'Sample. Drawn in the app to show the layout. The real island is made by iOS.';
export const MORNING_KEEP_NOTE = 'Recording continues. Morning learning started over.';

export const ROUTINE_FIND_TITLE = 'Find my routine';
export const ROUTINE_FIND_BODY = 'Looks at how long this iPhone sat still overnight during the last 7 days to suggest sleep hours. It is an estimate from the phone, not a record of sleep. iOS will ask for Motion & Fitness access.';
export const ROUTINE_SOURCE_STILLNESS = 'Phone stillness (estimate)';
export const ROUTINE_SOURCE_HEALTH = 'From Apple Health';
export const ROUTINE_NEED_MORE = 'Not enough nights yet. It needs at least 3 nights of phone history to suggest hours.';
export const ROUTINE_DENIED = 'Motion & Fitness access is off for SleepSmooth. You can turn it on in the iPhone Settings app, or set your hours by hand.';
export const ROUTINE_UNAVAILABLE = 'Motion history is not available on this device or in this preview.';
export const ROUTINE_NOT_NOW = 'Not now';
export const ROUTINE_USE = 'Use this';
export const routineSuggestionLine = (bed: string, wake: string, nights: number, basis: 'phone-stillness' | 'apple-health' | 'mixed'): string =>
  `Looks like you usually sleep ${bed} to ${wake}, based on ${nights} ${nights === 1 ? 'night' : 'nights'} of ${basis === 'phone-stillness' ? 'phone stillness' : basis === 'apple-health' ? 'Apple Health records' : 'Apple Health records and phone stillness'}. Use this?`;
export const ROUTINE_APPLIED = 'Sleep hours updated. You can change them any time above.';

export const HEALTH_ROW_TITLE = 'Apple Health';
export const HEALTH_CONNECT = 'Connect Apple Health';
export const HEALTH_NOT_CONNECTED = 'Not connected';
export const HEALTH_UNAVAILABLE = 'Unavailable';
export const healthConnectedValue = (when: string | null): string => (when ? `Connected (last read ${when})` : 'Connected');
export const HEALTH_PURPOSE = 'Reads your recorded sleep and step history from the last 14 days to suggest your usual hours and to show next to a night. It only reads. It never writes to Health.';
export const HEALTH_DISCONNECT_NOTE = 'To stop sharing, open the Health app, tap your picture, choose Apps, then SleepSmooth, and turn the categories off. SleepSmooth cannot disconnect itself.';
export const HEALTH_UNAVAILABLE_BODY = 'Apple Health is not available in this build or on this device.';
export const HEALTH_NO_RECORDS = 'No sleep records were found in Apple Health for the last 14 days.';
export const HEALTH_SIDE_NOTE = 'From Apple Health. It is a separate source, shown next to SleepSmooth\'s own estimate and not combined with it. A match does not confirm either one.';
export const HEALTH_PLIST_USAGE = 'SleepSmooth reads your sleep and step history to suggest your usual sleep hours. It never writes to Health.';
export const MOTION_PLIST_USAGE = 'SleepSmooth reads how long your iPhone was still overnight, only when you tap Find my routine, to suggest your usual sleep hours.';
