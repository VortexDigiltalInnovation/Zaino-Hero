/* Zaino Hero — service worker. Cache dell'app per l'uso offline.
   Cambia VERSION a ogni rilascio: i telefoni vedranno «Nuova versione pronta». */
const VERSION = 'zaino-hero-v11';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon.ico',
  './img/hero-mantello.webp', './img/hero-visore.webp', './img/hero-orario.webp', './img/hero-trofeo.webp',
  './img/avatar-mantello.webp', './img/avatar-visore.webp', './img/avatar-orario.webp', './img/avatar-trofeo.webp'];
/* Lettori di copertine e codici (pesanti, circa 7 MB): scaricati in background e poi sempre dalla cache. */
const VENDOR = ['./vendor/zxing/zxing-reader.iife.js', './vendor/zxing/zxing_reader.wasm',
  './vendor/tesseract/tesseract.min.js', './vendor/tesseract/worker.min.js',
  './vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js', './vendor/tesseract/core/tesseract-core-lstm.wasm.js',
  './vendor/tesseract/lang/ita.traineddata.gz'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => {
  if (e.data !== 'warm-vendor') return;
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(VENDOR.map(async (u) => {
    if (await c.match(u)) return;
    const res = await fetch(u); if (res.ok) await c.put(u, res);
  }))));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  /* librerie in vendor/: prima la cache (sono file fissi e pesanti) */
  if (new URL(req.url).pathname.includes('/vendor/')) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  /* resto: rete prima (così gli aggiornamenti arrivano subito), cache se offline. */
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
