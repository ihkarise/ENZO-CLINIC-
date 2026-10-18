/**
 * WhatsApp lead message: pure functions, no DOM. The message is built only
 * when the visitor views the result, and it leaves the device only if the
 * visitor taps the button and then presses Send inside WhatsApp.
 */
import { SITE } from './config.js';

/** Plain-text summary of a scoreAssessment() result in the chosen language.
 *  kind: 'score' (ask about the result) | 'book' (ask to book). */
export function buildMessage(result, T, kind = 'score'){
  const M = T.msg;
  const area = s => `${T.subscores[s.id]} ${s.score}/${s.max}`;
  const lines = [
    M.hello,
    M.done,
    '',
    M.score(result.total, result.maxScore, T.bands[result.band.id].label),
    result.highest.length ? `${M.top}: ${result.highest.map(area).join(', ')}` : M.topNone,
    `${M.areas}: ${result.subscores.map(area).join(' · ')}`,
    result.warnings.signs.length
      ? `${M.warn}: ${result.warnings.signs.map(w => T.warnings[w.id]).join(', ')}`
      : M.warnNone,
    '',
    kind === 'book' ? M.book : M.ask
  ];
  return lines.join('\n');
}

/** wa.me click-to-chat link with the message pre-typed. */
export function waLink(text, number = SITE.whatsappNumber){
  const digits = String(number || '').replace(/\D/g, '');
  if(!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
