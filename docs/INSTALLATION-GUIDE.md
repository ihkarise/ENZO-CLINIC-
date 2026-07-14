# Installation Guide — Phase 2, Phase 3 & Phase 3.5

> ### ⚠️ Phase 3.5 changes two things in this guide
> 1. **No external OPD provider any more.** Reception now **types the OPD
>    Number** when registering a new patient, and the app checks it is
>    unique. **Skip every step below about `setOpdProviderConfig` /
>    `OPD_PROVIDER_URL`** — it is no longer used. Nothing else about the
>    Patients tab changes.
> 2. **New in the app:** a Dashboard **morning briefing** (today's
>    appointments + status badges + clickable counts), a **Morning Report**
>    you can send by Email/Telegram/WhatsApp (toggles in
>    Settings → Notifications), and **priority patients**.
>
> **To install Phase 3.5:** replace the website files (all of `js/`, `css/`,
> `index.html`), paste the updated `EnzoBackend.gs`, and **re-deploy the Web
> App**. **No Google Sheet columns change.** Optionally add a time-driven
> trigger on `sendMorningReport` for the daily report. Full details:
> [`../PHASE-3.5-REPORT.md`](../PHASE-3.5-REPORT.md).

---

> **Who this is for:** you, even if you have **never written code** and don't
> know what most of these words mean. Read slowly. Do one step at a time.
>
> **What "Phase 2" adds:** flexible clinic timings, per-day booking limits,
> clearer appointment cards, a light/dark theme, a stronger search, and a new
> **Settings** page for the administrator. Phase 2 does not touch the Google
> Sheet at all.
>
> **What "Phase 3" adds:** a permanent, unique identity for every patient (an
> **OPD Number** like `ENZO-000123`), duplicate-patient detection at booking,
> and a rebuilt Timeline and search built on that permanent identity. Phase 3
> adds **one new Google Sheet tab** (`Patients`) — created automatically, no
> manual sheet work — and safely links your existing appointments to it the
> first time you open the app after upgrading. See
> [`PATIENT-MASTER.md`](PATIENT-MASTER.md) for the plain-English explanation
> of what this feature does and why. Already on Phase 2? Skip straight to
> [Feature 7](#feature-7--patient-master--unique-patient-id--duplicate-detection-phase-3).

---

## First, three words you need to know

- **File** — a document with code in it. Your app is made of many files. You
  will *replace* some old files with new ones. Replacing a file is exactly
  like replacing a Word document with a newer version of the same document.
- **Apps Script** — the small program that sits behind your Google Sheet and
  answers the app's requests (booking, saving, reading). It is **one file**
  called `EnzoBackend.gs`.
- **Deploy** — pressing the button that makes your changes *go live* so real
  users see them. Editing code does nothing until you deploy.

---

## The big picture (read this once)

Both phases together change the same **two places**:

1. **The website part** (everything except `EnzoBackend.gs`) — this is on
   GitHub and updates automatically once you push the files.
2. **The backend part** (`EnzoBackend.gs`) — this is inside Apps Script and
   needs you to paste the new code and press *Deploy* once.

**You do NOT need to:**
- ❌ Manually create the `Patients` tab — the app creates it (and the
  `Appointments`/`OnlineRecords` tabs, if they somehow didn't exist) the
  first time it needs them.
- ❌ Manually type any column headers.
- ❌ Change the `WEB_APP_URL` (the app's web address stays the same).
- ❌ Re-enter usernames or passwords.
- ❌ Change Script Properties by hand (the app writes its own settings and
  its own patient sequence number).
- ❌ Do anything by hand to link your existing appointments to patients —
  the app does this automatically, once, the first time it runs after the
  upgrade (see Feature 7, Step 6 below).

Everything below is the same update explained two ways: first as a quick
checklist, then feature-by-feature in the exact STEP format. If you are
installing fresh (not upgrading from Phase 1/2), do the Quick update
checklist once — it covers everything, including Phase 3.

---

## Quick update checklist (do this once, top to bottom)

### A. Update the website files (GitHub)

**Files that changed or are new:**

```
✓ index.html            (changed)
✓ css/app.css           (changed)
✓ sw.js                 (changed)
✓ js/app.js             (changed)
✓ js/api.js             (changed)
✓ js/store.js           (changed)
✓ js/core.js            (changed)
✓ js/workflow.js        (changed)
✓ js/booking.js         (changed)
✓ js/online.js          (changed)
✓ js/dashboard.js       (changed)
✓ js/timeline.js        (changed)
✓ js/settings.js        (NEW file, Phase 2)
✓ js/theme.js           (NEW file, Phase 2)
✓ js/patients.js        (NEW file, Phase 3)
```

1. If you got these changes from GitHub already (a branch or pull request),
   just **merge/accept them**. That is all — GitHub Pages rebuilds the site
   within a minute or two.
2. If you are copying files by hand: open each file above on GitHub, click the
   pencil ✏️ (edit), delete everything, paste the new content, and press
   **Commit changes**. For the NEW files, use **Add file → Create new file**,
   name each one exactly as shown (`js/settings.js`, `js/theme.js`,
   `js/patients.js`), paste, commit.

> **Copy the WHOLE file** for every file in this list. Do not paste only part
> of a file. Each of these is meant to fully replace the old version.

### B. Update the backend (Apps Script)

1. Open your Google Sheet.
2. Top menu: **Extensions → Apps Script**.
3. You will see `EnzoBackend.gs` on the left. Click it.
4. Select **all** the code (click inside, press `Ctrl+A` / `Cmd+A`) and delete
   it.
5. Open the new `EnzoBackend.gs` from this project, copy **the whole file**,
   and paste it in.
6. Press the **Save** icon (💾) at the top.
7. Press **Deploy → Manage deployments**.
8. Click the **pencil ✏️** on your existing deployment.
9. In **Version**, choose **New version**.
10. Press **Deploy**. Wait for "Deployment successfully updated."
11. Press **Done**.

> **Why "New version"?** Apps Script keeps the old code live until you publish
> a new version. Choosing **New version** on the **same** deployment means the
> web address (`WEB_APP_URL`) stays identical — nothing in the website needs
> to change.

### C. Refresh the app

On each staff device, **fully close and reopen** the app (or pull down to
refresh in the browser). The app's offline cache updates itself; the reopen
just makes it happen now instead of on the next visit.

**Done.** The rest of this document explains each feature and how to test it.

---

# Feature-by-feature installation

Everything below ships together in the single update above. These sections
tell you *which files each feature lives in* and *exactly how to test it*.

---

## Feature 1 — Dynamic Appointment Engine

The time slots are no longer fixed in the code. The administrator sets the
opening time, closing time, breaks and slot length in **Settings**, and the
app builds the slots automatically.

**STEP 1 — Files Changed**
- ✓ `js/settings.js` (NEW — the slot generator lives here)
- ✓ `js/booking.js` (uses the generated slots instead of a fixed list)
- ✓ `index.html` (Settings page)
- ✓ `EnzoBackend.gs` (stores the timing settings)

**STEP 2 — Google Sheet** — Need Changes? **NO.**
Settings are stored inside Apps Script, not in a sheet tab.

**STEP 3 — Apps Script** — Need Changes? **YES.**
Do section **B** above (paste new `EnzoBackend.gs`, deploy new version). This
is the same one-time backend update — you do not repeat it per feature.

**STEP 4 — GitHub** — Need Changes? **YES.**
Do section **A** above (push/replace the website files).

**STEP 5 — Deployment** — Need Redeploy? **YES**, the Apps Script new-version
step in section **B**. GitHub Pages redeploys itself.

**STEP 6 — Testing**
1. Sign in as the **administrator**.
2. Tap **Settings** at the bottom.
3. Under **Clinic timings**, set Opening `09:00`, Closing `20:00`, Slot
   duration `30`. Add a break `13:00`–`16:00`.
4. Watch the small grey line under the breaks — it should say
   **"16 slots/day · 09:00–19:30"**.
5. Press **Save settings**. You should see a "Settings saved" message.
6. Go to **Booking**, pick any weekday date. The time-slot buttons should now
   match your settings (morning + evening, no lunch slots).
7. **Success looks like:** changing the slot duration to `60` and saving, then
   re-opening Booking, shows fewer, hourly slots.

---

## Feature 2 — Appointment Capacity

The administrator can cap how many appointments each weekday accepts. Setting
a day to **0** closes the clinic that day.

**STEP 1 — Files Changed**
- ✓ `index.html` (capacity inputs)
- ✓ `js/settings.js` (capacity rules)
- ✓ `js/booking.js` (blocks a full/closed day)
- ✓ `EnzoBackend.gs` (`dayIsFull` — enforces the limit on the server too)

**STEP 2 — Google Sheet** — Need Changes? **NO.**

**STEP 3 — Apps Script** — Need Changes? **YES** — same one-time update (B).

**STEP 4 — GitHub** — Need Changes? **YES** — same one-time update (A).

**STEP 5 — Deployment** — Need Redeploy? **YES** — same as above.

**STEP 6 — Testing**
1. Administrator → **Settings → Booking capacity**.
2. Set **Sunday** to `0` and **Monday** to `2`. Press **Save settings**.
3. Go to **Booking**, pick a **Sunday** — it should say *"The clinic is closed
   on this day."*
4. Pick a **Monday**, book two patients. On the third try the day should show
   *"This day is full (2 appointments)."*
5. **Success looks like:** you cannot book a 3rd Monday patient, and Sunday
   offers no slots.

---

## Feature 3 — Appointment Card Improvements

Each appointment card now shows, **without opening it**: whether it is
**Online** or **In-clinic**, whether it is a **Follow-up**, and (future-ready)
**Emergency**.

**STEP 1 — Files Changed**
- ✓ `js/booking.js` (the coloured badges)
- ✓ `js/workflow.js` (reads the follow-up / emergency markers)
- ✓ `css/app.css` (badge colours)

**STEP 2 — Google Sheet** — Need Changes? **NO.**

**STEP 3 — Apps Script** — Need Changes? **NO** (already covered by the one
backend update; no extra step for this feature).

**STEP 4 — GitHub** — Need Changes? **YES** — same one-time update (A).

**STEP 5 — Deployment** — Need Redeploy? Only the website (GitHub) — automatic.

**STEP 6 — Testing**
1. Complete a consultation for a patient and give them a follow-up date.
2. In the **Scheduled** list, the auto-created follow-up appointment now shows
   a purple **Follow-up** tag next to the Online/In-clinic tag.
3. **Success looks like:** you can tell a follow-up from a first visit at a
   glance, without tapping it open.

---

## Feature 4 — Light / Dark Theme

A theme switch. Each device remembers its own choice.

**STEP 1 — Files Changed**
- ✓ `js/theme.js` (NEW)
- ✓ `js/app.js` (the header toggle button)
- ✓ `index.html` (toggle button + Settings option + no-flash script)
- ✓ `css/app.css` (dark colours)

**STEP 2 — Google Sheet** — Need Changes? **NO.**

**STEP 3 — Apps Script** — Need Changes? **NO.**

**STEP 4 — GitHub** — Need Changes? **YES** — same one-time update (A).

**STEP 5 — Deployment** — Need Redeploy? Website only — automatic.

**STEP 6 — Testing**
1. Sign in. Tap the **sun icon** at the top-right of the header.
2. The whole app should switch to dark colours instantly.
3. Close and reopen the app — it should still be dark (it remembered).
4. Administrator can also choose **Light / Dark / System** under
   **Settings → Appearance**.
5. **Success looks like:** the choice survives a refresh, and "System" follows
   your phone's own light/dark setting.

---

## Feature 5 — Global Search Improvements

Search now looks inside **patient name, phone, appointment ID, diagnosis and
notes**, in the Scheduled list, the Completed list, and the Timeline.

**STEP 1 — Files Changed**
- ✓ `js/core.js` (the shared search rule)
- ✓ `js/booking.js` (appointment search uses it)
- ✓ `js/timeline.js` (timeline search uses it)
- ✓ `index.html` (updated search box hints)

**STEP 2 — Google Sheet** — Need Changes? **NO.**

**STEP 3 — Apps Script** — Need Changes? **NO.**

**STEP 4 — GitHub** — Need Changes? **YES** — same one-time update (A).

**STEP 5 — Deployment** — Need Redeploy? Website only — automatic.

**STEP 6 — Testing**
1. Complete a consultation and type a diagnosis, e.g. **"migraine"**.
2. Switch the list to **Completed** and type `migraine` in the search box.
3. That patient should appear.
4. Go to **Timeline**, search `migraine` — the patient should appear there
   too.
5. **Success looks like:** you can find a visit by its diagnosis, not just by
   the patient's name.

---

## Feature 6 — Settings Module (Administrator only)

The new **Settings** page ties features 1, 2 and 4 together in one place, and
adds a notifications toggle. Only the administrator can see it.

**STEP 1 — Files Changed**
- ✓ `js/settings.js` (NEW)
- ✓ `js/app.js` (adds Settings to the navigation)
- ✓ `js/store.js` (remembers the loaded settings)
- ✓ `js/api.js` (talks to the backend to load/save settings)
- ✓ `index.html` (the Settings page + nav button)
- ✓ `css/app.css` (Settings page styling)
- ✓ `EnzoBackend.gs` (`settings` / `saveSettings` endpoints)

**STEP 2 — Google Sheet** — Need Changes? **NO.**

**STEP 3 — Apps Script** — Need Changes? **YES** — the same one-time backend
update (B). Nothing extra.

**STEP 4 — GitHub** — Need Changes? **YES** — same one-time update (A).

**STEP 5 — Deployment** — Need Redeploy? **YES** — the Apps Script new version
(B) and the automatic website update (A).

**STEP 6 — Testing**
1. Sign in as **administrator** → a **Settings** tab appears at the bottom.
2. Sign in as **Receptionist** or **Doctor** → there is **no** Settings tab
   (this is correct — settings are administrator-only).
3. As administrator, change a setting, save, then sign in on a **different
   device** — the new clinic timings should already be there (they are shared
   across all devices).
4. **Success looks like:** only the administrator can change settings, and a
   saved change appears everywhere.

---

## Feature 7 — Patient Master + Unique Patient ID + Duplicate Detection (Phase 3)

Every patient now gets one permanent record with an **OPD Number** issued
by the clinic's own external OPD numbering system (this app never
generates one itself) that never changes and is never reused. Booking a
phone number that's already on file shows a "Returning patient" card so
reception never has to guess whether it's the same person. Full
plain-English explanation: [`PATIENT-MASTER.md`](PATIENT-MASTER.md).

**STEP 1 — Files Changed**
- ✓ `js/patients.js` (NEW — patient identity, duplicate lookup, search)
- ✓ `js/booking.js` (duplicate-detection card, patient resolution on save)
- ✓ `js/online.js` (links online records to a patient, adds a search box)
- ✓ `js/timeline.js` (rebuilt on permanent patient IDs)
- ✓ `js/dashboard.js` (quick patient search)
- ✓ `js/app.js`, `js/store.js`, `js/api.js`, `js/workflow.js`, `js/core.js`
  (wiring for the above)
- ✓ `index.html`, `css/app.css` (new card/search markup and styling)
- ✓ `EnzoBackend.gs` (the `Patients` tab, OPD numbers, duplicate lookup,
  the one-time migration)

**STEP 2 — Google Sheet** — Need Changes? **NO manual changes.** The app
creates a new **`Patients`** tab by itself the first time it needs one —
you don't create it, and you don't type any column headers.

[Screenshot: the Google Sheet's tab bar at the bottom, showing
`Appointments`, `OnlineRecords`, `Patients` after the first login post-upgrade]

**STEP 3 — Apps Script** — Need Changes? **YES.**
Do section **B** above: open **Extensions → Apps Script**, select all the
code in `EnzoBackend.gs`, delete it, paste in the new version, **Save**.

[Screenshot: the Apps Script editor with the new `EnzoBackend.gs` pasted in]

**STEP 3a — Configure the external OPD provider** — Need Changes? **YES,
required.** Find `setOpdProviderConfig()` in the pasted code, edit
`OPD_PROVIDER_URL` to the clinic's real OPD-numbering endpoint (and
`OPD_PROVIDER_METHOD`/`OPD_PROVIDER_API_KEY` if it needs them), select it
in the function dropdown, click **Run** (same authorization flow as
`setCredentials()`), confirm `Execution completed`, then delete/comment it
out. Patient creation cannot succeed until this is done — see
`PATIENT-MASTER.md` for the full contract.

**STEP 4 — Deploy**
Still in Apps Script: **Deploy → Manage deployments → pencil ✏️ → Version:
New version → Deploy → Done.** This is the same one-time backend update as
every other feature — the web address does not change.

[Screenshot: the "New version" dropdown in the Manage deployments dialog]

**STEP 5 — Update GitHub**
Do section **A** above — push/replace the website files listed in STEP 1.
GitHub Pages rebuilds automatically within a minute or two.

**STEP 6 — Verify**
1. Open the app, sign in, and reload once. This is what triggers the
   one-time, automatic linking of your existing appointments to patients —
   nothing to click, it just happens in the background on that first load.
2. Open the Google Sheet — confirm the new `Patients` tab has one row per
   patient you've already seen, each with an OPD Number.
3. Open `Appointments` — confirm column **U** (Patient ID) is now filled
   in on your existing rows, not blank.

**STEP 7 — Run tests**
1. Go to **Booking**, type a **brand-new** phone number and name, finish
   booking. Check the Sheet: a new row appeared in `Patients` with a real
   OPD Number from the external provider (not something the app made up),
   and the appointment's column U matches it.
2. Start a **new** booking using that **same** phone number again. A
   "Returning patient" card should appear showing that OPD Number, name,
   and last visit.
3. Tap **Use existing**, finish booking. Confirm no second row was added
   to `Patients`.
4. Start a third booking with the same phone number, this time tap
   **Create new anyway**. Confirm a **different**, new OPD Number (again
   from the external provider) is created.
5. Go to **Timeline**, search using one of the OPD Numbers you just saw
   (not the name). Confirm it finds the right patient and shows their
   profile card (OPD, Name, Phone, Age, Gender, Visit Count, Last Visit)
   plus their full visit history.
6. On the **Dashboard**, use the small search box at the top to find a
   patient and confirm tapping a result opens their Timeline.
7. **Success looks like:** typing the same phone number twice never
   silently creates two patients unless you explicitly chose "Create new
   anyway"; every patient has exactly one OPD Number; the Timeline shows
   a patient's full history no matter what name or phone was typed the
   first time you saw them.

---

## If something looks wrong

| What you see | What to do |
|---|---|
| Slots look like the old fixed times | You haven't saved Settings yet — that's fine, defaults match the old schedule. Open Settings and Save to customise. |
| "Could not save settings" | You are signed in as Receptionist/Doctor. Only the administrator can save. |
| The Settings tab is missing | You are not signed in as the administrator. This is intended. |
| Dark theme didn't stick | The device blocks local storage (private browsing). Use a normal window. |
| Nothing changed at all | The old files are still cached. Fully close and reopen the app; if using a browser, hard-refresh. |
| Booking a closed/full day still works | You updated GitHub but **not** Apps Script. Do section **B** and deploy a new version. |
| No "Returning patient" card ever appears | You updated GitHub but **not** Apps Script (Feature 7 needs both) — the `Patients` tab, OPD numbers, and duplicate lookup all live in `EnzoBackend.gs`. |
| The `Patients` tab is empty even though you have old appointments | Sign in and reload the app once — the one-time linking runs on the first read after upgrading, not the moment you deploy. Confirm you're actually hitting the new backend (Apps Script → **New version** deployed, not just saved). |
| Two OPD Numbers for one real patient | Their old records used two different phone numbers (from before this update), or "Create new anyway" was tapped by mistake. Fix it by hand — see `OPERATIONS-RUNBOOK.md` §4.1a. |

## Rolling back

If you need to undo Phase 2 and/or Phase 3, restore the previous versions
of the changed files on GitHub and, in Apps Script, **Deploy → Manage
deployments → Edit → Version → pick the previous version → Deploy**.
Phase 2 never touched the Google Sheet; Phase 3 only ever *added* a new
tab and one new column to each existing tab — nothing existing was
rewritten, so your patient data is untouched either way. See
[`ROLLBACK.md`](ROLLBACK.md).
