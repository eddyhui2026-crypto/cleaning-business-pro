/**
 * Service Worker for Web Push: show notification and open app on click.
 * Payload: { title, body?, url?, tag? }
 */
self.addEventListener('push', function (event) {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: 'Notification', body: event.data.text() || '' };
  }
  const title = payload.title || 'CleanFlow';
  const options = {
    body: payload.body || '',
    tag: payload.tag || 'default',
    data: { url: payload.url || '/' },
    icon: '/vite.svg',
    badge: '/vite.svg',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  const fullUrl = url.startsWith('http') ? url : self.location.origin + (url.startsWith('/') ? url : '/' + url);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url.startsWith(self.location.origin) && 'focus' in clientList[i]) {
          clientList[i].navigate(fullUrl);
          return clientList[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl);
    })
  );
});
