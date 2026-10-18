/**
 * ENZO Gut Health Score — UI controller.
 *
 * Privacy model: answers live only in this module's in-memory `state`.
 * Nothing is written to localStorage/sessionStorage/IndexedDB, put in the
 * page URL, logged, or sent over the network. The only way a result leaves
 * the device is the visitor tapping a WhatsApp button and pressing Send in
 * WhatsApp. A refresh or "Start again" clears everything (a beforeunload
 * prompt warns mid-assessment).
 */
import { ASSESSMENT, SITE, LANGS, WARNING_SIGNS, NONE_ID } from './config.js';
import { TEXT } from './i18n.js';
import { isComplete, scoreAssessment, buildExplanation, toggleWarning, evaluateWarnings } from './scoring.js';
import { buildMessage, waLink } from './message.js';
import { illustration, icon } from './art.js';

const Q = ASSESSMENT.questions;
const N = Q.length;

const state = {
  screen: 'lang',           // lang | intro | question | warnings | results
  index: 0,                 // current question index while screen === 'question'
  lang: 'en',
  answers: new Array(N).fill(null),
  warnings: []
};
const T = () => TEXT[state.lang];

const $screen = document.getElementById('gsScreen');
const $back = document.getElementById('gsBack');
const $live = document.getElementById('gsLive');
const $langBar = document.getElementById('gsLang');

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- navigation (history entries carry only the step, never answers) ---------- */
function go(screen, index = 0, { push = true } = {}){
  state.screen = screen;
  state.index = index;
  if(push) history.pushState({ gs: screen, i: index }, '', location.pathname);
  render();
}

function canShow(screen, index){
  if(screen === 'lang' || screen === 'intro') return true;
  if(screen === 'question') return index >= 0 && index < N && state.answers.slice(0, index).every(v => v !== null);
  if(screen === 'warnings') return isComplete(state.answers);
  if(screen === 'results') return isComplete(state.answers) && evaluateWarnings(state.warnings).status !== 'unanswered';
  return false;
}

window.addEventListener('popstate', e => {
  const s = e.state && e.state.gs ? e.state : { gs: 'lang', i: 0 };
  if(canShow(s.gs, s.i)){ state.screen = s.gs; state.index = s.i; }
  else{ state.screen = 'intro'; state.index = 0; history.replaceState({ gs: 'intro', i: 0 }, '', location.pathname); }
  render();
});

window.addEventListener('beforeunload', e => {
  const inProgress = (state.screen === 'question' || state.screen === 'warnings') && state.answers.some(v => v !== null);
  if(inProgress){ e.preventDefault(); e.returnValue = ''; }
});

// Every forward step pushes one history entry, so the previous entry is
// always the previous step: in-app Back and the browser/Android back button
// behave identically (popstate above does the rendering).
function goBack(){
  if(state.screen !== 'lang') history.back();
}
$back.addEventListener('click', goBack);

function reset(){
  state.answers = new Array(N).fill(null);
  state.warnings = [];
  go('intro');
}

/* ---------- language ---------- */
function setLang(id){
  if(!TEXT[id]) return;
  state.lang = id;
  const def = LANGS.find(l => l.id === id);
  document.documentElement.lang = def.htmlLang;
  document.title = `${T().product} · ${SITE.clinicName}`;
}
function renderLangBar(){
  $langBar.hidden = state.screen === 'lang';
  $langBar.setAttribute('aria-label', T().langSwitch);
  $langBar.innerHTML = LANGS.map(l => `
    <button type="button" lang="${l.htmlLang}" data-lang="${l.id}" aria-pressed="${l.id === state.lang}">${esc(l.label)}</button>`).join('');
}
$langBar.addEventListener('click', e => {
  const b = e.target.closest('[data-lang]');
  if(!b || b.dataset.lang === state.lang) return;
  setLang(b.dataset.lang);
  render();                                   // same step, answers kept
});

