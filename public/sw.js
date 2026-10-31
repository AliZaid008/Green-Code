// خدمة تخزين مؤقت: الصفحة تفتح فوراً حتى مع إنترنت ضعيف. الـ API لا يُخزَّن أبداً.
const C = 'gc-v21', SHELL = ['/', '/map.html', '/report.html', '/css/style.css?v=21', '/js/common.js?v=21', '/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL).catch(() => {}))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname === '/config.js' || u.pathname.startsWith('/uploads/')) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then(x => { const c = x.clone(); caches.open(C).then(ch => ch.put(r, c)); return x; }).catch(() => caches.match(r).then(m => m || caches.match('/')))); return; }
  e.respondWith(caches.match(r).then(m => m || fetch(r).then(x => { if (x.ok) { const c = x.clone(); caches.open(C).then(ch => ch.put(r, c)); } return x; })));
});
