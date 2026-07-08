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

export function renderOnline(){
  const records = store.get('onlineRecords').slice().sort((a,b) => new Date(b.date) - new Date(a.date));
  $('oCount').textContent = records.length ? records.length + ' records' : '';
  const box = $('oList');
  if(store.get('loading')){
    box.innerHTML = '<div class="loading"><span class="spinner" aria-hidden="true"></span>Loading records…</div>';
    return;
  }
  if(!records.length){ box.innerHTML = '<div class="empty">No online records yet.<br>Add one to begin.</div>'; return; }
  box.innerHTML = records.map(r => {
    const meta = [r.place, r.refby ? 'Ref: ' + r.refby : ''].filter(Boolean).join(' · ');
    return `<div class="appt">
      <div class="awho"><div class="nm">${escapeHtml(r.name)}</div><div class="sub"><span class="ph">${escapeHtml(meta)}</span></div></div>
      <div class="ad" style="border:none;width:auto;padding:0"><div class="add">${fmt(new Date(r.date))}</div></div>
    </div>`;
  }).join('');
}

export function initOnline(){
  $('oDate').value = new Date().toISOString().slice(0, 10);
  $('oSave').addEventListener('click', async () => {
    const name = $('oName').value.trim();
    if(!name){ toast('Enter a name'); return; }
    $('oSave').setAttribute('data-state', 'b');
    const rec = {
      action: 'online', token: store.get('token'), name,
      place: $('oPlace').value.trim(), date: $('oDate').value || new Date().toISOString().slice(0, 10),
      refby: $('oRef').value.trim(), phone: $('oPhone').value.trim(), notes: $('oNotes').value.trim()
    };
    const d = await postAction(rec);
    if(d && d.ok === false){ toast('Could not save'); $('oSave').setAttribute('data-state', 'a'); return; }
    const records = store.get('onlineRecords').slice();
    records.unshift({ name, place: rec.place, date: rec.date, refby: rec.refby, phone: rec.phone, notes: rec.notes });
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
