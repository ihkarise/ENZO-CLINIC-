/**
 * Core utilities shared by every module: DOM shorthand, date/time helpers,
 * id generation and HTML escaping. No state lives here — pure functions only.
 */

export const $ = id => document.getElementById(id);
export const DAY = 86400000;

export const SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30',
  '16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30'];

export function fmt(d){
  return new Date(d).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
}

export function same(a,b){
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function to12h(s){
  if(!s) return '';
  const p = s.split(':'), h = +p[0], m = +p[1], ap = h >= 12 ? 'PM' : 'AM', hh = h % 12 || 12;
  return hh + ':' + (m < 10 ? '0' + m : m) + ' ' + ap;
}

export function rid(){
  return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function toISODate(d){
  return new Date(d).toISOString().slice(0, 10);
}

/** Strip a phone number down to what tel:/wa.me links accept. */
export function digits(s){
  return String(s || '').replace(/[^\d+]/g, '');
}

/** Global search matcher (Phase 2). Matches a query against an appointment
 *  across name, phone, appointment ID, diagnosis, clinical/medicine notes
 *  and outcome — so the same search works in Scheduled, Completed and the
 *  timeline, and future modules can reuse it. Case-insensitive substring. */
export function apptMatches(appt, query){
  const q = String(query || '').trim().toLowerCase();
  if(!q) return true;
  const hay = [
    appt.name, appt.phone, appt.id, appt.diagnosis,
    appt.clinicalNotes, appt.medNotes, appt.outcome
  ].map(x => String(x || '').toLowerCase()).join('  ');
  return hay.indexOf(q) >= 0;
}

/** Escape untrusted text before it is concatenated into innerHTML. */
export function escapeHtml(s){
  if(s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

export const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
export const ICON_DEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
export const ICON_DONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
export const ICON_CALL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
export const ICON_WA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.2-5.6A8.4 8.4 0 1 1 21 11.5z"/></svg>';
