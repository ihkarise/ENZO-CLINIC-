/**
 * ENZO Gut Health Score — the single authoritative source for question
 * wording, answer options, score bands, sub-score definitions, warning
 * signs and site settings. Nothing else in the app hard-codes any of this.
 *
 * The score bands below are PROPOSED EDUCATIONAL CATEGORIES. They have not
 * been clinically validated. Do not present them as diagnostic thresholds.
 */

/* ---------- site settings (edit these; never put secrets here) ---------- */
export const SITE = {
  clinicName: 'ENZO Homoeo Medical Centre',
  // Verified public booking URL. Left blank on purpose: the clinic app's
  // booking flow is staff-only (token-gated), so there is no public booking
  // route to link to yet. When blank, the CTA tells the visitor to contact
  // the clinic instead of showing a dead link.
  bookingUrl: '',
  // Approved privacy-policy URL. Footer link is hidden while blank.
  privacyUrl: '',
  // National emergency number shown on the warning-sign result. 112 is
  // India's Emergency Response Support System number. Verify it is correct
  // for the clinic's region before go-live.
  emergencyNumber: '112',
  emergencyLabel: 'National emergency number (India)'
};

/* ---------- questionnaire ---------- */
const DAYS_OPTIONS = Object.freeze([
  { value: 0, label: 'Never', detail: '0 days' },
  { value: 1, label: 'Rarely', detail: '1–2 days' },
  { value: 2, label: 'Sometimes', detail: '3–6 days' },
  { value: 3, label: 'Frequently', detail: '7–14 days' }
]);

const FREQUENCY_OPTIONS = Object.freeze([
  { value: 0, label: 'Never', detail: '' },
  { value: 1, label: 'Rarely', detail: '' },
  { value: 2, label: 'Sometimes', detail: '' },
  { value: 3, label: 'Frequently', detail: '' }
]);

export const ASSESSMENT = Object.freeze({
  assessmentId: 'enzo-gut-health-score',
  version: '1.0.0',
  maxScore: 24,
  periodDays: 14,
  questions: Object.freeze([
    { id: 'q1', order: 1, title: 'Bloating', required: true, options: DAYS_OPTIONS,
      text: 'During the past 14 days, on how many days have you experienced bloating or a feeling of fullness in your abdomen?' },
    { id: 'q2', order: 2, title: 'Gas and abdominal discomfort', required: true, options: DAYS_OPTIONS,
      text: 'During the past 14 days, on how many days have you experienced troublesome gas, excessive burping or abdominal discomfort?' },
    { id: 'q3', order: 3, title: 'Acidity and reflux', required: true, options: DAYS_OPTIONS,
      text: 'During the past 14 days, on how many days have you experienced heartburn, acid reflux or a burning sensation in your chest or upper abdomen?' },
    { id: 'q4', order: 4, title: 'Abdominal pain', required: true, options: DAYS_OPTIONS,
      text: 'During the past 14 days, on how many days have you experienced abdominal pain or cramps?' },
    { id: 'q5', order: 5, title: 'Bowel regularity', required: true, options: DAYS_OPTIONS,
      text: 'During the past 14 days, on how many days have you experienced constipation, hard stools, loose stools or difficulty maintaining your usual bowel pattern?',
      help: 'Select the frequency of the days on which any of these problems occurred.' },
    { id: 'q6', order: 6, title: 'Incomplete bowel movement', required: true, options: DAYS_OPTIONS,
      text: 'During the past 14 days, on how many days have you felt that your bowel movement was incomplete after passing stool?' },
    { id: 'q7', order: 7, title: 'Food-related symptoms', required: true, options: DAYS_OPTIONS,
      text: 'During the past 14 days, on how many days have you noticed digestive symptoms after eating a meal or particular food?' },
    { id: 'q8', order: 8, title: 'Impact on daily life', required: true, options: FREQUENCY_OPTIONS,
      text: 'During the past 14 days, how often have digestive symptoms interfered with your work, daily activities, sleep or overall comfort?' }
  ])
});

