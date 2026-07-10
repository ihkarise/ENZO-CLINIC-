/**
 * Booking page: the trimmed booking form (name, phone, consultation type,
 * appointment date, time slot only — no medicine/duration/timeline fields,
 * those now belong to the post-consultation flow in consultation.js) and
 * the Scheduled/Completed appointment list with search, edit, delete+undo
 * and Print Today's Schedule.
 */
import { $, fmt, same, to12h, rid, escapeHtml, digits, normPhone, ICON_EDIT, ICON_DEL, ICON_DONE, ICON_CALL, ICON_WA } from './core.js';
import { store, can } from './store.js';
import { postAction } from './api.js';
import { mapAppt, scheduledBucket, completedBucket, isScheduled } from './workflow.js';
import { currentSettings, generateSlots, capacityForDay } from './settings.js';
import { toast, confirmDialog } from './ui.js';
import { findPatientByPhone, patientSummary, createNewPatient, apptSearchMatches } from './patients.js';

/** Appointments still occupying a slot on a day (excludes cancelled/no-show
 *  and, when editing, the appointment being edited). */
function dayCount(dateStr, exceptId){
  const d = new Date(dateStr + 'T00:00:00');
  return store.get('appts').filter(a =>
    a.id !== exceptId && a.apptDate && isScheduled(a) && same(a.apptDate, d)
  ).length;
}

let onOpenConsult = null; // set by consultation.js via setConsultOpener()
export function setConsultOpener(fn){ onOpenConsult = fn; }

let onOpenTimeline = null; // set by app.js via setTimelineOpener() (opens timeline.js on a patient)
export function setTimelineOpener(fn){ onOpenTimeline = fn; }

/* ---------- Phase 3: duplicate-patient detection on the phone field ----------
   dupMatch: the store.patients row that exactly matches the typed phone, or
   null. dupDecision: null while the card is open awaiting a choice,
   'existing' once reception picks "Use existing", 'new' once they pick
   "Create new anyway". editPatientId carries an edited appointment's
   existing patientId through to save — editing never re-runs detection. */
let dupMatch = null, dupDecision = null, editPatientId = '';

function resetDup(){
  dupMatch = null; dupDecision = null; editPatientId = '';
  $('dupCard').hidden = true; $('dupChip').hidden = true;
}

function renderDup(){
  const card = $('dupCard'), chip = $('dupChip');
  if(!dupMatch){ card.hidden = true; chip.hidden = true; return; }
  if(dupDecision === null){
    chip.hidden = true;
    card.hidden = false;
    const s = patientSummary(dupMatch.patientId);
    $('dupOpd').textContent = dupMatch.opdNumber;
    $('dupName').textContent = dupMatch.name || '(no name on file)';
    $('dupMeta').textContent = s.lastVisit
      ? `Last visit ${fmt(s.lastVisit)}${s.diagnosis ? ' · ' + s.diagnosis : ''}`
      : 'No previous visits recorded';
    if(!$('name').value.trim() && dupMatch.name) $('name').value = dupMatch.name;
  }else{
    card.hidden = true;
    chip.hidden = false;
    chip.className = 'dupchip' + (dupDecision === 'new' ? ' new' : '');
    chip.textContent = dupDecision === 'existing'
      ? `Returning patient · ${dupMatch.opdNumber} — tap to change`
      : 'New patient will be created — tap to change';
  }
}

function checkDuplicate(){
  if(store.get('editingId')) return; // identity doesn't change on an edit
  const phone = $('phone').value;
  if(normPhone(phone).length !== 10){ dupMatch = null; dupDecision = null; renderDup(); return; }
  const match = findPatientByPhone(phone);
  if(!match){ dupMatch = null; dupDecision = null; renderDup(); return; }
  if(dupMatch && dupMatch.patientId === match.patientId) return; // unchanged — don't reopen a card the user already dismissed
  dupMatch = match; dupDecision = null;
  renderDup();
}

/* ---------- single source of truth for slot clashes (kills the old
   client/server duplicated-but-divergent slot-check logic) ---------- */
function isSlotTaken(dateStr, slot, exceptId){
  if(!slot || !dateStr) return false;
  return store.get('appts').some(a =>
    a.id !== exceptId && a.slot === slot && a.apptDate &&
    a.stage !== 'Cancelled' && a.stage !== 'NoShow' &&
    fmt(a.apptDate) === fmt(new Date(dateStr + 'T00:00:00'))
  );
}

