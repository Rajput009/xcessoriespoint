/* XccessoriesPoint service worker — offline shell + static caching */
const CACHE = "xp-v1";
const CORE = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // API: network only (never cache dynamic data)
  if (url.pathname.startsWith("/api")) return;

  // navigations: network-first, offline fallback to cached shell.
  // admin pages are never cached — a stale admin shell can render old UI
  // against a newer API (and vice versa) after a deploy
  if (e.request.mode === "navigate") {
    if (url.pathname.startsWith("/admin")) return;
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // static assets: cache-first with background refresh
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return r;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
