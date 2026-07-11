/**
 * Online patient record page. Behaviour ported unchanged from the original
 * build, with HTML-escaping added on render (fixes a stored-XSS hole where
 * patient name/place/referrer/notes were concatenated straight into
 * innerHTML) and an explicit loading state.
 */
import { $, fmt, escapeHtml } from './core.js';
import { store } from './store.js';
import { postAction } from './api.js';
import { toast } from './ui.js';
import { onlineSearchMatches, findPatientByPhone, createNewPatient } from './patients.js';

export function renderOnline(){
  const q = ($('oSearch').value || '').trim();
  const records = store.get('onlineRecords').slice()
    .filter(r => onlineSearchMatches(r, q))
    .sort((a,b) => new Date(b.date) - new Date(a.date));
  $('oCount').textContent = records.length ? records.length + (q ? ' found' : ' records') : '';
  const box = $('oList');
  if(store.get('loading')){
    box.innerHTML = '<div class="loading"><span class="spinner" aria-hidden="true"></span>Loading records…</div>';
    return;
  }
  if(!records.length){ box.innerHTML = `<div class="empty">${q ? 'No matches.' : 'No online records yet.<br>Add one to begin.'}</div>`; return; }
  box.innerHTML = records.map(r => {
    const meta = [r.place, r.refby ? 'Ref: ' + r.refby : ''].filter(Boolean).join(' · ');
    return `<div class="appt">
      <div class="awho"><div class="nm">${escapeHtml(r.name)}</div><div class="sub"><span class="ph">${escapeHtml(meta)}</span></div></div>
      <div class="ad" style="border:none;width:auto;padding:0"><div class="add">${fmt(new Date(r.date))}</div></div>
    </div>`;
  }).join('');
}

let saveInFlight = false;
export function initOnline(){
  $('oDate').value = new Date().toISOString().slice(0, 10);
  $('oSearch').addEventListener('input', renderOnline);
  $('oSave').addEventListener('click', async () => {
    if(saveInFlight) return; // ignore duplicate click/tap while a save is already in flight
    const name = $('oName').value.trim();
    if(!name){ toast('Enter a name'); return; }
    const rec = {
      action: 'online', token: store.get('token'), name,
      place: $('oPlace').value.trim(), date: $('oDate').value || new Date().toISOString().slice(0, 10),
      refby: $('oRef').value.trim(), phone: $('oPhone').value.trim(), notes: $('oNotes').value.trim()
    };
    saveInFlight = true;
    $('oSave').disabled = true;
    $('oSave').setAttribute('data-state', 'b');
    let d;
    try{
      d = await postAction(rec);
    }finally{
      saveInFlight = false;
      $('oSave').disabled = false;
    }
    if(d && d.ok === false){ toast(d.message || 'Could not save'); $('oSave').setAttribute('data-state', 'a'); return; }
    // The server always resolves/returns a patientId when reachable. When
    // the write is queued offline (or there is no backend at all — demo
    // mode) instead, fall back to a local phone match first; if there
    // isn't one either, create a local patient now (same as booking.js)
    // so the record links and groups in the Timeline immediately instead
    // of staying permanently unlinked. This never affects the outgoing
    // 'online' payload above — it never carries a patientId — so the
    // server still independently resolves/links the real patient by phone
    // whenever this write actually reaches it.
    let patientId = d.patientId || '';
    if(!patientId && rec.phone){
      const matched = findPatientByPhone(rec.phone);
      if(matched) patientId = matched.patientId;
    }
    if(!patientId){
      // The online record itself already saved successfully (checked
      // above) — if linking/creating the patient now fails (e.g. the
      // external OPD provider is unreachable), the record just stays
      // unlinked for now rather than losing the note the user already typed.
      try{
        const patient = await createNewPatient(store.get('token'), { name, phone: rec.phone });
        if(patient) patientId = patient.patientId;
      }catch(err){
        toast(err.message || 'Could not link patient record');
      }
    }
    const records = store.get('onlineRecords').slice();
    records.unshift({ name, place: rec.place, date: rec.date, refby: rec.refby, phone: rec.phone, notes: rec.notes, patientId });
    store.set({ onlineRecords: records });
    renderOnline();
    toast((d.queued ? 'Saved offline — will sync · ' : '') + 'Saved ' + name.split(' ')[0]);
    setTimeout(() => {
      $('oSave').setAttribute('data-state', 'a');
      ['oName','oPlace','oRef','oPhone','oNotes'].forEach(id => $(id).value = '');
      $('oDate').value = new Date().toISOString().slice(0, 10);
    }, 1100);
  });
}
