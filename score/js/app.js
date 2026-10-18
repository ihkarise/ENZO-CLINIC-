/**
 * ENZO Gut Health Score — UI controller.
 *
 * Privacy model: answers live only in this module's in-memory `state`.
 * Nothing is written to localStorage/sessionStorage/IndexedDB, put in the
 * URL, logged, or sent over the network. A refresh or "Start again" clears
 * everything (a beforeunload prompt warns mid-assessment).
 */
import { ASSESSMENT, SITE, COPY, BAND_SAFETY_NOTE, WARNING_SIGNS, NONE_ID } from './config.js';
import { isComplete, scoreAssessment, buildExplanation, toggleWarning, evaluateWarnings } from './scoring.js';
import { illustration, icon } from './art.js';

const Q = ASSESSMENT.questions;
const N = Q.length;

const state = {
  screen: 'intro',          // intro | question | warnings | results
  index: 0,                 // current question index while screen === 'question'
  answers: new Array(N).fill(null),
  warnings: []
};

const $screen = document.getElementById('gsScreen');
const $back = document.getElementById('gsBack');
const $live = document.getElementById('gsLive');

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- navigation (history entries carry only the step, never answers) ---------- */
function go(screen, index = 0, { push = true } = {}){
  state.screen = screen;
  state.index = index;
  if(push) history.pushState({ gs: screen, i: index }, '', location.pathname);
  render();
}

function canShow(screen, index){
  if(screen === 'intro') return true;
  if(screen === 'question') return index >= 0 && index < N && state.answers.slice(0, index).every(v => v !== null);
  if(screen === 'warnings') return isComplete(state.answers);
  if(screen === 'results') return isComplete(state.answers) && evaluateWarnings(state.warnings).status !== 'unanswered';
  return false;
}

