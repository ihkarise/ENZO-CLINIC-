/**
 * Booking page: the trimmed booking form (name, phone, consultation type,
 * appointment date, time slot only — no medicine/duration/timeline fields,
 * those now belong to the post-consultation flow in consultation.js) and
 * the Scheduled/Completed appointment list with search, edit, delete+undo
 * and Print Today's Schedule.
 */
import { $, SLOTS, fmt, same, to12h, rid, escapeHtml, ICON_EDIT, ICON_DEL, ICON_DONE } from './core.js';
import { store, can } from './store.js';
import { postAction } from './api.js';
import { mapAppt, scheduledBucket, completedBucket, isScheduled } from './workflow.js';
import { toast, confirmDialog } from './ui.js';

let onOpenConsult = null; // set by consultation.js via setConsultOpener()
export function setConsultOpener(fn){ onOpenConsult = fn; }

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
  const editingId = store.get('editingId');
  const taken = store.get('appts').filter(a =>
    a.id !== editingId && a.slot && a.apptDate && a.stage !== 'Cancelled' && a.stage !== 'NoShow' && same(a.apptDate, d)
  ).map(a => a.slot);
  const avail = SLOTS.filter(s => taken.indexOf(s) < 0);
  let selectedSlot = store.get('selectedSlot');
  if(selectedSlot && avail.indexOf(selectedSlot) < 0){ selectedSlot = ''; store.set({ selectedSlot: '' }); }
  const note = taken.length ? `<div class="slotnote">${taken.length} slot${taken.length > 1 ? 's' : ''} already booked this day</div>` : '';
  box.innerHTML = note + '<div class="slotgrid">' +
    avail.map(s => `<button type="button" class="slot${s === selectedSlot ? ' sel' : ''}" data-s="${s}">${to12h(s)}</button>`).join('') +
    '</div>' + (avail.length ? '' : '<div class="slotnote">No free slots left on this day.</div>');
}

function resetForm(){
  store.set({ editingId: null, apptTouched: false, selectedSlot: '', bookingType: 'Offline' });
  $('name').value = ''; $('phone').value = '';
  $('appt').value = '';
  setSeg();
  $('editBanner').hidden = true;
  $('book').querySelector('.t4-a').textContent = 'Book appointment';
  renderSlots();
}

function badge(a){
  if(a.stage === 'Cancelled') return '<span class="tb cancel"><span class="d"></span>Cancelled</span>';
  if(a.stage === 'NoShow') return '<span class="tb noshow"><span class="d"></span>No-show</span>';
  if(a.stage === 'Completed') return '<span class="tb done"><span class="d"></span>Completed</span>';
  return a.type === 'Online'
    ? '<span class="tb on"><span class="d"></span>Online</span>'
    : '<span class="tb off"><span class="d"></span>In-clinic</span>';
}

function currentListFn(){
  const q = ($('search').value || '').trim().toLowerCase();
  const all = store.get('appts').filter(a => a.apptDate);
  if(q) return all.filter(a => (a.name || '').toLowerCase().indexOf(q) >= 0 || (a.phone || '').toLowerCase().indexOf(q) >= 0);
  const tab = store.get('listTab');
  if(tab === 'scheduled'){
    const sub = store.get('scheduledSub');
    return all.filter(a => isScheduled(a) && scheduledBucket(a) === sub);
  }
  const sub = store.get('completedSub');
  return all.filter(a => !isScheduled(a) && completedBucket(a) === sub);
}

function renderSubchips(){
  const box = $('subchips');
  const tab = store.get('listTab');
  const all = store.get('appts').filter(a => a.apptDate);
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
    const actions = [
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
  $('appt').value = a.apptDate ? new Date(a.apptDate).toISOString().slice(0,10) : '';
  $('book').querySelector('.t4-a').textContent = 'Update appointment';
  $('editBanner').hidden = false; $('editName').textContent = a.name || 'this appointment';
  renderSlots();
  navigateToBooking();
  try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){}
}
let navigateToBooking = () => {};
export function setNavigator(fn){ navigateToBooking = fn; }

async function saveAppt(){
  const name = $('name').value.trim();
  if(!name){ toast('Enter a patient name'); return; }
  if(!$('appt').value){ toast('Pick an appointment date'); return; }
  const selectedSlot = store.get('selectedSlot');
  if(!selectedSlot){ toast('Pick a time slot'); return; }
  const editingId = store.get('editingId');
  if(isSlotTaken($('appt').value, selectedSlot, editingId)){ toast('That slot is taken — pick another'); renderSlots(); return; }

  const id = editingId || rid();
  const type = store.get('bookingType');
  const apptDate = new Date($('appt').value + 'T00:00:00');
  const rec = {
    action: editingId ? 'update' : 'book', token: store.get('token'), id,
    name, phone: $('phone').value.trim(), type,
    apptDate: $('appt').value, slot: selectedSlot,
    stage: editingId ? undefined : 'Scheduled'
  };
  $('book').setAttribute('data-state', 'b');
  const d = await postAction(rec);
  if(d && d.ok === false){
    toast(d.error === 'slot_taken' ? 'That slot was just taken' : 'Could not save');
    setTimeout(() => $('book').setAttribute('data-state', 'a'), 400);
    return;
  }
  const obj = mapAppt({
    id, name, phone: rec.phone, type, apptDate: rec.apptDate, slot: selectedSlot,
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