/* ---------- rendering ---------- */
function render(){
  $back.hidden = state.screen === 'lang';
  $back.querySelector('span').textContent = T().back;
  document.getElementById('gsSkip').textContent = T().skip;
  renderLangBar();
  renderFooter();
  const views = { lang: viewLang, intro: viewIntro, question: viewQuestion, warnings: viewWarnings, results: viewResults };
  $screen.innerHTML = views[state.screen]();
  const binders = { lang: bindLang, intro: bindIntro, question: bindQuestion, warnings: bindWarnings, results: bindResults };
  binders[state.screen]();
  revealPhotos($screen);
  window.scrollTo(0, 0);
  const focusEl = $screen.querySelector('[data-focus]');
  if(focusEl) focusEl.focus({ preventScroll: true });
}

function announce(msg){
  $live.textContent = '';
  setTimeout(() => { $live.textContent = msg; }, 50);
}

/** Optional photos ship as 1×1 placeholders; show one only once a real
 *  photo (at least 100px wide) has been uploaded in its place. */
function revealPhotos(root){
  root.querySelectorAll('img[data-photo]').forEach(img => {
    const show = () => {
      if(img.naturalWidth < 100) return;
      const wrap = img.closest('[data-photo-wrap]');
      if(wrap) wrap.hidden = false;
      const host = img.closest('[data-photo-host]');
      if(host) host.classList.add('has-photo');
    };
    if(img.complete) show(); else img.addEventListener('load', show, { once: true });
  });
}

function progress(step, label){
  const pct = Math.round(step / (N + 1) * 100);
  return `
    <div class="gs-progress">
      <div class="gs-progress-text"><span>${esc(label)}</span><span>${pct}%</span></div>
      <div class="gs-progress-track" role="progressbar" aria-label="${esc(T().progress)}"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${esc(label)}">
        <span style="width:${pct}%"></span>
      </div>
    </div>`;
}

function disclaimerBlock(){
  return `
    <section class="gs-disclaimer" aria-labelledby="gsDiscH">
      <h2 id="gsDiscH" class="gs-h3">${esc(T().disclaimerH)}</h2>
      <p>${esc(T().disclaimer)}</p>
    </section>`;
}

/* ----- language choice ----- */
function viewLang(){
  return `
    <section class="gs-langpick" aria-labelledby="gsLangH">
      <div class="gs-langpick-art" aria-hidden="true">${illustration()}</div>
      <p class="gs-eyebrow">ENZO Gut Health Score™</p>
      <h1 id="gsLangH" class="gs-h2" tabindex="-1" data-focus>
        <span lang="en">Choose your language</span>
        <span lang="ml" class="gs-langpick-ml">ഭാഷ തിരഞ്ഞെടുക്കുക</span>
      </h1>
      <div class="gs-langpick-btns">
        <button type="button" class="gs-langbtn" id="gsLangEn" data-pick="en" lang="en">
          <span class="gs-langbtn-name">English</span><span class="gs-langbtn-sub">Continue in English</span>${icon('arrow')}
        </button>
        <button type="button" class="gs-langbtn" id="gsLangMl" data-pick="ml" lang="ml">
          <span class="gs-langbtn-name">മലയാളം</span><span class="gs-langbtn-sub">മലയാളത്തിൽ തുടരുക</span>${icon('arrow')}
        </button>
      </div>
    </section>`;
}
function bindLang(){
  $screen.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
    setLang(b.dataset.pick);
    go('intro');
  }));
}

/* ----- intro ----- */
function viewIntro(){
  const t = T();
  const icons = ['list', 'clock', 'calendar', 'info'];
  return `
    <section class="gs-hero" aria-labelledby="gsIntroH">
      <div class="gs-hero-copy">
        <p class="gs-eyebrow">${esc(t.product)}</p>
        <h1 id="gsIntroH" class="gs-h1" tabindex="-1" data-focus>${esc(t.introH)}</h1>
        <p class="gs-lead">${esc(t.introLead)}</p>
        <ul class="gs-facts">
          ${t.facts.map((f, i) => `<li>${icon(icons[i])}<span>${esc(f)}</span></li>`).join('')}
        </ul>
        <button type="button" class="gs-btn gs-btn-primary gs-btn-lg" id="gsStart">${esc(t.start)} ${icon('arrow')}</button>
        <p class="gs-small">${esc(t.introNote1)}</p>
        <p class="gs-small">${esc(t.introNote2)}</p>
      </div>
      <div class="gs-hero-art" data-photo-host aria-hidden="true">
        <div class="gs-hero-photo" data-photo-wrap hidden><img data-photo src="${esc(SITE.photos.hero)}" alt="" width="1000" height="1000" decoding="async" /></div>
        ${illustration()}
      </div>
    </section>
    ${disclaimerBlock()}`;
}
function bindIntro(){
  document.getElementById('gsStart').addEventListener('click', () => go('question', 0));
}