window.addEventListener('popstate', e => {
  const s = e.state && e.state.gs ? e.state : { gs: 'intro', i: 0 };
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
  if(state.screen !== 'intro') history.back();
}
$back.addEventListener('click', goBack);

function reset(){
  state.answers = new Array(N).fill(null);
  state.warnings = [];
  go('intro');
}

/* ---------- rendering ---------- */
function render(){
  $back.hidden = state.screen === 'intro';
  const views = { intro: viewIntro, question: viewQuestion, warnings: viewWarnings, results: viewResults };
  $screen.innerHTML = views[state.screen]();
  const binders = { intro: bindIntro, question: bindQuestion, warnings: bindWarnings, results: bindResults };
  binders[state.screen]();
  window.scrollTo(0, 0);
  const focusEl = $screen.querySelector('[data-focus]');
  if(focusEl) focusEl.focus({ preventScroll: true });
}

function announce(msg){
  $live.textContent = '';
  setTimeout(() => { $live.textContent = msg; }, 50);
}

function progress(step, label){
  const pct = Math.round(step / (N + 1) * 100);
  return `
    <div class="gs-progress">
      <div class="gs-progress-text"><span>${esc(label)}</span><span>${pct}%</span></div>
      <div class="gs-progress-track" role="progressbar" aria-label="Assessment progress"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${esc(label)}">
        <span style="width:${pct}%"></span>
      </div>
    </div>`;
}

function disclaimerBlock(){
  return `
    <section class="gs-disclaimer" aria-labelledby="gsDiscH">
      <h2 id="gsDiscH" class="gs-h3">Disclaimer</h2>
      <p>${esc(COPY.disclaimer)}</p>
    </section>`;
}

/* ----- intro ----- */
function viewIntro(){
  const facts = [
    ['list', '8 questions'], ['clock', 'About 2 minutes'],
    ['calendar', 'Symptoms over the past 14 days'], ['info', 'Educational assessment, not a diagnosis']
  ];
  return `
    <section class="gs-hero" aria-labelledby="gsIntroH">
      <div class="gs-hero-copy">
        <p class="gs-eyebrow">ENZO Gut Health Score™</p>
        <h1 id="gsIntroH" class="gs-h1" tabindex="-1" data-focus>How healthy is your&nbsp;gut?</h1>
        <p class="gs-lead">Discover your digestive symptom pattern in just 2 minutes.</p>
        <ul class="gs-facts">
          ${facts.map(([ic, t]) => `<li>${icon(ic)}<span>${esc(t)}</span></li>`).join('')}
        </ul>
        <button type="button" class="gs-btn gs-btn-primary gs-btn-lg" id="gsStart">
          Start Your Assessment ${icon('arrow')}
        </button>
        <p class="gs-small">Your answers help describe reported symptoms. The assessment cannot diagnose or rule out disease.</p>
        <p class="gs-small">Your answers stay on this device while you complete the assessment. Nothing is saved or sent to the clinic.</p>
      </div>
      <div class="gs-hero-art" aria-hidden="true">${illustration()}</div>
    </section>
    ${disclaimerBlock()}`;
}
function bindIntro(){
  document.getElementById('gsStart').addEventListener('click', () => go('question', 0));
}

/* ----- question ----- */
function viewQuestion(){
  const i = state.index, q = Q[i], cur = state.answers[i];
  const label = `Question ${i + 1} of ${N}`;
  const describedBy = ['gsErr'].concat(q.help ? ['gsHelp'] : []).join(' ');
  return `
    <section class="gs-card gs-step" aria-label="${esc(label)}">
      ${progress(i + 1, label)}
      <form id="gsForm" novalidate>
        <fieldset class="gs-fieldset" aria-describedby="${describedBy}">
          <legend class="gs-legend">
            <span class="gs-eyebrow">${esc(label)} · ${esc(q.title)}</span>
            <span class="gs-qtext" tabindex="-1" data-focus>${esc(q.text)}</span>
          </legend>
          ${q.help ? `<p class="gs-help" id="gsHelp">${esc(q.help)}</p>` : ''}
          <div class="gs-options">
            ${q.options.map(o => `
              <label class="gs-option">
                <input type="radio" name="answer" value="${o.value}" ${cur === o.value ? 'checked' : ''} />
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
          <button type="button" class="gs-btn gs-btn-ghost" id="gsPrev">${icon('back')} Previous</button>
          <button type="submit" class="gs-btn gs-btn-primary" id="gsNext">Continue ${icon('arrow')}</button>
        </div>
      </form>
    </section>`;
}
function bindQuestion(){
  const form = document.getElementById('gsForm');
  const err = document.getElementById('gsErr');
  announce(`Question ${state.index + 1} of ${N}`);
  form.addEventListener('change', e => {
    if(e.target.name !== 'answer') return;
    state.answers[state.index] = Number(e.target.value);
    err.textContent = '';
    form.querySelector('.gs-fieldset').removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if(state.answers[state.index] === null){
      err.textContent = 'Please choose one answer to continue.';
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
  const sel = state.warnings;
  const box = (id, label, extra = '') => `
    <label class="gs-check ${extra}">
      <input type="checkbox" name="warn" value="${id}" ${sel.includes(id) ? 'checked' : ''} />
      <span class="gs-check-box" aria-hidden="true">${icon('check')}</span>
      <span>${esc(label)}</span>
    </label>`;
  return `
    <section class="gs-card gs-step" aria-labelledby="gsWarnH">
      ${progress(N + 1, 'Final safety check')}
      <form id="gsForm" novalidate>
        <p class="gs-eyebrow">Final safety check · not part of your score</p>
        <h1 id="gsWarnH" class="gs-h2" tabindex="-1" data-focus>Before we show your result</h1>
        <fieldset class="gs-fieldset" aria-describedby="gsWarnHelp gsErr">
          <legend class="gs-legend"><span class="gs-qtext">Have you experienced any of the following?</span></legend>
          <p class="gs-help" id="gsWarnHelp">Select all that apply. These answers do not change your score.</p>
          <div class="gs-checks">
            ${WARNING_SIGNS.map(w => box(w.id, w.label)).join('')}
            ${box(NONE_ID, 'None of the above', 'gs-check-none')}
          </div>
          <p class="gs-error" id="gsErr" role="alert"></p>
        </fieldset>
        <div id="gsWarnNow" aria-live="polite"></div>
        <div class="gs-nav">
          <button type="button" class="gs-btn gs-btn-ghost" id="gsPrev">${icon('back')} Previous</button>
          <button type="submit" class="gs-btn gs-btn-primary">Show my result ${icon('arrow')}</button>
        </div>
      </form>
    </section>`;
}
function urgentNowNote(){
  const w = evaluateWarnings(state.warnings);
  if(w.status !== 'urgent') return '';
  return `<div class="gs-inline-alert">${icon('alert')}<p><strong>If this is happening now or is severe, do not wait.</strong>
    Call ${esc(SITE.emergencyNumber)} or go to the nearest emergency department.</p></div>`;
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
      err.textContent = 'Please select any that apply, or “None of the above”.';
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
  const list = `<ul class="gs-safety-list">${w.signs.map(s => `<li>${esc(s.label)}</li>`).join('')}</ul>`;
  const call = `<a class="gs-btn gs-btn-emergency" href="tel:${esc(SITE.emergencyNumber)}">${icon('phone')} Call ${esc(SITE.emergencyNumber)}</a>
    <span class="gs-small">${esc(SITE.emergencyLabel)}</span>`;
  if(w.status === 'urgent'){
    const others = w.signs.length > w.urgent.length
      ? '<p>The other signs you selected also need prompt assessment by a doctor.</p>' : '';
    return `
      <section class="gs-safety gs-safety-urgent" aria-labelledby="gsSafeH" role="region">
        <div class="gs-safety-head">${icon('alert')}<h2 id="gsSafeH" class="gs-h2">Seek emergency medical assessment</h2></div>
        <p>You reported:</p>${list}
        <p><strong>Some of these signs need urgent medical attention.</strong> If you have them now, or your symptoms are severe or getting worse,
          go to the nearest emergency department or call emergency services immediately. Do not wait for an online form, this result or a clinic reply.</p>
        ${others}
        <div class="gs-safety-actions">${call}</div>
        <p class="gs-small">This tool cannot tell whether a warning sign is serious or harmless. Your symptom score below does not change this advice.</p>
      </section>`;
  }
  return `
    <section class="gs-safety gs-safety-prompt" aria-labelledby="gsSafeH" role="region">
      <div class="gs-safety-head">${icon('alert')}<h2 id="gsSafeH" class="gs-h2">Please arrange a medical evaluation soon</h2></div>
      <p>You reported:</p>${list}
      <p><strong>These signs should be assessed by a doctor in a timely way</strong>, whatever your symptom score.
        If they are sudden, severe or getting worse, seek emergency care.</p>
      <div class="gs-safety-actions">${call}</div>
      <p class="gs-small">This tool cannot tell whether a warning sign is serious or harmless.</p>
    </section>`;
}

function ctaBlock(){
  const action = SITE.bookingUrl
    ? `<a class="gs-btn gs-btn-primary" href="${esc(SITE.bookingUrl)}" rel="noopener">${esc(COPY.ctaButton)} ${icon('arrow')}</a>`
    : `<p class="gs-cta-fallback">To book a consultation, please contact ${esc(SITE.clinicName)} directly.</p>`;
  return `
    <section class="gs-cta${SITE.bookingUrl ? ' gs-cta-split' : ''}" aria-labelledby="gsCtaH">
      <div>
        <h2 id="gsCtaH" class="gs-h2">${esc(COPY.ctaHeading)}</h2>
        <p>${esc(COPY.ctaBody)}</p>
      </div>
      <div class="gs-cta-action">${action}</div>
    </section>`;
}

function viewResults(){
  const r = scoreAssessment(state.answers, state.warnings);
  const lines = buildExplanation(state.answers, r);
  const hasWarn = r.warnings.status !== 'none';
  const pct = Math.round(r.total / r.maxScore * 100);
  return `
    <div class="gs-results">
      ${safetyPanel(r.warnings)}

      <section class="gs-card gs-score-card" aria-labelledby="gsResH">
        <p class="gs-eyebrow">ENZO Gut Health Score™</p>
        <h1 id="gsResH" class="gs-h2" tabindex="-1" data-focus>Your result</h1>
        <div class="gs-score-row">
          <div class="gs-ring" style="--p:${pct}" aria-hidden="true"></div>
          <p class="gs-score" aria-label="Total score ${r.total} out of ${r.maxScore}">
            <span class="gs-score-num">${r.total}</span><span class="gs-score-max">/ ${r.maxScore}</span>
          </p>
          <div class="gs-band band-${r.band.id}">
            <p class="gs-band-range">Score ${r.band.min}–${r.band.max}</p>
            <h2 class="gs-h3">${esc(r.band.label)}</h2>
            <p>${esc(r.band.interpretation)}</p>
          </div>
        </div>
        <p class="gs-note">${esc(BAND_SAFETY_NOTE)} Score bands are proposed educational categories and have not been clinically validated.</p>
      </section>

      <section class="gs-card" aria-labelledby="gsSubH">
        <h2 id="gsSubH" class="gs-h3">Your symptom profile</h2>
        <ul class="gs-subs">
          ${r.subscores.map(s => `
            <li class="gs-sub sub-${s.id}">
              <div class="gs-sub-top">
                <span class="gs-sub-label">${esc(s.label)}</span>
                <span class="gs-sub-val"><span aria-hidden="true">${s.score} / ${s.max}</span><span class="gs-sr">${s.score} out of ${s.max}</span></span>
              </div>
              <div class="gs-bar" aria-hidden="true"><span style="width:${Math.round(s.score / s.max * 100)}%"></span></div>
            </li>`).join('')}
        </ul>
        <p class="gs-note">${esc(COPY.rawScoreNote)}</p>
      </section>

      <section class="gs-card" aria-labelledby="gsTopH">
        <h2 id="gsTopH" class="gs-h3">Your highest-scoring symptom areas</h2>
        ${r.highest.length
          ? `${r.highest.length > 1 ? `<p class="gs-small">${r.highest.length} areas share the highest raw score.</p>` : ''}
             <ul class="gs-chips">${r.highest.map(c => `<li class="gs-chip sub-${c.id}">${esc(c.label)} · ${c.score} / ${c.max}</li>`).join('')}</ul>`
          : `<p>${esc(COPY.noElevated)}</p>`}
        <h3 class="gs-h4">What you reported</h3>
        ${lines.map(l => `<p>${esc(l)}</p>`).join('')}
      </section>

      ${hasWarn ? '' : `
      <section class="gs-card gs-warn-none" aria-labelledby="gsWarnResH">
        <h2 id="gsWarnResH" class="gs-h3">Warning-sign check</h2>
        <p>${esc(COPY.noWarnings)} If you develop any warning signs, or symptoms become severe, seek medical care promptly.</p>
      </section>`}

      <section class="gs-card gs-next" aria-labelledby="gsNextH">
        <h2 id="gsNextH" class="gs-h3">Suggested next step</h2>
        ${hasWarn ? '<p><strong>First, follow the safety guidance at the top of this page.</strong></p>' : ''}
        <p>${esc(r.band.nextStep)}</p>
      </section>

      ${ctaBlock()}

      <section class="gs-card gs-privacy" aria-labelledby="gsPrivH">
        <h2 id="gsPrivH" class="gs-h3">Your answers</h2>
        <p>Your result has not been saved or sent to the clinic. It exists only in this browser tab and is cleared when you close the tab or start again.</p>
        <p class="gs-small">Saving or sharing results with the clinic online is not available yet. You can print this page and bring it to your consultation.</p>
        <div class="gs-actions">
          <button type="button" class="gs-btn gs-btn-ghost" id="gsPrint">${icon('print')} Print result</button>
          <button type="button" class="gs-btn gs-btn-ghost" id="gsRestart">Start again</button>
        </div>
      </section>

      ${disclaimerBlock()}
      <p class="gs-print-meta">ENZO Gut Health Score™ v${esc(r.version)} · printed ${esc(new Date().toLocaleDateString())}</p>
    </div>`;
}
function bindResults(){
  announce('Your result is ready.');
  document.getElementById('gsPrint').addEventListener('click', () => window.print());
  document.getElementById('gsRestart').addEventListener('click', reset);
}

/* ---------- footer ---------- */
function renderFooter(){
  document.getElementById('gsClinicName').textContent = SITE.clinicName;
  const links = [];
  if(SITE.bookingUrl) links.push(`<a href="${esc(SITE.bookingUrl)}" rel="noopener">Book a consultation</a>`);
  if(SITE.privacyUrl) links.push(`<a href="${esc(SITE.privacyUrl)}" rel="noopener">Privacy</a>`);
  document.getElementById('gsFooterLinks').innerHTML = links.join('');
}

history.replaceState({ gs: 'intro', i: 0 }, '', location.pathname);
renderFooter();
render();
