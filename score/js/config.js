/**
 * ENZO Gut Health Score — structure and settings (language-neutral).
 * All visible wording, in English and Malayalam, lives in js/i18n.js.
 *
 * The score bands below are PROPOSED EDUCATIONAL CATEGORIES. They have not
 * been clinically validated. Do not present them as diagnostic thresholds.
 */

/* ---------- site settings (edit these; never put secrets here) ---------- */
export const SITE = {
  clinicName: 'ENZO Homoeo Medical Centre',
  // Clinic WhatsApp Business number: country code + number, digits only.
  // The "Send my score" and "Book a Consultation" buttons open a WhatsApp
  // chat with this number, with the visitor's result already typed in.
  whatsappNumber: '919986319779',
  // Optional separate booking web page. When blank, "Book a Consultation"
  // also opens WhatsApp (with a booking message).
  bookingUrl: '',
  // Approved privacy-policy URL. Footer link is hidden while blank.
  privacyUrl: '',
  // 112 is India's national Emergency Response Support System number.
  emergencyNumber: '112',
  // Optional photos. Replace these files with real photos of the same name
  // (see SETUP-GUIDE.md for sizes). The shipped files are 1×1 placeholders
  // and stay hidden until replaced, so nothing looks broken meanwhile.
  photos: {
    hero: 'assets/photos/hero.jpg',      // intro page, replaces the illustration
    doctor: 'assets/photos/doctor.jpg'   // round photo on the WhatsApp card
  }
};

export const LANGS = Object.freeze([
  { id: 'en', label: 'English', htmlLang: 'en' },
  { id: 'ml', label: 'മലയാളം', htmlLang: 'ml' }
]);

/* ---------- questionnaire (wording per language in i18n.js) ----------
   optionSet 'days': Never 0 days / Rarely 1–2 / Sometimes 3–6 / Frequently 7–14
   optionSet 'freq': Never / Rarely / Sometimes / Frequently
   Points are always 0, 1, 2, 3 in that order. */
export const ASSESSMENT = Object.freeze({
  assessmentId: 'enzo-gut-health-score',
  version: '1.1.0',
  maxScore: 24,
  periodDays: 14,
  points: Object.freeze([0, 1, 2, 3]),
  questions: Object.freeze([
    { id: 'q1', order: 1, optionSet: 'days', required: true },
    { id: 'q2', order: 2, optionSet: 'days', required: true },
    { id: 'q3', order: 3, optionSet: 'days', required: true },
    { id: 'q4', order: 4, optionSet: 'days', required: true },
    { id: 'q5', order: 5, optionSet: 'days', required: true, hasHelp: true },
    { id: 'q6', order: 6, optionSet: 'days', required: true },
    { id: 'q7', order: 7, optionSet: 'days', required: true },
    { id: 'q8', order: 8, optionSet: 'freq', required: true }
  ])
});

/* ---------- sub-scores (raw sums; maxima differ, see results copy) ---------- */
export const SUBSCORES = Object.freeze([
  { id: 'bloatingGas', questions: ['q1', 'q2'], max: 6 },
  { id: 'acidity', questions: ['q3'], max: 3 },
  { id: 'pain', questions: ['q4'], max: 3 },
  { id: 'bowel', questions: ['q5', 'q6'], max: 6 },
  { id: 'food', questions: ['q7'], max: 3 },
  { id: 'impact', questions: ['q8'], max: 3 }
]);

/* ---------- result bands (must cover 0–24 exactly once; tested) ---------- */
export const BANDS = Object.freeze([
  { id: 'low', min: 0, max: 4 },
  { id: 'mild', min: 5, max: 9 },
  { id: 'moderate', min: 10, max: 16 },
  { id: 'high', min: 17, max: 24 }
]);

/* ---------- warning signs (never added to the score) ----------
   urgent: true → emergency-assessment guidance.
   urgent: false → timely medical evaluation guidance. */
export const NONE_ID = 'none';
export const WARNING_SIGNS = Object.freeze([
  { id: 'blood', urgent: true },
  { id: 'blackStool', urgent: true },
  { id: 'weightLoss', urgent: false },
  { id: 'vomiting', urgent: false },
  { id: 'swallowing', urgent: false },
  { id: 'severePain', urgent: true },
  { id: 'swelling', urgent: false },
  { id: 'jaundice', urgent: false },
  { id: 'chest', urgent: true }
]);
