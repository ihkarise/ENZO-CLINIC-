/**
 * Enzo Homoeo — Secured backend v3 (Apps Script + Google Sheet)
 * Phase 3: Patient Master + Unique Patient ID + Timeline Foundation.
 *
 * Adds the clinic consultation workflow on top of the existing appointment
 * management (book / update / delete / slot clash prevention / reminders):
 * a "complete" action that records a consultation outcome, auto-books the
 * follow-up appointment and auto-creates the Online Record — so reception
 * and the doctor never re-type the same visit twice. Every new column is
 * appended after the original ones; nothing already in the sheet moves, so
 * existing rows and existing formulas keep working untouched.
 *
 * TABS:
 *  "Appointments"  A Name | B Phone | C Visit | D Days | E Type |
 *                  F Follow-up(f, legacy) | G Call(f, legacy) | H Status(legacy) | I Notes(legacy) |
 *                  J ID | K Appt Date | L Slot |
 *                  M Stage | N Diagnosis | O Clinical Notes | P Medicine Duration |
 *                  Q Medicine Notes | R Follow-up Date | S Outcome | T Parent Appt ID |
 *                  U Patient ID (Phase 3 — permanent link into "Patients")
 *  "OnlineRecords" A Name | B Phone | C Place | D Consultation Date | E Referred By | F Notes |
 *                  G Source Appt ID (blank for manually-entered records; set
 *                  only on records auto-created by 'complete', used to stop
 *                  a retried/duplicated 'complete' call from creating a
 *                  second record for the same consultation) |
 *                  H Patient ID (Phase 3)
 *  "Patients"      A Patient ID | B OPD Number | C Name | D Phone | E Gender |
 *                  F DOB | G Address | H Email | I Created Date | J Updated Date |
 *                  K Status | L Notes
 *                  One row per patient, forever. Patient ID (e.g. "pt...")
 *                  is the permanent internal key every other tab links to;
 *                  OPD Number (e.g. "ENZO-000001") is the human-facing,
 *                  sequential, never-reused, never-edited identifier shown
 *                  and searched everywhere. Appointments/OnlineRecords keep
 *                  their own Name/Phone columns too (for compatibility and
 *                  so the sheet reads fine on its own) — Patient ID is the
 *                  source of truth for "is this the same patient", not
 *                  name/phone matching.
 *
 * Stage is one of: Scheduled | Completed | Cancelled | NoShow. A blank
 * Stage cell (any row created before this update) is treated as Scheduled.
 *
 * ROLES: each user has USER_<name> (password hash) and, optionally,
 * ROLE_<name> ('Receptionist' | 'Doctor' | 'Administrator' — missing role
 * defaults to Administrator). Both the write endpoint (doPost) and the
 * read endpoint (doGet) enforce the same per-role action allow-list (see
 * CAN below) so a restriction hidden in the UI can't be bypassed by
 * calling the API directly.
 *
 * CONCURRENCY: book/update/complete/createPatient each take a short
 * script-wide lock (LockService) around their availability check (or OPD
 * sequence increment) and the write that follows it, so two requests
 * arriving at the same instant can't both pass the check and double-book
 * the same date+slot, or double-allocate the same OPD number.
 */

const SHEET_NAME    = 'Appointments';
const ONLINE_SHEET  = 'OnlineRecords';
const PATIENTS_SHEET = 'Patients';
const SESSION_SECS  = 6 * 3600;

/* Phase 2: clinic configuration (opening/closing times, breaks, slot
 * duration, per-weekday capacity, notifications) is stored as one JSON blob
 * in a single Script Property. No new sheet tab is required — nothing in the
 * existing Appointments/OnlineRecords tabs moves or changes. A blank/missing
 * property means "use the app's built-in defaults", so an un-upgraded
 * deployment keeps working exactly as before. */
const SETTINGS_KEY = 'APP_SETTINGS';
function getSettings(){
  const raw = PropertiesService.getScriptProperties().getProperty(SETTINGS_KEY);
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch(err){ return {}; }
}