function setSeg(){
  const type = store.get('bookingType');
  document.querySelectorAll('#seg .seg-btn').forEach(x => {
    const on = x.dataset.t === type;
    x.classList.toggle('on', on);
    x.setAttribute('aria-pressed', on);
  });
}

function renderSlots(){
  const box = $('slots'), dateStr = $('appt').value;
  if(!dateStr){ box.innerHTML = '<div class="slotnote">Pick an appointment date first.</div>'; return; }
  const d = new Date(dateStr + 'T00:00:00');
  const settings = currentSettings();
  const cap = capacityForDay(settings, d.getDay());

  // Clinic closed that day (capacity 0) — no booking possible.
  if(cap === 0){ box.innerHTML = '<div class="slotnote">The clinic is closed on this day. Pick another date.</div>'; return; }

  const editingId = store.get('editingId');
  const taken = store.get('appts').filter(a =>
    a.id !== editingId && a.slot && a.apptDate && a.stage !== 'Cancelled' && a.stage !== 'NoShow' && same(a.apptDate, d)
  ).map(a => a.slot);

  // Dynamic Appointment Engine: slots come from Settings, not a hardcoded
  // list. Keep the appointment's own slot visible while editing even if the
  // schedule was later changed so it no longer generates that slot.
  let base = generateSlots(settings);
  const editSlot = store.get('selectedSlot');
  if(editingId && editSlot && base.indexOf(editSlot) < 0) base = base.concat([editSlot]).sort();

  const avail = base.filter(s => taken.indexOf(s) < 0);
  let selectedSlot = store.get('selectedSlot');
  if(selectedSlot && avail.indexOf(selectedSlot) < 0){ selectedSlot = ''; store.set({ selectedSlot: '' }); }

  // Capacity note (max appointments per weekday).
  const used = dayCount(dateStr, editingId);
  let capNote = '';
  if(cap !== null){
    const left = Math.max(0, cap - used);
    capNote = `<div class="slotnote">${used}/${cap} booked this day · ${left} left</div>`;
    if(left <= 0){ box.innerHTML = `<div class="slotnote">This day is full (${cap} appointments). Pick another date.</div>`; return; }
  }

  const note = taken.length ? `<div class="slotnote">${taken.length} slot${taken.length > 1 ? 's' : ''} already booked this day</div>` : '';
  box.innerHTML = capNote + note + '<div class="slotgrid">' +
    avail.map(s => `<button type="button" class="slot${s === selectedSlot ? ' sel' : ''}" data-s="${s}">${to12h(s)}</button>`).join('') +
    '</div>' + (avail.length ? '' : '<div class="slotnote">No free slots left on this day.</div>');
}

function resetForm(){
  store.set({ editingId: null, apptTouched: false, selectedSlot: '', bookingType: 'Offline' });
  $('name').value = ''; $('phone').value = '';
  $('appt').value = '';
  setSeg();
  resetDup();
  $('editBanner').hidden = true;
  $('book').querySelector('.t4-a').textContent = 'Book appointment';
  renderSlots();
}

/** At-a-glance appointment badges — shown on the card without opening it.
 *  Status badge (stage) plus quick markers: Online / In-clinic, Follow-up
 *  (an auto- or manually-linked follow-up appointment), and Emergency
 *  (future-ready — rendered whenever an appointment carries the flag). */
function badge(a){
  const bits = [];
  if(a.emergency) bits.push('<span class="tb emerg"><span class="d"></span>Emergency</span>');
  if(a.stage === 'Cancelled') bits.push('<span class="tb cancel"><span class="d"></span>Cancelled</span>');
  else if(a.stage === 'NoShow') bits.push('<span class="tb noshow"><span class="d"></span>No-show</span>');
  else if(a.stage === 'Completed') bits.push('<span class="tb done"><span class="d"></span>Completed</span>');
  else bits.push(a.type === 'Online'
    ? '<span class="tb on"><span class="d"></span>Online</span>'
    : '<span class="tb off"><span class="d"></span>In-clinic</span>');
  if(a.parentId) bits.push('<span class="tb follow"><span class="d"></span>Follow-up</span>');
  return bits.join('');
}

function searchFilter(list){
  const q = ($('search').value || '').trim();
  if(!q) return list;
  return list.filter(a => apptSearchMatches(a, q));
}

function currentListFn(){
  const all = store.get('appts').filter(a => a.apptDate);
  const tab = store.get('listTab');
  if(tab === 'scheduled'){
    const sub = store.get('scheduledSub');
    return searchFilter(all.filter(a => isScheduled(a) && scheduledBucket(a) === sub));
  }
  const sub = store.get('completedSub');
  return searchFilter(all.filter(a => !isScheduled(a) && completedBucket(a) === sub));
}

