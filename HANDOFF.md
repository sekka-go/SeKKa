# HANDOFF — Phase 10: فئات Commute Pool + دوال التسعير

## اللي اتعمل
- `migrations/009_pool_categories.sql`: جدول `pool_categories` جديد مستقل (4 فئات Faster/Saver × AC/Non-AC بالأرقام المعتمدة في اقتراح رقم 6). مفيش لمس لأي migration قديمة ولا لـ `pricing_config`.
- `src/pricing/pool-fare.ts`: `findPoolCategory`, `calculatePoolRouteFare` (بتستخدم `calculateFare` الوحيدة)، `calculatePerSeatFare`, `calculateRoundTripPerSeatFare`, `isCaptainWithinPickupRange`, والثابت `MAX_CAPTAIN_TO_FIRST_PICKUP_KM = 4`.
- `test/pool-fare.test.ts` (5 اختبارات) + تحديث `test/migrate.test.ts` لـ 009. `/api/health` → phase 10.
- (من Phase 9) Rate limiting على login وchange-password.

## التحقق الفعلي
`npm install`، `npx tsc --noEmit` صفر أخطاء، `npm test` → **179/179، 56 suite، صفر فشل**.

## مش موجود لسه
دومين الـ Pool الكامل (مسارات/مقاعد/انتظار/مطابقة/باقات/إشعارات) ودالة الترتيب الفعلي للنقط. الحد الأقصى 4 كم متعرّف كثابت ودالة بس، مش متوصل بمطابقة فعلية. راجع "المهمة: وقف هنا" في NEXT_PROMPT.md.
