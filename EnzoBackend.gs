/**
 * Enzo Homoeo — Secured backend v2 (Apps Script + Google Sheet)
 *
 * Adds full appointment management: edit, delete, reschedule, time slots,
 * and double-booking prevention. Every data call needs a login token.
 *
 * TABS:
 *  "Appointments"  A Name | B Phone | C Visit | D Days | E Type |
 *                  F Follow-up(f) | G Call(f) | H Status | I Notes |
 *                  J ID | K Appt Date | L Slot | M Diagnosis
 *  "OnlineRecords" A Name | B Phone | C Place | D Consultation Date | E Referred By | F Notes
 *
 * ROLES: each user has USER_<name> (password hash) and ROLE_<name>
 *        ('Receptionist' | 'Doctor' | 'Administrator'). Missing role => Administrator.
 */

const SHEET_NAME   = 'Appointments';
const ONLINE_SHEET = 'OnlineRecords';
const SESSION_SECS = 6 * 3600;
const ROLES = ['Receptionist', 'Doctor', 'Administrator'];

// 0-based columns
const COL  = { name:0, phone:1, visit:2, days:3, type:4, due:5, call:6, status:7, notes:8, id:9, appt:10, slot:11, diagnosis:12 };
const COLO = { name:0, phone:1, place:2, date:3, refby:4, notes:5 };

/* ===== ONE-TIME SETUP: edit users, run once, then delete this function =====
   Set a strong password and a role for each staff member. */
function setCredentials(){
  const props = PropertiesService.getScriptProperties();
  props.setProperty('USER_admin',   hash('ChangeThis#2026'));  props.setProperty('ROLE_admin',   'Administrator');
  props.setProperty('USER_reception', hash('ChangeThisToo#2026')); props.setProperty('ROLE_reception', 'Receptionist');
  props.setProperty('USER_doctor',  hash('AnotherStrongPass'));  props.setProperty('ROLE_doctor',  'Doctor');
}

