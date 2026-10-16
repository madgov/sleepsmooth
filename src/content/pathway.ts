// Next-step pathway guide copy (research item #4, #12, #13). Shared by web and iOS.
// General information only. Nothing here recommends a test or a treatment. Sources are quoted from docs/research/03_CLINICAL_PATHWAY.md.
// Kept out of claims.ts (shared, append-only). The ER-8 forbidden-phrase scan covers this file.

export interface PathwaySource {
  label: string;
  url: string;
}

export const PATHWAY_HEADING = 'How sleep apnea is usually checked';
export const PATHWAY_INTRO = 'A general outline. Your clinician decides what fits you.';

export interface PathwayStep {
  id: string;
  title: string;
  body: string;
  source?: PathwaySource;
}

const SRC_AASM: PathwaySource = { label: 'AASM adult testing guideline, 2017', url: 'https://aasm.org/wp-content/uploads/2017/07/diagnostic-testing-OSA.pdf' };

export const PATHWAY_STEPS: PathwayStep[] = [
  {
    id: 'primary',
    title: '1. Primary care or a sleep specialist',
    body: 'You usually start with your regular doctor or clinic, or go straight to a sleep specialist if you already have one. They ask about your symptoms, medicines and other health conditions. Testing is meant to follow this kind of full evaluation, not replace it.',
    source: SRC_AASM,
  },
  {
    id: 'specialist',
    title: '2. Possibly a sleep specialist',
    body: 'Your clinician may refer you to a sleep specialist, or order a test themselves. Whether you need a referral can depend on your clinic and your insurance, so it is worth asking.',
  },
  {
    id: 'hsat',
    title: '3a. Home sleep apnea test (HSAT)',
    body: 'A portable recorder you use in your own bed. AASM accepts it as an option for adults without other major health problems whose clinician thinks they have an increased chance of moderate-to-severe sleep apnea. In the guideline, that means excessive sleepiness plus at least two of: habitual loud snoring, witnessed gasping or choking, and high blood pressure that a clinician has already recorded.',
    source: SRC_AASM,
  },
  {
    id: 'psg',
    title: '3b. In-lab sleep study (polysomnography)',
    body: 'An overnight study at a sleep centre, with more sensors than a home test. AASM advises this kind of study rather than a home test for people with significant heart or lung disease, muscle weakness affecting breathing, long-term opioid use, a past stroke, or severe insomnia. It also advises one after a home test that is negative or did not record enough.',
    source: { label: 'AASM-hosted payer scorecard, 2017', url: 'https://aasm.org/wp-content/uploads/2020/11/eviCore_Revised_Scorecard_June_2017.pdf' },
  },
  {
    id: 'results',
    title: '4. Results, then follow-up',
    body: 'Only a sleep test ordered by a clinician can confirm or exclude sleep apnea. If it is confirmed, your clinician talks through options and follow-up. Which test and which option fit is your clinician’s decision, not this app’s.',
  },
];

export const TREATMENTS_HEADING = 'Treatments clinicians may discuss';
export const TREATMENTS_LABEL = 'Options to discuss, not advice';
export const TREATMENTS_NOTE = 'This list is not ranked and is not a recommendation. Whether any option applies depends on your test results and health.';

export interface TreatmentOption {
  id: string;
  name: string;
  body: string;
  source: PathwaySource;
}

export const TREATMENT_OPTIONS: TreatmentOption[] = [
  {
    id: 'pap',
    name: 'Positive airway pressure (PAP)',
    body: 'A mask worn at night that gently blows air to keep the airway open. AASM-linked guidance supports it for adults who are sleepy because of sleep apnea.',
    source: { label: 'BCBSND policy summary of AASM-linked guidance', url: 'https://www.bcbsnd.com/providers/policies-precertification/medical-policy/diagnosis-and-treatment-of-obstructive-sleep-apnea-for-adults' },
  },
  {
    id: 'oral',
    name: 'Oral appliance',
    body: 'A custom mouthpiece made by a dentist. It is covered by joint AASM and American Academy of Dental Sleep Medicine guidance from 2015.',
    source: { label: 'AASM/AADSM 2015 (content not reviewed for this app)', url: 'https://aasm.org/wp-content/uploads/2018/01/MedicalTherapyOSA-Guideline-at-a-Glance.pdf' },
  },
  {
    id: 'positional',
    name: 'Positional therapy',
    body: 'Changing sleep position, for example avoiding sleeping on your back. AASM describes it as a secondary or add-on approach.',
    source: { label: 'AASM guideline at a glance', url: 'https://aasm.org/wp-content/uploads/2018/01/MedicalTherapyOSA-Guideline-at-a-Glance.pdf' },
  },
  {
    id: 'tirzepatide',
    name: 'Tirzepatide (Zepbound), for obesity-related sleep apnea',
    body: 'A prescription medicine the FDA approved on 20 December 2024 for adults with obesity and moderate-to-severe sleep apnea, alongside diet and activity. AASM noted it only works for obesity-related sleep apnea and may not cure it. Medicines are a prescriber’s decision.',
    source: { label: 'FDA announcement, Dec 2024', url: 'https://www.fda.gov/news-events/press-announcements/fda-approves-first-medication-obstructive-sleep-apnea' },
  },
  {
    id: 'hgns',
    name: 'Hypoglossal nerve stimulation',
    body: 'A surgically placed implant. It is generally considered a second-line option for moderate-to-severe sleep apnea when PAP is not tolerated, and insurers’ body-mass limits vary.',
    source: { label: 'AAO-HNS position, via systematic review', url: 'https://resolve.cambridge.org/core/services/aop-cambridge-core/content/view/4FD2B80D4B4D04DEC66E2A4C27ECCCCA/S0022215125000295a.pdf/hypoglossal-nerve-stimulation-in-patients-outside-the-star-trial-criteria-a-systematic-review.pdf' },
  },
];

