/**
 * App bootstrap: wires every module together. This is the only file
 * index.html loads directly (`<script type="module" src="js/app.js">`).
 */
import { $ } from './core.js';
import { store } from './store.js';
import { CONFIG, isDemoMode, fetchAppts, fetchOnline, fetchPatients, genDemoAppts, genDemoOnline, flushQueue, queueLength } from './api.js';
import { mapAppt } from './workflow.js';
import { deriveDemoPatients } from './patients.js';
import { initAuth, applyRoleGating } from './auth.js';
import { initBooking, renderAppts, resetBookingForm, setConsultOpener, setNavigator, setTimelineOpener as setBookingTimelineOpener } from './booking.js';
import { initConsultation, openConsult, setAfterSaveHook } from './consultation.js';
import { initOnline, renderOnline } from './online.js';
import { initDashboard, renderDash, setToast, setTimelineOpener as setDashTimelineOpener } from './dashboard.js';
import { initMorning, renderMorning, setTimelineOpener as setMorningTimelineOpener } from './morning.js';
import { initTimeline, openPatientTimeline } from './timeline.js';
import { initReminders, refreshToday, openTodayIfAny } from './reminders.js';
import { initSettings, renderSettings, loadSettings } from './settings.js';
import { initTheme, setTheme } from './theme.js';
import { toast, wireConfirmDialog, wireEscapeToClose } from './ui.js';

const ORDER = ['pageBook', 'pageOnline', 'pageDash', 'pageTimeline', 'pageSettings'];
const SUBS = { pageBook: 'Appointments', pageOnline: 'Online records', pageDash: 'Analytics', pageTimeline: 'Patient timeline', pageSettings: 'Settings' };

function navTo(target){
  const cur = document.querySelector('.page.active');
  if(cur.id === target) return;
  const fwd = ORDER.indexOf(target) > ORDER.indexOf(cur.id);
  document.querySelectorAll('#nav button').forEach(x => {
    const on = x.dataset.p === target;
    x.classList.toggle('on', on);
    if(on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
  });
  cur.classList.remove('active', 'anim-fwd', 'anim-back');
  const next = $(target);
  next.classList.add('active', fwd ? 'anim-fwd' : 'anim-back');
  $('hsub').textContent = SUBS[target] || '';
  if(target === 'pageDash'){ renderDash(); renderMorning(); }
  if(target === 'pageSettings') renderSettings();
}

async function loadData(){
  const token = store.get('token');
  store.set({ loading: true });
  renderAppts(); renderOnline();
  if(CONFIG.WEB_APP_URL && token && token !== 'demo'){
    let rawAppts = null, rawOnline = null, rawPatients = null;
    try{ rawAppts = await fetchAppts(token); }catch(e){ /* network down — leave null, see below */ }
    try{ rawOnline = await fetchOnline(token); }catch(e){ /* network down */ }
    try{ rawPatients = await fetchPatients(token); }catch(e){ /* network down */ }
    store.set({
      appts: (rawAppts || []).filter(x => x.name).map(mapAppt),
      onlineRecords: rawOnline || [],
      patients: rawPatients || [],
      loading: false
    });
    if(rawAppts === null && rawOnline === null){
      toast('Could not reach the server — showing cached data only.');
    }
    return;
  }
  // Demo mode only (CONFIG.WEB_APP_URL is blank) — never used as a silent
  // fallback for a configured-but-empty or unreachable production backend.
  const appts = genDemoAppts(), onlineRecords = genDemoOnline();
  const patients = deriveDemoPatients(appts, onlineRecords);
  store.set({ appts, onlineRecords, patients, loading: false });
}

async function enterApp(){
  $('login').style.display = 'none';
  $('app').classList.add('shown');
  applyRoleGating();
  const badge = $('roleBadge'); if(badge) badge.hidden = false;
  resetBookingForm();
  await Promise.all([loadData(), loadSettings()]);
  renderAppts(); renderOnline(); refreshToday(); renderDash(); renderMorning(); renderSettings();
  maybeFlushQueue();
  setTimeout(openTodayIfAny, 450);
}

function maybeFlushQueue(){
  if(!navigator.onLine) return;
  flushQueue().then(({ flushed, remaining, error }) => {
    if(flushed){
      toast(`Synced ${flushed} offline change${flushed > 1 ? 's' : ''}`);
      // Re-fetch so any patient created while offline (shown as "Pending
      // sync" / a temporary OPD number) picks up its real, server-assigned
      // Patient ID and OPD number without requiring a manual reload.
      loadData().then(() => { renderAppts(); renderOnline(); refreshToday(); renderDash(); renderMorning(); });
    }
    if(remaining > 0 && error && error !== 'offline'){
      toast(`${remaining} offline change${remaining > 1 ? 's' : ''} could not sync (${error}) — will retry`, { duration: 6000 });
    }
  });
}

function initOfflineIndicator(){
  const bar = $('offlineBar');
  function update(){
    const online = navigator.onLine;
    store.set({ online });
    bar.classList.toggle('show', !online);
    bar.textContent = queueLength() ? 'Offline — changes will sync automatically' : 'Offline — changes are saved locally';
  }
  window.addEventListener('online', () => { update(); maybeFlushQueue(); });
  window.addEventListener('offline', update);
  update();
}

function initNav(){
  $('nav').addEventListener('click', e => { const b = e.target.closest('button'); if(b) navTo(b.dataset.p); });
}

/** Header quick-toggle: flip between light and dark (a resolved theme), so
 *  one tap always visibly changes the theme. Fine-grained "follow system"
 *  lives in Settings → Appearance. */
function initThemeToggle(){
  const btn = $('themeToggle');
  if(!btn) return;
  btn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(isDark ? 'light' : 'dark');
  });
}

function initLoginHint(){
  $('loginHint').textContent = isDemoMode()
    ? 'Demo mode — any username & password works.'
    : 'Staff sign in — ask an administrator for your login.';
}

function init(){
  initTheme();
  initLoginHint();
  wireConfirmDialog();
  wireEscapeToClose(['overlay', 'confirmOverlay', 'consultOverlay']);
  setToast(toast);
  setNavigator(() => navTo('pageBook'));
  setConsultOpener(openConsult);
  setAfterSaveHook(() => { renderAppts(); renderDash(); renderMorning(); refreshToday(); });

  initBooking();
  initConsultation();
  initOnline();
  initDashboard(toast);
  initMorning();
  initTimeline();
  initReminders();
  initSettings();
  initThemeToggle();
  initNav();
  initOfflineIndicator();

  // Phase 3: "View timeline" (booking's Returning Patient card, Dashboard's
  // quick patient search) always switches to the Timeline page first, then
  // opens that patient — same pattern as setConsultOpener/setNavigator.
  const openTimelineFor = id => { navTo('pageTimeline'); openPatientTimeline(id); };
  setBookingTimelineOpener(openTimelineFor);
  setDashTimelineOpener(openTimelineFor);
  setMorningTimelineOpener(openTimelineFor);

  initAuth(enterApp);
}

document.addEventListener('DOMContentLoaded', init);

if('serviceWorker' in navigator){
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
