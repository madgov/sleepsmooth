// New copy (IOS_DESIGN.md section 8), keyed by N-id. Strings that live in src/content/claims.ts are imported from there
// via @core, never retyped. N-01 is kept here for now; the orchestrator will move it into claims.ts.
// Gated strings (N-03, N-04, N-05, N-06, the last sentence of N-21, N-25, N-31) render their safe fallback until
// CLAIMS_VERIFIED says the named device test has passed.
import { CLIP_BYSTANDER_EXTRA } from '../../../src/content/claims';
import { CLAIMS_VERIFIED, type ClaimsVerified } from './flags';

export const COPY = {
  N01_NOT_A_DIAGNOSIS: 'Not a diagnosis',
  N02_WHAT_IT_CAN_DO: 'What it can do',
  N07_DELETE_ANYTIME: 'You can delete everything at any time in Settings.',
  N08_CONSENT: 'I agree to overnight sound analysis on this phone, as described above.',
  N09_MIC_TITLE: 'Listens only after you tap Start',
  N10_ORANGE_DOT: 'Your iPhone shows an orange dot while the microphone is in use. This is a system indicator and cannot be hidden.',
  N10B_MIC_ALLOWED: 'Microphone is allowed',
  N11_MIC_OFF: 'Microphone is off. You can turn it on later in Settings. You can still look at the sample night.',
  N12_SLEEP_TITLE: 'When do you sleep?',
  N13_SLEEP_BODY: 'Used to time your reminder and to stop recording in the morning.',
  N14_IN_BED: (duration: string) => `That is ${duration} in bed.`,
  N15_REMINDER_NOTE: 'A notification when it is time to start recording. You tap it to begin.',
  N16_NOTIFS_OFF: 'Notifications are off. You can start recording from the Audio tab any time.',
  N17_ABOUT_TITLE: 'Add your answers (optional)',
  N18_ABOUT_BODY:
    'A short questionnaire score (NoSAS) and a symptom checklist. They help the results show what you reported next to what a recording shows. About 2 minutes.',
  N19_ABOUT_LOCAL: 'Height, weight, age and sex stay on this phone.',
  N20_FIRST_NIGHT_TITLE: 'Before your first night',
  N22_BYSTANDER_ACK: 'I have told anyone sharing the room',
  N23_YOURE_SET: "You're set",
  N24_TONIGHT: 'Tonight',
  N26_SET_SLEEP_HOURS: 'Set your sleep hours',
  N27_BATTERY_TIP: 'Recording uses battery. Plugging in your phone is recommended.',
  N28_BEFORE_YOU_START: 'Before you start',
  N30_STARTING_IN: (n: number) => `Starting in ${n}...`,
  N32_ROOM_LEVEL: 'Room sound level',
  N33_METER_CAPTION: 'Shows that the microphone is hearing sound. It does not measure your breathing.',
  N34_ENDS_AT: (time: string) => `We'll ask about stopping at ${time}. It ends by itself 30 minutes later.`,
  N35_STOP_TITLE: 'Stop recording?',
  N36_STOP_BODY: 'The night so far will be summarized on this phone.',
  N37_NO_AUDIO: 'Not receiving audio',
  N38_INTERRUPTED: 'Recording interrupted',
  N39_TRYING: 'Trying to continue.',
  N40_ENDED_AT: (time: string) => `Recording ended at ${time}`,
  N41_REASON_SCHEDULED: 'Recording ended at your wake time.',
  N42_REASON_INTERRUPTED: 'A call, alarm, or another app interrupted the recording.',
  N43_REASON_KILLED: 'Recording ended unexpectedly. The part that was recorded was kept.',
  N44_REASON_BATTERY: 'Recording ended because the battery was low.',
  N45_REASON_MIC: 'The microphone became unavailable.',
  N46_REASON_STORAGE: 'Recording ended because the phone could not save the results.',
  N47_PART_NOT_CAPTURED: 'Part of the night was not captured.',
  N48_MIC_OFF_TITLE: 'Microphone is off',
  N49_MIC_OFF_BODY: 'SleepSmooth needs the microphone to listen during your night. You can turn it on in Settings.',
  N50_SUMMARIZING: 'Summarizing your night',
  N51_ON_PHONE: 'This happens on your phone.',
  N52_READY: 'Your night summary is ready',
  N53_FAILED: 'The summary could not be finished.',
  N54_NOT_AFFECTED: 'Your answers and settings are not affected.',
  N55_LOOK_AT_SAMPLE: 'Look at a sample night',
  N56_OBSERVED_ON: (k: number, m: number) => `Observed on ${k} of ${m} assessed nights`,
  N57_VARIED: 'Nights varied',
  N58_RECORDED: (h: number, m: number) => `Recorded ${h} h ${m} min`,
  N59_NOT_ASSESSED: 'Not assessed',
  N60_SAMPLE: 'Sample',
  N61_ESTIMATE_LINE: 'Estimated sleep window (unvalidated estimate). The phone cannot tell sleep from lying quietly awake.',
  N62_LEGEND: { asleep: 'Estimated asleep', uncertain: 'Uncertain', awake: 'Awake or not captured' },
  N63_SIGNALS: (used: string, n: number, total: number) => `Signals used: ${used} (${n} of ${total}).`,
  N64_SENSITIVITY: (a: number, b: number) => `For context, by the rough estimate: ${a} snore-like windows in likely-asleep time, ${b} including uncertain time. The totals count all recorded time.`,
  N65_DELETE_NIGHT: 'Delete this night',
  N68_NO_ESTIMATE: 'No sleep-window estimate for this night.',
  N73_CONSENT_ROW: 'Overnight sound consent',
  N74_WITHDRAW: 'Withdraw consent',
  N75_DELETE_CONFIRM: 'Delete everything on this phone? This removes every night, your answers, sleep hours, consent, and scheduled reminders. This cannot be undone.',
  N76_DELETE_ERROR: 'Some data could not be deleted. Try again.',
  N77_DISCARD: 'Discard your answers?',
  NDELDONE: 'Your data was deleted from this phone.',
  // Chrome (N-C)
  C: {
    continue: 'Continue',
    back: 'Back',
    skip: 'Skip',
    notNow: 'Not now',
    done: 'Done',
    cancel: 'Cancel',
    close: 'Close',
    openSettings: 'Open Settings',
    agree: 'Agree and continue',
    allowMic: 'Allow microphone',
    answerNow: 'Answer now',
    later: 'Later',
    goToAudio: 'Go to Audio tab',
    tryAgain: 'Try again',
    retry: 'Retry',
    suggested: 'Suggested',
    startRecording: 'Start recording',
    stopRecording: 'Stop recording',
    keepRecording: 'Keep recording',
    stopAndSummarize: 'Stop and summarize',
    questionOf: (n: number, m: number) => `Question ${n} of ${m}`,
    discard: 'Discard',
    keepEditing: 'Keep editing',
    delete: 'Delete',
    notAnswered: 'Not answered',
    answered: 'Answered',
    added: 'Added',
    yes: 'Yes',
    no: 'No',
    off: 'Off',
    on: 'On',
    allowed: 'Allowed',
    viewThisNight: 'View this night',
    startAgain: 'Start recording again',
    reviewLastNight: 'Review last night',
    couldNotSave: 'Could not save. Try again.',
    metric: 'Metric (cm, kg)',
    imperial: 'Imperial (in, lb)',
    male: 'Male',
    female: 'Female',
  },
  // Honest-implementation notes for this build (not part of the approved N-list; labelled in the UI as build notes).
  N72_NEXT_STEPS_STORAGE: 'Ticks are saved on this iPhone only and are removed by "Delete my data".',
  BUILD_NOTE_SAMPLE_ONLY: 'No recorded nights yet. A night you record on this phone appears here.',
  RECORDING_STOPPED: 'Recording stopped',
  SIMULATED_INPUT: 'Simulated input (development build only)',
  REMINDER_TITLE: 'Time to start tonight?',
  REMINDER_BODY: 'Open SleepSmooth and tap Start when you are in bed.',
} as const;

