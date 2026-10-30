# مواءمة المنتج والمعالجة التقنية — SeKKa

تاريخ المراجعة: 2026-10-31  
نقطة البداية: `f0b6af5609aaa411152c0b0b60488d9ac9db90ef`  
الفرع: `codex/sekka-ui-rebuild`  
مرجع Supabase المعتمد للمراجعة: `uorxfakceqnhxqnaawdy`

## النطاق والقيود

راجع هذا المستند قواعد المنتج الأحدث التي أرسلها مالك المنتج في طلب المرحلة، ثم فحص الواجهة ومصدر Edge Function المنشور ومخطط قاعدة البيانات الحية قراءة فقط. لم تُطبق أي Migration، ولم تتغير بيانات أو إعدادات Supabase/Cloudflare، ولم يحدث Deploy أو دمج. الملفات المحلية غير المتتبعة الموجودة قبل المهمة محفوظة.

قواعد هذا الطلب الأحدث تتقدم في مواءمة هذه المرحلة على وثائق المنتج الأقدم الموجودة بالمستودع، والتي ما زالت تصف نموذج اشتراك وتشغيل جماعي أوسع. لم أعدّل تلك الوثائق أو أعد كتابة تاريخ قرارات المنتج.

## 1. مصفوفة مواءمة المنتج

| الوظيفة | التصنيف للـMVP | التوجيه |
|---|---|---|
| تسجيل الراكب والكابتن، وإدارة الجلسة والأدوار | مطلوبة | استخدام مسارات API الحالية، ثم اختبارها بحسابات staging |
| نشر الكابتن للعروض وتعديلها وإيقافها | مطلوبة | الإبقاء على عمليات الخطوط الحالية، والتحقق من صلاحيات الملكية والاعتماد |
| بحث الراكب ومقارنة العروض | مطلوبة | نتائج الترتيب توصيات فقط؛ لا تعيّن كابتنًا ولا تعد بتنفيذ الرحلة |
| تفاصيل العرض | مطلوبة | توضيح السعر والطريق والتوفر كما يعيدها الخادم؛ التفاصيل ليست حجزًا |
| المطابقة اليومية / ترتيب النتائج | مطلوبة مع إعادة تصميم | استخدامها للترشيح والترتيب والتوصية. لا تنشئ تعيينًا أو رحلة تلقائية |
| طلب الانضمام إلى عرض بعينه | مطلوبة مع إعادة تصميم | طلب تواصل/اهتمام مرتبط بمعرّف العرض؛ لا يعني حجزًا مؤكدًا أو وجود رحلة |
| إنشاء المجموعات ومشاركة روابطها | مطلوبة | يلزم عقد جديد متوافق مع السوق المفتوح؛ الـAPI الحالي يرفض إنشاء المجموعة للراكب بـ410 ويوجه إلى تجميع تلقائي، والانضمام الحالي خاص بمجموعات pool القديمة ولا يثبت وجود رابط مشاركة |
| اتفاق الراكب والكابتن على التفاصيل | مطلوبة | يتم بين المستخدمين؛ لا تنشئ المنصة اتفاقًا أو تأكيد رحلة نيابة عنهما |
| البلاغات عن الاحتيال أو إساءة الاستخدام ومراجعتها إداريًا | مطلوبة | مسار بلاغ محمي، مراجعة إدارية وتسجيل إجراء مسبب؛ لا توجد هذه العقود حاليًا |
| الاشتراكات الشهرية | مؤجلة من هذا الـMVP | تتعارض مع تعريف السوق المفتوح لهذا الإصدار؛ لا نفعّل الشاشات/العمليات التجارية قبل قرار منتج جديد |
| سجل معلوماتي اختياري للمدفوعات | مؤجل/قرار مطلوب | إن بقي، يجب وسمه معلوماتيًا، لا إثبات دفع ولا تحصيلًا |
| الدفع، المحفظة، الاحتفاظ بالأموال، الاسترداد أو التعويض | مستبعدة من هذا الـMVP | لا نبنيها ولا نستخدم جداولها/واجهاتها لتأكيد عمليات مالية |
| تأكيد استلام الكابتن، كود الدفع وإيصال الدفع | مستبعدة من تدفق السوق المفتوح الحالي | إيقاف استخدامها كتدفق MVP. لا نحذف جداولًا أو بيانات قائمة |
| قبول/رفض الكابتن لطلب آلي | غير مطلوب كخطوة مطابقة إلزامية | لا تعِد واجهة قبول/رفض تلقائي. تظل أفعال التواصل أو طلب الانضمام بحاجة إلى وصف منتجي واضح |
| التقييمات | تحتاج قرارًا صريحًا | لم يحدد الطلب الأحدث سياسة الأهلية، التوقيت، الردود أو الإشراف. لا تُعامل كبديل للبلاغ |
| إدارة الإدارة للعروض | تحتاج قرارًا/نطاقًا | صلاحية الإدارة لمراجعة البلاغات مطلوبة؛ الإيقاف الإداري للعروض وأسبابه ومدته لم تُحسم صراحة |
| حقول طلب الرحلة | تحتاج مراجعة PRD معتمد | الـAPI اليومي يحفظ فئة وإحداثيات فقط. لا أضفت تاريخًا/وقتًا/مقاعد لعدم توفر قرار حقول حاسم في المستندات الأحدث المقروءة |

