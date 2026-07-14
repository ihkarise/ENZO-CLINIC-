/**
 * Settings module (Phase 2) — Administrator-only.
 *
 * One central place for clinic configuration that used to be hardcoded:
 *   • Clinic opening / closing time
 *   • Break timings (any number of breaks)
 *   • Slot duration (drives the Dynamic Appointment Engine — no more
 *     hardcoded SLOTS array)
 *   • Maximum appointments per day + per-weekday booking capacity
 *   • Theme (light / dark / follow-device)
 *   • Notifications (daily reminder email on/off)
 *
 * Settings are shared across the clinic: they load from and save to the
 * backend (EnzoBackend.gs `settings` / `saveSettings`) so every device sees
 * the same clinic timings. A local copy is cached in localStorage so the
 * booking form can still generate slots while offline or before the first
 * network load. Theme is the one exception — it is per-device (see theme.js)
 * and merely mirrored here for convenience.
 */
import { $ } from './core.js';
import { store, can } from './store.js';
import { fetchSettings, saveSettings as apiSaveSettings, isDemoMode } from './api.js';
import { getTheme, setTheme } from './theme.js';
import { toast } from './ui.js';

const LOCAL_KEY = 'enzo_settings_v1';

/** Built-in defaults. Chosen to reproduce the original hardcoded schedule
 *  (09:00–12:30 and 16:00–19:30 in 30-min slots) so an un-configured
 *  deployment behaves exactly as it did before Phase 2. Weekday keys use
 *  JS getDay(): 0=Sunday … 6=Saturday. */
export const DEFAULT_SETTINGS = {
  openTime: '09:00',
  closeTime: '20:00',
  slotDuration: 30,
  breaks: [{ start: '13:00', end: '16:00' }],
  maxPerDay: 40,
  capacity: { 0: 0, 1: 40, 2: 40, 3: 40, 4: 40, 5: 40, 6: 20 },
  // emailReminders: the existing daily follow-up/appointment reminder.
  // morningReport: Phase 3.5 — the Morning Clinic Summary, sent per channel.
  // The administrator can enable/disable each channel independently; the
  // backend (checkFollowUps / sendMorningReport) reads these flags.
  notifications: {
    emailReminders: true,
    morningReport: { email: true, telegram: false, whatsapp: false }
  }
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon→Sun for display

/** Merge stored settings over the defaults so a partial/older blob never
 *  leaves a required field undefined. */
export function normalizeSettings(raw){
  const s = raw && typeof raw === 'object' ? raw : {};
  const cap = Object.assign({}, DEFAULT_SETTINGS.capacity, s.capacity || {});
  return {
    openTime: s.openTime || DEFAULT_SETTINGS.openTime,
    closeTime: s.closeTime || DEFAULT_SETTINGS.closeTime,
    slotDuration: parseInt(s.slotDuration, 10) > 0 ? parseInt(s.slotDuration, 10) : DEFAULT_SETTINGS.slotDuration,
    breaks: Array.isArray(s.breaks) ? s.breaks.filter(b => b && b.start && b.end) : DEFAULT_SETTINGS.breaks.slice(),
    maxPerDay: (s.maxPerDay === '' || s.maxPerDay === null || s.maxPerDay === undefined) ? DEFAULT_SETTINGS.maxPerDay : Number(s.maxPerDay),
    capacity: cap,
    notifications: Object.assign({}, DEFAULT_SETTINGS.notifications, s.notifications || {}, {
      morningReport: Object.assign({}, DEFAULT_SETTINGS.notifications.morningReport, (s.notifications && s.notifications.morningReport) || {})
    })
  };
}

/** The settings the rest of the app should use right now — store value if
 *  loaded, else the last locally-cached copy, else built-in defaults. */
export function currentSettings(){
  const fromStore = store.get('settings');
  if(fromStore) return fromStore;
  return normalizeSettings(loadLocal());
}

function loadLocal(){
  try{ return JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); }catch(e){ return null; }
}
function saveLocal(s){
  try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(s)); }catch(e){ /* storage unavailable */ }
}

