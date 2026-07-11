# Enzo Homoeo Medical Centre — Clinic App

A no-build, installable PWA for booking appointments, running consultations
and tracking patients, backed by a Google Sheet through a Google Apps
Script web app. Static files only — deployable straight from GitHub Pages.

**Phase 3 — Patient Master + Unique Patient ID + Timeline Foundation** (on
top of Phase 2 — Clinic Experience Improvements, and Phase 1 — Foundation +
Workflow). Phase 3 gives every patient one permanent identity — an OPD
Number issued by the clinic's own external OPD numbering system, plus an
internal Patient ID never shown to staff — so repeat visits, the
Timeline, and future modules (billing, prescriptions,
investigations, a patient portal) never split one person's history across
two records again. See [docs/PATIENT-MASTER.md](docs/PATIENT-MASTER.md)
for the full plain-English explanation. Billing, Inventory, Prescriptions,
Patient Portal, Laboratory, Payments and WhatsApp Automation remain out of
scope — see [Future extension points](#future-extension-points).

## What it does

- **Reception** books an appointment (name, phone, type, date, time slot).
  Typing a phone number that's been seen before shows a **Returning
  Patient** card (OPD Number, name, last visit, last diagnosis) with **Use
  existing** / **Create new anyway** — no accidental duplicate patients.
- The **doctor** opens **Complete Consultation** on the day, records
  diagnosis/notes/medicine duration, and the app auto-calculates the
  follow-up date, auto-books the follow-up appointment, and — for Online
  consultations — auto-creates the Online Record. Nobody re-types data.
- Appointments live in two views: **Scheduled** (Upcoming / Today /
  Pending) and **Completed** (Completed / Cancelled / No-show).
- **Patient Timeline** — search by OPD Number, Patient ID, name, phone,
  diagnosis or notes; selecting a patient shows a Patient Profile card
  (OPD, Name, Phone, Age, Gender, Visit Count, Last Visit) followed by
  every appointment, online consultation, diagnosis, medicine and
  follow-up entry, newest first.
- **Dashboard** shows KPIs, trend and weekday charts, a referred-by
  breakdown with CSV export, and a quick patient search that jumps
  straight to a patient's Timeline.
- Works offline: the shell is cached by a service worker, and writes made
  while offline are queued locally and synced automatically once the
  connection returns.
- Three roles — **Receptionist**, **Doctor**, **Administrator** — gate what
  each signed-in user can do in the UI (see [Roles](#roles)).

**Phase 3 additions:**

- **Patient Master** — a new `Patients` Google Sheet tab, one row per
  patient, forever. Every Appointment/OnlineRecord links to it by a
  permanent Patient ID.
- **Unique OPD Number** — issued by the clinic's external OPD numbering
  system (this app never generates one itself), never edited, shown and
  searchable everywhere. If that system is unreachable, patient creation
  stops with a clear error rather than proceeding without an OPD Number.
- **Duplicate detection at booking** — matches by phone; reception chooses
  "Use existing" or "Create new anyway"; the safe default (no explicit
  choice) is always to reuse the match.
- **Timeline rebuilt** on permanent Patient ID instead of guessing from
  name/phone — a changed phone number or a shortened name never splits a
  patient's history again.
- **One global search** (Patient ID / OPD / name / phone / diagnosis /
  notes) reused identically across Booking, Online Records, the Dashboard
  and the Timeline.
- **Safe, self-healing migration** — existing appointments/online records
  without a Patient ID are linked automatically (matched by phone) the
  first time the app is opened after the upgrade. No manual step, no data
  loss. See [docs/PATIENT-MASTER.md](docs/PATIENT-MASTER.md).

**Phase 2 additions (still in place):**

- **Dynamic Appointment Engine** — time slots are generated from
  administrator-configured opening/closing times, breaks and slot duration.
  No hardcoded slot list. Defaults reproduce the previous schedule exactly.
- **Appointment capacity** — per-weekday booking limits (and a default
  max/day); a day set to 0 is treated as closed. Enforced in the UI **and**
  server-side.
- **Appointment cards** show Online / In-clinic / Follow-up (and Emergency,
  future-ready) at a glance, without opening the appointment.
- **Light / Dark theme** — per-device, remembered, applied before first
  paint; no UI redesign.
- **Settings module** (Administrator only) — one place for clinic timings,
  booking capacity, theme and notifications. Stored in a single Apps Script
  property; no Google Sheet change.

## Architecture

No bundler, no build step — plain ES modules loaded by the browser.

```
index.html            markup only
css/app.css            all styles (unchanged visuals/branding from before Phase 1)
js/
  core.js              DOM/date/format helpers, escapeHtml, constants — no state
  store.js              central state (pub/sub) + role permission table
  api.js                backend calls, offline write queue, demo-data generator
  workflow.js           appointment shaping, Scheduled/Completed bucketing, follow-up calc
  ui.js                 toast, confirm dialog, overlay open/close
  auth.js                login/logout, declarative role gating ([data-perm])
  booking.js             booking form + appointment list (Scheduled/Completed)
  consultation.js       Complete Consultation modal + automation
  online.js              Online records page
  dashboard.js           KPIs + charts + referred-by breakdown + quick patient search
  patients.js             (Phase 3) Patient Master — identity, duplicate lookup, search index
  timeline.js             patient timeline
  reminders.js           bell / "today" modal
  settings.js            (Phase 2) clinic settings + slot generation + capacity
  theme.js               (Phase 2) light/dark theme (per-device)
  app.js                  bootstrap — the only script index.html loads
EnzoBackend.gs          Google Apps Script backend (Sheet-backed API)
sw.js                   service worker (offline app-shell cache)
manifest.json           PWA manifest
assets/                 logos, icons
docs/                   migration / testing / deployment / rollback guides
```

Each module owns one concern and talks to the others only through
`store.js` (state) or small exported functions — no scattered globals.

## Roles

| Role | Can |
|---|---|
| Receptionist | Book, Edit, Cancel, Search, Print, Call, WhatsApp, view Timeline |
| Doctor | Consult, Complete consultation, Diagnosis, Notes, view Timeline, Search |
| Administrator | Everything, incl. Dashboard and **Settings** |

Reception and Doctor can *read* clinic settings (the booking form needs the
slot/capacity config) but only the Administrator sees the Settings page and
can *save* changes — enforced both in the UI and in `EnzoBackend.gs`.

Roles come from `EnzoBackend.gs`'s `login()`, driven by an optional
`ROLE_<username>` Script Property. **Any user without one defaults to
Administrator** — existing single shared logins are never locked out by
this feature. In demo mode (no `WEB_APP_URL` configured) the role is
guessed from the username (`admin`/`doctor` substrings) for exercising the
UI without a backend.

## Setup

1. Open the Google Sheet, extension → Apps Script, paste in
   `EnzoBackend.gs`. A `Patients` tab is created automatically the first
   time the app runs — nothing to create by hand.
2. Run `setCredentials()` once (edit the usernames/passwords/roles first),
   then delete or comment it out.
2a. Run `setOpdProviderConfig()` once (edit `OPD_PROVIDER_URL` — and
   `OPD_PROVIDER_METHOD`/`OPD_PROVIDER_API_KEY` if needed — to point at the
   clinic's external OPD numbering system), then delete or comment it out.
   Required before any patient can be created — see
   `docs/PATIENT-MASTER.md`.
3. Deploy → New deployment → Web app, execute as yourself, access "Anyone".
4. Copy the deployment URL into `CONFIG.WEB_APP_URL` in `js/api.js`.
5. (Optional) Add a time-driven trigger on `checkFollowUps` for daily
   reminders.
6. Serve the repo root as static files (GitHub Pages, or `npx serve` /
   `python3 -m http.server` locally — the app must be served over
   http(s), not opened as a `file://` URL, for ES modules and the service
   worker to work).

See `docs/DEPLOYMENT.md` for the full walkthrough.

## Docs

- [docs/PATIENT-MASTER.md](docs/PATIENT-MASTER.md) — **Phase 3**: what the Patient Master is, duplicate detection, migration, in plain English
- [docs/INSTALLATION-GUIDE.md](docs/INSTALLATION-GUIDE.md) — beginner install/upgrade, step by step
- [docs/MIGRATION.md](docs/MIGRATION.md) — upgrading an existing production sheet/site to Phase 1
- [docs/TESTING.md](docs/TESTING.md) — manual testing checklist
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deploying from scratch
- [docs/ROLLBACK.md](docs/ROLLBACK.md) — reverting if something goes wrong

## Future extension points

Phase 1 intentionally leaves room to plug in, without another foundation
rewrite:

- **Billing/Payments** — hang off `stage === 'Completed'` appointments;
  add an `Invoices` sheet and a `billing.js` module.
- **Prescriptions** — the consultation record already has
  Diagnosis/Medicine Duration/Medicine Notes columns; a structured
  prescription module can read/write alongside them.
- **Inventory** — independent module + sheet; consultation medicine notes
  can later reference inventory items.
- **Patient Portal** — ✅ enabled by Phase 3's Patient Master: every
  patient now has a permanent Patient ID/OPD Number, so a read-only
  portal view behind patient auth is a straightforward read against the
  same `Patients`/`Appointments`/`OnlineRecords` tabs — no identity rework
  needed.
- **Laboratory** — a new `stage` value or a parallel `LabOrders` sheet,
  same append-only-column pattern used for the consultation fields.
- **WhatsApp Automation** — `checkFollowUps()` in `EnzoBackend.gs` already
  has a stubbed-out WhatsApp branch (CallMeBot); swap in a real
  provider/template without touching the rest of the backend.
- **Settings** — ✅ delivered in Phase 2 (`settings.js`, Administrator-only,
  stored in a Script Property). New settings can be added to the same blob
  and page without any Google Sheet change.

## Known risks

- **Patient matching is phone-only.** Two patients can only be told apart
  automatically by phone number. A patient with no phone on file, or two
  different people who genuinely share one phone, can't be disambiguated
  automatically — reception must use "Create new anyway" deliberately for
  the latter. See `docs/PATIENT-MASTER.md`.
- **Role model is coarse.** All signed-in roles can currently read the
  Patient Timeline (including diagnosis text) — there is no per-field
  medical-record ACL yet. Acceptable for a small clinic with a shared
  login model today; revisit before onboarding more staff.
- **Offline queue is best-effort.** Queued writes retry in order on
  reconnect, but if the tab is closed before syncing, queued items stay in
  that browser's `localStorage` until reopened there. It is not a
  cross-device sync queue.
- **No optimistic-lock/merge on double-edits.** Two staff editing the same
  appointment at the same time can still race, same as before Phase 1 —
  the sheet's `slotTaken` check only guards the time-slot, not the rest of
  the row.
- **Legacy rows** (booked before Phase 1) have a blank `Stage` cell; the
  app treats blank as `Scheduled`. Confirm this is what you want before
  going live — see `docs/MIGRATION.md`.
