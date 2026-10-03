const CACHE_PREFIX = "sekka-shell-";
const CACHE_NAME = "sekka-shell-v4";
const APP_SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/brand/pwa-icon-192.png",
  "/brand/pwa-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let message = {};
  try { message = event.data?.json() ?? {}; } catch { /* استخدم نصًا افتراضيًا عند وصول إشعار غير صالح */ }
  const title = typeof message.title === "string" ? message.title : "تحديث جديد على سِكّة";
  const options = {
    body: typeof message.body === "string" ? message.body : "افتح التطبيق لمراجعة آخر تحديث.",
    icon: "/brand/pwa-icon-192.png",
    badge: "/brand/pwa-icon-192.png",
    data: { url: typeof message.url === "string" ? message.url : "/" },
    dir: "rtl",
    lang: "ar",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL(event.notification.data?.url ?? "/", self.location.origin);
  if (target.origin !== self.location.origin) target = new URL("/", self.location.origin);
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      if ("navigate" in existing) await existing.navigate(target.href);
      return existing.focus();
    }
    return self.clients.openWindow(target.href);
  }));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match("/offline.html")) ?? Response.error();
    }));
    return;
  }

  const isStaticAsset = url.pathname.startsWith("/assets/")
    || url.pathname.startsWith("/brand/")
    || url.pathname === "/manifest.webmanifest"
    || url.pathname === "/offline.html"
    || url.pathname === "/favicon.ico";
  if (isStaticAsset) event.respondWith(cacheFirst(request));
});

