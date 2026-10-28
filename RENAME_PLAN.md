# Rename inventory and plan

Generated on branch `rename-sekka` from tracked and non-ignored repository files. Case-insensitive match expression: `sikka|sekka`. The three rename deliverable files are excluded from source counts to avoid counting this report as source. Ignored runtime state, installed dependencies, `.git`, binary assets and generated output are excluded. Environment variable values are not read into the report. Counts are occurrences, and each matching source line/path is listed.

Source files scanned: 255. Total source/path occurrences: 627.

## Match counts by class

| Class | Occurrences | Matching lines / paths |
|---|---:|---:|
| file/folder name | 18 | 18 |
| import or path | 16 | 10 |
| identifier | 51 | 29 |
| user-facing text / locale | 146 | 116 |
| database object / SQL | 198 | 197 |
| storage bucket / policy | 0 | 0 |
| Edge Function | 30 | 25 |
| environment variable name | 45 | 41 |
| URL / domain | 17 | 17 |
| client state key / cache | 8 | 8 |
| comment | 17 | 17 |
| configuration / docs / other | 81 | 66 |

## Filename matches

- `.github/workflows/sekka-routing.yml` — 1 match(es)
- `docs/audit/sekka-full-audit-report.md` — 1 match(es)
- `docs/design-system/sekka/DESIGN.md` — 1 match(es)
- `docs/sekka-maps-routing-handoff.md` — 1 match(es)
- `supabase/functions/sekka-api/.env.example` — 1 match(es)
- `supabase/functions/sekka-api/cors.ts` — 1 match(es)
- `supabase/functions/sekka-api/cors_test.ts` — 1 match(es)
- `supabase/functions/sekka-api/group-view.ts` — 1 match(es)
- `supabase/functions/sekka-api/group-view_test.ts` — 1 match(es)
- `supabase/functions/sekka-api/import_map.json` — 1 match(es)
- `supabase/functions/sekka-api/index.ts` — 1 match(es)
- `supabase/functions/sekka-api/locations.ts` — 1 match(es)
- `supabase/functions/sekka-api/locations_test.ts` — 1 match(es)
- `supabase/functions/sekka-api/request-body.ts` — 1 match(es)
- `supabase/functions/sekka-api/request-body_test.ts` — 1 match(es)
- `supabase/functions/sekka-api/routing.ts` — 1 match(es)
- `supabase/functions/sekka-api/routing_test.ts` — 1 match(es)
- `web/src/components/SekkaMark.tsx` — 1 match(es)

## Content matches

### import or path (16 occurrences; 10 lines)

- `web/src/components/BrandLogo.tsx:2` — 2 match(es): `import SekkaMark from "./SekkaMark";`
- `web/src/components/SekkaMark.tsx:3` — 1 match(es): `export default function SekkaMark({ className = "", style }: { className?: string; style?: CSSProperties }) {`
- `web/src/components/workspace-shared.tsx:229` — 1 match(es): `return <div className="notifications-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside id="sekka-notifications-drawer" className="no`
- `web/src/pwa.ts:1` — 1 match(es): `export const PWA_UPDATE_EVENT = "sekka:pwa-update";`
- `web/src/screens/Workspace.tsx:103` — 1 match(es): `window.history.pushState({ ...base, sekkaGuard: true }, "", path);`
- `web/src/screens/Workspace.tsx:107` — 1 match(es): `const routeChanged = current.sekkaSection !== safeSection || window.location.pathname !== path;`
- `web/src/screens/Workspace.tsx:109` — 1 match(es): `if (routeChanged || current.sekkaIndex == null) window.history.replaceState(normalized, "", path);`
- `web/src/screens/Workspace.tsx:111` — 1 match(es): `window.history.pushState({ ...normalized, sekkaGuard: true }, "", path);`
- `web/src/screens/Workspace.tsx:141` — 3 match(es): `window.history.replaceState({ sekkaWorkspace: true, sekkaSection: initialSection, sekkaIndex: 0 }, "", path);`
- `web/src/screens/Workspace.tsx:142` — 4 match(es): `window.history.pushState({ sekkaWorkspace: true, sekkaSection: initialSection, sekkaIndex: 0, sekkaGuard: true }, "", path);`

### identifier (51 occurrences; 29 lines)

- `docs/pwa.md:18` — 1 match(es): `- Activation removes only older caches in the \`sekka-shell-*\` namespace.`
- `docs/stitch-screens/batch-c-pkg5/_1/code.html:65` — 1 match(es): `<span class="text-[10px] text-zinc-300 font-semibold mx-1">SeKKa</span>`
- `docs/stitch-screens/batch-c-pkg5/_3/code.html:81` — 1 match(es): `<span class="text-[10px] font-bold bg-[#ffd21f] text-black px-1.5 py-0.5 rounded-sm">SeKKa</span>`
- `docs/stitch-screens/batch-c-pkg5/_4/code.html:67` — 1 match(es): `<span class="text-xs text-brand-yellow font-bold tracking-wider">سِكَّة <span class="text-[10px] text-gray-400 font-normal">SeKKa</span></span>`
- `docs/stitch-screens/batch-c-pkg5/_5/code.html:136` — 1 match(es): `<span class="text-xs font-extrabold tracking-wider text-[#FDC51A]">SEKKA</span>`
- `web/public/sw.js:1` — 1 match(es): `const CACHE_PREFIX = "sekka-shell-";`
- `web/src/api.ts:69` — 1 match(es): `const TOKEN_KEY = "sekka.session.token";`
- `web/src/api.ts:70` — 1 match(es): `const USER_KEY = "sekka.session.user";`
- `web/src/components/AdminControlPanel.tsx:111` — 1 match(es): `<header className="admin-panel-heading"><div><p className="text-sm font-bold admin-text-accent">{t("SeKKa · تحكم آمن")}</p><h2 className="mt-1 text-2xl font-extrabold">{t("مركز إدا`
- `web/src/components/VerificationCenter.tsx:60` — 1 match(es): `const key = \`sekka.verification.focus.${session.user.id}\`;`
- `web/src/components/VerificationReminder.tsx:31` — 1 match(es): `const reminderKey = \`sekka.verification.reminder.${session.user.id}\`;`
- `web/src/screens/CaptainWorkspace.tsx:111` — 1 match(es): `try { const result = await api<{ profile: CaptainProfile }>("/captain/profile", { method: "POST", token: session.token, body: { vehicle_type_id: vehicle, license_number: license, v`
- `web/src/screens/CaptainWorkspace.tsx:197` — 1 match(es): `const openVerification = () => { window.dispatchEvent(new CustomEvent("sekka:navigate", { detail: "account" })); window.setTimeout(() => document.getElementById("verification-cente`
- `web/src/screens/Workspace.tsx:56` — 2 match(es): `const state = window.history.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey } | null;`
- `web/src/screens/Workspace.tsx:63` — 3 match(es): `const state = window.history.state as { sekkaWorkspace?: boolean; sekkaIndex?: number; sekkaSection?: NavKey } | null;`
- `web/src/screens/Workspace.tsx:80` — 3 match(es): `const current = window.history.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey; sekkaIndex?: number } | null;`
- `web/src/screens/Workspace.tsx:86` — 2 match(es): `const currentIndex = current?.sekkaWorkspace ? current.sekkaIndex ?? historyDepth : historyDepth;`
- `web/src/screens/Workspace.tsx:90` — 3 match(es): `const nextState = { ...current, sekkaWorkspace: true, sekkaSection: safeNext, sekkaIndex: nextIndex };`
- `web/src/screens/Workspace.tsx:98` — 4 match(es): `const current = window.history.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey; sekkaIndex?: number; sekkaGuard?: boolean } | null;`
- `web/src/screens/Workspace.tsx:100` — 3 match(es): `const base = { ...current, sekkaWorkspace: true, sekkaSection: section, sekkaIndex: 0 };`
- `web/src/screens/Workspace.tsx:108` — 4 match(es): `const normalized = { ...current, sekkaWorkspace: true, sekkaSection: safeSection, sekkaIndex: routeChanged ? 0 : current.sekkaIndex ?? 0 };`
- `web/src/screens/Workspace.tsx:116` — 4 match(es): `const state = event.state as { sekkaWorkspace?: boolean; sekkaSection?: NavKey; sekkaIndex?: number; sekkaGuard?: boolean } | null;`
- `web/src/screens/Workspace.tsx:118` — 1 match(es): `const requested = state.sekkaSection ?? initialSection;`
- `web/src/screens/Workspace.tsx:120` — 1 match(es): `const depth = state.sekkaIndex ?? 0;`
- `web/src/screens/Workspace.tsx:128` — 2 match(es): `const latest = window.history.state as { sekkaWorkspace?: boolean; sekkaGuard?: boolean } | null;`
- `web/src/screens/Workspace.tsx:245` — 1 match(es): `<header className="topbar" onClick={() => { if (notificationsOpen) closeNotifications(); }}><div className="topbar-brand-group"><button type="button" className="mobile-menu" onClic`
- `web/src/styles.css:19` — 3 match(es): `.workspace { min-height: 100vh; display: grid; grid-template-columns: 16rem 1fr; }.sidebar { display: flex; flex-direction: column; padding: 1.5rem 1rem; background: #110e05; borde`
- `web/src/styles.css:187` — 1 match(es): `.sekka-map-marker .map-stop-badge{display:grid;place-items:center;width:2.2rem;height:2.2rem;color:#201b09;background:var(--yellow);border:3px solid #fff2d3;border-radius:50%;font-`
- `web/src/styles.css:1630` — 1 match(es): `.app-shell > .toast { z-index: 1500; inset: auto auto 1.25rem 50%; transform: translateX(-50%); display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center;`

### user-facing text / locale (146 occurrences; 116 lines)

