# ENZO Gut Health Score™ — public assessment app

A standalone, patient-facing, **anonymous** web app with eight digestive-symptom
questions, a 0–24 score, six sub-scores, tied highest areas, a separate
warning-sign check, and a consultation CTA. No build step, no dependencies,
no backend calls.

> Educational symptom-assessment tool. **Not a validated diagnostic
> instrument.** The score bands are proposed educational categories and have
> not been clinically validated.

## 1. Repository audit (summary)

| Area | Finding | Consequence for this app |
|---|---|---|
| Architecture | No-build static PWA: `index.html` + vanilla ES modules in `js/`, `css/app.css`. Served by GitHub Pages from `main`, folder `/` (per `docs/DEPLOYMENT.md`). No `.github/workflows`, no `CNAME`. | Same conventions here: plain HTML/CSS/ES modules, no framework. |
| API transport | `js/api.js` POSTs a JSON string with **no Content-Type** (`text/plain`) so Apps Script needs no CORS preflight. | Any future public call must keep this pattern. |
| Backend auth | `EnzoBackend.gs` `doGet`/`doPost`: every action except `login` requires a staff token plus a role allow-list. **There is no public endpoint.** | Nothing can be saved, linked to a patient or booked from a public page without a new backend endpoint. Persistence is **not enabled**. |
| Backend source of truth | Docs say the `.gs` file is pasted into the Apps Script editor by hand and redeployed (Deploy → Manage deployments → New version). | Changing `EnzoBackend.gs` in GitHub does **not** update the live Web App. Not modified here. |
| Patient data | `Patients` A–L (`COLP`), `Appointments` A–U (`COL` + Stage…Patient ID), `OnlineRecords`. Patient identity resolution is server-side, phone-based. | Untouched. No new sheets created. |
| Service worker | `/sw.js` (scope = site root) does cache-first on every same-origin GET and serves the staff `index.html` on offline navigation. | It would hijack `/score/` on staff devices. **Fixed with a one-line exclusion** (the only change outside `score/`). |
| Branding | `assets/logo-horizontal.png` (slate blue `#557B97` + teal `#5BC5C3`), `logo-mark.png`; fonts Poppins (headings) + Inter (body). | Logo and fonts reused; copies kept in `score/assets/` so the folder is self-contained. |
| Existing scoring/assessment code | None. | All new. |

**Files not modified:** everything in `js/`, `css/`, `index.html`,
`EnzoBackend.gs`, `manifest.json`, `assets/`, `docs/`.

## 2. Files

```
score/
  index.html            page shell (header, main, footer), metadata
  css/gut-score.css     all styles, scoped to .gut-score-app (incl. print)
  js/config.js          single source of truth: questions, options, sub-scores,
                        bands, warning signs, copy, SITE settings
  js/scoring.js         pure scoring engine (no DOM/network/storage)
  js/app.js             UI controller: screens, navigation, focus, rendering
  js/art.js             decorative inline SVG icons + illustration
  assets/               logo-horizontal.png, logo-mark.png (copied from /assets)
  tests/scoring.test.mjs  26 unit tests (node:test)
  tests/ui.test.cjs       17 browser tests (Playwright)
sw.js                   +1 line: never intercept /score/
```

## 3. Configuration (`js/config.js` → `SITE`)

| Key | Default | Notes |
|---|---|---|
| `bookingUrl` | `''` | **No verified public booking route exists** (clinic booking is staff-only). While blank, the CTA reads "To book a consultation, please contact ENZO Homoeo Medical Centre directly." Set it to a verified URL (e.g. an approved booking page) to show a **Book a Consultation** button. |
| `privacyUrl` | `''` | Footer link hidden until an approved policy URL exists. |
| `emergencyNumber` | `'112'` | India's national emergency number (ERSS). Confirm for the clinic's region before go-live. |

No clinic phone number, address or credentials are included, by design.

## 4. Behaviour

- **Journey:** intro → Q1…Q8 (one per screen) → warning-sign check → results.
- **Scoring:** `total = Q1+…+Q8` (0–24), validated as exactly eight integers 0–3.
  Bands: 0–4 Low · 5–9 Mild · 10–16 Moderate · 17–24 High (tested for complete,
  non-overlapping coverage).
