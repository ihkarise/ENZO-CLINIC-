/**
 * Dashboard: KPIs, trend chart, weekday performance chart and the
 * referred-by breakdown with CSV export. Ported unchanged in behaviour and
 * visuals from the original build; only escaping and the loading state
 * were added.
 */
import { $, escapeHtml } from './core.js';
import { store } from './store.js';
import { indexApptsByPatient, indexOnlineByPatient, patientMatches, statusBadgeHtml } from './patients.js';

const CC = { navy:'#557B97', teal:'#5BC5C3', steel:'#8aa6bb', coral:'#E26D5C', green:'#2E9E6B', grid:'#eef1f4', muted:'#9aa7b3' };
const WD = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const inR = (d,a,b) => d >= a && d <= b;

let trendChart, weekdayChart;
let refRecs = [], refArr = [], refPeriod = '', selSrc = null;

function mondayOf(d){ const x = new Date(d); x.setDate(x.getDate() - ((x.getDay()+6)%7)); x.setHours(0,0,0,0); return x; }

function bounds(r){
  const now = new Date(); let s,e,ps,pe,l;
  if(r === 'week'){ s = mondayOf(now); e = new Date(s); e.setDate(e.getDate()+6); e.setHours(23,59,59,999);
    ps = new Date(s); ps.setDate(ps.getDate()-7); pe = new Date(s); pe.setMilliseconds(-1);
    l = 'Week of ' + s.getDate() + ' ' + MON[s.getMonth()];
  }else if(r === 'year'){ s = new Date(now.getFullYear(),0,1); e = new Date(now.getFullYear(),11,31,23,59,59,999);
    ps = new Date(now.getFullYear()-1,0,1); pe = new Date(now.getFullYear()-1,11,31,23,59,59,999); l = String(now.getFullYear());
  }else{ s = new Date(now.getFullYear(),now.getMonth(),1); e = new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999);
    ps = new Date(now.getFullYear(),now.getMonth()-1,1); pe = new Date(now.getFullYear(),now.getMonth(),0,23,59,59,999);
    l = MON[now.getMonth()] + ' ' + now.getFullYear();
  }
  return { s,e,ps,pe,l };
}

function buckets(r, b, appts){
  let labels, idx, on, off, fo;
  if(r === 'week'){ labels = WD.slice(); idx = d => (d.getDay()+6)%7; on = Array(7).fill(0); off = Array(7).fill(0); fo = Array(7).fill(0); }
  else if(r === 'year'){ labels = MON.slice(); idx = d => d.getMonth(); on = Array(12).fill(0); off = Array(12).fill(0); fo = Array(12).fill(0); }
  else{ const w = Math.ceil(b.e.getDate()/7); labels = []; for(let i=0;i<w;i++) labels.push('W'+(i+1));
    idx = d => Math.min(w-1, Math.floor((d.getDate()-1)/7)); on = Array(w).fill(0); off = Array(w).fill(0); fo = Array(w).fill(0);
  }
  appts.forEach(x => {
    if(x.visit && inR(x.visit, b.s, b.e)){ const k = idx(x.visit); if(x.type === 'Online') on[k]++; else off[k]++; }
    if(x.apptDate && inR(x.apptDate, b.s, b.e)) fo[idx(x.apptDate)]++;
  });
  return { labels, on, off, fo };
}

function wperf(b, appts){
  const c = Array(7).fill(0);
  appts.forEach(x => { if(x.visit && inR(x.visit, b.s, b.e)) c[(x.visit.getDay()+6)%7]++; });
  return c;
}

function cnt(s, e, appts){
  let t=0,o=0,f=0,fu=0;
  appts.forEach(x => {
    if(x.visit && inR(x.visit, s, e)){ t++; if(x.type === 'Online') o++; else f++; }
    if(x.apptDate && inR(x.apptDate, s, e)) fu++;
  });
  return { t,o,f,fu };
}

function setNum(el, v){ el.innerHTML = String(v).split('').map(c => `<span class="t2-digit">${c}</span>`).join(''); }
function delta(c, p){
  if(p === 0) return { t: c > 0 ? 'new' : '—', c: 'flat' };
  const x = Math.round((c-p)/p*100);
  if(x > 0) return { t: '▲ ' + x + '% vs last', c: 'up' };
  if(x < 0) return { t: '▼ ' + Math.abs(x) + '% vs last', c: 'down' };
  return { t: 'no change', c: 'flat' };
}

function srcOf(r){ return (r.refby && String(r.refby).trim()) || 'Not specified'; }