- `docs/stitch-screens/batch-c-pkg5/_1/code.html:6` — 1 match(es): `<title>سِكَّة - SeKKa | رحلات العمل اليومية</title>`
- `docs/stitch-screens/batch-c-pkg5/_2/code.html:6` — 1 match(es): `<title>SeKKa - Route Schedule Details</title>`
- `docs/stitch-screens/batch-c-pkg5/_3/code.html:6` — 1 match(es): `<title>SeKKa - Live Tracking Hub</title>`
- `docs/stitch-screens/batch-c-pkg5/_3/code.html:289` — 1 match(es): `<!-- Center SeKKa Accent -->`
- `docs/stitch-screens/batch-c-pkg5/_4/code.html:6` — 1 match(es): `<title>SeKKa - Profile Subscriptions</title>`
- `docs/stitch-screens/batch-c-pkg5/_4/code.html:98` — 1 match(es): `<!-- Sekka Pro Badge -->`
- `docs/stitch-screens/batch-c-pkg5/_5/code.html:6` — 1 match(es): `<title>SeKKa - Route Details</title>`
- `docs/stitch-screens/batch-c-pkg5/_6/code.html:21` — 1 match(es): `sekka: {`
- `web/index.html:14` — 1 match(es): `<meta property="og:title" content="سِكَّة | SeKKa" />`
- `web/index.html:23` — 1 match(es): `<meta name="twitter:title" content="سِكَّة | SeKKa" />`
- `web/index.html:27` — 1 match(es): `<meta name="application-name" content="سِكَّة | SeKKa" />`
- `web/index.html:33` — 1 match(es): `<title>سِكَّة | SeKKa</title>`
- `web/public/manifest.webmanifest:3` — 1 match(es): `"name": "سِكَّة | SeKKa",`
- `web/public/manifest.webmanifest:4` — 1 match(es): `"short_name": "SeKKa",`
- `web/public/privacy.html:22` — 2 match(es): `<p>توضح هذه السياسة البيانات التي تعالجها سِكّة لتنسيق الرحلات المشتركة. للاستفسارات أو طلبات الخصوصية، راسل <a href="mailto:sekkago.app@gmail.com">sekkago.app@gmail.com</a>.</p>`
- `web/public/terms.html:21` — 2 match(es): `<p>باستخدام سِكّة، فإنك توافق على هذه الشروط. للاستفسارات، راسل <a href="mailto:sekkago.app@gmail.com">sekkago.app@gmail.com</a>.</p>`
- `web/public/terms.html:49` — 2 match(es): `<p>قد تُحدّث هذه الشروط عند تغير الخدمة، وسننشر النسخة الجديدة هنا مع تاريخ تحديثها. البريد الرسمي للدعم: <a href="mailto:sekkago.app@gmail.com">sekkago.app@gmail.com</a>.</p>`
- `web/src/MapPicker.tsx:170` — 1 match(es): `className: "sekka-map-marker",`
- `web/src/components/BrandLogo.tsx:12` — 1 match(es): `<SekkaMark className="brand-logo-mark" />`
- `web/src/components/BrandLogo.tsx:13` — 1 match(es): `{!compact && <span className="brand-logo-copy"><strong>{t("سِكَّة | SeKKa")}</strong><small>{t("معاك في السكة")}</small></span>}`
- `web/src/components/InfoPages.tsx:26` — 1 match(es): `["التغييرات والتواصل", "قد تتغير هذه السياسة مع تطور الخدمة. ستجد النسخة الحالية في القائمة الجانبية، ويمكنك التواصل معنا عبر sekkago.app@gmail.com."],`
- `web/src/components/InfoPages.tsx:52` — 1 match(es): `<details><summary>{t("كيف أتواصل مع الدعم؟")}</summary><p>{t("استخدم «خدمة العملاء» في القائمة الجانبية أو راسل sekkago.app@gmail.com.")}</p></details>`
- `web/src/components/ProfileAvatar.tsx:20` — 1 match(es): `window.addEventListener("sekka:profile-updated", update);`
- `web/src/components/ProfileAvatar.tsx:21` — 1 match(es): `return () => window.removeEventListener("sekka:profile-updated", update);`
- `web/src/components/RiderRoutePreferences.tsx:57` — 1 match(es): `window.dispatchEvent(new CustomEvent<SavedPlace[]>("sekka:rider-preferences", { detail: places }));`
- `web/src/components/RiderRoutePreferences.tsx:173` — 1 match(es): `window.dispatchEvent(new CustomEvent<RiderCommuterPreferences>("sekka:rider-commuter-preferences", { detail: savedPreferences.preferences }));`
- `web/src/components/VerificationCenter.tsx:57` — 1 match(es): `useEffect(() => { if (verificationSignature) window.dispatchEvent(new Event("sekka:verification-refresh")); }, [verificationSignature]);`
- `web/src/components/VerificationCenter.tsx:89` — 1 match(es): `window.addEventListener("sekka:verification-refresh", onRefresh);`
- `web/src/components/VerificationCenter.tsx:90` — 1 match(es): `return () => window.removeEventListener("sekka:verification-refresh", onRefresh);`
- `web/src/components/VerificationCenter.tsx:111` — 1 match(es): `window.dispatchEvent(new Event("sekka:verification-refresh"));`
- `web/src/components/VerificationReminder.tsx:44` — 1 match(es): `window.addEventListener("sekka:verification-refresh", onRefresh);`
- `web/src/components/VerificationReminder.tsx:45` — 1 match(es): `return () => window.removeEventListener("sekka:verification-refresh", onRefresh);`
- `web/src/components/WorkspaceNavigation.tsx:62` — 1 match(es): `<a className="nav-item" href="mailto:sekkago.app@gmail.com"><span className="nav-icon"><AppIcon name="support" size={19} /></span><span className="nav-label">{t("خدمة العملاء")}</s`
- `web/src/components/workspace-shared.tsx:242` — 1 match(es): `try { await uploadProfileAvatar(session.token, file); window.dispatchEvent(new CustomEvent("sekka:profile-updated", { detail: session.user.id })); notify(t("تم تحديث صورتك الشخصية.`
- `web/src/components/workspace-shared.tsx:248` — 1 match(es): `try { await deleteProfileAvatar(session.token); window.dispatchEvent(new CustomEvent("sekka:profile-updated", { detail: session.user.id })); notify(t("تم حذف الصورة الشخصية."), "su`
- `web/src/i18n/locales/ar.json:31` — 2 match(es): `"SeKKa · تحكم آمن": "SeKKa · تحكم آمن",`
- `web/src/i18n/locales/ar.json:128` — 2 match(es): `"سِكَّة | SeKKa": "سِكَّة | SeKKa",`
- `web/src/i18n/locales/ar.json:143` — 2 match(es): `"استخدم «خدمة العملاء» في القائمة الجانبية أو راسل sekkago.app@gmail.com.": "استخدم «خدمة العملاء» في القائمة الجانبية أو راسل sekkago.app@gmail.com."`
- `web/src/i18n/locales/ar.json:225` — 1 match(es): `"SekkaSplash": {`
- `web/src/i18n/locales/ar.json:836` — 2 match(es): `"سِكَّة | SeKKa": "سِكَّة | SeKKa",`
- `web/src/i18n/locales/ar.json:837` — 2 match(es): `"سِكّة | SeKKa": "سِكّة | SeKKa",`
- `web/src/i18n/locales/ar.json:1057` — 2 match(es): `"قد تتغير هذه السياسة مع تطور الخدمة. ستجد النسخة الحالية في القائمة الجانبية، ويمكنك التواصل معنا عبر sekkago.app@gmail.com.": "قد تتغير هذه السياسة مع تطور الخدمة. ستجد النسخة ال`
- `web/src/i18n/locales/en.json:7` — 1 match(es): `"سِكّة": "SeKKa"`
- `web/src/i18n/locales/en.json:31` — 2 match(es): `"SeKKa · تحكم آمن": "SeKKa · Safe control",`
- `web/src/i18n/locales/en.json:128` — 2 match(es): `"سِكَّة | SeKKa": "SeKKa",`
- `web/src/i18n/locales/en.json:141` — 1 match(es): `"من صفحة الدخول اختر «نسيت كلمة السر؟»، ثم افتح رابط بوت سِكّة في تيليجرام وشارك رقمك المسجل لاستلام رمز لمرة واحدة.": "From the login page, choose “Forgot your password?”, then op`
- `web/src/i18n/locales/en.json:143` — 2 match(es): `"استخدم «خدمة العملاء» في القائمة الجانبية أو راسل sekkago.app@gmail.com.": "Use “Customer Service” in the side menu or email sekkago.app@gmail.com."`
- `web/src/i18n/locales/en.json:172` — 1 match(es): `"تحديث سِكّة جاهز": "A SeKKa update is ready",`
- `web/src/i18n/locales/en.json:175` — 1 match(es): `"ثبّت سِكّة على جهازك": "Install SeKKa on your device",`
- `web/src/i18n/locales/en.json:179` — 1 match(es): `"أضف سِكّة إلى الشاشة الرئيسية": "Add SeKKa to your home screen",`
- `web/src/i18n/locales/en.json:185` — 1 match(es): `"اقتراح من سِكّة": "Suggestion from SeKKa",`
- `web/src/i18n/locales/en.json:225` — 1 match(es): `"SekkaSplash": {`
- `web/src/i18n/locales/en.json:226` — 1 match(es): `"جاري فتح سِكّة": "Opening SeKKa",`
- `web/src/i18n/locales/en.json:227` — 1 match(es): `"سِكّة": "SeKKa",`
- `web/src/i18n/locales/en.json:228` — 1 match(es): `"طريقك أسهل مع سِكّة": "Your way is easier with SeKKa"`
- `web/src/i18n/locales/en.json:265` — 1 match(es): `"مبروك، تم تفعيل حسابك في سِكّة": "Congratulations, your SeKKa account has been activated",`
- `web/src/i18n/locales/en.json:341` — 1 match(es): `"من سِكّة": "From SeKKa",`
- `web/src/i18n/locales/en.json:345` — 1 match(es): `"تم إيقاف إشعارات سِكّة على هذا الجهاز.": "SeKKa notifications have been disabled on this device.",`
- `web/src/i18n/locales/en.json:346` — 1 match(es): `"تم تفعيل إشعارات سِكّة على هذا الجهاز.": "SeKKa notifications are activated on this device.",`
- `web/src/i18n/locales/en.json:375` — 1 match(es): `"صورتك ظاهرة لمستخدمي سِكّة المسجلين فقط.": "Your photo is visible to registered SeKKa users only.",`
- `web/src/i18n/locales/en.json:422` — 1 match(es): `"إدارة سِكّة": "SeKKa management",`
- `web/src/i18n/locales/en.json:448` — 1 match(es): `"مجموعات سِكّة": "SeKKa groups",`
- `web/src/i18n/locales/en.json:468` — 1 match(es): `"سِكّة، الرئيسية": "SeKKa, main",`
- `web/src/i18n/locales/en.json:469` — 1 match(es): `"أهلًا بك في سِكّة. حسابك ونقطك المفضلة جاهزين.": "Welcome to SeKKa. Your account and favorite points are ready.",`
- `web/src/i18n/locales/en.json:474` — 1 match(es): `"انضم لسِكّة": "Join SeKKa",`
- `web/src/i18n/locales/en.json:479` — 1 match(es): `"هتستخدم سِكّة بصفتك؟": "How will you use SeKKa?",`
- `web/src/i18n/locales/en.json:500` — 1 match(es): `"أدخل رقم الهاتف المسجل، وسنجهز رابطًا آمنًا لبدء التحقق عبر بوت سِكّة في تيليجرام.": "Enter the registered phone number, and we will prepare a secure link to start verification vi`
- `web/src/i18n/locales/en.json:505` — 1 match(es): `"فتح بوت سِكّة في تيليجرام ↗": "Open a SeKKa bot in Telegram ↗",`
- `web/src/i18n/locales/en.json:509` — 1 match(es): `"لسه جديد في سِكّة؟": "Are you still new to SeKKa?",`
- `web/src/i18n/locales/en.json:641` — 1 match(es): `"سِكَّة، الرئيسية": "SeKKa, main",`
- `web/src/i18n/locales/en.json:804` — 1 match(es): `"سِكّة أقرب لك": "SeKKa, closer to you",`
- `web/src/i18n/locales/en.json:806` — 1 match(es): `"سِكَّة.": "SeKKa.",`
- `web/src/i18n/locales/en.json:824` — 1 match(es): `"تم نسخ رابط سِكّة للمشاركة.": "The SeKKa link has been copied to share.",`
- `web/src/i18n/locales/en.json:834` — 1 match(es): `"سِكّة": "SeKKa",`
- `web/src/i18n/locales/en.json:835` — 1 match(es): `"سِكَّة": "SeKKa",`
- `web/src/i18n/locales/en.json:836` — 2 match(es): `"سِكَّة | SeKKa": "SeKKa",`
- `web/src/i18n/locales/en.json:837` — 2 match(es): `"سِكّة | SeKKa": "SeKKa",`
- `web/src/i18n/locales/en.json:838` — 1 match(es): `"سِكّة ·": "SeKKa ·",`
- `web/src/i18n/locales/en.json:840` — 1 match(es): `"السكة": "SeKKa",`
- `web/src/i18n/locales/en.json:981` — 1 match(es): `"خلّي سكة تعرف مشوارك": "Tell SeKKa about your regular ride",`
- `web/src/i18n/locales/en.json:988` — 1 match(es): `"اعزمهم على سِكّة وخلي مشواركم أسهل.": "Invite them to SeKKa and make the ride easier.",`
- `web/src/i18n/locales/en.json:998` — 1 match(es): `"رسالة من إدارة سِكّة": "Message from SeKKa support",`
- `web/src/i18n/locales/en.json:1019` — 1 match(es): `"عضو في سِكّة": "SeKKa member",`
- `web/src/i18n/locales/en.json:1031` — 1 match(es): `"تنظم هذه الشروط استخدامك لتطبيق سِكّة وخدمات تنظيم المشاوير المشتركة.": "These terms govern your use of SeKKa and its shared-ride coordination services.",`
- `web/src/i18n/locales/en.json:1045` — 1 match(es): `"توضح هذه السياسة البيانات التي يحتاجها سِكّة لتنسيق المشاوير وتشغيل الحساب بأمان.": "This policy explains the information SeKKa needs to coordinate rides and keep your account sec`
- `web/src/i18n/locales/en.json:1057` — 2 match(es): `"قد تتغير هذه السياسة مع تطور الخدمة. ستجد النسخة الحالية في القائمة الجانبية، ويمكنك التواصل معنا عبر sekkago.app@gmail.com.": "This policy may change as the service evolves. You `
- `web/src/i18n/locales/en.json:1107` — 1 match(es): `"إرسال إعلان محفوظ إلى جميع مستخدمي سِكّة": "Send a saved announcement to all SeKKa users",`
- `web/src/i18n/locales/en.json:1133` — 1 match(es): `"إدارة سِكَّة": "SeKKa administration",`
- `web/src/i18n/locales/en.json:1137` — 1 match(es): `"تم إيقاف إشعارات سِكّة على هذا الجهاز.": "SeKKa notifications were turned off on this device.",`
- `web/src/i18n/locales/en.json:1138` — 1 match(es): `"تم تفعيل إشعارات سِكّة على هذا الجهاز.": "SeKKa notifications were turned on for this device.",`
- `web/src/i18n/locales/en.json:1164` — 1 match(es): `"صورتك ظاهرة لمستخدمي سِكّة المسجلين فقط.": "Your photo is visible to signed-in SeKKa users.",`
- `web/src/i18n/locales/en.json:1177` — 1 match(es): `"أطلب سِكّة": "Try SeKKa",`
- `web/src/i18n/locales/en.json:1179` — 1 match(es): `"تم نسخ رابط سِكّة للمشاركة.": "SeKKa link copied.",`
- `web/src/screens/RiderWorkspace.tsx:135` — 1 match(es): `window.addEventListener("sekka:edit-group", openGroupEditor);`
- `web/src/screens/RiderWorkspace.tsx:136` — 1 match(es): `return () => window.removeEventListener("sekka:edit-group", openGroupEditor);`
- `web/src/screens/RiderWorkspace.tsx:244` — 1 match(es): `window.addEventListener("sekka:rider-preferences", syncPreferences);`
- `web/src/screens/RiderWorkspace.tsx:245` — 1 match(es): `window.addEventListener("sekka:rider-commuter-preferences", syncCommuterPreferences);`
- `web/src/screens/RiderWorkspace.tsx:246` — 2 match(es): `return () => { window.removeEventListener("sekka:rider-preferences", syncPreferences); window.removeEventListener("sekka:rider-commuter-preferences", syncCommuterPreferences); };`
- `web/src/screens/RiderWorkspace.tsx:261` — 1 match(es): `window.addEventListener("sekka:booking-mode", handleBookingMode);`
- `web/src/screens/RiderWorkspace.tsx:262` — 1 match(es): `return () => window.removeEventListener("sekka:booking-mode", handleBookingMode);`
- `web/src/screens/Workspace.tsx:59` — 4 match(es): `if (state?.sekkaWorkspace && state.sekkaSection && sectionAllowedForRole(state.sekkaSection, session.user.role)) return state.sekkaSection;`
- `web/src/screens/Workspace.tsx:64` — 5 match(es): `return state?.sekkaWorkspace && state.sekkaSection && sectionAllowedForRole(state.sekkaSection, session.user.role) && state.sekkaSection === sectionForPath(window.location.pathname`
- `web/src/screens/Workspace.tsx:81` — 2 match(es): `if (current?.sekkaWorkspace && current.sekkaSection === safeNext) {`
- `web/src/screens/Workspace.tsx:99` — 1 match(es): `if (!current?.sekkaWorkspace) {`
- `web/src/screens/Workspace.tsx:110` — 2 match(es): `if ((normalized.sekkaIndex ?? 0) === 0 && !current.sekkaGuard) {`
- `web/src/screens/Workspace.tsx:117` — 1 match(es): `if (state?.sekkaWorkspace) {`
- `web/src/screens/Workspace.tsx:125` — 5 match(es): `if (restored !== requested || window.location.pathname !== restoredPath) window.history.replaceState({ sekkaWorkspace: true, sekkaSection: restored, sekkaIndex: depth, sekkaGuard: `
- `web/src/screens/Workspace.tsx:126` — 1 match(es): `if (depth === 0 && !state.sekkaGuard) {`
- `web/src/screens/Workspace.tsx:129` — 2 match(es): `if (latest?.sekkaWorkspace && !latest.sekkaGuard) {`
- `web/src/screens/Workspace.tsx:130` — 1 match(es): `window.history.pushState({ ...latest, sekkaGuard: true }, "", window.location.href);`
- `web/src/screens/Workspace.tsx:150` — 1 match(es): `window.addEventListener("sekka:navigate", navigate);`
- `web/src/screens/Workspace.tsx:151` — 1 match(es): `return () => window.removeEventListener("sekka:navigate", navigate);`
- `web/src/screens/Workspace.tsx:163` — 1 match(es): `window.dispatchEvent(new CustomEvent<number>("sekka:edit-group", { detail: groupId }));`
- `web/src/screens/Workspace.tsx:210` — 1 match(es): `window.addEventListener("sekka:invite-friends", invite);`
- `web/src/screens/Workspace.tsx:211` — 1 match(es): `return () => window.removeEventListener("sekka:invite-friends", invite);`
- `web/src/screens/Workspace.tsx:222` — 1 match(es): `if (item.key === "booking") window.dispatchEvent(new CustomEvent("sekka:booking-mode", { detail: "new" }));`