- **Sub-scores:** Bloating and gas (Q1+Q2, /6) · Acidity and reflux (Q3, /3) ·
  Abdominal pain (Q4, /3) · Bowel function (Q5+Q6, /6) · Food-related (Q7, /3) ·
  Daily-life impact (Q8, /3). All ties for the top raw score are shown; if all
  are 0, "No elevated symptom category was identified by these responses." The
  page states these are raw scores with different maxima and that comparing
  them does not set medical priority.
- **Warning signs:** separate screen, answer required, "None of the above"
  mutually exclusive. Never added to the score, never read alongside it.
  Urgent (blood in stool/vomit, black tarry stools, severe/persistent abdominal
  pain, chest pain/breathing difficulty) → emergency guidance plus a `tel:` link.
  Others → timely medical evaluation. When signs are selected, the safety panel
  is shown **first** on the results page, above the score. If none are
  selected, the page says "None of the listed warning signs were reported in this
  assessment."
- **Explanation:** fixed sentence templates restating only the visitor's own
  answers for the top areas (and daily impact if ≥ Sometimes). No causes,
  diagnoses or treatments.
- **Navigation:** forward steps push a history entry that holds only the step
  name. Back (in-app, browser or Android) returns to the previous step with the
  answers kept. You cannot reach the results through history without
  completing the steps.

## 5. Privacy and security

- Answers are kept **only in memory**. No localStorage, sessionStorage,
  cookies or IndexedDB. Nothing goes in the URL, the console or the network
  (the tests check this). A refresh resets progress (a `beforeunload` prompt
  warns mid-assessment). There is deliberately no draft persistence.
- No analytics, no third-party scripts. The only third-party request is the
  Google Fonts stylesheet and font files, which carry no health data. Remove
  the two `<link>` tags to use system fonts if preferred.
- No secrets, no staff endpoints, no Apps Script URL in this folder.
- Print view shows the result only. The page holds no personal identifiers.
- No AI services or generated images are used. The illustration is hand-written SVG.

## 6. Tests

```
node --test score/tests/*.test.mjs                       # 26 scoring tests
python3 -m http.server 8765 &                            # from repo root
NODE_PATH="$(npm root -g)" node --test score/tests/ui.test.cjs   # 17 UI tests
```

The UI tests cover: intro and disclaimer, one question per screen, the
progressbar, missing-answer validation, Previous/header/browser back with
preserved answers, Q5 help text, keyboard-only completion, totals, bands,
sub-scores, two-way ties, all-zero plus an urgent warning (safety panel first),
high score with non-urgent signs, a required warning answer, the reset/history
guard, privacy (no storage, URL, console or unexpected requests), and no
horizontal scroll at 360/390/430/768/1024/1440 px.

## 7. Deployment

### Options

| | A. Separate repo (e.g. `ihkarise/enzo-gut-score`) | B. Route in ENZO-CLINIC- (`/score/`) |
|---|---|---|
| Custom subdomain | ✅ its own Pages custom domain | ❌ one custom domain per Pages site: adding `score.<domain>` here would **move the staff app** to that hostname |
| Independent deploy and rollback | ✅ | ❌ shares `main` with the staff app |
| Isolation from the staff SW and origin | ✅ separate origin | ⚠️ same origin; relies on the `sw.js` exclusion |
| Setup effort | copy one folder | none (live as soon as merged to `main`) |

**Recommendation:** use B only as a preview (`https://ihkarise.github.io/ENZO-CLINIC-/score/`
once merged), and use **A for production on the subdomain**. The folder has no
imports from the clinic app, so it can be copied unchanged.

### Production on `score.<your-domain>` (option A)

The final domain was not found anywhere in the repository and is not known, so
`<your-domain>` below is a placeholder. Do not use `yourdomain.com`.

1. Create a repo, e.g. `ihkarise/enzo-gut-score`, and copy the **contents** of
   `score/` to its root (`index.html` at the root). The tests can stay;
   `tests/` is harmless on Pages.
