/**
 * Backend access: login, reads, and writes. Also owns the offline write
 * queue and the demo-data generator.
 *
 * IMPORTANT (fixes a production bug from the previous build): demo data is
 * only ever used when CONFIG.WEB_APP_URL is genuinely blank. Previously the
 * app silently fell back to fabricated demo appointments whenever a
 * configured backend returned zero rows (new clinic, empty sheet) or a
 * transient network error — showing fake patients as if they were real. A
 * live backend that returns nothing now shows a real empty state instead.
 */
import { rid, DAY } from './core.js';

export const CONFIG = { WEB_APP_URL: "https://script.google.com/macros/s/AKfycbwheR6nx4fO4gOtCRppO0Naqcv5dcONSA2bfjYxEYxADfUq5i_5P87HsEeL6ljeUZM4Sw/exec" };
export const isDemoMode = () => !CONFIG.WEB_APP_URL;

const QUEUE_KEY = 'enzo_offline_queue_v1';

function loadQueue(){
  try{ return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }catch(e){ return []; }
}
function saveQueue(q){
  try{ localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }catch(e){ /* storage unavailable */ }
}
export function queueLength(){ return loadQueue().length; }

async function postRaw(body){
  const r = await fetch(CONFIG.WEB_APP_URL, { method: 'POST', body: JSON.stringify(body) });
  return r.json();
}

/**
 * Send a write action to the backend. If the network itself is unreachable
 * (fetch throws) the action is queued to localStorage and retried later —
 * the caller still gets ok:true with queued:true so the UI can proceed
 * optimistically. A server-returned error (validation, auth, slot clash) is
 * NOT queued: retrying it would not help, so it is surfaced immediately.
 */
export async function postAction(body){
  if(!CONFIG.WEB_APP_URL) return { ok: true, demo: true };
  try{
    const d = await postRaw(body);
    return d && typeof d === 'object' ? d : { ok: true };
  }catch(networkErr){
    const q = loadQueue();
    q.push({ id: rid(), body, queuedAt: Date.now() });
    saveQueue(q);
    return { ok: true, queued: true };
  }
}

/** Retry every queued write in order; stop at the first network failure so
 *  order is preserved and nothing is dropped. */
export async function flushQueue(onProgress){
  if(!CONFIG.WEB_APP_URL) return { flushed: 0, remaining: 0 };
  let q = loadQueue();
  if(!q.length) return { flushed: 0, remaining: 0 };
  let flushed = 0;
  while(q.length){
    const item = q[0];
    try{
      await postRaw(item.body);
      q.shift();
      flushed++;
      saveQueue(q);
      if(onProgress) onProgress(flushed, q.length);
    }catch(e){
      break; // still offline — stop, keep the rest queued
    }
  }
  return { flushed, remaining: q.length };
}

export async function login(user, pass){
  if(!CONFIG.WEB_APP_URL){
    return { ok: true, token: 'demo', user, role: demoRole(user) };
  }
  // No explicit Content-Type here, matching postRaw() below: Apps Script
  // Web Apps don't handle CORS preflight, and an explicit
  // application/json header forces the browser to preflight the request.
  // text/plain (fetch's default for a string body) avoids that entirely,
  // and doPost() parses e.postData.contents as JSON regardless.
  const r = await fetch(CONFIG.WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'login', user, pass })
  });
  const d = await r.json();
  if(d.ok) d.user = user;
  return d;
}

/** Demo-mode role heuristic so the role system is exercisable without a
 *  backend. Real deployments get the role from EnzoBackend.gs login(). */
function demoRole(user){
  const u = (user || '').toLowerCase();
  if(u.indexOf('doctor') >= 0 || u.indexOf('dr') === 0) return 'Doctor';
  if(u.indexOf('admin') >= 0) return 'Administrator';
  return 'Administrator'; // unassigned demo users default to full access
}

export async function fetchAppts(token){
  if(!CONFIG.WEB_APP_URL) return null;
  const r = await fetch(CONFIG.WEB_APP_URL + '?action=all&token=' + encodeURIComponent(token));
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

export async function fetchOnline(token){
  if(!CONFIG.WEB_APP_URL) return null;
  const r = await fetch(CONFIG.WEB_APP_URL + '?action=online&token=' + encodeURIComponent(token));
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

/* ---------- demo data (used only when WEB_APP_URL is blank) ---------- */
export function genDemoAppts(){
  const out = [], today = new Date(), start = new Date(today);
  start.setFullYear(today.getFullYear() - 1);
  const wf = [0.4, 1, 1.25, 1.15, 1.05, 0.9, 0.45];
  for(let d = new Date(start); d < today; d.setDate(d.getDate() + 1)){
    const n = Math.round((Math.random() * 3.5 + 2) * wf[d.getDay()]);
    for(let i = 0; i < n; i++){
      const on = Math.random() < 0.38, dd = [15,30,30,45,60][Math.floor(Math.random()*5)];
      const visit = new Date(d), appt = new Date(d); appt.setDate(appt.getDate() + dd);
      out.push({ id: rid(), name: 'Past patient', phone: '', type: on ? 'Online' : 'Offline',
        visit, days: dd, apptDate: appt, due: appt, call: new Date(appt.getTime() - DAY),
        slot: '', stage: 'Completed', outcome: 'Completed' });
    }
  }
  [['Asha Nair','Online',0,'10:00','98470 44444'],['Rahul Menon','Offline',0,'11:30','98470 11111'],
   ['Joseph K.','Online',1,'17:00','98470 33333'],['Sneha Pillai','Offline',5,'09:30','98470 22222']]
   .forEach(u => {
    const appt = new Date(); appt.setHours(0,0,0,0); appt.setDate(appt.getDate() + u[2]);
    const visit = new Date(appt); visit.setDate(visit.getDate() - 30);
    out.push({ id: rid(), name: u[0], phone: u[4], type: u[1], visit, days: 30,
      apptDate: appt, due: appt, call: new Date(appt.getTime() - DAY), slot: u[3], stage: 'Scheduled' });
  });
  return out;
}

export function genDemoOnline(){
  const src = ['Dr. Varun','Website','Instagram','Friend referral','Google','Facebook'], wt = [5,4,3,2,2,1], pool = [];
  src.forEach((s,i) => { for(let k=0;k<wt[i];k++) pool.push(s); });
  const o = [], t = new Date();
  for(let i = 0; i < 60; i++){
    const d = new Date(t); d.setDate(d.getDate() - Math.floor(Math.random() * 330));
    o.push({ name: 'Patient ' + (i+1), place: '', date: d.toISOString().slice(0,10),
      refby: pool[Math.floor(Math.random() * pool.length)], phone: '' });
  }
  return o;
}
