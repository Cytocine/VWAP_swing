// Service worker for the Z-Score/EMA21 Backtester PWA.
// Only the static "app shell" is cached (this file, the HTML, manifest, icons and the
// charting library). Live requests to Alpaca's market-data API are always fetched fresh
// from the network and are never cached, since cached price/quote data would be stale
// and misleading for a trading tool.

const CACHE_NAME = 'zs-ema-backtester-shell-v1';

const SHELL_ASSETS = [
  './alpaca_zscore_atr_backtester.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch((err) => {
      // Don't let a single failed asset (e.g. offline first install) block activation
      console.error('SW precache failed:', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isLiveDataRequest(url) {
  return url.hostname.endsWith('alpaca.markets');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache live market data / API calls - always hit the network directly.
  if (isLiveDataRequest(url)) {
    return; // let the browser handle it normally (no respondWith = passthrough)
  }

  // Cache-first for the app shell, falling back to network (and caching the result)
  // for anything else same-origin/CDN so the app keeps working offline after first load.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline and not cached - nothing we can do for this asset
    })
  );
});
