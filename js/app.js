/**
 * App bootstrap: wires every module together. This is the only file
 * index.html loads directly (`<script type="module" src="js/app.js">`).
 */
import { $ } from './core.js';
import { store } from './store.js';
import { CONFIG, isDemoMode, fetchAppts, fetchOnline, genDemoAppts, genDemoOnline, flushQueue, queueLength } from './api.js';
import { mapAppt } from './workflow.js';
import { initAuth, applyRoleGating } from './auth.js';
import { initBooking, renderAppts, resetBookingForm, setConsultOpener, setNavigator } from './booking.js';
import { initConsultation, openConsult, setAfterSaveHook } from './consultation.js';
import { initOnline, renderOnline } from './online.js';
import { initDashboard, renderDash, setToast } from './dashboard.js';
import { initTimeline } from './timeline.js';
import { initReminders, refreshToday, openTodayIfAny } from './reminders.js';
import { toast, wireConfirmDialog, wireEscapeToClose } from './ui.js';

const ORDER = ['pageBook', 'pageOnline', 'pageDash', 'pageTimeline'];
const SUBS = { pageBook: 'Appointments', pageOnline: 'Online records', pageDash: 'Analytics', pageTimeline: 'Patient timeline' };

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
  if(target === 'pageDash') renderDash();
}

async function loadData(){
  const token = store.get('token');
  store.set({ loading: true });
  renderAppts(); renderOnline();
  if(CONFIG.WEB_APP_URL && token && token !== 'demo'){
    let rawAppts = null, rawOnline = null;
    try{ rawAppts = await fetchAppts(token); }catch(e){ /* network down — leave null, see below */ }
    try{ rawOnline = await fetchOnline(token); }catch(e){ /* network down */ }
    store.set({
      appts: (rawAppts || []).filter(x => x.name).map(mapAppt),
      onlineRecords: rawOnline || [],
      loading: false
    });
    if(rawAppts === null && rawOnline === null){
      toast('Could not reach the server — showing cached data only.');
    }
    return;
  }
  // Demo mode only (CONFIG.WEB_APP_URL is blank) — never used as a silent
  // fallback for a configured-but-empty or unreachable production backend.
  store.set({ appts: genDemoAppts(), onlineRecords: genDemoOnline(), loading: false });
}

async function enterApp(){
  $('login').style.display = 'none';
  $('app').classList.add('shown');
  applyRoleGating();
  const badge = $('roleBadge'); if(badge) badge.hidden = false;
  resetBookingForm();
  await loadData();
  renderAppts(); renderOnline(); refreshToday(); renderDash();
  maybeFlushQueue();
  setTimeout(openTodayIfAny, 450);
}

function maybeFlushQueue(){
  if(!navigator.onLine) return;
  flushQueue().then(({ flushed, remaining, error }) => {
    if(flushed) toast(`Synced ${flushed} offline change${flushed > 1 ? 's' : ''}`);
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

function initLoginHint(){
  $('loginHint').textContent = isDemoMode()
    ? 'Demo mode — any username & password works.'
    : 'Staff sign in — ask an administrator for your login.';
}

function init(){
  initLoginHint();
  wireConfirmDialog();
  wireEscapeToClose(['overlay', 'confirmOverlay', 'consultOverlay']);
  setToast(toast);
  setNavigator(() => navTo('pageBook'));
  setConsultOpener(openConsult);
  setAfterSaveHook(() => { renderAppts(); renderDash(); refreshToday(); });

  initBooking();
  initConsultation();
  initOnline();
  initDashboard(toast);
  initTimeline();
  initReminders();
  initNav();
  initOfflineIndicator();
  initAuth(enterApp);
}

document.addEventListener('DOMContentLoaded', init);

if('serviceWorker' in navigator){
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
