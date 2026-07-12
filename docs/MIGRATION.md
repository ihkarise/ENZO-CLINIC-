# Migration guide — upgrading to Phase 1 (Foundation + Workflow)

This upgrades an existing live Enzo Homoeo deployment (old single-file
`index.html` + old `EnzoBackend.gs`) to the Phase 1 modular build. It is
designed to be a **zero-downtime, backward-compatible** upgrade: no
existing column moves, no existing row is rewritten, no existing formula
is touched.

## What changes on the Google Sheet

`EnzoBackend.gs` only **appends** eight new columns to the `Appointments`
sheet, after the existing `L Slot` column:

| Col | Field |
|---|---|
| M | Stage (`Scheduled` \| `Completed` \| `Cancelled` \| `NoShow`) |
| N | Diagnosis |
| O | Clinical Notes |
| P | Medicine Duration |
| Q | Medicine Notes |
| R | Follow-up Date |
| S | Outcome |
| T | Parent Appointment ID (set on auto-generated follow-ups) |

Columns A–L and their formulas are untouched. **Every row that existed
before this migration will have a blank Stage cell — the app treats a
blank Stage as `Scheduled`.** That means every historical appointment will
initially show up under Scheduled → Pending (since its date is in the
past). This is expected and harmless (Pending is just a filter, nothing
fires automatically), but if you'd rather not see years of old rows in
Pending:

- Run a one-off script (or a manual sheet edit) to set `Stage = Completed`
  on any row whose appointment date is in the past and was, in fact,
  completed. A short Apps Script snippet:

  ```js
  function backfillStage(){
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Appointments');
    const data = sheet.getDataRange().getValues();
    const today = new Date(); today.setHours(0,0,0,0);
    for(let i = 1; i < data.length; i++){
      const r = data[i];
      if(!r[0] || r[12]) continue;                 // skip blank rows / already staged
      const appt = r[10];                           // column K
      if(appt && new Date(appt) < today) sheet.getRange(i+1, 13).setValue('Completed');
    }
  }
  ```

  Run this once from the Apps Script editor after deploying the new
  `EnzoBackend.gs`, review the result, then delete the function.

## What changes in login / roles

`login()` now also returns a `role`. Any username without an explicit
`ROLE_<username>` Script Property **defaults to Administrator** — so
nothing changes for staff who are already logging in today until you
explicitly assign `Receptionist` or `Doctor` to specific usernames.

## Steps

1. **Back up the Sheet.** File → Make a copy (or download as .xlsx)
   before touching anything.
2. In the Apps Script editor, replace the contents of `EnzoBackend.gs`
   with the Phase 1 version. Save.
3. Re-deploy: Deploy → Manage deployments → edit the existing deployment
   → New version → Deploy. (Keep the same URL — `CONFIG.WEB_APP_URL` in
   `js/api.js` does not need to change.)
4. Deploy the new static files (`index.html`, `css/`, `js/`, `assets/`,
   `manifest.json`, `sw.js`) to GitHub Pages as usual.
5. Load the app once as staff and confirm the bell/dashboard still show
   the expected data (see `docs/TESTING.md`).
6. Optionally run the `backfillStage` snippet above.
7. Optionally assign `ROLE_<username>` Script Properties for staff who
   should be restricted to Receptionist or Doctor.

## Rolling back

See `docs/ROLLBACK.md` — because nothing existing was overwritten, rollback
is just redeploying the previous `EnzoBackend.gs`/site; the extra columns
are simply ignored by the old frontend if you ever need to go back.

## Migrating further, to Phase 3 (Patient Master)

If you're upgrading straight from this Phase 1 base (or from Phase 2) to
Phase 3, see [`PATIENT-MASTER.md`](PATIENT-MASTER.md) — it adds one new
tab (`Patients`) and one new column each to `Appointments`/`OnlineRecords`,
using the exact same append-only, backward-compatible approach described
above, and links your existing rows to a patient automatically, once, the
first time the app runs after upgrading. No manual step required.

## Migrating to Phase 3.5 (Reception + Doctor daily workflow)

**No Google Sheet change.** No columns are added, moved or renamed.

Steps:
1. Replace the website files: all of `js/` (including the new `js/morning.js`),
   `css/app.css`, and `index.html`.
2. Paste the updated `EnzoBackend.gs` and **re-deploy the Web App**.
3. OPD Numbers are now **typed by reception**; the external OPD provider is
   gone. You may delete the unused `OPD_PROVIDER_*` Script Properties.
4. (Optional) Add a daily time-driven trigger on `sendMorningReport` and enable
   the channels in Settings → Notifications. Set `CFG.doctor` in the script.

Nothing to convert — existing patients keep their OPD Numbers; new patients get
a reception-typed one (checked for uniqueness).