// 0-based columns
const COL  = {
  name:0, phone:1, visit:2, days:3, type:4, due:5, call:6, status:7, notes:8, id:9, appt:10, slot:11,
  stage:12, diagnosis:13, clinicalNotes:14, medDuration:15, medNotes:16, followUp:17, outcome:18, parentId:19,
  patientId:20
};
const COLO = { name:0, phone:1, place:2, date:3, refby:4, notes:5, srcId:6, patientId:7 };
const COLP = { id:0, opd:1, name:2, phone:3, gender:4, dob:5, address:6, email:7, created:8, updated:9, status:10, notes:11 };

/* ===== Phase 3: Patient Master ===== */
const PATIENT_SEQ_KEY = 'PATIENT_SEQ';
const PATIENTS_MIGRATED_KEY = 'PATIENTS_MIGRATED_V1';

/** Normalise a phone number for matching: digits only, last 10 kept (so a
 *  country code prefix like +91 doesn't create a false "different patient"). */
function normPhone(p){
  const d = String(p || '').replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}
function ensurePatientsHeader(sheet){
  if(sheet.getLastRow() === 0){
    sheet.appendRow(['Patient ID','OPD Number','Name','Phone','Gender','DOB','Address','Email','Created Date','Updated Date','Status','Notes']);
  }
}
function getPatientSeq(){
  return parseInt(PropertiesService.getScriptProperties().getProperty(PATIENT_SEQ_KEY) || '0', 10);
}
function savePatientSeq(n){
  PropertiesService.getScriptProperties().setProperty(PATIENT_SEQ_KEY, String(n));
}
/** Next permanent OPD number: ENZO-000001, ENZO-000002, ... Never reused,
 *  never edited — callers must hold the script lock before calling this. */
function nextOpdNumber(){
  const n = getPatientSeq() + 1;
  savePatientSeq(n);
  return 'ENZO-' + String(n).padStart(6, '0');
}
/** Find an existing patient by phone, or create one. This is the single
 *  source of truth for "is this the same patient" — used whenever a write
 *  (book / online / a legacy caller with no patientId) needs to resolve
 *  one. Exact-phone match only (name is never used to merge two different
 *  phone numbers into one patient — that would risk merging two real
 *  people). An optional providedId is trusted only if it is verified to
 *  exist in Patients — a stale/placeholder/corrupted ID (e.g. a client's
 *  offline-optimistic ID that was never actually created on the server)
 *  is never written to a row; it silently falls through to the normal
 *  phone-match-or-create path instead, exactly as if none was supplied.
 *  This is what guarantees an appointment can never end up pointing at a
 *  Patient ID that doesn't exist. Caller must hold the script lock. */
function findOrCreatePatient(name, phone, providedId){
  const sheet = sheetOf(PATIENTS_SHEET);
  ensurePatientsHeader(sheet);
  const data = sheet.getDataRange().getValues();
  if(providedId){
    for(let i = 1; i < data.length; i++){
      if(String(data[i][COLP.id]) === String(providedId)) return providedId;
    }
  }
  const ph = normPhone(phone);
  if(ph){
    for(let i = 1; i < data.length; i++){
      if(normPhone(data[i][COLP.phone]) === ph) return data[i][COLP.id];
    }
  }
  const patientId = 'pt' + Utilities.getUuid().slice(0, 10);
  const opd = nextOpdNumber();
  const now = new Date();
  sheet.appendRow([patientId, opd, name || '', phone || '', '', '', '', '', now, now, 'Active', '']);
  return patientId;
}
/** One-time, self-healing migration: any Appointments/OnlineRecords row
 *  that predates Phase 3 has a blank Patient ID. Link every such row to a
 *  patient (matched by phone, else created fresh with the next OPD
 *  number) without touching any other cell, and without ever creating two
 *  patients for the same phone number. Runs as O(rows) with three batched
 *  writes total (not one write per row), so it stays fast even at
 *  thousands of rows. Caller must hold the script lock. */
