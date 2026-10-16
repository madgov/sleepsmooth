// Copy for the optional bed-partner step. Everything here is wording for what SOMEONE ELSE noticed, as relayed by the user.
// It is not scored, not part of NoSAS, and never describes a medical event as confirmed.

export const PARTNER_SOURCE_LABEL = 'user-reported (partner)';
export const PARTNER_STEP_TITLE = 'Anyone who sleeps near you';
export const PARTNER_STEP_NOTE = 'Optional. Skip it if you like. What someone else noticed is passed along by you. It is not scored, and it is not part of the NoSAS screening score.';
export const PARTNER_PRESENCE_QUESTION = 'Does anyone sleep near you, or has anyone told you about your sleep?';
export const PARTNER_PRESENCE_OPTIONS = { yes: 'Yes', alone: 'No, I sleep alone', unsure: 'Not sure' } as const;
export const PARTNER_NOTICED_QUESTION = 'What have they noticed?';
export const PARTNER_NOTICED_HINT = 'Choose how often for each one. Reported by someone else, so it cannot be checked here.';
export const PARTNER_FREQUENCY_LABELS = { rarely: 'Rarely', sometimes: 'Sometimes', often: 'Often', 'not-sure': 'Not sure' } as const;
export const PARTNER_ITEM_LABELS = {
  'loud-snoring': 'Loud snoring',
  'breathing-pauses': 'Pauses in breathing',
  'gasping-choking': 'Gasping or choking',
  'restless-sleep': 'Restless sleep',
  nothing: 'Nothing noticed',
} as const;
export const PARTNER_ALONE_NOTE =
  'Without a partner, the overnight recording and the morning clip review are the main way to notice snoring. Having no one to report on your sleep does not rule anything out.';
export const PARTNER_SUMMARY_TITLE = 'Reported by a bed partner';
export const PARTNER_SUMMARY_LEAD = `Source: ${PARTNER_SOURCE_LABEL}. Passed along by the user. Not measured, not scored, and not part of the NoSAS score.`;
export const PARTNER_SUMMARY_NONE = 'No partner observations were entered.';
export const PARTNER_SUMMARY_ALONE = 'The user sleeps alone, so no partner observations are available. That does not rule anything out.';
export const PARTNER_SUMMARY_UNSURE = 'The user was not sure whether anyone has observed their sleep.';
export const PARTNER_SUMMARY_NOTHING = 'The person who observed their sleep noticed none of the listed items.';
export const PARTNER_SUMMARY_CAVEAT = 'Reports like these cannot confirm or rule out sleep apnea. Ask the partner to describe what they saw directly to the clinician if possible.';
export const PARTNER_CLIP_LABEL = 'Partner';
