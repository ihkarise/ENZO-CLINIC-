// Run: node --test score/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSESSMENT, BANDS, SUBSCORES, WARNING_SIGNS, NONE_ID, SITE } from '../js/config.js';
import { TEXT } from '../js/i18n.js';
import {
  validateAnswers, calculateTotal, getBand, calculateSubscores, highestCategories,
  toggleWarning, evaluateWarnings, scoreAssessment, buildExplanation
} from '../js/scoring.js';
import { buildMessage, waLink } from '../js/message.js';

const zeros = [0, 0, 0, 0, 0, 0, 0, 0];
const threes = [3, 3, 3, 3, 3, 3, 3, 3];
const EN = TEXT.en, ML = TEXT.ml;

/* ---------- config + text integrity ---------- */
test('eight questions, points 0–3, exact English option wording', () => {
  assert.equal(ASSESSMENT.questions.length, 8);
  assert.deepEqual(ASSESSMENT.points, [0, 1, 2, 3]);
  ASSESSMENT.questions.forEach((q, i) => assert.equal(q.order, i + 1));
  assert.deepEqual(EN.options.days.map(o => o.label), ['Never', 'Rarely', 'Sometimes', 'Frequently']);
  assert.deepEqual(EN.options.days.map(o => o.detail), ['0 days', '1–2 days', '3–6 days', '7–14 days']);
  assert.deepEqual(EN.options.freq.map(o => o.label), ['Never', 'Rarely', 'Sometimes', 'Frequently']);
  assert.equal(ASSESSMENT.questions[7].optionSet, 'freq');
  ASSESSMENT.questions.slice(0, 7).forEach(q => assert.equal(q.optionSet, 'days'));
});

test('English and Malayalam have exactly the same text keys', () => {
  const shape = o => Array.isArray(o) ? o.map(shape)
    : (o && typeof o === 'object') ? Object.fromEntries(Object.keys(o).sort().map(k => [k, shape(o[k])]))
    : typeof o;
  assert.deepEqual(shape(ML), shape(EN));
});

test('every question, sub-score, band and warning sign has text in both languages', () => {
  for(const T of [EN, ML]){
    ASSESSMENT.questions.forEach(q => { assert.ok(T.questions[q.id].title); assert.ok(T.questions[q.id].text); });
    assert.ok(T.questions.q5.help);
    SUBSCORES.forEach(s => assert.ok(T.subscores[s.id]));
    BANDS.forEach(b => ['label', 'interpretation', 'nextStep'].forEach(k => assert.ok(T.bands[b.id][k])));
    WARNING_SIGNS.forEach(w => assert.ok(T.warnings[w.id]));
    assert.ok(T.warnings[NONE_ID]);
    assert.equal(T.options.days.length, 4);
    assert.equal(T.options.freq.length, 4);
  }
});

test('Malayalam uses the supplied wording', () => {
  assert.equal(ML.introH, 'നിങ്ങളുടെ കുടലിന്റെ ആരോഗ്യം എങ്ങനെയാണ്?');
  assert.equal(ML.start, 'വിലയിരുത്തൽ ആരംഭിക്കുക');
  assert.deepEqual(ML.options.days.map(o => o.label), ['ഒരിക്കലുമില്ല', 'അപൂർവമായി', 'ചിലപ്പോൾ', 'പതിവായി']);
  assert.equal(ML.bands.moderate.label, 'മിതമായ തോതിലുള്ള ലക്ഷണങ്ങൾ');
});

test('bands cover 0–24 exactly once, no gaps or overlaps', () => {
  for(let s = 0; s <= 24; s++){
    assert.equal(BANDS.filter(b => s >= b.min && s <= b.max).length, 1, 'score ' + s);
  }
});

test('every question belongs to exactly one sub-score', () => {
  const all = SUBSCORES.flatMap(s => s.questions).sort();
  assert.deepEqual(all, ASSESSMENT.questions.map(q => q.id).sort());
  SUBSCORES.forEach(s => assert.equal(s.max, s.questions.length * 3));
});

/* ---------- total ---------- */
test('eight zeros → 0', () => assert.equal(calculateTotal(zeros), 0));
test('eight threes → 24', () => assert.equal(calculateTotal(threes), 24));
test('mixed answers sum correctly', () => assert.equal(calculateTotal([1, 2, 3, 0, 1, 2, 3, 0]), 12));

test('missing / wrong-length answers are rejected', () => {
  assert.throws(() => calculateTotal([0, 0, 0, 0, 0, 0, 0]), RangeError);
  assert.throws(() => calculateTotal([0, 0, 0, 0, 0, 0, 0, 0, 0]), RangeError);
  assert.throws(() => calculateTotal([]), RangeError);
  assert.throws(() => calculateTotal(null), TypeError);
  assert.throws(() => calculateTotal([0, 0, 0, undefined, 0, 0, 0, 0]), RangeError);
  // eslint-disable-next-line no-sparse-arrays
  assert.throws(() => calculateTotal([0, 0, 0, , 0, 0, 0, 0]), RangeError);
});