function renderSubchips(){
  const box = $('subchips');
  const tab = store.get('listTab');
  const all = searchFilter(store.get('appts').filter(a => a.apptDate));
  if(tab === 'scheduled'){
    const cur = store.get('scheduledSub');
    const counts = { upcoming: 0, today: 0, pending: 0 };
    all.filter(isScheduled).forEach(a => counts[scheduledBucket(a)]++);
    box.innerHTML = ['upcoming','today','pending'].map(k =>
      `<button type="button" class="${k === cur ? 'on' : ''}" data-sub="${k}">${k[0].toUpperCase() + k.slice(1)} (${counts[k]})</button>`
    ).join('');
  }else{
    const cur = store.get('completedSub');
    const counts = { completed: 0, cancelled: 0, noshow: 0 };
    all.filter(a => !isScheduled(a)).forEach(a => counts[completedBucket(a)]++);
    box.innerHTML = [['completed','Completed'],['cancelled','Cancelled'],['noshow','No-show']].map(([k,label]) =>
      `<button type="button" class="${k === cur ? 'on' : ''}" data-sub="${k}">${label} (${counts[k]})</button>`
    ).join('');
  }
}

export function renderAppts(){
  renderSubchips();
  const q = ($('search').value || '').trim();
  const list = currentListFn().slice().sort((a,b) => (new Date(a.apptDate) - new Date(b.apptDate)) || ((a.slot || '').localeCompare(b.slot || '')));
  $('count').textContent = list.length ? list.length + (q ? ' found' : '') : '';
  const box = $('list');
  if(store.get('loading')){
    box.innerHTML = '<div class="loading"><span class="spinner" aria-hidden="true"></span>Loading appointments…</div>';
    return;
  }
  if(!list.length){
    box.innerHTML = `<div class="empty">${q ? 'No matches.' : 'Nothing here yet.'}</div>`;
    return;
  }
  const editingId = store.get('editingId');
  box.innerHTML = list.map(a => {
    const d = new Date(a.apptDate), isToday = same(d, new Date());
    const overdue = !isToday && isScheduled(a) && scheduledBucket(a) === 'pending';
    const dd = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const scheduled = isScheduled(a);
    const canComplete = scheduled && can('complete');
    const ph = digits(a.phone);
    const actions = [
      ph && can('call') ? `<a class="iact" href="tel:${ph}" aria-label="Call ${escapeHtml(a.name)}">${ICON_CALL}</a>` : '',
      ph && can('whatsapp') ? `<a class="iact" href="https://wa.me/${ph.replace(/^\+/, '')}" target="_blank" rel="noopener" aria-label="WhatsApp ${escapeHtml(a.name)}">${ICON_WA}</a>` : '',
      canComplete ? `<button class="iact go" data-consult="${a.id}" aria-label="Complete consultation for ${escapeHtml(a.name)}">${ICON_DONE}</button>` : '',
      scheduled && can('edit') ? `<button class="iact" data-edit="${a.id}" aria-label="Edit ${escapeHtml(a.name)}">${ICON_EDIT}</button>` : '',
      scheduled && can('cancel') ? `<button class="iact del" data-del="${a.id}" aria-label="Delete ${escapeHtml(a.name)}">${ICON_DEL}</button>` : '',
      !scheduled ? `<button class="iact" data-view="${a.id}" aria-label="View consultation for ${escapeHtml(a.name)}">${ICON_EDIT}</button>` : ''
    ].join('');
    return `<div class="appt ${isToday ? 'today' : ''} ${overdue ? 'overdue' : ''}" ${a.id === editingId ? 'style="box-shadow:0 0 0 1.5px var(--teal),var(--shadow)"' : ''}>
      <div class="ad"><div class="add">${dd}</div><div class="ats">${a.slot ? to12h(a.slot) : '—'}</div></div>
      <div class="awho"><div class="nm">${escapeHtml(a.name)}</div><div class="sub">${badge(a)}<span class="ph">${escapeHtml(a.phone)}</span></div></div>
      <div class="aact">${actions}</div>
    </div>`;
  }).join('');
}

