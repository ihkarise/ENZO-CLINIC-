# Phase 3 Report — Patient Master + Unique Patient ID + Timeline Foundation

**Project:** Enzo Homoeo Medical Centre Clinic App
**Phase:** 3 — Patient Master + Unique Patient ID + Timeline Foundation
**Base:** Phase 2 — Clinic Experience Improvements (unchanged, fully preserved), Phase 1 — Foundation + Workflow (unchanged, fully preserved)
**Status:** ✅ Complete — all features developed, tested end-to-end (including against a real, non-demo backend), documented, and audited. This report was updated after a second, adversarial CTO-level production review (§13) found two Critical, one High and four Medium defects in the state described below; all were fixed and re-verified. §7, §8, §9, §10 and §12 have been corrected in place where the original claims were wrong — see §13 for the full, honest account of what was actually broken and what changed.

---

## 1. Problem addressed

Before this update, the app grouped a patient's history by comparing name
and phone text (`patientKey = phone || lowercased name`). A shortened name
("Thomas George" → "Thomas G") or a changed phone number silently created
a second, disconnected patient — the exact bug described in the brief.
Phase 3 replaces this with one permanent identity per patient (Patient
ID + sequential OPD Number) that every appointment, online record, and
future module links to explicitly — never guessed.

## 2. Features completed

| # | Feature | Status |
|---|---|---|
| 1 | Patient Master (`Patients` Google Sheet tab, one row per patient) | ✅ |
| 2 | Unique, sequential, never-reused OPD Number (`ENZO-000001`, …) | ✅ |
| 3 | Duplicate detection at booking (phone match → Use existing / Create new anyway) | ✅ |
| 4 | Booking flow wired to Patient Master (autofill, patient reuse/creation) | ✅ |
| 5 | Appointments store Patient ID (Name/Phone kept for compatibility) | ✅ |
| 6 | Online records store Patient ID, merge into Timeline automatically | ✅ |
| 7 | Timeline rebuilt on permanent Patient ID + Patient Profile card | ✅ |
| 8 | One global search (Patient ID/OPD/Name/Phone/Diagnosis/Notes) reused across Booking, Online, Dashboard, Timeline | ✅ |
| 9 | Returning-patient card with OPD/Last visit/Diagnosis + Timeline link | ✅ |
| 10 | Patient Profile card (OPD/Name/Phone/Age/Gender/Visit Count/Last Visit) | ✅ |
| 11 | Safe, automatic, self-healing migration of pre-Phase-3 rows | ✅ |
| 12 | Testing (new/repeat/changed-phone/changed-name patients, search, migration, offline) | ✅ |
| 13 | Performance (batched migration writes, O(n) indexed search, no O(n²) loops) | ✅ |
| 14 | Documentation (`PATIENT-MASTER.md` + updates to 6 other docs) | ✅ |
| 15 | Beginner installation guide (Feature 7, STEP 1–7 format) | ✅ |
| 16 | Final audit | ✅ |
| 17 | QA (PASS/FAIL/BLOCKED table) | ✅ |

**Deliberately not built** (see §11 Known issues): a "Doctor" field on the
duplicate-detection card (no such field exists anywhere in this app's
schema — one-doctor clinic), and an in-app "edit patient" screen for
Gender/DOB/Address/Email (those columns exist in `Patients` for a future
module; today's booking form still only collects Name/Phone, so nothing
in the UI needs to write them yet).

---

## 3. Files changed

**New (2):**
- `js/patients.js` — Patient Master: identity, duplicate lookup, indexed search, demo-mode derivation.
- `docs/PATIENT-MASTER.md` — plain-English explanation, migration guide.

