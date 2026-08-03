const CACHE_PREFIX = "sudoku-practice-";
const CACHE_VERSION = "2026-08-03-2";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const APP_ROOT_URL = new URL(self.registration.scope).href;
const INDEX_URL = new URL("./index.html", APP_ROOT_URL).href;
const NOT_FOUND_URL = new URL("./404.html", APP_ROOT_URL).href;
const INDEX_PATHNAME = new URL(INDEX_URL).pathname;
const APP_ROOT_PATHNAME = new URL(APP_ROOT_URL).pathname;
const SHELL_PATHS = Object.freeze([
  "./index.html",
  "./404.html",
  "./styles.css",
  "./js/app.js",
  "./js/puzzles.js",
  "./js/storage.js",
  "./js/sudoku.js",
  "./manifest.webmanifest",
  "./icon-192.png",
]);
const SHELL_URLS = new Set(SHELL_PATHS.map((path) => new URL(path, APP_ROOT_URL).href));

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(SHELL_PATHS);
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

function isEntryNavigation(url) {
  return url.pathname === APP_ROOT_PATHNAME || url.pathname === INDEX_PATHNAME;
}

async function serveCachedShell(url) {
  const cache = await caches.open(CACHE_NAME);
  return (await cache.match(url)) ?? Response.error();
}

async function networkFirstNonEntryNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    return serveCachedShell(NOT_FOUND_URL);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    if (isEntryNavigation(url)) {
      event.respondWith(serveCachedShell(INDEX_URL));
    } else {
      event.respondWith(networkFirstNonEntryNavigation(request));
    }
    return;
  }

  if (SHELL_URLS.has(url.href)) {
    event.respondWith(serveCachedShell(url.href));
  }
});
