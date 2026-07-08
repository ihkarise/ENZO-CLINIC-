/**
 * Small generic UI helpers shared across modules: toast (with optional
 * undo action), the generic confirm dialog, and overlay open/close with
 * focus return — all wired to markup that already exists in index.html.
 */
import { $ } from './core.js';

let toastTimer = null;
export function toast(message, opts){
  const t = $('toast');
  t.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = message;
  t.appendChild(span);
  if(opts && opts.actionLabel){
    const btn = document.createElement('button');
    btn.className = 'undo';
    btn.type = 'button';
    btn.textContent = opts.actionLabel;
    btn.addEventListener('click', () => { opts.onAction && opts.onAction(); hideToast(); });
    t.appendChild(btn);
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, opts && opts.duration ? opts.duration : 2600);
}
function hideToast(){ $('toast').classList.remove('show'); }

let confirmResolver = null;
export function confirmDialog(title, text, danger){
  $('confirmTitle').textContent = title;
  $('confirmText').textContent = text;
  $('confirmDelete').textContent = danger === false ? 'Confirm' : 'Delete';
  return new Promise(resolve => {
    confirmResolver = resolve;
    openOverlay('confirmOverlay', $('confirmDelete'));
  });
}
export function wireConfirmDialog(){
  $('confirmCancel').addEventListener('click', () => { closeOverlay('confirmOverlay'); resolveConfirm(false); });
  $('confirmOverlay').addEventListener('click', e => { if(e.target === $('confirmOverlay')){ closeOverlay('confirmOverlay'); resolveConfirm(false); } });
  $('confirmDelete').addEventListener('click', () => { closeOverlay('confirmOverlay'); resolveConfirm(true); });
}
function resolveConfirm(v){ if(confirmResolver){ confirmResolver(v); confirmResolver = null; } }

let lastFocusStack = [];
export function openOverlay(id, focusEl){
  lastFocusStack.push(document.activeElement);
  $(id).classList.add('open');
  setTimeout(() => { (focusEl || $(id).querySelector('button,input,textarea,select'))?.focus(); }, 60);
}
export function closeOverlay(id){
  $(id).classList.remove('open');
  const el = lastFocusStack.pop();
  if(el && el.focus) el.focus();
}

export function wireEscapeToClose(overlayIds){
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    overlayIds.forEach(id => { if($(id).classList.contains('open')) closeOverlay(id); });
  });
}
