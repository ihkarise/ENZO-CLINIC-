/**
 * Morning Briefing (Phase 3.5) — the doctor's actionable start-of-day view,
 * plus the shared Morning Report used on the Dashboard and (mirrored in
 * EnzoBackend.gs's buildMorningReport) by the email / Telegram / WhatsApp
 * notifications. The report is generated ONCE here from data already in the
 * store — Today's Appointments, the New/Return/last-outcome summary counts,
 * the priority (attention) list and the plain-text report — so nothing
 * duplicates the classification logic that lives in patients.js/workflow.js.
 *
 * It renders into the Dashboard's #morningBrief container: a clickable
 * summary grid (each count filters the appointment list below), the
 * Today's Appointments list (Time · OPD · Name · Type · status badge) and
 * the copyable Morning Report text.
 */
import { $, to12h, same, escapeHtml } from './core.js';
import { store } from './store.js';
import { isScheduled } from './workflow.js';
import { patientById, patientStatus, patientPriority, statusBadgeHtml, indexApptsByPatient } from './patients.js';

/** Build the whole briefing as a plain data object — the single source of
 *  truth reused by the render below and (conceptually) the backend report.
 *  Pure: reads the store, returns data, renders nothing. */
export function buildMorningReport(){
  const now = new Date();
  const idx = indexApptsByPatient();
  const todays = store.get('appts')
    .filter(a => a.apptDate && isScheduled(a) && same(a.apptDate, now))
    .map(a => {
      const p = patientById(a.patientId);
      const status = patientStatus(a.patientId, idx);
      const prio = patientPriority(a.patientId, idx);
      return {
        id: a.id, slot: a.slot || '', time: a.slot ? to12h(a.slot) : '—',
        opd: p ? p.opdNumber : '—', name: a.name || '(no name)',
        type: a.type === 'Online' ? 'Online' : 'Offline',
        status, priority: prio.score, reasons: prio.reasons, patientId: a.patientId
      };
    })
    .sort((x, y) => (x.slot || '~').localeCompare(y.slot || '~'));

  const counts = { appts: todays.length, new: 0, return: 0, completed: 0, cancelled: 0, noshow: 0, overdue: 0 };
  todays.forEach(t => {
    if(t.status.type === 'NEW') counts.new++; else counts.return++;
    if(t.status.cls === 'done') counts.completed++;
    else if(t.status.cls === 'cancel') counts.cancelled++;
    else if(t.status.cls === 'noshow') counts.noshow++;
    else if(t.status.cls === 'overdue') counts.overdue++;
  });

  const withTime = todays.filter(t => t.slot);
  const priority = todays.filter(t => t.priority >= 3).sort((a, b) => b.priority - a.priority);

  const data = {
    clinic: 'Enzo Homoeo Medical Centre',
    date: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    doctor: store.get('user') || 'Doctor',
    todays, counts, priority,
    first: withTime[0] || null,
    last: withTime.length ? withTime[withTime.length - 1] : null
  };
  data.text = reportText(data);
  return data;
}

/** Plain-text Morning Clinic Summary — identical shape to the backend so
 *  the Dashboard preview matches what lands in email/Telegram/WhatsApp. */
export function reportText(d){
  const L = [];
  L.push(d.clinic);
  L.push('Morning Clinic Summary');
  L.push('Date: ' + d.date);
  L.push('Doctor: ' + d.doctor);
  L.push('');
  L.push("Today's Appointments: " + d.counts.appts);
  L.push('New Patients: ' + d.counts.new);
  L.push('Return Patients: ' + d.counts.return);
  L.push('Last Visit Completed: ' + d.counts.completed);
  L.push('Last Visit Cancelled: ' + d.counts.cancelled);
  L.push('Last Visit No-show: ' + d.counts.noshow);
  L.push('Patients requiring attention: ' + d.priority.length);
  L.push("Today's first appointment: " + (d.first ? d.first.time + ' — ' + d.first.name : '—'));
  L.push("Today's last appointment: " + (d.last ? d.last.time + ' — ' + d.last.name : '—'));
  if(d.priority.length){
    L.push('');
    L.push('Priority patients:');
    d.priority.forEach(p => L.push('  • ' + p.name + ' (' + p.opd + ') — ' + (p.reasons.join(', ') || 'needs attention')));
  }
  return L.join('\n');
}

/* ---------- Dashboard rendering ---------- */
let activeFilter = null; // null = show all today's appts; else a status filter key

