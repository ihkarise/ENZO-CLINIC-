# Architecture — Enzo Homoeo Medical Centre Clinic App

> **Audience:** developers who will read, extend, or maintain this codebase.
> **Companion docs:** [`DEPLOYMENT-GUIDE.md`](DEPLOYMENT-GUIDE.md) (how to ship it),
> [`OPERATIONS-RUNBOOK.md`](OPERATIONS-RUNBOOK.md) (how clinic staff run it day to day),
> plus the shorter existing guides [`MIGRATION.md`](MIGRATION.md), [`ROLLBACK.md`](ROLLBACK.md),
> [`TESTING.md`](TESTING.md).

---

## 1. Project overview

Enzo Homoeo Medical Centre's clinic app is a **no-build, installable
Progressive Web App (PWA)** for booking appointments, running consultations,
and tracking patients. It has three moving parts:

| Layer | Technology | Where it lives |
|---|---|---|
| Frontend | Static HTML/CSS/JS (ES Modules), PWA | GitHub Pages (or any static host) |
| Backend | Google Apps Script (`EnzoBackend.gs`) | Bound to a Google Sheet, deployed as a Web App |
| Database | Google Sheet, three tabs | `Appointments`, `OnlineRecords`, `Patients` |
| Auth | Script Properties + CacheService tokens | Inside the Apps Script project |

There is **no server you manage, no database you administer, and no build
pipeline.** Every file the browser downloads is exactly the file in this
repository — what you see in the editor is what ships. This is a deliberate
design choice: it keeps the system operable by a small clinic team without a
dedicated ops person.