### database object / SQL (198 occurrences; 197 lines)

- `server/migrations/001_init.sql:2` — 1 match(es): `-- SeKKa | سِكَّة — Migration 001: Init (Phase 1 — DB + Config Domain)`
- `server/migrations/002_auth.sql:2` — 1 match(es): `-- SeKKa | سِكَّة — Migration 002: Auth Domain (Phase 2)`
- `server/migrations/003_captain_profile.sql:2` — 1 match(es): `-- SeKKa | سِكَّة — Migration 003: Captain Profile Domain (Phase 3)`
- `server/migrations/004_booking.sql:2` — 1 match(es): `-- SeKKa | سِكَّة — Migration 004: Booking Domain (Phase 4)`
- `server/migrations/005_matching.sql:2` — 1 match(es): `-- SeKKa | سِكَّة — Migration 005: Matching Domain (Phase 5)`
- `server/migrations/006_trip_payment.sql:2` — 1 match(es): `-- SeKKa | سِكَّة — Migration 006: Trip Lifecycle + Payment Ledger (Phase 6)`
- `server/migrations/007_admin_rbac.sql:2` — 1 match(es): `-- SeKKa | سِكَّة — Migration 007: Admin & RBAC + Analytics (Phase 7)`
- `server/migrations/008_password_change.sql:2` — 1 match(es): `-- SeKKa | سِكَّة — Migration 008: Password Change (Phase 8)`
- `supabase/migrations/20261001000000_postgres_baseline.sql:1` — 1 match(es): `-- SeKKa PostgreSQL baseline (reviewed conversion of SQLite migrations 001–013).`
- `supabase/migrations/20261001000000_postgres_baseline.sql:322` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_require_role() RETURNS trigger`
- `supabase/migrations/20261001000000_postgres_baseline.sql:337` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('user_id','captain');`
- `supabase/migrations/20261001000000_postgres_baseline.sql:339` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('rider_user_id','rider');`
- `supabase/migrations/20261001000000_postgres_baseline.sql:341` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('captain_user_id','captain');`
- `supabase/migrations/20261001000000_postgres_baseline.sql:343` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('created_by_user_id','rider,captain');`
- `supabase/migrations/20261001000000_postgres_baseline.sql:345` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('rider_user_id','rider');`
- `supabase/migrations/20261001000000_postgres_baseline.sql:348` — 1 match(es): `EXECUTE FUNCTION public.sekka_require_role('captain_user_id','captain');`
- `supabase/migrations/20261001000000_postgres_baseline.sql:350` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_validate_vehicle_capacity() RETURNS trigger`
- `supabase/migrations/20261001000000_postgres_baseline.sql:368` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_validate_vehicle_capacity();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:370` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_validate_vehicle_capacity();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:372` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_match_guard() RETURNS trigger`
- `supabase/migrations/20261001000000_postgres_baseline.sql:384` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_match_guard();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:386` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_match_creates_trip() RETURNS trigger`
- `supabase/migrations/20261001000000_postgres_baseline.sql:399` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_match_creates_trip();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:400` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_trip_stop_order() RETURNS trigger`
- `supabase/migrations/20261001000000_postgres_baseline.sql:411` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_trip_stop_order();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:412` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_trip_complete_guard() RETURNS trigger`
- `supabase/migrations/20261001000000_postgres_baseline.sql:423` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_trip_complete_guard();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:425` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_append_only() RETURNS trigger`
- `supabase/migrations/20261001000000_postgres_baseline.sql:429` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_append_only();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:431` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_append_only();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:433` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_append_only();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:435` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_append_only();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:436` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_payment_guard() RETURNS trigger`
- `supabase/migrations/20261001000000_postgres_baseline.sql:462` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_payment_guard();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:464` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_payment_guard();`
- `supabase/migrations/20261001000000_postgres_baseline.sql:465` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_captain_verification_noop() RETURNS trigger`
- `supabase/migrations/20261001000000_postgres_baseline.sql:474` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_captain_verification_noop();`
- `supabase/migrations/20261001000001_backend_security_indexes.sql:22` — 1 match(es): `EXECUTE format('CREATE POLICY sekka_backend_only ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',t.tablename);`
- `supabase/migrations/20261001000002_auth_rate_limit.sql:10` — 1 match(es): `CREATE POLICY sekka_backend_only ON public.api_rate_limits`
- `supabase/migrations/20261001000002_auth_rate_limit.sql:13` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_take_rate_limit(`
- `supabase/migrations/20261001000002_auth_rate_limit.sql:38` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_take_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261001000002_auth_rate_limit.sql:39` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_take_rate_limit(text,integer,integer) TO service_role;`
- `supabase/migrations/20261001000003_pool_deadline_processor.sql:7` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_process_pool_deadlines()`
- `supabase/migrations/20261001000003_pool_deadline_processor.sql:155` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_process_pool_deadlines() FROM PUBLIC, anon, authenticated, service_role;`
- `supabase/migrations/20261001000003_pool_deadline_processor.sql:156` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_process_pool_deadlines() TO postgres;`
- `supabase/migrations/20261001000003_pool_deadline_processor.sql:162` — 1 match(es): `FOR existing_job IN SELECT jobid FROM cron.job WHERE jobname='sekka-process-pool-deadlines'`
- `supabase/migrations/20261001000003_pool_deadline_processor.sql:167` — 1 match(es): `'sekka-process-pool-deadlines',`
- `supabase/migrations/20261001000003_pool_deadline_processor.sql:169` — 1 match(es): `'SELECT public.sekka_process_pool_deadlines()'`
- `supabase/migrations/20261001000004_deadline_scheduled_trips.sql:3` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_process_pool_deadlines()`
- `supabase/migrations/20261001000004_deadline_scheduled_trips.sql:150` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_process_pool_deadlines() FROM PUBLIC, anon, authenticated, service_role;`
- `supabase/migrations/20261001000004_deadline_scheduled_trips.sql:151` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_process_pool_deadlines() TO postgres;`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:1` — 1 match(es): `-- SeKKa PostgreSQL baseline (reviewed conversion of SQLite migrations 001–013).`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:322` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_require_role() RETURNS trigger`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:337` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('user_id','captain');`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:339` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('rider_user_id','rider');`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:341` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('captain_user_id','captain');`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:343` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('created_by_user_id','rider,captain');`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:345` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('rider_user_id','rider');`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:348` — 1 match(es): `EXECUTE FUNCTION public.sekka_require_role('captain_user_id','captain');`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:350` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_validate_vehicle_capacity() RETURNS trigger`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:368` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_validate_vehicle_capacity();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:370` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_validate_vehicle_capacity();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:372` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_match_guard() RETURNS trigger`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:384` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_match_guard();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:386` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_match_creates_trip() RETURNS trigger`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:399` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_match_creates_trip();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:400` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_trip_stop_order() RETURNS trigger`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:411` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_trip_stop_order();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:412` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_trip_complete_guard() RETURNS trigger`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:423` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_trip_complete_guard();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:425` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_append_only() RETURNS trigger`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:429` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_append_only();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:431` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_append_only();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:433` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_append_only();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:435` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_append_only();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:436` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_payment_guard() RETURNS trigger`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:462` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_payment_guard();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:464` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_payment_guard();`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:465` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_captain_verification_noop() RETURNS trigger`
- `supabase/migrations/20261001183937_postgres_baseline_001_013.sql:474` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_captain_verification_noop();`
- `supabase/migrations/20261001184345_backend_security_indexes.sql:22` — 1 match(es): `EXECUTE format('CREATE POLICY sekka_backend_only ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',t.tablename);`
- `supabase/migrations/20261001184517_auth_rate_limit.sql:10` — 1 match(es): `CREATE POLICY sekka_backend_only ON public.api_rate_limits`
- `supabase/migrations/20261001184517_auth_rate_limit.sql:13` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_take_rate_limit(`
- `supabase/migrations/20261001184517_auth_rate_limit.sql:38` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_take_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261001184517_auth_rate_limit.sql:39` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_take_rate_limit(text,integer,integer) TO service_role;`
- `supabase/migrations/20261001195257_pool_deadline_processor.sql:7` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_process_pool_deadlines()`
- `supabase/migrations/20261001195257_pool_deadline_processor.sql:155` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_process_pool_deadlines() FROM PUBLIC, anon, authenticated, service_role;`
- `supabase/migrations/20261001195257_pool_deadline_processor.sql:156` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_process_pool_deadlines() TO postgres;`
- `supabase/migrations/20261001195257_pool_deadline_processor.sql:162` — 1 match(es): `FOR existing_job IN SELECT jobid FROM cron.job WHERE jobname='sekka-process-pool-deadlines'`
- `supabase/migrations/20261001195257_pool_deadline_processor.sql:167` — 1 match(es): `'sekka-process-pool-deadlines',`
- `supabase/migrations/20261001195257_pool_deadline_processor.sql:169` — 1 match(es): `'SELECT public.sekka_process_pool_deadlines()'`
- `supabase/migrations/20261001200703_deadline_scheduled_trips.sql:3` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_process_pool_deadlines()`
- `supabase/migrations/20261001200703_deadline_scheduled_trips.sql:150` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_process_pool_deadlines() FROM PUBLIC, anon, authenticated, service_role;`
- `supabase/migrations/20261001200703_deadline_scheduled_trips.sql:151` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_process_pool_deadlines() TO postgres;`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:97` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_track_route_geometry_age()`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:116` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_track_route_geometry_age();`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:118` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_begin_location_search(p_user_id integer, p_normalized_query text)`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:190` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_claim_location_resolution(p_user_id integer, p_search_id uuid, p_place_id text)`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:250` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_reserve_google_maps_request(p_service text)`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:278` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_purge_expired_location_data()`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:349` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_begin_location_search(integer, text) FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:350` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_claim_location_resolution(integer, uuid, text) FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:351` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_reserve_google_maps_request(text) FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:352` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_purge_expired_location_data() FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:353` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_begin_location_search(integer, text) TO service_role;`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:354` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_claim_location_resolution(integer, uuid, text) TO service_role;`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:355` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_reserve_google_maps_request(text) TO service_role;`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:362` — 1 match(es): `FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'sekka-purge-expired-location-data'`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:367` — 1 match(es): `'sekka-purge-expired-location-data',`
- `supabase/migrations/20261002075543_google_maps_search_budget_and_location_retention.sql:369` — 1 match(es): `'SELECT public.sekka_purge_expired_location_data()'`
- `supabase/migrations/20261002075655_fix_location_search_quota_counters.sql:1` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_begin_location_search(p_user_id integer, p_normalized_query text)`
- `supabase/migrations/20261002075655_fix_location_search_quota_counters.sql:73` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_begin_location_search(integer, text) FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261002075655_fix_location_search_quota_counters.sql:74` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_begin_location_search(integer, text) TO service_role;`
- `supabase/migrations/20261002082524_preserve_place_ids_during_location_cleanup.sql:2` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_purge_expired_location_data()`
- `supabase/migrations/20261004074251_admin_control_panel.sql:14` — 1 match(es): `SELECT id, 'Owner account configured for SeKKa operations'`
- `supabase/migrations/20261004074251_admin_control_panel.sql:82` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_is_super_admin(p_user_id integer)`
- `supabase/migrations/20261004074251_admin_control_panel.sql:93` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_is_super_admin(integer) FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261004074251_admin_control_panel.sql:94` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_is_super_admin(integer) TO service_role;`
- `supabase/migrations/20261004074251_admin_control_panel.sql:96` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_require_super_admin(p_actor_user_id integer)`
- `supabase/migrations/20261004074251_admin_control_panel.sql:102` — 1 match(es): `IF NOT public.sekka_is_super_admin(p_actor_user_id) THEN`
- `supabase/migrations/20261004074251_admin_control_panel.sql:107` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_require_super_admin(integer) FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261004074251_admin_control_panel.sql:108` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_require_super_admin(integer) TO service_role;`
- `supabase/migrations/20261004074251_admin_control_panel.sql:125` — 1 match(es): `PERFORM public.sekka_require_super_admin(p_actor_user_id);`
- `supabase/migrations/20261004074251_admin_control_panel.sql:143` — 1 match(es): `PERFORM public.sekka_require_super_admin(p_actor_user_id);`
- `supabase/migrations/20261004074251_admin_control_panel.sql:180` — 1 match(es): `PERFORM public.sekka_require_super_admin(p_actor_user_id);`
- `supabase/migrations/20261004074251_admin_control_panel.sql:215` — 1 match(es): `PERFORM public.sekka_require_super_admin(p_actor_user_id);`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:1` — 1 match(es): `-- Verification uploads are mediated by sekka-api because this application`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:105` — 1 match(es): `PERFORM public.sekka_require_super_admin(p_actor_user_id);`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:155` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_sync_captain_verification_after_phone()`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:172` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_sync_captain_verification_after_phone() FROM PUBLIC,anon,authenticated,service_role;`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:175` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_sync_captain_verification_after_phone();`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:177` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_suspend_captains_with_expired_document_grace()`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:203` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_suspend_captains_with_expired_document_grace()`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:205` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_suspend_captains_with_expired_document_grace() TO postgres;`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:212` — 1 match(es): `FOR job IN SELECT jobid FROM cron.job WHERE jobname='sekka-captain-verification-grace'`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:214` — 1 match(es): `PERFORM cron.schedule('sekka-captain-verification-grace','0 * * * *',`
- `supabase/migrations/20261004083050_verification_documents_and_captain_grace_period.sql:215` — 1 match(es): `'SELECT public.sekka_suspend_captains_with_expired_document_grace()');`
- `supabase/migrations/20261004115224_rider_captain_identity_verification.sql:2` — 1 match(es): `-- The API uses SeKKa's custom session tokens, so all metadata and signed URL`
- `supabase/migrations/20261004221047_identity_review_pending_guard.sql:21` — 1 match(es): `PERFORM public.sekka_require_super_admin(p_actor_user_id);`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:73` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_require_role('rider_user_id','rider');`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:82` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_geo_km(lat_a double precision, lng_a double precision, lat_b double precision, lng_b double precision)`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:90` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_match_demand_group(group_id integer) RETURNS void`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:103` — 1 match(es): `AND public.sekka_geo_km(l.origin_lat,l.origin_lng,demand.origin_lat,demand.origin_lng) <= radius_km`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:104` — 1 match(es): `AND public.sekka_geo_km(l.destination_lat,l.destination_lng,demand.destination_lat,demand.destination_lng) <= radius_km`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:105` — 2 match(es): `ORDER BY public.sekka_geo_km(l.origin_lat,l.origin_lng,demand.origin_lat,demand.origin_lng)+public.sekka_geo_km(l.destination_lat,l.destination_lng,demand.destination_lat,demand.de`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:128` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_cluster_demand_request() RETURNS trigger`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:139` — 1 match(es): `AND public.sekka_geo_km(g.origin_lat,g.origin_lng,NEW.pickup_lat,NEW.pickup_lng) <= radius_km`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:140` — 1 match(es): `AND public.sekka_geo_km(g.destination_lat,g.destination_lng,NEW.dropoff_lat,NEW.dropoff_lng) <= radius_km`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:164` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_cluster_demand_request();`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:166` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_match_after_demand_insert() RETURNS trigger`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:169` — 1 match(es): `PERFORM public.sekka_match_demand_group(NEW.demand_group_id);`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:173` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_match_after_demand_insert();`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:175` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_match_after_line_publish() RETURNS trigger`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:183` — 1 match(es): `PERFORM public.sekka_match_demand_group(demand_row.id);`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:209` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_match_after_line_publish();`
- `supabase/migrations/20261009214057_captain_lines_and_grouped_demands.sql:249` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_match_demand_group(integer) FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261009214344_secure_captain_line_demand_matching.sql:2` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_cluster_demand_request() FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261009214344_secure_captain_line_demand_matching.sql:3` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_match_after_demand_insert() FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261009214344_secure_captain_line_demand_matching.sql:4` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_match_after_line_publish() FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261009214344_secure_captain_line_demand_matching.sql:7` — 1 match(es): `ALTER FUNCTION public.sekka_geo_km(double precision, double precision, double precision, double precision)`
- `supabase/migrations/20261009214910_align_new_demand_with_matched_group.sql:3` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_match_after_demand_insert() RETURNS trigger`
- `supabase/migrations/20261009214910_align_new_demand_with_matched_group.sql:6` — 1 match(es): `PERFORM public.sekka_match_demand_group(NEW.demand_group_id);`
- `supabase/migrations/20261009214910_align_new_demand_with_matched_group.sql:18` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_match_after_demand_insert() FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20261009222850_lifecycle_audit_log.sql:34` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_capture_lifecycle_audit()`
- `supabase/migrations/20261009222850_lifecycle_audit_log.sql:115` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_capture_lifecycle_audit() FROM PUBLIC, anon, authenticated, service_role;`
- `supabase/migrations/20261009222850_lifecycle_audit_log.sql:119` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_capture_lifecycle_audit();`
- `supabase/migrations/20261009222850_lifecycle_audit_log.sql:122` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_capture_lifecycle_audit();`
- `supabase/migrations/20261009222850_lifecycle_audit_log.sql:125` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_capture_lifecycle_audit();`
- `supabase/migrations/20261009222850_lifecycle_audit_log.sql:127` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_audit_log_append_only()`
- `supabase/migrations/20261009222850_lifecycle_audit_log.sql:134` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_audit_log_append_only() FROM PUBLIC, anon, authenticated, service_role;`
- `supabase/migrations/20261009222850_lifecycle_audit_log.sql:136` — 1 match(es): `FOR EACH ROW EXECUTE FUNCTION public.sekka_audit_log_append_only();`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:1` — 1 match(es): `-- Manual rollback for the fresh SeKKa Supabase baseline.`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:53` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_take_rate_limit(text,integer,integer);`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:54` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_require_role();`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:55` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_validate_vehicle_capacity();`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:56` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_match_guard();`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:57` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_match_creates_trip();`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:58` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_trip_stop_order();`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:59` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_trip_complete_guard();`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:60` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_append_only();`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:61` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_payment_guard();`
- `supabase/rollback/20261001000000_postgres_baseline_001_013.sql:62` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_captain_verification_noop();`
- `supabase/rollback/20261001000003_pool_deadline_processor.sql:1` — 1 match(es): `-- Roll back only the SeKKa deadline processor. Keep pg_cron enabled because other project jobs may use it.`
- `supabase/rollback/20261001000003_pool_deadline_processor.sql:5` — 1 match(es): `FOR job IN SELECT jobid FROM cron.job WHERE jobname='sekka-process-pool-deadlines'`
- `supabase/rollback/20261001000003_pool_deadline_processor.sql:11` — 1 match(es): `DROP FUNCTION IF EXISTS public.sekka_process_pool_deadlines();`
- `supabase/rollback/20261001000004_deadline_scheduled_trips.sql:2` — 1 match(es): `CREATE OR REPLACE FUNCTION public.sekka_process_pool_deadlines()`
- `supabase/rollback/20261001000004_deadline_scheduled_trips.sql:149` — 1 match(es): `REVOKE ALL ON FUNCTION public.sekka_process_pool_deadlines() FROM PUBLIC, anon, authenticated, service_role;`
- `supabase/rollback/20261001000004_deadline_scheduled_trips.sql:150` — 1 match(es): `GRANT EXECUTE ON FUNCTION public.sekka_process_pool_deadlines() TO postgres;`
- `supabase/tests/captain_lines_and_demand_security.test.sql:35` — 1 match(es): `SELECT ok(NOT has_function_privilege('anon', 'public.sekka_cluster_demand_request()', 'EXECUTE'), 'anon cannot call the request-clustering trigger');`
- `supabase/tests/captain_lines_and_demand_security.test.sql:36` — 1 match(es): `SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_cluster_demand_request()', 'EXECUTE'), 'authenticated cannot call the request-clustering trigger');`
- `supabase/tests/captain_lines_and_demand_security.test.sql:37` — 1 match(es): `SELECT ok(NOT has_function_privilege('anon', 'public.sekka_match_after_demand_insert()', 'EXECUTE'), 'anon cannot call the demand-matching trigger');`
- `supabase/tests/captain_lines_and_demand_security.test.sql:38` — 1 match(es): `SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_match_after_demand_insert()', 'EXECUTE'), 'authenticated cannot call the demand-matching trigger');`
- `supabase/tests/captain_lines_and_demand_security.test.sql:39` — 1 match(es): `SELECT ok(NOT has_function_privilege('anon', 'public.sekka_match_after_line_publish()', 'EXECUTE'), 'anon cannot call the line-matching trigger');`
- `supabase/tests/captain_lines_and_demand_security.test.sql:40` — 1 match(es): `SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_match_after_line_publish()', 'EXECUTE'), 'authenticated cannot call the line-matching trigger');`
- `supabase/tests/lifecycle_audit_log_security.test.sql:13` — 1 match(es): `SELECT ok(NOT has_function_privilege('anon', 'public.sekka_capture_lifecycle_audit()', 'EXECUTE'), 'anon cannot call the audit trigger function');`
- `supabase/tests/lifecycle_audit_log_security.test.sql:14` — 1 match(es): `SELECT ok(NOT has_function_privilege('authenticated', 'public.sekka_capture_lifecycle_audit()', 'EXECUTE'), 'authenticated cannot call the audit trigger function');`
- `supabase/tests/lifecycle_audit_log_security.test.sql:15` — 1 match(es): `SELECT ok(NOT has_function_privilege('service_role', 'public.sekka_capture_lifecycle_audit()', 'EXECUTE'), 'service_role cannot call the audit trigger function directly');`

### storage bucket / policy (0 occurrences; 0 lines)

- None.

### Edge Function (30 occurrences; 25 lines)

- `README.md:34` — 1 match(es): `- يحسب Supabase Edge Function الطريق الفعلي عبر خدمة OSRM في \`SEKKA_ROUTING_URL\`، والإعداد الحالي الافتراضي هو \`https://router.project-osrm.org\`. يرسل الخادم إحداثيات محطات الرحلة `
- `docs/admin-control-panel.md:3` — 1 match(es): `The admin console is implemented in the existing React/Vite app and calls the authenticated \`sekka-api\` Supabase Edge Function. It does not ship a service key to the browser and do`
- `docs/admin-control-panel.md:81` — 1 match(es): `Each control-plane table has RLS enabled, client roles revoked, and an explicit deny policy. Privileged Edge Function RPCs call \`sekka_require_super_admin(actor_id)\` before writing`
- `docs/audit/sekka-full-audit-report.md:92` — 1 match(es): `الأدلة: [مسار الانضمام في Edge Function](../../supabase/functions/sekka-api/index.ts#L1308)، [قيود pool_members الحالية](../../supabase/migrations/20261001000000_postgres_baseline.`
- `docs/sekka-maps-routing-handoff.md:33` — 2 match(es): `- The repository now tracks the source of the already-active \`sekka-api\` Edge Function under \`supabase/functions/sekka-api\`, plus \`supabase/config.toml\` pinned to the user-confirme`
- `docs/supabase-migration.md:23` — 2 match(es): `\`supabase/functions/sekka-api/index.ts\` is deployed as the active \`sekka-api\` Edge Function. Gateway JWT verification is disabled because the handler validates the application's op`
- `docs/supabase-migration.md:25` — 1 match(es): `The active \`sekka-api\` Edge Function includes admin-controlled captain phone OTP through Twilio Verify. OTP remains disabled by default, validates the signed-in captain's registere`
- `docs/supabase-migration.md:31` — 1 match(es): `The web API client keeps local development on the same-origin \`/api\` proxy. Hosted builds default to the confirmed SeKKa Edge Function URL:`
- `docs/supabase-migration.md:39` — 1 match(es): `The reviewed migrations and backend deployment are complete. The latest hosted frontend build succeeded and defaults to the confirmed SeKKa Edge Function URL. These runtime integra`
- `docs/supabase-migration.md:41` — 1 match(es): `- **Private routing:** deploy an OSRM-compatible service reachable from Supabase Edge Functions and set \`SEKKA_ROUTING_URL\` as an Edge Function secret. The loopback default is for `
- `supabase/functions/sekka-api/cors.ts:1` — 1 match(es): `const PRODUCTION_ORIGIN = "https://sekka-go.pages.dev";`
- `supabase/functions/sekka-api/cors_test.ts:6` — 1 match(es): `allowedCorsOrigin("https://sekka-go.pages.dev"),`
- `supabase/functions/sekka-api/cors_test.ts:7` — 1 match(es): `"https://sekka-go.pages.dev",`
- `supabase/functions/sekka-api/cors_test.ts:13` — 1 match(es): `assertEquals(allowedCorsOrigin("https://preview.sekka-go.pages.dev"), null);`
- `supabase/functions/sekka-api/index.ts:79` — 2 match(es): `headers: { "User-Agent": "SeKKa-Ride-App/1.0 (+https://sekka-go.pages.dev/)", "Accept-Language": "ar" },`
- `supabase/functions/sekka-api/index.ts:100` — 2 match(es): `headers: { "User-Agent": "SeKKa-Ride-App/1.0 (+https://sekka-go.pages.dev/)", "Accept-Language": "ar" },`
- `supabase/functions/sekka-api/index.ts:422` — 1 match(es): `const { data, error: dbError } = await db!.rpc("sekka_take_rate_limit", { p_key: key.slice(0, 512), p_limit: limit, p_window_seconds: seconds });`
- `supabase/functions/sekka-api/index.ts:685` — 1 match(es): `const suffix = url.pathname.replace(/^\/(?:functions\/v1\/)?sekka-api(?=\/|$)/, "") || "/";`
- `supabase/functions/sekka-api/index.ts:707` — 1 match(es): `return reply({ status: "ok", service: "sekka-supabase-api", phase: 14, time: new Date().toISOString() }, 200, origin);`
- `supabase/functions/sekka-api/index.ts:1698` — 1 match(es): `console.error("[sekka-api] SMS provider rejected OTP request:", response.status);`
- `supabase/functions/sekka-api/index.ts:2103` — 1 match(es): `const hookUrl = \`${baseUrl.replace(/\/$/, "")}/functions/v1/sekka-api/webhooks/telegram\`;`
- `supabase/functions/sekka-api/index.ts:2555` — 1 match(es): `console.error("[sekka-api] request failed:", err instanceof Error ? err.name : "UnknownError");`
- `supabase/functions/sekka-api/routing.ts:119` — 2 match(es): `"User-Agent": "SeKKa-Ride-App/1.0 (+https://sekka-go.pages.dev/)",`
- `supabase/functions/sekka-api/routing.ts:120` — 1 match(es): `"Referer": "https://sekka-go.pages.dev/",`
- `supabase/functions/sekka-api/routing_test.ts:80` — 1 match(es): `"https://sekka-go.pages.dev/",`

### environment variable name (45 occurrences; 41 lines)

- `Dockerfile:19` — 2 match(es): `SEKKA_DB_PATH`
- `Dockerfile:20` — 1 match(es): `SEKKA_WEB_DIST`
- `SECURITY_TODO.md:35` — 1 match(es): `SEKKA_ALLOWED_ORIGINS`
- `server/.env.example:2` — 1 match(es): `SEKKA_VAPID_PUBLIC_KEY`
- `server/.env.example:3` — 1 match(es): `SEKKA_VAPID_PRIVATE_KEY`
- `server/.env.example:4` — 1 match(es): `SEKKA_VAPID_SUBJECT`
- `server/.env.example:5` — 1 match(es): `SEKKA_ROUTING_URL`
- `server/src/app.ts:47` — 1 match(es): `SEKKA_WEB_DIST`
- `server/src/db/connection.ts:10` — 2 match(es): `SEKKA_DB_PATH`
- `server/src/notifications/web-push.ts:18` — 1 match(es): `SEKKA_VAPID_PUBLIC_KEY`
- `server/src/notifications/web-push.ts:19` — 1 match(es): `SEKKA_VAPID_PRIVATE_KEY`
- `server/src/notifications/web-push.ts:20` — 1 match(es): `SEKKA_VAPID_SUBJECT`
- `server/src/pool/osrm.ts:14` — 1 match(es): `SEKKA_ROUTING_URL`
- `server/test/api-pool-matching.test.ts:36` — 1 match(es): `SEKKA_ROUTING_URL`
- `server/test/api-pool-matching.test.ts:37` — 1 match(es): `SEKKA_ROUTING_URL`
- `server/test/api-pool-matching.test.ts:41` — 1 match(es): `SEKKA_ROUTING_URL`
- `server/test/api-pool-matching.test.ts:42` — 1 match(es): `SEKKA_ROUTING_URL`
- `server/test/api-push.test.ts:8` — 1 match(es): `SEKKA_VAPID_PUBLIC_KEY`
- `server/test/api-push.test.ts:9` — 1 match(es): `SEKKA_VAPID_PRIVATE_KEY`
- `server/test/api-push.test.ts:10` — 1 match(es): `SEKKA_VAPID_SUBJECT`
- `server/test/api-push.test.ts:12` — 1 match(es): `SEKKA_VAPID_PUBLIC_KEY`
- `server/test/api-push.test.ts:13` — 1 match(es): `SEKKA_VAPID_PRIVATE_KEY`
- `server/test/api-push.test.ts:14` — 1 match(es): `SEKKA_VAPID_SUBJECT`
- `server/test/api-push.test.ts:18` — 1 match(es): `SEKKA_VAPID_PUBLIC_KEY`
- `server/test/api-push.test.ts:19` — 1 match(es): `SEKKA_VAPID_PUBLIC_KEY`
- `server/test/api-push.test.ts:20` — 1 match(es): `SEKKA_VAPID_PRIVATE_KEY`
- `server/test/api-push.test.ts:21` — 1 match(es): `SEKKA_VAPID_PRIVATE_KEY`
- `server/test/api-push.test.ts:22` — 1 match(es): `SEKKA_VAPID_SUBJECT`
- `server/test/api-push.test.ts:23` — 1 match(es): `SEKKA_VAPID_SUBJECT`
- `server/test/api-push.test.ts:43` — 3 match(es): `SEKKA_VAPID_PRIVATE_KEY, SEKKA_VAPID_PUBLIC_KEY, SEKKA_VAPID_SUBJECT`
- `server/test/api-push.test.ts:44` — 1 match(es): `SEKKA_VAPID_PRIVATE_KEY`
- `server/test/api-push.test.ts:49` — 1 match(es): `SEKKA_VAPID_PUBLIC_KEY`
- `server/test/api-push.test.ts:50` — 1 match(es): `SEKKA_VAPID_PRIVATE_KEY`
- `server/test/api-push.test.ts:51` — 1 match(es): `SEKKA_VAPID_SUBJECT`
- `supabase/functions/sekka-api/.env.example:2` — 1 match(es): `SEKKA_ROUTING_URL`
- `supabase/functions/sekka-api/index.ts:15` — 1 match(es): `SEKKA_ALLOWED_ORIGINS`
- `supabase/functions/sekka-api/index.ts:237` — 1 match(es): `SEKKA_ALLOWED_ORIGINS`
- `supabase/functions/sekka-api/index.ts:550` — 1 match(es): `SEKKA_ROUTING_URL`
- `supabase/functions/sekka-api/index.ts:1539` — 1 match(es): `SEKKA_VAPID_PUBLIC_KEY`
- `supabase/functions/sekka-api/index.ts:1540` — 1 match(es): `SEKKA_VAPID_PRIVATE_KEY`
- `supabase/functions/sekka-api/index.ts:1541` — 1 match(es): `SEKKA_VAPID_SUBJECT`

### URL / domain (17 occurrences; 17 lines)

- `PERF_AUDIT.md:4` — 1 match(es): `**Baseline target:** \`https://sekka-go.pages.dev/\` (production)`
- `README.md:27` — 1 match(es): `افتح \`http://127.0.0.1:5173/\`. الواجهة تمرر طلبات \`/api\` تلقائيًا إلى الخادم على المنفذ 3001. يتأكد من جاهزية الخادم عبر \`http://localhost:3001/api/health\`، وتُنشأ قاعدة البيانات ت`
- `SECURITY_TODO.md:29` — 1 match(es): `1. **Websites → sekka-go.pages.dev / domain → SSL/TLS → Overview**: use Full (strict) when an origin is configured; enable Always Use HTTPS and minimum TLS 1.2.`
- `docs/POOL_PHASE_11_HANDOFF.md:29` — 1 match(es): `- Routing uses an OSRM-compatible service with local \`http://127.0.0.1:5000\` as the default and \`SEKKA_ROUTING_URL\` as the override. No map tiles or UI are part of this backend pha`
- `docs/notifications-center/notification.schema.json:3` — 1 match(es): `"$id": "https://sekka.example/schemas/notification.schema.json",`
- `docs/pool-phase-11-api.md:117` — 1 match(es): `- Routing uses the OSRM-compatible service configured in \`SEKKA_ROUTING_URL\`; the default is \`https://router.project-osrm.org\`. The server requests outbound and reverse waypoint ro`
- `docs/sekka-maps-routing-handoff.md:35` — 1 match(es): `- \`SEKKA_ROUTING_URL\` is optional. Its example points at the community OSRM demo. Set a different URL only when an operator has a compatible service. Do not put credentials in this`
- `docs/stitch-screens/batch-c-pkg5/_2/code.html:57` — 1 match(es): `<img alt="SeKKa Logo" class="w-8 h-8 rounded-full object-contain bg-[#1c1f26] p-0.5 border border-amber-400/30" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDI1tWCa6HgI`
- `docs/stitch-screens/batch-c-pkg5/_3/code.html:76` — 1 match(es): `<img alt="SeKKa Logo" class="w-full h-full object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHIkqfRaFP7SgPMfhfUu2WOeEgnopxWXfauYZ12PsPOBVKy96hgDGXQt7lqhNr0S`
- `docs/stitch-screens/batch-c-pkg5/_5/code.html:62` — 1 match(es): `<img alt="SeKKa Logo Icon" class="w-7 h-7 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHzbTvv2n6HJ4DcXJvu8nJ6wUUuhr90LbDx_GlbQI32g-jbHC1wUCxjzJXtcjA6C5`
- `docs/supabase-migration.md:33` — 1 match(es): `\`https://uorxfakceqnhxqnaawdy.supabase.co/functions/v1/sekka-api\``
- `docs/supabase-migration.md:35` — 1 match(es): `Set \`VITE_API_BASE_URL\` only when overriding that endpoint. \`VITE_SUPABASE_PUBLISHABLE_KEY\` is also optional because the project's public \`sb_publishable_...\` key is a non-secret f`
- `server/src/index.ts:42` — 1 match(es): `console.log(\`[sekka-server] Phase 14 listening on http://localhost:${PORT}\`);`
- `web/index.html:16` — 1 match(es): `<meta property="og:url" content="https://sekka-go.pages.dev/" />`
- `web/index.html:17` — 1 match(es): `<meta property="og:image" content="https://sekka-go.pages.dev/brand/pwa-icon-512.png" />`
- `web/index.html:25` — 1 match(es): `<meta name="twitter:image" content="https://sekka-go.pages.dev/brand/pwa-icon-512.png" />`
- `web/src/api.ts:71` — 1 match(es): `const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "" : "https://uorxfakceqnhxqnaawdy.supabase.co/functions/v1/sekka-api")).replace(/\/+$/, "");`

### client state key / cache (8 occurrences; 8 lines)

- `docs/pwa.md:3` — 1 match(es): `SeKKa is served over HTTPS by Cloudflare Pages and has an Arabic RTL web app manifest and service worker. Modern browsers require an app name, install icons (192 px and 512 px), st`
- `web/public/sw.js:2` — 1 match(es): `const CACHE_NAME = "sekka-shell-v8";`
- `web/public/theme-preference.js:3` — 1 match(es): `const preference = localStorage.getItem("sekka.theme");`
- `web/src/App.tsx:11` — 1 match(es): `const stored = localStorage.getItem("sekka.theme");`
- `web/src/App.tsx:52` — 1 match(es): `try { localStorage.setItem("sekka.theme", themePreference); } catch { /* Keep the in-memory choice if storage is unavailable. */ }`
- `web/src/i18n/runtime.tsx:24` — 1 match(es): `const saved = localStorage.getItem("sekka.language");`
- `web/src/i18n/runtime.tsx:75` — 1 match(es): `try { localStorage.setItem("sekka.language", language); } catch { /* Preserve the in-memory choice. */ }`
- `web/src/screens/Workspace.tsx:238` — 1 match(es): `localStorage.setItem(\`sekka.verification.focus.${session.user.id}\`, target);`

### comment (17 occurrences; 17 lines)

- `.github/CODEOWNERS:2` — 1 match(es): `# Example: * @sekka-go/maintainers`
- `AGENTS.md:1` — 1 match(es): `# SeKKa Repository Guidance`
- `PERF_AUDIT.md:1` — 1 match(es): `# SeKKa Performance Audit`
- `README.md:1` — 1 match(es): `# سِكّة | SeKKa`
- `SECURITY_AUDIT.md:1` — 1 match(es): `# SeKKa Security Audit`
- `docs/TASKS_PHASE1.md:1` — 1 match(es): `# SeKKa Phase 1 Task Plan`
- `docs/admin-control-panel.md:1` — 1 match(es): `# SeKKa Super Admin Control Panel`
- `docs/design-system/sekka/DESIGN.md:113` — 1 match(es): `# سِكَّة | SeKKa — DESIGN SYSTEM`
- `docs/pwa.md:1` — 1 match(es): `# SeKKa PWA`
- `docs/sekka-maps-routing-handoff.md:1` — 1 match(es): `# SeKKa maps and routing handoff`
- `server/src/db/connection.ts:6` — 1 match(es): `* مسار قاعدة البيانات الافتراضي: server/data/sekka.db (يتولّد أول مرة تشتغل).`
- `server/src/db/connection.ts:7` — 1 match(es): `* قابل للتغيير عبر SEKKA_DB_PATH (مفيد للاختبارات: ":memory:").`
- `server/src/index.ts:8` — 1 match(es): `// SeKKa | سِكَّة — Backend`
- `web/README.md:1` — 1 match(es): `# SeKKa Web`
- `web/src/design-system.css:1` — 1 match(es): `/* SeKKa semantic design tokens and shared component surfaces. */`
- `web/src/styles.css:1629` — 1 match(es): `/* Toasts sit above the mobile navigation and use the Sekka surface palette. */`
- `web/src/theme.css:1` — 1 match(es): `/* Shared SeKKa color system. Every screen reads from these semantic tokens. */`

### configuration / docs / other (81 occurrences; 66 lines)

- `.gitattributes:1` — 1 match(es): `supabase/functions/sekka-api/routing.ts text eol=lf`
- `.gitattributes:2` — 1 match(es): `supabase/functions/sekka-api/routing_test.ts text eol=lf`
- `.gitattributes:3` — 1 match(es): `supabase/functions/sekka-api/locations.ts text eol=lf`
- `.github/workflows/sekka-routing.yml:6` — 1 match(es): `- "supabase/functions/sekka-api/**"`
- `.github/workflows/sekka-routing.yml:11` — 1 match(es): `- ".github/workflows/sekka-routing.yml"`
- `.github/workflows/sekka-routing.yml:18` — 1 match(es): `- "supabase/functions/sekka-api/**"`
- `.github/workflows/sekka-routing.yml:23` — 1 match(es): `- ".github/workflows/sekka-routing.yml"`
- `.github/workflows/sekka-routing.yml:38` — 4 match(es): `run: deno fmt --check supabase/functions/sekka-api/locations.ts supabase/functions/sekka-api/locations_test.ts supabase/functions/sekka-api/routing.ts supabase/functions/sekka-api/`
- `.github/workflows/sekka-routing.yml:40` — 4 match(es): `run: deno lint supabase/functions/sekka-api/locations.ts supabase/functions/sekka-api/locations_test.ts supabase/functions/sekka-api/routing.ts supabase/functions/sekka-api/routing`
- `.github/workflows/sekka-routing.yml:42` — 2 match(es): `run: deno test supabase/functions/sekka-api/locations_test.ts supabase/functions/sekka-api/routing_test.ts`
- `.github/workflows/sekka-routing.yml:44` — 1 match(es): `run: deno check supabase/functions/sekka-api/index.ts`
- `AGENTS.md:3` — 1 match(es): `SeKKa is an Arabic, RTL-first marketplace for regular shared rides in Egypt. Captains publish a route (line), arrival time, service days, seat count, and price. Riders search with `
- `Caddyfile:1` — 1 match(es): `{$SEKKA_DOMAIN} {`
- `Caddyfile:10` — 1 match(es): `reverse_proxy sekka:3001`
- `NEXT_PROMPT.md:1` — 1 match(es): `[أرفق: sekka-phase-8-password-change.zip كامل (المشروع بعد Phase 8)]`
- `NEXT_PROMPT.md:3` — 1 match(es): `== SEKKA GLOBAL RULES — تُطبَّق حرفيًا في كل مرحلة ==`
- `PERF_AUDIT.md:29` — 2 match(es): `The initial production database advisor reported six unindexed foreign keys. The additive migration for those six FK indexes was subsequently applied to production and verified. A `
- `SECURITY_AUDIT.md:12` — 3 match(es): `| SEC-04 | Medium | \`supabase/functions/sekka-api/index.ts\`, all JSON and binary responses | CORS accepted any HTTPS subdomain ending in \`.sekka-go.pages.dev\` and returned \`Access-`
- `compose.yaml:2` — 1 match(es): `sekka:`
- `compose.yaml:9` — 2 match(es): `SEKKA_DB_PATH: /data/sekka.db`
- `compose.yaml:10` — 1 match(es): `SEKKA_WEB_DIST: /app/web-dist`
- `compose.yaml:11` — 3 match(es): `SEKKA_ROUTING_URL: ${SEKKA_ROUTING_URL:?Set SEKKA_ROUTING_URL in the root .env file}`
- `compose.yaml:13` — 1 match(es): `- sekka-data:/data`
- `compose.yaml:27` — 3 match(es): `SEKKA_DOMAIN: ${SEKKA_DOMAIN:?Set SEKKA_DOMAIN in the root .env file}`
- `compose.yaml:37` — 1 match(es): `sekka:`
- `compose.yaml:41` — 1 match(es): `sekka-data:`
- `deno.json:7` — 1 match(es): `"check:edge": "deno check supabase/functions/sekka-api/index.ts"`
- `docs/admin-control-panel.md:97` — 1 match(es): `PERFORM public.sekka_require_super_admin(p_actor_user_id);`
- `docs/admin-control-panel.md:115` — 1 match(es): `\`supabase/functions/sekka-api/index.ts\` routes every \`/admin/*\` request through one Super Admin gate before dispatch:`
- `docs/audit/sekka-full-audit-report.md:20` — 1 match(es): `- فحصت مراجع 106 فروع توجيه في \`supabase/functions/sekka-api/index.ts\`، ومخططات 51 جدولًا في migrations، وسياسات التخزين، واختبارات pgTAP الموجودة. هذا فحص مصدري؛ لا يعني تنفيذ كل `
- `docs/audit/sekka-full-audit-report.md:65` — 1 match(es): `- \`pnpm dlx deno check supabase/functions/sekka-api/index.ts\` — نجح.`
- `docs/audit/sekka-full-audit-report.md:74` — 1 match(es): `- \`supabase/functions/sekka-api/index.ts\` — قراءة JSON محدودة ومتدفقة، واستعلام اشتراك مقيد بعضوية الراكب، وتنظيف lint.`
- `docs/audit/sekka-full-audit-report.md:75` — 1 match(es): `- \`supabase/functions/sekka-api/request-body.ts\` و\`request-body_test.ts\` — قارئ جسم JSON محدود واختباراته.`
- `docs/audit/sekka-full-audit-report.md:76` — 1 match(es): `- \`supabase/functions/sekka-api/group-view.ts\` و\`group-view_test.ts\` — اختيار عضوية الراكب النشط واختبار العزل.`
- `docs/audit/sekka-full-audit-report.md:78` — 1 match(es): `- \`docs/audit/sekka-full-audit-report.md\` — تحديث هذا التقرير.`
- `docs/audit/sekka-full-audit-report.md:118` — 1 match(es): `الأدلة: [تعريف users](../../supabase/migrations/20261001000000_postgres_baseline.sql#L6)، [تقييد التسجيل](../../supabase/functions/sekka-api/index.ts#L985)، [منع صلاحيات SQL المباش`
- `docs/audit/sekka-full-audit-report.md:126` — 1 match(es): `الأدلة: [workflow الخاص بالتوجيه](../../.github/workflows/sekka-routing.yml)، [اختبارات قاعدة Supabase](../../supabase/tests).`
- `docs/audit/sekka-full-audit-report.md:132` — 1 match(es): `الأدلة: [وثائق مهام المرحلة](../TASKS_PHASE1.md)، [نقطة التسجيل](../../supabase/functions/sekka-api/index.ts#L985).`
- `docs/audit/sekka-full-audit-report.md:169` — 1 match(es): `- \`docs/audit/sekka-full-audit-report.md\` — هذا التقرير.`
- `docs/design-system/sekka/DESIGN.md:2` — 1 match(es): `name: SeKKa`
- `docs/notifications-center/notification.schema.json:4` — 1 match(es): `"title": "SeKKa Notification",`
- `docs/pwa.md:10` — 1 match(es): `- When offline, SeKKa serves a small branded retry page. Booking and live trip data require an internet connection and are never represented as available offline.`
- `docs/pwa.md:11` — 1 match(es): `- The manifest and install icons use SeKKa's road-and-pin app logo, Arabic name, RTL language, and standalone launch mode.`
- `docs/pwa.md:33` — 1 match(es): `- On iOS Safari, use Share → Add to Home Screen and confirm the SeKKa icon and Arabic title.`
- `docs/sekka-maps-routing-handoff.md:7` — 1 match(es): `- Calculate road routes server-side through the OSRM-compatible endpoint in \`SEKKA_ROUTING_URL\`. The default is the public OSRM demo host. No route key is required.`
- `docs/sekka-maps-routing-handoff.md:42` — 1 match(es): `- The OSRM public demo is a best-effort demonstration endpoint; availability and usage are not guaranteed. A public service may limit or withdraw access. Production growth requires`
- `docs/sekka-maps-routing-handoff.md:43` — 1 match(es): `- OSM sees the user's network address and requested visible tiles. The OSRM host receives trip coordinates for route calculation. Existing Supabase cleanup job \`sekka-purge-expired`
- `docs/supabase-migration.md:3` — 1 match(es): `Project: \`seKKa\` (\`uorxfakceqnhxqnaawdy\`). The project was confirmed active and empty before the first migration. No schema or functions from the unrelated Elnarges project were us`
- `docs/supabase-migration.md:27` — 1 match(es): `The deadline processor runs in PostgreSQL through the named \`pg_cron\` job \`sekka-process-pool-deadlines\`, once per minute. It notifies groups at 72 hours and records cancellations/`
- `docs/supabase-migration.md:51` — 1 match(es): `Supabase applies each migration transactionally; a failed migration leaves no partial DDL. The first failed attempt was checked and left no tables. The manual rollback at \`supabase`
- `package.json:2` — 1 match(es): `"name": "sekka",`
- `package.json:10` — 1 match(es): `"test": "pnpm --filter sekka-server test"`
- `server/package-lock.json:2` — 1 match(es): `"name": "sekka-server",`
- `server/package-lock.json:8` — 1 match(es): `"name": "sekka-server",`
- `server/package.json:2` — 1 match(es): `"name": "sekka-server",`
- `server/src/app.ts:30` — 1 match(es): `service: "sekka-server",`
- `server/src/index.ts:31` — 1 match(es): `console.log(\`[sekka-server] Applied migrations: ${applied.join(", ")}\`);`
- `server/src/pool/osrm.ts:22` — 1 match(es): `headers: { "user-agent": "Sekka-Pool/1.0 (server-side route estimates)" },`
- `server/src/security/otp.ts:51` — 1 match(es): `\`[sekka-server][DEV-ONLY، مش SMS حقيقي] OTP لـ ${maskedPhone}: ${otp} (صالح 5 دقائق)\`,`
- `supabase/config.toml:3` — 1 match(es): `[functions.sekka-api]`
- `web/README.md:3` — 1 match(es): `واجهة SeKKa مبنية بـ React وTypeScript وVite. هذا المجلد يحتوي تطبيق الويب فقط؛ الـAPI والخدمات وقاعدة البيانات موجودة في \`../server\`.`
- `web/src/pwa.ts:24` — 1 match(es): `console.warn("SeKKa offline support is unavailable.", error);`
- `web/src/styles.css:186` — 1 match(es): `.sekka-map-marker{background:transparent;border:0}`
- `web/src/styles.css:188` — 1 match(es): `.sekka-map-marker .map-stop-dropoff{background:#6bd4d0}`
- `web/src/styles.css:1638` — 1 match(es): `@keyframes sekka-toast-enter { from { opacity: 0; translate: 0 .7rem; } to { opacity: 1; translate: 0 0; } }`
- `web/src/theme.css:357` — 1 match(es): `:root[data-theme="light"] .sekka-splash,`

## Initial findings and decisions

- Current app/server/Edge Function technical names and SQL identifiers are predominantly already prefixed with lowercase `sekka`; they were not bulk-replaced.
- `SikkaMark` was renamed to `SekkaMark`, stale `SikkaSplash` locale namespace was normalized to `SekkaSplash`, and `.sikka-splash` was normalized to `.sekka-splash`. Two mixed/uppercase technical documentation filenames were changed to kebab-case.
- The PWA manifest now displays `سِكَّة | SeKKa`, the HTML application name matches, and the shell cache was bumped from v7 to v8 so installed clients fetch the updated manifest. Existing client-state keys and cache prefixes already use lowercase `sekka`; no old-key migration was needed.
- User-facing brand text remains exactly `SeKKa`; Arabic branding remains unchanged. `SEKKA_*` environment names, production hostnames and repository remote are intentionally protected per request.
- Database migration files will only be added if staging catalog inventory shows existing objects that need renaming. SQL source inspection alone does not establish live catalog state.
- The connected hosted Supabase project has no development branches. A read-only catalog check found no legacy `sikka` database object names, no routine definitions containing that spelling, and RLS enabled on all 52 public tables. The latest recorded migration is `20261010043804`. No production data or schema was changed. See `RENAME_TODO.md` and `RENAME_RUNBOOK.md`.
- No blind replacement was used. Each implementation edit was based on specific matches and reviewed before commit.