test('invalid point values are rejected', () => {
  for(const bad of [-1, 4, 1.5, NaN, Infinity, '2', null, true]){
    assert.throws(() => validateAnswers([bad, 0, 0, 0, 0, 0, 0, 0]), RangeError, String(bad));
  }
});

/* ---------- bands ---------- */
test('band boundaries', () => {
  const cases = [[0, 'low'], [4, 'low'], [5, 'mild'], [9, 'mild'], [10, 'moderate'],
    [16, 'moderate'], [17, 'high'], [24, 'high']];
  for(const [s, id] of cases) assert.equal(getBand(s).id, id, 'score ' + s);
  assert.throws(() => getBand(25), RangeError);
  assert.throws(() => getBand(-1), RangeError);
});

/* ---------- sub-scores ---------- */
const sub = answers => Object.fromEntries(calculateSubscores(answers).map(s => [s.id, s.score]));

test('each sub-score maps to the right questions', () => {
  assert.deepEqual(sub([1, 2, 0, 0, 0, 0, 0, 0]), { bloatingGas: 3, acidity: 0, pain: 0, bowel: 0, food: 0, impact: 0 });
  assert.equal(sub([0, 0, 3, 0, 0, 0, 0, 0]).acidity, 3);
  assert.equal(sub([0, 0, 0, 2, 0, 0, 0, 0]).pain, 2);
  assert.equal(sub([0, 0, 0, 0, 3, 1, 0, 0]).bowel, 4);
  assert.equal(sub([0, 0, 0, 0, 0, 0, 1, 0]).food, 1);
  assert.equal(sub([0, 0, 0, 0, 0, 0, 0, 2]).impact, 2);
});

test('sub-score maxima with all threes', () => {
  assert.deepEqual(sub(threes), { bloatingGas: 6, acidity: 3, pain: 3, bowel: 6, food: 3, impact: 3 });
  calculateSubscores(threes).forEach(s => assert.equal(s.score, s.max));
});

test('all-zero → no highest category', () => {
  assert.deepEqual(highestCategories(calculateSubscores(zeros)), []);
});

test('single highest category', () => {
  const h = highestCategories(calculateSubscores([0, 0, 0, 0, 2, 2, 0, 1]));
  assert.deepEqual(h.map(c => c.id), ['bowel']);
});

test('two-way tie shows both', () => {
  const h = highestCategories(calculateSubscores([1, 1, 2, 0, 0, 0, 0, 0]));
  assert.deepEqual(h.map(c => c.id), ['bloatingGas', 'acidity']);
});

test('multi-way tie shows all', () => {
  const h = highestCategories(calculateSubscores([0, 0, 1, 1, 0, 0, 1, 1]));
  assert.deepEqual(h.map(c => c.id), ['acidity', 'pain', 'food', 'impact']);
  const all = highestCategories(calculateSubscores([1, 0, 1, 1, 1, 0, 1, 1]));
  assert.equal(all.length, 6);
});

/* ---------- warning signs ---------- */
test('none selected', () => {
  assert.equal(evaluateWarnings([NONE_ID]).status, 'none');
  assert.equal(evaluateWarnings([]).status, 'unanswered');
});

test('one non-urgent warning sign → prompt', () => {
  const w = evaluateWarnings(['weightLoss']);
  assert.equal(w.status, 'prompt');
  assert.deepEqual(w.signs.map(s => s.id), ['weightLoss']);
});

test('urgent signs → urgent', () => {
  for(const id of ['blood', 'blackStool', 'severePain', 'chest']){
    assert.equal(evaluateWarnings([id]).status, 'urgent', id);
  }
});

test('multiple warning signs, mixed urgency', () => {
  const w = evaluateWarnings(['jaundice', 'chest', 'vomiting']);
  assert.equal(w.status, 'urgent');
  assert.equal(w.signs.length, 3);
  assert.deepEqual(w.urgent.map(s => s.id), ['chest']);
});

test('"none" is mutually exclusive in the toggle', () => {
  let sel = toggleWarning([], 'blood', true);
  sel = toggleWarning(sel, 'jaundice', true);
  assert.deepEqual(sel, ['blood', 'jaundice']);
  sel = toggleWarning(sel, NONE_ID, true);
  assert.deepEqual(sel, [NONE_ID]);
  sel = toggleWarning(sel, 'chest', true);
  assert.deepEqual(sel, ['chest']);
  sel = toggleWarning(sel, 'chest', false);
  assert.deepEqual(sel, []);
});