function ensurePatientLinks(apptSheet, onlineSheet){
  const patientSheet = sheetOf(PATIENTS_SHEET);
  ensurePatientsHeader(patientSheet);
  const pdata = patientSheet.getDataRange().getValues();
  const byPhone = new Map();
  for(let i = 1; i < pdata.length; i++){
    const r = pdata[i];
    if(!r[COLP.id]) continue;
    const ph = normPhone(r[COLP.phone]);
    if(ph && !byPhone.has(ph)) byPhone.set(ph, r[COLP.id]);
  }
  let seq = getPatientSeq();
  const newPatientRows = [];
  function getOrCreate(name, phone){
    const ph = normPhone(phone);
    if(ph && byPhone.has(ph)) return byPhone.get(ph);
    seq += 1;
    const patientId = 'pt' + Utilities.getUuid().slice(0, 10);
    const now = new Date();
    newPatientRows.push([patientId, 'ENZO-' + String(seq).padStart(6, '0'), name || '', phone || '', '', '', '', '', now, now, 'Active', '']);
    if(ph) byPhone.set(ph, patientId);
    return patientId;
  }

  const adata = apptSheet.getDataRange().getValues();
  const apptCol = []; let apptDirty = false;
  for(let i = 1; i < adata.length; i++){
    const r = adata[i];
    if(!r[COL.name]){ apptCol.push(['']); continue; }
    let pid = r[COL.patientId];
    if(!pid){ pid = getOrCreate(r[COL.name], r[COL.phone]); apptDirty = true; }
    apptCol.push([pid]);
  }
  if(apptDirty && apptCol.length) apptSheet.getRange(2, COL.patientId + 1, apptCol.length, 1).setValues(apptCol);

  const odata = onlineSheet.getDataRange().getValues();
  const onlineCol = []; let onlineDirty = false;
  for(let i = 1; i < odata.length; i++){
    const r = odata[i];
    if(!r[COLO.name]){ onlineCol.push(['']); continue; }
    let pid = r[COLO.patientId];
    if(!pid){ pid = getOrCreate(r[COLO.name], r[COLO.phone]); onlineDirty = true; }
    onlineCol.push([pid]);
  }
  if(onlineDirty && onlineCol.length) onlineSheet.getRange(2, COLO.patientId + 1, onlineCol.length, 1).setValues(onlineCol);

  if(newPatientRows.length) patientSheet.getRange(patientSheet.getLastRow() + 1, 1, newPatientRows.length, newPatientRows[0].length).setValues(newPatientRows);
  savePatientSeq(seq);
}
/** Runs ensurePatientLinks() exactly once, ever (flagged in Script
 *  Properties) — so every read after an upgrade is a cheap map lookup, not
 *  a full-sheet migration. Safe to call from doGet on every request. */
function ensureMigrated(){
  const props = PropertiesService.getScriptProperties();
  if(props.getProperty(PATIENTS_MIGRATED_KEY) === '1') return;
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(20000)) return; // another request is migrating right now; this request just serves un-migrated rows and the next one will see it done
  try{
    if(props.getProperty(PATIENTS_MIGRATED_KEY) === '1') return; // re-check inside the lock
    ensurePatientLinks(sheetOf(SHEET_NAME), sheetOf(ONLINE_SHEET));
    props.setProperty(PATIENTS_MIGRATED_KEY, '1');
  } finally {
    lock.releaseLock();
  }
}

/* ===== ONE-TIME SETUP: edit users, run once, then delete this function =====
 * ROLE_<user> is optional. Any user without one defaults to Administrator
 * (full access) so existing single shared logins are never locked out by
 * the new role system — assign Receptionist/Doctor explicitly to restrict. */
function setCredentials(){
  const props = PropertiesService.getScriptProperties();
  props.setProperty('USER_admin',   hash('ChangeThis#2026'));
  props.setProperty('ROLE_admin',   'Administrator');
  props.setProperty('USER_jasmine', hash('AnotherStrongPass'));
  props.setProperty('ROLE_jasmine', 'Receptionist');
}

