/**
 * Light / Dark theme (Phase 2).
 *
 * The chosen theme is stored per-device in localStorage and applied by
 * stamping data-theme="light|dark" on <html>; all colour work lives in
 * css/app.css (a [data-theme="dark"] override block) so no markup changes
 * and no UI redesign are involved. Default is "system" — follow the
 * device's OS preference and react live when it changes. This is a purely
 * client-side, per-browser preference: it is deliberately NOT part of the
 * shared clinic Settings blob, so the doctor's phone and reception's
 * desktop can each keep their own preference.
 */
const KEY = 'enzo_theme_v1';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getTheme(){
  const t = localStorage.getItem(KEY);
  return (t === 'light' || t === 'dark') ? t : 'system';
}

function resolved(t){
  return t === 'dark' || (t === 'system' && media().matches) ? 'dark' : 'light';
}

function apply(t){
  const mode = resolved(t);
  document.documentElement.setAttribute('data-theme', mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', mode === 'dark' ? '#141b24' : '#557B97');
}

/** Two places can change the theme — the header quick-toggle and the
 *  Settings page's Light/Dark/System control. Without this event, changing
 *  it in one place left the other showing a stale selection (e.g. flip to
 *  dark with the header button while Settings is open — its radio still
 *  showed "Light" until the page was re-entered). */
export function setTheme(t){
  if(t === 'system'){ try{ localStorage.removeItem(KEY); }catch(e){} }
  else{ try{ localStorage.setItem(KEY, t); }catch(e){} }
  apply(t);
  window.dispatchEvent(new CustomEvent('enzo:themechange', { detail: { theme: t } }));
}

/** Apply the saved theme as early as possible and keep "system" mode live. */
export function initTheme(){
  apply(getTheme());
  const m = media();
  const onChange = () => { if(getTheme() === 'system') apply('system'); };
  if(m.addEventListener) m.addEventListener('change', onChange);
  else if(m.addListener) m.addListener(onChange); // older Safari
}
