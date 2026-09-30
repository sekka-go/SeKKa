# HANDOFF — Project Status Update (Phase 14)

## الحالة الحالية
- Phase 11: Commute Pool backend والجداول المستقلة في `010_pool_domain.sql`.
- Phase 12: دفتر تسوية 20/80 وخصومات الباقات، بحالة `pending` ومن دون دفع فعلي، في `011_pool_settlement.sql`.
- Phase 13: سجل احتياطي تقديري لأربعة أيام للكابتن الثابت وحركات البديل في `012_pool_captain_escrow.sql`.
- Phase 14: Web Push اختياري عبر VAPID environment variables، subscriptions في migration `013_push_subscriptions.sql`، والرسائل داخل التطبيق تظل المصدر الأساسي.
- واجهة React عربية RTL وPWA موجودة في `/web`.
- التوثيق التنفيذي الأحدث في `docs/POOL_PHASE_11_HANDOFF.md` و`docs/pool-phase-11-api.md`.
- المتبقي الأهم: المطابقة التلقائية بين مجموعات الانتظار المستقلة، وربط غياب الكابتن البديل باليوم كاملًا بدل كل leg.

## سجل تاريخي

## اللي اتعمل
- `migrations/009_pool_categories.sql`: جدول `pool_categories` جديد مستقل (4 فئات Faster/Saver × AC/Non-AC بالأرقام المعتمدة في اقتراح رقم 6). مفيش لمس لأي migration قديمة ولا لـ `pricing_config`.
- `src/pricing/pool-fare.ts`: `findPoolCategory`, `calculatePoolRouteFare` (بتستخدم `calculateFare` الوحيدة)، `calculatePerSeatFare`, `calculateRoundTripPerSeatFare`, `isCaptainWithinPickupRange`, والثابت `MAX_CAPTAIN_TO_FIRST_PICKUP_KM = 4`.
- `test/pool-fare.test.ts` (5 اختبارات) + تحديث `test/migrate.test.ts` لـ 009. `/api/health` → phase 10.
- (من Phase 9) Rate limiting على login وchange-password.

## التحقق الفعلي
`npm install`، `npx tsc --noEmit` صفر أخطاء، `npm test` → **179/179، 56 suite، صفر فشل**.

## مش موجود لسه
دومين الـ Pool الكامل (مسارات/مقاعد/انتظار/مطابقة/باقات/إشعارات) ودالة الترتيب الفعلي للنقط. الحد الأقصى 4 كم متعرّف كثابت ودالة بس، مش متوصل بمطابقة فعلية. راجع "المهمة: وقف هنا" في NEXT_PROMPT.md.