### نقاط تحتاج تثبيتًا من صاحب المنتج قبل بناء عقود جديدة

1. قواعد انضمام المجموعة ومشاركة الرابط: عامة أم بدعوة، شروط الانضمام، المالك، الانسحاب، الإغلاق.
2. حقول طلب التواصل بعرض: ما الحد الأدنى للبيانات وحالات الطلب؟ وهل يرد الطرف الآخر برسالة/إجراء دون قبول تشغيلي؟
3. سياسة التقييمات، وهل تدخل ضمن MVP بعد البلاغات.
4. صلاحيات الإدارة لإخفاء عرض أو تقييد حساب عند البلاغ، ومستويات المراجعة والاستئناف.
5. أي استخدام لسجل المدفوعات المعلوماتي والبيانات التي يجوز إظهارها.
6. حقول الرحلة المطلوبة في البحث والطلب حسب نسخة PRD الأحدث غير الموجودة ضمن ملفات المستودع الحالية.

## 2. الإصلاحات الآمنة المنفذة

- استُعيد مصدر Edge Function المنشور `sekka-api` الإصدار 61 من مشروع Supabase الصحيح إلى [supabase/functions/sekka-api](supabase/functions/sekka-api/DEPLOYED_SOURCE.md). يتضمن المصدر والملفات المساعدة المنشورة. جرى فحص النصوص بحثًا عن أسرار مضمنة؛ الموجود هو أسماء متغيرات بيئة فقط. لم يُنشر هذا المصدر ولم يُستبدل به أي إصدار بعيد.
- أُضيف بيان يثبت مرجع المشروع ورقم الإصدار وبصمة المصدر، مع التنبيه إلى تطبيع نهايات الأسطر أثناء حفظ نسخة المصدر. البصمة البعيدة `417880be9e748047557dc83506767c10d69118ba10ee288c9c331e13eea7cf5d` هي بصمة نشر Supabase وليست بصمة Git أو ضمانًا بأن نسخة الملفات المحلية مطابقة بايتًا ببايت.
- حُذفت الشاشة القديمة غير المستخدمة `CaptainHomeScreen.tsx` وCSS الخاص بها بعد التحقق من عدم وجود أي import أو route يستدعيها. المسار الحقيقي يستخدم `CaptainJourneyScreen` عبر API.
- لم تُنفذ تغييرات وظيفية على API أو الواجهة في المناطق التي تحتاج قرار منتج، حتى لا تعيد تشغيل نموذج المطابقة/الاشتراك السابق.

## 3. Supabase وCloudflare

- المشروع المتاح الوحيد في تكامل Supabase هو `uorxfakceqnhxqnaawdy`، اسمه `seKKa` وحالته `ACTIVE_HEALTHY`.
- عنوان المشروع الموثق هو `https://uorxfakceqnhxqnaawdy.supabase.co`. وسيط Cloudflare Pages المتتبع يوجّه إلى `/functions/v1/sekka-api` على المرجع نفسه.
- Edge Function المنشورة نشطة، إصدار 61، و`verify_jwt=false`. الخدمة تستخدم مصادقة جلسات SeKKa مخصصة في المصدر وتستخرج مفتاح الخدمة من أسرار الخادم. لم يظهر مفتاح أو Secret ثابت مضمن في المصدر المستعاد. لا يوضع مفتاح service role في الواجهة.
- ملف `.env.example` يحتوي قيمًا فارغة/تعليقات نموذجية. إعدادات Cloudflare Pages الفعلية ليست متاحة عبر أدوات الجلسة؛ لذلك **لم يمكن التحقق من قيم build/runtime السرية للمعاينة**. لم أغيرها.
- لا يوجد مصدر API خادمي متتبع قبل هذا العمل؛ المصدر المستعاد يجعل النسخة قابلة للفحص محليًا. يلزم فحصه واختباره قبل أي نشر لاحق، ولا يعني استعادته تلقائيًا أنه صالح للنشر.
- المقارنة الممكنة: لا توجد نسخة خادمية سابقة في Git تقارن بها النسخة المنشورة؛ لذلك استُعيدت النسخة المنشورة نفسها إلى المسار أعلاه بدل ادعاء وجود diff تاريخي. فحص Deno نجح، لكن التطابق البايتّي مع حزمة النشر لا يمكن إثباته بعد تطبيع نهايات الأسطر.
- فحص عقد المجموعات كشف أن `POST /rider/pool/groups` يعيد 410 بنص صريح يمنع إنشاء الراكب للمجموعة، ويعرض `POST /rider/pool/groups/{id}/join` مجموعات انتظار من نموذج pool. لا يوجد عقد مشاركة رابط مجموعة للسوق المفتوح ضمن الخدمة الحالية.
- مخطط قاعدة البيانات الموصوف أدناه هو مخطط المشروع `uorxf...` الحي حسب استعلامات metadata فقط، دون قراءة سجلات مستخدمين.