/* ----- question ----- */
function viewQuestion(){
  const t = T(), i = state.index, q = Q[i], qt = t.questions[q.id], cur = state.answers[i];
  const label = t.qLabel(i + 1, N);
  const describedBy = ['gsErr'].concat(qt.help ? ['gsHelp'] : []).join(' ');
  return `
    <section class="gs-card gs-step" aria-label="${esc(label)}">
      ${progress(i + 1, label)}
      <form id="gsForm" novalidate>
        <fieldset class="gs-fieldset" aria-describedby="${describedBy}">
          <legend class="gs-legend">
            <span class="gs-eyebrow">${esc(label)} · ${esc(qt.title)}</span>
            <span class="gs-qtext" tabindex="-1" data-focus>${esc(qt.text)}</span>
          </legend>
          ${qt.help ? `<p class="gs-help" id="gsHelp">${esc(qt.help)}</p>` : ''}
          <div class="gs-options">
            ${t.options[q.optionSet].map((o, v) => `
              <label class="gs-option">
                <input type="radio" name="answer" value="${ASSESSMENT.points[v]}" ${cur === ASSESSMENT.points[v] ? 'checked' : ''} />
                <span class="gs-option-body">
                  <span class="gs-option-label">${esc(o.label)}</span>
                  ${o.detail ? `<span class="gs-option-detail">${esc(o.detail)}</span>` : ''}
                </span>
                <span class="gs-option-check" aria-hidden="true">${icon('check')}</span>
              </label>`).join('')}
          </div>
          <p class="gs-error" id="gsErr" role="alert"></p>
        </fieldset>
        <div class="gs-nav">
          <button type="button" class="gs-btn gs-btn-ghost" id="gsPrev">${icon('back')} ${esc(t.prev)}</button>
          <button type="submit" class="gs-btn gs-btn-primary" id="gsNext">${esc(t.next)} ${icon('arrow')}</button>
        </div>
      </form>
    </section>`;
}
function bindQuestion(){
  const form = document.getElementById('gsForm');
  const err = document.getElementById('gsErr');
  announce(T().qLabel(state.index + 1, N));
  form.addEventListener('change', e => {
    if(e.target.name !== 'answer') return;
    state.answers[state.index] = Number(e.target.value);
    err.textContent = '';
    form.querySelector('.gs-fieldset').removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if(state.answers[state.index] === null){
      err.textContent = T().errAnswer;
      form.querySelector('.gs-fieldset').setAttribute('aria-invalid', 'true');
      const first = form.querySelector('input[name="answer"]');
      if(first) first.focus();
      return;
    }
    if(state.index < N - 1) go('question', state.index + 1);
    else go('warnings');
  });
  document.getElementById('gsPrev').addEventListener('click', goBack);
}