2. Repo **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`.
3. Settings → Pages → **Custom domain** = `score.<your-domain>` → Save. GitHub
   commits a `CNAME` file to **that repo** (never add a CNAME to ENZO-CLINIC-).
4. At the DNS provider for `<your-domain>`, add:
   `score  CNAME  ihkarise.github.io.` (TTL 3600). Use a CNAME pointing to
   `<user>.github.io`, not the repo name and not A records, because this is a subdomain.
5. Optional but recommended: verify the domain at **GitHub → Settings (account) →
   Pages → Add a domain** (TXT record `_github-pages-challenge-ihkarise.<your-domain>`)
   to prevent takeover.
6. Wait for the DNS check to pass (`dig score.<your-domain> +short` should show
   `ihkarise.github.io.` then GitHub IPs), then tick **Enforce HTTPS** after
   the certificate is issued (can take up to about 1 h).
7. Add `<link rel="canonical" href="https://score.<your-domain>/">` and an
   absolute `og:image`/`og:url` to `index.html`.
8. Check: direct load, refresh on results (resets to intro by design), every
   asset returns 200 under the new host, favicon, title, and print.
9. If a future version calls Apps Script, keep the no-Content-Type POST
   pattern from `js/api.js` (Apps Script cannot answer CORS preflights).

### Rollback

- Option B: revert the merge commit on `main` (`git revert -m 1 <merge>`). This
  removes `score/` and the one `sw.js` line, and the staff app is otherwise unaffected.
- Option A: revert the commit in the score repo, or unpublish Pages
  (Settings → Pages → Unpublish) and remove the `score` DNS record. The staff app is
  not involved.

## 8. Backend integration (proposed, not implemented)

Saving or linking a result requires a **new public Apps Script action** and a
manual redeploy. Before enabling it:

- Add `action: 'submitScore'` to `doPost` **before** the token check, accepting
  only raw answers + warning ids + explicit consent. **Recompute the score
  server-side** and do not trust a client total. Rate-limit (e.g. CacheService
  per IP hash), cap the payload size and validate every field.
- Proposed new tab `ScoreResponses` (does not touch Appointments A–U or Patients A–L):
  `Response ID | Template ID | Template Version | Submitted Date | Patient ID (only if consented+verified) | OPD Number (only if required) | Answers JSON | Total Score | Result Band | Sub-scores JSON | Warning-sign selections | Consent status | Source | Status`
- Existing-patient linking must **not** confirm identity from an OPD number
  alone, and must give the same response whether or not the patient exists (no
  "is this person a patient" oracle). New-patient submission should create no
  Patients row. Reception links it later through the existing staff
  `findOrCreatePatient` flow to avoid duplicates.
- Reads stay staff-only (token + role), with no public read endpoint.
- Decide on retention, access and a privacy policy (`SITE.privacyUrl`) first.

## 9. Known limitations

- No save, share or patient-link feature (no safe public endpoint exists).
- No public booking route. The CTA shows a "contact the clinic" message until `bookingUrl` is set.
- Progress resets on refresh (intentional, for privacy).
- Uses CSS `:has()` for selected-card styling (Chrome/Edge 105+, Safari 15.4+, Firefox 121+).
  On older browsers the native radios/checkboxes still work, but the selected highlight is not shown.
- Production subdomain not configured. The live clinic site could not be reached
  from the build environment, so the current GitHub Pages settings were taken
  from the repository docs and not confirmed in the dashboard.

## 10. Checklist

| Item | Status |
|---|---|
| Exact 8 questions, options and points from config | ✅ verified (unit + UI tests) |
| Scoring 0–24, validation, bands, sub-scores, ties | ✅ verified (26 unit tests) |
| Warning check independent of score, none-exclusive, urgent routing | ✅ verified (unit + UI) |
| One question per screen, progress, validation, back navigation, keyboard | ✅ verified (UI tests) |
| No horizontal scroll at 360–1440 px; screenshots reviewed | ✅ verified |
| No storage, URL, console or network leakage | ✅ verified (UI test) |
| Staff app loads; its SW still registers and no longer caches `/score/` | ✅ verified in headless Chromium (demo login screen only) |
| Staff login, roles, booking, Patient Master, consultation, timeline, printing, offline queue against the live backend | ⏳ **not run.** No staff code changed, but needs the manual `docs/TESTING.md` pass before merge |
| Screen-reader pass (NVDA/VoiceOver) | ⏳ planned (semantics are in place, but no assistive-technology run yet) |
| Booking URL, privacy URL, emergency number sign-off | ⏳ needs clinic decision |
| Subdomain DNS + HTTPS | ⏳ planned (needs the real domain) |
| Persistence / patient linking | ⏳ planned (§8) |