function renderRef(b){
  selSrc = null; $('refDetail').hidden = true; $('refDetail').innerHTML = ''; refPeriod = b.l;
  refRecs = store.get('onlineRecords').filter(r => { const d = new Date(r.date); return d >= b.s && d <= b.e; });
  $('refTotal').textContent = refRecs.length;
  const map = {};
  refRecs.forEach(r => { const k = srcOf(r); map[k] = (map[k]||0)+1; });
  refArr = Object.keys(map).map(k => ({ k, n: map[k] })).sort((a,b2) => b2.n - a.n);
  const box = $('refList');
  if(!refArr.length){ box.innerHTML = '<div class="empty">No online records in this period.</div>'; return; }
  const max = refArr[0].n;
  box.innerHTML = refArr.map((o,i) => {
    const w = Math.round(o.n/max*100);
    return `<button type="button" class="refrow" data-src="${escapeHtml(o.k)}"><span class="rl" title="${escapeHtml(o.k)}">${escapeHtml(o.k)}${i===0?' <span class="tag">top</span>':''}</span><span class="rbar-wrap"><span class="rbar" data-w="${w}"></span></span><span class="rn">${o.n}</span></button>`;
  }).join('');
  requestAnimationFrame(() => box.querySelectorAll('.rbar').forEach(el => el.style.width = el.getAttribute('data-w') + '%'));
}

function renderRefDetail(){
  const box = $('refDetail');
  if(!selSrc){ box.hidden = true; box.innerHTML = ''; return; }
  const list = refRecs.filter(r => srcOf(r) === selSrc).sort((a,b) => new Date(b.date) - new Date(a.date));
  box.hidden = false;
  box.innerHTML = `<div class="dh"><span>Showing <b>${escapeHtml(selSrc)}</b> · ${list.length}</span><button class="clear" id="refClear">Show all</button></div>` +
    list.map(r => `<div class="refitem"><span>${escapeHtml(r.name)}${r.place ? ' <span class="rp">· ' + escapeHtml(r.place) + '</span>' : ''}</span><span class="rp">${new Date(r.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</span></div>`).join('');
  $('refClear').addEventListener('click', () => { selSrc = null; document.querySelectorAll('.refrow').forEach(x => x.classList.remove('sel')); renderRefDetail(); });
}