### الترحيلات

- سجل المشروع الحي يعرض 45 Migration وآخرها `20261028224659 add_vehicle_classes`.
- Git يحتوي Migration واحدة متتبعة فقط، `20261030133000_remove_legacy_captain_line_pricing_rules.sql`، وهي غير موجودة في سجل المشروع الحي.
- عدم ظهور Migration في سجل Supabase لا يثبت عدم تنفيذ SQL يدويًا؛ حالة الترحيل المتتبعة محليًا غير محسومة حتى تقارن DDL الحي ومصدرها.
- يوجد ملفا Migration غير متتبعين محليًا من الحالة السابقة: `20261030020631_sekka_schema_reset.sql` و`20261030141000_sekka_schema_hardening.sql`. لم أغيرهما. تقرير إعادة الضبط يشير إلى مرجع آخر `tiygmkrzywvzqcbqmrvh` ومخطط UUID/جدول `profiles`، ولا يطابق `uorxf...` ذي معرفات `users.id` العددية. **يحظر تطبيقهما على المشروع الحالي دون مراجعة مستقلة**، وبالأخص Migration إعادة الضبط.
- لم أختلق ملفات تمثل تاريخًا قديمًا لا نملكه، ولم أضع snapshot SQL على هيئة Migration قابلة للتطبيق. توحيد التاريخ يتطلب استرجاع ملفات 45 Migration الأصلية أو اعتماد baseline موثق ومراجعته لاحقًا مع مالك المشروع؛ لا تُعد كتابة سجل قاعدة البيانات الحية لهذا الغرض.
- الاستعلامات والـmetadata أدناه توثق الحالة المرصودة في وقت المراجعة، وليست مصدرًا بديلًا لإعادة بناء قاعدة البيانات.

إصدارات Migration الظاهرة في سجل Supabase الحي (45):

`20261001183937 postgres_baseline_001_013`, `20261001184345 backend_security_indexes`, `20261001184517 auth_rate_limit`, `20261001195257 pool_deadline_processor`, `20261001200703 deadline_scheduled_trips`, `20261001202647 captain_otp_feature_flag`, `20261001203349 app_feature_flags_security`, `20261002075543 google_maps_search_budget_and_location_retention`, `20261002075655 fix_location_search_quota_counters`, `20261002080159 store_place_ids_for_trip_stops`, `20261002082524 preserve_place_ids_during_location_cleanup`, `20261003162018 rider_preferred_route`, `20261003185458 commuter_board_personalization`, `20261004074251 admin_control_panel`, `20261004075039 admin_control_panel_fk_indexes`, `20261004093423 verification_documents_and_captain_grace_period`, `20261004102221 firebase_social_identity`, `20261004110003 remove_firebase_auth_links`, `20261004115224 rider_captain_identity_verification`, `20261004220448 identity_reviewed_by_index`, `20261004221047 identity_review_pending_guard`, `20261005112344 telegram_password_reset_and_signup_consent`, `20261005212543 social_notifications_center`, `20261005231756 user_profile_avatars`, `20261006083351 direct_messages`, `20261009214057 captain_lines_and_grouped_demands`, `20261009214344 secure_captain_line_demand_matching`, `20261009214910 align_new_demand_with_matched_group`, `20261009225010 20261009222850_lifecycle_audit_log`, `20261010043804 20261010120000_foreign_key_performance_indexes`, `20261010095240 account_deletion_and_redaction`, `20261010095409 account_deletion_audit_indexes`, `20261010095641 allow_safe_super_admin_account_deletion`, `20261010102453 reload_deletion_rpc_schema_cache`, `20261010103043 qualify_pgcrypto_in_account_deletion`, `20261010104745 fix_captain_document_review_noop`, `20261010151834 add_round_trip_matching`, `20261010185858 captain_line_price_and_capacity_rules`, `20261024000255 release_security_privileges`, `20261024000308 policy_acceptance_audit`, `20261024000311 policy_acceptance_privileges`, `20261024192312 captain_line_captain_set_price`, `20261024194520 guard_captain_line_updates_until_rider_match`, `20261028224654 align_mvp_product_decisions`, `20261028224659 add_vehicle_classes`.

السجل يعيد version/name فقط؛ ملفات المصدر المطابقة لهذه الإصدارات غير موجودة ضمن Git الحالي، لذلك لا يمكن نسبة أي DDL مفصل لكل إصدار من أسماء السجل وحدها.

## 4. عقود API: الواجهة مقابل الخادم

قراءة metadata الأمنية للمخطط: جميع الجداول العامة الـ54 مفعّل عليها RLS؛ توجد 40 سياسة و14 جدولًا بلا سياسة. السياسات المسجلة إما `service_role` أو deny للـanon/authenticated. من 44 اسم دالة عامة، 9 `SECURITY DEFINER`؛ لا واحدة منها قابلة للتنفيذ بواسطة anon أو authenticated، وست منها قابلة لـservice_role. إعداد `search_path` لهذه التسع كان `pg_catalog` أو `pg_catalog, public`. هذا فحص صلاحيات metadata وليس مراجعة شاملة لمنطق كل دالة أو لكل grants على مستوى schema.

