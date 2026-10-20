/* SleepSmooth service worker (hand-written, no libraries). The build (vite.config.ts) fills in BUILD_ID and PRECACHE and
 * writes the result to dist/sw.js. It only caches the static app shell. It never caches user data:
 *  - non-GET requests and cross-origin requests are not intercepted at all;
 *  - recordings and answers never travel over fetch (they stay in the page), and only same-origin build files are ever stored;
 *  - requests with a Range header and anything outside the build file list or /assets/ pass straight through to the network.
 */
/* global self, caches, fetch, URL, Response */
const BUILD_ID = '__BUILD_ID__';
const PRECACHE = __PRECACHE__;
const CACHE = `sleepsmooth-shell-${BUILD_ID}`;
const scope = self.registration.scope;
const abs = (p) => new URL(p, scope).href;
const PRECACHE_URLS = PRECACHE.map(abs);
const INDEX_URL = abs('index.html');
const ASSET_PREFIX = abs('assets/');

self.addEventListener('install', (event) => {
  // No skipWaiting: a new version waits until old tabs close, so an open page never loses its lazy chunks.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sleepsmooth-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const stripSearch = (u) => {
  const x = new URL(u);
  x.search = '';
  x.hash = '';
  return x.href;
};

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    // Keep the freshest copy of the page itself (static HTML only), under its address without the query string.
    if (res.ok && res.type === 'basic') await cache.put(stripSearch(request.url), res.clone());
    return res;
  } catch {
    return (await cache.match(stripSearch(request.url))) || (await cache.match(INDEX_URL)) || Response.error();
  }
}

async function cacheFirst(request, storeMisses) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const res = await fetch(request);
  if (storeMisses && res.ok && res.type === 'basic') await cache.put(request.url, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  const clean = stripSearch(request.url);
  if (clean.startsWith(ASSET_PREFIX)) {
    // Hashed build files never change under the same name: cache first.
    event.respondWith(cacheFirst(request, true));
    return;
  }
  if (PRECACHE_URLS.includes(clean)) {
    // Other shell files (manifest, icons, sample clip, policy pages): the stored copy, else the network.
    event.respondWith(cacheFirst(request, false));
  }
});
