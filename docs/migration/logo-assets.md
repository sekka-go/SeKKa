# SeKKa — سجل أصول الهوية المحمية

**الحالة:** جرد فقط — لم يتغير أي أصل أو ملف هوية. SHA-256 المسجل في `logo-checksums.txt` هو خط الأساس.

## ملفات الرسم والهوية

| الملف | الوظيفة/المرجع |
|---|---|
| `web/public/brand/pwa-icon-192.png` | أيقونة PWA، favicon PNG، وApple touch icon عبر `web/index.html`؛ مدرجة أيضًا في manifest. |
| `web/public/brand/pwa-icon-512.png` | أيقونة PWA 512، وOpen Graph/Twitter image، ومدرجة في manifest. |
| `web/src/components/SekkaMark.tsx` | رسم SVG المتجهي الأساسي (المسار والدبابيس)؛ يُرسم داخل عناصر الهوية. |
| `web/src/components/BrandLogo.tsx` | قفل الشعار والنص الرسمي `سِكَّة | SeKKa` والعبارة التابعة. |
| `web/src/components/SekkaSplash.tsx` | رسم الـ splash؛ يستخدم SekkaMark للشعار المركزي والعلامات الزخرفية. |

## ملفات ربط/عرض الهوية — محمية أيضًا احتياطًا

| الملف | السبب |
|---|---|
| `web/public/manifest.webmanifest` | أسماء التطبيق ومداخل الأيقونات وبيانات التطبيق المثبت. لا تُعدل إدخالات icons. |
| `web/index.html` | favicon/Apple icon/manifest وOpen Graph وTwitter metadata. |
| `web/src/brand-lockup.css` | قياسات وترتيب BrandLogo في الشاشات المختلفة؛ يسمح التصميم بتغيير المساحة المحيطة فقط بعد اعتماد المستخدم، لكن الملف ضمن البصمة الوقائية. |
| `web/src/splash.css` | تنسيق ظهور الشعار/شاشة البداية؛ محفوظ ضمن البصمة الوقائية إلى أن يعتمد نطاق الشكل. |
| `web/scripts/generate-pwa-icons.mjs` | يعيد كتابة أيقونات PNG عند `pnpm build`؛ لم يُشغل. يجب عدم تشغيله أو تغيير مخرجاته خلال عمل التصميم. |

## أماكن رسم الشعار التي ظهرت في المصدر

- `web/src/screens/LandingScreen.tsx` — رأس الصفحة العامة عبر `BrandLogo`.
- `web/src/screens/AuthScreen.tsx` — رأس صفحات الدخول/التسجيل عبر `BrandLogo`.
- `web/src/screens/Workspace.tsx` — شريط التطبيق العلوي عبر `BrandLogo`، وعلامة `SekkaMark` الافتتاحية و`SekkaSplash`.
- `web/src/components/SignupVerificationFlow.tsx` — رأس تدفق التوثيق عبر `BrandLogo`.
- `web/src/components/workspace-shared.tsx` — صورة علامة SeKKa المختصرة في إشعارات النظام عبر `BrandLogo compact`.
- `web/src/components/SekkaSplash.tsx` — الرمز المركزي والعلامات المتحركة عبر `SekkaMark`.
- `web/index.html` + `web/public/manifest.webmanifest` — favicon/PWA/Apple/OG/Twitter.

## ملاحظات النطاق

- لا يوجد ملف صورة مستقل لـApple touch أو OG: كلاهما يعيدان استخدام `pwa-icon-192.png` و`pwa-icon-512.png`.
- يشير Service Worker إلى `/favicon.ico` (`web/public/sw.js`)، لكن الجرد الحالي لم يعثر على ملف منفصل بهذا الاسم؛ favicon المعرّف في HTML هو PNG.
- تتبع أصول Stitch التي تتضمن رسم شعار SeKKa ليس مرجعًا لتبديل علامة المنتج. لا يُنسخ أو يعاد تصدير أي رسم من التصدير.
- يجب إعادة حساب كل بصمات الملفات المذكورة قبل/بعد أي مرحلة تصميم، والتحقق أن diff لا يمس ملفات الهوية أو نص العلامة `سِكّة`.
