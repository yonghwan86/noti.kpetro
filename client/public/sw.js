self.addEventListener('push', function(event) {
  let data = { title: '업무 알림', body: '새로운 알림이 있습니다.', url: '/' };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '확인하기' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options).then(function() {
      return self.registration.getNotifications();
    }).then(function(notifications) {
      if (navigator.setAppBadge) {
        return navigator.setAppBadge(notifications.length);
      }
    }).catch(function() {})
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.registration.getNotifications().then(function(notifications) {
      if (notifications.length === 0 && navigator.clearAppBadge) {
        return navigator.clearAppBadge();
      } else if (navigator.setAppBadge) {
        return navigator.setAppBadge(notifications.length);
      }
    }).catch(function() {}).then(function() {
      return clients.matchAll({ type: 'window', includeUncontrolled: true });
    }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
