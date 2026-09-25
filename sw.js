/* Song Structure — offline service worker.

   The point of this file is a gig: the venue has no signal, the phone is in
   airplane mode, and the chart still has to open. Everything the app needs is
   kept in a cache after the first online visit.

   Two rules keep the cache from ever serving something stale:
     · a navigation (the HTML) always tries the network first — the cache is
       only the fallback, so a deploy is picked up the moment there is signal;
     · every asset URL carries ?v=…, so a new HTML asks for URLs that are not
       in the cache and they come from the network.

   V must match the ?v= stamp in index.html. If it drifts, nothing breaks —
   the assets are simply cached on first use instead of at install. */
const V = '20260925-3';
const CACHE = 'song-structure-' + V;

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  `./app.css?v=${V}`, `./config.js?v=${V}`, `./icons.js?v=${V}`,
  `./db.js?v=${V}`, `./cloud.js?v=${V}`, `./app.js?v=${V}`
];

/* fonts and the Supabase library live on other origins; cache them when they
   answer, never fail the install over them */
const CDN = /^https:\/\/(fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net)\//;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k.startsWith('song-structure-')).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       /* Supabase writes go straight out */
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  /* the page itself: network first, cache as the safety net */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        /* GitHub Pages caches index.html for ten minutes, and the worker's own
           fetch goes through that cache — so ask the server to revalidate, or a
           deploy stays invisible long after it is live */
        const fresh = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
        (await caches.open(CACHE)).put('./index.html', fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match(req)) || (await caches.match('./index.html')) ||
               new Response('Offline, and this device has no copy yet.', { headers: { 'content-type': 'text/plain' } });
      }
    })());
    return;
  }

  if (sameOrigin) {
    e.respondWith((async () => {
      const hit = await caches.match(req);               /* exact URL — ?v= included */
      if (hit) return hit;
      const fresh = await fetch(req);
      if (fresh && fresh.ok) (await caches.open(CACHE)).put(req, fresh.clone());
      return fresh;
    })());
    return;
  }

  if (CDN.test(req.url)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      const net = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) caches.open(CACHE).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => hit);
      return hit || net;                                  /* stale while revalidating */
    })());
  }
  /* everything else — the Supabase API — is left alone */
});