/* ---------- sub-scores (raw sums; maxima differ, see results copy) ---------- */
export const SUBSCORES = Object.freeze([
  { id: 'bloatingGas', label: 'Bloating and gas', questions: ['q1', 'q2'], max: 6 },
  { id: 'acidity', label: 'Acidity and reflux', questions: ['q3'], max: 3 },
  { id: 'pain', label: 'Abdominal pain', questions: ['q4'], max: 3 },
  { id: 'bowel', label: 'Bowel function', questions: ['q5', 'q6'], max: 6 },
  { id: 'food', label: 'Food-related symptoms', questions: ['q7'], max: 3 },
  { id: 'impact', label: 'Daily-life impact', questions: ['q8'], max: 3 }
]);

/* ---------- result bands (must cover 0–24 exactly once; tested) ---------- */
export const BANDS = Object.freeze([
  { id: 'low', min: 0, max: 4, label: 'Low reported symptom burden',
    interpretation: 'Your responses indicate relatively few digestive symptoms during the past 14 days.',
    nextStep: 'Maintain healthy routines and monitor any symptoms that develop or persist.' },
  { id: 'mild', min: 5, max: 9, label: 'Mild digestive concerns',
    interpretation: 'You have reported some digestive symptoms that may occur occasionally or around particular meals.',
    nextStep: 'Track symptoms and meal patterns. Seek advice if symptoms persist or worsen.' },
  { id: 'moderate', min: 10, max: 16, label: 'Moderate reported symptoms',
    interpretation: 'Your responses indicate a more noticeable burden of digestive symptoms.',
    nextStep: 'Consider a healthcare professional’s assessment, particularly if symptoms interfere with daily life.' },
  { id: 'high', min: 17, max: 24, label: 'High reported symptom burden',
    interpretation: 'You have reported frequent digestive symptoms or substantial symptom-related impact.',
    nextStep: 'Arrange a medical evaluation to understand possible causes and appropriate treatment.' }
]);

export const BAND_SAFETY_NOTE =
  'A low score does not rule out disease, and a high score does not automatically indicate a serious condition.';

/* ---------- warning signs (never added to the score) ----------
   urgent: true → emergency-assessment guidance.
   urgent: false → timely medical evaluation guidance. */
export const NONE_ID = 'none';
export const WARNING_SIGNS = Object.freeze([
  { id: 'blood', label: 'Blood in my stool or vomit', urgent: true },
  { id: 'blackStool', label: 'Black, tarry stools', urgent: true },
  { id: 'weightLoss', label: 'Unexplained weight loss', urgent: false },
  { id: 'vomiting', label: 'Persistent vomiting', urgent: false },
  { id: 'swallowing', label: 'Difficulty or pain while swallowing', urgent: false },
  { id: 'severePain', label: 'Severe or persistent abdominal pain', urgent: true },
  { id: 'swelling', label: 'Significant or persistent abdominal swelling', urgent: false },
  { id: 'jaundice', label: 'Yellowing of the eyes or skin', urgent: false },
  { id: 'chest', label: 'Chest pain or breathing difficulty', urgent: true }
]);

/* ---------- fixed copy ---------- */
export const COPY = Object.freeze({
  disclaimer: 'The ENZO Gut Health Score™ is an educational symptom-assessment tool developed by ENZO Homoeo Medical Centre. It is not a clinically validated diagnostic instrument and cannot diagnose or rule out any medical condition. Results are based on self-reported symptoms during the previous 14 days and should not replace professional medical evaluation. Persistent, severe or concerning symptoms require assessment by a qualified healthcare professional. The score does not establish the cause of symptoms or determine the suitability of any particular treatment.',
  ctaHeading: 'Want to understand your digestive symptoms better?',
  ctaBody: 'A personalised assessment can help explore your symptoms, medical history and whether further investigations or specialist evaluation are appropriate.',
  ctaButton: 'Book a Consultation',
  noElevated: 'No elevated symptom category was identified by these responses.',
  noWarnings: 'None of the listed warning signs were reported in this assessment.',
  rawScoreNote: 'These are raw scores. Bloating and gas and Bowel function each combine two questions (out of 6); the other areas are single questions (out of 3). Comparing them does not establish medical priority.'
});