test('"none" combined with a real sign resolves to the real sign', () => {
  const w = evaluateWarnings([NONE_ID, 'swallowing']);
  assert.equal(w.status, 'prompt');
  assert.deepEqual(w.signs.map(s => s.id), ['swallowing']);
});

test('low total with a warning sign still warns', () => {
  const r = scoreAssessment(zeros, ['blackStool']);
  assert.equal(r.total, 0);
  assert.equal(r.band.id, 'low');
  assert.equal(r.warnings.status, 'urgent');
});

test('high total with no warning signs', () => {
  const r = scoreAssessment(threes, [NONE_ID]);
  assert.equal(r.total, 24);
  assert.equal(r.band.id, 'high');
  assert.equal(r.warnings.status, 'none');
});

test('warning selections never change the total', () => {
  const a = [1, 2, 1, 0, 2, 1, 0, 1];
  const base = scoreAssessment(a, [NONE_ID]).total;
  assert.equal(scoreAssessment(a, WARNING_SIGNS.map(w => w.id)).total, base);
});

/* ---------- explanation ---------- */
test('explanation only restates reported answers (English)', () => {
  const a = [3, 1, 0, 0, 0, 0, 0, 2];
  const lines = buildExplanation(a, scoreAssessment(a, [NONE_ID]), EN);
  assert.equal(lines[0], 'Bloating and gas scored 4 out of 6. You reported: bloating — frequently (7–14 days); gas and abdominal discomfort — rarely (1–2 days).');
  assert.match(lines[1], /interfered with your daily life sometimes/);
});

test('explanation in Malayalam', () => {
  const a = [3, 1, 0, 0, 0, 0, 0, 2];
  const lines = buildExplanation(a, scoreAssessment(a, [NONE_ID]), ML);
  assert.equal(lines[0], 'വയറുവീക്കവും ഗ്യാസും: 6-ൽ 4. നിങ്ങൾ റിപ്പോർട്ട് ചെയ്തത്: വയറുവീർക്കൽ — പതിവായി (7–14 ദിവസം); ഗ്യാസ്, വയറിലെ അസ്വസ്ഥത — അപൂർവമായി (1–2 ദിവസം).');
  assert.match(lines[1], /ചിലപ്പോൾ/);
});

test('explanation for all-zero answers', () => {
  for(const T of [EN, ML]){
    const lines = buildExplanation(zeros, scoreAssessment(zeros, [NONE_ID]), T);
    assert.deepEqual(lines, [T.expNone]);
  }
});

/* ---------- WhatsApp message ---------- */
test('WhatsApp message contains score, band, areas, warnings and the question (English)', () => {
  const r = scoreAssessment([1, 1, 2, 3, 0, 0, 2, 3], [NONE_ID]);
  const m = buildMessage(r, EN);
  assert.match(m, /^Hello Dr\. Ajay,\nI just completed the ENZO Gut Health Score™\./);
  assert.match(m, /\*My score: 12\/24 – Moderate reported symptoms\*/);
  assert.match(m, /Highest areas: Abdominal pain 3\/3, Daily-life impact 3\/3/);
  assert.match(m, /Area scores: Bloating and gas 2\/6 · Acidity and reflux 2\/3 · Abdominal pain 3\/3 · Bowel function 0\/6 · Food-related symptoms 2\/3 · Daily-life impact 3\/3/);
  assert.match(m, /Warning signs: none of the listed signs/);
  assert.match(m, /Can we do something about this\? Please tell me more\.$/);
});

test('WhatsApp message lists ticked warning signs and booking ask (Malayalam)', () => {
  const r = scoreAssessment(zeros, ['chest', 'jaundice']);
  const m = buildMessage(r, ML, 'book');
  assert.match(m, /^നമസ്കാരം ഡോ\. അജയ്,/);
  assert.match(m, /\*എന്റെ സ്കോർ: 0\/24 – കുറഞ്ഞ ലക്ഷണഭാരം\*/);
  assert.match(m, /ഏറ്റവും ഉയർന്ന വിഭാഗങ്ങൾ: ഒന്നുമില്ല/);
  assert.match(m, /കണ്ണുകളിലോ ചർമ്മത്തിലോ മഞ്ഞനിറം, നെഞ്ചുവേദന/);
  assert.match(m, /എനിക്ക് ഒരു കൺസൾട്ടേഷൻ ബുക്ക് ചെയ്യണം\.$/);
});

test('wa.me link targets the clinic number with encoded text', () => {
  assert.equal(SITE.whatsappNumber, '919986319779');
  const href = waLink('Hi & bye\nനമസ്കാരം');
  assert.ok(href.startsWith('https://wa.me/919986319779?text='));
  assert.equal(decodeURIComponent(href.split('?text=')[1]), 'Hi & bye\nനമസ്കാരം');
  assert.equal(waLink('x', ''), '');
  assert.equal(waLink('x', '+91 99863-19779').split('?')[0], 'https://wa.me/919986319779');
});