| المجال | عقود مؤكدة في الإصدار 61 | النتيجة |
|---|---|---|
| المصادقة | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, تغيير/استعادة كلمة المرور | متصلة بعقد مخصص؛ لا تستخدم Supabase Auth لتسجيل SeKKa الحالي |
| الرحلات اليومية | `GET /config`, `POST /rider/requests`, `GET /rider/requests`, `POST /rider/requests/{id}/match`, `POST /rider/requests/{id}/cancel` | إنشاء/قراءة/إلغاء موجود؛ match قراءة حالة فقط، لا يقرر ولا يدرج match |
| العروض والطلب | `POST /locations/search`, `POST /rider/lines/search`, `POST /rider/demand-requests`, `GET /rider/demand-requests`, `GET /rider/trips` | البحث موجود؛ إنشاء الطلب لا يرسل `captain_line_id` ولا يحجز العرض |
| الكابتن | `GET/POST /captain/lines`, `PUT /captain/lines/{id}`, `PATCH /captain/lines/{id}/status`, `GET /captain/demand-groups`, `GET/POST /captain/profile` | إدارة عروض أساسية متاحة؛ لا API مثبت لتقديم رد طلب مرتبط بعرض محدد |
| الرسائل والإشعارات | محادثات ورسائل/قراءة، وإشعارات قراءة/حذف/كتم | واجهات متصلة بعقود؛ تحتاج E2E بحسابي راكب وكابتن |
| السوق المفتوح المطلوب | طلب انضمام بعرض محدد، مجموعات وروابط مشاركة، بلاغات ومراجعتها إداريًا | عقود/تغطية ناقصة؛ لم أخترع مسارات API |
| الاشتراك والدفع | توجد جداول وعمليات دفع/تأكيد استلام ضمن نموذج أقدم | غير معتمدة كمسار السوق المفتوح في هذا الإصدار؛ لا تستخدم لتأكيد تحصيل |

## 5. اختبارات فعلية وخطة staging

### نتائج منفذة محليًا

- `npm test`: نجح 4/4. تغطي الاختبارات فلترة/ترتيب مرشحي عروض، اعتماد الكابتن، المقاعد، والتكرار؛ لا تختبر API أو حسابًا فعليًا.
- `npm run typecheck`: ناجح بعد التغييرات.
- `npm run build`: ناجح بعد التغييرات. التحذير القائم: الحزمة الرئيسية 579.31 KB أكبر من حد 500 KB.
- `deno check supabase/functions/sekka-api/index.ts`: **نجح** على مصدر الإصدار 61 المستعاد محليًا.
- لا توجد اختبارات E2E أو حسابات staging مقدمة. لا يوجد صف E2E VERIFIED.

### خطة الاختبار قبل MVP

| التدفق | الهوية والبيانات المطلوبة | التحقق |
|---|---|---|
| تسجيل راكب | هاتف staging منفصل + تحقق OTP | role=session، منع التكرار، موافقة الشروط، إعادة الدخول |
| تسجيل كابتن | هاتف staging منفصل | دور الكابتن، حالة التحقق، صلاحيات الموارد |
| الملف الشخصي | حسابا الاختبار | القراءة والتحديث فقط عبر عقد مصرح، لا تسريب بين الأدوار |
| عرض الكابتن | كابتن معتمد + route fixture | نشر، تعديل، إيقاف/استئناف، ملكية الخط وعدم ظهور المتوقف |
| بحث/تصفية/ترشيح | عروض staging مع فئات ومسافات مختلفة | ثبات النتائج، دقة الفئة/المقاعد، عدم ضمان الرحلة، وعدم تعيين كابتن |
| تفاصيل العرض/طلب الانضمام | عرض تجريبي وحساب راكب | ربط الطلب بالعرض الصحيح، حالات غير مؤكدة، لا حجز مقعد قبل العقد المعتمد |
| المجموعات/رابط المشاركة | منشئ ومشاركون staging | صلاحية الرابط، نطاق الوصول، الانضمام/المغادرة، عزل بيانات المجموعة |
| بلاغ ومراجعة إدارية | مستخدم يبلغ + مسؤول staging | إنشاء البلاغ، خصوصية الأطراف، إجراء مراجعة موثق وصلاحيات المسؤول |
| فصل الأدوار | rider/captain/admin | اختبار السماح والرفض لكل مورد وعملية وIDOR |
| الرسائل والإشعارات | راكب وكابتن مرتبطان باختبار | إرسال/قراءة/عداد غير مقروء وقيود الوصول |

لا تُنفذ الكتابات إلا في بيئة staging مؤكدة، ولا يُسجل التدفق E2E VERIFIED قبل تأكيد الاستجابة والبيانات المحفوظة من حسابات حقيقية.

