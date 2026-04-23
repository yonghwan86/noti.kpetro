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
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== 'noti-app-v1'; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return clients.claim();
    })
  );
});

// Network-first fetch handler — required for Samsung Internet PWA install validation
var CACHE_NAME = 'noti-app-v1';

self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) return;

  // Skip API requests — always use network for fresh data
  if (request.url.includes('/api/')) return;

  event.respondWith(
    fetch(request)
      .then(function(response) {
        // Cache valid responses for offline fallback
        if (response && response.status === 200 && response.type === 'basic') {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        // Fallback to cache if network fails
        return caches.match(request);
      })
  );
});
