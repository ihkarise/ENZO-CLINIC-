# Setting up the ENZO Gut Health Score — no coding needed

Everything below is done by clicking around on the **GitHub website** and, for
your own web address, on your **domain provider's website** (GoDaddy,
Hostinger, Namecheap, BigRock, etc.). You do not need to install anything.

There are two stages. Do Stage 1 first. Stage 2 is optional.

| Stage | Result | Time |
|---|---|---|
| 1. Turn it on | Live at `https://ihkarise.github.io/ENZO-CLINIC-/score/` | 10 minutes |
| 2. Own address (optional) | Live at e.g. `https://score.yourclinic.com` | 30 minutes + waiting for the domain |

---

## Before you start: one quick check

The score app is finished but **not live yet**. It sits in a separate copy of
the code (a "branch") named `claude/gut-health-score`. Turning it on also
changes one line in the staff app's offline file, so do this 5-minute check
afterwards (see Stage 1, step 6).

---

## Stage 1 — Turn it on

1. Sign in at **github.com** and open **github.com/ihkarise/ENZO-CLINIC-**.
2. Click the **Pull requests** tab, then the green **New pull request** button.
3. Set the two drop-downs to: **base: `main`** ← **compare: `claude/gut-health-score`**.
   You'll see the list of new files (everything under `score/` and a 1-line change to `sw.js`).
4. Click **Create pull request**, give it a title like "Add Gut Health Score", and
   click **Create pull request** again.
5. Click **Merge pull request**, then **Confirm merge**.
6. Wait about **5 minutes**, then check:
   - Open **https://ihkarise.github.io/ENZO-CLINIC-/score/** on your phone. Do the
     assessment once from start to finish.
   - Open the staff app **https://ihkarise.github.io/ENZO-CLINIC-/**, log in, and
     check that today's appointments, booking and the patient timeline look normal.

That's it. You can share the `/score/` link on WhatsApp, Instagram, a QR code, etc.

**If it shows "404":** wait another 5–10 minutes and refresh. GitHub takes a moment to publish.

**To undo:** on the merged pull request page, click **Revert**, then
**Create pull request** → **Merge pull request**. The staff app goes back to
exactly how it was.

---

## Changing the settings (booking link, privacy page, emergency number)

All the settings are in one file. Edit it on the GitHub website:

1. In the repository, open the folders **score** → **js** → click **config.js**.
2. Click the **pencil icon** (✏️ "Edit this file"), top right of the file.
3. Near the top you'll see a block called `SITE`. Only change the text **between the
   quote marks `' '`**. Don't delete the quotes, commas or anything else.

   | Line | What to put between the quotes | Example |
   |---|---|---|
   | `bookingUrl: ''` | The web page where patients book, or the clinic's WhatsApp link. While it's empty, patients see "please contact the clinic directly". | `bookingUrl: 'https://wa.me/91XXXXXXXXXX'` (use the clinic's real number, country code first, no `+` or spaces) |
   | `privacyUrl: ''` | Link to your privacy policy page, if you have one. Leave empty to hide it. | `privacyUrl: 'https://yourclinic.com/privacy'` |
   | `emergencyNumber: '112'` | Emergency number for your area. 112 is India's national number. | leave as `'112'` |

4. Click the green **Commit changes…** button, then **Commit changes** again.
5. Wait 2–5 minutes, then refresh the score page. On your phone you may need to close and reopen the tab.

**Question wording, score ranges and the disclaimer** are in the same file
further down. They were written to your exact specification, so only change
them if the clinic decides to. Change only the text between quotes, the same way.

---

## Stage 2 — Your own web address (optional)

You need a domain you already own (e.g. `yourclinic.com`). You'll create
`score.yourclinic.com` for free.

**Why a new repository?** GitHub gives each repository only one custom address.
If you added it to ENZO-CLINIC-, the **staff app** would move to that address too.
So the score app gets its own small repository.

### A. Make a copy of the score app in a new repository

1. On **github.com/ihkarise/ENZO-CLINIC-**, click the green **Code** button →
   **Download ZIP**. Unzip it on your computer and open the **score** folder inside.
2. On GitHub, click **+** (top right) → **New repository**.
   - Name: `enzo-gut-score`
   - Choose **Public** (free GitHub Pages needs a public repository).
   - Tick **Add a README file**.
   - Click **Create repository**.
3. In the new repository click **Add file** → **Upload files**.
4. Select **everything inside** the `score` folder (`index.html`, `css`, `js`,
   `assets`, and the rest) and drag it all into the browser window. Drag what's
   *inside* the folder, **not** the `score` folder itself.
5. Click **Commit changes**.

### B. Switch on the website

1. In `enzo-gut-score` go to **Settings** → **Pages** (left menu).
2. Under **Build and deployment**: Source = **Deploy from a branch**, Branch =
   **main**, folder **/ (root)** → **Save**.
3. After about 2 minutes it shows "Your site is live at
   `https://ihkarise.github.io/enzo-gut-score/`". Open it and check it works.

### C. Point your address at it

1. **At your domain provider** (log in → your domain → **DNS** / **Manage DNS** /
   **DNS records**), click **Add record**:

   | Field | Enter |
   |---|---|
   | Type | `CNAME` |
   | Name / Host | `score` |
   | Value / Points to / Target | `ihkarise.github.io` |
   | TTL | leave the default |

   Save it. Don't change or delete any other records, because they run your main website and email.
2. **Back on GitHub** → `enzo-gut-score` → **Settings** → **Pages** → **Custom
   domain**: type `score.yourclinic.com` → **Save**.
3. Wait. GitHub shows "DNS check in progress". This usually takes 10 minutes to a
   few hours, and occasionally up to 24 hours.
4. When it shows a green tick, tick **Enforce HTTPS**. If the box is greyed out,
   wait an hour and come back. GitHub is still preparing the security certificate.
5. Open `https://score.yourclinic.com` and do the assessment once.

**Important:** from now on, change settings (Stage "Changing the settings") in the
**`enzo-gut-score`** repository. Its `config.js` is at **js** → **config.js**.

**To undo Stage 2:** delete the `score` CNAME record at your domain provider, and
in `enzo-gut-score` → Settings → Pages, remove the custom domain. The staff app is
never affected.

---

## Things to know

- **Patients don't log in, and nothing is saved.** Answers stay on the patient's own
  phone and disappear when they close the page. The clinic **does not receive**
  results. Patients can tap **Print result** and bring it to the consultation.
- **Saving results to the clinic's Google Sheet isn't switched on.** That needs a
  developer to add a new, secured part to the Apps Script. See `README.md` §8.
- **If a patient ticks a warning sign** (e.g. blood in stool, chest pain), the result
  page shows a safety message first, with a button to call the emergency number,
  whatever their score.
- The score is an **educational tool, not a diagnosis**. The disclaimer is shown
  before and after the assessment. Please keep it.
