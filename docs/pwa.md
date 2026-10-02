# SeKKa PWA

SeKKa is served over HTTPS by Cloudflare Pages and has an Arabic RTL web app manifest and service worker. Modern browsers require an app name, install icons (192 px and 512 px), start URL, display mode, and a secure origin for their install promotion; the service worker adds the offline shell experience. See [MDN installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## User experience

- Chromium browsers show an in-app **Install** prompt when the browser exposes `beforeinstallprompt`.
- On iOS, the app shows instructions to use Share → Add to Home Screen.
- A waiting service-worker update is announced; the user chooses when to activate it and reload.
- When offline, SeKKa serves a small branded retry page. Booking and live trip data require an internet connection and are never represented as available offline.
- The manifest and install icons use SeKKa's dark background, yellow route mark, Arabic name, RTL language, and standalone launch mode.

## Cache and privacy boundaries

- The service worker precaches only the offline page, manifest, and first-party icons.
- It uses cache-first for same-origin static assets and network-first for page navigations, with the offline page as fallback.
- It bypasses API calls, all third-party origins, OSM tiles, and non-GET requests. Session, booking, and location data are not written to Cache Storage.
- Activation removes only older caches in the `sekka-shell-*` namespace.

## Source files

- `web/public/manifest.webmanifest`: install metadata and declared icon sizes.
- `web/public/brand/pwa-icon-192.png` and `pwa-icon-512.png`: real PNG install icons; exact dimensions are checked in CI.
- `web/public/sw.js`: static shell, offline navigation fallback, safe update activation, and push notification click handling.
- `web/src/pwa.ts` and `web/src/components/PwaNotice.tsx`: registration, installation, update, and connectivity UI.
- `web/public/offline.html`: offline retry screen.
- `web/scripts/check-pwa.mjs`: verifies required manifest fields, PNG signatures and dimensions, offline fallback, and cache boundaries.

## Verification checklist

- CI runs `npm run check:pwa`, `npm run lint`, and `npm run build` for pull requests.
- In Chrome or Edge, confirm Install appears after the production preview is eligible and launches in a standalone window.
- On iOS Safari, use Share → Add to Home Screen and confirm the SeKKa icon and Arabic title.
- After the first online load, switch offline and navigate/reload: the branded offline page should appear.
- Confirm API and OSM requests are not cached. Restore connectivity and verify retry works.
- Deploy a newer build, then verify the update notice appears and a user-selected update reloads once.
