# Installation Guide — Phase 2 (Clinic Experience Improvements)

> **Who this is for:** you, even if you have **never written code** and don't
> know what most of these words mean. Read slowly. Do one step at a time.
> Nothing here can break your patient data if you follow the order — the
> patient information lives in your Google Sheet, and **Phase 2 does not touch
> the Sheet at all.**
>
> **What "Phase 2" adds:** flexible clinic timings, per-day booking limits,
> clearer appointment cards, a light/dark theme, a stronger search, and a new
> **Settings** page for the administrator.

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

Phase 2 changes **twelve files** and **adds two new ones**. You will do the
update in two places:

1. **The website part** (everything except `EnzoBackend.gs`) — this is on
   GitHub and updates automatically once you push the files.
2. **The backend part** (`EnzoBackend.gs`) — this is inside Apps Script and
   needs you to paste the new code and press *Deploy* once.

**You do NOT need to:**
- ❌ Change the Google Sheet (no new tabs, no new columns).
- ❌ Change the `WEB_APP_URL` (the app's web address stays the same).
- ❌ Re-enter usernames or passwords.
- ❌ Change Script Properties by hand (the app writes its own settings).

Everything below is the same update explained two ways: first as a quick
checklist, then feature-by-feature in the exact STEP format.

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
✓ js/timeline.js        (changed)
✓ js/settings.js        (NEW file)
✓ js/theme.js           (NEW file)
```

1. If you got these changes from GitHub already (a branch or pull request),
   just **merge/accept them**. That is all — GitHub Pages rebuilds the site
   within a minute or two.
2. If you are copying files by hand: open each file above on GitHub, click the
   pencil ✏️ (edit), delete everything, paste the new content, and press
   **Commit changes**. For the two NEW files, use **Add file → Create new
   file**, name it exactly `js/settings.js` (and `js/theme.js`), paste, commit.

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

## If something looks wrong

| What you see | What to do |
|---|---|
| Slots look like the old fixed times | You haven't saved Settings yet — that's fine, defaults match the old schedule. Open Settings and Save to customise. |
| "Could not save settings" | You are signed in as Receptionist/Doctor. Only the administrator can save. |
| The Settings tab is missing | You are not signed in as the administrator. This is intended. |
| Dark theme didn't stick | The device blocks local storage (private browsing). Use a normal window. |
| Nothing changed at all | The old files are still cached. Fully close and reopen the app; if using a browser, hard-refresh. |
| Booking a closed/full day still works | You updated GitHub but **not** Apps Script. Do section **B** and deploy a new version. |

## Rolling back

If you need to undo Phase 2, restore the previous versions of the changed
files on GitHub and, in Apps Script, **Deploy → Manage deployments → Edit →
Version → pick the previous version → Deploy**. The Google Sheet was never
changed, so your patient data is untouched either way. See
[`ROLLBACK.md`](ROLLBACK.md).
