# SeKKa — أصول الهوية

**الحالة:** مصدر الرسم موحّد في `web/src/brand/sekka-mark.svg`. يعرضه مكوّن React بألوان الثيم، وتُولّد منه أصول SVG/PNG الثابتة عبر `pnpm --filter web generate:icons`.

## الملفات

| الملف | الاستخدام |
|---|---|
| `web/src/brand/sekka-mark.svg` | المصدر الوحيد لمسار S ونقطتي الوصول. |
| `web/src/components/SekkaMark.tsx` | يرسم المصدر داخل React بألوان متوافقة مع الثيم. |
| `web/src/components/BrandLogo.tsx` | قفل الشعار والنص الرسمي `سِكّة | SeKKa`. |
| `web/src/components/SekkaSplash.tsx` | مشهد السيارة والسائق الذي يلوّح، مع علامة سِكّة نفسها. |
| `web/public/brand/sekka-mark.svg`, `favicon.svg` | نسخة SVG ثابتة للموقع وfavicon. |
| `web/public/brand/favicon-32.png`, `favicon-48.png` | Favicon PNG للأحجام الشائعة. |
| `web/public/brand/apple-touch-icon-180.png` | أيقونة إضافة الشاشة الرئيسية على Apple. |
| `web/public/brand/pwa-icon-192.png`, `pwa-icon-512.png` | أيقونات manifest الشفافة `purpose: any`. |
| `web/public/brand/pwa-icon-192-maskable.png`, `pwa-icon-512-maskable.png` | نسخ مستقلة بخلفية خضراء لمنصات maskable. |
| `web/public/brand/sekka-badge.png`, `sekka-share.png` | شارة الإشعارات وصورة Open Graph/Twitter. |
| `web/scripts/generate-pwa-icons.mjs` | يولّد كل الأصول الثابتة من SVG المصدر باستخدام Sharp. |

## الربط والتحديث

- `web/index.html` يربط favicon وApple وبيانات المشاركة؛ الـmanifest يربط نسخ `any` و`maskable` كلًّا على حدة.
- `web/public/sw.js` يسبق تخزين الأصول ويرفع cache إلى `sekka-shell-v11` لحذف صور الهوية القديمة عند التفعيل.
- لتعديل العلامة: عدّل SVG المصدر، ثم شغّل `pnpm --filter web generate:icons` و`pnpm --filter web check:pwa`.
- `logo-checksums.txt` يحفظ بصمات المصدر والمخرجات الرئيسية لمراجعة التغييرات.
