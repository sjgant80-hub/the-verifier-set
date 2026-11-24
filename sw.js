// sw.js: after the first visit, the page and its data load from this device; the model is cached by WebLLM itself.
// This worker only ever touches caches whose names start with "the-verifier-set-": other pages on this site, and the model
// library's own caches, are left alone.
const CACHE = 'the-verifier-set-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'SEAL.json', 'data/settings.json', 'data/published.json', 'data/gates.json', 'data/seed.json', 'vendor/PROVENANCE.json'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {})));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('the-verifier-set-') && k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.includes('/the-verifier-set/')) return;
  // network first, so a published run appears as soon as it is published; the cache when offline
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