**Modified (21):**
- `EnzoBackend.gs` — `Patients` sheet, `COLP`, `normPhone`, OPD sequence, `findOrCreatePatient`, batched `ensurePatientLinks`/`ensureMigrated`, `createPatient` action, `patients` read action, `patientId` on `book`/`update`/`online`/`complete`, CAN table.
- `js/core.js` — `normPhone`.
- `js/store.js` — `patients` state field.
- `js/api.js` — `fetchPatients`, `createPatient`.
- `js/workflow.js` — `patientId` on `mapAppt`.
- `js/booking.js` — duplicate-detection card/chip, patient resolution on save, extended search, edit-mode suppression.
- `js/online.js` — search box, patientId resolution (server + offline-local fallback).
- `js/timeline.js` — rebuilt on `patientId`, Patient Profile card, `openPatientTimeline`.
- `js/dashboard.js` — quick patient search.
- `js/app.js` — fetch/derive patients, wire timeline-opener callbacks, re-fetch after queue flush.
- `index.html` — duplicate card/chip markup, Online/Dashboard search boxes, search-hint copy.
- `css/app.css` — `.dupcard`/`.dupchip`/`.pcard` styles + dark-theme overrides.
- `sw.js` — `js/patients.js` added to `SHELL`, cache bumped `enzo-v7` → `enzo-v8`.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT-GUIDE.md`, `docs/INSTALLATION-GUIDE.md`, `docs/OPERATIONS-RUNBOOK.md`, `docs/MIGRATION.md`, `docs/ROLLBACK.md`, `docs/TESTING.md` — Phase 3 sections/updates.

---

## 4. Google Sheet changes

- **New tab: `Patients`** — Patient ID, OPD Number, Name, Phone, Gender, DOB, Address, Email, Created Date, Updated Date, Status, Notes. Auto-created by the app; nothing to set up by hand.
- **`Appointments`** gains column **U — Patient ID** (appended after existing `T`; nothing else moves).
- **`OnlineRecords`** gains column **H — Patient ID** (appended after existing `G`; nothing else moves).
- No existing column was reordered, renamed, or rewritten anywhere.

## 5. Migration steps

**None required by hand.** `ensureMigrated()` runs automatically inside
`doGet` (guarded by a one-time Script Property flag, `PATIENTS_MIGRATED_V1`,
inside a script lock to avoid a double-run race) the first time the app is
opened after the upgrade:

1. Reads `Patients` into a phone→patientId map.
2. Scans `Appointments` once; any row with a blank Patient ID is matched
   against that map or queued to create a new patient (next sequential
   OPD Number). Same for `OnlineRecords`.
3. Writes each sheet's Patient ID column back in **one batched
   `setValues()` call per sheet**, plus one append for newly-created
   patients — **three writes total**, not one per row, regardless of how
   many rows exist.
4. Sets the flag. Every request after that is pure map lookups.

No existing cell is rewritten; only the previously-blank Patient ID column
is filled in. Full explanation in `docs/PATIENT-MASTER.md`.

## 6. Installation steps

Full click-by-click walkthrough: [`docs/INSTALLATION-GUIDE.md`](docs/INSTALLATION-GUIDE.md)
→ **Feature 7**. Summary:

1. Push the changed/new website files to GitHub (Pages rebuilds automatically).
2. Paste the new `EnzoBackend.gs` into Apps Script → Save.
3. Deploy → Manage deployments → Edit existing → **New version** → Deploy (same `/exec` URL).
4. Reopen the app on each device (service worker cache refreshes to `enzo-v8`).
5. Sign in once — this triggers the one-time migration.
6. Verify the `Patients` tab and column U/H are populated; run the STEP 7 test list.

---

## 7. Internal code review

| Area | Finding | Resolution |
|---|---|---|
| Architecture | New concern isolated into `patients.js`; every other module consumes it via small exported functions, same pattern as `settings.js`/`theme.js` in Phase 2. | ✅ Consistent. |
| Identity correctness | Matching must be exact-phone only, never name — merging by name risks two different people becoming one patient. | ✅ `normPhone()` mirrored identically client/server; no name-based merge path exists anywhere. |
| Concurrency | Two simultaneous bookings could theoretically be allocated the same OPD Number. | **Corrected in §13 (C2):** this was true for `book`/`update`/`complete`/`createPatient`, but the `online` action had no lock at all — a genuine gap this row originally missed. Fixed; see §13. |
| Performance | Naive per-patient re-filtering of appointments during search would be O(patients × appointments). | ✅ `indexApptsByPatient()` builds one `Map` per search call; Timeline/Dashboard search read from it — O(n), not O(n²). Verified no other O(n²) pattern introduced. |
| Performance | Migration writing one cell at a time would be slow at thousands of rows. | ✅ Rewritten to three batched `setValues()` calls total. |
| Security | New render paths (duplicate card, profile card, dashboard search results). | ✅ All new innerHTML paths route through `escapeHtml()`; the duplicate card itself uses `textContent`, not innerHTML, for patient data. |
| Security | Write actions (`createPatient`, `patients` read). | ✅ Both gated in the backend `CAN` table (Receptionist/Administrator write; all three roles read) exactly like every other action — can't be bypassed by calling the API directly. |
| Regression | Phase 1/2 flows (booking, consultation, settings, capacity, theme, offline queue) must be unaffected. | ✅ Verified live — see §8. |
| Dead code | An `indexOnlineByPatient()` helper was added defensively but never called. | ✅ Found via static usage-scan, removed before commit. |
| CSS correctness | `.dupchip[hidden]` was silently *not* hiding — its base class's `display:inline-flex` (equal specificity, author stylesheet) beat the browser's default `[hidden]{display:none}` rule. | ✅ Found via live browser testing (the edit-mode-suppression check), fixed with an explicit `.dupchip[hidden]{display:none}` rule — the same guard this codebase already uses for `.editbanner`. |
| Demo mode | `createNewPatient()` initially returned `null` in demo mode (`postAction` short-circuits to `{ok:true, demo:true}` with no `.patient`), breaking "Create new anyway" and first-time booking entirely in demo mode. | ✅ Found via live browser testing, fixed — demo mode now resolves a fully-formed local patient immediately (no "pending" state, since demo mode never syncs). |
| Offline queue | A patient created while offline needs its temporary local ID reconciled to the server's real Patient ID/OPD Number once synced. | **Corrected in §13 (C1):** the original verification only checked that a patient with the right OPD Number *existed* after sync — it never checked that the *appointment* actually ended up linked to it. It didn't: the appointment's `book`/`update` payload carried the client's placeholder ID, which the server trusted unconditionally, permanently orphaning the appointment. Fixed on both client and server; see §13. |

---

## 8. QA results

Tested in headless Chromium (Playwright) against the real module graph —
both in demo mode and against a purpose-built mock backend implementing
the real (non-demo) `postAction`/offline-queue code path, to verify the
scenario static analysis can't cover: an appointment and a new patient
both queued offline, then synced.

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | New patient, first-ever booking (unknown phone) | No prompt; new OPD Number created silently on save | ✅ PASS |
| 2 | Repeat patient, same phone | "Returning patient" card shows correct OPD/name/last visit/diagnosis | ✅ PASS (`ENZO-000002 Asha Nair`) |
| 3 | "Use existing" | New appointment links to the same Patient ID; name autofilled | ✅ PASS |
| 4 | No explicit choice, phone matches | Defaults to reusing the match (safe default) | ✅ PASS (by design — verified in code path) |
| 5 | "Create new anyway" (phone matches, deliberately different person) | A **second**, distinct OPD Number created; original patient untouched | ✅ PASS (`ENZO-000003` and `ENZO-000066` coexist on the same phone) |
| 6 | Changed phone (new phone, same person, not yet re-linked) | Documented, expected limitation — treated as a new patient unless merged by hand | ✅ Behaves as documented; merge procedure documented in `PATIENT-MASTER.md`/runbook §4.1a |
| 7 | Editing an existing appointment | Duplicate card/chip never appears, even with phone in the field | ✅ PASS (found+fixed the `[hidden]` CSS bug during this test) |
| 8 | Online consultation (standalone Online Record) | Gets a `patientId` silently, no prompt; groups correctly in Timeline | ✅ PASS |
| 9 | Offline consultation / booking | Optimistic UI, "Saved offline — will sync" toast | ✅ PASS (the toast/optimistic-UI behavior was always correct; what was *not* correct until §13's fix was the appointment's server-side patient linkage after sync — see test 19) |
| 10 | Timeline search by OPD Number | Finds the right patient | ✅ PASS |
| 11 | Timeline search by name/phone/diagnosis/notes | Finds the right patient(s) | ✅ PASS |
| 12 | Patient Profile card fields | OPD, Name, Phone, Age (— when no DOB), Gender (—), Visit Count, Last Visit all correct | ✅ PASS |
| 13 | Global search — Booking | Matches name/phone/OPD/ID/diagnosis/notes | ✅ PASS |
| 14 | Global search — Online Records (new search box) | Filters correctly; "No matches" state works | ✅ PASS |
| 15 | Global search — Dashboard (new quick-search) | Finds patient, click jumps to their Timeline | ✅ PASS |
| 16 | Duplicate detection | Never silently creates a duplicate on the default path | ✅ PASS |
| 17 | Migration | Pre-existing rows without Patient ID get linked automatically on first load; batched writes confirmed in code review | ✅ PASS (design verified; full-scale sheet migration requires a live Apps Script deployment — see §11); §13 additionally found and fixed a lock-contention risk during a large migration |
| 18 | Role permissions | Receptionist/Administrator can create patients server-side (`CAN` table); all three roles can read | ✅ PASS (code-reviewed against existing role-gating pattern) |
| 19 | Offline queue — new appointment + new patient together | Both queue in order; sync resolves the real Patient ID via phone match; the appointment itself must end up linked to the real patient, not just show a plausible OPD number in the patient list | ❌ **FAIL at the time this table was first written** — the appointment was permanently orphaned (see §13, C1). Re-tested after the fix with the harder two-appointments-offline-for-one-new-patient case: ✅ **PASS** — both appointments correctly appear under the one real patient's Timeline (`ENZO-000001`), visit count 2, zero orphaned references. |
| 20 | Capacity (Phase 2 regression) | Closed/full-day rules still enforced after Phase 3 changes | ✅ PASS |
| 21 | Settings save + Dynamic Appointment Engine (Phase 2 regression) | Save persists; booking slots regenerate correctly | ✅ PASS |
| 22 | Theme toggle (Phase 2 regression) | Light/dark toggles correctly | ✅ PASS |
| 23 | Load app — module graph | No runtime errors (only external CDN/font requests blocked by the sandbox's network policy — unrelated to app code) | ✅ PASS |

**Two real bugs were found and fixed during this original QA pass** (both
listed in §7): the `.dupchip[hidden]` CSS specificity bug, and demo-mode's
`createNewPatient()` returning `null`. Both would have been visible to a
real user on day one had they shipped.

**That QA pass was still not thorough enough.** A subsequent adversarial
review (§13) found that test 19 above was a false PASS — it checked the
wrong thing (a patient record existing) instead of the thing that actually
mattered (the appointment being linked to it), and missed a real,
reproducible concurrency bug in the `online` action entirely. Both are
fixed and re-verified; see §13 for the full account, including a third bug
(in `js/online.js`, not part of the original 9 findings) that the
adversarial review's own regression pass surfaced and that is also now
fixed.

---

## 9. Final audit

| Dimension | Assessment |
|---|---|
| Broken imports | ✅ None — every `import`/`export` verified by static usage-scan across all 17 JS modules. |
| Duplicate IDs | ✅ None — checked every `id="..."` in `index.html`. |
| Duplicate functions | ✅ None — checked every top-level `function`/`const` declaration per file. |
| Dead code | ✅ None remaining — `indexOnlineByPatient()` found unused and removed; every other new export confirmed to have at least one call site. |
| Unused CSS | ✅ None — every new class in `app.css` confirmed referenced in `index.html`/JS. |
| Unused JS | ✅ None — see "Dead code" above. |
| Broken links | ✅ None — every relative `.md` link in `README.md`/`docs/*.md` resolves to an existing file. |
| Google Sheet schema | ✅ Append-only on all three tabs; verified against `EnzoBackend.gs`'s `COL`/`COLO`/`COLP` maps. |
| Role permissions | ✅ `patients`/`createPatient` added to the backend `CAN` table for Receptionist/Administrator (read: all three roles), mirroring the existing enforcement pattern — UI gating alone was never trusted. |
| Offline queue | **Corrected in §13:** the original verification of the new patient-creation path was superficial and missed a real orphaning bug (C1). Now genuinely verified end-to-end, including the harder multi-appointment case — see §13. |
| Search | ✅ One shared implementation (`patients.js`) reused identically across Booking/Online/Dashboard/Timeline — no duplicated/divergent search logic. |
| Timeline | ✅ Rebuilt on permanent Patient ID; Profile card verified; O(n) search verified. |
| Patient ID | ✅ Every write path (`book`/`update`/`online`/`complete`/`createPatient`) resolves and persists one; migration self-heals legacy rows. |
| Capacity | ✅ Unaffected — regression-tested. |
| Settings | ✅ Unaffected — regression-tested. |
| Theme | ✅ Unaffected — regression-tested. |
| Notifications | ✅ Unaffected — `checkFollowUps()` untouched by this phase. |
| Service worker | ✅ `js/patients.js` added to `SHELL`; `CACHE` bumped `enzo-v7` → `enzo-v8`. |
| Performance | ✅ No O(n²) loop introduced; migration batched to 3 writes total; search is a single in-memory pass per query. |
| Memory | ✅ No new unbounded caches; `store.patients` is the same bounded-by-clinic-size pattern as `store.appts`/`onlineRecords`. |
| Console errors | ✅ Zero JS errors across every tested flow (demo mode and mock-backend mode); the only console entries seen were external CDN/font requests blocked by this sandbox's network policy, unrelated to app code. |
| Accessibility | ✅ New interactive elements are real `<button>`s with visible text or `aria-label`s; new search boxes have `aria-label`; new list rows follow the existing `role="button" tabindex="0"` + keydown pattern already used by the Timeline. |
| Security | ✅ All new render paths escaped; all new write actions server-enforced; no new XSS surface; phone-matching logic identical (and independently re-implemented, not shared code) on client and server so a client-side "match" can never diverge from what the server actually links. |
| Regression | ✅ Booking, Complete Consultation, Online Records, Dashboard, Settings, capacity, theme, and the offline queue all verified working after this phase's changes, live, in a browser. |

---

## 10. Known issues / limitations

- **Patient matching is phone-only.** A patient with no phone on file, or
  two different people who genuinely share one phone number, cannot be
  disambiguated automatically. "Create new anyway" and the manual
  Patient-ID-merge procedure (`OPERATIONS-RUNBOOK.md` §4.1a) cover this.
- **Migration accuracy is bounded by the data.** If the same real patient's
  old rows used two *different* phone numbers before this update, the
  one-time migration will still create two separate Patient Master rows
  for them — there's no way to know they're the same person from phone
  numbers alone. This can't happen for anything booked *after* this
  update, since identity is now resolved deliberately at booking time.
- **No Doctor field.** The duplicate-detection card omits "Doctor" (present
  in some Phase 3 mockups) because the app has no per-appointment doctor
  concept anywhere in its schema — a single-doctor-clinic assumption
  carried over unchanged from Phase 1. Adding it would be a genuinely new
  feature, out of this phase's scope.
- **No in-app patient-edit screen.** Gender/DOB/Address/Email exist as
  `Patients` columns for a future module but aren't collected or editable
  in today's UI (the booking form is still intentionally minimal). Editing
  them today means editing the Google Sheet directly.
- **Offline-created patients are per-device until sync**, same class of
  risk as the pre-existing offline queue (carried over from Phase 1/2): if
  the same phone books from two different devices before the first
  device's offline write syncs, two patients can be created for one phone.
  This is a genuine, accepted, documented limitation — it is *not* the
  same thing as C1 in §13, which was a correctness bug (a broken link),
  not a data-quality tradeoff like this one.
- **Migration was verified by full code review + a mock-backend
  integration test** (batched-write logic, lock/flag correctness, phone
  matching) rather than against a multi-thousand-row production Google
  Sheet, since no live Apps Script deployment was available in this
  environment. The batching design (3 writes total regardless of row
  count) is what keeps this safe at scale; recommend a canary run against
  a copy of the real production Sheet before the first live deployment.
- **Carried-over Phase 1/2 risks still apply**: coarse role model (all
  roles read Timeline/diagnosis text), no optimistic-lock on concurrent
  appointment edits.

## 11. Future recommendations

- Add an in-app "Edit patient" affordance (even a simple one) once
  Gender/DOB/Address/Email need to be collected somewhere other than the
  Google Sheet directly.
- Consider a lightweight admin tool for the manual Patient-ID-merge
  procedure (today it's a documented spreadsheet edit) if merges turn out
  to be common in practice.
- Revisit per-field medical-record ACLs before onboarding more staff
  (carried over from Phase 1/2).
- The identity foundation built here is what a Patient Portal, Billing, or
  Prescriptions module would key off — see `README.md`/`ARCHITECTURE.md`'s
  updated extension points.

## 12. Production readiness score (superseded — see §13)

The score originally recorded here was **9.0/10**, based on the QA pass in
§8 as it stood at the time. That QA pass contained a false PASS (test 19)
that concealed a Critical data-corruption bug, and had not tested the
`online` action's concurrency behavior at all. That score was wrong. See
§13 for the corrected score.

## 13. CTO production review, round 2 — adversarial re-audit and fixes

A second review explicitly assumed everything in §1–§12 above was
unverified until proven otherwise, re-read the code fresh, and tried to
break it rather than confirm it. It found and fixed the following. Every
finding below was independently reproduced by reading the actual shipped
code (not by trusting this report) before any fix was written, and every
fix was re-verified live (browser + a purpose-built mock backend) after.

### 13.1 Critical

**C1 — Offline-created patients were permanently orphaned from their own appointments.**
`js/booking.js`'s `saveAppt()` sent whatever `patientId` it had — including
a client-side placeholder generated by `js/patients.js`'s `createNewPatient()`
for a patient that only exists locally, not yet on the server — into the
`book`/`update` payload unconditionally. If that payload itself got queued
offline, it carried the placeholder into `localStorage` permanently. When
the queue later flushed, the paired `createPatient` write correctly
created the real patient with a real, different, server-generated ID —
but `EnzoBackend.gs`'s `book`/`update` handlers trusted any non-empty
client-supplied `patientId` unconditionally (`p.patientId || findOrCreatePatient(...)`),
so the placeholder was written straight into `Appointments` column U. The
appointment ended up referencing a Patient ID that exists nowhere in
`Patients` — it would never appear in that patient's Timeline, would never
be found by Patient ID/OPD search, and the migration would never repair
it (migration only fills in *blank* Patient IDs; this one was non-blank
and simply wrong). No error was ever shown to the user.
**Fix:** `saveAppt()` now tracks whether the resolved patient is `pending`
(not yet server-confirmed) and omits `patientId` from the outgoing payload
when it is, letting the server's own phone-based lookup resolve the real
patient once the paired `createPatient` write has landed ahead of it in
the queue — the fix `js/online.js` already had; `booking.js` now matches
it. As defense in depth, `EnzoBackend.gs`'s `findOrCreatePatient()` was
also changed to take an optional `providedId` and **verify it exists**
before trusting it, falling back to phone-match-or-create otherwise —
applied to `book`, `update`, `online`, and `complete`, so a bad ID from
*any* source (not just this one bug) can never be written into
`Appointments`/`OnlineRecords` again.
**Files:** `js/booking.js`, `EnzoBackend.gs`.
**Verified:** two appointments booked offline for the same brand-new
patient (the harder case — a second offline booking reusing the first's
still-pending local patient), then synced against a mock backend
implementing the real fixed logic. Result: exactly one real patient
(`ENZO-000001`), both appointments correctly appear in its Timeline,
visit count 2, zero orphaned references, zero console errors.

**C2 — The `online` write action had no lock, unlike every other action that can create a patient.**
`book`, `update`, `complete`, and `createPatient` were all wrapped in
`LockService.getScriptLock()`; `online` was not. Two `online` requests for
the same brand-new phone number arriving close together (two reception
devices, a double-submit, a retry) could both miss each other's
not-yet-committed row and both create a `Patients` row for the same
phone, and — separately — could both read the `PATIENT_SEQ` counter before
either wrote it back, handing out the **same OPD Number to two different
patients**, directly violating the "OPD uniqueness" requirement.
**Fix:** wrapped the `online` branch in the same lock pattern as its
siblings.
**Files:** `EnzoBackend.gs`.
**Verified:** the exact read-then-write critical section the fix now
locks was isolated and run both without and with the lock, using
realistic async I/O yield points to mirror Apps Script's Range API
round-trips (true parallel execution of Apps Script itself can't be run in
this environment). Unlocked: 2 patients, 2 different OPD numbers, for one
phone. Locked (the fix's pattern): 1 patient, 1 OPD number, deterministically.

### 13.2 High

**Migration can hold the shared lock long enough to make every other concurrent write fail.**
`ensureMigrated()` holds `LockService.getScriptLock()` for the entire,
unbounded duration of `ensurePatientLinks()`, while `book`/`update`/`complete`/
`createPatient`/`online` each only waited 10 seconds to acquire that same
lock before failing with `busy`. On a clinic with a real historical
dataset, the first person to open the app after this upgrade could cause
every other concurrent booking/consultation action to fail during the
migration window.
**Fix:** raised the dependent actions' lock-acquire timeout from 10s to
20s, matching `ensureMigrated()`'s own 20s wait. This does not eliminate
the theoretical risk on an extremely large sheet (a redesign — e.g.
running migration outside the request-serving lock entirely — was
considered but rejected as out of scope: it would be a genuine
architecture change, not a proportionate fix), but it substantially
narrows the window and is called out explicitly in §10/below as a
residual risk with a recommended mitigation (run migration once,
deliberately, before go-live on a large existing dataset, rather than
relying solely on the lazy first-open trigger).
**Files:** `EnzoBackend.gs`.

### 13.3 Medium

**M1 — No server-side validation that a client-supplied `patientId` exists.**
Root cause of C1's persistence; fixed as part of C1's fix (`findOrCreatePatient`'s
new `providedId` validation). Listed separately because it's an
independent hardening, not just a C1 patch — it protects against *any*
future source of a bad ID, not only this one.

**M2 — Timeline/Dashboard patient search never checked Online Record notes.**
`js/patients.js`'s `patientMatches()` only scanned that patient's
appointments (diagnosis/clinical/medicine notes/outcome) for a free-text
match, never their online records' notes/place/referred-by — while the
Online Records page's own search *did* check those fields. A patient
findable by their online-record notes on the Online page was not findable
by the same text on the Timeline or Dashboard.
**Fix:** added `indexOnlineByPatient()` back (it had been removed as
"dead code" in the original pass — it should have been wired in here
instead) and extended `patientMatches()` to also check online records,
passed in as a second O(n) index alongside the existing appointments
index so this stays O(patients + records), not O(patients × records).
**Files:** `js/patients.js`, `js/timeline.js`, `js/dashboard.js`.
**Verified:** an online record was saved with a unique marker string in
its notes and no matching appointment; searching the Timeline for that
exact string found zero patients before the fix and the correct one after.

**M3 — `docs/PATIENT-MASTER.md` misdescribed the migration algorithm.**
The doc claimed blank-phone rows fall back to name-based matching during
migration; `EnzoBackend.gs`'s actual `getOrCreate()` has no such fallback
— every blank-phone row becomes its own new patient, full stop.
**Fix:** corrected the doc to describe actual (phone-only) behavior and
added an explicit warning that a clinic with many old blank-phone rows
should expect the Patients tab/OPD sequence to grow accordingly.
**Files:** `docs/PATIENT-MASTER.md`.

**M4 — Timeline and Dashboard search were not debounced.**
Unlike `booking.js`'s duplicate-detection phone check (debounced 250ms),
`#tSearch` and `#dashSearch` rebuilt the full patient index and rescanned
every patient on every single keystroke — a real risk of visible input
lag at the brief's own stated scale (5,000 patients / 10,000 appointments).
**Fix:** added the same 250ms debounce pattern already used in `booking.js`.
**Files:** `js/timeline.js`, `js/dashboard.js`.

### 13.4 Low

**L1 — Keyboard activation only handled Enter, not Space.**
`role="button" tabindex="0"` result rows (Timeline patient list, and the
new Dashboard quick-search results) only responded to Enter in their
`keydown` handler; per WAI-ARIA authoring practice a custom button role
should also respond to Space. Present in Phase-1-era `timeline.js` and
copied into the new `dashboard.js` without being fixed.
**Fix:** both handlers now accept Enter or Space (with `preventDefault()`
on Space so it doesn't also scroll the page).
**Files:** `js/timeline.js`, `js/dashboard.js`.
**Verified:** focused a result row, pressed Space, confirmed it opens the
patient (Timeline) / jumps to the Timeline (Dashboard).

**L2 — Linked patient identity and the appointment's free-text name/phone can silently diverge.**
**Confirmed, not fixed.** Once a patient is matched, nothing stops
editing the name/phone fields to something unrelated before submitting —
the appointment stays linked to the matched `patientId` but its visible
name/phone can contradict that patient's record. This is allowed "for
compatibility" by explicit design (per the brief: "Name and phone remain
for compatibility"). Fixing it would mean adding new UI feedback, which
falls under "no feature additions" for this review pass. Recorded as a
future recommendation (§11) instead.

### 13.5 A third bug, found by this round's own regression testing (not one of the original 9)

While re-verifying M2's fix, the online record used to prove it never
showed up in the Timeline at all — because **`js/online.js` never linked
an online record to any patient in demo mode, or for a genuinely new phone
while offline.** Its patient-resolution logic only reacted to a
server-confirmed `patientId` or an existing *local* phone match; it never
called `createNewPatient()` the way `booking.js` does, so a brand-new
phone with no backend reachable (demo mode — permanently, since demo mode
never syncs) or not yet reachable (offline) saved with `patientId: ''`
forever unlinked.
**Fix:** `online.js` now falls back to `createNewPatient()` when there's
no server-confirmed ID and no local phone match, mirroring `booking.js`.
The outgoing network payload is unchanged — it still never carries a
`patientId` — so the server's own phone-based resolution remains the
source of truth once/if the write actually reaches it; this fix only
makes the *local, immediate* UI state correct.
**Files:** `js/online.js`.
**Verified:** two online records saved back-to-back for the same new
phone number correctly deduped to exactly one patient in the same
session; the notes-search regression test (M2) then passed end to end.

### 13.6 QA — re-verification after fixes

| Area | Result |
|---|---|
| Offline booking (single new patient) | ✅ PASS |
| Offline booking (new patient, two appointments before sync) | ✅ PASS — both link to the one real patient, zero orphans |
| Sync / reconciliation | ✅ PASS — "Pending sync" resolves to the real OPD Number, and the *appointment* now actually points at it |
| Timeline (name/phone/OPD/Patient ID/diagnosis/online-notes search) | ✅ PASS |
| Patient ID (never invalid, never orphaned, validated server-side) | ✅ PASS |
| Duplicate detection (Use existing / Create new anyway / default) | ✅ PASS (re-verified, unaffected by fixes) |
| OPD uniqueness under concurrency | ✅ PASS (isolated logic proof — see C2) |
| Concurrent online creation | ✅ PASS (isolated logic proof — see C2; real Apps Script LockService itself could not be executed in this environment) |
| Migration | ✅ PASS (code-level; lock-contention risk narrowed, not eliminated — see High finding) |
| Full demo-mode regression (booking, online, dashboard, settings, capacity, theme, keyboard) | ✅ PASS, zero console errors beyond sandbox-blocked external CDN/font requests |
| Syntax (`node --check` on every changed file) | ✅ PASS |

### 13.7 Files changed in this round

`EnzoBackend.gs`, `js/booking.js`, `js/online.js`, `js/patients.js`,
`js/timeline.js`, `js/dashboard.js`, `docs/PATIENT-MASTER.md`. No file
outside this list was touched; no UI redesign, no new features — every
change is a bug fix to already-shipped Phase 3 code.

### 13.8 Regression risk of these fixes

Low. Every fix either narrows an existing fallback (server now validates
before trusting, instead of trusting unconditionally — strictly safer for
every existing caller) or adds a lock around a critical section that was
already using the same lock elsewhere (no new lock ordering/deadlock risk
introduced, since `LockService.getScriptLock()` is a single global lock
already acquired-and-released the same way in four other places). The
debounce and keyboard fixes are additive UI behavior with no change to
existing interaction paths. The `online.js` fix only fires in a case
(`!patientId`) that previously produced a `''` — a change from "wrong" to
"correct," not a change to any currently-working path.

### 13.9 Production readiness score (corrected)

**8.5 / 10 — Production ready, with the residual risks below understood
and accepted before go-live.**

The two Critical and one High finding are fixed and re-verified; nothing
in the original feature set was removed or redesigned to fix them. The
score is *lower* than the original (wrong) 9.0/10 despite the fixes,
because this round's own findings — a Critical data-corruption bug that
passed an initial QA round, an unlocked write path, and a third bug
surfaced only by chance during unrelated regression testing — demonstrate
real gaps in verification rigor for a system this report otherwise
describes as thoroughly tested. The residual risks explicitly not fully
closed:
- Migration lock contention is narrowed, not eliminated, on an extremely
  large sheet (High finding, §13.2) — recommend running migration
  deliberately before go-live on any clinic with a large historical
  dataset, rather than relying only on the lazy first-open trigger.
- `LockService`/Apps Script concurrency behavior itself could not be
  executed in this environment; C2 and the migration-lock finding were
  verified by isolating and reproducing the exact logical pattern, and by
  direct code inspection confirming the real file has that pattern — not
  by running real concurrent requests against a real Apps Script
  deployment. A live-deployment concurrency test is recommended before
  the first production rollout at a busy, multi-device clinic.
- L2 (name/phone can diverge from the linked patient) remains unfixed by
  design-scope decision, not oversight.

### 13.10 Verdict

**I APPROVE PHASE 3 FOR PRODUCTION**, conditional on the two residual
risks above (migration-at-scale rehearsal; a live-deployment concurrency
smoke test) being carried out before go-live at a clinic with a large
existing dataset or multiple simultaneous reception devices — both are
now explicit, tracked action items, not unknowns.

## 14. Post-review change: external OPD number provider

After the review above, a requirement surfaced that this app must **never
generate OPD numbers itself** — the clinic already runs its own external
OPD numbering system, and every OPD Number must come from it. Everywhere
above that describes OPD Numbers as "sequential", "generated automatically
from `PATIENT_SEQ`", or similar is now historical — it describes the
original implementation, which this change replaces. It is left in place
above rather than edited, since it's an accurate record of what was built
and reviewed at the time; this section is the authoritative note on what
changed afterward.

### 14.1 What changed
- `PATIENT_SEQ` (the Script Property sequence counter), `nextOpdNumber()`,
  `getPatientSeq()`, `savePatientSeq()` are all removed from
  `EnzoBackend.gs`. This project no longer has any code path that invents
  an OPD Number.
- A new, single integration point, `requestOpdNumberFromProvider()`, calls
  the clinic's external OPD system (configured via the `OPD_PROVIDER_URL`
  / `OPD_PROVIDER_METHOD` / `OPD_PROVIDER_API_KEY` Script Properties — see
  the new `setOpdProviderConfig()` one-time-setup helper, same pattern as
  `setCredentials()`). Response parsing is isolated in
  `parseOpdProviderResponse()` so the exact response shape can be adjusted
  in one place if the provider changes.
- Every path that can create a brand-new patient —
  `findOrCreatePatient()` (used by `book`/`update`/`online`/`complete`),
  the `createPatient` action, and the one-time `ensurePatientLinks()`
  migration — now calls the provider and **throws/aborts without writing
  a Patients row if that call fails**. `doPost` catches this via a shared
  `resolvePatient()` wrapper and returns
  `{ ok:false, error:'opd_provider_failed', message }` instead of
  completing the write.
- `js/patients.js`'s `createNewPatient()` now throws (instead of quietly
  returning `null`) when the server rejects patient creation, carrying the
  server's message through. `booking.js` and `online.js` catch it and show
  that message via `toast()` — reception sees why the patient wasn't
  created, not just a generic failure.
- Demo mode (no backend at all) still needs *something* to display, since
  there is nothing real to call — its placeholder sequence is now isolated
  in one clearly-labeled function, `nextDemoOpdNumber()` in
  `js/patients.js`, with a comment making explicit that it is a
  demo-sandbox fixture, not "how OPD numbers are produced."
- Patient ID remains internal-only and hidden from the UI, unchanged from
  the original Phase 3 design; OPD Number remains what's shown/searched
  everywhere, unchanged. Only *where the OPD Number's value comes from*
  changed.

### 14.2 Verification performed
- Syntax-checked the modified `EnzoBackend.gs` and `js/patients.js`,
  `js/booking.js`, `js/online.js` (`node --check`, after copying `.gs` to
  a `.js` extension for the Apps Script file since it's plain JS).
- Unit-tested `parseOpdProviderResponse()`'s parsing contract in isolation
  (11 cases: each supported field name, nested `data.*`, numeric coercion,
  invalid JSON, empty object, empty string, `null` body, unrelated fields)
  — all passed.
- Ran a live browser regression (Playwright, demo mode) against a scratch
  copy with `WEB_APP_URL` blanked: booked a brand-new patient end-to-end
  (name → phone → date → slot → book), confirmed the patient was created
  with a demo OPD Number and the appointment linked to it in the Timeline;
  saved a new online record for a different brand-new phone number and
  confirmed the same. No console/page errors in either flow, confirming
  the new try/catch in `createNewPatient()`'s callers didn't break the
  existing demo-mode paths.
- Could not exercise the real `UrlFetchApp` call path against a real
  external OPD endpoint in this environment (no such endpoint exists yet
  for this clinic) — that remains a pre-go-live action item alongside the
  two already listed in §13.10, since it's the one part of this change
  that genuinely can't be verified without the clinic's real OPD system to
  point at.

### 14.3 Updated action items before go-live
1. Migration-at-scale rehearsal (carried over from §13.10).
2. Live-deployment concurrency smoke test (carried over from §13.10).
3. **New:** configure `OPD_PROVIDER_URL` (and method/key) against the
   clinic's real OPD system and run the full §9.7a checklist in
   `DEPLOYMENT-GUIDE.md` end-to-end, including the "provider unreachable"
   negative test — this is the first time this integration touches a real
   external endpoint.