The project is at **Phase 3 — Patient Master + Unique Patient ID + Timeline
Foundation**, built on **Phase 2 — Clinic Experience Improvements** (dynamic
scheduling, capacity, appointment cards, theme, search, Settings — see
[§23](#23-phase-2--clinic-experience-improvements)) and the **Phase 1 —
Foundation + Workflow** base (booking, the consultation lifecycle, the
patient timeline, the dashboard, role-gated access). Phase 3 gives every
patient a permanent identity (Patient ID + sequential OPD Number) instead of
grouping appointments by guessing name/phone, adds booking-time duplicate
detection, and rebuilds the Timeline and global search on that permanent
identity (see [§24 Phase 3](#24-phase-3--patient-master--unique-patient-id--timeline-foundation)).
Billing, Inventory, Prescriptions, a Patient Portal, Laboratory workflows,
Payments and WhatsApp automation remain explicitly **out of scope** (see
[§21 Future roadmap](#21-future-roadmap)) — Phase 3 lays the identity
foundation those modules will need, without building them.

---

## 2. Folder structure

```
ENZO-CLINIC-/
├── index.html            Markup only — no inline logic, one <script type="module">
├── manifest.json          PWA manifest (icons, name, theme color, standalone display)
├── sw.js                  Service worker — app-shell cache, offline fallback
├── EnzoBackend.gs         The entire backend: Apps Script bound to the Google Sheet
├── css/
│   └── app.css            All styles — one file, custom properties for theme values
├── js/
│   ├── core.js            DOM/date/format helpers, escapeHtml, constants — no state
│   ├── store.js           Central app state (pub/sub) + role permission table
│   ├── api.js             Backend calls, offline write queue, demo-data generator
│   ├── workflow.js        Appointment shaping, Scheduled/Completed bucketing, follow-up math
│   ├── ui.js               Toast, confirm dialog, overlay open/close
│   ├── auth.js             Login/logout, declarative role gating ([data-perm])
│   ├── booking.js          Booking form + appointment list (Scheduled/Completed tabs)
│   ├── consultation.js     Complete Consultation modal + automation
│   ├── online.js           Online patient record page
│   ├── dashboard.js        KPIs, Chart.js charts, referred-by breakdown + CSV export, quick patient search
│   ├── patients.js         (Phase 3) Patient Master: identity, duplicate lookup, search index, demo derivation
│   ├── timeline.js         Patient timeline — built on the Patient Master (patientId), not name/phone guessing
│   ├── reminders.js        Bell icon / "today" modal
│   └── app.js              Bootstrap — the only script index.html loads directly
├── assets/                Logos, favicon, PWA icons (PNG)
└── docs/
    ├── ARCHITECTURE.md          (this file)
    ├── PATIENT-MASTER.md        (Phase 3) Patient identity, duplicate detection, migration — plain English
    ├── DEPLOYMENT-GUIDE.md      Beginner-friendly full deployment walkthrough
    ├── OPERATIONS-RUNBOOK.md    Day-to-day staff operating procedures
    ├── DEPLOYMENT.md            Original short deploy guide (kept for reference)
    ├── MIGRATION.md             Upgrading an existing production sheet to Phase 1
    ├── ROLLBACK.md               Reverting frontend/backend independently
    └── TESTING.md                 Manual test checklist run before every release
```

**Design rule:** each `js/` module owns exactly one concern and talks to
other modules only through `store.js` (shared state) or small, explicitly
exported functions. There are no scattered globals and no module reaches
into another module's private variables.

---

## 3. Module responsibilities

### `js/core.js` — pure helpers, no state
- `$(id)` — `document.getElementById` shorthand.
- `DAY` — one day in milliseconds (`86400000`), used throughout for date math.
- `SLOTS` — the fixed list of 16 bookable time-of-day slots (`09:00`…`12:30`,
  `16:00`…`19:30`, 30-minute increments, with a lunch gap).
- `fmt(d)` — human date format (`Mon, 3 Jul`).
- `same(a,b)` — same-calendar-day comparison.
- `to12h(s)` — `"14:30"` → `"2:30 PM"`.
- `rid()` — client-generated ID (`a` + base36 timestamp + random suffix) used
  for optimistic UI before the server confirms.
- `toISODate(d)` — `YYYY-MM-DD`.
- `digits(s)` — strips a phone number down to what `tel:`/`wa.me` accept.
- `normPhone(s)` — (Phase 3) digits-only, last 10 kept, for patient-identity
  matching. Mirrors `EnzoBackend.gs`'s `normPhone()` exactly — client and
  server must agree on what "same phone" means, or a duplicate-detection
  match on the client could disagree with what the server actually links.
- `escapeHtml(s)` — **the only thing standing between patient-entered text
  and stored XSS.** Every place a module builds `innerHTML` from
  user-entered data (name, phone, notes, diagnosis, referrer, place) must
  route it through this. If you add a new render path, escape it.
- `ICON_*` — inline SVG strings reused across modules (edit/delete/done/call/whatsapp).

### `js/store.js` — the only source of shared state
A tiny hand-rolled pub/sub store (~30 lines, deliberately not Redux):

```js
store.get(key)        // read one field, or the whole state object if key is omitted
store.set(patch)       // Object.assign the patch into state, then fire listeners
store.on(event, fn)     // subscribe to one key changing, or '*' for any change
```

State held here: `token`, `user`, `role`, `appts`, `onlineRecords`,
`patients` (Phase 3 — the Patient Master, see `js/patients.js`), `online`
(navigator connectivity), `loading`, booking-form transient fields
(`editingId`, `apptTouched`, `selectedSlot`, `bookingType`), list UI state
(`listTab`, `scheduledSub`, `completedSub`), dashboard `range`, and
undo/focus bookkeeping (`pendingDeleteId`, `lastFocus`, `lastDeleted`).
(Booking's duplicate-detection state — `dupMatch`/`dupDecision`/
`editPatientId` — is deliberately kept as module-local variables in
`booking.js`, not in `store.js`: nothing outside that one module needs it,
same pattern as `consultation.js`'s local `medDuration`/`outcome`.)

`store.js` also exports `can(action)` — **the client-side half of the
permission system.** It is a pure function of `state.role` and a
hard-coded permission table (see [§8 Role system](#8-role-system)).

### `js/api.js` — all network I/O
- `CONFIG.WEB_APP_URL` — the single configuration point that connects the
  frontend to a specific Apps Script deployment. **Blank string = demo
  mode** (fabricated data, no backend calls at all).
- `postAction(body)` — the one function every write goes through. If
  `fetch` throws (device is offline), the write is pushed onto a
  `localStorage`-backed queue and the caller is told `{ ok:true, queued:true }`
  so the UI can proceed optimistically. If the *server* rejects the request
  (`ok:false` — e.g. `slot_taken`, `forbidden`), it is **not** queued —
  retrying a rejected write would not help, so the error surfaces immediately.
- `flushQueue(onProgress)` — replays the queue in order on reconnect, one
  item at a time, stopping at the first failure so nothing is skipped or
  reordered.
- `login(user, pass)` — demo-mode short-circuit, or a real POST to the
  backend's `login` action.
- `fetchAppts(token)` / `fetchOnline(token)` / `fetchPatients(token)` — the
  three GET reads (`fetchPatients` is Phase 3, the Patient Master).
- `createPatient(token, fields)` — (Phase 3) POST `createPatient`, routed
  through `postAction` so it inherits the same offline queue as every
  other write.
- `genDemoAppts()` / `genDemoOnline()` — synthetic data generators used
  **only** when `WEB_APP_URL` is blank. A hard production bug from the
  previous build (silently showing fake patients whenever a configured
  backend returned zero rows) was fixed by making demo data strictly
  conditional on an unconfigured URL — see the comment at the top of the file.

> **⚠️ Current repository state:** `CONFIG.WEB_APP_URL` in `js/api.js` is
> **not blank** — it already points at a live Apps Script `/exec` URL. Any
> fork/redeploy of this project must replace that URL with the new
> deployment's own URL (see the Deployment Guide) or it will write into
> the *original* clinic's Google Sheet.

### `js/workflow.js` — the business rules
This is the one file that knows what "Scheduled", "Pending", or "auto
follow-up" *mean*, so every UI module stays a dumb renderer.

- `STAGE` — the enum: `Scheduled | Completed | Cancelled | NoShow`.
- `mapAppt(r)` — normalizes a raw row (from the Sheet or demo data) into the
  shape the UI uses. **A blank/unknown `stage` is treated as `Scheduled`** —
  this is what makes the Phase 1 migration backward-compatible with rows
  that predate the `Stage` column.
- `computeFollowUp(apptDate, medDuration)` — `apptDate + medDuration days`.
- `scheduledBucket(appt, now)` — `upcoming | today | pending` (pending =
  past date, still open).
- `isScheduled(appt)` — true if stage is `Scheduled` or blank.
- `completedBucket(appt)` — `completed | cancelled | noshow`.

### `js/ui.js` — generic, content-agnostic widgets
- `toast(message, opts)` — bottom toast, optional action button (used for Undo Delete).
- `confirmDialog(title, text, danger)` — promise-based confirm modal (used by Delete).
- `openOverlay(id, focusEl)` / `closeOverlay(id)` — modal open/close with a
  focus-return stack (accessibility: focus goes back to the button that opened it).
- `wireEscapeToClose(overlayIds)` — global Escape-key handler.

### `js/auth.js` — login/logout + declarative role gating
- `initAuth(onSignedIn)` — wires the login form and logout button.
- `applyRoleGating()` — the mechanism behind role-based UI: any element in
  `index.html` marked `data-perm="book"` (or a comma-separated list of
  permissions) is shown only if `can()` returns true for at least one of
  them. Administrator always passes. This is declarative — to gate a new
  button, add `data-perm="..."` to its markup; no JS change needed in the
  common case.
- On logout, role resets to `Receptionist` as a safe default (though the
  login screen is shown again immediately, so this is mostly cosmetic).

### `js/booking.js` — booking form + appointment list
- Client-side slot-clash pre-check (`isSlotTaken`) so a doomed booking never
  reaches the network — the *authoritative* check still happens server-side
  in `EnzoBackend.gs`'s `slotTaken()` under a lock.
- Renders only free slots for the selected date (`renderSlots`).
- The Scheduled/Completed tab switch and their sub-filters
  (Upcoming/Today/Pending, Completed/Cancelled/No-show) with live counts.
- Search filters across **all** appointments regardless of the active tab,
  now via `patients.js`'s `apptSearchMatches()` — extends the base
  name/phone/ID/diagnosis/notes match with the linked patient's OPD
  Number/Patient ID/Notes.
- **(Phase 3) Duplicate-patient detection**: a debounced listener on the
  phone field calls `patients.js`'s `findPatientByPhone()`; a match renders
  the Returning Patient card (`#dupCard`) with **Use existing** / **Create
  new anyway**, collapsing to a small chip (`#dupChip`) once decided. On
  save, `saveAppt()` resolves a `patientId` before booking — the matched
  patient, a freshly `createNewPatient()`-created one, or (editing) the
  appointment's existing, unchanged `patientId`. Suppressed entirely while
  editing an existing appointment (identity never changes on edit).
- Delete is soft in the UI: `performDelete` removes the row from the local
  list immediately, shows a 5-second **Undo** toast, and only fires the
  server-side `delete` action if the toast times out unactioned.
- Print Today's Schedule builds a clean printable table into the hidden
  `#printArea` element and calls `window.print()`; `@media print` in
  `app.css` hides all app chrome.

### `js/consultation.js` — Complete Consultation + automation
The heart of Phase 1. Opens a modal (`openConsult`) either in edit mode
(role permitting) or read-only view mode. On save (`saveConsult`):
1. Determines `stage` from the selected Outcome (`Completed → Completed`,
   `Cancelled → Cancelled`, `No show → NoShow`).
2. If `Completed` and a follow-up date is set, generates a client-side
   follow-up ID (`autoFollowUpId`) up front so the request is **idempotent**
   — a retried network call can't create two follow-up appointments.
3. If the source appointment's type is `Online` and the outcome is
   `Completed`, sets `autoOnlineRecord: true` so the backend also creates an
   Online Record row, keyed by `Source Appt ID` so a retry can't duplicate it.
4. Sends one `complete` action to the backend; on success, updates local
   state optimistically (source appointment's stage/diagnosis/etc, the new
   follow-up appointment, and the new online record) without waiting for a
   full reload.

### `js/online.js` — Online patient record page
Simple create-and-list page for records not tied to an appointment (e.g. a
lead that hasn't booked yet). HTML-escaped on render (this page had a
stored-XSS hole in the pre-Phase-1 build; fixed here). (Phase 3) A search
box filters via `patients.js`'s `onlineSearchMatches()`; on save, the
record's `patientId` comes from the server's response (it always resolves
one — matched by phone or freshly created) or, if the write was queued
offline, a local phone match against the already-loaded Patient Master so
the record still groups correctly in the Timeline immediately.

### `js/dashboard.js` — KPIs and charts (Administrator only)
- Week/Month/Year range toggle recomputes `bounds()` (current + comparison
  period) and re-buckets appointments (`buckets`, `wperf`, `cnt`).
- Two Chart.js charts: a stacked bar+line **Trend** chart (Online / In-clinic
  visits + total Appointments booked) and a **Day-of-week performance** bar
  chart, with busiest/quietest day call-outs.
- **Referred-by breakdown** for Online Records in the selected period, with
  a clickable bar list that filters a detail view, and a **CSV export**
  button (`downloadCSV`) that builds the file client-side with `Blob`/`URL.createObjectURL` —
  no backend endpoint involved.
- Chart.js itself is loaded from a CDN (`cdnjs.cloudflare.com`) via a
  `<script>` tag in `index.html`, **not bundled**. If that request fails
  (offline first load, ad blocker, CDN outage), `dashboard.js` detects
  `typeof Chart === 'undefined'` and degrades gracefully — chart boxes show
  "Charts unavailable offline" instead of throwing and breaking the rest of
  the app bootstrap.
- **(Phase 3)** A quick patient search box (`#dashSearch`) reuses the same
  `patients.js` search index; picking a result switches to the Timeline
  page and opens that patient directly (`setTimelineOpener`), rather than
  duplicating the Timeline's own rendering here.

### `js/patients.js` — Patient Master (Phase 3)
The single place that decides "which patient does this record belong to"
on the frontend. Appointments/online records carry a `patientId`; this
module never groups by guessing name/phone.
- `patientById(id)` / `findPatientByPhone(phone)` — exact-`patientId` and
  exact-normalised-phone lookups against `store.patients`.
- `indexApptsByPatient()` — builds a `patientId → appointments[]` `Map` in
  one pass. Every place that scans **many** patients (Timeline search,
  Dashboard quick search) builds this once and reads from it, instead of
  re-filtering `store.appts` per candidate patient — that's what keeps
  search **O(patients + appointments)** instead of **O(patients ×
  appointments)** at a few thousand rows of each.
- `recordsFor(patientId)` / `patientSummary(patientId)` — one patient's
  appointments+online records, and a `{visitCount, lastVisit, diagnosis}`
  summary — cheap for a single patient (Timeline detail view, the
  duplicate-detection prompt); not meant to be called in a loop over many
  patients (use the index above for that).
- `ageFromDob(dob)` — whole years from a DOB to today, or `''` if none on
  file (most patients don't have one yet — the booking form never asked).
- `createNewPatient(token, fields)` — unconditional create (no dedup — see
  `EnzoBackend.gs`'s `createPatient` vs `findOrCreatePatient`). Offline- and
  demo-mode-safe: if the write is queued or there is no backend at all, an
  optimistic local patient is pushed into `store.patients` immediately so
  booking isn't blocked; a queued write's real OPD Number lands once it
  syncs and `app.js`'s `maybeFlushQueue()` re-fetches.
- `patientMatches(patient, query, apptsByPatient)` / `apptSearchMatches(appt, query)`
  / `onlineSearchMatches(record, query)` — the one global search rule
  (Patient ID / OPD Number / Name / Phone / Notes, plus Diagnosis /
  Clinical / Medicine notes / Outcome via that patient's appointments),
  applied identically from Booking, Online Records, the Dashboard and the
  Timeline. `apptSearchMatches`/`onlineSearchMatches` compose with
  `core.js`'s `apptMatches()` rather than re-implementing its field list.
- `deriveDemoPatients(appts, onlineRecords)` — demo-mode only: derives a
  consistent Patient Master from the generated demo data (same phone/name
  key rule) and stamps `patientId` onto every generated record, so demo
  mode never has to be special-cased anywhere else in the app.

### `js/timeline.js` — Patient Timeline
Built **entirely client-side** from data already loaded by `app.js`'s
`loadData()` (`appts`, `onlineRecords`, and — Phase 3 — `patients`) — no
dedicated backend endpoint for rendering.
- Search (`renderPatientList`) filters `store.patients` via
  `patients.js`'s `patientMatches()`, built against a single
  `indexApptsByPatient()` pass (see above) so it stays fast well past a
  few thousand patients.
- Selecting a patient (`renderTimeline(patientId)`) shows a **Patient
  Profile card** (`profileCardHtml` — OPD, Name, Phone, Age, Gender, Visit
  Count, Last Visit) followed by the event list.
- `eventsFor(patientId)` builds a chronological list of every booked/
  cancelled/no-show/completed appointment plus every online record whose
  `patientId` matches, sorted newest-first — grouping is the permanent
  Patient ID, never a guessed name/phone key.
- `openPatientTimeline(patientId)` — the entry point used by Booking's
  "View timeline" link and the Dashboard's quick search to jump straight
  to one patient (the caller switches pages first; `app.js` wires this).

### `js/reminders.js` — the bell icon and "today" modal
Counts only `Scheduled`-stage appointments due today or requiring a
reminder call tomorrow (a completed/cancelled appointment shouldn't nag
reception at the door). Feeds the badge count on the bell icon, the top
banner, and the modal that auto-opens ~450ms after sign-in if there's
anything to show (`openTodayIfAny`, called from `app.js`).

### `js/app.js` — bootstrap
The **only** script `index.html` loads (`<script type="module" src="js/app.js">`).
Responsibilities, in order:
1. Wires every module's `init*()` function.
2. Registers the service worker (`sw.js`) after `load`.
3. On successful login (`enterApp`): hides the login screen, applies role
   gating, loads data (`loadData` — real fetch (appointments, online
   records, **and, Phase 3, patients**) or demo generator + `deriveDemoPatients()`
   depending on `CONFIG.WEB_APP_URL`), renders every page, tries to flush
   the offline queue if online, and opens the "today" modal if there's
   anything due.
4. Owns page navigation (`navTo`) — a simple `.page.active` class toggle
   with a directional slide animation, no router/history API involved
   (this is a single-page app with in-memory navigation only; there is no
   deep-linking).
5. `initOfflineIndicator()` — listens to `window`'s `online`/`offline`
   events, toggles the top offline bar, and triggers a queue flush the
   moment connectivity returns.
6. **(Phase 3)** Wires `booking.js`'s and `dashboard.js`'s
   `setTimelineOpener()` to a shared `openTimelineFor(patientId)` — switch
   to the Timeline page, then `timeline.js`'s `openPatientTimeline(patientId)`
   — the same "register a callback" pattern already used for
   `setConsultOpener`/`setNavigator`. `maybeFlushQueue()` also re-runs
   `loadData()` after a successful flush, so a patient created while
   offline picks up its real server-assigned OPD Number without a manual
   reload.

---

## 4. Frontend architecture

- **No bundler, no `npm install`, no build step.** Every file the browser
  downloads is a file in this repo, verbatim. This is why the Deployment
  Guide's "why no build system matters" section exists — there is nothing
  to get out of sync between a developer's machine and what GitHub Pages
  serves.
- **ES Modules** (`<script type="module">`) mean the app **must** be served
  over `http://` or `https://` — opening `index.html` via `file://` fails
  silently on the `import`/`export` statements due to browser CORS
  restrictions on local files, and the service worker won't register at all.
- **State flows one way:** a module never reaches into another module's
  private state. Everything shared goes through `store.js`. Rendering
  functions (`renderAppts`, `renderOnline`, `renderDash`, timeline
  rendering) are called explicitly after a state change — there is no
  reactive/virtual-DOM re-render system; this is intentional simplicity for
  a codebase this size.
- **Optimistic UI + reconciliation:** most write actions (`saveAppt`,
  `saveConsult`, online record save) update `store.appts`/`onlineRecords`
  locally right after a successful (or queued) `postAction` response,
  instead of waiting for a full reload. This is why the UI feels instant
  even against a real Apps Script backend (which is not fast).

---

## 5. Backend architecture (`EnzoBackend.gs`)

Single Apps Script file bound to the Google Sheet. Two HTTP entry points
that Apps Script Web Apps expose automatically:

- **`doGet(e)`** — reads. Query params: `token` (required), `action`
  (`all` default, or `online`). Assigns a fresh ID to any legacy row
  missing one, lazily, on read.
- **`doPost(e)`** — writes. JSON body with `action` one of
  `login | book | update | delete | online | complete`.

Every write (except `login`) requires a valid `token` (checked by
`authed()`) **and** requires the token's role to be allowed to perform that
`action` (checked by `allowed()` against the `CAN` table). This mirrors
`js/store.js`'s `can()` table so a hidden UI button can never be bypassed
by calling the API directly with curl/Postman.

**Concurrency:** `book`, `update`, and `complete` each take a
`LockService.getScriptLock()` (10-second timeout) around their
slot-availability check and the write that follows it, so two requests
arriving at the same instant can't both pass the check and double-book the
same date+slot. `delete` and `online` don't need a lock — they don't have a
uniqueness invariant to protect.

**Idempotency:** `complete` is designed to be safely retried (e.g. by a
flaky mobile connection retrying a timed-out request):
- The auto-generated follow-up appointment only gets created if
  `rowById(sheet, p.autoFollowUpId)` doesn't already exist — the client
  generates that ID once and sends the same one on retry.
- The auto-created Online Record only gets created if `onlineHasSource()`
  finds no existing row with that `Source Appt ID` (`p.id`).

### Column maps
`COL` and `COLO` are 0-based index maps into `sheet.getDataRange().getValues()`
rows — the backend's single source of truth for "what column is what". If
you ever add a column, add it to these maps and to the sheet header
comment at the top of the file; **never insert a column in the middle** of
either sheet (see [§6 Google Sheets architecture](#6-google-sheets-architecture)).

### Reminder trigger (`checkFollowUps`)
A separate function, not wired to `doGet`/`doPost` — meant to be attached
to a **time-driven trigger** (see Deployment Guide) that runs once a day.
It scans for appointments due today or needing a reminder call tomorrow,
builds a message, and sends it through whichever of email / WhatsApp
(CallMeBot) / Telegram is turned on in the `CFG` object at the top of the
reminder section. WhatsApp and Telegram are **off by default** and require
you to fill in real credentials (`apiKey`, bot `token`, `chatId`) before
enabling — see the Deployment Guide's troubleshooting section for what
happens if you enable them with placeholder values.

---

## 6. Google Sheets architecture

Three tabs, created automatically (`sheetOf()` inserts a sheet by name if
it doesn't exist yet — you never have to manually create the tabs, only
get their **column headers** right the first time you type into them
manually, see the Deployment Guide). `Patients` is new in Phase 3.

### `Appointments` — one row per appointment
| Col | Field | Notes |
|---|---|---|
| A | Name | |
| B | Phone | |
| C | Visit | legacy "visited on" date |
| D | Days | legacy medicine-duration number |
| E | Type | `Online` or anything else (treated as `Offline`) |
| F | Follow-up (legacy) | **formula**, `=C+D`, kept for old sheets/reports |
| G | Call (legacy) | **formula**, `=K-1` (or `F-1`), reminder-call date |
| H | Status (legacy) | old `"done"` flag, still checked by `checkFollowUps` |
| I | Notes (legacy) | |
| J | ID | stable app-generated ID, e.g. `a3f9c2d81b` |
| K | Appt Date | the actual scheduled appointment date |
| L | Slot | one of the 16 fixed time slots, or blank |
| M | Stage | `Scheduled \| Completed \| Cancelled \| NoShow` (blank = Scheduled) |
| N | Diagnosis | |
| O | Clinical Notes | |
| P | Medicine Duration | number of days |
| Q | Medicine Notes | |
| R | Follow-up Date | computed by the doctor's chip selection, editable |
| S | Outcome | mirrors Stage for Completed rows |
| T | Parent Appt ID | set only on an auto-generated follow-up row |
| U | Patient ID | **(Phase 3)** permanent link into `Patients`; resolved/written on every `book`/`complete`, and on `update` only if the client explicitly sends one |

Columns **A–L are the original, pre-Phase-1 schema** — untouched by the
Phase 1 upgrade. Columns **M–T were appended** by Phase 1, column **U by
Phase 3** — never inserted in the middle, so no existing formula or row
shifts. See `MIGRATION.md` (Phase 1) and `PATIENT-MASTER.md` (Phase 3) for
the exact backward-compatibility guarantees.

### `OnlineRecords` — one row per online-lead/consultation record
| Col | Field | Notes |
|---|---|---|
| A | Name | |
| B | Phone | |
| C | Place | |
| D | Consultation Date | |
| E | Referred By | free text; dashboard groups by this |
| F | Notes | |
| G | Source Appt ID | **blank** for manually entered records; set only when auto-created by `complete`, used to make that auto-creation idempotent |
| H | Patient ID | **(Phase 3)** permanent link into `Patients`; resolved/written on every `online` write |

### `Patients` — one row per patient, forever (Phase 3)
| Col | Field | Notes |
|---|---|---|
| A | Patient ID | permanent internal key, e.g. `pt3f9c2d81b2` — every other tab links to this, never shown to staff |
| B | OPD Number | e.g. `ENZO-000123` — sequential (`PATIENT_SEQ` Script Property), never reused, never edited; what staff actually see/search |
| C | Name | |
| D | Phone | |
| E | Gender | optional — no booking-form field writes this yet |
| F | DOB | optional — same as above |
| G | Address | optional |
| H | Email | optional |
| I | Created Date | |
| J | Updated Date | |
| K | Status | `Active` by default |
| L | Notes | optional |

New tab, new sheet, no pre-existing column layout to preserve — but the
**same append-only discipline** applies going forward: any future column
here is added after L, never inserted in the middle.

---

## 7. Authentication flow

1. Clinic staff enter a username/password on the login screen.
2. Frontend POSTs `{ action:'login', user, pass }` to the Apps Script Web App.
3. Backend looks up `USER_<user>` in Script Properties, hashes the supplied
   password with SHA-256, and compares. **Passwords are never stored in
   plaintext** — only their hash is ever persisted, and only in Script
   Properties (never in the Sheet).
4. On match: a random UUID token is minted (`Utilities.getUuid()`) and
   stored in `CacheService.getScriptCache()` as `tok_<uuid> → "<user>|<role>"`
   for `SESSION_SECS` (**6 hours**, `6 * 3600`). The token and the resolved
   role are returned to the frontend.
5. The frontend stores the token in memory only (`store.set({ token })`) —
   **it is never persisted to `localStorage`,** so a signed-in session does
   not survive a page reload; staff sign in again after a refresh or after
   the tab is closed. (The offline write *queue* is the only thing kept in
   `localStorage` — see §13.)
6. Every subsequent read (`doGet`) and write (`doPost`, except `login`
   itself) sends the token; the backend re-validates it against
   `CacheService` (`authed()`) on every single request — there is no
   session object beyond that cache entry, and it naturally expires after
   6 hours with no way to refresh it except logging in again.

**No CORS preflight, on purpose:** the frontend POSTs with no explicit
`Content-Type` header — the browser defaults a string body to
`text/plain`, which does not trigger a CORS preflight `OPTIONS` request.
Apps Script Web Apps don't handle preflight, so an explicit
`application/json` header would break every write. `doPost` parses
`e.postData.contents` as JSON regardless of the declared content type, so
this works. **Do not "fix" this by adding a `Content-Type: application/json`
header** — it will break logins and every write.

---

## 8. Role system

| Role | Frontend permissions (`store.js` → `can()`) | Backend allow-list (`EnzoBackend.gs` → `CAN`) |
|---|---|---|
| Receptionist | book, edit, cancel, search, print, call, whatsapp, viewTimeline | book, update, delete, online, all |
| Doctor | consult, complete, diagnosis, notes, viewTimeline, search | complete, online, all |
| Administrator | **everything**, including `dashboard` (absent from both other lists — Dashboard is Administrator-only) | book, update, delete, complete, online, all |

**How a role is assigned:** `EnzoBackend.gs`'s `login()` reads an optional
`ROLE_<username>` Script Property. **Any username without one defaults to
Administrator** — a deliberate choice so that pre-existing single
shared-login clinics are never locked out by adding this feature; you
explicitly *restrict* a user to Receptionist or Doctor, you don't have to
explicitly grant Administrator.

**Defense in depth — enforced twice:**
1. **UI layer** (`js/auth.js`'s `applyRoleGating`): any element with
   `data-perm="X"` in `index.html` is hidden (and disabled) unless
   `can('X')` is true. This is what a Receptionist actually sees.
2. **API layer** (`EnzoBackend.gs`'s `allowed()`): every write action is
   re-checked against the `CAN` table server-side. **A hidden button being
   absent from the DOM is not the security boundary — the server-side
   check is.** If you add a new permission, you must add it to *both*
   tables, or a restricted role could call the API directly (e.g. via
   browser devtools) and bypass a UI-only restriction.

**Demo mode role heuristic:** with no `WEB_APP_URL` configured,
`api.js`'s `demoRole(user)` guesses a role from the username substring
(`admin` → Administrator, starts with `dr`/contains `doctor` → Doctor,
anything else → Administrator) purely so the UI's role gating is
exercisable without a real backend. This heuristic **never runs** against
a configured production backend — production role assignment is 100%
server-side via `ROLE_<username>`.

---

## 9. Data flow

```
┌─────────────┐   POST /exec {action:'login',...}   ┌──────────────────┐
│   Browser    │ ───────────────────────────────────▶│  Apps Script      │
│  (frontend)  │◀─────────────────────────────────── │  Web App (/exec)  │
└──────┬───────┘   {ok, token, role}                 └─────────┬────────┘
       │                                                        │
       │ GET /exec?action=all&token=...                         │ reads/writes
       │ GET /exec?action=online&token=...                       ▼
       │ POST /exec {action:'book'|'update'|'delete'|            ┌──────────────┐
       │             'online'|'complete', token, ...}             │ Google Sheet │
       ▼                                                          │ Appointments │
  store.js (in-memory state)                                     │ OnlineRecords│
       │                                                          └──────────────┘
       ├─▶ renderAppts() / renderOnline() / renderDash() / timeline render
       │
       └─▶ localStorage (only for the offline write queue, `enzo_offline_queue_v1`)
```

The frontend never talks to the Sheet directly — the Apps Script Web App
is the only door in. There is no websocket/push channel: after the initial
load, the frontend only re-reads from the backend on a fresh sign-in
(no polling, no live sync between two staff devices open at the same time
beyond what the optimistic local updates already show each user).

---

## 10. Appointment workflow

```
  Book (Receptionist)
        │
        ▼
   Stage: Scheduled ──────────────► scheduledBucket(): upcoming | today | pending
        │
        │  Doctor opens "Complete consultation"
        ▼
  Outcome chosen:
    Completed ──▶ Stage: Completed
        │            + optional auto follow-up appointment (Stage: Scheduled, Parent Appt ID set)
        │            + if type=Online: auto Online Record (Source Appt ID set)
    Cancelled ──▶ Stage: Cancelled   (no automation fires)
    No show   ──▶ Stage: NoShow      (no automation fires)
```

- Editing and deleting are only available on **Scheduled** appointments
  (booking.js gates the Edit/Delete icons on `scheduled && can(...)`).
- A **Completed/Cancelled/NoShow** row can still be opened, but only in a
  **read-only view** of the consultation record (the eye/view icon instead
  of the pencil).
- Delete is soft-deleted client-side for 5 seconds (Undo toast) before the
  server-side delete actually fires — see `js/booking.js`'s `performDelete`.

## 11. Consultation workflow

See §3 above (`js/consultation.js`) for the full mechanics. In one
sentence: **the doctor never re-types
data reception already captured** — name, phone, and type carry forward
automatically into the auto-generated follow-up appointment and the
auto-generated online record.

## 12. Timeline workflow

Purely a **read/aggregation** view — see §3 above (`js/timeline.js`).
No dedicated backend endpoint; it re-uses `appts` and `onlineRecords`
already in the in-memory store, joined by phone number (falling back to
lowercased name if no phone is on file). This means the timeline is only
ever as fresh as the last full data load — it does **not** live-update
from another staff member's device without a fresh sign-in.

## 13. Offline queue

- Trigger: any `postAction()` call whose `fetch` throws (device has no
  network).
- Storage: `localStorage['enzo_offline_queue_v1']`, an array of
  `{ id, body, queuedAt }`.
- The **UI still proceeds optimistically** — the caller gets
  `{ ok:true, queued:true }` and the toast says "Saved offline — will sync…".
- Flush: triggered on the `window` `online` event and once right after
  sign-in (`maybeFlushQueue` in `app.js`), replaying queue items **in
  order**, stopping at the first failure (network still down, or the
  server rejects that specific write) so nothing is dropped or reordered.
- **Scope limitation, by design:** this is a *per-browser* queue. If the
  tab/browser is closed before the queue flushes, the queued writes sit in
  that device's `localStorage` until it's reopened there — this is **not**
  a cross-device sync queue. Two different staff devices booking offline
  at the same time do not see each other's queued writes until both sync.

## 14. Service Worker

`sw.js`, cache name `enzo-v6` (bump this string whenever the shell file
list changes, so returning users actually get the update — see the
Deployment Guide's cache-busting section).

- **Install:** caches every file in `SHELL` individually via
  `Promise.allSettled` so one missing/renamed asset doesn't fail the whole
  install.
- **Activate:** deletes every cache whose name isn't the current `CACHE`
  constant.
- **Fetch:**
  - Non-GET requests and cross-origin requests (i.e. calls to the Apps
    Script API) are **never intercepted** — the service worker only caches
    same-origin static assets, it does not cache or proxy API responses.
  - Navigations (`req.mode === 'navigate'`) try the network first, falling
    back to the cached `index.html` when offline (this is what lets the
    app *open* with no connection).
  - Everything else is cache-first, refreshing the cache in the background
    on a successful network hit.

## 15. PWA

`manifest.json` declares standalone display, portrait orientation, theme
color `#557B97`, and 192×192 / 512×512 maskable icons. Combined with the
service worker, this is what makes "Add to Home Screen" / "Install" work
on mobile and desktop — no native app store submission involved.

## 16. Google Sheet schema

See [§6](#6-google-sheets-architecture) above — the two tabs and their
exact column layouts. This is duplicated as a quick reference in the
Deployment Guide for people setting up a Sheet from scratch.

## 17. Apps Script endpoints

| Method | `action` | Auth required | Role check | Effect |
|---|---|---|---|---|
| POST | `login` | — | — | Validates credentials, mints a token |
| POST | `book` | token | `book` | Appends an Appointments row, `Stage=Scheduled` |
| POST | `update` | token | `update` | Rewrites name/phone/visit/days/type/date/slot on an existing row |
| POST | `delete` | token | `delete` | Deletes the Appointments row by ID |
| POST | `online` | token | `online` | Appends an OnlineRecords row; resolves/creates its Patient ID |
| POST | `createPatient` | token | `createPatient` | **(Phase 3)** Unconditionally appends a Patients row with the next OPD Number — no dedup check, that's the caller's decision (e.g. "Create new anyway") |
| POST | `complete` | token | `complete` | Writes Stage/Diagnosis/.../Outcome; may auto-create a follow-up appointment and/or online record; carries the source row's Patient ID onto both |
| GET | `all` (default) | token | `all` | Returns every Appointments row, shaped for the frontend; runs the one-time Patient ID migration first (see §24) |
| GET | `online` | token | `online` | Returns every OnlineRecords row |
| GET | `patients` | token | `patients` | **(Phase 3)** Returns every Patients row |

All responses are JSON via `ContentService`. Errors are always
`{ ok:false, error:'<reason>' }` with `error` one of: `bad request`,
`unauthorized`, `forbidden`, `busy` (lock timeout), `slot_taken`,
`not_found`, `unknown action`. A successful `book`/`online`/`complete`
also returns `patientId` — the identity the server actually resolved or
created, so the client never has to guess it.

## 18. Extension points

Deliberately left open by Phase 1's design so the next feature doesn't
require another foundation rewrite:

- **Billing/Payments** — hang off `stage === 'Completed'` appointments; add
  an `Invoices` sheet and a `billing.js` module following the existing
  module pattern (own concern, talks through `store.js`).
- **Prescriptions** — the consultation record already has
  Diagnosis/Medicine Duration/Medicine Notes columns; a structured
  prescription module can read/write alongside them without schema changes.
- **Inventory** — independent sheet + module; consultation medicine notes
  can later reference inventory items by name/ID.
- **Patient Portal** — ✅ Phase 3's Patient Master makes this
  straightforward now: every patient has a permanent Patient ID/OPD
  Number, so a read-only view behind separate patient authentication is a
  filtered read against `Patients`/`Appointments`/`OnlineRecords`, not an
  identity redesign.
- **Laboratory** — a new `stage` value, or a parallel `LabOrders` sheet,
  using the same append-only-column pattern as the Phase 1 migration.
- **WhatsApp Automation** — `checkFollowUps()` in `EnzoBackend.gs` already
  has a stubbed WhatsApp branch (CallMeBot); swap in a real
  provider/template without touching the rest of the backend.
- **Settings page** — the Administrator role already exists end-to-end; a
  Settings page just needs a nav entry gated the same declarative way
  (`data-perm="settings"` + add `settings` to the Administrator-only
  permission surface).

## 19. Developer rules / coding conventions

1. **No build step, no bundler, no `npm install`.** If a change requires
   one, it's the wrong change for this codebase's current phase — raise it
   as a separate architectural decision, don't slip it into a feature PR.
2. **One module, one concern.** New functionality gets its own `js/*.js`
   file unless it's a couple of lines that clearly belong to an existing
   module's responsibility.
3. **State goes through `store.js`.** No new top-level mutable globals in
   any module; no module reads another module's private variables.
4. **Escape everything user-entered before it hits `innerHTML`.** Use
   `escapeHtml()` from `core.js`. This project has fixed two stored-XSS
   holes already (Online records, patient names) — don't reintroduce one.
5. **Every write is enforced server-side, not just hidden in the UI.**
   If you gate a new button with `data-perm`, you must also add the
   matching check to `EnzoBackend.gs`'s `CAN` table. A UI-only restriction
   is not a restriction.
6. **Sheet columns are append-only.** Never insert a new column in the
   middle of `Appointments`, `OnlineRecords` or `Patients` — it will
   silently corrupt every existing formula and every row that predates the
   change. Add new fields as new columns at the end, update
   `COL`/`COLO`/`COLP` in `EnzoBackend.gs`, and treat a blank value in an
   old row as "not yet set" (the same pattern `Stage`, and now Patient ID,
   use).
6a. **Patient identity is the Patient ID, never name/phone text matching.**
   Every new module that touches patients (billing, prescriptions, a
   portal) must key off `patientId`, not re-derive identity by comparing
   name/phone strings — that is exactly the bug Phase 3 fixed.
7. **Bump the service worker cache name** (`sw.js`'s `CACHE` constant)
   whenever you add, remove, or rename a file in `SHELL`, or returning
   users will keep getting a stale shell.
8. **Retried writes must be idempotent** where the backend performs a side
   effect beyond the primary row update (see `complete`'s
   `autoFollowUpId`/`autoOnlineRecord` pattern) — the offline queue *will*
   retry, and a flaky connection *will* duplicate a naive fire-and-forget action.
9. **Demo data must never leak into a configured production session.**
   `genDemoAppts`/`genDemoOnline` are gated strictly on `!CONFIG.WEB_APP_URL`
   — don't add a fallback path that shows demo data when a real backend
   returns an empty or errored response; a genuinely empty clinic sheet
   must show a genuinely empty state.

## 20. Architecture decisions (and why)

| Decision | Rationale |
|---|---|
| No bundler/framework | Zero moving parts between "what's in git" and "what the browser runs"; a small clinic team can maintain this without dev tooling knowledge. |
| Google Sheets as the database | Staff already understand spreadsheets; no separate admin UI or backup tooling needed — Sheet version history and Drive backups are free. |
| Apps Script as the backend | Free hosting tied 1:1 to the Sheet, no server to patch/monitor, Google handles TLS/uptime. |
| Token in memory only, not `localStorage` | Limits the blast radius of an XSS bug or a shared/public device — a stolen token can't outlive the tab. |
| Client-generated IDs (`rid()`) sent to the server | Enables idempotent retries (offline queue, consultation automation) without a round trip to get an ID first. |
| Soft-delete with client-side Undo window | Staff mis-clicks are common in a busy reception workflow; a 5-second grace period avoids most "oops" support requests without adding a server-side recycle bin. |
| Role enforced both client and server | UI gating alone is trivially bypassed by calling the API directly; server enforcement is the real boundary, UI gating is the good user experience. |
| Timeline built client-side, no dedicated endpoint | Phase 1 scope discipline — the data needed already exists in loaded state; a dedicated endpoint would be premature for the current data volume. |

## 21. Future roadmap

See [§18 Extension points](#18-extension-points) for *how* to add each of
these without a rewrite. The explicit Phase 1 scope boundary (from the
README) is:

> Billing, Inventory, Prescriptions, Patient Portal, Laboratory, Payments
> and WhatsApp Automation are deliberately out of scope for Phase 1.

## 22. Known risks (carried over from README — read before extending)

- **Patient matching is phone-only (Phase 3).** Two patients can only be
  disambiguated automatically by phone number. A patient with no phone on
  file can never be auto-matched to a later visit; two different people
  who genuinely share one phone number will be treated as the same patient
  unless reception explicitly picks "Create new anyway". See
  `PATIENT-MASTER.md`.
- **Offline-created patients drift until the next sync (Phase 3).** A
  patient created while offline gets a temporary local ID and an
  "Pending sync" OPD Number immediately (so booking isn't blocked); the
  real, server-assigned OPD Number only appears after `maybeFlushQueue()`
  successfully re-fetches. If the same phone books again from a *different*
  device before that sync happens, the two devices can each create their
  own new patient for that phone — the offline queue is per-device, not a
  cross-device lock (this is the same class of risk as the pre-existing
  offline-queue limitation below, just applied to patient identity too).
- **Role model is coarse.** All signed-in roles can currently read the
  Patient Timeline, including diagnosis text — there is no per-field
  medical-record ACL. Acceptable for a small clinic with a shared-login
  model today; revisit before onboarding more staff or handling more
  sensitive data.
- **Offline queue is best-effort and per-device**, not a cross-device sync
  queue (see §13).
- **No optimistic-lock/merge on double-edits.** Two staff editing the same
  appointment simultaneously can race — the backend's `slotTaken` check
  only guards the time-slot column, not the rest of the row.
- **Legacy rows** (booked before Phase 1) have a blank `Stage` cell; the
  app treats blank as `Scheduled`. Confirmed intentional — see `MIGRATION.md`.

---

## 23. Phase 2 — Clinic Experience Improvements

Phase 2 adds six features without changing the Google Sheet schema, the
`WEB_APP_URL`, or any Phase 1 workflow. Everything is additive.

### 23.1 New modules

| File | Concern |
|---|---|
| `js/settings.js` | Clinic settings state, the **Dynamic Appointment Engine** (`generateSlots`), per-weekday capacity (`capacityForDay`), and the Settings page render/save. |
| `js/theme.js` | Light/dark theme, per-device, stored in `localStorage` and applied via `data-theme` on `<html>`. |

`js/core.js` gained `apptMatches(appt, query)` — the single global-search
matcher reused by `booking.js` and `timeline.js`.

### 23.2 Settings storage (no new sheet)

Clinic settings are one JSON blob in a **single Script Property**
(`APP_SETTINGS`), read via `doGet ?action=settings` and written via
`doPost {action:'saveSettings'}`. A blank/missing property means "use
defaults", so an un-upgraded deployment behaves exactly as in Phase 1. The
client keeps a `localStorage` mirror (`enzo_settings_v1`) so the booking form
can generate slots offline and before the first network load.

Settings shape (JS `getDay()` weekday keys, 0=Sun…6=Sat):

```json
{
  "openTime": "09:00", "closeTime": "20:00", "slotDuration": 30,
  "breaks": [{ "start": "13:00", "end": "16:00" }],
  "maxPerDay": 40,
  "capacity": { "0": 0, "1": 40, "2": 40, "3": 40, "4": 40, "5": 40, "6": 20 },
  "notifications": { "emailReminders": true }
}
```

### 23.3 Dynamic Appointment Engine

`generateSlots(settings)` builds the `HH:MM` slot list from open/close time,
stepping by `slotDuration` and skipping any slot overlapping a break window.
The Phase-1 hardcoded `SLOTS` constant is retained in `core.js` only as a
legacy fallback; booking no longer imports it. The **default** settings
reproduce the old 09:00–12:30 / 16:00–19:30 half-hour schedule exactly.

### 23.4 Capacity enforcement (defence in depth)

Per-weekday limits are checked client-side in `booking.js` (fast feedback,
disabled slots) **and** server-side in `EnzoBackend.gs` `dayIsFull()` on
`book`, returning `error:'day_full'` — so the cap cannot be bypassed via the
API. A capacity of 0 = closed day. Missing capacity falls back to
`maxPerDay`, and a missing `maxPerDay` = no limit.

### 23.5 Permissions

`saveSettings` is Administrator-only in **both** the client `can()` table and
the backend `CAN` table. Reading settings (`settings`) is allowed for all
roles because the booking form needs the slot/capacity config. The Settings
**page** is gated with `data-perm="settings"`, which only the Administrator
passes.

### 23.6 Theme

Theme is deliberately **per-device**, not part of the shared settings blob —
the doctor's phone and reception's desktop keep independent preferences. An
inline `<head>` script applies the saved theme before first paint to avoid a
flash; `theme.js` then keeps "system" mode live via a `matchMedia` listener.
All colour work is a single `[data-theme="dark"]` override block in
`app.css` — no markup or component changes.

---

## 24. Phase 3 — Patient Master + Unique Patient ID + Timeline Foundation

Phase 3 replaces name/phone-guessing patient grouping with one permanent
identity per patient. One new sheet tab (`Patients`), one new column each
on `Appointments` (U) and `OnlineRecords` (H), no other schema change, no
`WEB_APP_URL` change.

### 24.1 New module

`js/patients.js` — see [§3](#3-module-responsibilities) above for the full
export list. It is the single place that answers "which patient does this
record belong to" on the frontend; every other Phase 3 change (booking's
duplicate card, the Online Records/Timeline/Dashboard search boxes) is a
thin consumer of it.

### 24.2 Identity model

- **Patient ID** (`pt...`) — permanent, internal, generated once
  (`Utilities.getUuid().slice(0,10)` prefixed `pt`), never shown to staff.
- **OPD Number** (`ENZO-000123`) — sequential, generated from a single
  Script Property counter (`PATIENT_SEQ`), incremented under the script
  lock so two simultaneous bookings can never be allocated the same
  number. Never reused (even if a patient row is later deleted by hand —
  don't do that; deactivate via `Status` instead), never edited by the app.
- Matching is **exact-phone only** (`normPhone()` — digits only, last 10
  kept, mirrored identically in `EnzoBackend.gs` and `js/core.js`). Name is
  never used to merge two different phone numbers into one patient — that
  would risk silently merging two different people.

### 24.3 Where identity gets resolved

| Situation | What resolves the Patient ID |
|---|---|
| Booking, phone matches a known patient, no explicit choice | Client defaults to that match (`saveAppt` in `booking.js`) — the safe default is always "reuse", never "create a duplicate" |
| Booking, reception picks "Use existing" | Same — explicit confirmation of the client-detected match |
| Booking, reception picks "Create new anyway" | Client calls `createPatient` (unconditional, no dedup) before booking |
| Booking, no match found at all | Client calls `createPatient` before booking — the OPD Number exists before the appointment does, per the required flow |
| Editing an existing appointment | Never re-resolved — carries the appointment's existing `patientId` through unchanged |
| Online record save | Server resolves it (`p.patientId \|\| findOrCreatePatient(...)`) — no UI prompt on this page, matching its always-been-lightweight design |
| `complete` (auto follow-up / auto online record) | The source appointment's own `patientId` (resolving it first if a legacy pre-migration row somehow still lacks one) |
| Any write missing a `patientId` (older client, direct API call) | Backend's `book`/`online`/`complete` all fall back to `findOrCreatePatient(name, phone)` — nothing is ever left unlinked |

### 24.4 Migration — safe, automatic, runs once

`EnzoBackend.gs`'s `ensureMigrated()` is called at the top of every `doGet`
for `all`/`online`/`patients`. It checks one Script Property flag
(`PATIENTS_MIGRATED_V1`); if unset, it takes the script lock, re-checks the
flag (avoids a double-run race between two simultaneous requests), and
calls `ensurePatientLinks()`:

1. Reads the whole `Patients` sheet once into a `phone → patientId` map.
2. Scans `Appointments` once; any row with a blank Patient ID is matched
   against that map (or a new patient is queued if no match), collecting
   the *entire* column's new values into one in-memory array.
3. Same for `OnlineRecords`.
4. Writes each column back in **at most three `setValues()` calls total**
   (one per sheet, plus one append for all newly-created patients) — not
   one write per row. This is what keeps the one-time migration fast even
   at thousands of existing rows, and it's also why the routine is safe to
   call from a read path: worst case, it does real work exactly once, ever.
5. Sets the flag. Every request after that is just map lookups — no writes.

No existing cell is ever rewritten by this process; it only fills in the
previously-blank Patient ID column.

### 24.5 Duplicate detection UI (`booking.js`)

A debounced (250ms) listener on `#phone` calls `findPatientByPhone()`. A
match renders `#dupCard` (OPD, name, last visit + last diagnosis via
`patientSummary()`, a "View timeline →" link, and the two decision
buttons); the name field is auto-filled from the match if it's still
empty. Either button collapses the card to a small `#dupChip` reflecting
the decision, clickable to reopen. The whole thing is suppressed while
`store.editingId` is set — editing never re-runs detection. (A CSS note
for anyone touching this: `#dupChip`'s base class sets `display:
inline-flex`, so it needs its own `.dupchip[hidden]{display:none}` rule —
an author-stylesheet `display` declaration otherwise beats the browser's
default `[hidden]{display:none}` at equal specificity. `.editbanner` has
the same guard for the same reason; follow that pattern for any new
element that both sets its own `display` and gets toggled via `hidden`.)

### 24.6 Search, unified

`patients.js`'s `patientMatches()` / `apptSearchMatches()` /
`onlineSearchMatches()` are the *only* place search rules live. Booking,
Online Records, the Dashboard's quick-search, and the Timeline all call
into the same functions rather than each re-implementing "does this query
match this record" — the explicit goal (per the Phase 3 brief) of "one
global search, works everywhere, no fake search."

### 24.7 Performance

- **No O(n²) loops.** Any operation that scans *many* patients (Timeline
  search, Dashboard quick search) builds one `indexApptsByPatient()` `Map`
  first (O(appointments)), then does O(1) lookups per patient — never
  re-filters the full appointments array once per candidate patient.
- The migration's three-batched-write design (§24.4) keeps the one-time
  backfill fast regardless of row count, and every request after it is
  pure in-memory map lookups.
- Search itself is a client-side array filter over data already in memory
  (loaded once at login) — no network round trip per keystroke, which is
  what keeps typing in any of the search boxes feeling instant.

### 24.8 What Phase 3 deliberately did not add

- No **Doctor** field anywhere in the schema — the app has no
  multi-doctor/per-appointment-doctor concept today, so the "Doctor" line
  mentioned in some duplicate-detection mockups is omitted rather than
  half-built.
- No dedicated "Edit patient" screen/endpoint — Gender/DOB/Address/Email
  exist as `Patients` columns for a future module to use, but nothing in
  today's UI collects or edits them (the booking form still only asks for
  Name/Phone, unchanged). Editing those fields today means editing the
  `Patients` sheet directly.
- No cross-device offline reconciliation for patient identity beyond what
  §24.2's known risk already describes — that would be a genuinely new
  piece of sync infrastructure, out of scope for "lay the identity
  foundation."