/* ---------- auth ---------- */
function hash(s){
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return raw.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function login(user, pass){
  if(!user || !pass) return { ok:false };
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty('USER_' + user);
  if(stored && stored === hash(pass)){
    const token = Utilities.getUuid();
    const role = normalizeRole(props.getProperty('ROLE_' + user) || 'Administrator');
    CacheService.getScriptCache().put('tok_' + token, user + '|' + role, SESSION_SECS);
    return { ok:true, token:token, role:role };
  }
  return { ok:false };
}
function authed(token){ return token ? !!CacheService.getScriptCache().get('tok_' + token) : false; }
/* normalize a raw role string (any case/whitespace, e.g. " doctor", "DOCTOR")
 * to its canonical CAN table key. Falls back to the raw value if unrecognized. */
function normalizeRole(raw){
  const key = String(raw || '').trim().toLowerCase();
  const map = { receptionist: 'Receptionist', doctor: 'Doctor', administrator: 'Administrator' };
  return map[key] || raw;
}
/* role for a valid token, or '' if the token is invalid/expired */
function roleForToken(token){
  const v = token ? CacheService.getScriptCache().get('tok_' + token) : null;
  return v ? normalizeRole(v.split('|')[1] || 'Administrator') : '';
}
/* Write actions each role may perform. Mirrors js/store.js's can() table so
 * a hidden UI button (e.g. Complete Consultation for a Receptionist) can't
 * be bypassed by calling the API directly. Administrator: everything. */
const CAN = {
  Receptionist: ['book', 'update', 'delete', 'online', 'all', 'settings', 'patients', 'createPatient'],
  Doctor: ['complete', 'online', 'all', 'settings', 'patients'],
  Administrator: ['book', 'update', 'delete', 'complete', 'online', 'all', 'settings', 'saveSettings', 'patients', 'createPatient']
};
function allowed(token, action){
  const role = roleForToken(token);
  return !!(role && CAN[role] && CAN[role].indexOf(action) >= 0);
}
function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheetOf(name){ const ss = SpreadsheetApp.getActiveSpreadsheet(); return ss.getSheetByName(name) || ss.insertSheet(name); }
function tz(){ return Session.getScriptTimeZone(); }
function fmt(d){ return Utilities.formatDate(new Date(d), tz(), 'yyyy-MM-dd'); }

/* find the sheet row (1-based) for a given appointment id; 0 if not found */
function rowById(sheet, id){
  if(!id) return 0;
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    if(String(data[i][COL.id]) === String(id)) return i + 1;
  }
  return 0;
}
/* is a date+slot already used by a different, still-open appointment? */
function slotTaken(sheet, dateStr, slot, exceptId){
  if(!slot || !dateStr) return false;
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    const r = data[i];
    if(!r[COL.name]) continue;
    if(String(r[COL.id]) === String(exceptId)) continue;
    const stage = String(r[COL.stage] || '').trim();
    if(stage === 'Cancelled' || stage === 'NoShow') continue;
    if(String(r[COL.slot]) === String(slot) && r[COL.appt] && fmt(r[COL.appt]) === dateStr) return true;
  }
  return false;
}
/* Phase 2: how many still-open (Scheduled) appointments already sit on a
 * given date, and is that at/over the configured capacity for that weekday?
 * Capacity comes from Settings: capacity[weekday] (0=Sunday..6=Saturday),
 * falling back to maxPerDay, falling back to no limit. A limit of 0 means
 * the clinic is closed that day — no bookings allowed. This is enforced
 * here (server-side) so it cannot be bypassed by calling the API directly. */
function dayIsFull(sheet, dateStr, exceptId){
  const s = getSettings();
  const wd = new Date(dateStr + 'T00:00:00').getDay();
  const cap = (s.capacity && s.capacity[wd] !== undefined && s.capacity[wd] !== null && s.capacity[wd] !== '')
    ? Number(s.capacity[wd])
    : (s.maxPerDay !== undefined && s.maxPerDay !== null && s.maxPerDay !== '' ? Number(s.maxPerDay) : null);
  if(cap === null || isNaN(cap)) return false; // no limit configured
  const data = sheet.getDataRange().getValues();
  let n = 0;
  for(let i = 1; i < data.length; i++){
    const r = data[i];
    if(!r[COL.name]) continue;
    if(String(r[COL.id]) === String(exceptId)) continue;
    const stage = String(r[COL.stage] || '').trim();
    if(stage === 'Cancelled' || stage === 'NoShow' || stage === 'Completed') continue;
    if(r[COL.appt] && fmt(r[COL.appt]) === dateStr) n++;
  }
  return n >= cap;
}