function editAppt(id){
  const a = store.get('appts').find(x => x.id === id);
  if(!a) return;
  store.set({ editingId: id, apptTouched: true, bookingType: a.type === 'Online' ? 'Online' : 'Offline', selectedSlot: a.slot || '' });
  $('name').value = a.name || ''; $('phone').value = a.phone || '';
  setSeg();
  editPatientId = a.patientId || ''; dupMatch = null; dupDecision = null;
  $('dupCard').hidden = true; $('dupChip').hidden = true;
  $('appt').value = a.apptDate ? new Date(a.apptDate).toISOString().slice(0,10) : '';
  $('book').querySelector('.t4-a').textContent = 'Update appointment';
  $('editBanner').hidden = false; $('editName').textContent = a.name || 'this appointment';
  renderSlots();
  navigateToBooking();
  try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){}
}
let navigateToBooking = () => {};
export function setNavigator(fn){ navigateToBooking = fn; }

let bookInFlight = false;
async function saveAppt(){
  if(bookInFlight) return; // ignore duplicate click/tap while a save is already in flight
  const name = $('name').value.trim();
  if(!name){ toast('Enter a patient name'); return; }
  if(!$('appt').value){ toast('Pick an appointment date'); return; }
  const selectedSlot = store.get('selectedSlot');
  if(!selectedSlot){ toast('Pick a time slot'); return; }
  const editingId = store.get('editingId');
  if(isSlotTaken($('appt').value, selectedSlot, editingId)){ toast('That slot is taken — pick another'); renderSlots(); return; }
  const apptD = new Date($('appt').value + 'T00:00:00');
  const cap = capacityForDay(currentSettings(), apptD.getDay());
  if(cap !== null && dayCount($('appt').value, editingId) >= cap){
    toast(cap === 0 ? 'The clinic is closed on that day' : `That day is full (${cap} appointments)`); renderSlots(); return;
  }

  const id = editingId || rid();
  const type = store.get('bookingType');
  const apptDate = new Date($('appt').value + 'T00:00:00');
  const phone = $('phone').value.trim();

  bookInFlight = true;
  $('book').disabled = true;
  $('book').setAttribute('data-state', 'b');

  // Phase 3: resolve the permanent patient identity before booking — reuse
  // the matched patient, honour an explicit "Create new anyway", or (first
  // time this phone/name is seen) create one now so the OPD number exists
  // before the appointment does. Editing an existing appointment never
  // changes who it belongs to.
  let patientId = editingId ? editPatientId : '';
  if(!editingId){
    if(dupMatch && dupDecision !== 'new'){
      patientId = dupMatch.patientId;
    }else{
      const patient = await createNewPatient(store.get('token'), { name, phone });
      if(!patient){
        toast('Could not create patient record');
        bookInFlight = false; $('book').disabled = false;
        $('book').setAttribute('data-state', 'a');
        return;
      }
      patientId = patient.patientId;
    }
  }

  const rec = {
    action: editingId ? 'update' : 'book', token: store.get('token'), id,
    name, phone, type, patientId,
    apptDate: $('appt').value, slot: selectedSlot,
    stage: editingId ? undefined : 'Scheduled'
  };
  let d;
  try{
    d = await postAction(rec);
  }finally{
    bookInFlight = false;
    $('book').disabled = false;
  }
  if(d && d.ok === false){
    toast(d.error === 'slot_taken' ? 'That slot was just taken'
      : d.error === 'day_full' ? 'That day just filled up'
      : 'Could not save');
    setTimeout(() => $('book').setAttribute('data-state', 'a'), 400);
    return;
  }
  const obj = mapAppt({
    id, name, phone, type, apptDate: rec.apptDate, slot: selectedSlot, patientId,
    stage: editingId ? (store.get('appts').find(a => a.id === editingId) || {}).stage : 'Scheduled'
  });
  const appts = store.get('appts').slice();
  if(editingId){ const i = appts.findIndex(a => a.id === editingId); if(i >= 0) appts[i] = obj; }
  else appts.push(obj);
  store.set({ appts });
  const wasEdit = !!editingId;
  renderAppts();
  toast((d.queued ? 'Saved offline — will sync · ' : '') + (wasEdit ? 'Appointment updated' : `Booked ${name.split(' ')[0]} · ${fmt(apptDate)} ${to12h(selectedSlot)}`));
  resetForm();
  setTimeout(() => $('book').setAttribute('data-state', 'a'), 900);
}

async function performDelete(id){
  const appts = store.get('appts');
  const idx = appts.findIndex(a => a.id === id);
  if(idx < 0) return;
  const record = appts[idx];
  const remaining = appts.slice(); remaining.splice(idx, 1);
  store.set({ appts: remaining });
  if(store.get('editingId') === id) resetForm();
  renderAppts();

  let undone = false;
  const timer = setTimeout(async () => {
    if(undone) return;
    await postAction({ action: 'delete', token: store.get('token'), id });
  }, 5000);

  toast(`Deleted ${record.name}`, {
    actionLabel: 'Undo', duration: 5000,
    onAction: () => {
      undone = true; clearTimeout(timer);
      const restored = store.get('appts').slice(); restored.push(record);
      store.set({ appts: restored });
      renderAppts();
      toast('Restored');
    }
  });
}