/* ----- warning signs ----- */
function viewWarnings(){
  const t = T(), sel = state.warnings;
  const box = (id, extra = '') => `
    <label class="gs-check ${extra}">
      <input type="checkbox" name="warn" value="${id}" ${sel.includes(id) ? 'checked' : ''} />
      <span class="gs-check-box" aria-hidden="true">${icon('check')}</span>
      <span>${esc(t.warnings[id])}</span>
    </label>`;
  return `
    <section class="gs-card gs-step" aria-labelledby="gsWarnH">
      ${progress(N + 1, t.finalCheck)}
      <form id="gsForm" novalidate>
        <p class="gs-eyebrow">${esc(t.finalCheckEyebrow)}</p>
        <h1 id="gsWarnH" class="gs-h2" tabindex="-1" data-focus>${esc(t.warnH)}</h1>
        <fieldset class="gs-fieldset" aria-describedby="gsWarnHelp gsErr">
          <legend class="gs-legend"><span class="gs-qtext">${esc(t.warnQ)}</span></legend>
          <p class="gs-help" id="gsWarnHelp">${esc(t.warnHelp)}</p>
          <div class="gs-checks">
            ${WARNING_SIGNS.map(w => box(w.id)).join('')}
            ${box(NONE_ID, 'gs-check-none')}
          </div>
          <p class="gs-error" id="gsErr" role="alert"></p>
        </fieldset>
        <div id="gsWarnNow" aria-live="polite"></div>
        <div class="gs-nav">
          <button type="button" class="gs-btn gs-btn-ghost" id="gsPrev">${icon('back')} ${esc(t.prev)}</button>
          <button type="submit" class="gs-btn gs-btn-primary">${esc(t.showResult)} ${icon('arrow')}</button>
        </div>
      </form>
    </section>`;
}
function urgentNowNote(){
  if(evaluateWarnings(state.warnings).status !== 'urgent') return '';
  const t = T();
  return `<div class="gs-inline-alert">${icon('alert')}<p><strong>${esc(t.urgentNowLead)}</strong>
    ${esc(t.urgentNow(SITE.emergencyNumber))}</p></div>`;
}
function bindWarnings(){
  const form = document.getElementById('gsForm');
  const err = document.getElementById('gsErr');
  const now = document.getElementById('gsWarnNow');
  now.innerHTML = urgentNowNote();
  form.addEventListener('change', e => {
    if(e.target.name !== 'warn') return;
    state.warnings = toggleWarning(state.warnings, e.target.value, e.target.checked);
    form.querySelectorAll('input[name="warn"]').forEach(b => { b.checked = state.warnings.includes(b.value); });
    err.textContent = '';
    form.querySelector('.gs-fieldset').removeAttribute('aria-invalid');
    now.innerHTML = urgentNowNote();
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if(evaluateWarnings(state.warnings).status === 'unanswered'){
      err.textContent = T().errWarn;
      form.querySelector('.gs-fieldset').setAttribute('aria-invalid', 'true');
      form.querySelector('input[name="warn"]').focus();
      return;
    }
    go('results');
  });
  document.getElementById('gsPrev').addEventListener('click', goBack);
}

/* ----- results ----- */
function safetyPanel(w){
  if(w.status === 'none') return '';
  const t = T();
  const list = `<ul class="gs-safety-list">${w.signs.map(s => `<li>${esc(t.warnings[s.id])}</li>`).join('')}</ul>`;
  const call = `<a class="gs-btn gs-btn-emergency" href="tel:${esc(SITE.emergencyNumber)}">${icon('phone')} ${esc(t.call(SITE.emergencyNumber))}</a>
    <span class="gs-small">${esc(t.emergencyLabel)}</span>`;
  if(w.status === 'urgent'){
    const others = w.signs.length > w.urgent.length ? `<p>${esc(t.urgentOthers)}</p>` : '';
    return `
      <section class="gs-safety gs-safety-urgent" aria-labelledby="gsSafeH" role="region">
        <div class="gs-safety-head">${icon('alert')}<h2 id="gsSafeH" class="gs-h2">${esc(t.urgentH)}</h2></div>
        <p>${esc(t.youReported)}</p>${list}
        <p><strong>${esc(t.urgentLead)}</strong> ${esc(t.urgentBody)}</p>
        ${others}
        <div class="gs-safety-actions">${call}</div>
        <p class="gs-small">${esc(t.urgentFoot)}</p>
      </section>`;
  }
  return `
    <section class="gs-safety gs-safety-prompt" aria-labelledby="gsSafeH" role="region">
      <div class="gs-safety-head">${icon('alert')}<h2 id="gsSafeH" class="gs-h2">${esc(t.promptH)}</h2></div>
      <p>${esc(t.youReported)}</p>${list}
      <p><strong>${esc(t.promptLead)}</strong> ${esc(t.promptBody)}</p>
      <div class="gs-safety-actions">${call}</div>
      <p class="gs-small">${esc(t.promptFoot)}</p>
    </section>`;
}

