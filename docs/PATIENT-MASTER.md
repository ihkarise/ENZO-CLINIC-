# Patient Master — what it is and how to use it (Phase 3)

Written in plain English for clinic staff and for whoever installs the
update. No jargon.

## The problem this solves

Before this update, the app tried to guess whether two appointments
belonged to the same patient by comparing the name and phone number it had
on file. That guess broke in ordinary, everyday situations:

- **Thomas George**, phone `9876543210` — booked again later as
  **Thomas G**, same phone. The app might not recognise it's the same
  person.
- Same patient, but they changed their phone number the second time — the
  app has no way to connect the two visits at all.

Every time the guess failed, the app created what looked like a brand-new
patient. Their history split in two. The Timeline, which is supposed to
show "everything about this patient in one place", showed only half the
story.

## The fix

Every patient now gets **one permanent identity** the moment they're first
seen — a **Patient ID** (used internally) and an **OPD Number** (the
number staff actually see and say out loud, e.g. `ENZO-000123`). Every
appointment, every online record, and every future module (billing,
prescriptions, lab results, the patient portal) points at that same
identity. Nothing ever guesses again.

- **OPD Number** — a simple, sequential number: `ENZO-000001`,
  `ENZO-000002`, `ENZO-000003`, and so on. It is generated automatically,
  is never reused, and is never edited. It's what you write on a
  prescription, say to a patient, or search for.
- **Patient ID** — a longer internal code the app uses behind the scenes
  to link records together. Staff don't need to type or remember it.

## Where patient information lives

A new tab in the Google Sheet called **Patients**, one row per patient,
forever:

| Column | What it holds |
|---|---|
| Patient ID | Internal permanent code |
| OPD Number | e.g. `ENZO-000123` — shown and searched everywhere |
| Name | |
| Phone | |
| Gender | (optional — filled in later; the booking form doesn't ask for it yet) |
| DOB | (optional — same as above) |
| Address | (optional) |
| Email | (optional) |
| Created Date | When this patient record was first made |
| Updated Date | When it was last changed |
| Status | `Active` by default |
| Notes | (optional) |

The **Appointments** and **OnlineRecords** tabs each gained one new column
at the end — **Patient ID** — that links every row back to a row in
**Patients**. Their existing Name/Phone columns are untouched and still
filled in, so the sheet still reads fine on its own; Patient ID is just
the new, reliable way the *app* decides "is this the same patient",
instead of comparing text.

## How duplicate detection works at the booking desk

1. Reception starts typing the patient's **phone number** in the booking
   form.
2. The moment a full phone number is typed, the app checks: *has this
   phone number been seen before?*
3. **If yes** — a "Returning patient" card appears showing their OPD
   Number, name, last visit date and last diagnosis (if any), with a
   **View timeline →** link. Reception picks one of two buttons:
   - **Use existing** — the new appointment is linked to that same
     patient. This is also what happens automatically if reception just
     carries on booking without picking anything — the safe default is
     always to reuse the match, never to accidentally create a duplicate.
   - **Create new anyway** — for the rare case where two different people
     genuinely share a phone number (a shared clinic line, a family
     phone). A brand-new patient and a brand-new OPD Number are created.
4. **If no match is found**, nothing gets in the way — a new patient is
   created quietly the moment the appointment is booked, with the next
   OPD Number in sequence.

Editing an *existing* appointment never re-runs this check — an
appointment's patient never changes just because someone tweaked the date
or slot.

## The Timeline, rebuilt

Search the Timeline by **OPD Number, Patient ID, name, phone, diagnosis or
notes**. Selecting a patient shows a **Patient Profile card** — OPD, Name,
Phone, Age (when a date of birth is on file), Gender, Visit Count, Last
Visit — followed by every appointment, online consultation, diagnosis,
medicine and follow-up entry for that patient, newest first. This same
search also works from the Booking page, Online Records, and a quick
lookup box on the Dashboard — one search, everywhere.

## Migrating existing data — nothing to do by hand

If you already have appointments and online records from before this
update, **you do not need to run anything or touch the Google Sheet
yourself.** The first time anyone opens the app after the update, it
notices which rows don't yet have a Patient ID and, in the background:

1. Groups those rows by phone number (the same rule the booking desk uses
   — an exact phone match).
2. Creates one Patient Master row per distinct phone number found, each
   getting the next OPD Number in sequence.
3. Writes the matching Patient ID back onto every appointment and online
   record row.

This runs **once**, ever — a flag is saved so it never repeats. It only
*adds* a Patient ID to existing rows; it never changes, deletes, or
reorders anything else in your sheet. No old data is lost. If two rows
already have the exact same phone number, they become the same patient —
which is the whole point of this update.

**A row with no phone number on file always becomes its own new patient
— there is no name-matching fallback.** Matching is phone-only, on
purpose (matching by name risks merging two different real people who
happen to share one). If your old records include a lot of walk-ins or
online leads with no phone recorded, expect the Patients tab and the OPD
sequence to grow by roughly one entry per such row — this is normal, not
a bug, and doesn't lose or corrupt anything; it just means those old rows
can't be told apart from each other automatically.

**A note on accuracy:** the migration can only match on what the data
already has. If the same patient's old rows used two *different* phone
numbers (the exact problem this update fixes going forward), the
migration will still create two separate patients for those old rows,
because there is no other way to know they're the same person from the
data alone. Going forward this can't happen again, because every new
appointment is deliberately linked at the time it's booked. If you spot an
old case like this, you can merge it by hand in the Google Sheet: pick the
Patient ID you want to keep, and change the Patient ID cell on the other
person's Appointments/OnlineRecords rows to match it.

## What did NOT change

- Booking still only asks for Name, Phone, Consultation type, Date, Time
  slot — no new fields were added to the form. Gender/DOB/Address/Email
  exist as columns in Patients for later use (a future module, or manual
  entry in the Sheet) but nothing in today's UI requires them.
- No existing column moved. No existing row was rewritten beyond adding
  the one new Patient ID cell.
- The Google Sheet, Apps Script deployment URL, and login credentials are
  all unchanged — this is a "New version" redeploy, not a new setup.

## Known limitation

Two patients can only be told apart by **phone number**. A patient with no
phone on file (or two different patients sharing one phone, if "Use
existing" was picked by mistake) can't be told apart automatically. Use
"Create new anyway" deliberately when you know it's a different person,
and see "Migrating existing data" above for how to fix a mismatch by hand.
