# SeKKa PWA

SeKKa is served over HTTPS by Cloudflare Pages and has an Arabic RTL web app manifest and service worker. Modern browsers require an app name, install icons (192 px and 512 px), start URL, display mode, and a secure origin for their install promotion; the service worker adds the offline shell experience. See [MDN installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## User experience

- Chromium browsers show an in-app **Install** prompt when the browser exposes `beforeinstallprompt`.
- On iOS, the app shows instructions to use Share → Add to Home Screen.
- A waiting service-worker update is announced; the user chooses when to activate it and reload.
- When offline, SeKKa serves a small branded retry page. Booking and live trip data require an internet connection and are never represented as available offline.
- The manifest uses a light launch background and defines separate transparent `any` icons and solid-green `maskable` icons from the same SeKKa mark. Dark browser chrome can use the additional `color_scheme_dark` member where supported.

## Cache and privacy boundaries

- The service worker precaches only the offline page, manifest, and first-party icons.
- It uses cache-first for same-origin static assets and network-first for page navigations, with the offline page as fallback.
- It bypasses API calls, all third-party origins, OSM tiles, and non-GET requests. Session, booking, and location data are not written to Cache Storage.
- Activation removes only older caches in the `sekka-shell-*` namespace.

## Source files

- `web/public/manifest.webmanifest`: install metadata and declared icon sizes.
- `web/src/brand/sekka-mark.svg`: single vector source for the in-app mark and generated assets.
- `web/public/brand/pwa-icon-192.png` and `pwa-icon-512.png`: transparent PNG icons for `purpose: any`.
- `web/public/brand/pwa-icon-192-maskable.png` and `pwa-icon-512-maskable.png`: separate green-tile maskable icons.
- `web/scripts/generate-pwa-icons.mjs`: generate the manifest icons, favicon PNG/SVG, Apple touch icon, notification badge, and share image with `pnpm --filter web generate:icons`.
- `web/public/sw.js`: static shell, offline navigation fallback, safe update activation, and push notification click handling.
- `web/src/pwa.ts` and `web/src/components/PwaNotice.tsx`: registration, installation, update, and connectivity UI.
- `web/public/offline.html`: offline retry screen.
- `web/scripts/check-pwa.mjs`: verifies required manifest fields, icon purpose/transparency/dimensions, offline fallback, and cache boundaries.

## Verification checklist

- CI installs from the root `pnpm-lock.yaml` and runs `pnpm --filter web check:pwa`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` for pull requests and pushes to `main`.
- In Chrome or Edge, confirm Install appears after the production preview is eligible and launches in a standalone window.
- On iOS Safari, use Share → Add to Home Screen and confirm the SeKKa icon and Arabic title.
- After the first online load, switch offline and navigate/reload: the branded offline page should appear.
- Confirm API and OSM requests are not cached. Restore connectivity and verify retry works.
- Deploy a newer build, then verify the update notice appears and a user-selected update reloads once.

