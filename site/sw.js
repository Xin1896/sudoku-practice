const CACHE_PREFIX = "sudoku-practice-";
const CACHE_VERSION = "2026-08-03-1";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const INDEX_URL = new URL("./index.html", self.registration.scope).href;
const PRECACHE_URLS = Object.freeze([
  "./index.html",
  "./styles.css",
  "./js/app.js",
  "./js/puzzles.js",
  "./js/storage.js",
  "./js/sudoku.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME,
          )
          .map((cacheName) => caches.delete(cacheName)),
      );
      await self.clients.claim();
    })(),
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    const url = new URL(request.url);

    if (
      response.ok &&
      response.type === "basic" &&
      (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"))
    ) {
      await cache.put(INDEX_URL, response.clone());
    }

    return response;
  } catch {
    const fallback = await cache.match(INDEX_URL);
    if (fallback !== undefined) {
      return fallback;
    }

    return Response.error();
  }
}

function staleWhileRevalidate(request, event) {
  const cachePromise = caches.open(CACHE_NAME);
  const networkResponse = (async () => {
    const cache = await cachePromise;

    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return null;
    }
  })();

  event.waitUntil(networkResponse);

  return (async () => {
    const cache = await cachePromise;
    const cachedResponse = await cache.match(request);

    if (cachedResponse !== undefined) {
      return cachedResponse;
    }

    return (await networkResponse) ?? Response.error();
  })();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});
