// オフラインでも開けるようにシェルと暗号化済み本体をキャッシュする（ネット優先・3秒で諦めてキャッシュ）
const C = 'warp-103029e75b';
const CORE = ['./', 'app.bin', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // 運行情報フィードは素通し
  const key = u.pathname.endsWith('/app.bin') ? new Request(u.origin + u.pathname) : e.request;
  e.respondWith((async () => {
    const cache = await caches.open(C);
    try {
      const net = await Promise.race([fetch(e.request), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000))]);
      if (net.ok) cache.put(key, net.clone());
      return net;
    } catch (err) {
      const hit = await cache.match(key, { ignoreSearch: true });
      if (hit) return hit;
      return fetch(e.request);
    }
  })());
});
