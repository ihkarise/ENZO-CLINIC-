/**
 * Patient Master (Phase 3): permanent patient identity (Patient ID + OPD
 * Number), duplicate-by-phone lookup, and the shared patient-search index
 * used by Booking, Online Records, the Dashboard and the Timeline.
 *
 * This is the single place that decides "which patient does this record
 * belong to" for the frontend — appointments and online records carry a
 * patientId (see workflow.js's mapAppt / EnzoBackend.gs); nothing groups
 * patients by guessing name/phone anymore. The backend is still the
 * authority (EnzoBackend.gs's findOrCreatePatient), this module just
 * mirrors the same phone-normalisation rule so the UI's duplicate prompt
 * matches what the server will actually do.
 */
import { normPhone, rid, toISODate, apptMatches, DAY } from './core.js';
import { store } from './store.js';
import { createPatient as apiCreatePatient } from './api.js';
import { STAGE, isScheduled, isTerminal, startOfToday } from './workflow.js';

export function patientById(patientId){
  if(!patientId) return null;
  return store.get('patients').find(p => p.patientId === patientId) || null;
}

/** Exact-phone lookup — powers the booking duplicate-detection prompt.
 *  Only ever an exact normalised-phone match (never name), same rule the
 *  backend uses, so "Use existing" always points at the same patient the
 *  server would have resolved to anyway. */
export function findPatientByPhone(phone){
  const ph = normPhone(phone);
  if(!ph) return null;
  return store.get('patients').find(p => normPhone(p.phone) === ph) || null;
}

/** Build a patientId -> appointments[] index once. Pass this into
 *  patientMatches()/summary helpers when scanning many patients so the
 *  work stays O(appointments + patients) instead of O(patients ×
 *  appointments) — required to keep search fast at a few thousand rows. */
export function indexApptsByPatient(){
  const map = new Map();
  store.get('appts').forEach(a => {
    if(!a.patientId) return;
    const list = map.get(a.patientId);
    if(list) list.push(a); else map.set(a.patientId, [a]);
  });
  return map;
}

/** Same as indexApptsByPatient() but for Online Records — pass both into
 *  patientMatches() when scanning many patients so a match on an online
 *  record's notes/place/referred-by is found too, not just appointments. */
export function indexOnlineByPatient(){
  const map = new Map();
  store.get('onlineRecords').forEach(r => {
    if(!r.patientId) return;
    const list = map.get(r.patientId);
    if(list) list.push(r); else map.set(r.patientId, [r]);
  });
  return map;
}

/** Every appointment + online record for one patient. Cheap for a single
 *  patient (used by the Timeline detail view and the duplicate-detection
 *  prompt); for scanning many patients at once, build the indexes above
 *  and read from them instead of calling this in a loop. */
export function recordsFor(patientId){
  return {
    appts: store.get('appts').filter(a => a.patientId === patientId),
    online: store.get('onlineRecords').filter(r => r.patientId === patientId)
  };
}

/** Most recent visit + most recent diagnosis for one patient — used by the
 *  Returning Patient card and the Patient Profile card. Always resolves
 *  fresh for a single patient (cheap: one filter pass), so it's safe to
 *  call directly without a pre-built index. */
export function patientSummary(patientId){
  const { appts, online } = recordsFor(patientId);
  const byDateDesc = appts.filter(a => a.apptDate).sort((a, b) => new Date(b.apptDate) - new Date(a.apptDate));
  const lastCompleted = appts.filter(a => a.stage === 'Completed' && a.apptDate)
    .sort((a, b) => new Date(b.apptDate) - new Date(a.apptDate))[0];
  const byDateAsc = byDateDesc.slice().reverse();
  return {
    visitCount: appts.length + online.length,
    firstVisit: byDateAsc[0] ? byDateAsc[0].apptDate : null,
    lastVisit: byDateDesc[0] ? byDateDesc[0].apptDate : null,
    diagnosis: lastCompleted ? lastCompleted.diagnosis : ''
  };
}

