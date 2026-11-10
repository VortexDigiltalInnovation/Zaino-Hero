/* Zaino Hero — service worker (offline).
   Per rilasciare un aggiornamento: cambia VERSION qui E APP_VERSION in app.js (stesso numero). */
const VERSION = 'zaino-hero-v7';
const ASSETS = ['./', './index.html', './styles.css?v=7', './app.js?v=7', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

/* Ogni file viene salvato da solo: se uno manca sul server l'installazione NON fallisce
   (prima bastava un file mancante per bloccare per sempre gli aggiornamenti). */
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
/* Prima la rete (gli aggiornamenti arrivano subito), la cache solo se sei offline. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