## 6. حالة الملفات المحلية

بدأ العمل مع ثلاثة ملفات غير متتبعة، وتم الحفاظ عليها كما كانت:

- `SEKKA_DATABASE_RESET_REPORT.md`
- `supabase/migrations/20261030020631_sekka_schema_reset.sql`
- `supabase/migrations/20261030141000_sekka_schema_hardening.sql`

الملفان المحذوفان كانا متتبعين ونظيفين وغير مستوردين من أي مسار. لا يوجد Merge أو Deploy أو Commit في هذه المرحلة.

## 7. مشكلات وقرارات متبقية مرتبة

1. تثبيت قرارات مجموعات/روابط المشاركة وطلب الانضمام المرتبط بالعرض.
2. اعتماد سياسة البلاغات وإجراءات الإدارة، ثم بناء API محمي متوافق معها.
3. حسم سياسة التقييمات وحقول البحث/الطلب من PRD الأحدث.
4. استرجاع تاريخ Migrations الأصلي لـ45 إصدارًا أو اعتماد خطة baseline منفصلة؛ لا تطبق ملفات المرجع الآخر.
5. تحقق مالك البيئة من قيم Cloudflare Pages دون كشفها، وإثبات أن Preview يستخدم مرجع Supabase الصحيح.
6. تشغيل خطة staging بحسابات منفصلة؛ لم يجر اختبار business flow حي.
7. مراجعة وفصل أي واجهات وجداول دفع/اشتراك سابقة عن المنتج، مع عدم حذفها قبل خطة بيانات معتمدة.
8. تحسين حجم الحزمة لاحقًا؛ لا يمنع الفحص الوظيفي لكنه يرفع كلفة التحميل.

## ملحق A — جداول `public` كما ظهرت في Supabase

عدد الجداول: 54. كل الجداول التي أعادها الاستعلام مفعّل عليها RLS. عدم وجود سياسة على جدول يعني عدم وجود سماح عبر سياسة RLS، ولا يعني أن التطبيق يجب أن يقرأه مباشرة.

| الجدول | RLS | عدد السياسات |
|---|---:|---:|
| `account_deletion_events` | مفعّل | 0 |
| `admin_audit_logs` | مفعّل | 1 |
| `admin_ledger_adjustments` | مفعّل | 1 |
| `admin_system_settings` | مفعّل | 1 |
| `admin_trip_actions` | مفعّل | 1 |
| `admin_user_controls` | مفعّل | 1 |
| `api_rate_limits` | مفعّل | 1 |
| `app_config` | مفعّل | 0 |
| `app_feature_flags` | مفعّل | 1 |
| `audit_log` | مفعّل | 1 |
| `captain_lines` | مفعّل | 0 |
| `captain_profiles` | مفعّل | 1 |
| `commuter_board_campaigns` | مفعّل | 0 |
| `daily_commute_requests` | مفعّل | 1 |
| `demand_groups` | مفعّل | 0 |
| `demand_requests` | مفعّل | 0 |
| `direct_messages` | مفعّل | 0 |
| `google_maps_api_usage` | مفعّل | 0 |
| `matches` | مفعّل | 1 |
| `message_conversations` | مفعّل | 0 |
| `otp_challenges` | مفعّل | 1 |
| `payment_status_events` | مفعّل | 1 |
| `payments` | مفعّل | 1 |
| `policy_acceptances` | مفعّل | 1 |
| `pool_captain_capabilities` | مفعّل | 1 |
| `pool_captain_escrow_transfers` | مفعّل | 1 |
| `pool_captain_escrows` | مفعّل | 1 |
| `pool_captain_stats` | مفعّل | 1 |
| `pool_categories` | مفعّل | 1 |
| `pool_groups` | مفعّل | 1 |
| `pool_ledger` | مفعّل | 1 |
| `pool_members` | مفعّل | 1 |
| `pool_notification_mutes` | مفعّل | 0 |
| `pool_notifications` | مفعّل | 1 |
| `pool_subscriptions` | مفعّل | 1 |
| `pool_trip_cancellations` | مفعّل | 1 |
| `pool_trip_stops` | مفعّل | 1 |
| `pool_trips` | مفعّل | 1 |
| `pricing_config` | مفعّل | 1 |
| `push_subscriptions` | مفعّل | 1 |
| `rider_commuter_preferences` | مفعّل | 0 |
| `rider_preferred_routes` | مفعّل | 0 |
| `rider_saved_places` | مفعّل | 0 |
| `service_categories` | مفعّل | 1 |
| `sessions` | مفعّل | 1 |
| `super_admins` | مفعّل | 1 |
| `telegram_password_reset_challenges` | مفعّل | 1 |
| `telegram_phone_verification_challenges` | مفعّل | 1 |
| `trip_stops` | مفعّل | 1 |
| `trips` | مفعّل | 1 |
| `user_location_searches` | مفعّل | 0 |
| `user_verifications` | مفعّل | 1 |
| `users` | مفعّل | 1 |
| `vehicle_types` | مفعّل | 1 |

