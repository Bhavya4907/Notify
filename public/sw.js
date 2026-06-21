// Service worker — runs in the background, even when the page is closed.
// Its only job: when a push arrives, show a notification.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Hostel Notice', body: event.data ? event.data.text() : 'New notice posted.' };
  }

  const title = data.title || '🏠 Hostel Notice Alert!';
  const options = {
    body: data.body || 'A new hostel notice was posted.',
    icon: data.icon || 'icon.png',
    badge: data.icon || 'icon.png',
    data: { url: data.url || 'https://www.svnit.ac.in/web/student_notice.php' },
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true, // stays on screen until dismissed
    tag: 'hostel-notice'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the notification opens the notice link
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) ||
              'https://www.svnit.ac.in/web/student_notice.php';
  event.waitUntil(clients.openWindow(url));
});