/* ===== Phase 3.5: patient status badges + attention (priority) score =====
 *
 * A patient's badge is derived purely from their appointment history — the
 * caller never has to open the Timeline. One shared function so Dashboard,
 * Booking, Timeline, Patient Profile and Search all show the exact same
 * badge for the same patient. Rules (from the phase spec):
 *   never completed a consultation  -> NEW      (green)
 *   completed at least one           -> RETURN   (blue) then coloured by the
 *                                       last visit's outcome:
 *   last visit Completed             -> GREEN
 *   last visit Cancelled             -> ORANGE
 *   last visit No-show               -> RED
 *   a follow-up appointment is overdue -> PURPLE (takes precedence)
 *
 * `apptsByPatient` is the optional index from indexApptsByPatient(); pass it
 * when scanning many patients so this stays O(1) per patient. */
export const STATUS = {
  NEW:       { cls: 'new',    label: 'NEW' },
  RETURN:    { cls: 'return', label: 'RETURN' },
  COMPLETED: { cls: 'done',   label: 'LAST COMPLETED' },
  CANCELLED: { cls: 'cancel', label: 'LAST CANCELLED' },
  NOSHOW:    { cls: 'noshow', label: 'LAST NO-SHOW' },
  OVERDUE:   { cls: 'overdue',label: 'FOLLOW-UP OVERDUE' }
};

/** A follow-up (parentId set) still Scheduled with a past date = overdue. */
function hasOverdueFollowUp(appts, today){
  return appts.some(a => a.parentId && isScheduled(a) && a.apptDate && new Date(a.apptDate) < today);
}

/** The single status badge for a patient. Returns { cls, label, type } where
 *  type is 'NEW' or 'RETURN' (the underlying patient class) and cls/label
 *  drive rendering. */
export function patientStatus(patientId, apptsByPatient){
  const appts = apptsByPatient ? (apptsByPatient.get(patientId) || []) : recordsFor(patientId).appts;
  const completed = appts.filter(a => a.stage === STAGE.COMPLETED);
  const type = completed.length ? 'RETURN' : 'NEW';
  const today = startOfToday();
  if(hasOverdueFollowUp(appts, today)) return { ...STATUS.OVERDUE, type };
  const lastTerminal = appts.filter(a => isTerminal(a) && a.apptDate)
    .sort((a, b) => new Date(b.apptDate) - new Date(a.apptDate))[0];
  if(type === 'NEW'){
    // A brand-new patient whose only closed visit was a no-show/cancellation
    // should still surface that, otherwise fall back to the NEW badge.
    if(lastTerminal && lastTerminal.stage === STAGE.NOSHOW) return { ...STATUS.NOSHOW, type };
    if(lastTerminal && lastTerminal.stage === STAGE.CANCELLED) return { ...STATUS.CANCELLED, type };
    return { ...STATUS.NEW, type };
  }
  if(lastTerminal && lastTerminal.stage === STAGE.NOSHOW) return { ...STATUS.NOSHOW, type };
  if(lastTerminal && lastTerminal.stage === STAGE.CANCELLED) return { ...STATUS.CANCELLED, type };
  return { ...STATUS.COMPLETED, type };
}

/** Attention (priority) score 0–5 with the reasons behind it — a simple,
 *  transparent rule set (no AI). Higher = needs attention sooner; the
 *  morning briefing sorts priority patients first. */
export function patientPriority(patientId, apptsByPatient){
  const appts = apptsByPatient ? (apptsByPatient.get(patientId) || []) : recordsFor(patientId).appts;
  const today = startOfToday();
  let score = 0; const reasons = [];
  const terminal = appts.filter(a => isTerminal(a) && a.apptDate)
    .sort((a, b) => new Date(b.apptDate) - new Date(a.apptDate));
  const last = terminal[0];
  if(last && last.stage === STAGE.NOSHOW){ score += 2; reasons.push('Last visit was a no-show'); }
  const cancels = appts.filter(a => a.stage === STAGE.CANCELLED).length;
  if(cancels >= 2){ score += 2; reasons.push(`Cancelled ${cancels} times`); }
  if(hasOverdueFollowUp(appts, today)){ score += 2; reasons.push('Follow-up overdue'); }
  if(last && last.apptDate){
    const gap = Math.round((today - new Date(last.apptDate)) / DAY);
    if(gap >= 120){ score += 1; reasons.push(`No visit in ${Math.round(gap / 30)} months`); }
  }
  if(score > 5) score = 5;
  return { score, reasons, stars: '★'.repeat(score) + '☆'.repeat(5 - score) };
}

