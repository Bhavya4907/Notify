# Hostel Notice Watcher — Web Push Edition

Your own website + GitHub Action that sends a real browser push notification
straight to your phone/laptop the moment SVNIT posts a hostel/room-allotment
notice. No third-party app (no ntfy, no Pushover) — just your browser's
built-in push notification system, same tech Gmail/Twitter use.

## How it works
- `public/index.html` — a page you open once to grant notification permission
- `public/sw.js` — service worker that displays the notification when it arrives
- `watcher.js` — runs every 3 min via GitHub Actions, scrapes the notice page,
  and pushes directly to your subscribed browser if a hostel-related notice appears
- No database, no always-on server — state lives in JSON files committed to the repo

## One-time setup (~10 minutes)

### 1. Generate your VAPID keys
VAPID keys are how your pushes get cryptographically signed as "from you" —
generate your own, don't reuse any example.

```bash
npm install
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

This prints a `publicKey` and `privateKey`. Save both somewhere safe.

### 2. Push this code to a GitHub repo
```bash
cd hostel-push
git init
git add .
git commit -m "Initial commit"
gh repo create hostel-push --public --source=. --push
```

**Must be a public repo** — GitHub Pages free tier only works on public repos
(unless you're on GitHub Pro/Team). Nothing sensitive lives in this repo as
long as you don't commit your VAPID private key (it goes in Secrets, not code).

### 3. Add GitHub Actions secrets
Repo → Settings → Secrets and variables → Actions → New repository secret:
- `VAPID_PUBLIC_KEY` = the publicKey from step 1
- `VAPID_PRIVATE_KEY` = the privateKey from step 1

### 4. Enable GitHub Pages
Repo → Settings → Pages → Source: **GitHub Actions** (not "Deploy from branch")

### 5. Put your public key into the website
Edit `public/index.html`, find this line near the bottom:
```js
const VAPID_PUBLIC_KEY = "PASTE_YOUR_VAPID_PUBLIC_KEY_HERE";
```
Replace with your actual public key from step 1. Commit and push — this
triggers the Pages deployment automatically.

### 6. Find your live URL
Repo → Settings → Pages will show something like:
`https://<your-username>.github.io/hostel-push/`

### 7. Subscribe
- Open that URL **on your phone**, in Chrome (Android) or Safari (iPhone)
- **iPhone only**: tap Share → "Add to Home Screen" first, then open the page
  from the home screen icon (iOS only allows push for installed web apps)
- **Android**: works directly in a normal Chrome tab, no install needed
- Tap "Enable Notifications", allow when prompted
- Tap "Send Test Notification" to confirm it displays
- Copy the JSON shown into `subscription.json` in your repo (replace the
  `null` placeholder), commit and push

### 8. Verify the watcher runs
Actions tab → "Hostel Notice Watcher (Web Push)" → confirm it's enabled →
"Run workflow" to trigger manually → check logs

## Important caveats (read these)
- **iPhone web push needs the page installed to Home Screen** — a plain
  Safari tab won't receive background push on iOS. This is an Apple
  restriction, not something fixable in code.
- **Subscriptions expire/break** sometimes (browser updates, clearing data,
  reinstalling). If pushes stop arriving, redo step 7.
- **Keep the repo active** — GitHub disables scheduled Actions after 60 days
  of repo inactivity. Push any small commit to re-enable if it's been dormant.
- **One device only** in this version — `subscription.json` holds a single
  subscription. If you want alerts on two devices, you'd need to store an
  array of subscriptions instead (ask me if you want this — quick change).
- **3-minute interval is best-effort** — GitHub may delay scheduled runs by a
  few extra minutes under load. For something this important, still check
  the page yourself once a day during allotment season as backup.

## Tuning
- Edit `KEYWORDS` array in `watcher.js` to adjust what triggers an alert
- Edit the cron schedule in `.github/workflows/watch.yml` (don't go below
  every 3 minutes — GitHub may throttle very frequent schedules)
