/**
 * Patient Timeline: search a patient, see every appointment, consultation,
 * diagnosis, medicine and follow-up entry plus online/in-clinic visits in
 * one chronological view. Built client-side from data already loaded by
 * booking.js/online.js — no extra backend endpoint needed for Phase 1.
 */
import { $, fmt, escapeHtml } from './core.js';
import { store } from './store.js';
import { STAGE } from './workflow.js';

function patientKey(p){
  return (p.phone && p.phone.trim()) ? 'p:' + p.phone.trim() : 'n:' + (p.name || '').trim().toLowerCase();
}

function allPatients(){
  const map = new Map();
  store.get('appts').forEach(a => {
    if(!a.name) return;
    const k = patientKey(a);
    if(!map.has(k)) map.set(k, { key: k, name: a.name, phone: a.phone || '' });
  });
  store.get('onlineRecords').forEach(r => {
    if(!r.name) return;
    const k = patientKey(r);
    if(!map.has(k)) map.set(k, { key: k, name: r.name, phone: r.phone || '' });
  });
  return Array.from(map.values());
}

function eventsFor(key){
  const events = [];
  store.get('appts').filter(a => a.name && patientKey(a) === key).forEach(a => {
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
  store.get('onlineRecords').filter(r => r.name && patientKey(r) === key).forEach(r => {
    events.push({ date: new Date(r.date), kind: 'online', title: 'Online record',
      desc: [r.place, r.refby ? 'Ref: ' + r.refby : '', r.notes].filter(Boolean).join(' · ') });
  });
  return events.filter(e => e.date).sort((a,b) => new Date(b.date) - new Date(a.date));
}

function renderPatientList(query){
  const box = $('tResults');
  const q = query.trim().toLowerCase();
  if(!q){ box.innerHTML = '<div class="empty">Search a patient by name or phone to see their timeline.</div>'; return; }
  const matches = allPatients().filter(p => p.name.toLowerCase().indexOf(q) >= 0 || p.phone.indexOf(q) >= 0).slice(0, 20);
  if(!matches.length){ box.innerHTML = '<div class="empty">No matching patients.</div>'; return; }
  box.innerHTML = matches.map(p =>
    `<div class="appt" role="button" tabindex="0" data-patient="${escapeHtml(p.key)}" style="cursor:pointer">
      <div class="awho"><div class="nm">${escapeHtml(p.name)}</div><div class="sub"><span class="ph">${escapeHtml(p.phone)}</span></div></div>
    </div>`).join('');
}

function renderTimeline(key){
  const box = $('tResults');
  const patient = allPatients().find(p => p.key === key);
  if(!patient) return;
  const events = eventsFor(key);
  box.innerHTML = `<div class="section-h"><h2>${escapeHtml(patient.name)}</h2><span class="c">${escapeHtml(patient.phone)}</span></div>
    <div class="card"><div class="tlwrap">${
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