// ---- Gated strings: a function so the gate is read at render time, and testable by passing a flags object. ----------

export function privacyTitle(f: ClaimsVerified = CLAIMS_VERIFIED): string {
  return f.noNetworkVerified ? 'Your night stays on your phone' : 'About your privacy';
}

export interface PrivacyRow {
  id: 'N04' | 'N05' | 'N06' | 'N07';
  symbol: 'waveform' | 'iphone' | 'list.bullet' | 'trash';
  text: string;
}

/** `clipsEnabled`: the user opted in to saving a few short clips. Then no "audio is not saved" sentence may appear. */
export function privacyRows(f: ClaimsVerified = CLAIMS_VERIFIED, clipsEnabled = false): PrivacyRow[] {
  const rows: PrivacyRow[] = [];
  rows.push({
    id: 'N04',
    symbol: 'waveform',
    text: clipsEnabled
      ? 'Sound is analyzed on this phone while you record. You chose to keep a few short clips on this phone.'
      : f.audioNotWrittenVerified
        ? 'Sound is analyzed on this phone and discarded within seconds. Recordings are not saved.'
        : 'Sound is analyzed on this phone while you record.',
  });
  if (f.noUploadNoTrackingVerified) rows.push({ id: 'N05', symbol: 'iphone', text: 'Nothing is uploaded. There are no accounts and no tracking.' });
  rows.push({
    id: 'N06',
    symbol: 'list.bullet',
    text: clipsEnabled
      ? 'What is kept: short summaries of each 30-second stretch, your answers, your sleep hours, and the clips you chose to keep.'
      : f.audioNotWrittenVerified
      ? 'What is kept: short summaries of each 30-second stretch (sound levels and counts), your answers, and your sleep hours.'
      : 'Your answers and sleep hours are kept on this phone.',
  });
  rows.push({ id: 'N07', symbol: 'trash', text: COPY.N07_DELETE_ANYTIME });
  return rows;
}

