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
async function open(viewport = { width: 390, height: 844 }, lang = 'en', setup){
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.log = []; page.requests = []; page.errors = [];
  page.on('console', m => page.log.push(m.text()));
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('request', r => page.requests.push(r.url()));
  if(setup) await setup(page);
  await page.goto(BASE);
  if(lang) await page.click(lang === 'ml' ? '#gsLangMl' : '#gsLangEn');
  return page;
}
const waText = async page => decodeURIComponent((await page.getAttribute('#gsWa', 'href')).split('?text=')[1]);
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

test('language screen comes first; both languages offered', async () => {
  const page = await open(undefined, null);
  assert.match(await page.textContent('h1'), /Choose your language.*ഭാഷ തിരഞ്ഞെടുക്കുക/s);
  assert.ok(await page.isVisible('#gsLangEn'));
  assert.ok(await page.isVisible('#gsLangMl'));
  assert.ok(await page.isHidden('#gsLang'), 'header switch hidden on the language screen');
  assert.ok(await page.isHidden('#gsBack'));
  await shot(page, 'm-lang');
  await page.click('#gsLangEn');
  await page.waitForSelector('#gsStart');
  assert.ok(await page.isVisible('#gsLang'));
  await page.goBack();                                          // browser back → language screen
  await page.waitForSelector('#gsLangMl');
  await page.context().close();
});

