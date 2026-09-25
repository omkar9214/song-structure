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
const V = '20260925-9';
const CACHE = 'song-structure-' + V;

const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  `./app.css?v=${V}`, `./config.js?v=${V}`, `./icons.js?v=${V}`,
  `./db.js?v=${V}`, `./cloud.js?v=${V}`, `./app.js?v=${V}`
];

/* Fonts and the Supabase library live on other origins. They were never
   actually being cached: a plain cross-origin fetch gives an opaque response,
   and Cache.put() refuses those — so the put rejected silently and every
   offline load fell back to the system font with no sync library. Both
   servers send access-control-allow-origin, so they are asked for with CORS,
   which produces a response that can be stored. */
const CDN = /^https:\/\/(fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net)\//;
const CDN_FILES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];
const corsReq = url => new Request(url, { mode: 'cors', credentials: 'omit' });

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    /* the other origins too — never fail the install over them */
    await Promise.all(CDN_FILES.map(u => c.add(corsReq(u)).catch(() => {})));
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
      /* ignoreVary: Google Fonts varies on the user agent, and a cached copy
         that does not match the header exactly is still the right file */
      const hit = await caches.match(req, { ignoreVary: true });
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        if (fresh && fresh.ok && fresh.type !== 'opaque') {
          c.put(req, fresh.clone()).catch(() => {});
        } else if (fresh) {
          /* opaque: unstorable as it is, so fetch a CORS copy to keep */
          c.add(corsReq(req.url)).catch(() => {});
        }
        return fresh;
      } catch (_) {
        return hit || Response.error();
      }
    })());
  }
  /* everything else — the Supabase API — is left alone */
});
