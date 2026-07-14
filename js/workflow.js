/**
 * Clinic workflow business logic: shaping raw appointment rows into typed
 * records, the Scheduled/Completed classification rules, and the
 * follow-up-date calculation used by the Complete Consultation modal.
 *
 * This is the one place that knows what "Pending" or "auto follow-up" mean,
 * so the UI modules stay dumb renderers.
 */
import { DAY, same, rid } from './core.js';

export const STAGE = { SCHEDULED: 'Scheduled', COMPLETED: 'Completed', CANCELLED: 'Cancelled', NOSHOW: 'NoShow' };

/** Normalise a raw appointment (from the sheet or demo data) into the shape
 *  the rest of the app works with. Unknown/blank stage = Scheduled, so
 *  every pre-existing row in a production sheet keeps working untouched. */
export function mapAppt(r){
  const ap = r.apptDate || r.due || r.visit;
  const apd = ap ? new Date(ap) : null;
  return {
    id: r.id || rid(),
    name: r.name,
    phone: r.phone || '',
    type: r.type === 'Online' ? 'Online' : 'Offline',
    visit: r.visit ? new Date(r.visit) : (apd || new Date()),
    days: r.days || 30,
    apptDate: apd,
    due: apd,
    call: apd ? new Date(apd.getTime() - DAY) : null,
    slot: r.slot || '',
    stage: r.stage || STAGE.SCHEDULED,
    diagnosis: r.diagnosis || '',
    clinicalNotes: r.clinicalNotes || '',
    medDuration: r.medDuration || '',
    medNotes: r.medNotes || '',
    followUp: r.followUp ? new Date(r.followUp) : null,
    outcome: r.outcome || '',
    parentId: r.parentId || '',
    patientId: r.patientId || '', // Phase 3: permanent link into the Patient Master
    emergency: !!r.emergency   // future-ready: surfaced on the card when present
  };
}

export function computeFollowUp(apptDate, medDuration){
  const n = parseInt(medDuration, 10);
  if(!apptDate || !n || n <= 0) return null;
  return new Date(new Date(apptDate).getTime() + n * DAY);
}

/** Scheduled-tab bucket: upcoming | today | pending (past date, still open). */
export function scheduledBucket(appt, now){
  if(!appt.apptDate) return 'upcoming';
  const today = now || new Date();
  if(same(appt.apptDate, today)) return 'today';
  const d = new Date(appt.apptDate); d.setHours(0,0,0,0);
  const t0 = new Date(today); t0.setHours(0,0,0,0);
  return d < t0 ? 'pending' : 'upcoming';
}

export function isScheduled(appt){ return appt.stage === STAGE.SCHEDULED || !appt.stage; }

export function completedBucket(appt){
  if(appt.stage === STAGE.CANCELLED) return 'cancelled';
  if(appt.stage === STAGE.NOSHOW) return 'noshow';
  return 'completed';
}

/** A terminal (closed) appointment — the visit actually happened or was
 *  resolved, so it counts as this patient's "last visit" for status badges. */
export function isTerminal(appt){
  return appt.stage === STAGE.COMPLETED || appt.stage === STAGE.CANCELLED || appt.stage === STAGE.NOSHOW;
}

/** Midnight today, reused by the morning briefing and overdue calculations
 *  so every module agrees on where "today" begins. */
export function startOfToday(){ const d = new Date(); d.setHours(0,0,0,0); return d; }
