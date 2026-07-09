# Deployment Guide — Enzo Homoeo Medical Centre Clinic App

> **Who this is for:** someone deploying this app for the first time, with
> little or no prior deployment experience. Every click is spelled out.
> Follow the sections **in order**. Don't skip verification steps — most
> deployment failures come from skipping a checkbox, not from anything
> exotic.
>
> **Companion docs:** [`ARCHITECTURE.md`](ARCHITECTURE.md) explains *how*
> the system works; this guide only tells you *what to click*.
> [`OPERATIONS-RUNBOOK.md`](OPERATIONS-RUNBOOK.md) is what staff read after
> deployment. [`MIGRATION.md`](MIGRATION.md) and [`ROLLBACK.md`](ROLLBACK.md)
> cover upgrading an existing production deployment and reverting one.

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Deployment architecture](#2-deployment-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Repository verification](#4-repository-verification)
5. [Google Sheet creation](#5-google-sheet-creation)
6. [Apps Script setup](#6-apps-script-setup)
7. [GitHub Pages setup](#7-github-pages-setup)
8. [Frontend configuration](#8-frontend-configuration)
9. [Production testing](#9-production-testing)
10. [Troubleshooting](#10-troubleshooting)
11. [Deployment updates & safe workflow](#11-deployment-updates--safe-workflow)
12. [Rollback](#12-rollback)
13. [Backup strategy](#13-backup-strategy)
14. [Security](#14-security)
15. [Production checklist](#15-production-checklist)
16. [Deployment completion checklist](#16-deployment-completion-checklist)

---

## 1. Project overview

This app has **two independent halves** you deploy separately:

| Half | What it is | Where it goes |
|---|---|---|
| **Backend** | `EnzoBackend.gs` — one Apps Script file | Bound to a Google Sheet, published as a "Web App" |
| **Frontend** | Everything else (`index.html`, `css/`, `js/`, `assets/`, `manifest.json`, `sw.js`) | A static file host — this guide uses GitHub Pages |

They talk to each other over one URL: the Apps Script deployment's `/exec`
URL, which you paste into `js/api.js`. That's the entire "wiring" between
the two halves — there is no other configuration file, environment
variable, or secrets manager involved.

> **⚠️ Important — read this before you start.** This repository, as
> checked out, already has a **real, live** Apps Script URL hardcoded into
> `js/api.js` (`CONFIG.WEB_APP_URL`). That URL belongs to whichever Google
> Sheet was used to build/test this project. If you deploy this repo
> as-is without replacing that URL, your "new" deployment will silently
> read and write into **that same original Sheet**, not a Sheet you
> control. Section 8 shows you exactly how to replace it. Do not skip it.

---

## 2. Deployment architecture

```
┌────────────────────┐        HTTPS         ┌───────────────────────────┐
│   Staff's browser    │ ───────────────────▶ │  Apps Script Web App        │
│   (phone / laptop)   │ ◀─────────────────── │  https://script.google.com/│
│                       │                       │  macros/s/AKfy.../exec     │
│  Loads static files   │                       └────────────┬──────────────┘
│  from GitHub Pages    │                                     │ bound to
└──────────┬────────────┘                                     ▼
           │ HTTPS                                    ┌──────────────────┐
           ▼                                            │  Google Sheet     │
┌──────────────────────┐                                 │  "Appointments"  │
│  GitHub Pages          │                                 │  "OnlineRecords" │
│  (static hosting,      │                                 └──────────────────┘
│  your GitHub repo)     │
└──────────────────────┘
```

Two deployments, two dashboards, no shared account beyond "you own both".
Nothing about this requires a credit card, a domain name, or a server you
patch — that is the whole point of this stack.

---

## 3. Prerequisites

Check every box before starting. Missing one of these is the #1 cause of a
stalled deployment.

- [ ] **A Google Account** you (or the clinic) control long-term — not a
      personal throwaway account. This account will own the Sheet and the
      Apps Script project. Whoever owns this account can see/edit
      everything, so use one the clinic will still have access to in five
      years (a clinic-owned account, not an individual staff member's
      personal Gmail, is strongly recommended).
- [ ] **A GitHub account**, and permission to create/push to the
      repository that will host the frontend.
- [ ] **A modern browser** — Chrome, Edge, Firefox, or Safari, updated
      within the last year. The app uses ES Modules and Service Workers,
      both of which need a genuinely current browser. Internet Explorer is
      not supported and will not work.
- [ ] **This repository** cloned or available to edit (you're reading its
      docs right now, so you likely already have it).
- [ ] 30–60 minutes uninterrupted. The backend and frontend setup are each
      short, but verification steps take real time — don't rush them.

**You do NOT need:** a paid Google Workspace plan (a free personal Google
Account works), a custom domain, a build toolchain (Node/npm/webpack —
none of it), or command-line git skill beyond `git add`/`commit`/`push`
(the GitHub website's file editor works too, if you prefer no terminal at all).

---

## 4. Repository verification

Before touching Google or GitHub, confirm the repo itself is intact.

### 4.1 Repository health check

- [ ] `index.html` exists at the repo root (not inside a subfolder).
- [ ] `css/app.css`, and all 13 files under `js/` exist:
      `app.js core.js store.js api.js workflow.js ui.js auth.js booking.js
      consultation.js online.js dashboard.js timeline.js reminders.js`
- [ ] `assets/` contains `favicon.png`, `icon-192.png`, `icon-512.png`,
      `logo-horizontal.png`, `logo-mark.png`.
- [ ] `manifest.json` and `sw.js` exist at the repo root.
- [ ] `EnzoBackend.gs` exists at the repo root.

[Screenshot: file tree in GitHub showing all these files present]

> **Common mistake:** downloading the repo as a ZIP and re-uploading only
> some folders (e.g. forgetting `assets/`). If any icon is missing, the
> app will still run, but the PWA install prompt and browser tab icon will
> be broken, and `sw.js`'s install step will simply skip caching that file
> silently (`Promise.allSettled` — see `ARCHITECTURE.md` §14).

---

## 5. Google Sheet creation

### 5.1 Create the Sheet

1. Go to [sheets.google.com](https://sheets.google.com) (or Google Drive →
   New → Google Sheets) while signed into the Google Account chosen in
   §3.
2. Create a **new blank spreadsheet**.
3. Rename it something identifiable, e.g. `Enzo Homoeo — Clinic Data`
   (top-left, click the title text).

[Screenshot: new Google Sheet with title renamed]

> **You do not need to manually create tabs or type column headers.** The
> backend code creates the `Appointments` and `OnlineRecords` tabs
> automatically the first time it needs them (`sheetOf()` in
> `EnzoBackend.gs`), and the first `book`/`online` write appends the
> correct row. The reference tables below are so you understand what
> you'll see appear — not a manual setup task.

### 5.2 Required tabs (created automatically, for your reference)

| Tab name | Purpose |
|---|---|
| `Appointments` | Every booked appointment + its consultation outcome |
| `OnlineRecords` | Online-lead / consultation records not tied to a specific appointment |

### 5.3 Required columns & data types

**`Appointments`** (columns are positional — **never** reorder or insert a
column in the middle once staff have started using the sheet):

| Col | Header (if typed manually) | Type | Notes |
|---|---|---|---|
| A | Name | Text | |
| B | Phone | Text | |
| C | Visit | Date | legacy field |
| D | Days | Number | legacy field |
| E | Type | Text | `Online` or `Offline` |
| F | Follow-up | **Formula**, auto | do not overwrite |
| G | Call | **Formula**, auto | do not overwrite |
| H | Status | Text | legacy `"done"` flag |
| I | Notes | Text | legacy field |
| J | ID | Text | app-generated, don't hand-edit |
| K | Appt Date | Date | |
| L | Slot | Text | e.g. `09:00` |
| M | Stage | Text | `Scheduled/Completed/Cancelled/NoShow` |
| N | Diagnosis | Text | |
| O | Clinical Notes | Text | |
| P | Medicine Duration | Number | |
| Q | Medicine Notes | Text | |
| R | Follow-up Date | Date | |
| S | Outcome | Text | |
| T | Parent Appt ID | Text | set only on auto-generated follow-ups |

**`OnlineRecords`**:

| Col | Header | Type |
|---|---|---|
| A | Name | Text |
| B | Phone | Text |
| C | Place | Text |
| D | Consultation Date | Date |
| E | Referred By | Text |
| F | Notes | Text |
| G | Source Appt ID | Text (blank unless auto-created) |

### 5.4 Common mistakes

- ⚠️ **Manually inserting a column** anywhere in the middle of either
  sheet. This shifts every column reference in `EnzoBackend.gs` and will
  silently corrupt data (write the wrong field into the wrong column) —
  it will not throw an obvious error, so it can go unnoticed for weeks.
- ⚠️ **Editing column F or G directly.** These are formulas
  (`=C+D` and `=K-1`/`=F-1`). Typing over them replaces the formula with a
  static value; the reminder trigger depends on them staying formulas.
- ⚠️ **Renaming the tabs.** The backend looks up tabs by the exact strings
  `Appointments` and `OnlineRecords` (`SHEET_NAME`/`ONLINE_SHEET` constants
  in `EnzoBackend.gs`). Rename either tab and the backend will silently
  create a *new*, empty tab with the expected name the next time it writes
  — your data will look "lost" even though the renamed tab still has it.
- ⚠️ **Sharing the Sheet too broadly.** Anyone with Editor access to the
  Sheet can read every patient's diagnosis and notes directly, bypassing
  the app's login entirely. Share only with staff who need it, at the
  lowest permission level that works (Viewer for anyone who just needs to
  glance at data, not edit it).

---

## 6. Apps Script setup

### 6.1 Project creation

1. In the Google Sheet you just created: **Extensions → Apps Script**.

[Screenshot: Extensions menu → Apps Script]

2. A new tab opens with a default `Code.gs` file containing a placeholder
   `myFunction(){}`. **Select all the placeholder text and delete it.**
3. Open `EnzoBackend.gs` from this repository, copy its **entire
   contents**, and paste it into the empty Apps Script editor.
4. Rename the script file (optional but recommended) from `Code.gs` to
   `EnzoBackend` via the file's `⋮` menu → Rename, so it's obvious what
   this project contains if you ever come back to it.
5. Click the **Save** icon (💾) or press `Ctrl/Cmd+S`.

[Screenshot: Apps Script editor with EnzoBackend.gs pasted in]

### 6.2 Project settings

1. Click the **Project Settings** (⚙️ gear icon) in the left sidebar.
2. Note the **Script ID** — you don't need to copy it anywhere, but it
   confirms this is a distinct project from any other Apps Script project
   you may have.

### 6.3 Timezone

`EnzoBackend.gs` calls `Session.getScriptTimeZone()` (the `tz()` function)
for every date comparison in the app — today's schedule, the bell badge,
Pending vs Upcoming bucketing, and the reminder trigger are all
timezone-sensitive. There are **two places** timezone lives, and they can
drift apart, so set both:

1. **The Google Sheet's own timezone** (cosmetic — affects how dates
   display inside the Sheet itself, and is what a brand-new Apps Script
   project initially copies its timezone from at creation time): in the
   **Sheet**, go to **File → Settings → General → Time zone**, and set it
   to the clinic's actual local timezone (e.g. `(GMT+05:30) India
   Standard Time — Kolkata`).

   [Screenshot: Google Sheet File → Settings → General → Time zone]

2. **The Apps Script project's own timezone** (this is the one
   `Session.getScriptTimeZone()` actually reads at request time — it is
   only *initialized* from the Sheet's timezone when the script project
   is first created, and does **not** automatically follow the Sheet if
   you change the Sheet's timezone later): in the **Apps Script editor**,
   click **Project Settings** (⚙️ gear icon) → under **General settings**,
   check the runtime is **V8** (default since 2020 — don't switch to
   legacy Rhino) and confirm/set the **Time zone** field there directly.

   [Screenshot: Apps Script Project Settings → General settings → Time zone]

   If your Apps Script editor doesn't expose a Time Zone field directly in
   Project Settings, edit it via the manifest instead: still in Project
   Settings, check **"Show 'appsscript.json' manifest file in editor"**,
   open `appsscript.json` from the file list, and set its `"timeZone"`
   field to an IANA timezone string, e.g. `"Asia/Kolkata"`. Save.

> **⚠️ Common mistake:** setting only the Sheet's timezone (step 1) and
> assuming the script follows it automatically — it doesn't, once the
> project already exists. If "today's" appointments are appearing a day
> early or late, or the reminder trigger fires at the wrong local hour,
> **check the Apps Script project's own timezone (step 2), not just the
> Sheet's.** Set both before you start testing, not after.

### 6.4 Manifest (`appsscript.json`)

You generally don't need to hand-edit this — Apps Script manages it. If
you do open it (via the ⚙️ checkbox from §6.3 step 1), confirm:
- `"timeZone"` matches the Sheet's timezone (Apps Script usually keeps
  this in sync automatically; if it looks stale, re-save Project Settings).
- `"webapp"` section only appears after your first deployment (§6.7) —
  it's fine if it's absent before then.

### 6.5 Script Properties — `setCredentials()`

This is where staff usernames/passwords/roles are set. **Passwords are
never stored in the Sheet** — only as SHA-256 hashes inside Apps Script's
Script Properties, which are not visible to anyone without Apps Script
edit access to this specific project.

1. In the Apps Script editor, find the `setCredentials()` function near
   the top of `EnzoBackend.gs`:

   ```js
   function setCredentials(){
     const props = PropertiesService.getScriptProperties();
     props.setProperty('USER_admin',   hash('ChangeThis#2026'));
     props.setProperty('ROLE_admin',   'Administrator');
     props.setProperty('USER_jasmine', hash('AnotherStrongPass'));
     props.setProperty('ROLE_jasmine', 'Receptionist');
   }
   ```

2. **Edit the usernames and passwords** to real values for your clinic.
   Add or remove `props.setProperty(...)` pairs as needed — one
   `USER_<name>` + optional `ROLE_<name>` pair per staff login.
   - `ROLE_<name>` must be exactly `Receptionist`, `Doctor`, or
     `Administrator` (case-sensitive).
   - **Omitting `ROLE_<name>` for a user defaults that user to
     Administrator** (full access) — only add a `ROLE_` line for someone
     you want to *restrict*.
   - Choose strong, unique passwords — see [§14 Security](#14-security).
3. In the function dropdown at the top of the editor toolbar (next to the
   Run/Debug buttons), select **`setCredentials`**.

[Screenshot: Apps Script function dropdown showing setCredentials selected]

4. Click **Run** (▶️).
5. The first run will prompt for authorization:
   - **"Authorization required"** dialog → **Review permissions**.
   - Pick the Google Account (same one from §3/§5.1).
   - You'll see a **"Google hasn't verified this app"** warning — this is
     expected for a script you wrote/pasted yourself, not a red flag.
     Click **Advanced** → **Go to (project name) (unsafe)**.
   - Click **Allow** on the permissions screen (it needs to read/write
     Script Properties and the Sheet).

[Screenshot: "Google hasn't verified this app" warning with Advanced link]
[Screenshot: Allow permissions screen]

6. Confirm it ran: the bottom **Execution log** should show
   `Execution completed` with no red error text.

[Screenshot: Execution log showing "Execution completed"]

### 6.6 Delete `setCredentials()` after running it once

**This step is not optional.** Once you've run it successfully:

1. Select the entire `setCredentials(){ ... }` function block (including
   the closing `}`) and delete it, **or** comment it out by wrapping it in
   `/* ... */`.
2. Save (`Ctrl/Cmd+S`).

> ⚠️ **Why this matters:** `setCredentials()` **overwrites** existing
> credentials every time it runs — including a real password someone
> later changes through some other means. Leaving the function in place
> (even unused) is a live footgun: anyone with edit access to this Apps
> Script project could re-run it and silently reset every login back to
> whatever plaintext passwords are sitting in that function's source code
> — passwords that are now visible in the editor to anyone who opens the
> file. Deleting/commenting it out, and clearing your Apps Script version
> history of it if you're security-conscious, closes that hole.

### 6.7 Deployment

1. Click **Deploy** (top-right) → **New deployment**.
2. Click the **gear icon** next to "Select type" → choose **Web app**.

[Screenshot: Deploy → New deployment → type selector showing Web app]

3. Fill in:
   - **Description:** something like `Enzo Homoeo Clinic v1` (helps you
     track versions later).
   - **Execute as:** **Me** (your Google Account) — this is what lets the
     script read/write the Sheet regardless of who is using the app.
   - **Who has access:** **Anyone** — this sounds alarming, but it is
     correct and expected: the app itself gates access with its own
     username/password + token system (see `ARCHITECTURE.md` §7), not
     Apps Script's access control. Anyone can *reach* the URL, but without
     a valid login they get `{ ok:false, error:'unauthorized' }` for every
     read and write.

[Screenshot: Web app deployment config — Execute as: Me, Who has access: Anyone]

4. Click **Deploy**.
5. You'll be asked to authorize again (same flow as §6.5 step 5) if you
   haven't already for this project — repeat those steps.
6. After deployment finishes, copy the **Web app URL** shown — it looks
   like:
   `https://script.google.com/macros/s/AKfycb.../exec`

[Screenshot: Deployment success dialog showing the /exec URL with a copy button]

**Save this URL somewhere safe (a password manager or internal wiki) —
you'll need it in §8, and again any time you set up a second environment
(e.g. a staging clinic) later.**

### 6.8 Versioning

Every time you click **New deployment** with a *new* deployment (not
"Manage deployments → edit"), you get a **new** URL. For a single
production clinic, you generally want **one** deployment whose URL never
changes — see §11 for how to push updates to that same URL instead of
minting a new one each time.

### 6.9 Permissions

Re-confirm after deployment:
- **Execute as: Me** — if this ever shows a different account, writes may
  fail with a permissions error the next time that account's access to
  the Sheet changes (e.g. if they leave the organization).
- The Google Account you deployed as must remain an **Editor** on the
  Google Sheet at all times. If that access is ever revoked, the entire
  backend breaks silently (500 errors) until access is restored or you
  redeploy under an account that still has it.

### 6.10 Web App URL — verification

Open the `/exec` URL directly in a browser tab (no query params). You
should see:

```json
{"ok":false,"error":"unauthorized"}
```

This is the **correct, expected response** — you're not logged in, so the
backend correctly refuses to answer. If instead you see a Google sign-in
page, an error page, or an HTML page instead of this exact JSON, **stop
and see [§10 Troubleshooting](#10-troubleshooting)** before proceeding —
something in §6.7 needs fixing.

[Screenshot: browser tab showing the raw {"ok":false,"error":"unauthorized"} JSON response]

### 6.11 Optional: daily reminder trigger

1. In the Apps Script editor, click the **clock icon** (Triggers) in the
   left sidebar.
2. **+ Add Trigger** (bottom right).
3. Configure:
   - **Choose which function to run:** `checkFollowUps`
   - **Choose which deployment should run:** `Head`
   - **Select event source:** `Time-driven`
   - **Select type of time based trigger:** `Day timer`
   - **Select time of day:** pick a morning slot, e.g. `7am to 8am`
4. Click **Save**, authorize again if prompted.

[Screenshot: Trigger configuration for checkFollowUps, Day timer, 7-8am]

5. Before relying on this: open `EnzoBackend.gs`, find the `CFG` object
   near the bottom, and set a real email address:

   ```js
   const CFG = {
     clinic: 'Enzo Homoeo Medical Centre',
     email:    { on:true,  to:'your-real-email@gmail.com' },
     whatsapp: { on:false, phone:'91XXXXXXXXXX',  apiKey:'YOUR_CALLMEBOT_KEY' },
     telegram: { on:false, token:'YOUR_BOT_TOKEN', chatId:'YOUR_CHAT_ID' }
   };
   ```

   Leave `whatsapp.on` and `telegram.on` as `false` unless you've actually
   obtained a real CallMeBot API key / Telegram bot token and chat ID.
   Both calls use `muteHttpExceptions:true`, so enabling either with the
   placeholder values will **not** crash the trigger or block the email —
   the call to CallMeBot/Telegram just silently fails (a rejected request
   is fetched and ignored, never thrown), so email delivery is unaffected
   either way. The only consequence is that WhatsApp/Telegram messages
   quietly never arrive until you put in real credentials — there is no
   error to alert you to this, so don't enable a channel you haven't
   actually configured, or you'll believe it's working when it isn't.

6. Save and redeploy (New version, §11) if you edited `CFG` after already deploying.

---

## 7. GitHub Pages setup

### 7.1 Repository settings

1. Push this repository (with your `js/api.js` edit from §8 — do that
   step first, or come back and push again after) to GitHub, to whichever
   branch you want Pages to serve (commonly `main`).
2. On GitHub, open the repository → **Settings** tab.

[Screenshot: repository Settings tab]

### 7.2 Pages

1. In the left sidebar, click **Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a
   branch**.
3. Under **Branch**, choose the **branch** (e.g. `main`) and **folder**
   `/ (root)` — this repo has no `docs/` or `dist/` output folder to
   deploy from; it serves straight from the repo root.

[Screenshot: GitHub Pages settings — branch: main, folder: / (root)]

4. Click **Save**.
5. GitHub will show a banner: *"Your site is live at
   `https://<username>.github.io/<repo>/`"* after a minute or two — refresh
   the Pages settings page if it doesn't appear immediately.

[Screenshot: "Your site is live at ..." banner]

### 7.3 Branch & folder — double-check

- [ ] Branch matches the branch you actually pushed your final,
      configured `js/api.js` to.
- [ ] Folder is `/ (root)`, not `/docs`.

### 7.4 HTTPS

- [ ] Under the same Pages settings, **"Enforce HTTPS"** should be checked
      (GitHub enables this automatically for `github.io` domains — there's
      nothing else to configure unless you're using a custom domain).

### 7.5 Cache

GitHub Pages itself caches aggressively at the CDN edge. Combined with
this app's own service worker cache, **updates can take longer to show up
than you expect** — this is covered in depth in §11's cache-busting steps
and §10's troubleshooting entry. For first-time deployment, this isn't
usually an issue since there's no old cache yet.

### 7.6 Verification

1. Visit `https://<username>.github.io/<repo>/` in a browser.
2. Open **DevTools → Network** tab, reload, and confirm:
   - `index.html` — status 200
   - `css/app.css` — status 200
   - `js/app.js` (and the modules it imports) — status 200
   - Every file under `assets/` — status 200, **not 404**
3. You should see the login screen with the Enzo Homoeo logo (or the text
   fallback `Enzo Homoeo` if the logo image 404s — check the Network tab
   either way).

[Screenshot: DevTools Network tab showing all requests as 200]

> **Most common regression here:** a silently-missing `assets/` file
> (wrong case in a filename — GitHub Pages is case-sensitive even though
> your local filesystem might not be). Check the Network tab, not just
> "does it look okay visually" — a missing PNG doesn't always visually
> break the layout in an obvious way.

---

## 8. Frontend configuration

### 8.1 `WEB_APP_URL`

1. Open `js/api.js` in this repository.
2. Find this line near the top:

   ```js
   export const CONFIG = { WEB_APP_URL: "https://script.google.com/macros/s/AKfycb.../exec" };
   ```

3. Replace the URL string with **your own** `/exec` URL from §6.7 step 6.

   ```js
   export const CONFIG = { WEB_APP_URL: "https://script.google.com/macros/s/YOUR_OWN_DEPLOYMENT_ID/exec" };
   ```

   To deliberately run in **demo mode** instead (fabricated data, useful
   for a quick UI walkthrough before a backend exists), leave it as an
   empty string: `WEB_APP_URL: ""`.

4. Save the file, commit, and push it to the branch GitHub Pages serves
   (§7).

### 8.2 Verification

1. After GitHub Pages has redeployed (usually under a minute after a
   push — check the repo's **Actions** tab for a green checkmark on the
   "pages build and deployment" workflow), open the live site.
2. Open **DevTools → Console** and check for no red errors on load.
3. The login hint text at the bottom of the login card should read
   **"Staff sign in — ask an administrator for your login."** — if it
   instead says **"Demo mode — any username & password works,"**
   `WEB_APP_URL` is still blank; re-check step 8.1.

[Screenshot: login screen showing "Staff sign in — ask an administrator for your login."]

---

## 9. Production testing

Run this full pass against the **real, deployed** site and the **real**
backend before telling staff to start using it. This mirrors
`docs/TESTING.md` but is scoped to "does the deployment work at all,"
not full regression testing.

### 9.1 Login
- [ ] Sign in with a username/password you set in §6.5. Confirm success.
- [ ] Sign in with a wrong password. Confirm you see **"Wrong username or
      password"**, not a silent failure or a server error.
- [ ] Confirm the role badge next to the clinic name in the header shows
      the correct role for that login (Receptionist / Doctor / Administrator).

### 9.2 Booking
- [ ] Book a test appointment: name, phone, type, date, slot.
- [ ] Confirm it appears in **Scheduled → Today** or **Upcoming**.
- [ ] Reload the page and sign in again — confirm the appointment is
      still there (i.e. it actually reached the Sheet, not just local state).
- [ ] Open the Google Sheet directly and confirm a new row appeared in
      `Appointments` with the right data in the right columns.

### 9.3 Edit
- [ ] Edit the test appointment's phone number. Save. Confirm the change
      persists after reload.

### 9.4 Delete
- [ ] Delete the test appointment. Confirm the **Undo** toast appears.
- [ ] Let the toast expire (don't click Undo) — wait 5+ seconds.
- [ ] Reload and confirm the appointment is genuinely gone from the Sheet.

### 9.5 Undo Delete
- [ ] Book another test appointment, delete it, and this time click
      **Undo** within the 5-second window. Confirm it reappears and that
      **no** row was ever removed from the Sheet (or reappears with the
      exact same ID if you check the Sheet timing precisely).

### 9.6 Complete Consultation
- [ ] As a Doctor (or Administrator) login, open **Complete consultation**
      on the test appointment.
- [ ] Fill in Diagnosis, pick a Medicine Duration chip, confirm the
      Follow-up Date preview updates automatically.
- [ ] Save with Outcome = Completed and a follow-up date set.
- [ ] Confirm: the source appointment moves to **Completed**, and a
      **new** Scheduled appointment appears on the follow-up date.
- [ ] Check the Sheet: the original row's Stage/Diagnosis/etc columns are
      filled in, and a new row exists with `Parent Appt ID` set to the
      original row's ID.

### 9.7 Timeline
- [ ] Go to **Timeline**, search the test patient's name or phone.
- [ ] Confirm the booking and the completed consultation both appear,
      newest first.

### 9.8 Dashboard
- [ ] As an Administrator, open **Dashboard**. Confirm KPIs and both
      charts render (not blank, not "Charts unavailable offline" — if you
      see that message while genuinely online, see Troubleshooting §10.11).
- [ ] Switch Week/Month/Year and confirm numbers change.

### 9.9 Online Records
- [ ] Add a test Online Record (Online page). Confirm it appears in the
      list and in the Sheet's `OnlineRecords` tab.

### 9.10 Role System
- [ ] Log in as a Receptionist-role user: booking form visible,
      "Complete consultation" icon **not** shown.
- [ ] Log in as a Doctor-role user: booking form **hidden**, "Complete
      consultation" icon visible on Scheduled rows, Dashboard nav item
      **hidden**.

### 9.11 Offline Queue
- [ ] DevTools → Network → set to **Offline**. Book a test appointment.
      Confirm the "Saved offline — will sync…" toast and the top offline bar.
- [ ] Set Network back to **Online**. Confirm a "Synced 1 offline change"
      toast appears, and the row is now in the Sheet.

### 9.12 PWA
- [ ] On a phone browser (or desktop Chrome's install icon in the address
      bar), install the app. Confirm it opens standalone (no browser
      chrome) with the correct icon and name.
- [ ] Turn on airplane mode and reopen the installed app — confirm the
      shell still loads (login screen visible), proving the service
      worker cached it.

### 9.13 Charts
- [ ] Covered by §9.8 — also confirm the CSV export button on the
      "Online records — referred by" card downloads a file.

### 9.14 Notifications
- [ ] If you set up the daily reminder trigger (§6.11), book a test
      appointment for tomorrow, then either wait for the trigger's
      scheduled time or run `checkFollowUps` manually from the Apps
      Script editor (function dropdown → select it → Run) and confirm the
      configured email arrives.

---

## 10. Troubleshooting

Match the exact symptom below before assuming something exotic is wrong —
the overwhelming majority of issues trace back to one of these.

### 10.1 Browser shows `401`-style `{"ok":false,"error":"unauthorized"}` on every action after logging in
**Cause:** the login session token expired (6-hour lifetime, see
`ARCHITECTURE.md` §7) or was never actually issued.
**Fix:** sign out and back in. If it happens within minutes of logging
in, check the Apps Script project's Script Properties weren't just reset
(e.g. someone re-ran `setCredentials()` — see §6.6).

### 10.2 `{"ok":false,"error":"forbidden"}` (`403`-style) for a specific action
**Cause:** the signed-in user's role doesn't include that action in
`EnzoBackend.gs`'s `CAN` table (e.g. a Receptionist trying to `complete`
a consultation via a direct API call, or a genuine role misassignment).
**Fix:** check that user's `ROLE_<username>` Script Property (§6.5) is
what you intended. Remember: no `ROLE_` property = Administrator, so
"forbidden" for an Administrator-level action pointing at a user you
*meant* to restrict usually means the `ROLE_` property has a typo (role
names are case-sensitive: `Receptionist`, `Doctor`, `Administrator`).

### 10.3 Visiting the site shows a GitHub `404` page
**Cause:** wrong repository/branch/folder in Pages settings (§7.2), or
Pages hasn't finished its first build yet, or `index.html` isn't at the
repo root.
**Fix:** re-check §7.2–§7.3. Check the repo's **Actions** tab for the
Pages build workflow's status — a red X there tells you exactly what
failed.

### 10.4 Backend returns a Google error page / HTML instead of JSON (`500`-style)
**Cause:** almost always an uncaught exception inside `EnzoBackend.gs` —
most commonly a sheet tab was renamed (§5.4), a column was manually
reordered (§5.4), or the deploying account lost Editor access to the
Sheet (§6.9).
**Fix:** In the Apps Script editor, click **Executions** (the list icon)
in the left sidebar to see the actual stack trace of the failed request —
this tells you exactly which line threw. Fix the underlying cause (rename
the tab back, restore column order, re-share the Sheet), then retry —
you do **not** need to redeploy for a Sheet-side fix, only for a code fix.

### 10.5 Apps Script deployment
**Symptom:** "Authorization required" loops endlessly, or Deploy fails silently.
**Fix:** make sure you're deploying while signed into the *same* Google
Account that owns the Sheet. If your organization uses Google Workspace
with restricted app installs, an admin may need to approve the script —
check with your Workspace admin if the authorization screen never
completes.

### 10.6 Wrong URL
**Symptom:** login always fails with "Could not reach the server," or the
app is stuck in Demo mode ("any username/password works") when you
expected a real login.
**Fix:** re-check §8.1 — a stray trailing character, a copy-paste that
grabbed the *editor* URL instead of the *deployment* URL (the editor URL
has `/edit` in it, not `/exec`), or a URL left blank will all cause this.
Paste the exact `/exec` URL from §6.7 step 6, nothing appended.

### 10.7 Wrong Password
**Symptom:** "Wrong username or password" even though you're sure it's right.
**Fix:** passwords are case-sensitive and hashed — there is no "forgot
password" flow (see §14). Re-run a corrected `setCredentials()` (§6.5–6.6)
with the intended password, or see the Operations Runbook's password
reset procedure.

### 10.8 Wrong Token
**Symptom:** actions fail right after a successful login, or work for a
few minutes then start failing.
**Fix:** this is the same as §10.1 — token expiry (6 hours) or
`CacheService` being cleared. Just sign in again; there is nothing to
"fix" beyond that, it's expected session behavior.

### 10.9 Wrong Sheet
**Symptom:** you're editing/testing against one Sheet, but the app shows
data from a different one (or the "original" clinic's data from the
warning in §1).
**Fix:** confirm which Sheet the Apps Script project in §6.1 is actually
**bound to** — a script is permanently tied to the Sheet it was created
from (Extensions → Apps Script *from that Sheet*). If you suspect you're
pointed at the wrong deployment entirely, re-check `js/api.js`'s
`WEB_APP_URL` against the `/exec` URL you copied for *your* deployment.

### 10.10 Wrong Columns
**Symptom:** data appears in the wrong fields in the UI (e.g. phone
number showing where the name should be), or writes silently corrupt
other rows.
**Fix:** see §5.4 — someone inserted/reordered a column. There is no
automatic recovery; you must manually move the data back to the correct
columns in the Sheet, matching the exact layout in §5.3. Consider
restoring from a Sheet version-history checkpoint instead (File → Version
history → See version history) if the corruption is extensive.

### 10.11 Wrong Timezone
**Symptom:** "Today's" appointments show as Pending (a day early) or
tomorrow's show as today; the reminder email fires at the wrong local time.
**Fix:** see §6.3 — check the **Apps Script project's own timezone**
(Project Settings → General settings, or `appsscript.json`'s `"timeZone"`
field). This is the value `Session.getScriptTimeZone()` actually returns;
the Sheet's own File → Settings → General → Time zone only seeds it at
project creation and does not stay in sync afterward.

### 10.12 Service Worker Cache — users don't see your latest changes
**Symptom:** you pushed a fix, verified it's live in an incognito window,
but a staff member's regular browser still shows the old version.
**Fix:** see §11's cache-busting steps — you likely forgot to bump
`sw.js`'s `CACHE` constant. As an immediate workaround on the affected
device: DevTools → Application → Service Workers → **Unregister**, then
hard-refresh (Ctrl/Cmd+Shift+R).

[Screenshot: DevTools Application tab → Service Workers → Unregister button]

### 10.13 GitHub Pages Cache
**Symptom:** even after unregistering the service worker, the *first*
network fetch still returns old content.
**Fix:** GitHub's CDN cache can lag by a few minutes after a push. Wait
2–5 minutes and hard-refresh again. If it persists longer, check the
Actions tab to confirm the Pages deployment workflow actually completed
for your latest commit (it may still be building, or may have failed).

### 10.14 Role Problems
**Symptom:** a staff member sees buttons/pages they shouldn't, or is
missing ones they need.
**Fix:** see §10.2 — check their `ROLE_<username>` Script Property.
Remember the UI hides things, but the authoritative rule is always the
server-side `CAN` table in `EnzoBackend.gs` — if in doubt, that file is
the ground truth for "who can do what."

### 10.15 Offline Queue stuck
**Symptom:** the offline bar says changes will sync, but they never do
even though the device shows as online.
**Fix:** the queued write may be hitting a genuine server-side rejection
(e.g. a slot that's since been taken by someone else) — check the toast
text for an error reason after reconnecting; per `ARCHITECTURE.md` §13,
a rejected write stays queued at the front and blocks the rest behind it.
Open DevTools → Application → Local Storage → find
`enzo_offline_queue_v1` to inspect (or, as a last resort, clear) the
stuck queue on that specific device — clearing it **discards** those
writes, so only do this after manually re-entering the lost data.

### 10.16 Asset Problems (404s on icons/logos)
**Symptom:** broken image icons, PWA install prompt missing/wrong icon.
**Fix:** see §4.1 and §7.6 — confirm every file under `assets/` is
present and correctly cased in the deployed repo.

### 10.17 Chart Problems
**Symptom:** Dashboard shows "Charts unavailable offline" while genuinely online.
**Fix:** `js/dashboard.js` only shows this when `typeof Chart === 'undefined'`
— meaning the Chart.js `<script src="https://cdnjs.cloudflare.com/...">`
tag in `index.html` failed to load. Check DevTools → Network for that
request specifically; a corporate firewall or ad-blocker blocking
`cdnjs.cloudflare.com` is the most common cause. Whitelisting that domain
resolves it — this app does not bundle Chart.js locally by design (see
`ARCHITECTURE.md` §3).

---

## 11. Deployment updates — safe workflow

Once live, you'll periodically ship frontend and/or backend changes.
Follow this order to avoid downtime or a stale-cache incident.

### 11.1 Backend updates

1. Edit `EnzoBackend.gs` in the Apps Script editor (or paste in an updated
   version from git).
2. Save.
3. **Deploy → Manage deployments** → click the **pencil (edit)** icon on
   your existing Web App deployment.

[Screenshot: Manage deployments dialog with pencil/edit icon highlighted]

4. Under **Version**, choose **New version**.
5. Click **Deploy**.

This is the critical part: **editing the existing deployment and picking
"New version" keeps the same `/exec` URL** — the frontend's
`CONFIG.WEB_APP_URL` does not need to change. Do **not** use "New
deployment" for routine updates; that mints a brand-new URL and breaks
every already-deployed frontend pointed at the old one.

### 11.2 Frontend updates

1. Make your changes locally (or via GitHub's web editor).
2. If you changed, added, or removed **any** file listed in `sw.js`'s
   `SHELL` array (or added a new file that should be cached), **bump the
   `CACHE` constant** at the top of `sw.js`, e.g. `enzo-v6` → `enzo-v7`.
   This forces every returning browser to fetch the new shell instead of
   serving the stale cached one.
3. Commit and push to the branch GitHub Pages serves.
4. Wait for the Actions tab to show the Pages workflow green, then
   hard-refresh (or open in an incognito window) to verify.

### 11.3 Safe deployment workflow — the short version

```
Backend change  → Apps Script → Manage deployments → edit → New version → Deploy
                   (same URL, zero frontend impact)

Frontend change → edit files → bump sw.js CACHE if the shell changed
                → commit → push → wait for Pages build → hard-refresh to verify
```

Always test in an **incognito/private window** first — it has no old
service worker or cache to interfere with your verification.

---

## 12. Rollback

Full detail lives in [`ROLLBACK.md`](ROLLBACK.md); summary here for
completeness.

- **Frontend rollback:** `git revert` the offending commit(s), or check
  out the previous known-good commit's files and push. After rollback, do
  a hard refresh (or unregister the service worker, §10.12) on staff
  devices — the old service worker otherwise keeps serving the newer
  cached shell until it naturally re-checks.
- **Backend rollback:** in the Apps Script editor, replace
  `EnzoBackend.gs`'s contents with the previous version (pull it from git
  history: `git show <commit>:EnzoBackend.gs`), then **Deploy → Manage
  deployments → New version → Deploy** (same URL, no frontend change needed).
- **Because Phase 1 only ever appends Sheet columns**, rolling back either
  half never requires undoing a data migration — see `ROLLBACK.md` for the
  exact compatibility matrix of old-frontend/new-backend and vice versa.

---

## 13. Backup strategy

- **Google Sheet:** File → **Make a copy**, or **Download → Microsoft
  Excel (.xlsx)**, on a regular cadence (weekly at minimum; daily for an
  active clinic). Google Sheets also keeps automatic version history
  (**File → Version history → See version history**) which lets you
  restore to any prior point without a manual backup, but don't rely on
  version history alone — it's not a substitute for an exported, offline
  copy.
- **Apps Script code:** this git repository *is* your backup for
  `EnzoBackend.gs` — always keep the Apps Script editor's contents in sync
  with what's committed here, so a corrupted/accidentally-cleared script
  project can be restored by re-pasting from git.
- **Frontend:** the git repository is the backup; GitHub Pages serves
  directly from it, so there's no separate "hosted" state to lose.
- **Script Properties (credentials):** these are **not** exportable from
  the Apps Script UI in bulk. Keep the *plaintext* passwords you chose in
  §6.5 in a password manager (not in this git repository, not in a plain
  text file) — if Script Properties are ever wiped, you'll need to
  re-run a corrected `setCredentials()` with those same passwords, or
  reset everyone's password (Operations Runbook covers this procedure).

---

## 14. Security

- **Never commit real patient data, passwords, or API keys to this git
  repository.** `EnzoBackend.gs`'s `setCredentials()` function is the one
  exception that *must* contain real passwords transiently — and only
  transiently, inside the Apps Script editor, never in a git commit. If
  you ever pasted real passwords into a local copy of `EnzoBackend.gs`
  that also gets committed to git, treat those passwords as compromised
  and rotate them.
- **The `/exec` URL is not a secret in the traditional sense** — anyone
  who knows it can hit `doGet`/`doPost`, but every action requires a valid
  session token, and `login` requires a real password. Still, don't post
  it publicly (a public URL is more attack surface than necessary, even
  if it's not directly exploitable without credentials).
- **Choose strong, unique passwords per staff member** in §6.5 — this app
  has no password complexity enforcement, no rate limiting on login
  attempts, and no account lockout. Weak passwords (`admin`/`admin`) are
  the single biggest realistic risk to this system.
- **Google Sheet sharing** is a second, independent access path into the
  same data (see §5.4's last bullet) — audit who has direct Editor/Viewer
  access to the Sheet itself, not just who has app logins.
- **`Execute as: Me`** (§6.7) means the Apps Script runs with *your*
  Google Account's permissions for every single request from every user —
  this is normal and required for this architecture, but it means the
  deploying account should be one that will remain trustworthy and
  available long-term (see §3's prerequisite note).

---

## 15. Production checklist

Run through this before announcing "we're live" to staff.

- [ ] Google Sheet created, timezone set correctly (§6.3)
- [ ] `EnzoBackend.gs` pasted into Apps Script, `setCredentials()` run
      once and then deleted/commented out (§6.5–6.6)
- [ ] Web App deployed with **Execute as: Me**, **Who has access: Anyone** (§6.7)
- [ ] `/exec` URL opened directly, confirmed it returns
      `{"ok":false,"error":"unauthorized"}` (§6.10)
- [ ] Daily reminder trigger configured (optional, §6.11), `CFG.email.to`
      set to a real address if enabled
- [ ] `js/api.js`'s `CONFIG.WEB_APP_URL` updated to **your** deployment's
      URL, not the placeholder that shipped with this repo (§8.1)
- [ ] GitHub Pages live at its `github.io` URL, serving from the correct
      branch/root folder (§7)
- [ ] All assets return 200 in the Network tab, no 404s (§7.6)
- [ ] Full production test pass completed (§9) — every checkbox
- [ ] At least one real staff login tested end-to-end, not just the admin
      account you set up first
- [ ] A backup of the (still-empty-or-test-data) Sheet taken, so you have
      a known-good restore point before real patient data starts flowing (§13)

---

## 16. Deployment completion checklist

Final sign-off — everything below should be true before this guide is "done":

- [ ] Backend deployed and verified independently of the frontend (§6.10)
- [ ] Frontend deployed and verified independently of the backend (§7.6)
- [ ] Frontend correctly configured to talk to *this* deployment's backend,
      not the placeholder URL shipped in the repo (§8, and the warning in §1)
- [ ] Every item in §9's production testing pass is checked off
- [ ] Every item in §15's production checklist is checked off
- [ ] Whoever will operate this day-to-day has read
      [`OPERATIONS-RUNBOOK.md`](OPERATIONS-RUNBOOK.md)
- [ ] Backup and rollback procedures (§12–13) are understood by at least
      one person with access to both the Sheet and the GitHub repo

**Tip:** keep this checklist (with your checkmarks) somewhere the whole
team can see it — it doubles as your incident-response reference the
first time something breaks in production.