function printTodaySchedule(){
  const today = new Date();
  const list = store.get('appts')
    .filter(a => a.apptDate && same(a.apptDate, today) && isScheduled(a))
    .sort((a,b) => (a.slot || '').localeCompare(b.slot || ''));
  const area = $('printArea');
  const dateLabel = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  area.innerHTML = `<h2>Today's Schedule — ${escapeHtml(dateLabel)}</h2>` +
    (list.length
      ? `<table style="width:100%;border-collapse:collapse;margin-top:10px">
          <thead><tr style="text-align:left;border-bottom:2px solid #000">
            <th style="padding:6px 8px">Time</th><th style="padding:6px 8px">Patient</th>
            <th style="padding:6px 8px">Phone</th><th style="padding:6px 8px">Type</th>
          </tr></thead><tbody>${list.map(a => `<tr style="border-bottom:1px solid #ccc">
            <td style="padding:6px 8px">${a.slot ? escapeHtml(to12h(a.slot)) : '—'}</td>
            <td style="padding:6px 8px">${escapeHtml(a.name)}</td>
            <td style="padding:6px 8px">${escapeHtml(a.phone)}</td>
            <td style="padding:6px 8px">${a.type}</td>
          </tr>`).join('')}</tbody></table>`
      : '<p>No appointments scheduled for today.</p>');
  window.print();
}

export function initBooking(){
  $('slots').addEventListener('click', e => {
    const b = e.target.closest('.slot'); if(!b) return;
    store.set({ selectedSlot: b.dataset.s });
    renderSlots();
  });
  $('seg').addEventListener('click', e => {
    const b = e.target.closest('.seg-btn'); if(!b) return;
    store.set({ bookingType: b.dataset.t });
    setSeg();
  });
  $('appt').addEventListener('input', () => { store.set({ apptTouched: true }); renderSlots(); });
  $('editCancel').addEventListener('click', resetForm);
  $('book').addEventListener('click', saveAppt);
  $('search').addEventListener('input', renderAppts);
  $('printToday').addEventListener('click', printTodaySchedule);

  let dupTimer = null;
  $('phone').addEventListener('input', () => { clearTimeout(dupTimer); dupTimer = setTimeout(checkDuplicate, 250); });
  $('phone').addEventListener('blur', checkDuplicate);
  $('dupUseExisting').addEventListener('click', () => { dupDecision = 'existing'; renderDup(); });
  $('dupCreateNew').addEventListener('click', () => { dupDecision = 'new'; renderDup(); });
  $('dupChip').addEventListener('click', () => { dupDecision = null; renderDup(); });
  $('dupTimeline').addEventListener('click', () => { if(dupMatch && onOpenTimeline) onOpenTimeline(dupMatch.patientId); });

  $('listTabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    store.set({ listTab: b.dataset.tab });
    document.querySelectorAll('#listTabs button').forEach(x => x.classList.toggle('on', x === b));
    renderAppts();
  });
  $('subchips').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(store.get('listTab') === 'scheduled') store.set({ scheduledSub: b.dataset.sub });
    else store.set({ completedSub: b.dataset.sub });
    renderAppts();
  });

  $('list').addEventListener('click', async e => {
    const ed = e.target.closest('[data-edit]');
    const dl = e.target.closest('[data-del]');
    const co = e.target.closest('[data-consult]');
    const vw = e.target.closest('[data-view]');
    if(ed) editAppt(ed.getAttribute('data-edit'));
    else if(dl){
      const a = store.get('appts').find(x => x.id === dl.getAttribute('data-del'));
      if(!a) return;
      const ok = await confirmDialog('Delete appointment?', `${a.name}${a.apptDate ? ' · ' + fmt(new Date(a.apptDate)) + (a.slot ? ' ' + to12h(a.slot) : '') : ''} — this cannot be undone.`);
      if(ok) performDelete(a.id);
    }
    else if(co && onOpenConsult) onOpenConsult(co.getAttribute('data-consult'), false);
    else if(vw && onOpenConsult) onOpenConsult(vw.getAttribute('data-view'), true);
  });

  resetForm();
}

export { resetForm as resetBookingForm };
