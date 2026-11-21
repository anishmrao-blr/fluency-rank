// Offline support: precache every app file, serve cache-first, refresh the cache in the background.
// Bump VERSION on every release. Every new file must be listed in PRECACHE (test/pwa.test.js checks this).
const VERSION = 'v1';
const PRECACHE = ["./","index.html","manifest.webmanifest","fonts/fonts.css","fonts/barlow-condensed-500.woff2","fonts/barlow-condensed-600.woff2","fonts/barlow-condensed-700.woff2","fonts/ibm-plex-mono-400.woff2","fonts/ibm-plex-mono-500.woff2","fonts/ibm-plex-sans-400.woff2","js/main.js","js/util.js","js/content.js","js/state.js","js/rules.js","js/ui.js","js/drills.js","js/views.js","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png"];
const CACHE = 'fluency-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('fluency-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
