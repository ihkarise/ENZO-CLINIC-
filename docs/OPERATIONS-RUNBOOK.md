# Operations Runbook — Enzo Homoeo Medical Centre Clinic App

> **Who this is for:** clinic staff (Reception, Doctor, Administrator) who
> use this app day to day, and whoever is responsible for keeping it
> running. This is not a developer document — see
> [`ARCHITECTURE.md`](ARCHITECTURE.md) for that. For first-time setup, see
> [`DEPLOYMENT-GUIDE.md`](DEPLOYMENT-GUIDE.md).

---

## Table of contents

1. [Morning startup](#1-morning-startup)
2. [Reception workflow](#2-reception-workflow)
3. [Doctor workflow](#3-doctor-workflow)
4. [Administrator workflow](#4-administrator-workflow)
5. [End of day checklist](#5-end-of-day-checklist)
6. [Weekly checklist](#6-weekly-checklist)
7. [Monthly checklist](#7-monthly-checklist)
8. [Backup checklist](#8-backup-checklist)
9. [Emergency procedures](#9-emergency-procedures)
10. [Password reset](#10-password-reset)
11. [Deployment recovery](#11-deployment-recovery)
12. [Incident response](#12-incident-response)
13. [Maintenance schedule](#13-maintenance-schedule)
14. [Operational best practices](#14-operational-best-practices)

---

## 1. Morning startup

1. Open the app (installed PWA icon, or the bookmarked GitHub Pages URL).
2. Sign in with your username and password.
3. Confirm your **role badge** next to the clinic name matches who you
   are (Receptionist / Doctor / Administrator). If it's wrong, stop and
   contact your Administrator — don't proceed with the wrong access level.
4. A **"Today"** popup should appear automatically a moment after sign-in,
   listing today's appointments and anyone due a reminder call. Review it,
   then tap **Got it**.
5. Check the **top-left bell icon** badge count throughout the day — it
   reflects the same information and updates live as you book/complete
   appointments.
6. If you see the orange **"Offline"** bar at the top, see
   [§9.1 Internet failure](#91-internet-failure) before continuing normal work.

[Screenshot: login screen]
[Screenshot: "Today" popup after sign-in]

---

## 2. Reception workflow

Reception can: **Book, Edit, Cancel/Delete, Search, Print, Call, WhatsApp,
view Timeline.** Reception does **not** see the booking's medical fields,
cannot open Complete Consultation, and cannot see the Dashboard.

### 2.1 Booking a new appointment
1. Go to the **Booking** tab (bottom nav, house/calendar icon).
2. Fill in **Patient name**, **Phone**, choose **In-clinic** or **Online**.
3. Pick an **Appointment date** — available time slots for that date load
   automatically; already-booked slots are excluded from the list.
4. Tap a free **time slot**.
5. Tap **Book appointment**. A confirmation toast and a checkmark
   animation confirm the save.

> **Note:** if two staff try to book the same slot within moments of each
> other, the second one will see "That slot was just taken" — this is the
> system protecting against double-booking; pick a different slot.

### 2.2 Editing an appointment
1. Find the appointment in the list (Scheduled tab), tap the **pencil** icon.
2. The form pre-fills; an **"Editing <name>"** banner appears at the top.
3. Make your changes, tap **Update appointment**.
4. To cancel out of editing without saving, tap **Cancel** on the banner.

### 2.3 Deleting an appointment
1. Tap the **trash** icon on the appointment.
2. Confirm in the dialog that shows the patient/date/slot.
3. A toast appears with an **Undo** button, active for 5 seconds.
   - If it was a mistake, tap **Undo** immediately.
   - If you don't tap Undo, the deletion becomes permanent after the toast expires.

### 2.4 Search
Type a name or phone number into the search bar — it searches **every**
appointment regardless of which tab/filter is currently active.

### 2.5 Print today's schedule
Tap **Print today** (top of the appointment list) — opens the browser's
print dialog with a clean table of just today's Scheduled appointments,
no app menus/buttons in the printout.

### 2.6 Call / WhatsApp
The phone and WhatsApp icons on each appointment row open your device's
native dialer / WhatsApp app directly with that patient's number.

### 2.7 Undo Delete — practical notes
Undo only works within the same browser session, before the 5-second
window closes. Once the deletion is confirmed (toast gone, no Undo
clicked), the appointment is genuinely gone from the Sheet and must be
re-booked manually if it was a mistake discovered later.

---

## 3. Doctor workflow

Doctor can: **Consult, Complete consultation, Diagnosis, Notes, view
Timeline, Search.** Doctor does **not** see the booking form (Reception
handles booking) and cannot see the Dashboard.

### 3.1 Completing a consultation
1. Find the patient's appointment in **Scheduled** (usually the Today
   filter). Tap the **checkmark** icon ("Complete consultation") — it only
   appears on Scheduled rows.
2. Fill in:
   - **Diagnosis**
   - **Clinical notes** (observations, history, plan)
   - **Medicine duration** — tap a preset chip (15/30/45/60/90 days) or
     type a custom number of days.
   - **Medicine notes** (dosage, instructions)
   - **Follow-up date** — auto-calculated as appointment date + medicine
     duration; you can hand-edit it, and once you do, it stops
     auto-recalculating when you change the duration chip (manual edit wins).
   - **Outcome** — Completed / Cancelled / No show.
3. Tap **Save & complete**.

**What happens automatically on save (Outcome = Completed):**
- The appointment moves out of Scheduled into **Completed**.
- If a follow-up date is set, a **new Scheduled appointment** is
  auto-created on that date for the same patient — reception will see it
  waiting, no need to re-book it.
- If the original appointment was **Online**, a new **Online Record** is
  auto-added — no need to duplicate the entry.

**Outcome = Cancelled or No show:** the appointment moves to the matching
Completed-tab sub-filter; **no** follow-up appointment is created.

### 3.2 Viewing a past consultation
Tap the **eye/pencil** icon on a Completed/Cancelled/No-show row to view
its full consultation record read-only (Save is hidden, button says
"Close" instead of "Cancel").

### 3.3 Patient Timeline
Go to the **Timeline** tab, search by name or phone, tap a matching
patient to see every appointment, consultation, diagnosis, medicine, and
online record for them in one chronological list — useful for reviewing
history before a consult.

---

## 4. Administrator workflow

Administrator can do **everything** Reception and Doctor can, plus:

### 4.1 Dashboard
Go to the **Dashboard** tab (only visible to Administrator).
- Toggle **Week / Month / Year** to change the reporting period.
- **KPI tiles:** Total visits, Online, In-clinic, Appointments booked in
  the period, each with a vs-previous-period trend.
- **Trend chart:** Online vs In-clinic visits (bars) plus total
  appointments booked (line), broken down by day/week/month depending on range.
- **Day-of-week performance:** which weekday is busiest/quietest — useful
  for staffing decisions.
- **Referred-by breakdown:** tap any source in the list to filter the
  detail view to just that source's records; tap **CSV** to export the
  current breakdown as a spreadsheet file.

### 4.2 Staff account management
Administrator manages staff logins directly in the Apps Script editor
(§10 below) — there is no in-app "manage users" screen in Phase 1.

### 4.3 Full record access
Administrator can open, edit, and view every appointment, consultation
record, and online record regardless of who created it.

---

## 5. End of day checklist

- [ ] Confirm no appointments are stuck showing in **Pending** (past date,
      still Scheduled) that were actually seen — ask the Doctor to
      complete consultations for any that were missed during the day.
- [ ] If the offline bar was ever shown today, confirm it's gone now and
      that a "Synced N offline changes" toast appeared at some point (see
      §9.1) — don't leave the clinic with unsynced offline writes sitting
      on a single device.
- [ ] Reception: check tomorrow's schedule via the bell icon or Booking →
      Upcoming, to flag any early-morning slots that need a reminder call
      tonight.
- [ ] Sign out of any shared/public device at the end of the shift — the
      app does not auto-lock, and login sessions last up to 6 hours.

---

## 6. Weekly checklist

- [ ] Administrator: review the Dashboard's Week view for anything
      unusual (a sudden drop in bookings might indicate a booking-flow
      problem rather than an actual quiet week — cross-check with reception).
- [ ] Spot-check a handful of recently completed consultations against
      the Sheet directly to confirm data is landing correctly (see
      Deployment Guide §9.6 for what a healthy row looks like).
- [ ] Confirm the daily reminder email (if enabled) has been arriving —
      check the inbox configured in `EnzoBackend.gs`'s `CFG.email.to`.

---

## 7. Monthly checklist

- [ ] Take a full Sheet backup (see [§8](#8-backup-checklist) below).
- [ ] Administrator: review the Dashboard's Month view and the
      referred-by breakdown for referral-source trends worth acting on.
- [ ] Confirm every active staff member's role (`ROLE_<username>` in
      Script Properties) still matches their actual job — remove/adjust
      access for anyone who's left or changed role.
- [ ] Check the Apps Script project's **Executions** log (left sidebar,
      list icon) for any recurring errors that didn't surface as a
      user-visible complaint — a silently-failing reminder trigger is the
      most common thing to catch here.
- [ ] Confirm the GitHub repository has no uncommitted/unpushed local
      changes sitting on someone's laptop — the deployed site should
      always match what's in git.

---

## 8. Backup checklist

Do this monthly at minimum; weekly for a busy clinic. See
`DEPLOYMENT-GUIDE.md` §13 for the full rationale.

1. Open the Google Sheet.
2. **File → Make a copy** — name it with the date, e.g.
   `Enzo Homoeo Clinic Data — backup 2026-07-09`, and move it to a
   dedicated "Backups" folder in Drive (not the same folder the live
   Sheet lives in, to reduce the chance of accidentally editing the backup).
3. Optionally also **File → Download → Microsoft Excel (.xlsx)** for an
   offline copy outside Google Drive entirely.
4. Confirm the backup file actually contains rows (open it, don't just
   trust the copy succeeded) before considering the backup complete.
5. Delete backups older than your retention policy (e.g. keep the last 6
   monthly backups) to avoid Drive storage clutter — but always keep at
   least the most recent 2–3.

[Screenshot: File → Make a copy dialog]

---

## 9. Emergency procedures

### 9.1 Internet failure
**Symptom:** the orange **"Offline"** bar appears at the top of the app.

- The app **keeps working** — you can still book, edit, delete, and complete
  consultations. Every write is queued locally on **this specific device**.
- Continue working normally. The moment this device reconnects, queued
  writes sync automatically and you'll see a "Synced N offline changes" toast.
- **Do not close the browser tab / force-quit the app** while offline
  writes are still queued and unsynced — they live in that device's local
  storage and will not appear on any other device until this one comes
  back online and syncs.
- If multiple staff are on different devices during an outage, be aware
  each device's offline writes are invisible to the others until each
  syncs — **double-booking a slot across two offline devices is possible**
  during an extended outage; reconcile manually once everyone's back online.
- Once "Offline" disappears and you get the "Synced" toast, spot-check
  that the writes actually landed (reload, or check the Sheet).

### 9.2 Apps Script failure
**Symptom:** every login/action fails with an error, or the app shows a
raw error page instead of the expected app.

1. Try again in a minute — Apps Script has occasional transient hiccups.
2. If it persists, check the Apps Script project's **Executions** log
   (Deployment Guide §10.4) for the actual error.
3. Common root causes: the Sheet was renamed/restructured (Deployment
   Guide §5.4), the deploying account lost Editor access to the Sheet
   (Deployment Guide §6.9), or a recent code change introduced a bug.
4. If a recent deployment caused it, follow [§11 Deployment
   recovery](#11-deployment-recovery) below.
5. **Staff workaround while backend is down:** fall back to a paper log
   of bookings/consultations taken during the outage, and enter them into
   the app once it's restored — do not lose patient data waiting on a fix.

### 9.3 Google Sheet failure
**Symptom:** the Sheet itself is inaccessible, corrupted, or someone
accidentally deleted rows/columns.

1. **Stop new writes if possible** — pause bookings briefly if the
   corruption looks severe, to avoid compounding the problem.
2. Open **File → Version history → See version history** in the Sheet and
   restore to a point before the corruption.
3. If version history doesn't cover it (e.g. corruption happened a while
   ago and has aged out), restore from the most recent backup (§8).
4. After restoring, spot-check that the app still works end-to-end
   (Deployment Guide §9) before resuming normal operations — a restored
   Sheet can sometimes have a different tab structure than what's live.

### 9.4 GitHub Pages failure
**Symptom:** the site itself won't load (not an app error — the page
literally doesn't come up, or shows a GitHub error).

1. Check GitHub's own status page for a platform-wide outage (rare, but
   it happens) — if GitHub Pages is down, there's nothing to do but wait.
2. If it's specific to this repo, check **Settings → Pages** is still
   configured correctly (Deployment Guide §7.2) — a setting can be
   accidentally changed.
3. Check the repo's **Actions** tab for a failed Pages build — a bad
   commit can break the build even though nothing about GitHub itself is down.
4. **Staff workaround:** if a phone/laptop has the PWA **installed**
   (Deployment Guide §9.12), the app shell still opens from the service
   worker cache even while GitHub Pages is unreachable — login and fresh
   data won't work, but this confirms the outage is specifically GitHub
   Pages and not a total system failure.

### 9.5 Password reset
See [§10](#10-password-reset) below — this is common enough to warrant
its own section.

### 9.6 Deployment recovery
See [§11](#11-deployment-recovery) below.

---

## 10. Password reset

There is **no self-service "forgot password" flow** in this app — resets
require Apps Script editor access.

1. Whoever holds Apps Script editor access opens the Apps Script project
   (Google Sheet → Extensions → Apps Script).
2. Temporarily **restore** the `setCredentials()` function (if it was
   deleted per Deployment Guide §6.6, paste it back in from git history:
   `git show <commit>:EnzoBackend.gs`, or write a small one-off function):

   ```js
   function resetOnePassword(){
     const props = PropertiesService.getScriptProperties();
     props.setProperty('USER_jasmine', hash('TheirNewStrongPassword'));
     // Do NOT touch other USER_/ROLE_ properties you don't intend to change —
     // setCredentials() overwrites every property listed inside it.
   }
   ```

   > **⚠️ Important:** if you restore the full original `setCredentials()`
   > function instead of a scoped one-off, running it will **reset every
   > user listed in it** back to whatever passwords are hard-coded in that
   > function body — which may not be the passwords currently in use if
   > they were changed since. Prefer a small scoped function like the
   > example above that only touches the one account you're resetting.

3. Select the new/scoped function in the toolbar dropdown, click **Run**.
4. **Delete or comment out** the function again immediately after running
   it (same reasoning as Deployment Guide §6.6 — never leave a
   plaintext-password-containing function live in the project).
5. Tell the affected staff member their new password through a secure
   channel (in person or a password manager share, not an unencrypted
   chat message).
6. Have them sign in and confirm access before considering the reset complete.

---

## 11. Deployment recovery

Use this when a recent change (backend or frontend) broke production.

### 11.1 Quick triage
1. **Did the backend or frontend change most recently?** Check git log /
   your own memory of what was last deployed.
2. **Isolate:** open the `/exec` URL directly (Deployment Guide §6.10). If
   it returns the expected `{"ok":false,"error":"unauthorized"}` JSON, the
   backend is healthy — the problem is frontend-side. If it errors, the
   backend is the problem.

### 11.2 Backend recovery
Follow `ROLLBACK.md`'s backend section: replace `EnzoBackend.gs`'s
contents in the Apps Script editor with the last known-good version (pull
from git history), then **Deploy → Manage deployments → New version →
Deploy**. Same URL, no frontend change needed.

### 11.3 Frontend recovery
Follow `ROLLBACK.md`'s frontend section: `git revert` the breaking
commit(s) or check out the previous known-good files and push. Then, on
any affected staff device, unregister the service worker and hard-refresh
(Deployment Guide §10.12) so they actually get the reverted version
instead of the cached broken one.

### 11.4 After recovery
Run the full Deployment Guide §9 production testing pass again before
telling staff it's safe to resume normal use — a rollback that "looks
fine" on the surface can still have a subtle regression if it wasn't a
clean revert.

---

## 12. Incident response

When something goes wrong in production, work through this order:

1. **Assess patient-data risk first.** Is any data actually being lost or
   corrupted right now, or is this purely a UI/availability problem? If
   data is actively at risk (e.g. writes are silently failing), pause
   further writes and switch to the paper-log workaround (§9.2 step 5)
   until the issue is understood.
2. **Identify which half is broken** — backend, frontend, GitHub Pages, or
   the Google Sheet itself (§9.2–9.4 each cover one).
3. **Communicate to staff immediately** — even a one-line "the app is
   down, use paper for now, will update in 30 min" prevents duplicated
   effort and confusion.
4. **Fix the root cause**, not just the symptom — e.g. don't just tell
   staff to keep hard-refreshing if the actual problem is a bad deploy
   that needs a rollback.
5. **Verify the fix** with the relevant section of Deployment Guide §9
   before declaring it resolved.
6. **Reconcile any paper-log entries** taken during the outage back into
   the app once it's restored.
7. **Write down what happened and why**, even briefly (a shared doc, a
   note in this repo's issue tracker if you use one) — the next person
   debugging a similar symptom should not have to rediscover the same
   root cause from scratch.

---

## 13. Maintenance schedule

| Cadence | Task | Section |
|---|---|---|
| Every morning | Startup checks, review Today popup | §1 |
| Every evening | End of day checklist | §5 |
| Weekly | Dashboard review, spot-check data, confirm reminder emails | §6 |
| Monthly | Full backup, role audit, Executions log review, git/deploy sync check | §7, §8 |
| Ad hoc | Password resets, incident response, deployment recovery | §10, §11, §12 |
| Whenever code changes ship | Run the Deployment Guide's production testing pass (§9 there) | — |

---

## 14. Operational best practices

- **One login per person, not one shared login per role.** Even though
  the system supports it, individual logins make it possible to trace who
  booked/edited/completed what — valuable when investigating a data issue.
- **Never share the Apps Script editor's `setCredentials()` function
  screen** (or a screenshot of it) with anyone outside the small group
  who manages accounts — it contains plaintext passwords while it's in use.
- **Treat the Google Sheet's direct edit access as equivalent to app
  Administrator access** — anyone who can edit the Sheet directly can see
  and change everything the app can, bypassing login entirely. Audit
  Sheet sharing at least as carefully as app logins.
- **Don't manually edit the Sheet's automation columns** (Stage, the
  legacy Follow-up/Call formulas, ID) unless you know exactly what you're
  doing and have a backup — see Deployment Guide §5.4.
- **Keep exactly one production deployment URL.** Don't create a second
  Apps Script "New deployment" for routine updates (Deployment Guide
  §11.1) — it fragments your data across two different `/exec` endpoints
  without anyone noticing until reports don't match.
- **Test on a real device before wide rollout of any change** — the
  service worker cache and offline queue behavior are easy to overlook in
  a quick desktop-browser check.
- **Escalation contact:** keep a clearly documented name/contact for
  "who has Apps Script editor + Google Sheet owner access" and "who has
  push access to the GitHub repo" — both are needed for most recovery
  procedures in this runbook, and neither is safe to leave undocumented
  with a single point of failure.