export const QUESTIONS_HEADING = 'Questions to ask';
export const QUESTIONS_LIST = [
  'Is a home test right for me, or should I have a sleep study at a sleep centre?',
  'What is the self-pay price of the test?',
  'Does my insurance need a referral?',
  'Are telehealth options available?',
  'How long is the wait for an appointment and for the test?',
];
export const QUESTIONS_COST_LINE = 'Costs and waits vary; ask the clinic and your insurer.';
export const QUESTIONS_SOURCE_NOTE = 'No current US price or wait-time figures were verified for this app, so none are shown.';

export const SCRIPT_HEADING = 'What you could say';
export const SCRIPT_LABEL = 'A suggested starting point, not validated.';
export const SCRIPT_BUILT_NOTE = 'Built from your own answers and recordings on this device. Change anything after you copy or share it. Nothing is sent anywhere unless you share it.';
export const SCRIPT_EMPTY_NOTE = 'You have not answered the questions or recorded a night yet, so this script has fewer facts. It still works as an opening.';
export const SCRIPT_COPY = 'Copy script';
export const SCRIPT_COPIED = 'Copied';
export const SCRIPT_COPY_FAILED = 'Could not copy. Select the text and copy it yourself.';
export const SCRIPT_SHARE = 'Share script';
export const SCRIPT_BASIS_NOTE = 'Design basis: patient-generated data is easier for clinicians to use when it is short and labelled by source. This script has not been tested with clinicians.';

export const TRACKER_HEADING = 'Follow-through tracker';
export const TRACKER_LABEL = 'Optional. An unproven aid.';
export const TRACKER_NOTE =
  'Nothing here nags you or counts days. Ticks stay on this device. One small trial found that people attended a sleep assessment more often after receiving education booklets (30% versus 11%); the main barriers were time, symptoms improving and the cost of the test. Whether a tracker like this helps is untested.';
export const TRACKER_SOURCE: PathwaySource = { label: 'Randomised trial of booklets and sleep-assessment attendance (PMC7790540)', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7790540/' };
export const TRACKER_ITEMS: { id: string; label: string }[] = [
  { id: 'track-talked', label: 'Talked to a clinician' },
  { id: 'track-asked', label: 'Asked about a sleep test' },
  { id: 'track-booked', label: 'Test booked' },
  { id: 'track-done', label: 'Test done' },
];
export const REMINDER_HEADING = 'One optional reminder';
export const REMINDER_NOTE = 'A single note to yourself, on the day you choose. It repeats nothing. Turn it off any time.';
export const REMINDER_WEB_NOTE = 'Reminders are available in the iPhone app. This page cannot send one.';
export const REMINDER_DENIED = 'Notifications are turned off for SleepSmooth, so no reminder was set. You can allow them in Settings.';
export const REMINDER_FAILED = 'The reminder could not be set.';
export const REMINDER_OFF = 'Remove reminder';
export const REMINDER_NOTIF_TITLE = 'SleepSmooth reminder';
export const REMINDER_NOTIF_BODY = 'A note you set for yourself.';

export const SCOPE_HEADING = 'Who this is for';
export const SCOPE_ADULTS = 'SleepSmooth is for adults. It is not built for children or for pregnancy.';
export const SCOPE_CHILDREN =
  'If a child or teenager snores or sleeps badly, talk to a pediatrician. The American Academy of Pediatrics recommends that children be screened for snoring and prefers an overnight sleep study as the test.';
export const SCOPE_PREGNANCY =
  'If you are pregnant, talk to your prenatal clinician. The US Preventive Services Task Force guidance on adult sleep apnea does not cover pregnancy, and some common questionnaires work less well in pregnancy.';
export const SCOPE_SOURCES: PathwaySource[] = [
  { label: 'USPSTF 2022, scope', url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/obstructive-sleep-apnea-in-adults-screening' },
  { label: 'AAP 2012 (PubMed)', url: 'https://pubmed.ncbi.nlm.nih.gov/22926173/' },
];

export const DIFFERENT_HEADING = 'Symptoms can look different';
export const DIFFERENT_INTRO = 'For everyone: a questionnaire result or a quiet recording cannot rule out sleep apnea, and these groups are where such tools work least well.';
export const DIFFERENT_POINTS = [
  'Women often describe tiredness, trouble sleeping, low mood or poor sleep rather than loud snoring. Sleep apnea in women is thought to be missed more often.',
  'People who are not overweight can have sleep apnea. In one study of younger, leaner people referred to a sleep clinic, a common questionnaire did little better than chance. NoSAS gives a body mass index of 25 to 30 only 3 points, so someone with sleep apnea can still score under its cut-off.',
  'In older adults, NoSAS has been found to be less accurate.',
  'If you feel unrefreshed or sleepy in the day, it is reasonable to raise it with a clinician whatever any result says.',
];
export const DIFFERENT_SOURCES: PathwaySource[] = [
  { label: 'NICE NG202 rationale (women and STOP-Bang)', url: 'https://www.nice.org.uk/guidance/ng202/chapter/Rationale-and-impact' },
  { label: 'NoSAS in older adults (PMC6977329)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6977329' },
  { label: 'Women and sleep apnea review (PMC8461585)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8461585' },
];