/* ---------- auth ---------- */
function hash(s){
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return raw.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function roleOf(user){
  const r = PropertiesService.getScriptProperties().getProperty('ROLE_' + user);
  return ROLES.indexOf(r) >= 0 ? r : 'Administrator';
}
function login(user, pass){
  if(!user || !pass) return { ok:false };
  const stored = PropertiesService.getScriptProperties().getProperty('USER_' + user);
  if(stored && stored === hash(pass)){
    const token = Utilities.getUuid();
    const role = roleOf(user);
    CacheService.getScriptCache().put('tok_' + token, user + '|' + role, SESSION_SECS);
    return { ok:true, token:token, role:role, name:user };
  }
  return { ok:false };
}
function authed(token){ return token ? !!CacheService.getScriptCache().get('tok_' + token) : false; }
/* returns role for a token, or '' if invalid */
function roleForToken(token){
  const v = token ? CacheService.getScriptCache().get('tok_' + token) : null;
  return v ? (v.split('|')[1] || 'Administrator') : '';
}
/* actions each role may perform on the write endpoint */
const CAN = {
  Receptionist: ['book','update','delete','online'],
  Doctor:       ['book','update','complete','online'],
  Administrator:['book','update','delete','complete','online']
};
function allowed(token, action){
  const role = roleForToken(token);
  return role && CAN[role] && CAN[role].indexOf(action) >= 0;
}
function json(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheetOf(name){ const ss = SpreadsheetApp.getActiveSpreadsheet(); return ss.getSheetByName(name) || ss.insertSheet(name); }
function tz(){ return Session.getScriptTimeZone(); }
function fmt(d){ return Utilities.formatDate(new Date(d), tz(), 'yyyy-MM-dd'); }

/* find the sheet row (1-based) for a given appointment id; 0 if not found */
function rowById(sheet, id){
  if(!id) return 0;
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){ if(String(data[i][COL.id]) === String(id)) return i + 1; }
  return 0;
}
/* is a date+slot already used by a different appointment? */
function slotTaken(sheet, dateStr, slot, exceptId){
  if(!slot || !dateStr) return false;
  const data = sheet.getDataRange().getValues();
  for(let i = 1; i < data.length; i++){
    const r = data[i];
    if(!r[COL.name]) continue;
    if(String(r[COL.id]) === String(exceptId)) continue;
    if(String(r[COL.slot]) === String(slot) && r[COL.appt] && fmt(r[COL.appt]) === dateStr) return true;
  }
  return false;
}
function setFormulas(sheet, row){
  sheet.getRange(row, 6).setFormula('=IF(AND(C'+row+'<>"",D'+row+'<>""),C'+row+'+D'+row+',"")');         // F Follow-up
  sheet.getRange(row, 7).setFormula('=IF(K'+row+'<>"",K'+row+'-1,IF(F'+row+'<>"",F'+row+'-1,""))');        // G Call
}

/* ---------- POST: login / book / update / delete / online ---------- */
function doPost(e){
  let p; try { p = JSON.parse(e.postData.contents); } catch(err){ return json({ ok:false, error:'bad request' }); }
  if(p.action === 'login') return json(login(p.user, p.pass));
  if(!authed(p.token)) return json({ ok:false, error:'unauthorized' });
  if(!allowed(p.token, p.action)) return json({ ok:false, error:'forbidden' });

  if(p.action === 'book'){
    const sheet = sheetOf(SHEET_NAME);
    if(slotTaken(sheet, p.apptDate ? fmt(p.apptDate) : '', p.slot, p.id)) return json({ ok:false, error:'slot_taken' });
    const id = p.id || ('a' + Utilities.getUuid().slice(0,10));
    writeAppt(sheet, 0, p, id);
    return json({ ok:true, id:id });
  }

  if(p.action === 'update'){
    const sheet = sheetOf(SHEET_NAME);
    if(slotTaken(sheet, p.apptDate ? fmt(p.apptDate) : '', p.slot, p.id)) return json({ ok:false, error:'slot_taken' });
    const row = rowById(sheet, p.id);
    if(!row) return json({ ok:false, error:'not_found' });
    writeAppt(sheet, row, p, p.id);
    return json({ ok:true, id:p.id });
  }

  if(p.action === 'delete'){
    const sheet = sheetOf(SHEET_NAME);
    const row = rowById(sheet, p.id);
    if(row) sheet.deleteRow(row);
    return json({ ok:true });
  }

  /* Doctor closes a visit: mark completed, store diagnosis/notes, and
     (optionally) auto-create the next follow-up appointment + online log. */
  if(p.action === 'complete'){
    const sheet = sheetOf(SHEET_NAME);
    const row = rowById(sheet, p.id);
    if(!row) return json({ ok:false, error:'not_found' });
    sheet.getRange(row, 8).setValue('Completed');                                   // H status
    if(p.diagnosis != null) sheet.getRange(row, 13).setValue(p.diagnosis);          // M diagnosis
    if(p.notes != null)     sheet.getRange(row, 9).setValue(p.notes);               // I notes
    const src = sheet.getRange(row, 1, 1, 13).getValues()[0];
    const out = { ok:true };
    // auto follow-up appointment
    if(p.followDate){
      if(slotTaken(sheet, fmt(p.followDate), p.followSlot, '')) return json({ ok:false, error:'slot_taken' });
      const nid = 'a' + Utilities.getUuid().slice(0,10);
      writeAppt(sheet, 0, {
        name: src[COL.name], phone: src[COL.phone], visit: new Date(),
        days: p.followDays || '', type: src[COL.type],
        apptDate: p.followDate, slot: p.followSlot || '', status: 'Scheduled'
      }, nid);
      out.followId = nid;
    }
    // auto online record for online consultations
    if(String(src[COL.type]).trim().toLowerCase() === 'online'){
      const os = sheetOf(ONLINE_SHEET);
      if(os.getLastRow() === 0) os.appendRow(['Name','Phone','Place','Consultation Date','Referred By','Notes']);
      os.appendRow([src[COL.name], src[COL.phone] || '', '', new Date(),
        p.refby || 'Online consult', p.diagnosis || '']);
    }
    return json(out);
  }

  if(p.action === 'online'){
    const sheet = sheetOf(ONLINE_SHEET);
    if(sheet.getLastRow() === 0) sheet.appendRow(['Name','Phone','Place','Consultation Date','Referred By','Notes']);
    sheet.appendRow([p.name, p.phone || '', p.place || '', p.date ? new Date(p.date) : '', p.refby || '', p.notes || '']);
    return json({ ok:true });
  }

  return json({ ok:false, error:'unknown action' });
}

/* Write an appointment. row=0 appends a new row; row>0 overwrites in place.
   Keeps the Follow-up/Call formulas and the extended columns consistent. */
function writeAppt(sheet, row, p, id){
  if(!row){
    sheet.appendRow([p.name, p.phone || '', p.visit ? new Date(p.visit) : '', p.days || '', p.type || '']);
    row = sheet.getLastRow();
  } else {
    sheet.getRange(row, 1, 1, 5).setValues([[p.name, p.phone || '', p.visit ? new Date(p.visit) : '', p.days || '', p.type || '']]);
  }
  setFormulas(sheet, row);
  sheet.getRange(row, 8).setValue(p.status || 'Scheduled');               // H status
  if(p.notes != null)     sheet.getRange(row, 9).setValue(p.notes);       // I notes
  sheet.getRange(row, 10).setValue(id);                                   // J id
  sheet.getRange(row, 11).setValue(p.apptDate ? new Date(p.apptDate) : ''); // K appt date
  sheet.getRange(row, 12).setValue(p.slot || '');                        // L slot
  if(p.diagnosis != null) sheet.getRange(row, 13).setValue(p.diagnosis); // M diagnosis
  return row;
}

/* ---------- GET: appointments or online records (token required) ---------- */
function doGet(e){
  const q = e.parameter || {};
  if(!authed(q.token)) return json({ ok:false, error:'unauthorized' });

  if(q.action === 'online'){
    const sheet = sheetOf(ONLINE_SHEET);
    const data = sheet.getDataRange().getValues();
    const out = [];
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[COLO.name]) continue;
      out.push({ name:r[COLO.name], phone:r[COLO.phone], place:r[COLO.place],
        date:r[COLO.date] ? fmt(r[COLO.date]) : '', refby:r[COLO.refby], notes:r[COLO.notes] });
    }
    return json(out);
  }

  // appointments (default / action=all). Assigns an ID to any row missing one.
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
      notes: String(r[COL.notes] || ''), diagnosis: String(r[COL.diagnosis] || '')
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
    if(!r[COL.name] || String(r[COL.status]).trim().toLowerCase() === 'done') continue;
    const type = (String(r[COL.type]).trim().toLowerCase() === 'online') ? 'Online' : 'In-clinic';
    const slot = r[COL.slot] ? (' ' + r[COL.slot]) : '';
    const who = { name:r[COL.name], phone:r[COL.phone], type:type, slot:slot };
    if(r[COL.call] && fmt(r[COL.call]) === today) callToday.push(who);
    if(r[COL.appt] && fmt(r[COL.appt]) === today) dueToday.push(who);
  }
  if(!callToday.length && !dueToday.length) return;
  const m = buildMessage(callToday, dueToday);
  if(CFG.email.on)    MailApp.sendEmail(CFG.email.to, m.subject, m.text);
  if(CFG.whatsapp.on) UrlFetchApp.fetch('https://api.callmebot.com/whatsapp.php?phone='+CFG.whatsapp.phone+'&text='+encodeURIComponent(m.text)+'&apikey='+CFG.whatsapp.apiKey,{muteHttpExceptions:true});
  if(CFG.telegram.on) UrlFetchApp.fetch('https://api.telegram.org/bot'+CFG.telegram.token+'/sendMessage',{method:'post',muteHttpExceptions:true,payload:{chat_id:CFG.telegram.chatId,text:m.text}});
}
function buildMessage(callToday, dueToday){
  let t = '';
  if(dueToday.length){
    const on = dueToday.filter(p=>p.type==='Online'), off = dueToday.filter(p=>p.type==='In-clinic');
    t += '\uD83D\uDD34 APPOINTMENTS TODAY (' + dueToday.length + ')\n';
    if(on.length){ t += '\nOnline (' + on.length + ') — send the link:\n'; on.forEach((p,i)=>t+='  '+(i+1)+'. '+p.name+p.slot+'  '+p.phone+'\n'); }
    if(off.length){ t += '\nIn-clinic (' + off.length + '):\n'; off.forEach((p,i)=>t+='  '+(i+1)+'. '+p.name+p.slot+'  '+p.phone+'\n'); }
    t += '\n';
  }
  if(callToday.length){
    t += '\uD83D\uDCDE CALL TODAY to confirm tomorrow (' + callToday.length + '):\n';
    callToday.forEach((p,i)=>t+='  '+(i+1)+'. '+p.name+'  '+p.phone+'  ['+p.type+']\n');
  }
  t += '\n\u2014 ' + CFG.clinic;
  return { subject:'\uD83D\uDD14 '+CFG.clinic+': '+dueToday.length+' today, '+callToday.length+' to call', text:t };
}
