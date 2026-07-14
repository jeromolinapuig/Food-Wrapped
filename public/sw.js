self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? '' };
  }

  const title = payload.title || 'Burger Wrapped';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo.png',
    badge: payload.badge || '/logo.png',
    tag: payload.tag,
    data: payload.data || { url: '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const relativeUrl = event.notification.data?.url || '/';
  const targetUrl = new URL(relativeUrl, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingWindow = windows.find((client) => client.url === targetUrl);
    if (existingWindow) return existingWindow.focus();

    const appWindow = windows.find((client) => client.url.startsWith(self.location.origin));
    if (appWindow) {
      await appWindow.navigate(targetUrl);
      return appWindow.focus();
    }

    return self.clients.openWindow(targetUrl);
  })());
});

// Basic passthrough; push support does not require an offline cache strategy.
self.addEventListener('fetch', () => {});
