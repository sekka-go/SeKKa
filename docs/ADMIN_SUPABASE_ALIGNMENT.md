# توافق لوحة الإدارة مع Supabase

تاريخ المراجعة: 30 أكتوبر 2026

## ما تم توصيله

تستخدم لوحة الإدارة الآن Edge Function المنشورة `sekka-api` وجلساتها المخصصة، بدل استعلامات العميل المباشرة إلى جداول لم تعد موجودة مثل `profiles` و`ride_groups`. تسجيل دخول الإدارة يتحقق من الدور من رد الخادم، ويُحفظ رمز الجلسة في `sessionStorage`، وتُرفض صفحات الإدارة عند غياب الجلسة أو صلاحية المسؤول.

| واجهة الإدارة | مصدرها في خدمة Supabase |
|---|---|
| مؤشرات الإدارة والتقارير | `GET /admin/analytics/overview` |
| المستخدمون والتفاصيل وتغيير الحالة | `GET /admin/users`, `/admin/users/:id`, `PATCH /admin/users/:id/status` |
| الكباتن والتحقق | `GET /admin/captains`, `POST /admin/captains/:id/verification` |
| وثائق التحقق ومراجعتها | `GET /admin/verifications`, `POST /admin/verifications/:id/review` |
| المركبات | `GET /config` |
| الرحلات والمجموعات | `GET /admin/trips`, `GET /admin/pool/overview` |
| النزاعات والمدفوعات | `GET /admin/disputes`, `/admin/payments/:id` |
| التسعير والعمولة | `GET /admin/settings`, `PATCH /admin/settings/pool-categories/:id`; نسبة العمولة تبقى 0% |
| الحملات وإعداد OTP | `/admin/commuter-board-campaigns`, `/admin/settings/otp` |
| الملخص المالي والدفتر والتدقيق | `/admin/finance/summary`, `/admin/ledger/adjustments`, `/admin/audit` |
| إشعارات المسؤول | `/pool/notifications` |

تضيف لوحة الإدارة روابط شاشة للرحلات التشغيلية، ومؤشرات المجموعات، والملخص المالي، والتسعير، والحملات، وإعداد التحقق، ودفتر الحسابات، وهي وظائف موجودة في API ولم تكن ظاهرة في لوحة الشاشات السابقة.

## الفجوات التي بقيت ظاهرة

لا توجد مسارات إدارة حالية للعروض أو طلبات الركاب أو الاشتراكات أو الشكاوى أو التقييمات أو صلاحيات فريق مفصلة. لا تعرض الواجهة بيانات وهمية لهذه الأقسام. إنشاء جداول ومسارات للشكاوى والتقييمات ودورة الاشتراك يحتاج حسم قواعد المنتج المفتوحة في `docs/product-spec/DECISION_LOG.md`، ولذلك لم تُخترع قواعد أو سياسات RLS خلال هذه الدفعة.

## إعداد التطوير

يقرأ التطبيق `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY` من البيئة. ملف `web/.env.local` محلي ومُستثنى من Git. يمرر Vite طلبات التطوير إلى Supabase عبر `/__sekka-api` كي تعمل معاينة `127.0.0.1:5173` دون تغيير CORS في الخدمة المنشورة. في النشر يجب ضبط المتغيرين في بيئة الاستضافة.

## التحقق

- `npm run typecheck`: ناجح.
- `npm run build`: ناجح؛ ظهر تحذير حجم chunk أكبر من 500 كيلوبايت.
- `/admin` دون جلسة: يعيد التوجيه إلى `/admin/login`.
- `GET /__sekka-api/health` من معاينة Vite: HTTP 200.
- لم تُجرَ محاولة دخول بحساب إداري أو كتابة على بيانات الإنتاج.
