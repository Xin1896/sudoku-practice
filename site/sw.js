const CACHE_PREFIX = "sudoku-practice-";
const CACHE_VERSION = "2026-10-06-1";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const APP_ROOT_URL = new URL(self.registration.scope).href;
const NOT_FOUND_URL = new URL("./404.html", APP_ROOT_URL).href;
const PAGE_PATHS = Object.freeze(["./", "./sudoku/", "./xiangqi/", "./chess/", "./go/"]);
const SHELL_PATHS = Object.freeze([
  "./index.html",
  "./sudoku/index.html",
  "./xiangqi/index.html",
  "./chess/index.html",
  "./go/index.html",
  "./404.html",
  "./styles.css",
  "./home.css",
  "./games.css",
  "./js/pwa.js",
  "./js/home.js",
  "./js/app.js",
  "./js/puzzles.js",
  "./js/storage.js",
  "./js/sudoku.js",
  "./js/game-kit.js",
  "./js/ai-worker.js",
  "./js/xiangqi.js",
  "./js/xiangqi-app.js",
  "./js/chess.js",
  "./js/chess-app.js",
  "./js/go.js",
  "./js/go-app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
]);
const SHELL_URLS = new Set(SHELL_PATHS.map((path) => new URL(path, APP_ROOT_URL).href));
const PAGE_DOCUMENTS = new Map(
  PAGE_PATHS.map((path) => {
    const pageUrl = new URL(path, APP_ROOT_URL);
    return [pageUrl.pathname, new URL("./index.html", pageUrl).href];
  }),
);

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

function entryDocumentFor(url) {
  let { pathname } = url;
  if (pathname.endsWith("/index.html")) {
    pathname = pathname.slice(0, -"index.html".length);
  } else if (!pathname.endsWith("/")) {
    pathname = `${pathname}/`;
  }
  return PAGE_DOCUMENTS.get(pathname) ?? null;
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
    const entryDocument = entryDocumentFor(url);
    if (entryDocument !== null) {
      event.respondWith(serveCachedShell(entryDocument));
    } else {
      event.respondWith(networkFirstNonEntryNavigation(request));
    }
    return;
  }

  if (SHELL_URLS.has(url.href)) {
    event.respondWith(serveCachedShell(url.href));
  }
});
