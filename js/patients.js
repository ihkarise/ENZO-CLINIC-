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
import { normPhone, rid, toISODate, apptMatches } from './core.js';
import { store } from './store.js';
import { createPatient as apiCreatePatient } from './api.js';

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
  return {
    visitCount: appts.length + online.length,
    lastVisit: byDateDesc[0] ? byDateDesc[0].apptDate : null,
    diagnosis: lastCompleted ? lastCompleted.diagnosis : ''
  };
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

/** Create a brand-new patient row unconditionally (no dedup check — that
 *  is the caller's decision, e.g. "Create new anyway" in the booking
 *  duplicate prompt, or a first-time online record). Offline-safe: if the
 *  write is queued, an optimistic local patient is added immediately so
 *  booking can proceed; the OPD number becomes final once the queued
 *  write syncs and the patient list is refetched. Demo mode (no backend at
 *  all) resolves the same way, permanently — there is nothing to sync. */
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
      opdNumber: d.demo ? ('ENZO-' + String(patients.length + 1).padStart(6, '0')) : 'Pending sync',
      name: fields.name || '', phone: fields.phone || '',
      gender: fields.gender || '', dob: fields.dob || '', address: fields.address || '', email: fields.email || '',
      createdDate: toISODate(new Date()), updatedDate: toISODate(new Date()), status: 'Active', notes: fields.notes || '',
      pending: !d.demo
    };
    patients.push(local);
    store.set({ patients });
    return local;
  }
  return null;
}

/** Global patient search: Patient ID, OPD Number, Name, Phone, Notes, plus
 *  (via that patient's appointments) Diagnosis / Clinical / Medicine notes
 *  / Outcome — the same fields apptMatches() already covers for a single
 *  appointment. Pass an apptsByPatient index (indexApptsByPatient()) when
 *  filtering a whole list so this stays O(n), not O(n²). */
export function patientMatches(patient, query, apptsByPatient){
  const q = String(query || '').trim().toLowerCase();
  if(!q) return true;
  const hay = [patient.patientId, patient.opdNumber, patient.name, patient.phone, patient.notes]
    .map(x => String(x || '').toLowerCase()).join('  ');
  if(hay.indexOf(q) >= 0) return true;
  const appts = apptsByPatient ? (apptsByPatient.get(patient.patientId) || []) : recordsFor(patient.patientId).appts;
  return appts.some(a => [a.diagnosis, a.clinicalNotes, a.medNotes, a.outcome]
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
 *  special-case demo mode. Real deployments get patients from the backend
 *  (already linked server-side). */
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