function whatsappCard(r){
  const t = T(), href = waLink(buildMessage(r, t, 'score'));
  if(!href) return '';
  return `
    <section class="gs-wa" aria-labelledby="gsWaH">
      <div class="gs-wa-photo" data-photo-wrap hidden><img data-photo src="${esc(SITE.photos.doctor)}" alt="" width="600" height="600" decoding="async" /></div>
      <div class="gs-wa-body">
        <p class="gs-eyebrow">${esc(t.waEyebrow)}</p>
        <h2 id="gsWaH" class="gs-h2">${esc(t.waH)}</h2>
        <p class="gs-wa-score"><strong>${r.total} / ${r.maxScore}</strong> · ${esc(t.bands[r.band.id].label)}</p>
        <p>${esc(t.waBody)}</p>
        <a class="gs-btn gs-btn-wa" id="gsWa" href="${esc(href)}" target="_blank" rel="noopener">${icon('whatsapp')} ${esc(t.waBtn)}</a>
        <p class="gs-small">${esc(t.waNote)}</p>
        ${r.warnings.status === 'urgent' ? `<p class="gs-wa-urgent">${icon('alert')} ${esc(t.waUrgent(SITE.emergencyNumber))}</p>` : ''}
      </div>
    </section>`;
}

function ctaBlock(r){
  const t = T();
  const href = SITE.bookingUrl || waLink(buildMessage(r, t, 'book'));
  const action = href
    ? `<a class="gs-btn gs-btn-primary" id="gsBook" href="${esc(href)}" target="_blank" rel="noopener">${esc(t.ctaBtn)} ${icon('arrow')}</a>`
    : `<p class="gs-cta-fallback">${esc(t.ctaFallback)}</p>`;
  return `
    <section class="gs-cta" aria-labelledby="gsCtaH">
      <div>
        <h2 id="gsCtaH" class="gs-h2">${esc(t.ctaH)}</h2>
        <p>${esc(t.ctaBody)}</p>
      </div>
      <div class="gs-cta-action">${action}</div>
    </section>`;
}