## ملحق B — أسماء الدوال العامة

عدد أسماء الدوال: 44. تضم القائمة وظائف RPC ووظائف triggers/helper؛ وجود الدالة لا يعني أن الواجهة تستدعيها أو أن قواعدها معتمدة للـMVP.

- `admin_add_ledger_adjustment`
- `admin_audit_append_only`
- `admin_review_user_verification`
- `admin_set_commission_rate`
- `admin_set_user_status`
- `admin_write_audit`
- `confirm_trip_payment`
- `create_demand_request`
- `direct_message_contact_ids`
- `enforce_captain_line_pricing`
- `mark_direct_messages_read`
- `publish_captain_line` — 3 overloads
- `sekka_append_only`
- `sekka_audit_log_append_only`
- `sekka_begin_location_search`
- `sekka_captain_verification_noop`
- `sekka_capture_lifecycle_audit`
- `sekka_claim_location_resolution`
- `sekka_cluster_demand_request`
- `sekka_delete_account_v1`
- `sekka_geo_km`
- `sekka_is_super_admin`
- `sekka_match_after_demand_insert`
- `sekka_match_after_line_publish`
- `sekka_match_creates_trip`
- `sekka_match_demand_group`
- `sekka_match_guard`
- `sekka_payment_guard`
- `sekka_process_pool_deadlines`
- `sekka_purge_expired_location_data`
- `sekka_register_with_policy_acceptance_v1`
- `sekka_require_role`
- `sekka_require_super_admin`
- `sekka_reserve_google_maps_request`
- `sekka_suspend_captains_with_expired_document_grace`
- `sekka_sync_captain_verification_after_phone`
- `sekka_take_rate_limit`
- `sekka_track_route_geometry_age`
- `sekka_trip_complete_guard`
- `sekka_trip_stop_order`
- `sekka_validate_vehicle_capacity`
- `send_direct_message`
- `set_captain_line_status`
- `update_captain_line`

## ملحق C — سياسات RLS

عدد السياسات المسجلة: 40. هذه قائمة الاسم والجدول والدور/الأمر؛ predicates الكاملة محفوظة لدى قاعدة البيانات ويجب تدقيقها عند تصميم الوصول النهائي.

| الجدول | السياسة | الأدوار | الأمر |
|---|---|---|---|
| `admin_audit_logs` | `admin_audit_logs_deny_client_access` | {anon,authenticated} | ALL |
| `admin_ledger_adjustments` | `admin_ledger_adjustments_deny_client_access` | {anon,authenticated} | ALL |
| `admin_system_settings` | `admin_system_settings_deny_client_access` | {anon,authenticated} | ALL |
| `admin_trip_actions` | `admin_trip_actions_deny_client_access` | {anon,authenticated} | ALL |
| `admin_user_controls` | `admin_user_controls_deny_client_access` | {anon,authenticated} | ALL |
| `api_rate_limits` | `sekka_backend_only` | {service_role} | ALL |
| `app_feature_flags` | `app_feature_flags_service_role_all` | {service_role} | ALL |
| `audit_log` | `audit_log_deny_client_access` | {anon,authenticated} | ALL |
| `captain_profiles` | `sekka_backend_only` | {service_role} | ALL |
| `daily_commute_requests` | `sekka_backend_only` | {service_role} | ALL |
| `matches` | `sekka_backend_only` | {service_role} | ALL |
| `otp_challenges` | `sekka_backend_only` | {service_role} | ALL |
| `payment_status_events` | `sekka_backend_only` | {service_role} | ALL |
| `payments` | `sekka_backend_only` | {service_role} | ALL |
| `policy_acceptances` | `policy_acceptances_deny_client_access` | {anon,authenticated} | ALL |
| `pool_captain_capabilities` | `sekka_backend_only` | {service_role} | ALL |
| `pool_captain_escrow_transfers` | `sekka_backend_only` | {service_role} | ALL |
| `pool_captain_escrows` | `sekka_backend_only` | {service_role} | ALL |
| `pool_captain_stats` | `sekka_backend_only` | {service_role} | ALL |
| `pool_categories` | `sekka_backend_only` | {service_role} | ALL |
| `pool_groups` | `sekka_backend_only` | {service_role} | ALL |
| `pool_ledger` | `sekka_backend_only` | {service_role} | ALL |
| `pool_members` | `sekka_backend_only` | {service_role} | ALL |
| `pool_notifications` | `sekka_backend_only` | {service_role} | ALL |
| `pool_subscriptions` | `sekka_backend_only` | {service_role} | ALL |
| `pool_trip_cancellations` | `sekka_backend_only` | {service_role} | ALL |
| `pool_trip_stops` | `sekka_backend_only` | {service_role} | ALL |
| `pool_trips` | `sekka_backend_only` | {service_role} | ALL |
| `pricing_config` | `sekka_backend_only` | {service_role} | ALL |
| `push_subscriptions` | `sekka_backend_only` | {service_role} | ALL |
| `service_categories` | `sekka_backend_only` | {service_role} | ALL |
| `sessions` | `sekka_backend_only` | {service_role} | ALL |
| `super_admins` | `super_admins_deny_client_access` | {anon,authenticated} | ALL |
| `telegram_password_reset_challenges` | `telegram_password_reset_deny_client_access` | {anon,authenticated} | ALL |
| `telegram_phone_verification_challenges` | `telegram_phone_challenges_deny_client_access` | {anon,authenticated} | ALL |
| `trip_stops` | `sekka_backend_only` | {service_role} | ALL |
| `trips` | `sekka_backend_only` | {service_role} | ALL |
| `user_verifications` | `user_verifications_deny_client_access` | {anon,authenticated} | ALL |
| `users` | `sekka_backend_only` | {service_role} | ALL |
| `vehicle_types` | `sekka_backend_only` | {service_role} | ALL |

