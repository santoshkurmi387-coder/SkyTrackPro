/**
 * sw.js — SkyTrack Pro Service Worker
 * Handles web push notification receipt and display.
 * Place this file in /client/public/sw.js
 */

const CACHE_NAME = 'skytrack-v1';
const OFFLINE_URL = '/';

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean old caches
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
    ])
  );
});

// ── Push Notification Handler ──────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = {
    title: 'SkyTrack Pro',
    body: 'You have a new update',
    icon: '/logo192.png',
    badge: '/badge.png',
    tag: 'skytrack-notification',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (err) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/badge.png',
    tag: data.tag || 'skytrack-notification',
    renotify: true,
    requireInteraction: data.tag?.includes('exception') || data.tag?.includes('delivered'),
    data: data.data,
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification Click Handler ─────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Notification Close Handler ─────────────────────────────────────────────────
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// ── Fetch Handler (basic offline) ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for the app shell
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request) || caches.match(OFFLINE_URL))
  );
});