test('Malayalam: full journey in Malayalam, WhatsApp message in Malayalam', async () => {
  const page = await open(undefined, 'ml');
  assert.equal(await page.getAttribute('html', 'lang'), 'ml');
  assert.equal(await page.textContent('h1'), 'നിങ്ങളുടെ കുടലിന്റെ ആരോഗ്യം എങ്ങനെയാണ്?');
  assert.match(await page.textContent('#gsStart'), /വിലയിരുത്തൽ ആരംഭിക്കുക/);
  await shot(page, 'm-ml-intro');
  await page.click('#gsStart');
  assert.match(await page.textContent('.gs-progress-text'), /ചോദ്യം 1 \/ 8/);
  assert.match(await page.textContent('.gs-legend'), /വയറുവീർക്കലോ/);
  assert.match(await page.textContent('.gs-options'), /ഒരിക്കലുമില്ല.*0 ദിവസം.*പതിവായി.*7–14 ദിവസം/s);
  await page.click('#gsNext');
  assert.equal(await page.textContent('#gsErr'), 'തുടരാൻ ഒരു ഉത്തരം തിരഞ്ഞെടുക്കുക.');
  await shot(page, 'm-ml-q1');
  await answerAll2(page, [2, 2, 1, 0, 1, 0, 1, 2]);
  assert.match(await page.textContent('h1'), /നിങ്ങളുടെ ഫലം കാണിക്കുന്നതിന് മുമ്പ്/);
  await finish(page);
  assert.match(await page.textContent('.gs-band'), /നേരിയ ദഹനസംബന്ധമായ പ്രശ്നങ്ങൾ/);
  assert.match(await page.textContent('.gs-wa'), /ഡോക്ടറുമായി ബന്ധപ്പെട്ട് നിങ്ങളുടെ സ്കോർ മനസ്സിലാക്കൂ/);
  const msg = await waText(page);
  assert.match(msg, /\*എന്റെ സ്കോർ: 9\/24 – നേരിയ ദഹനസംബന്ധമായ പ്രശ്നങ്ങൾ\*/);
  assert.match(msg, /ഇതിനെക്കുറിച്ച് എന്തെങ്കിലും ചെയ്യാൻ കഴിയുമോ/);
  assert.match(await page.textContent('.gs-disclaimer'), /ക്ലിനിക്കൽ പരിശോധനകളിലൂടെ സാധൂകരിച്ച രോഗനിർണയ ഉപകരണമല്ല/);
  await shot(page, 'm-ml-results');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('switching language mid-assessment keeps the step and the answers', async () => {
  const page = await open();
  await answerAll(page, [3, 2]);                                 // now on Q3
  await page.check('input[value="1"]', { force: true });
  await page.click('#gsLang [data-lang="ml"]');
  assert.match(await page.textContent('.gs-progress-text'), /ചോദ്യം 3 \/ 8/);
  assert.ok(await page.isChecked('input[value="1"]'));
  await page.click('#gsPrev');
  assert.ok(await page.isChecked('input[value="2"]'), 'Q2 answer kept');
  await page.click('#gsLang [data-lang="en"]');
  assert.match(await page.textContent('.gs-progress-text'), /Question 2 of 8/);
  assert.equal(await page.getAttribute('#gsLang [data-lang="en"]', 'aria-pressed'), 'true');
  await page.context().close();
});

test('WhatsApp card: first on the results, one tap, correct number and message', async () => {
  const page = await open();
  await answerAll(page, [1, 1, 2, 3, 0, 0, 2, 3]);
  await finish(page);
  assert.match(await page.$eval('.gs-results > section', e => e.className), /gs-wa/, 'WhatsApp card is the first section');
  assert.match(await page.textContent('.gs-wa'), /How did you score\?.*Contact your doctor and know your score/s);
  assert.match(await page.textContent('.gs-wa-score'), /12 \/ 24 · Moderate reported symptoms/);
  const href = await page.getAttribute('#gsWa', 'href');
  assert.ok(href.startsWith('https://wa.me/919986319779?text='));
  assert.equal(await page.getAttribute('#gsWa', 'target'), '_blank');
  const msg = await waText(page);
  assert.match(msg, /\*My score: 12\/24 – Moderate reported symptoms\*/);
  assert.match(msg, /Highest areas: Abdominal pain 3\/3, Daily-life impact 3\/3/);
  assert.match(msg, /Can we do something about this\? Please tell me more\./);
  const book = decodeURIComponent((await page.getAttribute('#gsBook', 'href')).split('?text=')[1]);
  assert.match(book, /I would like to book a consultation\./);
  assert.ok(await page.isHidden('.gs-wa-photo'), 'placeholder doctor photo stays hidden');
  await shot(page, 'm-results-wa');
  await page.context().close();
});

test('uploaded photos appear automatically', async () => {
  const { execFileSync } = require('node:child_process');
  const img = execFileSync('python3', ['-c', "import sys,io;from PIL import Image;b=io.BytesIO();Image.new('RGB',(600,600),(120,160,150)).save(b,'JPEG');sys.stdout.buffer.write(b.getvalue())"]);
  const page = await open(undefined, 'en', async p => {
    await p.route(/assets\/photos\/(doctor|hero)\.jpg$/, r => r.fulfill({ contentType: 'image/jpeg', body: img }));
  });
  await page.waitForSelector('.gs-hero-photo:not([hidden])');
  assert.ok(await page.isHidden('.gs-hero-art .gs-illus'), 'illustration replaced by the photo');
  await answerAll(page, [0, 0, 0, 0, 0, 0, 0, 0]);
  await finish(page);
  await page.waitForSelector('.gs-wa-photo:not([hidden])');
  await page.context().close();
});

test('intro shows headline, facts, CTA and full disclaimer', async () => {
  const page = await open();
  assert.equal(await page.textContent('h1'), 'How healthy is your gut?');
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
  assert.match(firstSection, /gs-sr/);                     // hidden page heading
  const sections = await page.$$eval('.gs-results > section', els => els.map(e => e.className));
  assert.match(sections[0], /gs-safety-urgent/, 'safety panel before everything else');
  assert.match(sections[1], /gs-wa/);
  assert.match(await page.textContent('.gs-wa-urgent'), /call 112 first/);
  assert.match(await waText(page), /Warning signs ticked: Chest pain or breathing difficulty/);
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
  assert.ok(!page.requests.some(u => /wa\.me|whatsapp/.test(u)), 'nothing sent unless the visitor taps WhatsApp');
  assert.ok(!page.requests.some(u => /script\.google|macros/.test(u)), 'no Apps Script calls');
  assert.deepEqual(page.log, []);
  await page.context().close();
});

for(const width of [360, 390, 430, 768, 1024, 1440]){
  test(`no horizontal scroll at ${width}px`, async () => {
    const page = await open({ width, height: 900 }, width === 360 ? 'ml' : 'en');
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
  await page.click('#gsLang [data-lang="ml"]');
  await shot(page, 'd-ml-intro');
  await page.click('#gsLang [data-lang="en"]');
  await page.click('#gsStart');
  await shot(page, 'd-q1');
  await page.context().close();
});
