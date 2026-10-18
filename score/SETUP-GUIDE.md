# Setting up the ENZO Gut Health Score — no coding needed

Everything below is done by clicking around on the **GitHub website** and, for
your own web address, on your **domain provider's website** (GoDaddy,
Hostinger, Namecheap, BigRock, etc.). You do not need to install anything.

There are two stages. Do Stage 1 first. Stage 2 is optional.

| Stage | Result | Time |
|---|---|---|
| 1. Turn it on | Live at `https://ihkarise.github.io/ENZO-CLINIC-/score/` (English + Malayalam, WhatsApp leads) | 10 minutes |
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

## What patients see

1. **Choose language**: two big buttons, **English** or **മലയാളം**. They can switch
   at any time with the button at the top right; their answers are kept.
2. Intro → 8 questions (one per screen) → safety check → result.
3. At the top of the result: **"How did you score? Contact your doctor and know your
   score"** with a big green **Send my score on WhatsApp** button. One tap opens
   WhatsApp to **+91 99863 19779** with a message already typed, e.g.:

   ```
   Hello Doctor,
   I just completed the ENZO Gut Health Score™.

   *My score: 12/24 – Moderate reported symptoms*
   Highest areas: Abdominal pain 3/3, Daily-life impact 3/3
   Area scores: Bloating and gas 2/6 · Acidity and reflux 2/3 · ...
   Warning signs: none of the listed signs

   Can we do something about this? Please tell me more.
   ```
   (In Malayalam if they chose Malayalam.) The patient just presses **Send**. Every
   message that arrives on the clinic's WhatsApp Business is a lead with their score.
4. **Book a Consultation** lower down also opens WhatsApp, with "I would like to book a
   consultation."
5. If a patient ticks a danger sign (e.g. chest pain), the **emergency message (call
   112) is shown above the WhatsApp button**, on purpose.

**Tip for WhatsApp Business:** set up a *Quick Reply* or *Label* (e.g. "Gut Score lead")
so reception can tag these chats quickly.

---

## Changing the settings

All the settings are in one file: **score → js → config.js**. To edit it:

1. Open the file on GitHub and click the **pencil icon** (✏️).
2. Change only the text **between the quote marks `' '`**.
3. Click **Commit changes…** → **Commit changes**. Wait 2–5 minutes and refresh.

| Line | What it does | Now set to |
|---|---|---|
| `whatsappNumber: '919986319779'` | The WhatsApp number that gets the leads. Country code first, digits only. | 919986319779 |
| `bookingUrl: ''` | Only if you get a separate booking website. Empty = the booking button uses WhatsApp. | empty |
| `privacyUrl: ''` | Link to a privacy policy page. Empty = hidden. | empty |
| `emergencyNumber: '112'` | Emergency number shown with danger signs. | 112 |

## Changing the wording (English or Malayalam)

All the words are in **score → js → i18n.js**: first the English part (`en:`), then
the Malayalam part (`ml:`). Edit it exactly like `config.js`: change only text
between quotes. Be careful not to remove a quote mark `'`, a comma `,` or a `${…}`
part (those insert the score or number automatically).

After editing, open the page and go through it once in **both** languages.

---

## Adding photos (optional)

There are 3 picture slots in the folder **score → assets**. Two of them are empty
placeholders that stay hidden until you replace them, so the site looks finished
without them.

| File | Where it shows | Size to make it | Notes |
|---|---|---|---|
| `assets/photos/doctor.jpg` | Round photo on the green "Contact your doctor" WhatsApp card | **600 × 600 px**, square, JPG, under 150 KB | Face in the centre, plain background. Shown as a 96 px circle. |
| `assets/photos/hero.jpg` | Big picture on the intro page (replaces the stomach drawing) | **1000 × 1000 px**, square, JPG, under 300 KB | Shown in a soft rounded shape; keep the subject in the middle. |
| `assets/share.jpg` | The preview card when the link is shared on WhatsApp/Facebook | **exactly 1200 × 630 px**, JPG, under 300 KB | Already made for you. Replace only if you want your own design. Keep text inside the middle 1000 × 520 px. |

**How to upload a photo:**

1. Make the photo the right size (free: canva.com → *Custom size*, or squoosh.app to
   shrink the file). Save it as **JPG** with **exactly the same name**, e.g. `doctor.jpg`
   (all small letters).
2. On GitHub open **score → assets → photos**.
3. Click **Add file → Upload files**, drag your `doctor.jpg` in, and click
   **Commit changes**. It replaces the placeholder.
4. Wait 2–5 minutes and refresh the result page. The photo appears by itself.

To remove a photo later, open it on GitHub, click **⋯ → Delete file**, commit. The
page simply hides that slot again.

**WhatsApp preview not updating?** WhatsApp remembers old previews for a while. Test with
the link plus `?v=2` at the end (e.g. `…/score/?v=2`).

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

6. In the new repository open **index.html** (pencil icon) and replace the two
   addresses that start with `https://ihkarise.github.io/ENZO-CLINIC-/score/` with
   `https://score.yourclinic.com/` (keep `assets/share.jpg` at the end of the first one).
   This makes the WhatsApp link preview show on your own address.

**Important:** from now on, change settings (Stage "Changing the settings") in the
**`enzo-gut-score`** repository. Its `config.js` is at **js** → **config.js**.

**To undo Stage 2:** delete the `score` CNAME record at your domain provider, and
in `enzo-gut-score` → Settings → Pages, remove the custom domain. The staff app is
never affected.

---

## Things to know

- **Patients don't log in, and nothing is saved on the website.** Answers stay on the
  patient's phone. The clinic only receives a result when the patient taps the
  WhatsApp button **and** presses Send. They can read or change the message first.
- WhatsApp messages contain health information. Keep the clinic phone locked and only
  let authorised staff use the WhatsApp Business account.
- **Saving results to the clinic's Google Sheet isn't switched on.** That needs a
  developer to add a new, secured part to the Apps Script. See `README.md` §8.
- **If a patient ticks a warning sign** (e.g. blood in stool, chest pain), the result
  page shows a safety message first, with a button to call the emergency number,
  whatever their score.
- The score is an **educational tool, not a diagnosis**. The disclaimer is shown
  before and after the assessment. Please keep it.
