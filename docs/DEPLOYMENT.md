# Deployment guide

Two independent pieces to deploy: the Apps Script backend (Google Sheet)
and the static frontend (GitHub Pages or any static host).

## 1. Backend — Google Sheet + Apps Script

1. Create (or open the existing) Google Sheet for the clinic.
2. Extensions → Apps Script. Delete any placeholder code, paste in the
   full contents of `EnzoBackend.gs`.
3. Open `setCredentials()` at the top of the file, edit the
   usernames/passwords (and optionally `ROLE_<username>`), run it once
   from the Apps Script editor (Run → `setCredentials`), grant the
   permissions it asks for, then delete or comment the function out so it
   can't be re-run accidentally.
4. Deploy → New deployment → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (the app itself gates access with the
     username/password + token, not Apps Script's access control)
5. Copy the resulting `/exec` URL.
6. (Optional but recommended) Triggers → Add trigger →
   `checkFollowUps` → Time-driven → Day timer → pick a morning slot, so
   reception gets the daily "today's schedule / call today" email.
7. Edit `CFG` in `EnzoBackend.gs` (email address, and WhatsApp/Telegram if
   you have those set up) before relying on the reminder.

Redeploying later: Deploy → Manage deployments → pencil icon on the
existing deployment → New version → Deploy. This keeps the same `/exec`
URL, so the frontend config doesn't need to change.

## 2. Frontend — static hosting (GitHub Pages)

1. In `js/api.js`, set `CONFIG.WEB_APP_URL` to the `/exec` URL from step 1
   above. Leave it as an empty string only if you deliberately want demo
   mode (fabricated data, no backend).
2. Commit and push to the branch GitHub Pages serves from (or push to
   `main` and enable Pages on it in the repo settings, source: branch,
   folder `/`).
3. GitHub Pages serves the repo root as-is — no build step. Confirm:
   - `index.html` loads `css/app.css` and `js/app.js` with 200s (check
     the Network tab, not just visually — a silently-missing `assets/`
     file is the most common regression here).
   - The service worker registers (`Application` tab → Service Workers →
     status "activated and is running").
4. Test the login flow end-to-end against the real backend, then run
   through `docs/TESTING.md`.

### Why "no build system" matters here

There is no bundler, no `npm install`, nothing to get out of sync between
a developer's machine and what GitHub Pages serves. Every file in the repo
is exactly the file the browser downloads. When editing, you can open
`index.html` in a simple static server (`python3 -m http.server` or
`npx serve`) and refresh — no compile step, no stale build artifacts.

**ES modules require a real HTTP server** — opening `index.html` directly
via `file://` will fail on the `import`/`export` statements due to browser
CORS restrictions on local files, and the service worker won't register at
all. Always serve over `http://localhost` or `https://`.

## 3. Local development

```
python3 -m http.server 8080
# then open http://localhost:8080
```

Set `CONFIG.WEB_APP_URL = ""` in `js/api.js` locally to work against demo
data without touching the production Sheet, and revert before committing.
