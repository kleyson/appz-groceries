/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare let self: ServiceWorkerGlobalScope;

// Precache and route assets injected by workbox
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Cache API requests with NetworkFirst strategy
registerRoute(
  /^\/api\/.*$/,
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 30,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

// Cache Google Fonts CSS
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: "google-fonts-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

// Cache Google Fonts files
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: "gstatic-fonts-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);

// Version check and cache invalidation
const VERSION_DB_NAME = "appz-groceries-version";
const VERSION_STORE_NAME = "version";
const VERSION_KEY = "current";

async function openVersionDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(VERSION_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(VERSION_STORE_NAME)) {
        db.createObjectStore(VERSION_STORE_NAME);
      }
    };
  });
}

async function getStoredVersion(): Promise<string | null> {
  try {
    const db = await openVersionDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VERSION_STORE_NAME, "readonly");
      const store = tx.objectStore(VERSION_STORE_NAME);
      const request = store.get(VERSION_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function setStoredVersion(version: string): Promise<void> {
  try {
    const db = await openVersionDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VERSION_STORE_NAME, "readwrite");
      const store = tx.objectStore(VERSION_STORE_NAME);
      const request = store.put(version, VERSION_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Ignore storage errors
  }
}

async function clearAllCaches(): Promise<void> {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log(
    "[SW] All caches cleared due to version change or health check failure",
  );
}

async function checkVersionAndClearIfNeeded(): Promise<void> {
  try {
    const response = await fetch("/api/health", {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!response.ok) {
      console.log("[SW] Health check failed with status:", response.status);
      await clearAllCaches();
      return;
    }

    const data = await response.json();
    const serverVersion = data.version;

    if (!serverVersion) {
      console.log("[SW] No version in health response, clearing caches");
      await clearAllCaches();
      return;
    }

    const storedVersion = await getStoredVersion();

    if (storedVersion && storedVersion !== serverVersion) {
      console.log(
        `[SW] Version changed: ${storedVersion} -> ${serverVersion}, clearing caches`,
      );
      await clearAllCaches();
    }

    await setStoredVersion(serverVersion);
    console.log("[SW] Version check complete:", serverVersion);
  } catch (error) {
    console.log("[SW] Health check network error, clearing caches:", error);
    await clearAllCaches();
  }
}

// Handle skip waiting message from client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Check version on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await checkVersionAndClearIfNeeded();
    })(),
  );
});
