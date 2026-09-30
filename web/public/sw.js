const CACHE_NAME = "sekka-shell-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/brand/sekka-icon-dark.png",
  "/brand/sekka-icon-light.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let message = {};
  try { message = event.data?.json() ?? {}; } catch { /* عرض إشعار عام عند وصول payload غير صالح */ }
  const title = typeof message.title === "string" ? message.title : "تحديث جديد على سِكّة";
  const options = {
    body: typeof message.body === "string" ? message.body : "افتح التطبيق لمراجعة آخر تحديث.",
    icon: "/brand/sekka-icon-dark.png",
    badge: "/brand/sekka-icon-dark.png",
    data: { url: typeof message.url === "string" ? message.url : "/" },
    dir: "rtl",
    lang: "ar",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) return existing.focus();
    return clients.openWindow(target);
  }));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname.startsWith("/api") || url.hostname.includes("openstreetmap.org")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
      if (response.ok && url.origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
