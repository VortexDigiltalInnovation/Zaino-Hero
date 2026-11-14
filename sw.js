/* Zaino Hero — service worker (offline).
   Per rilasciare un aggiornamento: cambia VERSION qui E APP_VERSION in app.js (stesso numero),
   e anche "?v=" in index.html. Poi ricarica TUTTI i file sul sito. */
const VERSION = 'zaino-hero-v26';
const ASSETS = ['./index.html', './styles.css?v=26', './app.js?v=26', './manifest.json', './bg/fiori.webp', './bg/farfalle.webp', './bg/unicorno.webp', './bg/cuori.webp',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon.ico'];
/* Lettori di codici e copertine (circa 8 MB): scaricati in background e poi sempre dalla cache. */
const VENDOR = ['zxing-reader.iife.js', 'zxing_reader.wasm', 'tesseract.min.js', 'tesseract-worker.min.js',
  'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js', 'ita.traineddata'];
const isVendor = (u) => VENDOR.some((v) => new URL(u).pathname.endsWith('/' + v));

/* Ogni file viene salvato da solo: se uno manca sul server l'installazione NON fallisce. */
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => Promise.all(ASSETS.map((u) => fetch(u, { cache: 'reload' }).then((r) => { if (r.ok) return c.put(u, r); }).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  if (e.data !== 'warm-vendor') return;
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(VENDOR.map(async (v) => {
    const u = new URL('./' + v, self.registration.scope).href;
    if (await c.match(u)) return;
    const res = await fetch(u); if (res.ok) await c.put(u, res);
  }))));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (isVendor(req.url)) { /* file pesanti e fissi: prima la cache */
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  /* Prima la rete (gli aggiornamenti arrivano subito), la cache solo se sei offline. */
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
