/**
 * Pure, deterministic scoring for the ENZO Gut Health Score.
 * No DOM, no network, no storage, no identity. Every function takes plain
 * data and returns plain data, so it is unit-tested in Node directly.
 */
import { ASSESSMENT, SUBSCORES, BANDS, WARNING_SIGNS, NONE_ID } from './config.js';

const QUESTION_COUNT = ASSESSMENT.questions.length;

/** Throws unless `answers` is an array of exactly eight integers 0–3. */
export function validateAnswers(answers){
  if(!Array.isArray(answers)) throw new TypeError('answers must be an array');
  if(answers.length !== QUESTION_COUNT) throw new RangeError('exactly ' + QUESTION_COUNT + ' answers are required');
  for(let i = 0; i < answers.length; i++){
    const v = answers[i];
    if(typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 3){
      throw new RangeError('answer ' + (i + 1) + ' must be an integer from 0 to 3');
    }
  }
  return answers;
}

export function isComplete(answers){
  try{ validateAnswers(answers); return true; }catch(e){ return false; }
}

/** Sum of Q1–Q8, 0–24. */
export function calculateTotal(answers){
  validateAnswers(answers);
  return answers.reduce((sum, v) => sum + v, 0);
}

/** The band whose [min, max] contains `total`. */
export function getBand(total){
  if(!Number.isInteger(total) || total < 0 || total > ASSESSMENT.maxScore){
    throw new RangeError('total must be an integer from 0 to ' + ASSESSMENT.maxScore);
  }
  return BANDS.find(b => total >= b.min && total <= b.max);
}

/** Six raw sub-scores, in display order. */
export function calculateSubscores(answers){
  validateAnswers(answers);
  const byId = {};
  ASSESSMENT.questions.forEach((q, i) => { byId[q.id] = answers[i]; });
  return SUBSCORES.map(s => ({
    id: s.id,
    max: s.max,
    score: s.questions.reduce((sum, qid) => sum + byId[qid], 0)
  }));
}

/** Every category sharing the highest raw sub-score. Empty when all are 0 —
 *  the UI then says no elevated category was identified, rather than
 *  picking an arbitrary winner. */
export function highestCategories(subscores){
  const top = Math.max(...subscores.map(s => s.score));
  if(top <= 0) return [];
  return subscores.filter(s => s.score === top);
}

/** Toggle one warning-sign checkbox while keeping "None of the above"
 *  mutually exclusive with every real warning sign. Returns a new array. */
export function toggleWarning(selected, id, checked){
  const set = new Set(selected);
  if(!checked){ set.delete(id); return [...set]; }
  if(id === NONE_ID) return [NONE_ID];
  set.delete(NONE_ID);
  set.add(id);
  return WARNING_SIGNS.map(w => w.id).filter(w => set.has(w));
}

/**
 * Classify the warning-sign answer. Completely independent of the symptom
 * score: nothing here reads `answers` or `total`, so a low score can never
 * suppress a warning.
 *  - 'unanswered': nothing ticked yet (the UI won't let the user continue)
 *  - 'none'      : "None of the above" only
 *  - 'urgent'    : at least one sign that needs emergency assessment
 *  - 'prompt'    : signs that need timely medical evaluation
 * A selection that mixes "none" with real signs is resolved in favour of
 * the real signs (safety first) rather than discarded.
 */
export function evaluateWarnings(selected){
  const ids = Array.isArray(selected) ? selected : [];
  const signs = WARNING_SIGNS.filter(w => ids.includes(w.id));
  if(signs.length){
    const urgent = signs.filter(w => w.urgent);
    return { status: urgent.length ? 'urgent' : 'prompt', signs, urgent };
  }
  if(ids.includes(NONE_ID)) return { status: 'none', signs: [], urgent: [] };
  return { status: 'unanswered', signs: [], urgent: [] };
}

/** Full result object for the results screen. */
export function scoreAssessment(answers, warningSelection){
  const total = calculateTotal(answers);
  const subscores = calculateSubscores(answers);
  return {
    assessmentId: ASSESSMENT.assessmentId,
    version: ASSESSMENT.version,
    total,
    maxScore: ASSESSMENT.maxScore,
    band: getBand(total),
    subscores,
    highest: highestCategories(subscores),
    warnings: evaluateWarnings(warningSelection)
  };
}

/**
 * Personalised explanation built only from approved sentence templates
 * (T = TEXT[lang] from i18n.js) and the visitor's own answers. It restates
 * what was reported; it never suggests a cause, diagnosis or treatment.
 */
export function buildExplanation(answers, result, T){
  validateAnswers(answers);
  if(!result.highest.length) return [T.expNone];
  const lines = [];
  const qById = {};
  ASSESSMENT.questions.forEach((q, i) => { qById[q.id] = { q, v: answers[i] }; });
  const optionText = (q, v) => T.options[q.optionSet][v];
  result.highest.forEach(cat => {
    const def = SUBSCORES.find(s => s.id === cat.id);
    const parts = def.questions
      .map(qid => qById[qid])
      .filter(x => x.v > 0)
      .map(x => {
        const opt = optionText(x.q, x.v);
        return T.expPart(T.questions[x.q.id].title, opt.label, opt.detail);
      });
    lines.push(T.expLine(T.subscores[cat.id], cat.score, cat.max, parts.join('; ')));
  });
  const q8 = ASSESSMENT.questions.findIndex(q => q.id === 'q8');
  const impact = answers[q8];
  if(impact >= 2 && !result.highest.some(c => c.id === 'impact')){
    lines.push(T.expImpact(optionText(ASSESSMENT.questions[q8], impact).label));
  }
  return lines;
}