/* has an online record already been auto-created for this source appointment? */
function onlineHasSource(sheet, apptId){
  if(!apptId) return false;
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){ if(String(data[i][COLO.srcId] || '') === String(apptId)) return true; }
  return false;
}
function setFormulas(sheet, row){
  sheet.getRange(row, 6).setFormula('=IF(AND(C'+row+'<>"",D'+row+'<>""),C'+row+'+D'+row+',"")');         // F Follow-up (legacy)
  sheet.getRange(row, 7).setFormula('=IF(K'+row+'<>"",K'+row+'-1,IF(F'+row+'<>"",F'+row+'-1,""))');        // G Call (legacy)
}

/* ---------- POST: login / book / update / delete / online / complete ---------- */
function doPost(e){
  let p; try { p = JSON.parse(e.postData.contents); } catch(err){ return json({ ok:false, error:'bad request' }); }
  if(p.action === 'login') return json(login(p.user, p.pass));
  if(!authed(p.token)) return json({ ok:false, error:'unauthorized' });
  if(!allowed(p.token, p.action)) return json({ ok:false, error:'forbidden' });

  if(p.action === 'saveSettings'){
    PropertiesService.getScriptProperties().setProperty(SETTINGS_KEY, JSON.stringify(p.settings || {}));
    return json({ ok:true });
  }

  if(p.action === 'book'){
    const sheet = sheetOf(SHEET_NAME);
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(20000)) return json({ ok:false, error:'busy' });
    try{
      const dateStr = p.apptDate ? fmt(p.apptDate) : '';
      if(dateStr && dayIsFull(sheet, dateStr, p.id)) return json({ ok:false, error:'day_full' });
      if(slotTaken(sheet, dateStr, p.slot, p.id)) return json({ ok:false, error:'slot_taken' });
      // Phase 3: every appointment links to a permanent patient. The
      // client resolves this itself when it already knows the patient
      // (returning-patient match, or a fresh createPatient call); if it
      // doesn't send one, or sends a stale/placeholder one (an
      // offline-queued write whose local ID never became real), fall back
      // to the same phone-match-or-create logic so no appointment is ever
      // left pointing at a Patient ID that doesn't exist.
      const patientId = findOrCreatePatient(p.name, p.phone, p.patientId);
      sheet.appendRow([p.name, p.phone || '', p.visit ? new Date(p.visit) : '', p.days || '', p.type || '']);
      const row = sheet.getLastRow();
      setFormulas(sheet, row);
      sheet.getRange(row, 10).setValue(p.id || ('a' + Utilities.getUuid().slice(0,10)));     // J id
      sheet.getRange(row, 11).setValue(p.apptDate ? new Date(p.apptDate) : '');               // K appt date
      sheet.getRange(row, 12).setValue(p.slot || '');                                         // L slot
      sheet.getRange(row, 13).setValue(p.stage || 'Scheduled');                               // M stage
      sheet.getRange(row, 21).setValue(patientId);                                            // U patient id
      return json({ ok:true, patientId:patientId });
    }finally{
      lock.releaseLock();
    }
  }

  if(p.action === 'update'){
    const sheet = sheetOf(SHEET_NAME);
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(20000)) return json({ ok:false, error:'busy' });
    try{
      if(slotTaken(sheet, p.apptDate ? fmt(p.apptDate) : '', p.slot, p.id)) return json({ ok:false, error:'slot_taken' });
      const row = rowById(sheet, p.id);
      if(!row) return json({ ok:false, error:'not_found' });
      sheet.getRange(row, 1, 1, 5).setValues([[p.name, p.phone || '', p.visit ? new Date(p.visit) : '', p.days || '', p.type || '']]);
      sheet.getRange(row, 11).setValue(p.apptDate ? new Date(p.apptDate) : '');
      sheet.getRange(row, 12).setValue(p.slot || '');
      // Patient identity does not change on an ordinary edit. Only touch
      // column U if the client explicitly sends a patientId — and even
      // then, verify/resolve it the same way book does, so a stale or
      // invalid client-supplied ID can never overwrite a correct link.
      if(p.patientId) sheet.getRange(row, 21).setValue(findOrCreatePatient(p.name, p.phone, p.patientId));
      setFormulas(sheet, row);
      return json({ ok:true });
    }finally{
      lock.releaseLock();
    }
  }

  if(p.action === 'delete'){
    const sheet = sheetOf(SHEET_NAME);
    const row = rowById(sheet, p.id);
    if(row) sheet.deleteRow(row);
    return json({ ok:true });
  }

  if(p.action === 'online'){
    const sheet = sheetOf(ONLINE_SHEET);
    // Locked like book/update/complete/createPatient: without this, two
    // simultaneous online-record writes for the same new phone number can
    // both miss each other's not-yet-committed row (creating two patients
    // for one phone) and can both read the OPD sequence before either
    // writes it back (handing out the same OPD number twice).
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(20000)) return json({ ok:false, error:'busy' });
    try{
      if(sheet.getLastRow() === 0) sheet.appendRow(['Name','Phone','Place','Consultation Date','Referred By','Notes','','Patient ID']);
      const patientId = findOrCreatePatient(p.name, p.phone, p.patientId);
      sheet.appendRow([p.name, p.phone || '', p.place || '', p.date ? new Date(p.date) : '', p.refby || '', p.notes || '', '', patientId]);
      return json({ ok:true, patientId:patientId });
    }finally{
      lock.releaseLock();
    }
  }

  if(p.action === 'createPatient'){
    const sheet = sheetOf(PATIENTS_SHEET);
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(20000)) return json({ ok:false, error:'busy' });
    try{
      // Unconditional create — no dedup check here. This is what powers
      // "Create New Anyway" in the booking duplicate-detection prompt: the
      // caller has already decided this is a different person, even if the
      // phone matches someone else. findOrCreatePatient() (the deduping
      // path) is used everywhere the caller has NOT made that decision.
      ensurePatientsHeader(sheet);
      const patientId = 'pt' + Utilities.getUuid().slice(0, 10);
      const opd = nextOpdNumber();
      const now = new Date();
      sheet.appendRow([patientId, opd, p.name || '', p.phone || '', p.gender || '', p.dob ? new Date(p.dob) : '', p.address || '', p.email || '', now, now, 'Active', p.notes || '']);
      return json({ ok:true, patient:{
        patientId:patientId, opdNumber:opd, name:p.name || '', phone:p.phone || '', gender:p.gender || '',
        dob:p.dob || '', address:p.address || '', email:p.email || '', notes:p.notes || '',
        createdDate:fmt(now), updatedDate:fmt(now), status:'Active'
      }});
    }finally{
      lock.releaseLock();
    }
  }

  if(p.action === 'complete'){
    const sheet = sheetOf(SHEET_NAME);
    const lock = LockService.getScriptLock();
    if(!lock.tryLock(20000)) return json({ ok:false, error:'busy' });
    try{
      const row = rowById(sheet, p.id);
      if(!row) return json({ ok:false, error:'not_found' });
      sheet.getRange(row, 13, 1, 8).setValues([[
        p.stage || 'Completed', p.diagnosis || '', p.clinicalNotes || '', p.medDuration || '',
        p.medNotes || '', p.followUp ? new Date(p.followUp) : '', p.outcome || '', ''
      ]]);
      const src = sheet.getRange(row, 1, 1, 21).getValues()[0];
      const patientId = findOrCreatePatient(src[COL.name], src[COL.phone], src[COL.patientId]);
      if(patientId !== src[COL.patientId]) sheet.getRange(row, 21).setValue(patientId);

      // idempotent: a retried/duplicated call with the same autoFollowUpId
      // must not create a second follow-up appointment.
      if(p.autoFollowUpId && p.followUp && !rowById(sheet, p.autoFollowUpId)){
        sheet.appendRow([src[COL.name], src[COL.phone], '', '', src[COL.type]]);
        const nrow = sheet.getLastRow();
        setFormulas(sheet, nrow);
        sheet.getRange(nrow, 10).setValue(p.autoFollowUpId);
        sheet.getRange(nrow, 11).setValue(new Date(p.followUp));
        sheet.getRange(nrow, 12).setValue('');
        sheet.getRange(nrow, 13).setValue('Scheduled');
        sheet.getRange(nrow, 20).setValue(p.id);
        sheet.getRange(nrow, 21).setValue(patientId);
      }

      // idempotent: a retried/duplicated call must not create a second
      // online record for the same source appointment.
      if(p.autoOnlineRecord){
        const osheet = sheetOf(ONLINE_SHEET);
        if(osheet.getLastRow() === 0) osheet.appendRow(['Name','Phone','Place','Consultation Date','Referred By','Notes','Source Appt ID','Patient ID']);
        if(!onlineHasSource(osheet, p.id)){
          osheet.appendRow([src[COL.name], src[COL.phone], '', src[COL.appt] || new Date(), '', p.clinicalNotes || '', p.id, patientId]);
        }
      }

      return json({ ok:true, patientId:patientId });
    }finally{
      lock.releaseLock();
    }
  }

  return json({ ok:false, error:'unknown action' });
}

