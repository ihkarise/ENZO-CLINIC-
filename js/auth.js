/**
 * Login/logout and role-based UI gating.
 *
 * Role gating is declarative: any element marked `data-perm="X"` is shown
 * only when store.can('X') is true for the signed-in role. Administrator
 * always passes every check, and any username the backend hasn't been
 * given an explicit ROLE_<user> Script Property for also defaults to
 * Administrator (see EnzoBackend.gs) — so existing single-shared-login
 * clinics are never locked out by this feature.
 */
import { $ } from './core.js';
import { store, can } from './store.js';
import { login as apiLogin } from './api.js';

export function initAuth(onSignedIn){
  $('loginBtn').addEventListener('click', () => doLogin(onSignedIn));
  $('lpass').addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(onSignedIn); });
  $('logout').addEventListener('click', doLogout);
}

async function doLogin(onSignedIn){
  const u = $('luser').value.trim(), p = $('lpass').value;
  if(!u || !p){ $('loginErr').textContent = 'Enter username and password.'; return; }
  $('loginBtn').disabled = true; $('loginErr').textContent = '';
  try{
    const d = await apiLogin(u, p);
    if(d.ok){
      store.set({ token: d.token, user: d.user || u, role: d.role || 'Administrator' });
      applyRoleGating();
      onSignedIn();
    }else{
      $('loginErr').textContent = 'Wrong username or password.';
      $('loginBtn').disabled = false;
    }
  }catch(e){
    $('loginErr').textContent = 'Could not reach the server.';
    $('loginBtn').disabled = false;
  }
}

function doLogout(){
  store.set({ token: null, user: '', role: 'Receptionist' });
  $('app').classList.remove('shown');
  $('login').style.display = 'flex';
  $('loginBtn').disabled = false;
  $('lpass').value = '';
}

export function applyRoleGating(){
  const role = store.get('role');
  document.querySelectorAll('[data-perm]').forEach(el => {
    const perms = el.getAttribute('data-perm').split(',').map(s => s.trim());
    const allowed = perms.some(p => can(p));
    el.hidden = !allowed;
    el.toggleAttribute('disabled', !allowed);
  });
  const badge = $('roleBadge');
  if(badge) badge.textContent = role;
}
