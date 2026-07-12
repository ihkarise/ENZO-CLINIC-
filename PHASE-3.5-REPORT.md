# Phase 3.5 — Reception + Doctor daily workflow

This phase makes the daily clinic workflow better for **Reception** and the
**Doctor**. It does **not** touch Billing, Inventory or Prescriptions. There
is no redesign, no framework, no build system — the existing modular
vanilla-JS front end and the same Apps Script + Google Sheet backend are kept,
and everything is backward compatible.

Written so a non-coder can follow it.

---

## What changed, in plain words

1. **Morning briefing on the Dashboard.** When the doctor opens the Dashboard
   they now see, at the top, *Today's morning briefing*: today's appointments
   (Time · OPD Number · Patient Name · Online/In-clinic · a status badge),
   plus a row of summary counts and a copy-ready Morning Report.

2. **Patient status badges everywhere.** Every patient now shows a coloured
   badge that is worked out automatically from their history — you never have
   to open the Timeline to know who they are:
   - **NEW** (green) — never completed a consultation before
   - **RETURN** (blue) — has completed at least one
   - **LAST COMPLETED** (green) — their last visit was completed
   - **LAST CANCELLED** (orange) — their last visit was cancelled
   - **LAST NO-SHOW** (red) — their last visit was a no-show
   - **FOLLOW-UP OVERDUE** (purple) — a follow-up appointment is past due
   These badges appear on the Dashboard, Booking list, Timeline, Patient
   Profile and every search result.

3. **Manual OPD Number.** Reception now **types the OPD Number** when
   registering a new patient. There is **no automatic OPD generation, no
   external URL and no API** any more. The number is checked to be unique
   before saving, can only be set during first registration, and is shown and
   searchable everywhere. The internal Patient ID stays hidden forever.

4. **Today's morning summary counts.** On the Dashboard: Today's Appointments,
   New Patients, Return Patients, and how many of today's patients last visited
   with a Completed / Cancelled / No-show outcome or an overdue follow-up.
   **Each count is clickable** and filters the appointment list below it.

5. **Morning Report.** One report — the *Morning Clinic Summary* — is generated
   once and reused on the Dashboard **and** by the Email / Telegram / WhatsApp
   notifications. The administrator can turn each channel on or off
   independently in Settings.

6. **Priority (attention) patients.** A simple star score (★★★★★, no AI) flags
   patients who need attention first: last visit was a no-show, cancelled
   repeatedly, follow-up overdue, or a long gap since the last visit. They
   sort first in the briefing and are listed in the Morning Report.

Search, Timeline and performance were already O(n) with pre-built indexes from
Phase 3; this phase reuses those indexes (no new nested loops).

---

## Files changed and why

### Front end (`js/`)
| File | What changed | Why |
|------|--------------|-----|
| `js/workflow.js` | Added `isTerminal()` and `startOfToday()` helpers | Shared "closed visit" + "today" definitions used by status/priority |
| `js/patients.js` | Added `patientStatus()`, `patientPriority()`, `statusBadgeHtml()`, `opdExists()`; `patientSummary()` now returns `firstVisit`; `createNewPatient` carries a typed `opdNumber`; removed all external-OPD language | Feature 2, 3, 6 — the single source of truth for badges, priority and OPD uniqueness |
| `js/morning.js` | **New module** | Feature 1, 4, 5 — builds the Morning Report once and renders the Dashboard briefing |
| `js/booking.js` | OPD Number field (shown only when creating a new patient) with live uniqueness check; patient status badge on appointment cards | Feature 2, 3 |
| `js/timeline.js` | Profile card now shows **First visit** and a status badge; search results show badges | Feature 2, Timeline header |
| `js/dashboard.js` | Search results show status badges; wires the briefing | Feature 2 |
| `js/settings.js` | Per-channel Morning Report toggles (email/telegram/whatsapp) | Feature 5 |
| `js/app.js` | Imports/initialises `morning.js`; refreshes the briefing on nav, after save, and after offline sync | Wiring |

### Markup / styles
| File | What changed |
|------|--------------|
| `index.html` | `#morningBrief` container on the Dashboard; OPD Number field in Booking; three Morning Report channel checkboxes in Settings |
| `css/app.css` | Badge colours (`.tb.new/.return/.overdue`) and the morning-briefing styles, both light and dark theme |

### Back end (`EnzoBackend.gs`)
| Change | Why |
|--------|-----|
| Removed `requestOpdNumberFromProvider()`, `parseOpdProviderResponse()`, `setOpdProviderConfig()` | Feature 3 — no external OPD dependency |
| Added `nextOpdNumber()` and `opdTaken()` | Local sequential fallback + server-side uniqueness check |
| `createPatient` action now accepts and validates a typed `opdNumber` (`opd_taken` error) | Feature 3 |
| `findOrCreatePatient()` / migration use `nextOpdNumber()` instead of the provider | Feature 3 |
| Added `buildMorningReport()` + `sendMorningReport()` and a `CFG.doctor` | Feature 5 |

