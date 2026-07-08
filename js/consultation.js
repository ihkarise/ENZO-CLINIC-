/**
 * Complete Consultation workflow: the modal a doctor opens from a scheduled
 * appointment to record Diagnosis / Clinical Notes / Medicine Duration /
 * Medicine Notes / Follow-up Date / Outcome, and the automation that fires
 * once it is saved — generate the follow-up appointment, flip the source
 * appointment to Completed, and (for Online consultations) create the
 * Online Record automatically. Nothing here asks staff to re-type data the
 * booking already captured.
 */
import { $, fmt, rid, toISODate } from './core.js';
import { store, can } from './store.js';
import { postAction } from './api.js';
import { mapAppt, computeFollowUp, STAGE } from './workflow.js';
import { toast, openOverlay, closeOverlay } from './ui.js';

let medDuration = 30, outcome = 'Completed', currentAppt = null, readOnly = false;
let onAfterSave = () => {};
export function setAfterSaveHook(fn){ onAfterSave = fn; }

function setChip(){
  document.querySelectorAll('#cChips .chip').forEach(c => c.classList.toggle('on', +c.dataset.d === medDuration));
  $('cCustom').value = [15,30,45,60,90].indexOf(medDuration) >= 0 ? '' : medDuration;
}
function setOutcome(){
  document.querySelectorAll('#outcomeSeg button').forEach(b => b.classList.toggle('on', b.dataset.o === outcome));
}
function updateFollowUpPreview(){
  if(!currentAppt) return;
  const auto = computeFollowUp(currentAppt.apptDate, medDuration);
  if(!$('cFollowUp').dataset.touched) $('cFollowUp').value = auto ? toISODate(auto) : '';
  $('cFollowUpPreview').textContent = $('cFollowUp').value ? fmt(new Date($('cFollowUp').value + 'T00:00:00')) : '—';
}

export function openConsult(id, isView){
  const appt = store.get('appts').find(a => a.id === id);
  if(!appt) return;
  currentAppt = appt; readOnly = !!isView;
  medDuration = appt.medDuration || 30;
  outcome = appt.outcome || 'Completed';
  $('cDiagnosis').value = appt.diagnosis || '';
  $('cNotes').value = appt.clinicalNotes || '';
  $('cMedNotes').value = appt.medNotes || '';
  $('cFollowUp').value = appt.followUp ? toISODate(appt.followUp) : '';
  delete $('cFollowUp').dataset.touched;
  setChip(); setOutcome(); updateFollowUpPreview();

  $('consultTitle').textContent = readOnly ? 'Consultation record' : 'Complete consultation';
  $('consultSub').textContent = `${appt.name} · ${fmt(appt.apptDate)}${appt.slot ? ' · ' + appt.slot : ''}`;
  ['cDiagnosis','cNotes','cMedNotes','cFollowUp'].forEach(id2 => $(id2).disabled = readOnly);
  document.querySelectorAll('#cChips .chip, #outcomeSeg button').forEach(b => b.disabled = readOnly);
  $('cCustom').disabled = readOnly;
  $('consultSave').hidden = readOnly || !can('complete');
  $('consultClose').textContent = readOnly ? 'Close' : 'Cancel';

  openOverlay('consultOverlay', readOnly ? $('consultClose') : $('cDiagnosis'));
}

async function saveConsult(){
  if(!currentAppt) return;
  const diagnosis = $('cDiagnosis').value.trim();
  const clinicalNotes = $('cNotes').value.trim();
  const medNotes = $('cMedNotes').value.trim();
  const followUpStr = $('cFollowUp').value;

  const stage = outcome === 'Cancelled' ? STAGE.CANCELLED : outcome === 'NoShow' ? STAGE.NOSHOW : STAGE.COMPLETED;
  const willFollowUp = stage === STAGE.COMPLETED && followUpStr;
  const followUpId = willFollowUp ? rid() : '';

  const payload = {
    action: 'complete', token: store.get('token'), id: currentAppt.id,
    stage, diagnosis, clinicalNotes, medDuration, medNotes,
    followUp: followUpStr || '', outcome,
    autoFollowUpId: followUpId,
    autoOnlineRecord: stage === STAGE.COMPLETED && currentAppt.type === 'Online'
  };

  $('consultSave').setAttribute('data-state', 'b');
  const d = await postAction(payload);
  if(d && d.ok === false){
    toast('Could not save consultation');
    $('consultSave').setAttribute('data-state', 'a');
    return;
  }

  const appts = store.get('appts').slice();
  const idx = appts.findIndex(a => a.id === currentAppt.id);
  if(idx >= 0){
    appts[idx] = { ...appts[idx], stage, diagnosis, clinicalNotes, medDuration, medNotes,
      followUp: followUpStr ? new Date(followUpStr + 'T00:00:00') : null, outcome };
  }
  if(willFollowUp){
    appts.push(mapAppt({
      id: followUpId, name: currentAppt.name, phone: currentAppt.phone, type: currentAppt.type,
      apptDate: followUpStr, slot: '', stage: STAGE.SCHEDULED, parentId: currentAppt.id
    }));
  }
  store.set({ appts });

  if(payload.autoOnlineRecord){
    const online = store.get('onlineRecords').slice();
    online.unshift({
      name: currentAppt.name, phone: currentAppt.phone, place: '',
      date: toISODate(currentAppt.apptDate), refby: '', notes: clinicalNotes
    });
    store.set({ onlineRecords: online });
  }

  closeOverlay('consultOverlay');
  const msgBits = [`${stage === STAGE.COMPLETED ? 'Consultation completed' : stage === STAGE.CANCELLED ? 'Marked cancelled' : 'Marked no-show'} for ${currentAppt.name}`];
  if(willFollowUp) msgBits.push(`follow-up booked ${fmt(new Date(followUpStr + 'T00:00:00'))}`);
  toast((d.queued ? 'Saved offline — will sync · ' : '') + msgBits.join(' · '));
  setTimeout(() => $('consultSave').setAttribute('data-state', 'a'), 500);
  currentAppt = null;
  onAfterSave();
}

export function initConsultation(){
  $('cChips').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if(!b) return;
    medDuration = +b.dataset.d; $('cCustom').value = '';
    delete $('cFollowUp').dataset.touched;
    setChip(); updateFollowUpPreview();
  });
  $('cCustom').addEventListener('input', e => {
    const n = parseInt(e.target.value, 10);
    if(n > 0){ medDuration = n; document.querySelectorAll('#cChips .chip').forEach(c => c.classList.remove('on'));
      delete $('cFollowUp').dataset.touched; updateFollowUpPreview(); }
  });
  $('cFollowUp').addEventListener('input', () => { $('cFollowUp').dataset.touched = '1'; updateFollowUpPreview(); });
  $('outcomeSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b || b.disabled) return;
    outcome = b.dataset.o; setOutcome();
  });
  $('consultSave').addEventListener('click', saveConsult);
  $('consultClose').addEventListener('click', () => closeOverlay('consultOverlay'));
  $('consultOverlay').addEventListener('click', e => { if(e.target === $('consultOverlay')) closeOverlay('consultOverlay'); });
}