/* ---------- GET: appointments or online records (token required) ---------- */
function doGet(e){
  const q = e.parameter || {};
  if(!authed(q.token)) return json({ ok:false, error:'unauthorized' });
  if(!allowed(q.token, q.action || 'all')) return json({ ok:false, error:'forbidden' });

  if(q.action === 'settings'){
    return json({ ok:true, settings: getSettings() });
  }

  if(q.action === 'patients'){
    ensureMigrated();
    const sheet = sheetOf(PATIENTS_SHEET);
    const data = sheet.getDataRange().getValues();
    const out = [];
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[COLP.id]) continue;
      out.push({
        patientId: r[COLP.id], opdNumber: r[COLP.opd], name: r[COLP.name], phone: r[COLP.phone],
        gender: r[COLP.gender] || '', dob: r[COLP.dob] ? fmt(r[COLP.dob]) : '',
        address: r[COLP.address] || '', email: r[COLP.email] || '',
        createdDate: r[COLP.created] ? fmt(r[COLP.created]) : '', updatedDate: r[COLP.updated] ? fmt(r[COLP.updated]) : '',
        status: r[COLP.status] || 'Active', notes: r[COLP.notes] || ''
      });
    }
    return json(out);
  }

  if(q.action === 'online'){
    ensureMigrated();
    const sheet = sheetOf(ONLINE_SHEET);
    const data = sheet.getDataRange().getValues();
    const out = [];
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[COLO.name]) continue;
      out.push({ name:r[COLO.name], phone:r[COLO.phone], place:r[COLO.place],
        date:r[COLO.date] ? fmt(r[COLO.date]) : '', refby:r[COLO.refby], notes:r[COLO.notes],
        patientId: r[COLO.patientId] || '' });
    }
    return json(out);
  }

  // appointments (default / action=all). Assigns an ID to any row missing one.
  ensureMigrated();
  const sheet = sheetOf(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const out = [];
  for(let i = 1; i < data.length; i++){
    const r = data[i];
    if(!r[COL.name]) continue;
    if(!r[COL.id]){ r[COL.id] = 'a' + Utilities.getUuid().slice(0,10); sheet.getRange(i+1, 10).setValue(r[COL.id]); }
    out.push({
      id: r[COL.id], name: r[COL.name], phone: r[COL.phone],
      type: (String(r[COL.type]).trim().toLowerCase() === 'online') ? 'Online' : 'Offline',
      visit: r[COL.visit] ? fmt(r[COL.visit]) : '',
      apptDate: r[COL.appt] ? fmt(r[COL.appt]) : (r[COL.due] ? fmt(r[COL.due]) : ''),
      due: r[COL.due] ? fmt(r[COL.due]) : '',
      slot: r[COL.slot] || '', days: r[COL.days] || '', status: String(r[COL.status] || ''),
      stage: String(r[COL.stage] || '').trim() || 'Scheduled',
      diagnosis: r[COL.diagnosis] || '', clinicalNotes: r[COL.clinicalNotes] || '',
      medDuration: r[COL.medDuration] || '', medNotes: r[COL.medNotes] || '',
      followUp: r[COL.followUp] ? fmt(r[COL.followUp]) : '',
      outcome: r[COL.outcome] || '', parentId: r[COL.parentId] || '',
      patientId: r[COL.patientId] || ''
    });
  }
  return json(out);
}

