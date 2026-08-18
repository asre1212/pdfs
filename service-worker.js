/* Offline cache so the app works with no connection after first load.
 * BUILD is stamped by the GitHub Pages deploy workflow (see
 * .github/workflows/deploy.yml). Each deploy produces a new cache name, so a
 * new version fully replaces the old cached assets. When serving from a plain
 * branch deploy (no Actions), the placeholder stays as-is and acts as a stable
 * version string — bump it by hand if you change assets without the workflow. */
const BUILD = '__BUILD_VERSION__';
const CACHE = 'scanshrink-' + BUILD;
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './version.json',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './vendor/pdf-lib.min.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (e) => {
  // Pre-cache the new version's assets, but wait to activate until the app
  // tells us to (via SKIP_WAITING) so updates apply cleanly.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('message', (e) => {
  if (!e.data) return;
  // The page asks the freshly-installed worker to take over immediately.
  if (e.data.type === 'SKIP_WAITING') self.skipWaiting();
  // The page asks which build it is actually running, for the version line
  // and the "Check for updates" button.
  if (e.data.type === 'GET_VERSION' && e.ports && e.ports[0]) {
    e.ports[0].postMessage({ version: BUILD });
  }
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // version.json says which build is *deployed*, so it must never come from
  // the cache — a cached copy would report the version we already have.
  // Network-first, falling back to the precached copy when offline.
  if (new URL(req.url).pathname.endsWith('/version.json')) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // cache-first: everything else is local & static
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      // Only cache real responses — a cached 404 would outlive the mistake.
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
