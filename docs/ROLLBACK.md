# Rollback guide

Phase 1 was built to be safely reversible: the backend only **appends**
columns (nothing existing moves or is rewritten), and the frontend is a
set of static files replacing an older set of static files. Rollback is
"redeploy the previous version" on each side — no data migration to undo.

## Frontend rollback

If GitHub Pages is serving from a branch:

```
git revert <range-of-phase-1-commits>   # or
git checkout <previous-known-good-commit> -- index.html css js sw.js manifest.json assets
git commit -m "Roll back to pre-Phase-1 frontend"
git push
```

Or simpler: redeploy the previous commit directly (`git revert` is
preferred over `reset --hard` since it preserves history and is safe to
push).

After rollback, do a hard refresh (or clear the service worker in
DevTools → Application → Service Workers → Unregister) on any staff
device, since the old service worker will otherwise keep serving the
Phase 1 cached shell until it naturally re-checks for updates.

## Backend rollback

1. Apps Script editor → replace `EnzoBackend.gs` with the previous
   version (keep a copy of the pre-Phase-1 file before upgrading, or pull
   it from git history: `git show <pre-phase-1-commit>:EnzoBackend.gs`).
2. Deploy → Manage deployments → New version → Deploy (same URL, no
   frontend config change needed).

**The new columns M–T (Stage, Diagnosis, Clinical Notes, Medicine
Duration, Medicine Notes, Follow-up Date, Outcome, Parent Appointment ID)
are simply ignored by the old backend/frontend** — you do not need to
delete them to roll back. Any consultation data recorded during the
Phase 1 period stays in the sheet, just inert until you roll forward
again.

## Partial rollback (keep backend, revert frontend only)

Safe to do independently — the old frontend never reads columns M–T, and
the new backend still serves the old columns (A–L) exactly as before, so
an old frontend against a new backend keeps working for booking/edit/
delete. You lose Complete Consultation / Timeline / role gating in the UI
until you roll forward, but nothing breaks.

## Partial rollback (keep frontend, revert backend only)

**Not recommended** — the Phase 1 frontend calls the `complete` action,
which does not exist in the old backend, so Complete Consultation will
fail with "unknown action". Booking/edit/delete/online still work (those
actions are unchanged). If you must do this temporarily, be aware
Complete Consultation is effectively disabled until the backend is rolled
forward again.

## Verifying a rollback worked

Run the "PWA / offline shell / security" section of `docs/TESTING.md` and
confirm the booking form shows the old fields (Visited on, Medicine given
for, timeline card) again, and that `EnzoBackend.gs`'s `doPost` no longer
recognizes `action: 'complete'`.

## Rolling back Phase 3 (Patient Master)

Same principle as above — Phase 3 only ever *appends* (one new `Patients`
tab, one new column each on `Appointments`/`OnlineRecords`). Rolling back
the frontend only, keeping the Phase 3 backend, works fine for booking/
online: the old frontend never sends a `patientId`, and the backend's own
phone-match fallback (`findOrCreatePatient`) resolves one anyway — you
just lose the duplicate-detection card and the rebuilt Timeline/search in
the UI until you roll forward again. Rolling back the backend only, keeping
the Phase 3 frontend, is **not recommended**: the frontend calls
`createPatient`/`?action=patients`, which don't exist in a pre-Phase-3
backend, so booking's duplicate detection and the Timeline will fail.
Either roll both back together, or keep the backend on Phase 3 and only
roll back the frontend.
