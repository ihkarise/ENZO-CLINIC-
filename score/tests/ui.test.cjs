/**
 * Browser tests for the Gut Health Score UI (Playwright + node:test).
 * Run:  python3 -m http.server 8765   (from the repo root, in another shell)
 *       NODE_PATH="$(npm root -g)" node --test score/tests/ui.test.cjs
 * Optional: SHOTS=<dir> to save screenshots.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.env.SCORE_URL || 'http://127.0.0.1:8765/score/';
const SHOTS = process.env.SHOTS || '';
let browser;

before(async () => {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
after(async () => { await browser.close(); });

/** Fresh page that records console output, outbound requests and storage use. */
async function open(viewport = { width: 390, height: 844 }){
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.log = []; page.requests = []; page.errors = [];
  page.on('console', m => page.log.push(m.text()));
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('request', r => page.requests.push(r.url()));
  await page.goto(BASE);
  return page;
}
const shot = async (page, name) => { if(SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

async function answerAll(page, values){
  await page.click('#gsStart');
  for(const v of values){
    await page.check(`input[name="answer"][value="${v}"]`, { force: true });
    await page.click('#gsNext');
  }
}
async function finish(page, warnings = ['none']){
  for(const w of warnings) await page.check(`input[name="warn"][value="${w}"]`, { force: true });
  await page.click('button[type="submit"]');
  await page.waitForSelector('#gsResH');
}

test('intro shows headline, facts, CTA and full disclaimer', async () => {
  const page = await open();
  assert.equal(await page.textContent('h1'), 'How healthy is your gut?');
  assert.match(await page.textContent('.gs-facts'), /8 questions.*About 2 minutes.*past 14 days.*not a diagnosis/s);
  assert.match(await page.textContent('.gs-disclaimer'), /not a clinically validated diagnostic instrument/);
  assert.ok(await page.isVisible('#gsStart'));
  await shot(page, 'm-intro');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('one question per screen with progress, validation and preserved answers', async () => {
  const page = await open();
  await page.click('#gsStart');
  assert.equal(await page.locator('fieldset').count(), 1);
  assert.equal(await page.locator('input[name="answer"]').count(), 4);
  assert.match(await page.textContent('.gs-progress-text'), /Question 1 of 8/);
  assert.equal(await page.getAttribute('[role="progressbar"]', 'aria-valuetext'), 'Question 1 of 8');
  await shot(page, 'm-q1');

  await page.click('#gsNext');                                  // no answer → blocked
  assert.match(await page.textContent('#gsErr'), /Please choose one answer/);
  assert.equal(await page.getAttribute('fieldset', 'aria-invalid'), 'true');
  assert.match(await page.textContent('.gs-progress-text'), /Question 1 of 8/);
  await shot(page, 'm-q1-error');

  await page.check('input[value="2"]', { force: true });
  await page.click('#gsNext');
  assert.match(await page.textContent('.gs-progress-text'), /Question 2 of 8/);
  await page.check('input[value="3"]', { force: true });
  await page.click('#gsPrev');                                  // back to Q1
  assert.ok(await page.isChecked('input[value="2"]'));
  await page.click('#gsNext');
  assert.ok(await page.isChecked('input[value="3"]'), 'Q2 answer preserved');

  await page.click('#gsBack');                                  // header back
  assert.match(await page.textContent('.gs-progress-text'), /Question 1 of 8/);
  await page.goBack();                                          // browser back → intro
  await page.waitForSelector('#gsStart');
  await page.context().close();
});

test('Q5 shows its help text; all question wording comes from config', async () => {
  const page = await open();
  await answerAll(page, [0, 0, 0, 0]);
  assert.match(await page.textContent('.gs-legend'), /constipation, hard stools, loose stools/);
  assert.equal(await page.textContent('#gsHelp'), 'Select the frequency of the days on which any of these problems occurred.');
  await page.context().close();
});

test('keyboard-only completion', async () => {
  const page = await open();
  await page.focus('#gsStart');
  await page.keyboard.press('Enter');
  for(let i = 0; i < 8; i++){
    await page.waitForSelector(`text=Question ${i + 1} of 8`);
    await page.keyboard.press('Tab');                // into the radio group
    await page.keyboard.press('ArrowDown');          // Never → Rarely
    await page.keyboard.press('Enter');              // submits the form
  }
  await page.waitForSelector('#gsWarnH');
  await page.keyboard.press('Tab');
  for(let i = 0; i < 9; i++) await page.keyboard.press('Tab');   // to "None of the above"
  await page.keyboard.press('Space');
  assert.ok(await page.isChecked('input[value="none"]'));
  await page.keyboard.press('Enter');
  await page.waitForSelector('#gsResH');
  assert.match(await page.textContent('.gs-score'), /8\s*\/ 24/);
  await page.context().close();
});

test('mixed answers: correct total, band, sub-scores, tie, no warnings', async () => {
  const page = await open();
  await answerAll(page, [1, 1, 2, 0, 0, 0, 0, 0]);   // total 4, bloating/gas 2 ties acidity 2
  await finish(page);
  assert.match(await page.textContent('.gs-score'), /4\s*\/ 24/);
  assert.match(await page.textContent('.gs-band'), /Low reported symptom burden/);
  const subs = await page.$$eval('.gs-sub', els => els.map(e => e.querySelector('.gs-sub-label').textContent + '=' + e.querySelector('.gs-sr').textContent));
  assert.deepEqual(subs, ['Bloating and gas=2 out of 6', 'Acidity and reflux=2 out of 3', 'Abdominal pain=0 out of 3',
    'Bowel function=0 out of 6', 'Food-related symptoms=0 out of 3', 'Daily-life impact=0 out of 3']);
  assert.deepEqual(await page.$$eval('.gs-chip', e => e.map(x => x.textContent)), ['Bloating and gas · 2 / 6', 'Acidity and reflux · 2 / 3']);
  assert.match(await page.textContent('.gs-warn-none'), /None of the listed warning signs were reported in this assessment/);
  assert.equal(await page.locator('.gs-safety').count(), 0);
  assert.match(await page.textContent('.gs-results'), /A low score does not rule out disease/);
  assert.match(await page.textContent('.gs-results'), /not a clinically validated diagnostic instrument/);
  assert.match(await page.textContent('.gs-cta'), /Want to understand your digestive symptoms better\?/);
  await shot(page, 'm-results-low');
  await page.context().close();
});

test('all zeros + urgent warning sign: safety guidance is shown first', async () => {
  const page = await open();
  await answerAll(page, [0, 0, 0, 0, 0, 0, 0, 0]);
  await page.check('input[value="none"]', { force: true });
  await page.check('input[value="chest"]', { force: true });      // clears "none"
  assert.equal(await page.isChecked('input[value="none"]'), false);
  assert.ok(await page.isVisible('.gs-inline-alert'));
  await shot(page, 'm-warnings');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#gsResH');
  const firstSection = await page.$eval('.gs-results > :first-child', e => e.className);
  assert.match(firstSection, /gs-safety-urgent/);
  assert.match(await page.textContent('.gs-safety'), /Seek emergency medical assessment/);
  assert.equal(await page.getAttribute('.gs-btn-emergency', 'href'), 'tel:112');
  assert.match(await page.textContent('.gs-score'), /0\s*\/ 24/);
  assert.match(await page.textContent('.gs-results'), /No elevated symptom category was identified by these responses\./);
  assert.match(await page.textContent('.gs-next'), /follow the safety guidance/);
  await shot(page, 'm-results-urgent');
  await page.context().close();
});

test('non-urgent warning signs → timely evaluation guidance', async () => {
  const page = await open();
  await answerAll(page, [3, 3, 3, 3, 3, 3, 3, 3]);
  await finish(page, ['weightLoss', 'jaundice']);
  assert.match(await page.textContent('.gs-safety-prompt'), /arrange a medical evaluation soon/);
  assert.match(await page.textContent('.gs-safety-prompt'), /Unexplained weight loss.*Yellowing/s);
  assert.match(await page.textContent('.gs-band'), /High reported symptom burden/);
  await page.context().close();
});

test('warning screen requires an answer', async () => {
  const page = await open();
  await answerAll(page, [0, 0, 0, 0, 0, 0, 0, 0]);
  await page.click('button[type="submit"]');
  assert.match(await page.textContent('#gsErr'), /None of the above/);
  assert.equal(await page.locator('#gsResH').count(), 0);
  await page.context().close();
});

test('results cannot be reached by history without completing', async () => {
  const page = await open();
  await answerAll(page, [1, 1, 1, 1, 1, 1, 1, 1]);
  await finish(page);
  await page.click('#gsRestart');
  await page.waitForSelector('#gsStart');
  await page.goForward().catch(() => {});
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#gsResH').count(), 0, 'results not shown after reset');
  await page.context().close();
});

test('privacy: no storage, no network beyond static assets, nothing in URL or console', async () => {
  const page = await open();
  await answerAll(page, [2, 1, 3, 0, 2, 1, 3, 2]);
  await finish(page, ['blood']);
  const store = await page.evaluate(() => ({ l: localStorage.length, s: sessionStorage.length, c: document.cookie }));
  assert.deepEqual(store, { l: 0, s: 0, c: '' });
  assert.equal(new URL(page.url()).search + new URL(page.url()).hash, '');
  const allowedHosts = ['127.0.0.1:8765', 'fonts.googleapis.com', 'fonts.gstatic.com'];
  page.requests.forEach(u => assert.ok(allowedHosts.includes(new URL(u).host), 'unexpected request ' + u));
  assert.ok(!page.requests.some(u => /script\.google|macros/.test(u)), 'no Apps Script calls');
  assert.deepEqual(page.log, []);
  await page.context().close();
});

for(const width of [360, 390, 430, 768, 1024, 1440]){
  test(`no horizontal scroll at ${width}px`, async () => {
    const page = await open({ width, height: 900 });
    const check = async label => {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0, `${label} overflows by ${over}px at ${width}`);
    };
    await check('intro');
    await answerAll(page, [0, 1, 2, 3, 0]);
    await check('question');
    await answerAll2(page, [1, 2, 3]);
    await check('warnings');
    await finish(page, ['severePain', 'swelling']);
    await check('results');
    if(width === 1440 || width === 768) await shot(page, `w${width}-results`);
    await page.context().close();
  });
}
async function answerAll2(page, values){
  for(const v of values){
    await page.check(`input[name="answer"][value="${v}"]`, { force: true });
    await page.click('#gsNext');
  }
}

test('desktop intro screenshot', async () => {
  const page = await open({ width: 1280, height: 860 });
  await shot(page, 'd-intro');
  await page.click('#gsStart');
  await shot(page, 'd-q1');
  await page.context().close();
});