/** Ready-to-inject HTML for a patient's status badge (Dashboard, Booking,
 *  Timeline, Profile, Search all use this so the badge is identical
 *  everywhere). Labels are a fixed internal set — safe to inline. Returns
 *  '' when the patient can't be resolved (no patientId yet). */
export function statusBadgeHtml(patientId, apptsByPatient){
  if(!patientId) return '';
  const s = patientStatus(patientId, apptsByPatient);
  return `<span class="tb ${s.cls}"><span class="d"></span>${s.label}</span>`;
}

/** True if an OPD Number is already taken by another patient (case- and
 *  whitespace-insensitive). Powers the manual-OPD uniqueness check in
 *  Booking. Optionally ignore one patientId (when editing that patient). */
export function opdExists(opdNumber, exceptPatientId){
  const target = String(opdNumber || '').trim().toLowerCase();
  if(!target) return false;
  return store.get('patients').some(p =>
    p.patientId !== exceptPatientId && String(p.opdNumber || '').trim().toLowerCase() === target);
}

/** Whole years between a DOB (ISO-ish string/Date) and today, or '' if the
 *  patient has no DOB on file (most don't yet — booking never asked for
 *  one; it is a Patient Master field for future data entry). */
export function ageFromDob(dob){
  if(!dob) return '';
  const d = new Date(dob);
  if(isNaN(d)) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const beforeBirthday = (now.getMonth() < d.getMonth()) || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if(beforeBirthday) age--;
  return age >= 0 ? age : '';
}

/** Demo mode has no real backend, so there is nowhere to store a
 *  reception-entered OPD Number. This local sequence exists ONLY so the
 *  demo sandbox still shows a plausible number when the user leaves the OPD
 *  field blank. In a real deployment reception types the OPD Number and it
 *  is validated for uniqueness (see opdExists / EnzoBackend.gs). */
function nextDemoOpdNumber(){
  const patients = store.get('patients');
  return 'ENZO-' + String(patients.length + 1).padStart(6, '0');
}

/** Create a brand-new patient row unconditionally (no dedup check — that
 *  is the caller's decision, e.g. "Create new anyway" in the booking
 *  duplicate prompt, or a first-time online record). `fields.opdNumber` is
 *  the OPD Number reception typed (required for a booking; may be blank for
 *  an auto-linked online record, where the backend assigns the next local
 *  number). Offline-safe: if the write is queued, an optimistic local
 *  patient is added immediately carrying the typed OPD Number so booking
 *  can proceed; it syncs to the server verbatim once back online.
 *
 *  Throws if the server explicitly rejected the write (e.g. the OPD Number
 *  is already taken) — this is not something retrying the same request
 *  fixes, so the caller must stop and surface the message instead. */
export async function createNewPatient(token, fields){
  const d = await apiCreatePatient(token, fields);
  if(d && d.ok && d.patient){
    const patients = store.get('patients').slice();
    patients.push(d.patient);
    store.set({ patients });
    return d.patient;
  }
  if(d && (d.queued || d.demo)){
    const patients = store.get('patients').slice();
    const local = {
      patientId: 'pt' + rid(),
      // Reception now types the OPD Number manually, so even an offline
      // (queued) create already knows the real number — no "Pending sync"
      // placeholder. Demo mode (no backend) still auto-numbers locally.
      opdNumber: (fields.opdNumber && String(fields.opdNumber).trim())
        || (d.demo ? nextDemoOpdNumber() : 'Pending sync'),
      name: fields.name || '', phone: fields.phone || '',
      gender: fields.gender || '', dob: fields.dob || '', address: fields.address || '', email: fields.email || '',
      createdDate: toISODate(new Date()), updatedDate: toISODate(new Date()), status: 'Active', notes: fields.notes || '',
      pending: !d.demo
    };
    patients.push(local);
    store.set({ patients });
    return local;
  }
  throw new Error((d && d.message) || 'Could not create patient record');
}