const SUMS = [
  { key: 'appts',     label: 'Appointments', dot: 'c-appt' },
  { key: 'new',       label: 'New',          dot: 'c-new' },
  { key: 'return',    label: 'Return',       dot: 'c-return' },
  { key: 'completed', label: 'Last done',    dot: 'c-done' },
  { key: 'cancelled', label: 'Last cancel',  dot: 'c-cancel' },
  { key: 'noshow',    label: 'Last no-show', dot: 'c-noshow' },
  { key: 'overdue',   label: 'Follow-up due',dot: 'c-overdue' }
];

function filterTodays(d){
  if(!activeFilter) return d.todays;
  if(activeFilter === 'new') return d.todays.filter(t => t.status.type === 'NEW');
  if(activeFilter === 'return') return d.todays.filter(t => t.status.type === 'RETURN');
  const cls = { completed: 'done', cancelled: 'cancel', noshow: 'noshow', overdue: 'overdue' }[activeFilter];
  return d.todays.filter(t => t.status.cls === cls);
}

let onOpenTimeline = null;
export function setTimelineOpener(fn){ onOpenTimeline = fn; }

export function renderMorning(){
  const box = $('morningBrief');
  if(!box) return;
  const d = buildMorningReport();
  const idx = indexApptsByPatient();
  const sums = SUMS.map(s => `<button type="button" class="sumcard ${activeFilter === s.key ? 'on' : ''}" data-sum="${s.key}">
      <div class="sv">${d.counts[s.key]}</div>
      <div class="sl"><span class="d ${s.dot}"></span>${s.label}</div>
    </button>`).join('');

  const list = filterTodays(d);
  const rows = list.length ? list.map(t => {
    const prio = t.priority >= 3 ? `<span class="prio" title="${escapeHtml(t.reasons.join(', '))}">${'★'.repeat(t.priority)}</span>` : '';
    return `<div class="trow" role="button" tabindex="0" data-mpatient="${escapeHtml(t.patientId)}">
      <span class="tt">${escapeHtml(t.time)}</span>
      <span class="topd">${escapeHtml(t.opd)}</span>
      <span class="tnm">${escapeHtml(t.name)}</span>
      <span class="tbadges">${prio}<span class="tb ${t.type === 'Online' ? 'on' : 'off'}"><span class="d"></span>${t.type === 'Online' ? 'Online' : 'In-clinic'}</span>${statusBadgeHtml(t.patientId, idx)}</span>
    </div>`;
  }).join('') : `<div class="empty">${activeFilter ? 'No patients in this group today.' : 'No appointments scheduled for today.'}</div>`;

  box.innerHTML = `<div class="brief">
      <div class="brief-h"><h2>Today's morning briefing</h2><span class="sub">${escapeHtml(d.date)}</span></div>
      <div class="brief-sum">${sums}</div>
      <div class="brief-list">${rows}</div>
    </div>
    <div class="card">
      <div class="brief-h" style="margin:0 0 10px"><h2 style="font-size:.95rem">Morning report</h2><span class="sub">Same summary sent by email / Telegram / WhatsApp</span></div>
      <div class="morningreport" id="morningReportText">${escapeHtml(d.text)}</div>
      <div class="reportbar"><button class="btn-ghost" id="copyReport" style="flex:none;padding:9px 16px;min-height:auto">Copy report</button></div>
    </div>`;
}

export function initMorning(){
  const box = $('morningBrief');
  if(!box) return;
  box.addEventListener('click', e => {
    const sum = e.target.closest('[data-sum]');
    if(sum){ const k = sum.getAttribute('data-sum'); activeFilter = (activeFilter === k) ? null : k; renderMorning(); return; }
    const row = e.target.closest('[data-mpatient]');
    if(row && onOpenTimeline){ onOpenTimeline(row.getAttribute('data-mpatient')); return; }
    const copy = e.target.closest('#copyReport');
    if(copy){
      const txt = buildMorningReport().text;
      try{ navigator.clipboard.writeText(txt); copy.textContent = 'Copied ✓'; setTimeout(() => { copy.textContent = 'Copy report'; }, 1500); }catch(err){}
    }
  });
  box.addEventListener('keydown', e => {
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('[data-mpatient]'); if(!row || !onOpenTimeline) return;
    e.preventDefault(); onOpenTimeline(row.getAttribute('data-mpatient'));
  });
}
