# Testing checklist — Phase 1

Manual checklist (no test framework — static PWA, no build step). Run
through this after any change before it ships. Use demo mode
(`CONFIG.WEB_APP_URL = ""` in `js/api.js`) for most of it; a few items
need a real Apps Script deployment (marked **[live]**).

## Login & roles
- [ ] Demo mode: any username/password signs in; login hint says "Demo mode".
- [ ] **[live]** Configured backend: wrong credentials show an error; hint
      says "Staff sign in — ask an administrator", not the demo text.
- [ ] Username containing `admin` → Administrator role badge; `doctor`/`dr…` →
      Doctor; anything else → Administrator (demo default).
- [ ] Doctor role: booking form (name/phone/date/slot) is hidden; the
      appointment list, search, and "Complete consultation" icon are visible.
- [ ] Receptionist role: booking form visible; "Complete consultation" icon
      is not shown on any scheduled row; Print today button visible.
- [ ] Administrator: everything visible.

## Booking
- [ ] Booking form only shows Name, Phone, Consultation type, Appointment
      date, Time slot — no medicine/duration/timeline fields.
- [ ] Picking a date renders only free slots; already-booked slots for that
      date are excluded.
- [ ] Booking with no name / no date / no slot shows the right toast and
      does not submit.
- [ ] Successful booking shows "Booked <name> · <date> <time>", appears in
      Scheduled → Today or Upcoming, and clears the form.
- [ ] Booking a slot that another appointment already holds on the same
      date is rejected client-side before hitting the network.
- [ ] Edit an existing appointment: fields pre-fill, "Update appointment"
      label shows, editing banner shows, Cancel restores the blank form.
- [ ] Delete an appointment: confirm dialog shows patient/date/slot; after
      confirming, a toast with **Undo** appears; clicking Undo within the
      window restores the row and the deletion never reaches the backend.
- [ ] Letting the Undo toast expire actually deletes it server-side
      **[live]** (reload and confirm it's gone).

## Scheduled / Completed lists
- [ ] Scheduled tab has Upcoming / Today / Pending sub-filters with correct
      counts; Pending = past date, still Scheduled.
- [ ] Completed tab has Completed / Cancelled / No-show sub-filters.
- [ ] Searching by name or phone searches across all appointments
      regardless of the active tab/sub-filter.
- [ ] Today's row has the coral outline; a Pending (overdue) row has the
      amber outline.

## Complete Consultation
- [ ] "Complete consultation" only appears on Scheduled rows, gated by role.
- [ ] Opening it shows Diagnosis, Clinical Notes, Medicine Duration chips,
      Medicine Notes, Follow-up Date (auto-filled = appt date + duration),
      Outcome (Completed/Cancelled/No show).
- [ ] Changing the medicine-duration chip recalculates the follow-up date
      preview, unless the date was hand-edited (manual edit wins).
- [ ] Saving with Outcome = Completed and a follow-up date: source
      appointment moves to Completed, a new Scheduled appointment appears
      on the follow-up date, and the toast mentions both.
- [ ] Saving with Outcome = Cancelled / No show: source appointment moves
      to the matching Completed sub-filter, no follow-up appointment is
      created.
- [ ] Completing an Online-type appointment auto-adds a row to the Online
      records page without any extra data entry.
- [ ] Opening a Completed row (the eye/view icon) shows the same modal
      read-only, with Save hidden and "Close" instead of "Cancel".

## Patient Master & duplicate detection (Phase 3)
Full checklist: `DEPLOYMENT-GUIDE.md` §9.7a and `INSTALLATION-GUIDE.md`
Feature 7 Step 7. Quick version:
- [ ] Booking a phone number seen before shows the Returning Patient card
      with the correct OPD Number, name, last visit and diagnosis.
- [ ] "Use existing" links the new appointment to that same patient (no
      new row in the `Patients` sheet tab).
- [ ] "Create new anyway" creates a genuinely new OPD Number even though
      the phone matches.
- [ ] A brand-new phone number books without any prompt and quietly gets
      the next sequential OPD Number.
- [ ] Editing an existing appointment never shows the duplicate card, even
      if the phone field is touched.
- [ ] Search by OPD Number (not name/phone) finds the right patient in
      Booking, Online Records, the Dashboard's quick search, and the
      Timeline.

## Patient Timeline
- [ ] Empty search shows the prompt state, not an error.
- [ ] Searching by OPD Number, Patient ID, name, phone, diagnosis or notes
      lists matching patients; selecting one shows a Patient Profile card
      (OPD, Name, Phone, Age, Gender, Visit Count, Last Visit) followed by
      a chronological list combining booked/cancelled/no-show/completed
      appointments and Online records for that patient.
- [ ] A freshly completed consultation (from the step above) appears in
      the same patient's timeline immediately, no reload needed.
- [ ] A patient's history stays together even if their phone number
      changed between visits (grouping is by permanent Patient ID, not by
      re-matching name/phone).

## Dashboard
- [ ] Week/Month/Year toggle updates KPIs, trend chart, weekday chart and
      the referred-by list without a full page reload.
- [ ] CSV export downloads a file named `enzo-referred-by-<period>.csv`
      with the visible rows.
- [ ] Numbers match what's in Scheduled+Completed (spot check one period).

## Offline & sync
- [ ] DevTools → Network → Offline, then book/edit/delete: the UI updates
      immediately and the toast says "Saved offline — will sync…"; the
      offline bar appears at the top.
- [ ] Back online: offline bar disappears and a "Synced N offline changes"
      toast appears **[live]**; reload and confirm the writes landed on
      the Sheet.
- [ ] A genuine server-side rejection (e.g. slot already taken) is **not**
      queued — it surfaces immediately instead of silently retrying.

## Demo-mode-in-production bug (regression check)
- [ ] **[live]** With `WEB_APP_URL` configured and the Sheet genuinely
      empty, the app shows the real empty state ("Nothing here yet."), not
      fabricated demo patients.
- [ ] **[live]** Killing network mid-load (before the first successful
      fetch) shows "Could not reach the server — showing cached data
      only.", not demo data.

## PWA / offline shell / security
- [ ] Fresh load with DevTools → Application → Service Workers shows the
      new cache version (`enzo-v6`) active; old caches are cleared.
- [ ] Airplane mode + reload still opens the app shell.
- [ ] `assets/*.png` load correctly (no 404s) — confirms the asset-path fix.
- [ ] Patient name containing `<script>` or `"onmouseover="` renders as
      inert text everywhere it's shown (list, modal, timeline, dashboard
      referred-by list) — confirms the XSS-escaping fix.
- [ ] Print today's schedule opens the print dialog with a clean table of
      just today's Scheduled appointments; no app chrome bleeds into it.
- [ ] Keyboard-only pass: Tab reaches every interactive control in a
      sensible order; Escape closes any open modal; focus returns to the
      triggering button on close.
