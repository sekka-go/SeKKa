# PoNo — approved visual identity (22 November 2026)

The official app name and capitalization are **PoNo** (Arabic pronunciation: بونو).
The installed app icon is the **white abstract P on blue** approved by the owner
in image `1000645975.webp`. The English **PoNo wordmark**, white with a
custom P and integrated white underline against cobalt blue, was approved in
image `1000645986.webp`. Do not substitute older seKKa or S-monogram assets.

## Assets
- `web/public/brand/pono-icon.svg`: vectorized from the approved icon
- `web/public/brand/pono-icon-192.png` and `pono-icon-512.png`: PWA and iOS/Android icon sizes
- `web/public/brand/pono-wordmark.svg`: original white-on-blue lockup
- `web/public/brand/pono-wordmark-white.svg`: transparent wordmark for splash overlay
- `web/src/v2/pono-brand.css`: scoped brand treatment

The live mobile app, guest onboarding, account login, side menu, splash,
browser title, PWA manifest and icon links use PoNo. The visual reference
gallery under `/dev/screens` remains archival, not the public app.

## No-breaking-change rename policy
Do not rename existing `sekka-*` CSS selectors, PWA internal manifest ID,
Supabase tables or RPCs, user data, OAuth app configuration, storage keys,
Cloudflare project, or repository paths as part of this visual rename.
Those are stable technical references and may require a separate migration.

Core app UI uses the earlier approved Urban Mobility palette until a
different interface palette is explicitly chosen; the PoNo brand mark
has its owner-approved vivid cobalt-blue background. Brand identity is
not proof of trademark clearance.

Production and database must stay unchanged; stage only on PR #185.