function viewResults(){
  const t = T();
  const r = scoreAssessment(state.answers, state.warnings);
  const lines = buildExplanation(state.answers, r, t);
  const hasWarn = r.warnings.status !== 'none';
  const pct = Math.round(r.total / r.maxScore * 100);
  const band = t.bands[r.band.id];
  return `
    <div class="gs-results">
      <h1 id="gsResH" class="gs-sr" tabindex="-1" data-focus>${esc(t.resultH)}</h1>
      ${safetyPanel(r.warnings)}
      ${whatsappCard(r)}

      <section class="gs-card gs-score-card" aria-labelledby="gsScoreH">
        <p class="gs-eyebrow">${esc(t.product)}</p>
        <h2 id="gsScoreH" class="gs-h2">${esc(t.resultH)}</h2>
        <div class="gs-score-row">
          <div class="gs-ring" style="--p:${pct}" aria-hidden="true"></div>
          <p class="gs-score" aria-label="${esc(t.totalAria(r.total, r.maxScore))}">
            <span class="gs-score-num">${r.total}</span><span class="gs-score-max">/ ${r.maxScore}</span>
          </p>
          <div class="gs-band band-${r.band.id}">
            <p class="gs-band-range">${esc(t.scoreRange(r.band.min, r.band.max))}</p>
            <h3 class="gs-h3">${esc(band.label)}</h3>
            <p>${esc(band.interpretation)}</p>
          </div>
        </div>
        <p class="gs-note">${esc(t.bandNote)}</p>
      </section>

      <section class="gs-card" aria-labelledby="gsSubH">
        <h2 id="gsSubH" class="gs-h3">${esc(t.profileH)}</h2>
        <ul class="gs-subs">
          ${r.subscores.map(s => `
            <li class="gs-sub sub-${s.id}">
              <div class="gs-sub-top">
                <span class="gs-sub-label">${esc(t.subscores[s.id])}</span>
                <span class="gs-sub-val"><span aria-hidden="true">${s.score} / ${s.max}</span><span class="gs-sr">${esc(t.outOf(s.score, s.max))}</span></span>
              </div>
              <div class="gs-bar" aria-hidden="true"><span style="width:${Math.round(s.score / s.max * 100)}%"></span></div>
            </li>`).join('')}
        </ul>
        <p class="gs-note">${esc(t.rawNote)}</p>
      </section>

      <section class="gs-card" aria-labelledby="gsTopH">
        <h2 id="gsTopH" class="gs-h3">${esc(t.topH)}</h2>
        ${r.highest.length
          ? `${r.highest.length > 1 ? `<p class="gs-small">${esc(t.tieNote(r.highest.length))}</p>` : ''}
             <ul class="gs-chips">${r.highest.map(c => `<li class="gs-chip sub-${c.id}">${esc(t.subscores[c.id])} · ${c.score} / ${c.max}</li>`).join('')}</ul>`
          : `<p>${esc(t.noElevated)}</p>`}
        <h3 class="gs-h4">${esc(t.reportedH)}</h3>
        ${lines.map(l => `<p>${esc(l)}</p>`).join('')}
      </section>

      ${hasWarn ? '' : `
      <section class="gs-card gs-warn-none" aria-labelledby="gsWarnResH">
        <h2 id="gsWarnResH" class="gs-h3">${esc(t.warnResH)}</h2>
        <p>${esc(t.noWarnings)} ${esc(t.noWarningsTail)}</p>
      </section>`}

      <section class="gs-card gs-next" aria-labelledby="gsNextH">
        <h2 id="gsNextH" class="gs-h3">${esc(t.nextH)}</h2>
        ${hasWarn ? `<p><strong>${esc(t.followSafety)}</strong></p>` : ''}
        <p>${esc(band.nextStep)}</p>
      </section>

      ${ctaBlock(r)}

      <section class="gs-card gs-privacy" aria-labelledby="gsPrivH">
        <h2 id="gsPrivH" class="gs-h3">${esc(t.privacyH)}</h2>
        <p>${esc(t.privacy1)}</p>
        <p class="gs-small">${esc(t.privacy2)}</p>
        <div class="gs-actions">
          <button type="button" class="gs-btn gs-btn-ghost" id="gsPrint">${icon('print')} ${esc(t.print)}</button>
          <button type="button" class="gs-btn gs-btn-ghost" id="gsRestart">${esc(t.restart)}</button>
        </div>
      </section>

      ${disclaimerBlock()}
      <p class="gs-print-meta">${esc(t.printed(r.version, new Date().toLocaleDateString()))}</p>
    </div>`;
}
function bindResults(){
  announce(T().resultH);
  document.getElementById('gsPrint').addEventListener('click', () => window.print());
  document.getElementById('gsRestart').addEventListener('click', reset);
}

/* ---------- footer ---------- */
function renderFooter(){
  const t = T();
  document.getElementById('gsClinicName').textContent = SITE.clinicName;
  document.getElementById('gsFooterNote').textContent = t.footerNote;
  const links = [];
  const wa = waLink(t.msg.hello);
  if(wa) links.push(`<a href="${esc(wa)}" target="_blank" rel="noopener">${esc(t.footerWa)}</a>`);
  if(SITE.bookingUrl) links.push(`<a href="${esc(SITE.bookingUrl)}" rel="noopener">${esc(t.footerBook)}</a>`);
  if(SITE.privacyUrl) links.push(`<a href="${esc(SITE.privacyUrl)}" rel="noopener">${esc(t.footerPrivacy)}</a>`);
  document.getElementById('gsFooterLinks').innerHTML = links.join('');
}

history.replaceState({ gs: 'lang', i: 0 }, '', location.pathname);
setLang('en');
render();