/* ===== DAILY REMINDERS (trigger -> checkFollowUps) ===== */
const CFG = {
  clinic: 'Enzo Homoeo Medical Centre',
  email:    { on:true,  to:'your-email@gmail.com' },
  whatsapp: { on:false, phone:'91XXXXXXXXXX',  apiKey:'YOUR_CALLMEBOT_KEY' },
  telegram: { on:false, token:'YOUR_BOT_TOKEN', chatId:'YOUR_CHAT_ID' }
};
function checkFollowUps(){
  const sheet = sheetOf(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const today = fmt(new Date());
  const callToday = [], dueToday = [];
  for(let i = 1; i < data.length; i++){
    const r = data[i];
    if(!r[COL.name]) continue;
    if(String(r[COL.status]).trim().toLowerCase() === 'done') continue;          // legacy "done" flag
    const stage = String(r[COL.stage] || '').trim();
    if(stage === 'Completed' || stage === 'Cancelled' || stage === 'NoShow') continue;
    const type = (String(r[COL.type]).trim().toLowerCase() === 'online') ? 'Online' : 'In-clinic';
    const slot = r[COL.slot] ? (' ' + r[COL.slot]) : '';
    const who = { name:r[COL.name], phone:r[COL.phone], type:type, slot:slot };
    if(r[COL.call] && fmt(r[COL.call]) === today) callToday.push(who);
    if(r[COL.appt] && fmt(r[COL.appt]) === today) dueToday.push(who);
  }
  if(!callToday.length && !dueToday.length) return;
  const m = buildMessage(callToday, dueToday);
  // Phase 2: the Settings "Send the daily reminder email" toggle can turn
  // the email off without touching this code. Missing setting = on (legacy).
  const notif = getSettings().notifications || {};
  const emailOn = CFG.email.on && notif.emailReminders !== false;
  if(emailOn)         MailApp.sendEmail(CFG.email.to, m.subject, m.text);
  if(CFG.whatsapp.on) UrlFetchApp.fetch('https://api.callmebot.com/whatsapp.php?phone='+CFG.whatsapp.phone+'&text='+encodeURIComponent(m.text)+'&apikey='+CFG.whatsapp.apiKey,{muteHttpExceptions:true});
  if(CFG.telegram.on) UrlFetchApp.fetch('https://api.telegram.org/bot'+CFG.telegram.token+'/sendMessage',{method:'post',muteHttpExceptions:true,payload:{chat_id:CFG.telegram.chatId,text:m.text}});
}
function buildMessage(callToday, dueToday){
  let t = '';
  if(dueToday.length){
    const on = dueToday.filter(p=>p.type==='Online'), off = dueToday.filter(p=>p.type==='In-clinic');
    t += '🔴 APPOINTMENTS TODAY (' + dueToday.length + ')\n';
    if(on.length){ t += '\nOnline (' + on.length + ') — send the link:\n'; on.forEach((p,i)=>t+='  '+(i+1)+'. '+p.name+p.slot+'  '+p.phone+'\n'); }
    if(off.length){ t += '\nIn-clinic (' + off.length + '):\n'; off.forEach((p,i)=>t+='  '+(i+1)+'. '+p.name+p.slot+'  '+p.phone+'\n'); }
    t += '\n';
  }
  if(callToday.length){
    t += '📞 CALL TODAY to confirm tomorrow (' + callToday.length + '):\n';
    callToday.forEach((p,i)=>t+='  '+(i+1)+'. '+p.name+'  '+p.phone+'  ['+p.type+']\n');
  }
  t += '\n— ' + CFG.clinic;
  return { subject:'🔔 '+CFG.clinic+': '+dueToday.length+' today, '+callToday.length+' to call', text:t };
}