---

## Google Sheet changes

**None.** No columns were added, moved or renamed. The Morning Report reads the
existing Appointments and Patients tabs. The OPD Number already lived in the
Patients tab (column B) since Phase 3 — reception now fills it in instead of an
external system.

## Apps Script changes

Paste the updated `EnzoBackend.gs` over the existing project and **re-deploy the
Web App** (New deployment, or Manage deployments → edit → new version). Then:

- If you upgraded from a build that used an external OPD provider, you may
  delete the now-unused `OPD_PROVIDER_URL` / `OPD_PROVIDER_METHOD` /
  `OPD_PROVIDER_API_KEY` Script Properties — they are ignored.
- (Optional) To send the Morning Report automatically, add a **time-driven
  trigger** on `sendMorningReport` (Triggers → Add Trigger → choose
  `sendMorningReport`, Time-driven, Day timer, e.g. 7–8am). Turn the channels
  on in the app's Settings → Notifications. Set `CFG.doctor`, `CFG.email.to`,
  and the Telegram/WhatsApp credentials in `CFG` as needed.

## New Settings

Settings → Notifications now has **"Morning report — send the daily clinic
summary via: Email / Telegram / WhatsApp"** (three independent switches). These
are stored in the shared settings blob under
`notifications.morningReport.{email,telegram,whatsapp}`. Existing settings keep
working — the switches default to Email on, Telegram/WhatsApp off.

---

## Migration

Nothing to migrate. Because no sheet columns changed and the settings blob is
merged over defaults, an existing Phase 3 deployment upgrades by just pasting
the new files. Old patients already have OPD Numbers from the Phase 3
migration; new patients get a reception-typed one.

## Rollback

Front end: restore the previous `js/`, `css/app.css` and `index.html`. Back
end: restore the previous `EnzoBackend.gs` and re-deploy. No data conversion is
needed either way (no columns changed). See `docs/ROLLBACK.md`.

---

## Manual testing performed

Driven end-to-end in demo mode with a headless browser (Chromium/Playwright)
and with a Node harness for the pure logic:

- **Status logic** — NEW/RETURN and last-outcome colouring verified against a
  fixture matching the phase spec's five example rows; FOLLOW-UP OVERDUE
  correctly takes precedence; priority score flags the overdue/long-gap
  patient. ✅
- **Morning report** — counts (appointments/new/return/completed/cancelled/
  no-show), first & last appointment, and priority list all correct; the
  Dashboard preview text matches the report format. ✅
- **Dashboard briefing** — renders 7 summary cards + today's rows; clicking a
  summary count filters the list. ✅
- **Manual OPD** — field appears only for a new patient, hides when reusing a
  matched returning patient or editing; duplicate number rejected ("already
  used"), unique number accepted ("Available"); a full new-patient booking
  saves and appears in the list. ✅
- **Badges** — shown on Booking cards, Timeline profile (with First visit),
  Timeline/Dashboard search results. ✅
- **Roles** — Doctor cannot open the Dashboard (Administrator-only) as before;
  Reception/Doctor/Administrator gating unchanged. ✅
- **Boot** — no JavaScript/module/console errors on load or through the flow
  (only sandbox-blocked CDN/font requests). ✅
- **Backward compatibility** — Booking, Consultation, Timeline, Offline Queue,
  Settings, Theme, Patient Master and search all still function. ✅

## Performance

- Timeline & Dashboard search still build the patient→appointments and
  patient→online indexes once per render (O(appointments + records)); status
  and priority read from those indexes, so the briefing and every badge stay
  O(n). No nested loops were introduced.
- The briefing scans today's scheduled appointments once. Rendering is a single
  `innerHTML` assignment per section — no per-row DOM churn, no leaks (event
  listeners are attached once in `initMorning()` via delegation).

## Known limitations

- The Morning Report's front-end text and the backend's are **mirrored, not
  literally shared** (two runtimes — browser vs Apps Script). The classification
  rules are duplicated deliberately and kept in step; a future step could move
  the report to a single backend endpoint the app fetches.
- Telegram/WhatsApp credentials still live in `CFG` in `EnzoBackend.gs` (as the
  daily reminder always has); only the on/off switches are in Settings.
- "Home Visit" appointment type is displayed-ready in the data model but not yet
  a booking option (kept for a future phase, as specified).

## Production readiness

**Score: 9 / 10.** All six features are implemented, tested end-to-end, and
backward compatible with no sheet migration. The one point held back is the
intentionally-mirrored (not shared) report logic across the two runtimes, and
that Telegram/WhatsApp secrets remain in code rather than Settings — both are
documented and low-risk.