/** Global patient search: Patient ID, OPD Number, Name, Phone, Notes, plus
 *  (via that patient's appointments) Diagnosis / Clinical / Medicine notes
 *  / Outcome, and (via that patient's online records) Notes / Place /
 *  Referred By — the same fields apptMatches()/onlineSearchMatches()
 *  already cover for a single record. Pass indexApptsByPatient()'s and
 *  indexOnlineByPatient()'s maps when filtering a whole list so this stays
 *  O(n), not O(n²). */
export function patientMatches(patient, query, apptsByPatient, onlineByPatient){
  const q = String(query || '').trim().toLowerCase();
  if(!q) return true;
  const hay = [patient.patientId, patient.opdNumber, patient.name, patient.phone, patient.notes]
    .map(x => String(x || '').toLowerCase()).join('  ');
  if(hay.indexOf(q) >= 0) return true;
  const appts = apptsByPatient ? (apptsByPatient.get(patient.patientId) || []) : recordsFor(patient.patientId).appts;
  if(appts.some(a => [a.diagnosis, a.clinicalNotes, a.medNotes, a.outcome]
    .some(f => String(f || '').toLowerCase().indexOf(q) >= 0))) return true;
  const online = onlineByPatient ? (onlineByPatient.get(patient.patientId) || []) : recordsFor(patient.patientId).online;
  return online.some(r => [r.notes, r.place, r.refby]
    .some(f => String(f || '').toLowerCase().indexOf(q) >= 0));
}

/** Same query, applied to one appointment card (Booking/Completed lists) —
 *  extends core.js's apptMatches() with the linked patient's OPD Number /
 *  Patient ID / Notes so typing an OPD number in the booking search finds
 *  that patient's appointments too. */
export function apptSearchMatches(appt, query){
  if(apptMatches(appt, query)) return true;
  const q = String(query || '').trim().toLowerCase();
  if(!q) return true;
  const p = patientById(appt.patientId);
  if(!p) return false;
  return [p.opdNumber, p.patientId, p.notes].some(f => String(f || '').toLowerCase().indexOf(q) >= 0);
}

/** Search matcher for the Online Records list — name/phone/place/referred
 *  by/notes, plus (via the linked patient) OPD Number / Patient ID. */
export function onlineSearchMatches(record, query){
  const q = String(query || '').trim().toLowerCase();
  if(!q) return true;
  const p = patientById(record.patientId);
  const hay = [record.name, record.phone, record.place, record.refby, record.notes,
    p ? p.opdNumber : '', p ? p.patientId : '']
    .map(x => String(x || '').toLowerCase()).join('  ');
  return hay.indexOf(q) >= 0;
}

/** Demo-mode only: derive a consistent Patient Master from generated demo
 *  appointments/online records (phone, else name, as the identity key) and
 *  stamp patientId onto every record so the rest of the app never has to
 *  special-case demo mode. Real deployments get patients — with their
 *  reception-entered OPD Numbers — from the backend (already linked
 *  server-side). The sequential "ENZO-000001" numbers below are
 *  demo-sandbox-only fixtures. */
export function deriveDemoPatients(appts, onlineRecords){
  const map = new Map();
  let seq = 0;
  function keyOf(r){
    const ph = normPhone(r.phone);
    if(ph) return 'p:' + ph;
    const n = String(r.name || '').trim().toLowerCase();
    return n ? 'n:' + n : '';
  }
  function idFor(r){
    const k = keyOf(r);
    if(!k) return '';
    let p = map.get(k);
    if(!p){
      seq += 1;
      p = {
        patientId: 'ptdemo' + seq, opdNumber: 'ENZO-' + String(seq).padStart(6, '0'),
        name: r.name || '', phone: r.phone || '', gender: '', dob: '', address: '', email: '',
        createdDate: '', updatedDate: '', status: 'Active', notes: ''
      };
      map.set(k, p);
    }
    return p.patientId;
  }
  appts.forEach(a => { a.patientId = idFor(a); });
  onlineRecords.forEach(r => { r.patientId = idFor(r); });
  return Array.from(map.values());
}
