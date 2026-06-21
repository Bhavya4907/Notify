/**
 * SVNIT Hostel Notice Watcher (Web Push edition)
 * ------------------------------------------------
 * Scrapes the student notice page, and for any NEW notice matching
 * hostel/room/allotment keywords, sends a Web Push notification directly
 * to the browser subscribed via public/index.html — no third-party app.
 *
 * State:
 *  - seen_notices.json   : notices already seen (avoid re-alerting)
 *  - subscription.json   : your browser's push subscription (from index.html)
 *
 * Secrets needed (set as GitHub Actions secrets):
 *  - VAPID_PUBLIC_KEY
 *  - VAPID_PRIVATE_KEY
 */

const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const NOTICE_URL = 'https://www.svnit.ac.in/web/student_notice.php';
const SEEN_FILE = path.join(__dirname, 'seen_notices.json');
const SUB_FILE = path.join(__dirname, 'subscription.json');

const KEYWORDS = [
  'hostel',
  'room allot',
  'room allotment',
  'allotment',
  'room selection',
  'room booking',
  'hostel allotment',
  'seat allotment',
  'accommodation'
];

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = 'mailto:placeholder@example.com'; // contact, any mailto: works

function loadJson(file, fallback) {
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function fetchNotices() {
  const res = await fetch(NOTICE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HostelWatcher/1.0)' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching notice page`);
  const html = await res.text();

  // Minimal HTML parsing without extra deps: regex over <li>...<a href="...">TEXT</a>
  const notices = [];
  const liRegex = /<li[^>]*>[\s\S]*?<\/li>/gi;
  const aRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;

  const liMatches = html.match(liRegex) || [];
  for (const li of liMatches) {
    const m = li.match(aRegex);
    if (!m) continue;
    const link = m[1].trim();
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    if (title.length < 8 || !link) continue;
    notices.push({ title, link });
  }
  return notices;
}

function matchesKeywords(title) {
  const lower = title.toLowerCase();
  return KEYWORDS.some((kw) => lower.includes(kw));
}

async function sendPush(subscription, title, link) {
  const fullLink = link.startsWith('http') ? link : `https://www.svnit.ac.in${link}`;
  const payload = JSON.stringify({
    title: '🏠 Hostel Notice Alert!',
    body: title,
    url: fullLink
  });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  try {
    await webpush.sendNotification(subscription, payload);
    console.log(`Push sent for: ${title}`);
  } catch (err) {
    console.error(`Push failed (status ${err.statusCode}): ${err.message}`);
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.error('Subscription expired/invalid — you need to resubscribe via index.html and update subscription.json.');
    }
  }
}

async function main() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars. Set them as GitHub Actions secrets.');
    process.exit(1);
  }

  const subscription = loadJson(SUB_FILE, null);
  if (!subscription) {
    console.log('No subscription.json found yet — open index.html, subscribe, and commit the JSON. Skipping push step.');
  }

  const notices = await fetchNotices();
  if (notices.length === 0) {
    console.log('No notices parsed — page structure may have changed.');
    return;
  }

  const seen = new Set(loadJson(SEEN_FILE, []));
  const currentKeys = notices.map((n) => `${n.title}|${n.link}`);
  const newOnes = notices.filter((n) => !seen.has(`${n.title}|${n.link}`));

  if (newOnes.length === 0) {
    console.log('No new notices.');
  } else {
    console.log(`Found ${newOnes.length} new notice(s).`);
    for (const n of newOnes) {
      console.log(`  NEW: ${n.title}`);
      if (matchesKeywords(n.title)) {
        if (subscription) {
          await sendPush(subscription, n.title, n.link);
        } else {
          console.log('    (matches keywords, but no subscription saved yet)');
        }
      } else {
        console.log('    (no keyword match, not alerting)');
      }
    }
  }

  saveJson(SEEN_FILE, currentKeys);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