## ملحق D — Triggers

العدد 55 صفًا من `information_schema.triggers` (كل event لكل صف؛ قد يظهر Trigger واحد أكثر من مرة لعدة أحداث).

| الجدول | Trigger | التوقيت/الحدث | الإجراء |
|---|---|---|---|
| `admin_audit_logs` | `admin_audit_no_change` | BEFORE DELETE | EXECUTE FUNCTION admin_audit_append_only() |
| `admin_audit_logs` | `admin_audit_no_change` | BEFORE UPDATE | EXECUTE FUNCTION admin_audit_append_only() |
| `admin_ledger_adjustments` | `admin_ledger_adjustments_no_change` | BEFORE DELETE | EXECUTE FUNCTION admin_audit_append_only() |
| `admin_ledger_adjustments` | `admin_ledger_adjustments_no_change` | BEFORE UPDATE | EXECUTE FUNCTION admin_audit_append_only() |
| `admin_trip_actions` | `admin_trip_actions_no_change` | BEFORE DELETE | EXECUTE FUNCTION admin_audit_append_only() |
| `admin_trip_actions` | `admin_trip_actions_no_change` | BEFORE UPDATE | EXECUTE FUNCTION admin_audit_append_only() |
| `audit_log` | `audit_log_no_change` | BEFORE DELETE | EXECUTE FUNCTION sekka_audit_log_append_only() |
| `audit_log` | `audit_log_no_change` | BEFORE UPDATE | EXECUTE FUNCTION sekka_audit_log_append_only() |
| `captain_lines` | `audit_captain_lines_lifecycle` | AFTER INSERT | EXECUTE FUNCTION sekka_capture_lifecycle_audit() |
| `captain_lines` | `audit_captain_lines_lifecycle` | AFTER UPDATE | EXECUTE FUNCTION sekka_capture_lifecycle_audit() |
| `captain_lines` | `trg_captain_line_match` | AFTER INSERT | EXECUTE FUNCTION sekka_match_after_line_publish() |
| `captain_lines` | `trg_captain_line_match` | AFTER UPDATE | EXECUTE FUNCTION sekka_match_after_line_publish() |
| `captain_lines` | `trg_captain_line_pricing` | BEFORE INSERT | EXECUTE FUNCTION enforce_captain_line_pricing() |
| `captain_lines` | `trg_captain_line_pricing` | BEFORE UPDATE | EXECUTE FUNCTION enforce_captain_line_pricing() |
| `captain_profiles` | `trg_captain_profiles_role` | BEFORE INSERT | EXECUTE FUNCTION sekka_require_role('user_id', 'captain') |
| `captain_profiles` | `trg_captain_profiles_role` | BEFORE UPDATE | EXECUTE FUNCTION sekka_require_role('user_id', 'captain') |
| `captain_profiles` | `trg_captain_verification_noop` | BEFORE UPDATE | EXECUTE FUNCTION sekka_captain_verification_noop() |
| `daily_commute_requests` | `trg_daily_requests_role` | BEFORE INSERT | EXECUTE FUNCTION sekka_require_role('rider_user_id', 'rider') |
| `daily_commute_requests` | `trg_daily_requests_role` | BEFORE UPDATE | EXECUTE FUNCTION sekka_require_role('rider_user_id', 'rider') |
| `demand_groups` | `audit_demand_groups_lifecycle` | AFTER INSERT | EXECUTE FUNCTION sekka_capture_lifecycle_audit() |
| `demand_groups` | `audit_demand_groups_lifecycle` | AFTER UPDATE | EXECUTE FUNCTION sekka_capture_lifecycle_audit() |
| `demand_requests` | `audit_demand_requests_lifecycle` | AFTER INSERT | EXECUTE FUNCTION sekka_capture_lifecycle_audit() |
| `demand_requests` | `audit_demand_requests_lifecycle` | AFTER UPDATE | EXECUTE FUNCTION sekka_capture_lifecycle_audit() |
| `demand_requests` | `trg_demand_requests_cluster` | BEFORE INSERT | EXECUTE FUNCTION sekka_cluster_demand_request() |
| `demand_requests` | `trg_demand_requests_match` | AFTER INSERT | EXECUTE FUNCTION sekka_match_after_demand_insert() |
| `demand_requests` | `trg_demand_requests_rider_role` | BEFORE INSERT | EXECUTE FUNCTION sekka_require_role('rider_user_id', 'rider') |
| `demand_requests` | `trg_demand_requests_rider_role` | BEFORE UPDATE | EXECUTE FUNCTION sekka_require_role('rider_user_id', 'rider') |
| `matches` | `trg_match_guard` | BEFORE INSERT | EXECUTE FUNCTION sekka_match_guard() |
| `matches` | `trg_matches_captain_role` | BEFORE INSERT | EXECUTE FUNCTION sekka_require_role('captain_user_id', 'captain') |
| `matches` | `trg_matches_captain_role` | BEFORE UPDATE | EXECUTE FUNCTION sekka_require_role('captain_user_id', 'captain') |
| `matches` | `trg_matches_create_trip` | AFTER INSERT | EXECUTE FUNCTION sekka_match_creates_trip() |
| `payment_status_events` | `trg_payment_event_guard` | BEFORE INSERT | EXECUTE FUNCTION sekka_payment_guard() |
| `payment_status_events` | `trg_payment_events_no_update` | BEFORE DELETE | EXECUTE FUNCTION sekka_append_only() |
| `payment_status_events` | `trg_payment_events_no_update` | BEFORE UPDATE | EXECUTE FUNCTION sekka_append_only() |
| `payments` | `trg_payment_trip_guard` | BEFORE INSERT | EXECUTE FUNCTION sekka_payment_guard() |
| `payments` | `trg_payments_no_update` | BEFORE DELETE | EXECUTE FUNCTION sekka_append_only() |
| `payments` | `trg_payments_no_update` | BEFORE UPDATE | EXECUTE FUNCTION sekka_append_only() |
| `pool_captain_escrow_transfers` | `trg_escrow_transfers_no_update` | BEFORE DELETE | EXECUTE FUNCTION sekka_append_only() |
| `pool_captain_escrow_transfers` | `trg_escrow_transfers_no_update` | BEFORE UPDATE | EXECUTE FUNCTION sekka_append_only() |
| `pool_groups` | `pool_groups_track_route_geometry_age` | BEFORE INSERT | EXECUTE FUNCTION sekka_track_route_geometry_age() |
| `pool_groups` | `pool_groups_track_route_geometry_age` | BEFORE UPDATE | EXECUTE FUNCTION sekka_track_route_geometry_age() |
| `pool_groups` | `trg_pool_group_creator_role` | BEFORE INSERT | EXECUTE FUNCTION sekka_require_role('created_by_user_id', 'rider,captain') |
| `pool_groups` | `trg_pool_group_creator_role` | BEFORE UPDATE | EXECUTE FUNCTION sekka_require_role('created_by_user_id', 'rider,captain') |
| `pool_ledger` | `trg_pool_ledger_no_update` | BEFORE DELETE | EXECUTE FUNCTION sekka_append_only() |
| `pool_ledger` | `trg_pool_ledger_no_update` | BEFORE UPDATE | EXECUTE FUNCTION sekka_append_only() |
| `pool_members` | `trg_pool_member_rider_role` | BEFORE INSERT | EXECUTE FUNCTION sekka_require_role('rider_user_id', 'rider') |
| `pool_members` | `trg_pool_member_rider_role` | BEFORE UPDATE | EXECUTE FUNCTION sekka_require_role('rider_user_id', 'rider') |
| `pool_trips` | `trg_pool_trip_captain_role` | BEFORE INSERT | EXECUTE FUNCTION sekka_require_role('captain_user_id', 'captain') |
| `pool_trips` | `trg_pool_trip_captain_role` | BEFORE UPDATE | EXECUTE FUNCTION sekka_require_role('captain_user_id', 'captain') |
| `service_categories` | `trg_service_category_capacity` | BEFORE INSERT | EXECUTE FUNCTION sekka_validate_vehicle_capacity() |
| `service_categories` | `trg_service_category_capacity` | BEFORE UPDATE | EXECUTE FUNCTION sekka_validate_vehicle_capacity() |
| `trip_stops` | `trg_trip_stop_order` | BEFORE UPDATE | EXECUTE FUNCTION sekka_trip_stop_order() |
| `trips` | `trg_trip_complete_guard` | BEFORE UPDATE | EXECUTE FUNCTION sekka_trip_complete_guard() |
| `users` | `users_sync_captain_verification_after_phone` | AFTER UPDATE | EXECUTE FUNCTION sekka_sync_captain_verification_after_phone() |
| `vehicle_types` | `trg_vehicle_capacity_update` | BEFORE UPDATE | EXECUTE FUNCTION sekka_validate_vehicle_capacity() |

الـTrigger المهم في مسار الطلب اليومي هو `trg_matches_create_trip` بعد إدراج `matches`. لا توجد في الإصدار 61 عملية API تقرر المطابقة وتدرج هذا السجل؛ لذا وجود الـTrigger ليس اكتمالًا لتدفق المطابقة.

