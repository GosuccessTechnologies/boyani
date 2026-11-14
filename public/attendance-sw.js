/**
 * MUDHIERO NURSING HOME ATTENDANCE PWA — service worker.
 * ⚠️ REGISTERED WITH SCOPE '/attendance/' ONLY (see attendance/layout.tsx).
 * A previous version was registered at root scope and intercepted ALL site
 * navigations, which broke streamed RSC pages on production (e.g. /news/[slug]
 * opening then dying with "This page couldn't load"). This version:
 *   - hard-guards every fetch to /attendance/* paths only,
 *   - never caches or serves HTML for any other route,
 *   - safely awaits streaming bodies before cache.put.
 */
const CACHE_NAME = 'mudhiero-attendance-v3';
const PRECACHE_URLS = ['/attendance', '/manifest.json', '/favicon.svg', '/logo.svg'];
const ATTENDANCE_PREFIX = '/attendance';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept API traffic
  if (url.pathname.startsWith('/api/')) return;
  // ⚠️ CRITICAL GUARD: only /attendance* pages are handled.
  // Every other route (public website, dashboards, dynamic [slug] pages)
  // passes straight through to the network untouched.
  if (!url.pathname.startsWith(ATTENDANCE_PREFIX)) return;

  // Network-first for navigations (fresh pages when online, cache fallback offline)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          try {
            const copy = res.clone();
            // Fully consume the (possibly streamed) body before caching —
            // cloning without reading can stall the original response.
            const cache = await caches.open(CACHE_NAME);
            await cache.put(req, copy);
          } catch (_e) { /* cache failures must never break navigation */ }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match('/attendance') || Response.error();
        })
    );
    return;
  }

  // Cache-first for static assets within the attendance scope
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then(async (res) => {
        if (res.ok) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(req, res.clone());
          } catch (_e) { /* ignore */ }
        }
        return res;
      });
    })
  );
});
