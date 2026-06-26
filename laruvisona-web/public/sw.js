const CACHE_NAME = 'bridge-v4';
const STATIC_ASSETS = ['/manifest.json', '/laruhp_logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/') || e.request.url.includes('/relay')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }
  // network-first: 常に最新を取りに行き、オフライン時のみキャッシュへフォールバック。
  // （cache-first だと新しいデプロイが反映されず、古い JS が動き続けてしまう）
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && res.type !== 'opaque') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// Push notifications
self.addEventListener('push', e => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'Bridge', {
      body: data.body || 'タスクが完了しました',
      icon: '/laruhp_logo.png',
      badge: '/laruhp_logo.png',
      tag: data.tag || 'bridge',
      data: { url: data.url || '/laruHP/bridge' },
      vibrate: [100, 50, 200],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/laruHP/bridge';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const match = wins.find(w => w.url.includes('/laruHP'));
      if (match) { match.focus(); match.postMessage({ type: 'notification_click', url }); }
      else self.clients.openWindow(url);
    })
  );
});

// Background sync
self.addEventListener('sync', e => {
  if (e.tag === 'bridge-sync') {
    e.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'bg_sync' }))
      )
    );
  }
});
