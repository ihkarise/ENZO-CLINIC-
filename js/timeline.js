/**
 * Patient Timeline (Phase 3): search the Patient Master by Patient ID, OPD
 * Number, Name, Phone, Diagnosis or Notes; selecting a patient shows a
 * Patient Profile card (OPD, Name, Phone, Age, Gender, Visit Count, Last
 * Visit) followed by every appointment, online consultation, diagnosis,
 * medicine and follow-up entry for that patient, newest first.
 *
 * Grouping is by the permanent Patient ID — never by guessing name/phone —
 * so a changed phone number or a shortened name never splits a patient's
 * history into two. Built client-side from data already loaded by
 * app.js's loadData() (appts/onlineRecords/patients); no extra request.
 */
import { $, fmt, escapeHtml } from './core.js';
import { store } from './store.js';
import { STAGE } from './workflow.js';
import { patientById, patientSummary, ageFromDob, indexApptsByPatient, patientMatches } from './patients.js';

function eventsFor(patientId){
  const events = [];
  store.get('appts').filter(a => a.patientId === patientId).forEach(a => {
    if(a.stage === STAGE.COMPLETED){
      events.push({ date: a.apptDate, kind: 'done', title: 'Consultation completed',
        desc: [a.diagnosis, a.medDuration ? a.medDuration + ' days medicine' : '', a.followUp ? 'Follow-up ' + fmt(a.followUp) : '']
          .filter(Boolean).join(' · ') });
    }else if(a.stage === STAGE.CANCELLED){
      events.push({ date: a.apptDate, kind: 'cancel', title: 'Appointment cancelled', desc: a.slot || '' });
    }else if(a.stage === STAGE.NOSHOW){
      events.push({ date: a.apptDate, kind: 'cancel', title: 'No-show', desc: a.slot || '' });
    }else{
      events.push({ date: a.apptDate, kind: a.type === 'Online' ? 'online' : '', title: `${a.type === 'Online' ? 'Online' : 'In-clinic'} appointment booked`, desc: a.slot || '' });
    }
  });
  store.get('onlineRecords').filter(r => r.patientId === patientId).forEach(r => {
    events.push({ date: new Date(r.date), kind: 'online', title: 'Online record',
      desc: [r.place, r.refby ? 'Ref: ' + r.refby : '', r.notes].filter(Boolean).join(' · ') });
  });
  return events.filter(e => e.date).sort((a,b) => new Date(b.date) - new Date(a.date));
}

function renderPatientList(query){
  const box = $('tResults');
  const q = query.trim();
  if(!q){ box.innerHTML = '<div class="empty">Search a patient by ID, OPD number, name, phone, diagnosis or notes to see their timeline.</div>'; return; }
  // Build the appointment index once (O(appts)) instead of re-filtering
  // store.appts once per candidate patient (O(patients × appts)) — keeps
  // this fast at a few thousand patients/appointments.
  const apptsByPatient = indexApptsByPatient();
  const matches = store.get('patients')
    .filter(p => patientMatches(p, q, apptsByPatient))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .slice(0, 20);
  if(!matches.length){ box.innerHTML = '<div class="empty">No matching patients.</div>'; return; }
  box.innerHTML = matches.map(p =>
    `<div class="appt" role="button" tabindex="0" data-patient="${escapeHtml(p.patientId)}" style="cursor:pointer">
      <div class="awho"><div class="nm">${escapeHtml(p.name || '(no name on file)')}</div><div class="sub"><span class="ph">${escapeHtml(p.opdNumber)} · ${escapeHtml(p.phone)}</span></div></div>
    </div>`).join('');
}

function profileCardHtml(patient){
  const s = patientSummary(patient.patientId);
  const age = ageFromDob(patient.dob);
  const fields = [
    ['Phone', patient.phone || '—'],
    ['Age', age !== '' ? age : '—'],
    ['Gender', patient.gender || '—'],
    ['Visit count', String(s.visitCount)],
    ['Last visit', s.lastVisit ? fmt(s.lastVisit) : '—']
  ];
  return `<div class="pcard">
    <div class="pcard-top"><span class="pcard-opd">${escapeHtml(patient.opdNumber)}</span><span class="pcard-name">${escapeHtml(patient.name || '(no name on file)')}</span></div>
    <div class="pcard-grid">${fields.map(([lbl, val]) => `<div><div class="pi-lbl">${escapeHtml(lbl)}</div><div class="pi-val">${escapeHtml(String(val))}</div></div>`).join('')}</div>
  </div>`;
}

function renderTimeline(patientId){
  const box = $('tResults');
  const patient = patientById(patientId);
  if(!patient){ box.innerHTML = '<div class="empty">Patient not found.</div>'; return; }
  const events = eventsFor(patientId);
  box.innerHTML = profileCardHtml(patient) +
    `<div class="card"><div class="tlwrap">${
      events.length ? events.map(e => `<div class="tlitem ${e.kind}">
        <div class="tdot"></div>
        <div class="tbody">
          <div class="thead"><span>${escapeHtml(e.title)}</span><span class="tdate">${fmt(e.date)}</span></div>
          ${e.desc ? `<div class="tdesc">${escapeHtml(e.desc)}</div>` : ''}
        </div></div>`).join('') : '<div class="empty">No history recorded yet.</div>'
    }</div></div>
    <button class="btn-ghost" id="tBack" type="button" style="margin-top:12px">Back to search</button>`;
  $('tBack').addEventListener('click', () => { $('tSearch').value = ''; renderPatientList(''); });
}

/** Jump straight to one patient's timeline — used by the booking page's
 *  "View timeline" link and the Dashboard's quick patient search. Caller
 *  is responsible for switching to the Timeline page first. */
export function openPatientTimeline(patientId){
  $('tSearch').value = '';
  renderTimeline(patientId);
}

export function initTimeline(){
  $('tSearch').addEventListener('input', () => renderPatientList($('tSearch').value));
  $('tResults').addEventListener('click', e => {
    const p = e.target.closest('[data-patient]'); if(!p) return;
    renderTimeline(p.getAttribute('data-patient'));
  });
  $('tResults').addEventListener('keydown', e => {
    if(e.key !== 'Enter') return;
    const p = e.target.closest('[data-patient]'); if(!p) return;
    renderTimeline(p.getAttribute('data-patient'));
  });
  renderPatientList('');
}