/** N-21. The last sentence is gated like N-04. */
export function bystanderNotice(f: ClaimsVerified = CLAIMS_VERIFIED, clipsEnabled = false): string {
  const base = 'Others sleeping in the room may be audible. Tell them before you record. Recording laws vary by place.';
  if (clipsEnabled) return `${base} ${CLIP_BYSTANDER_EXTRA}`;
  return f.audioNotWrittenVerified ? `${base} SleepSmooth does not keep audio.` : base;
}

/** N-25. */
export function idleSubcopy(f: ClaimsVerified = CLAIMS_VERIFIED): string {
  return f.lockedScreenVerified ? 'Tap once when you are in bed. Recording continues with the screen locked.' : 'Tap once when you are in bed.';
}

/** N-31. Returns null (renders nothing) until the locked-screen test has passed. */
export function lockNote(f: ClaimsVerified = CLAIMS_VERIFIED): string | null {
  return f.lockedScreenVerified ? 'You can lock your phone now. Recording continues.' : null;
}

/** Gated: only after the device check that the clips folder is excluded from backup. Null renders nothing. */
export function clipBackupNote(f: ClaimsVerified = CLAIMS_VERIFIED): string | null {
  return f.clipsLocalOnlyVerified ? 'Clips are kept out of iPhone backups.' : null;
}

// ---- Automatic recording at bedtime (Shortcuts) and the first-entry primer. HONEST: iOS only lets the user create the
// ---- automation, so every line says "you set it up" and nothing claims it is active until a start was actually seen.
export const AUTO = {
  CARD_TITLE: 'Record automatically at bedtime?',
  CARD_BODY: 'iOS requires you to create the automation yourself. It takes about 30 seconds.',
  CARD_SET_UP: 'Set it up',
  CARD_NOT_NOW: 'Not now',
  GUIDE_TITLE: 'Automatic recording',
  GUIDE_INTRO: 'iOS requires you to create the automation yourself. It takes about 30 seconds. SleepSmooth cannot do it for you.',
  STEP1_TITLE: 'Open Shortcuts and start a new automation',
  STEP1_BODY: 'In the Shortcuts app, tap Automation, then the plus button to make a new one.',
  STEP2_TITLE: 'Pick a time and choose Run Immediately',
  STEP2_BODY: 'Choose Sleep (Bedtime or Wind Down) or Time of Day. Then pick Run Immediately, so it does not ask each night.',
  STEP3_TITLE: 'Add the action Start SleepSmooth overnight check',
  STEP3_BODY: 'Search for SleepSmooth when adding an action and pick Start SleepSmooth overnight check.',
  OPEN_SHORTCUTS: 'Open Shortcuts',
  STOP_TITLE: 'Optional: stop at wake time',
  STOP_BODY: 'Make a second automation at your wake time with the action Stop SleepSmooth overnight check. Without it, the night ends at your wake time anyway.',
  STANDING_ACK: 'I understand an automatic start records in the room without asking each night, and I have told others who sleep there.',
  DONE: "Done, I've set it up",
  NOT_SEEN: 'SleepSmooth will show when it has actually seen the automation start a night. Until then it is shown as set up, not yet seen running.',
  BACKGROUND_LIMIT: 'Whether iOS lets the microphone start while the phone is locked is not confirmed in this build. If a night did not start, open SleepSmooth and tap Record.',
  ROW_TITLE: 'Automatic recording',
  RECORD_NEEDS_CONSENT: 'Automatic recording only works after you have agreed to overnight recording.',
  FIRST_ENTRY_TITLE: 'Before your first night',
  FIRST_ENTRY_AGREE: 'Agree and continue',
  FIRST_ENTRY_NOT_NOW: 'Not now',
  FIRST_ENTRY_DONE: 'Close',
} as const;

export const EXPO_GO = {
  SHEET_TITLE: 'Recording needs the full SleepSmooth build',
  SHEET_BODY: "This preview can't use the microphone overnight. Nothing is being recorded, and nothing here is faked.",
  WHAT_WORKS: 'What you can try here: the screens, the questionnaire, the sample night and its sample clips (all labelled Sample).',
  WHAT_NOT: 'What needs the full build: recording, listening to clips, the lock screen Live Activity, and automatic recording.',
  OK: 'OK',
  BANNER: 'Preview in Expo Go. Recording is off.',
} as const;