/* ---------- Dynamic Appointment Engine: slot generation ---------- */
const toMin = t => { const p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
const pad = n => String(n).padStart(2, '0');

/** Generate the list of "HH:MM" slots from the settings: from openTime,
 *  stepping by slotDuration, up to closeTime, skipping any slot that
 *  overlaps a break window. Pure function — no state, no hardcoded slots. */
export function generateSlots(s){
  const cfg = normalizeSettings(s);
  const dur = cfg.slotDuration;
  const open = toMin(cfg.openTime), close = toMin(cfg.closeTime);
  const breaks = cfg.breaks.map(b => ({ s: toMin(b.start), e: toMin(b.end) }));
  const out = [];
  if(!(dur > 0) || close <= open) return out;
  for(let t = open; t + dur <= close; t += dur){
    if(breaks.some(b => t < b.e && t + dur > b.s)) continue;
    out.push(pad(Math.floor(t / 60)) + ':' + pad(t % 60));
  }
  return out;
}

/** Configured capacity for a JS weekday (0..6), or null for "no limit". */
export function capacityForDay(s, weekday){
  const cfg = normalizeSettings(s);
  const c = cfg.capacity[weekday];
  if(c !== undefined && c !== null && c !== '') return Number(c);
  if(cfg.maxPerDay !== undefined && cfg.maxPerDay !== null && cfg.maxPerDay !== '') return Number(cfg.maxPerDay);
  return null;
}

/* ---------- load / save ---------- */

/** Load settings into the store: local cache first (instant, offline-safe),
 *  then the backend if reachable. Safe to call before login for the cache. */
export async function loadSettings(){
  const cached = loadLocal();
  if(cached) store.set({ settings: normalizeSettings(cached) });
  const token = store.get('token');
  if(isDemoMode() || !token || token === 'demo') return;
  try{
    const remote = await fetchSettings(token);
    if(remote && typeof remote === 'object'){
      const norm = normalizeSettings(remote);
      store.set({ settings: norm });
      saveLocal(norm);
    }
  }catch(e){ /* offline — keep cached/defaults */ }
}

/* ---------- Settings page rendering ---------- */
let breaksDraft = [];

function readForm(){
  return normalizeSettings({
    openTime: $('setOpen').value,
    closeTime: $('setClose').value,
    slotDuration: $('setSlotDur').value,
    breaks: breaksDraft.slice(),
    maxPerDay: $('setMaxDay').value,
    capacity: DAY_ORDER.reduce((acc, wd) => { acc[wd] = $('setCap' + wd).value; return acc; }, {}),
    notifications: {
      emailReminders: $('setEmailRem').checked,
      morningReport: {
        email: $('setMrEmail').checked,
        telegram: $('setMrTelegram').checked,
        whatsapp: $('setMrWhatsapp').checked
      }
    }
  });
}

function renderBreaks(){
  const box = $('setBreaks');
  box.innerHTML = breaksDraft.map((b, i) =>
    `<div class="break-row" data-i="${i}">
      <input type="time" class="brk-start" value="${b.start}" aria-label="Break ${i + 1} start"/>
      <span class="brk-to">to</span>
      <input type="time" class="brk-end" value="${b.end}" aria-label="Break ${i + 1} end"/>
      <button type="button" class="brk-del" data-del="${i}" aria-label="Remove break ${i + 1}">&times;</button>
    </div>`).join('') || '<div class="slotnote">No breaks — clinic runs straight through.</div>';
}

function renderSlotPreview(){
  const slots = generateSlots(readForm());
  $('setSlotPreview').textContent = slots.length
    ? `${slots.length} slots/day · ${slots[0]}–${slots[slots.length - 1]}`
    : 'No slots — check the times.';
}

export function renderSettings(){
  const s = currentSettings();
  $('setOpen').value = s.openTime;
  $('setClose').value = s.closeTime;
  $('setSlotDur').value = s.slotDuration;
  $('setMaxDay').value = s.maxPerDay;
  breaksDraft = s.breaks.map(b => ({ start: b.start, end: b.end }));
  DAY_ORDER.forEach(wd => { const el = $('setCap' + wd); if(el) el.value = (s.capacity[wd] ?? ''); });
  $('setEmailRem').checked = !!s.notifications.emailReminders;
  const mr = s.notifications.morningReport || {};
  $('setMrEmail').checked = !!mr.email;
  $('setMrTelegram').checked = !!mr.telegram;
  $('setMrWhatsapp').checked = !!mr.whatsapp;
  document.querySelectorAll('#setTheme button').forEach(b => b.classList.toggle('on', b.dataset.theme === getTheme()));
  renderBreaks();
  renderSlotPreview();
}

/** Build the per-weekday capacity inputs + theme buttons once. */
function buildCapacityGrid(){
  const grid = $('setCapGrid');
  if(!grid || grid.dataset.built) return;
  grid.innerHTML = DAY_ORDER.map(wd =>
    `<label class="caprow"><span>${DAY_NAMES[wd]}</span>
      <input type="number" min="0" max="200" id="setCap${wd}" aria-label="${DAY_NAMES[wd]} capacity"/></label>`).join('');
  grid.dataset.built = '1';
}

let saveInFlight = false;
async function doSave(){
  if(saveInFlight) return;
  if(!can('saveSettings')){ toast('Only an administrator can change settings'); return; }
  const next = readForm();
  saveInFlight = true;
  const btn = $('setSave'); btn.disabled = true; btn.setAttribute('data-state', 'b');
  let d;
  try{
    d = await apiSaveSettings(store.get('token'), next);
  }finally{
    saveInFlight = false; btn.disabled = false;
  }
  if(d && d.ok === false){ toast('Could not save settings'); btn.setAttribute('data-state', 'a'); return; }
  store.set({ settings: next });
  saveLocal(next);
  toast(d && d.queued ? 'Saved offline — will sync' : 'Settings saved');
  setTimeout(() => btn.setAttribute('data-state', 'a'), 900);
}

export function initSettings(){
  buildCapacityGrid();

  $('setTheme').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    setTheme(b.dataset.theme);
    document.querySelectorAll('#setTheme button').forEach(x => x.classList.toggle('on', x === b));
  });

  $('setBreaks').addEventListener('click', e => {
    const del = e.target.closest('[data-del]'); if(!del) return;
    breaksDraft.splice(+del.getAttribute('data-del'), 1);
    renderBreaks(); renderSlotPreview();
  });
  $('setBreaks').addEventListener('input', e => {
    const row = e.target.closest('.break-row'); if(!row) return;
    const i = +row.dataset.i;
    if(e.target.classList.contains('brk-start')) breaksDraft[i].start = e.target.value;
    if(e.target.classList.contains('brk-end')) breaksDraft[i].end = e.target.value;
    renderSlotPreview();
  });
  $('setAddBreak').addEventListener('click', () => {
    breaksDraft.push({ start: '13:00', end: '14:00' });
    renderBreaks(); renderSlotPreview();
  });

  ['setOpen', 'setClose', 'setSlotDur'].forEach(id => $(id).addEventListener('input', renderSlotPreview));
  $('setSave').addEventListener('click', doSave);

  // reflect current theme selection even before the page is first opened
  document.querySelectorAll('#setTheme button').forEach(b => b.classList.toggle('on', b.dataset.theme === getTheme()));
}
