const SHELL_CACHE = "etop-mobile-shell-v22";
const DATA_CACHE = "etop-mobile-data-v22";
const ASSETS = [
  "./index.html",
  "./styles.css?v=22",
  "./app.js?v=22",
  "./etop-core.js",
  "./herramientas.html",
  "./herramientas-shell.css?v=22",
  "./icon.svg",
  "./manifest.webmanifest"
];

const DATA_HOSTS = [
  "tutoriaonlinepostgrado.github.io",
  "raw.githubusercontent.com"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      Promise.allSettled(ASSETS.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
            .map((k) => caches.delete(k))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Network-first with cache fallback for ETOP catalog & incidents JSON
  if (
    DATA_HOSTS.includes(url.hostname) &&
    (url.pathname.endsWith("/nrcs.json") || url.pathname.endsWith("/incidencias.json"))
  ) {
    const cacheKey = new Request(url.origin + url.pathname);
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(cacheKey, copy));
          }
          return response;
        })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match("./index.html")))
    );
    return;
  }

  if (ASSETS.some((a) => new URL(a, self.registration.scope).pathname === url.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