function downloadCSV(){
  if(!refArr.length){ toast_('Nothing to export for this period.'); return; }
  const rows = [['Referred By','Count']].concat(refArr.map(o => [o.k, o.n]));
  const csv = rows.map(r => r.map(c => { const s = String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; }).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'enzo-referred-by-' + String(refPeriod).replace(/[^a-z0-9]+/gi,'-').toLowerCase() + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  toast_('CSV downloaded');
}
let toast_ = () => {};
export function setToast(fn){ toast_ = fn; }

let onOpenTimeline = null; // set by app.js via setTimelineOpener()
export function setTimelineOpener(fn){ onOpenTimeline = fn; }

/** Quick patient lookup (Phase 3): the same global search used by Booking
 *  and the Timeline, surfaced here too since Administrators often want to
 *  jump straight from a KPI view to one patient's history. Picking a
 *  result opens the Timeline on that patient rather than duplicating the
 *  Timeline's own rendering here. */
function renderDashSearch(){
  const box = $('dashSearchResults');
  const q = ($('dashSearch').value || '').trim();
  if(!q){ box.hidden = true; box.innerHTML = ''; return; }
  const apptsByPatient = indexApptsByPatient();
  const onlineByPatient = indexOnlineByPatient();
  const matches = store.get('patients')
    .filter(p => patientMatches(p, q, apptsByPatient, onlineByPatient))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .slice(0, 6);
  box.hidden = false;
  box.innerHTML = matches.length
    ? matches.map(p => `<div class="appt" role="button" tabindex="0" data-dpatient="${escapeHtml(p.patientId)}" style="cursor:pointer">
        <div class="awho"><div class="nm">${escapeHtml(p.name || '(no name on file)')}</div><div class="sub">${statusBadgeHtml(p.patientId, apptsByPatient)}<span class="ph">${escapeHtml(p.opdNumber)} · ${escapeHtml(p.phone)}</span></div></div>
      </div>`).join('')
    : '<div class="empty">No matching patients.</div>';
}

export function renderDash(){
  const range = store.get('range');
  const appts = store.get('appts');
  const b = bounds(range);
  $('period').textContent = b.l;
  const cur = cnt(b.s, b.e, appts), prev = cnt(b.ps, b.pe, appts);
  setNum($('kTotal'), cur.t); setNum($('kOnline'), cur.o); setNum($('kOffline'), cur.f); setNum($('kFollow'), cur.fu);
  const d = delta(cur.t, prev.t); const dl = $('kDelta'); dl.textContent = d.t; dl.className = 'delta ' + d.c;
  const share = cur.t ? Math.round(cur.o/cur.t*100) : 0;
  $('kOnlineP').textContent = share + '% of visits'; $('kOfflineP').textContent = (100-share) + '% of visits';

  const tb = buckets(range, b, appts);
  $('trendSub').textContent = range === 'week' ? 'This week, by day' : range === 'year' ? 'This year, by month' : 'This month, by week';
  const wp = wperf(b, appts), mx = Math.max.apply(null, wp), mn = Math.min.apply(null, wp);
  const bi = wp.indexOf(mx), si = wp.indexOf(mn);
  $('bestDay').textContent = mx > 0 ? WD[bi] : '—'; $('bestNum').textContent = mx > 0 ? mx + ' appointments' : 'no data';
  $('slowDay').textContent = WD[si]; $('slowNum').textContent = mn + ' appointments';

  // Chart.js loads from a CDN — if that request failed (offline first load,
  // ad blocker, CDN outage) skip the charts instead of throwing and taking
  // the rest of the dashboard/app bootstrap down with it.
  if(typeof Chart === 'undefined'){
    document.querySelectorAll('.chartbox').forEach(el => { el.innerHTML = '<div class="empty">Charts unavailable offline.</div>'; });
  }else{
    if(trendChart) trendChart.destroy();
    trendChart = new Chart($('trend'), {
      data: { labels: tb.labels, datasets: [
        { type:'bar', label:'Online', data:tb.on, backgroundColor:CC.teal, borderRadius:5, stack:'a' },
        { type:'bar', label:'In-clinic', data:tb.off, backgroundColor:CC.steel, borderRadius:5, stack:'a' },
        { type:'line', label:'Appointments', data:tb.fo, borderColor:CC.coral, backgroundColor:CC.coral, borderWidth:3, tension:.35, pointRadius:3, pointBackgroundColor:CC.coral }
      ]},
      options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:{display:false}},
        scales: { x:{stacked:true, grid:{display:false}, ticks:{color:CC.muted, font:{size:11}}}, y:{stacked:true, beginAtZero:true, grid:{color:CC.grid}, ticks:{color:CC.muted, font:{size:11}, precision:0}} } }
    });
    const cols = wp.map(v => v === mx && mx > 0 ? CC.green : v === mn ? CC.muted : CC.navy);
    if(weekdayChart) weekdayChart.destroy();
    weekdayChart = new Chart($('weekday'), {
      type:'bar', data:{ labels: WD, datasets:[{ data: wp, backgroundColor: cols, borderRadius: 6 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
        scales: { x:{grid:{display:false}, ticks:{color:CC.muted, font:{size:11}}}, y:{beginAtZero:true, grid:{color:CC.grid}, ticks:{color:CC.muted, font:{size:11}, precision:0}} } }
    });
  }

  renderRef(b);
}

export function initDashboard(toastFn){
  toast_ = toastFn;
  // Debounced for the same reason as the Timeline search — avoids
  // rebuilding the patient indexes and re-scanning every patient on every
  // keystroke.
  let dashSearchTimer = null;
  $('dashSearch').addEventListener('input', () => {
    clearTimeout(dashSearchTimer);
    dashSearchTimer = setTimeout(renderDashSearch, 250);
  });
  $('dashSearchResults').addEventListener('click', e => {
    const b = e.target.closest('[data-dpatient]'); if(!b || !onOpenTimeline) return;
    onOpenTimeline(b.getAttribute('data-dpatient'));
  });
  $('dashSearchResults').addEventListener('keydown', e => {
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const b = e.target.closest('[data-dpatient]'); if(!b || !onOpenTimeline) return;
    e.preventDefault();
    onOpenTimeline(b.getAttribute('data-dpatient'));
  });
  $('dseg').addEventListener('click', e => {
    const b = e.target.closest('.dseg-btn'); if(!b) return;
    document.querySelectorAll('.dseg-btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    store.set({ range: b.dataset.r });
    renderDash();
  });
  $('refList').addEventListener('click', e => {
    const b = e.target.closest('.refrow'); if(!b) return;
    const src = b.getAttribute('data-src');
    selSrc = (selSrc === src) ? null : src;
    document.querySelectorAll('.refrow').forEach(x => x.classList.toggle('sel', x.getAttribute('data-src') === selSrc));
    renderRefDetail();
  });
  $('refCsv').addEventListener('click', downloadCSV);
}
