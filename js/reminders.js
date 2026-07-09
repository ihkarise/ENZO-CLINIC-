/**
 * Today's schedule bell + modal banner. Ported from the original build;
 * now only counts appointments still in the Scheduled stage (a completed
 * or cancelled appointment shouldn't nag reception at the door).
 */
import { $, DAY, same, to12h, escapeHtml } from './core.js';
import { store } from './store.js';
import { isScheduled } from './workflow.js';
import { openOverlay, closeOverlay } from './ui.js';

function todayItems(){
  const now = new Date();
  const appts = store.get('appts').filter(isScheduled);
  return {
    due: appts.filter(a => a.apptDate && same(a.apptDate, now)),
    call: appts.filter(a => a.apptDate && same(new Date(new Date(a.apptDate).getTime() - DAY), now))
  };
}

export function refreshToday(){
  const t = todayItems(), n = t.due.length + t.call.length, b = $('bellBadge');
  if(n > 0){ b.textContent = n; b.classList.add('show'); } else b.classList.remove('show');
  const bn = $('banner');
  if(n > 0){
    bn.style.display = 'flex';
    const bits = [];
    if(t.due.length) bits.push(`<b>${t.due.length}</b> appointment${t.due.length > 1 ? 's' : ''} today`);
    if(t.call.length) bits.push(`<b>${t.call.length}</b> to call`);
    $('bannerTxt').innerHTML = bits.join(' · ') + '. Tap the bell for details.';
  }else bn.style.display = 'none';
}

function buildModal(){
  const t = todayItems();
  const on = t.due.filter(p => p.type === 'Online'), off = t.due.filter(p => p.type === 'Offline');
  let h = '';
  if(on.length) h += '<div class="mgrp"><div class="gh">Online consults — send the link</div>' +
    on.map(p => `<div class="mitem on"><span class="d"></span>${escapeHtml(p.name)}<span class="ph">${to12h(p.slot)} ${escapeHtml(p.phone)}</span></div>`).join('') + '</div>';
  if(off.length) h += '<div class="mgrp"><div class="gh">In-clinic today</div>' +
    off.map(p => `<div class="mitem off"><span class="d"></span>${escapeHtml(p.name)}<span class="ph">${to12h(p.slot)} ${escapeHtml(p.phone)}</span></div>`).join('') + '</div>';
  if(t.call.length) h += '<div class="mgrp"><div class="gh">Call today to confirm tomorrow</div>' +
    t.call.map(p => `<div class="mitem call"><span class="d"></span>${escapeHtml(p.name)}<span class="ph">${escapeHtml(p.phone)}</span></div>`).join('') + '</div>';
  $('modalBody').innerHTML = h || '<p style="color:var(--light);font-size:.9rem;padding:6px 0">Nothing scheduled for today.</p>';
  const n = t.due.length + t.call.length;
  $('modalTitle').textContent = n > 0 ? `Today — ${n} to handle` : 'Today';
}

function openTodayModal(){ buildModal(); openOverlay('overlay', $('modalOk')); }
export function openTodayIfAny(){ const t = todayItems(); if(t.due.length + t.call.length > 0) openTodayModal(); }

export function initReminders(){
  $('bell').addEventListener('click', openTodayModal);
  $('modalOk').addEventListener('click', () => closeOverlay('overlay'));
  $('overlay').addEventListener('click', e => { if(e.target === $('overlay')) closeOverlay('overlay'); });
}
