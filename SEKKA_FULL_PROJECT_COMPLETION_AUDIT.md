# مراجعة SeKKa التقنية والوظيفية الشاملة

**تاريخ الفحص:** 30 أكتوبر 2026 (Africa/Cairo)
**الفرع:** `codex/sekka-ui-rebuild`
**HEAD عند الفحص:** `91505c0` — `Harden rider offer candidate display`
**النطاق:** قراءة وتحليل فقط. لم تُعدّل شيفرة التطبيق أو قاعدة البيانات أو إعدادات النشر، ولم يُنشأ commit أو deployment. أُنشئ هذا التقرير وحده.

> هذا التقرير يميز بين ملفات Git المتتبعة وبين ملفات العمل المحلية غير المتتبعة. وجود ملف في مجلد العمل لا يعني أنه جزء من الفرع أو نُشر أو طُبق على Supabase.

## 1. الملخص التنفيذي

المشروع الحالي واجهة ويب React وTypeScript منشورة كـPWA على Cloudflare Pages، وتتصل بخدمة Supabase Edge Function اسمها `sekka-api` عبر proxy. توجد واجهات كثيرة وتكاملات فعلية مع عقود API، لكن لا يوجد في المستودع كود مصدر محلي للـEdge Function المنشورة، ولا توجد بيئة staging وحسابات اختبار موثقة لإثبات مسارات العمل الحقيقية. لذلك لا يصح وصف التطبيق بأنه مكتمل أو جاهز للإنتاج لمجرد وجود الشاشات أو نجاح build.

أهم فجوات رحلة المنتج: لا يوجد endpoint يربط الراكب بعرض كابتن محدد أو يحجز مقعدًا؛ ومسار `POST /rider/requests/{id}/match` يقرأ حالة طلب يومي ولا ينفذ المطابقة. كما أن رحلة الاشتراك والدفع الظاهرة ليست متصلة بعقود الطلب/الإثبات/الكود/التفعيل المطلوبة. الشكاوى والتقييمات وتحرير الملف الشخصي غير مكتملة. لوحة الإدارة تعرض مسارات وعناصر كثيرة، لكن قدرًا منها شاشة عامة أو لا يقابله عقد API. نتائج E2E غير متاحة.

يوجد عيب تكامل مؤكد بالقراءة: `CaptainHomeScreen.tsx` يستعلم مباشرة من Supabase Auth وجدول `profiles` ويستخدم عمود `captain_id`، بينما الشاشة المستخدمة فعليًا هي `CaptainJourneyScreen`، والمخطط الحي الذي فُحص يعرّف مستخدمًا في `users` بأرقام صحيحة وخطوطًا في `captain_lines` بعمود `captain_user_id`. المكون القديم لا يظهر أنه موصول من `App.tsx`، لكنه يبقى مصدرًا قديمًا يمكن أن يفشل إذا أعيد استخدامه. وبالمقابل، الشاشة الرئيسية الحالية تُحمّل بياناتها عبر API.

لا يمكن حساب نسبة اكتمال واقعية من الأدلة المتاحة. لم أضع نسبة تقديرية. في قائمة التقييم المعيارية المكونة من 45 وحدة وظيفية (مفصلة في قسم الوظائف)، لم تُصنّف أي وحدة `COMPLETE` أو `E2E VERIFIED` لعدم تنفيذ رحلة فعلية بحسابات staging. التصنيف هنا حصري لكل وحدة، وتفاصيل «غير المختبرة» تذكر في حقول الاختبار حتى عندما تكون الوظيفة جزئية.

## 2. الحالة العامة للمشروع

| المجال | الحالة المدعومة بالأدلة | الدليل / الحد |
|---|---|---|
| الواجهة | موجودة؛ React 19 + TypeScript + Vite، اتجاه RTL على الشاشات العربية | `web/src/App.tsx` و`web/src/screens/*`؛ كثير من الصفحات مجمعة في مكونات بحسب الدور |
| Backend الفعلي | Supabase Edge Function `sekka-api` منشورة ونشطة، النسخة 61، `verify_jwt=false` | عاينت مصدر النسخة المنشورة من أداة Supabase للقراءة فقط. المصادقة والتحقق مخصصان داخل الدالة؛ إعداد `verify_jwt=false` وحده لا يثبت انعدام الحماية ولا يثبت سلامتها |
| Backend في Git | proxy Cloudflare Pages Function فقط؛ مصدر Edge Function غير موجود ضمن الملفات المتتبعة | `web/functions/__sekka-api/[[path]].ts` يمرر الطلبات إلى Supabase؛ لا `supabase/functions/sekka-api` متتبعة |
| قاعدة البيانات الفعلية | مخطط Postgres باسم `public` يحوي جداول SeKKa قديمة/حالية وRLS مفعّل | فحص metadata وDDL catalog فقط؛ لم تُقرأ صفوف مستخدمين أو تُكتب بيانات |
| البيئة والاختبار | لا staging ولا حسابات اختبار/بيانات fixtures موثقة | مصفوفة الوظائف الحالية تسجل عدم وجودها؛ لم تُجر عمليات كتابة على الإنتاج |
| النشر | Cloudflare Pages، معاينات سابقة موجودة في المستندات؛ لا فحص نشر جديد ضمن هذه المراجعة | Preview يثبت تقديم build فقط ولا يثبت المسارات الوظيفية أو الجاهزية الإنتاجية |
| الاختبارات | 4 اختبارات Unit لفلترة مرشحي البحث في `rider-matching.test.mjs` | `npm test` و`typecheck` و`build` سبق تشغيلها على HEAD الحالي ضمن الجولة السابقة؛ لم تُعَد أثناء هذا التدقيق لتجنب آثار ملفات build المحلية. لا API integration ولا E2E |

### بنية المستودع وملفات التشغيل

- لا يوجد `package.json` في الجذر. المشروع الأمامي داخل `web/`، بأوامر `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck`, `test`. لا يوجد script باسم `lint`.
- الاعتمادات الأساسية في `web/package.json`: React/React DOM، TypeScript، Vite، و`@supabase/supabase-js`. يوجد `package-lock.json`.
- التوجيه مكتوب يدويًا في `web/src/App.tsx`، ويستخدم `window.location` بدل React Router.
- توجد تصاميم ومواد منتج في `docs/product-spec/`، ونظام تصميم في `DESIGN_SYSTEM.md` و`web/src/design-system/` و`web/src/styles/sekka-theme.css`.
- لا يوجد ملف `wrangler.toml/jsonc` أو workflow GitHub Actions متتبع ظاهر. إعداد Cloudflare Pages يبدو خارجيًا عن المستودع؛ لم تُراجع لوحة إعدادات Cloudflare أو الأسرار.
- `.env.example` يوثق متغيرات عامة للواجهة وأسرارًا خادمية كتعليقات فقط. لم أقرأ `.env.local` أو أي قيمة سرية.
- في شجرة العمل ملفات غير متتبعة تشمل `server/` و`node_modules/` و`supabase/.temp/` وملفي migration مؤرخين 2026-10-30. `server/` يحتوي `dist/*.js` و`node_modules` بلا مصادر TypeScript أو package manifest متتبعة. لا يوجد دليل أنه خدمة تشغيلية أو جزء من deployment الحالي؛ لا ينبغي اعتماد API الذي يصفه كعقد حي.
- يوجد تعديل محلي غير متتبع لملف `web/src/lib/admin-api.ts` وتعديلات محلية لتقارير/تعقب. لم ألمسها. اختلافها عن HEAD قد يؤثر على إعادة إنتاج نتيجة محلية.

## 3. نسبة الاكتمال الفعلية

**غير قابلة للحساب بمصداقية.** لا توجد مصفوفة متطلبات مكتملة تربط كل requirement باختبار فعلي، كما أن نسخة Backend المنشورة ليست مصدرًا متتبعًا داخل Git، ولا توجد بيئة staging لإثبات التدفقات. عدد الصفحات أو نجاح build لا يصلح مقامًا لحساب نسبة إنجاز وظيفي. الأرقام الواردة في قسم الوظائف هي عدّ عناصر تدقيق محددة فقط، وليست نسبة اكتمال التطبيق.

## 4. جرد الشاشات

خريطة `SeKKa_Master_Screen_Map_MVP_v1_AR.md` تعدّ 7 عناصر عامة و24 للراكب و24 للكابتن و23 للإدارة و8 مشتركة = **86 عنصرًا وظيفيًا/حالة**. تقول الخريطة صراحة إن بعض العناصر حالات داخل شاشة وليست صفحات مستقلة. التنفيذ يوفر 18 مفتاح رحلة للراكب، 24 للكابتن، 29 للإدارة، و8 مشتركة، بالإضافة إلى الصفحات العامة. لا يعني اختلاف العدد أن كل عنصر منفذ: مفتاح route قد يعرض قالبًا عامًا أو بيانات فارغة.

| الشاشة حسب الخريطة | المستخدم | المسار الفعلي | موجودة/التصميم | Backend والبيانات والأزرار | حالات/RTL | النقص والسبب |
|---|---|---|---|---|---|---|
| Splash | زائر | لا مسار مستقل ظاهر | لا كصفحة مستقلة | لا API | لا ينطبق | لا تُعرض كحالة route مستقلة في `App.tsx` |
| الصفحة العامة | زائر | `/` | نعم؛ `PublicHomeScreen` | واجهة عامة وروابط دخول/تسجيل؛ لا بيانات تشغيل | RTL؛ حالات توجيه جلسة | ليست شاشة ما بعد الدخول؛ توجيه الدور يفحص `auth/me` |
| تسجيل الدخول | زائر | `/login` | نعم | `/auth/login` ثم تحويل حسب الدور؛ E2E غير مختبر | RTL، أخطاء نموذج | قرار التحقق/الجلسة OPEN-011 |
| تسجيل دخول الإدارة | إدارة | `/admin/login` | نعم | `/auth/login` عبر `adminApi`، فحص الدور بالواجهة أيضًا؛ لم يختبر بحساب | RTL | تحقق الصلاحية النهائي مسؤولية Backend؛ لا E2E |
| إنشاء حساب | زائر (راكب/كابتن) | `/register` | نعم | `POST /auth/register`; لم يختبر التسجيل الفعلي | RTL وأخطاء | ربط تحقق رقم الهاتف واعتماد الكابتن يتطلب حسابات/مزود staging |
| استعادة الحساب | زائر | `/forgot-password` | نعم | Telegram reset endpoints، ليس استعادة بريد مجانية | RTL | تكامل Telegram الخارجي وحساب اختبار غير متاح؛ `/reset-password` يعيد التوجيه |
| الشروط والأحكام | زائر | `/terms` | نعم | مستند ثابت | RTL | راجع توافق نص الدفع والإلغاء مع القرارات المفتوحة |
| سياسة الخصوصية | زائر | `/privacy` | نعم | مستند ثابت | RTL | يلزم تدقيق قانوني/محتوى وبيئة فعلية |
| الرئيسية | راكب | `/home` | نعم | `/auth/me` و`/rider/demand-requests`؛ بيانات API الحقيقية حسب العقد | Loading/Error/Empty؛ RTL | بيانات الرحلة الأخيرة هي Demand Requests ولا تمثل كل حالات طلبات اليومي |
| البحث عن رحلة | راكب | `/trips` | نعم | `POST /locations/search`, `/rider/lines/search` | Loading/Error/Empty؛ RTL | contract بحث العرض لا يحجز مقعدًا؛ خيارات الموعد/السعة تحتاج تطابق قرار/schema |
| إنشاء طلب تنقل يومي | راكب | `/requests/new` | نعم، ضمن `RiderTripsScreen` | `GET /config`, `POST /rider/requests` | حالات ظاهرة؛ RTL | الطلب يحفظ الفئة والإحداثيات فقط؛ لا تاريخ/وقت/عدد ركاب بالـAPI |
| نتائج المطابقة/النتائج | راكب | `/trips` | نعم، ضمن شاشة البحث | `/rider/lines/search` | بيانات بحث حقيقية إن نجح الاتصال؛ RTL | لا توجد مطابقة نهائية أو حجز؛ تصفية الكابتن غير المعتمد تتم على الواجهة في commit الأخير |
| تفاصيل العرض | راكب | modal داخل `/trips` | نعم، ليست route مستقلة | نفس نتيجة البحث | RTL | عرض بيانات الخط؛ لا API تفصيلي منفصل ولا انضمام محدد |
| طلب الانضمام والحجز | راكب | لا route مستقل؛ modal `/trips` | زر طلب عام موجود | `POST /rider/demand-requests` لا يتلقى اختيار `captain_line_id` | رسائل حالة؛ RTL | لا ينشئ حجزًا لعرض بعينه ولا يضمن مقعدًا؛ endpoint/atomic capacity missing |
| تفاصيل المجموعة | راكب | `/journey/group` | route ومكوّن مشترك | استعلام `/rider/pool/groups` حسب API الحالي | Loading/Error/Empty عامة؛ RTL | لا تختبر استجابات حساب rider؛ ليس كل group مرتبطًا بتدفق الاشتراك القديم |
| اشتراكاتي | راكب | `/journey/subscriptions` | route موجود | لا قراءة اشتراك مثبتة في الشاشة الحالية | Empty/رسالة عدم توفر؛ RTL | شاشة نموذجية أكثر منها وظيفة قائمة اشتراكات حقيقية |
| تفاصيل الاشتراك | راكب | `/journey/subscription` | route موجود | لا endpoint موثق/مستخدم لهذا المورد في الواجهة الحالية | RTL | backend لا يقدم lifecycle subscription المقابل للخريطة |
| إيصال سكة | راكب | `/journey/receipt` | route موجود | لا API إيصال الاشتراك | RTL | عرض توضيحي؛ الإيصال يجب ألا يثبت استلام المال (DEC-007) |
| وسيلة الدفع | راكب | `/journey/payment-method` | route موجود | اختيار يغيّر notice فقط ولا يرسل API | RTL | الدفع محجوب لعدم وجود payment-request API للاشتراك |
| رفع إثبات التحويل | راكب | `/journey/proof` | رفع ملف محلي شكلي | زر الإرسال يوضح عدم توفر API؛ لا رفع backend | RTL | لا storage/payment evidence contract في مسار الاشتراك الظاهر |
| انتظار تأكيد الكابتن | راكب | `/journey/captain-confirmation` | route موجود | لا سجل دفع/تحديث live | RTL | لا يوجد lifecycle اشتراك متصل |
| تأكيد كود الدفع | راكب | `/journey/payment-code` | route موجود | لا endpoint كود اشتراك | RTL | صلاحية/محاولات وإبطال الكود OPEN-003 |
| نتيجة الدفع والتفعيل | راكب | `/journey/payment-result` | route موجود | لا endpoint تفعيل اشتراك | RTL | لا يجوز إظهار نجاح غير مثبت؛ الشاشة تشير إلى عدم دعم API |
| التجديد الشهري | راكب | `/journey/renewal` | route موجود | لا mutation تجديد اشتراك | RTL | الدورة والتواريخ OPEN-007 |
| البحث عن بديل | راكب | `/journey/replacement-captain` | route موجود | لا طلب بديل مرتبط فعليًا | RTL | لا وعد ببديل أو استرداد؛ OPEN-009 |
| المحادثات | راكب | `/journey/conversations` | نعم | GET conversations؛ قائمة متصلة | Loading/Error/Empty؛ RTL | إرسال الرسائل غير متاح في واجهة rider رغم وجود endpoint في الخادم |
| تفاصيل المحادثة | راكب | `/journey/conversation?id=` | جزئي | جلب الرسائل عبر API؛ العرض يكتفي ببيانات حديثة، لا إرسال | RTL | عدم تطابق UX يترك المحادثة للقراءة فقط |
| الإشعارات | راكب | `/journey/notifications` | نعم | GET notifications وPOST read | حالات واضحة؛ RTL | لا push/web push E2E |
| التقييمات | راكب | `/journey/ratings` | route عام | لا endpoint تقييم | RTL | frontend screen دون CRUD أو سياسة تقييم |
| تقديم شكوى/بلاغ | راكب | `/journey/complaint` | نموذج ظاهر | الزر يعرض خطأ صريحًا ولا يحفظ | RTL | API إنشاء شكوى مفقود |
| متابعة شكوى | راكب | `/journey/complaint-status` | route عام | لا API تفاصيل شكوى | RTL | API قراءة الشكوى غير موصول |
| الملف الشخصي/إعدادات | راكب | `/journey/profile` | نعم | `/auth/me`, logout؛ لا تحرير بيانات | RTL | اللغة/إعدادات الإشعارات روابط شكلية أو غير مكتملة؛ لا edit profile API |
| الصفحة الرئيسية للكابتن | كابتن | `/captain/home` | نعم عبر `CaptainJourneyScreen` | GET `/captain/lines`, `/captain/demand-groups`, profile/verification حسب المفتاح | Loading/Error/Empty؛ RTL | الوظائف مرتبطة بالعقود لكن لا حساب اختبار؛ component `CaptainHomeScreen.tsx` القديم غير مربوط ويستخدم schema مختلفًا |
| حالة اعتماد الحساب | كابتن | `/captain/journey/approval` | نعم | GET `/verification` | حالات API؛ RTL | بيانات المراجعة لا تظهر بالكامل وفق matrix |
| الوثائق | كابتن | `/captain/journey/documents` | نعم | GET verification + POST multipart upload | Loading/Error/Empty؛ RTL | لم يختبر upload؛ سرية URL/Storage والملفات تتطلب تحقق staging |
| بيانات المركبة | كابتن | `/captain/journey/vehicle` | نعم | GET/POST `/captain/profile` | حالات؛ RTL | API إنشاء فقط، لا تحديث بيانات مركبة بعد الحفظ |
| عروض التنقل | كابتن | `/captain/journey/offers` | نعم | GET `/captain/lines`؛ PATCH status | حالات؛ RTL | إيقاف/استئناف؛ حذف العرض غير موجود |
| إنشاء عرض جديد | كابتن | `/captain/journey/new-offer` | نعم | POST `/captain/lines` | form validation/loading؛ RTL | لا اختبار إنشاء حقيقي؛ تحقق الاعتماد/schedule/seat policy |
| تعديل العرض | كابتن | `/captain/journey/edit-offer?id=` | نعم | PUT `/captain/lines/{id}` | حالات؛ RTL | ملكية وحالة الخط لم تُختبر؛ edit form يعتمد قراءة القائمة |
| طلبات الركاب | كابتن | `/captain/journey/rider-requests` | نعم | GET `/captain/demand-groups` | Empty/Error؛ RTL | يعرض طلبات مرتبطة بمجموعة matched فقط؛ لا daily commute requests |
| تفاصيل طلب الراكب | كابتن | `/captain/journey/rider-request` | قالب مشترك | نفس قائمة الطلبات | RTL | لا read-by-ID ولا قبول/رفض؛ مع النموذج المحدث لا تُخترع موافقة كابتن إجبارية |
| إدارة المجموعات | كابتن | `/captain/journey/groups` | نعم | GET `/captain/pool/groups`/demand groups وفق حالة الشاشة | حالات؛ RTL | lifecycle المنفذ جزئيًا؛ حالة المجموعة والعضوية لا تغطي كل PRD |
| تفاصيل المجموعة | كابتن | `/captain/journey/group` | قالب قائمة | بيانات المجموعة المجمعة | RTL | لا صفحة detail منفصلة/تحميل حسب id واضح |
| قائمة الركاب | كابتن | `/captain/journey/riders` | مجمعة ضمن group | members إذا أعادها API | RTL | لا اختبار صلاحيات/حجب معلومات شخصية |
| اشتراكات المجموعة | كابتن | `/captain/journey/subscriptions` | route موجود | بيانات subscription تتبع المجموعة، لا lifecycle كتابة | RTL | لا عمليات إنشاء/تجديد/إلغاء اشتراك مكتملة |
| طلبات الدفع | كابتن | `/captain/journey/payments` | نعم جزئيًا | GET `/captain/earnings` يعرض رحلات/مدفوعات، POST confirm payment | حالات؛ RTL | قد لا يساوي سجل طلب دفع اشتراك شهري؛ لا proof/code lifecycle |
| تفاصيل طلب الدفع | كابتن | `/captain/journey/payment` | نفس قائمة الدفع | لا endpoint detail اشتراك مستقل | RTL | العرض مبني على earnings response |
| تأكيد استلام المبلغ | كابتن | `/captain/journey/confirm-receipt` | نعم | POST `/captain/trips/{id}/confirm-payment` | loading/error | هذه رحلة/مبلغ خادم؛ لم تختبر؛ لا دليل أنها تنفذ اشتراك المنتج |
| إرسال كود الدفع | كابتن | `/captain/journey/send-code` | route موجود | لا endpoint اشتراك code | RTL | وظيفة غير متاحة |
| متابعة حالة الدفع | كابتن | `/captain/journey/payment-status` | بيانات محدودة | earnings/payment status | RTL | لا subscription payment state |
| التجديد الشهري | كابتن | `/captain/journey/renewal` | route عام | لا mutation تجديد | RTL | OPEN-007 |
| طلب البحث عن بديل | كابتن | `/captain/journey/replacement` | route عام | لا endpoint بديل | RTL | OPEN-009؛ الزر لا ينشئ طلبًا فعليًا |
| المحادثات | كابتن | `/captain/journey/conversations?id=` | نعم | GET/POST messages، POST read | حالات؛ RTL | لم يختبر مع مستخدمين اثنين |
| الإشعارات | كابتن | `/captain/journey/notifications` | نعم | GET + POST read | RTL | push لا E2E |
| التقييمات والبلاغات | كابتن | `/captain/journey/ratings-reports` | route عام وقائمة إن أعيدت | لا endpoint rating/complaint مثبت في الواجهة | RTL | ليس workflow متكاملًا |
| الملف الشخصي/الإعدادات | كابتن | `/captain/journey/profile` | نعم | `/auth/me`, logout | RTL | تعديل الملف والإعدادات غير متوفر |
| تسجيل دخول الإدارة | إدارة | `/admin/login` | نعم | `/auth/login`, admin session client | RTL | لا E2E ولا مراجعة إعدادات auth الحالية |
| لوحة المؤشرات | إدارة | `/admin` | نعم | `/admin/analytics/overview` أو summary | Loading/Error | data API؛ لم تختبر بحساب admin |
| إدارة المستخدمين | إدارة | `/admin/users` | نعم | GET users؛ تغيير الحالة endpoint | RTL | CRUD محدود؛ mutations لم تختبر |
| تفاصيل المستخدم | إدارة | `/admin/user?id=` | نعم | GET user details | RTL | لا مسار موثق لبعض actions/ownership |
| إدارة الكباتن | إدارة | `/admin/captains` | نعم | GET list + verification update | RTL | لم تختبر صلاحيات/حالة |
| مراجعة وثائق الكابتن | إدارة | `/admin/documents` | نعم جزئيًا | GET verifications/review; endpoint file | RTL | عرض الملف/حماية الرابط ومراجعة E2E غير متحققين |
| إدارة المركبات | إدارة | `/admin/vehicles` | نعم كقائمة | لا CRUD مركبة متكامل | RTL | API يرجع data types لا إدارة مركبة كاملة |
| إدارة العروض | إدارة | `/admin/offers` | route عام | لا endpoint مستقل ظاهر في القائمة الحية | RTL | قد يقع في generic admin body |
| طلبات الركاب | إدارة | `/admin/rider-requests` | route عام | `/admin/trips`, groups endpoints غير واضح من UI | RTL | لا CRUD/queue موثق كامل |
| إدارة المجموعات | إدارة | `/admin/groups` | route عام | لا endpoint groups admin مخصص ظاهر | RTL | بيانات ليست مضمونة من API screen |
| تفاصيل المجموعة | إدارة | `/admin/group` | route عام | لا detail route مثبت | RTL | generic row rendering |
| إدارة الاشتراكات | إدارة | `/admin/subscriptions` | route | لا lifecycle API | RTL | API اشتراك فعلي ناقص |
| مراقبة المدفوعات | إدارة | `/admin/payments` | نعم جزئيًا | `/admin/disputes`, payment details، finance endpoints | RTL | الإدارة للمدفوعات لا تعني التحكم بتحويلات خارجية |
| تفاصيل عملية الدفع | إدارة | `/admin/payment?id=` | جزئي | GET `/admin/payments/{id}` | RTL | route detail يقرأ endpoint؛ لم يختبر |
| النزاعات المالية | إدارة | `/admin/disputes` | نعم | resolve/adjust/void payments | RTL | إجراءات حساسة تحتاج اختبار صلاحيات وتدقيق |
| الشكاوى والبلاغات | إدارة | `/admin/complaints` | route عام | لا API شكوى مثبت | RTL | blocked by missing complaint contract |
| إدارة التقييمات | إدارة | `/admin/ratings` | route عام | لا API rating مثبت | RTL | لم تُنفذ الوظيفة |
| إدارة الإشعارات | إدارة | `/admin/notifications` | نعم/جزئي | broadcast endpoint في backend، UI screen generic وقد تعرض notifications | RTL | تطابق نوع البيانات والعقود يحتاج اختبار |
| العمولة المستقبلية | إدارة | `/admin/commission` | route | `/admin/settings/commission` | RTL | نسبة مستقبلية/جدول الإشعار OPEN-001/002؛ لا تحصيل إلكتروني |
| إعدادات التشغيل | إدارة | `/admin/settings` | نعم/جزئي | settings/pricing APIs | RTL | يجب فصل التسعير عن القرارات المفتوحة |
| التقارير والتحليلات | إدارة | `/admin/reports` | نعم | `/admin/analytics/overview`, finance summary | RTL | الدقة ونسق الأرقام غير E2E |
| سجل التدقيق | إدارة | `/admin/audit-log` | نعم | `/admin/audit` | RTL | append-only/تغطية كل mutation يحتاج تحقق |
| صلاحيات فريق الإدارة | إدارة | `/admin/admin-permissions` | route موجود | لا API staff permissions متحقق | RTL | BLOCKED/غير منفذ كصلاحيات منفصلة |
| عناصر إدارة إضافية | إدارة | `trip-operations`, `pool-overview`, `finance`, `pricing`, `campaigns`, `otp-settings`, `ledger` | 7 routes إضافية عن خريطة 23 (والـD-20 settings يغطي واحدًا)؛ 29 key في الكود | عقود مختلفة: trips, overview, finance, pricing, campaign, OTP, ledger | RTL | وجود هذه المسارات يزيد النطاق عن خريطة الشاشة؛ تُراجع صلاحية كل mutation وتوثيقها قبل وصفها كجزء معتمد |
| مركز الإشعارات المشترك | عام/الأدوار | `/shared/notifications` | route | الشاشة المشتركة تعرض رسالة تسجيل دخول بدل قائمة عامة | RTL | لا توجد بيانات بلا جلسة؛ معظم المستخدمين لديهم route خاص |
| حالة التحميل | مشترك | `/shared/loading` | نعم | لا API | RTL | شكل عرض حالة أساسية |
| حالة الخطأ | مشترك | `/shared/error` | نعم | لا API | RTL | لا يظهر دليل على معالجة كل خطأ على مستوى route |
| حالة عدم البيانات | مشترك | `/shared/empty` | نعم | لا API | RTL | موجودة كمكون/حالة |
| حالة عدم الاتصال | مشترك | `/shared/offline` | نعم | لا API | RTL | صفحة وصفية؛ لا دليل على offline cache أو PWA install behavior |
| تأكيد إجراء حساس | مشترك | `/shared/confirm` | صفحة عامة | لا ينفذ إجراء محدد | RTL | إجراءات admin تستخدم `confirm/prompt` للمتصفح، ليس تدفق تأكيد موحدًا |
| الوصول المرفوض | مشترك | `/shared/access-denied` | نعم | يعتمد على auth/guard | RTL | المسار المشترك نفسه غير واضح أنه محمي بخدمة session؛ يجب تأكيد سلوك فعلي |
| 404 | مشترك | fallback و`/shared/not-found` | نعم | لا API | RTL | route wildcard موجود؛ اختبار الروابط الآلية غير منفذ |

**ملحوظة التغطية:** للصفحات المندرجة تحت “قالب عام” أو “route موجود” لا يوجد دليل على أن جميع أزرار الخريطة أو حالات العمل مُمثلة. مواصفة الشاشة توضح أن فصل الحالة في route مستقل غير مطلوب دائمًا. صُمم الجدول لربط عناصر الخريطة بمسار فعلي أو بغيابه، وليس لإعلان اكتمال تصميم كل عنصر.

## 5. جرد الوظائف وتصنيفها

التقييم التالي قائمة تدقيق من **45 وحدة وظيفية**، مصنفة حصريًا حسب أفضل حالة مثبتة؛ الوظيفة التي تجمع UI مع API بلا اختبار حقيقي تصنف `UNVERIFIED`، والواجهة التي تعرض زرًا لكن لا API لها `FRONTEND ONLY`. `BLOCKED` يعني أن نقص قرار أو عقد أو بيئة يمنع إكمال الرحلة، ولا يعني أن كل ما حولها غائب.

### 5.1 وحدات جزئية — 13

| # | الوظيفة | المنفذ والدليل | الباقي/السبب |
|---|---|---|---|
| P01 | إنشاء طلب يومي | `POST /rider/requests` يحفظ فئة وإحداثيات | وقت/تاريخ/عدد ركاب ليست ضمن العقد |
| P02 | البحث عن خطوط | `POST /rider/lines/search` متصل | الأهلية والترتيب والسعة ليست متحققة كقواعد مكتملة؛ تفاصيل القرار مفتوحة |
| P03 | تفاصيل العرض | modal ببيانات البحث | لا endpoint تفصيلي ولا انتقال لحجز محدد |
| P04 | سجل الراكب | يجمع طلبات/رحلات عبر endpoints | لا تفاصيل request-by-id ولا توحيد كامل للstatus |
| P05 | الصفحة الرئيسية للراكب | API حقيقي لملف وطلب حديث | يعرض Demand Request لا كل أنواع سجل الرحلات |
| P06 | طلبات الكابتن | قائمة API لمجموعات matched | daily commute requests غير متاحة للكابتن |
| P07 | ملف المركبة | GET/POST | لا تحديث بعد الحفظ |
| P08 | تحرير العرض | PUT موجود | لا اختبار ملكية/status ولا delete |
| P09 | documents verification | upload/review endpoints | لا E2E ولا تحقق مخزن/خصوصية الملفات |
| P10 | المحادثات | history/read/send على الخادم | rider view لا يرسل؛ لا اختبار طرفين |
| P11 | الإشعارات | قائمة وmark-read | push delivery غير مثبتة |
| P12 | تغطية الإدارة | شاشة موحدة وAPI لبعض domains | العديد من paths عامة أو لا توجد عقود admin مقابلة |
| P13 | حالات التشغيل والصفحات المشتركة | routes/copy موجودة | offline/confirmation/403 behavior ليست جميعها مربوطة بتدفق فعلي |

### 5.2 واجهة أمامية فقط — 8

| # | الوظيفة | ما يظهر | غياب backend المثبت |
|---|---|---|---|
| F01 | اختيار وسيلة دفع اشتراك | أزرار الوسائل | لا إنشاء payment request |
| F02 | رفع إثبات اشتراك | input ملف | لا حفظ/رفع إثبات لهذا التدفق |
| F03 | عرض كود تأكيد الاشتراك | route وحالة | لا create/verify payment code |
| F04 | نتيجة/تفعيل اشتراك | شاشة نتيجة | لا عملية تفعيل متصلة |
| F05 | تقديم شكوى | form | submit صريح يعرض عدم توفر API ولا يحفظ |
| F06 | متابعة شكوى | route | لا API list/detail |
| F07 | التقييمات | screens rider/admin/captain | لا API كتابة/قراءة مستخدم مؤكد |
| F08 | طلب كابتن بديل | زر/واجهة | لا API طلب بديل |

### 5.3 Backend فقط — 1

| # | الوظيفة | دليل backend | الفجوة |
|---|---|---|---|
| B01 | Trigger إنشاء trip/stops عند insert match | `trg_matches_create_trip` والقيود/المؤشرات في DB | لا endpoint موثوق ينشئ match للدورة اليومية؛ trigger غير قابل للوصول من الواجهة بأمان |

### 5.4 غير منفذة — 6

| # | الوظيفة | الدليل |
|---|---|---|
| N01 | الانضمام لعرض بعينه وحجز السعة ذريًا | لا endpoint يقبل `captain_line_id` في رحلة الانضمام الحالية |
| N02 | قبول/رفض الكابتن لطلب يومي | لا API contract؛ لا ينبغي اختراعه، كما أن منطق المنتج ما زال يتطلب توضيح آلية الاختيار |
| N03 | تحرير ملف المستخدم/الراكب | لا update profile API مستخدم |
| N04 | تحرير ملف المركبة بعد الإنشاء | لا update profile API |
| N05 | إنشاء/قراءة ratings من طرف المستخدم | لا endpoint rating موثق في Edge function الحالية |
| N06 | إرسال/قراءة شكاوى المستخدم | لا endpoint complaint موثق؛ الموجود في الواجهة يصرح بعدم الحفظ |

### 5.5 متوقفة/محجوبة — 7

| # | الوظيفة | العائق المحدد |
|---|---|---|
| X01 | المطابقة اليومية | لا matcher write API؛ POST match الحالي owner-check ثم قراءة فقط |
| X02 | طلب الانضمام | لا عقد إنشاء join request ولا تحقق atomic من السعة |
| X03 | subscription/payment lifecycle | القرار التجاري موجود جزئيًا، لكن endpoints lifecycle/proof/code غير موجودة |
| X04 | دورة التجديد والإلغاء | OPEN-007/008 |
| X05 | بديل بعد انسحاب الكابتن | OPEN-009؛ لا endpoint بديل ولا سياسة مال |
| X06 | الإدارة والصلاحيات التفصيلية | لا endpoint لإدارة أعضاء/أدوار admin مستقل؛ المسار العام لا يكفي لإثبات صلاحيات granular |
| X07 | إثبات الجاهزية التشغيلية | لا بيئة staging وحسابات زوجية/حساب إدارة لإجراء E2E |

### 5.6 غير مختبرة فعليًا — 10

| # | الوظيفة | مصدر التنفيذ المتوقع | ما يلزم لاختبارها |
|---|---|---|---|
| U01 | التسجيل والتحقق | auth/register + phone verification | مستخدم staging ومزود تحقق مهيأ |
| U02 | تسجيل الدخول/الدور/الخروج | auth/login/me/logout | حساب rider/captain/admin حقيقي staging |
| U03 | reset كلمة المرور | telegram reset flow | هاتف وTelegram staging |
| U04 | بحث الأماكن والخطوط | location + rider search | خطوط نشطة وحساب rider staging |
| U05 | إنشاء الطلب وسجل الطلب/الإلغاء | rider requests | بيانات staging متطابقة |
| U06 | إنشاء/تعديل/إيقاف عرض | captain lines | حساب كابتن معتمد وعرض fixture |
| U07 | رفع ومراجعة مستند | verification endpoints | ملفات اختبار غير حساسة وحساب Admin |
| U08 | الرسائل والقراءة غير المقروءة | messages endpoints | rider + captain staging |
| U09 | تأكيد الدفع والنزاع | captain confirm, rider dispute, admin | رحلات ومدفوعات staging فقط |
| U10 | عمليات الإدارة والتقارير | admin endpoints | حساب admin staging؛ اختبار roles/audit |

### 5.7 مكتملة / معطلة / غير منفذة بأكثر من الجدول

- `COMPLETE`: **0**. لا يوجد ما يثبت completion end-to-end.
- `BROKEN`: **0 مؤكد على مسار UI الحالي**. توجد مكونات قديمة ذات عقد/schema متضارب (موضح أدناه)، لكن لم أثبت أنها route فعالة.
- الحصيلة: `PARTIALLY COMPLETE` 13 + `FRONTEND ONLY` 8 + `BACKEND ONLY` 1 + `NOT IMPLEMENTED` 6 + `BLOCKED` 7 + `UNVERIFIED` 10 = **45 وحدة**.

## 6. الوظائف المكتملة

لا توجد وظيفة يمكن اعتمادها على أنها مكتملة بالمعنى التشغيلي الشامل من أدلة هذا التدقيق. توجد وظائف متصلة على مستوى الكود والعقد — مثل تسجيل الدخول، إنشاء/تعديل عروض الكابتن، المحادثات، الإشعارات، تأكيد إيصال رحلة ونزاعها — لكنها بلا تحقق E2E بحسابات staging. لذلك تسجل `UNVERIFIED` بدل `COMPLETE`.

## 7. الوظائف المكتملة جزئيًا

العناصر P01–P13 في جدول القسم 5.1. أهمها إنشاء الطلب اليومي ببيانات محدودة، البحث عن خطوط دون join، بيانات الكابتن المجمعة، شاشة rider home، الإشعارات والرسائل التي لا تتطابق جميعها بين الطرفين، ولوحة admin التي تحتوي 29 مفتاحًا مقابل 23 عنصرًا موثقًا في خريطة الإدارة.

## 8. الوظائف غير المنفذة

العناصر N01–N06. لا يوجد دليل على API يسمح بالانضمام لخط بعينه، تحرير ملفات المستخدم/المركبة، أو rating/complaint من واجهة المستخدم. لا أستنتج من وجود جداول/سياسات محلية غير مطبقة أن هذه الوظائف نشطة في production.

## 9. الوظائف المتوقفة وأسبابها

العناصر X01–X07. الأسباب الجوهرية: API contract مفقود، قرارات مفتوحة في lifecycle/sizing/matching، أو غياب بيئة اختبار. لا يلزم تغيير قاعدة الإنتاج لإعداد خطة تنفيذ؛ إنشاء أي schema جديد أو تشغيل reset migration يحتاج مراجعة منفصلة قبل التنفيذ.

## 10. الأزرار والتفاعلات غير المكتملة

| المكان / العنصر | ما يحدث في الكود | API؟ | النتيجة/المشكلة |
|---|---|---|---|
| Rider trip details → “إرسال طلب بحث عام” | `createDemandRequest` يرسل vehicle/date/time/route/seat count | `POST /rider/demand-requests` | يسجل طلب demand عام، ولا يرتبط بالخط المختار؛ النص داخل modal يصرح بذلك |
| Rider “تحديث حالة الطلب” | `POST /rider/requests/{id}/match` | نعم | operation قراءة owner-scoped، لا تنشئ match ولا تغير حالة |
| Rider اختيار وسيلة دفع | `setNotice(unavailableWrite)` | لا | لا يبدأ payment request |
| Rider إرسال إثبات | `setNotice(unavailableWrite)` | لا | الملف يبقى محليًا ولا يتم رفعه |
| Rider إرسال شكوى | notice “لم يتم تسجيل البلاغ” | لا | واجهة صريحة غير فعالة وظيفيًا |
| Rider تقييم | route/list generic | لا كتابة مثبتة | وظيفة غير متصلة |
| Rider محادثة | fetch history، نص “الإرسال غير متاح” | GET فقط على هذه الشاشة | كابتن يستطيع الإرسال عبر نفس عائلة API؛ سلوك الطرفين غير متسق |
| Captain طلب بديل | `action(label)` يعرض notice أو فعل presentation | لا | لا يفتح طلب تشغيلي محفوظ |
| Captain تفاصيل طلب | زر accept/reject غير موجود | لا | سليم في عدم اختراع عقد، لكن ما زال تدفق القرار المفتوح |
| Captain payments “تأكيد استلام” | POST `/captain/trips/{id}/confirm-payment` | نعم | يمكنه تسجيل استلام رحلة؛ ليس دليلاً على lifecycle دفع اشتراك |
| Admin status/review/dispute | prompts/confirms ثم `mutate(path,method,body)` | نعم لبعضها | أخطاء API تظهر، لكن prompts متصفح خام ومخاطر validation؛ لم تختبر الصلاحيات/التدقيق |
| Admin bulk/system screens | links إلى generic `AdminBody` | جزئي/غير معروف لكل route | وجود شاشة لا يثبت وجود endpoint أو زر عامل |
| Login/register/forgot | نماذج حقيقية إلى auth endpoints | نعم | لم تختبر، ومصادقة المستخدم/الاسترداد مرتبطة بحسم OPEN-011 |

لا يمكن تعداد كل نقرة بصريًا أو فحص Console دون جلسات تشغيل وأدوار وبيانات مناسبة؛ الجدول أعلاه يسجل التفاعلات التي أمكن ربطها بملفات الواجهة والعقد. توجد حالات generic أو empty المقصود بها عدم الادعاء بالنجاح.

## 11. Backend وAPI

### 11.1 شكل التكامل

1. `sekkaApi()` في `web/src/lib/sekka-api.ts` يرسل إلى `/__sekka-api`، مع `apikey` العام ورمز جلسة bearer مخزنًا في `localStorage`.
2. `web/functions/__sekka-api/[[path]].ts` يعمل كـCloudflare Pages proxy إلى `/functions/v1/sekka-api`.
3. المصدر الخادمي المنشور موجود في Supabase فقط؛ نسخه المنشورة 61. `verify_jwt=false`، وتتعامل الدالة مع auth داخلية. لم أفحص secrets أو سجلات تحوي بيانات حساسة.
4. هذا يجعل عقد الخادم غير قابل لإعادة البناء من Git وحده. مصدر Edge Function المنشور يجب أن يُدار/يُراجع من مستودع أو artifact موثق مع ربط version/hash وإجراءات نشر.

### 11.2 عقود API الحية التي تم التحقق من وجودها في مصدر الدالة

هذه قائمة بالمسارات الفعلية المعرّفة، مجمعة حسب المجال. القوائم لا تعني أن كل استدعاء اختبر. المتغيرات `{id}` و`{kind}` تعبر عن route patterns كما ظهرت في المصدر.

| المجال | العقود/الأنماط الموجودة | الاستخدام والملاحظات |
|---|---|---|
| Health/config | `GET /`, `GET /health`, `GET /config`, `GET /pool/categories` | config وhealth لا يثبتان الأعمال؛ بيانات الفئات تدخل إنشاء الطلب اليومي |
| Auth/account | `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/password-reset/telegram`, `/auth/password-reset/complete`, `/auth/change-password`; `GET /auth/me`; `DELETE /account` | registration/login/reset wired؛ reset عبر Telegram وليس البريد؛ policy acceptances بالـpayload |
| Verification/profile | `GET /verification`, `POST /verification/phone/telegram`, `POST /verification/documents/{kind}`, `POST /profile/avatar`, `DELETE /profile/avatar`, `GET /captain/profile`, `POST /captain/profile` | upload/profile create موجودان؛ profile edit غير متوفر؛ وثائق حساسة تحتاج اختبار private access |
| Locations | `POST /locations/search`, `/search/precise`, `/reverse`, `/resolve` | يتضمن مزودي geocoding/routing وحدود/تحقق؛ لم أجر live test |
| Rider daily/lines | `POST /rider/requests`, `/rider/demand-requests`, `/rider/lines/search`; `GET /rider/lines/discover`, `/rider/trips`; `POST /rider/requests/{id}/match`, `/cancel`, `/rider/trips/{id}/dispute` | `/match` قراءة حالة فقط؛ demand request لا يقبل selected line booking; ما زال daily matching missing |
| Rider pool/group | `GET /rider/pool/groups`; `POST /rider/pool/discover`, `/quote`, `/groups`; `PUT /rider/pool/groups/{id}`; `POST /groups/{id}/join`, `/confirm`, `/price-decision`, `/complete-seats`, `/waiting-decision`, `/days/{date}/cancel`, `/cancel` | عقود pool حقيقية أوسع من واجهات rider payment/subscription المتصلة؛ لا تساوي تلقائيًا lifecycle التي تعرضها الشاشات |
| Saved places/preferences | `GET /rider/saved-places`, `PUT /rider/commuter-preferences`, `GET /rider/commuter-preferences`, `GET /rider/commuter-board-cards`, `POST|DELETE /rider/saved-places/{home|work}` | ليست كلها ظاهرة في الواجهة |
| Messaging/notifications | `GET /messages/contacts`, `/messages/conversations`; `POST /messages/conversations`; `GET|POST /messages/conversations/{id}/messages`; `POST /messages/conversations/{id}/read`; `GET /pool/notifications`; `POST /pool/notifications/{id}/read|delete|mute` | rider/captain client wiring غير متطابق بالكامل؛ push subscription endpoints موجودة لكن لا دليل تفعيل كامل |
| Captain | `GET|POST /captain/lines`; `PUT /captain/lines/{id}`; `PATCH /captain/lines/{id}/status`; `GET /captain/demand-groups`, `/captain/earnings`, `/captain/verify/status`, `/captain/pool/preferences`, `/captain/pool/offers`, `/captain/pool/trips`; `POST /captain/verify/request|confirm`, `/captain/location`, `/captain/pool/groups`; `PUT /captain/pool/capabilities`; `PATCH /captain/pool/search-radius`; pool trip action patterns; `POST /captain/trips/{id}/confirm-payment` | لا daily request candidate/action endpoint؛ لا update vehicle profile |
| Admin | `GET /admin/verifications`, `/admin/users`, `/admin/trips`, `/admin/disputes`, `/admin/settings`, `/admin/audit`, `/admin/captains`, `/admin/analytics/overview`, `/admin/pool/overview`, `/admin/finance/summary`, `/admin/ledger/adjustments`, `/admin/commuter-board-campaigns`, `/admin/settings/otp`; mutations: verification review, user status, trip actions, commission settings, ledger adjustment, campaigns, broadcast notifications, pricing, payment resolve/adjust/void | صلاحيات تتطلب account role/server guards؛ لا endpoint admin granular roles ظاهر؛ عدة admin UI keys لا تقابل هذه العقود |

لا توجد عقود حالية مثبتة لـ: request-specific join على line مع capacity lock، المطابقة اليومية الحية، شكاوى المستخدم، تقييماته، اشتراك rider/payment request/proof/code/activation/end/cancel، تعديل بيانات المستخدم، صلاحيات أعضاء الإدارة. لا يجوز كتابة API غير موجود على أنه حاضر.

### 11.3 تطابق frontend/backend

- يتطابق تسجيل الدخول/التسجيل، البحث، إنشاء الطلب اليومي، إلغاء الطلب، خطوط الكابتن، الوثائق، المحادثات، الإشعارات وبعض الإدارة مع مسارات منشورة.
- `POST /rider/requests/{id}/match` في الواجهة يوحي باسم match، لكن الخادم يقرأ الطلب المملوك وسجل match فقط؛ HTTP POST هنا لا يعني mutation. الواجهة تمنع تكرار الضغط ولا تصنع حالة نجاح.
- اختلاف مهم: إنشاء Demand Request ليس انضمامًا لعرض بعينه. واجهة تفاصيل العرض تشرح هذا، لكن زرها يظل قابلًا لسوء الفهم.
- تطبيق Admin يسمي بعض الشاشات “مركبات/عروض/مجموعات/اشتراكات/شكاوى/تقييمات/صلاحيات”، بينما عقود API لا تقدم CRUD/قوائم منفصلة لكل منها.
- `AdminBody` يوجّه عدة مفاتيح شاشة إلى مكونات/صفوف generic؛ لذلك وجود رابط الإدارة غير كافٍ لإثبات endpoint صحيح.

## 12. قاعدة البيانات والمخطط

### 12.1 مخطط Supabase الحي

المشروع الحي الذي فُحص هو `uorxfakceqnhxqnaawdy`. استعلام metadata للقراءة فقط وجد جداول `public` تشمل:

`account_deletion_events`, `admin_audit_logs`, `admin_ledger_adjustments`, `admin_system_settings`, `admin_trip_actions`, `admin_user_controls`, `api_rate_limits`, `app_config`, `app_feature_flags`, `audit_log`, `captain_lines`, `captain_profiles`, `commuter_board_campaigns`, `daily_commute_requests`, `demand_groups`, `demand_requests`, `direct_messages`, `google_maps_api_usage`, `matches`, `message_conversations`, `otp_challenges`, `payment_status_events`, `payments`, `policy_acceptances`, `pool_captain_capabilities`, `pool_captain_escrow_transfers`, `pool_captain_escrows`, `pool_captain_stats`, `pool_categories`, `pool_groups`, `pool_ledger`, `pool_members`, `pool_notification_mutes`, `pool_notifications`, `pool_subscriptions`, `pool_trip_cancellations`, `pool_trip_stops`, `pool_trips`, `pricing_config`, `push_subscriptions`, `rider_commuter_preferences`, `rider_preferred_routes`, `rider_saved_places`, `service_categories`, `sessions`, `super_admins`, `telegram_password_reset_challenges`, `telegram_phone_verification_challenges`, `trip_stops`, `trips`, `user_location_searches`, `user_verifications`, `users`, `vehicle_types`.

لاحظ أن هذا المخطط يستخدم `users.id` كعدد صحيح وحقول أدوار `rider/captain/admin`، و`daily_commute_requests`, `matches`, `trips`, `captain_lines`. وهو مختلف بنيويًا عن migration محلية غير متتبعة بتاريخ 2026-10-30 التي تنشئ `profiles` UUID مرتبطة بـ`auth.users` و`rider_requests`, `line_join_requests`, `ride_groups`, `subscriptions`, `payment_requests`, `payment_evidence`, `payment_confirmation_codes`. لم تظهر migrations المحلية الجديدة ضمن سجل migrations الحي؛ لم تُطبّق في هذا التدقيق.

### 12.2 العلاقات والسلوك المعروف

- `daily_commute_requests.rider_user_id → users.id`; الطلب يحمل service category وإحداثيات ومكان/حالة/created timestamps. لا حقول ثابتة لتاريخ/وقت الرحلة أو passenger count.
- `captain_lines.captain_user_id → users.id`, وvehicle type/status/timing/seats/price/location.
- `demand_groups` و`demand_requests` يخدمان نموذج الطلبات المجمعة؛ يوجد unique `(rider_user_id,demand_group_id)` في demand requests.
- `matches.daily_commute_request_id` له unique index، ويمنع match ثاني للطلب اليومي؛ `trips.match_id` unique؛ `trip_stops.trip_id,sequence` unique.
- trigger insert match ينشئ trip وstops ويحدث daily request إلى matched. Trigger guard يتحقق من دور الكابتن وحالة request المفتوحة، لكن الفحص السابق للمصدر لم يثبت تحققًا شاملًا من اعتماد/نشاط الكابتن في trigger ذاته؛ يجب تقييم ذلك ضمن فحص الخادم والمطابقة.
- لا evidence على matcher concurrency-safe API لأن endpoint الإنشاء غير موجود. الفهارس unique تحمي duplicate match من DB إن مر insertion خلالها، لكنها لا تنفذ قرار المطابقة.
- جداول payment الأساسية في المخطط الحي (مثل `payments`, `payment_status_events`) ليست دليلًا على وجود Subscription payment flow أو تحويل مباشر مؤكد.

### 12.3 Triggers / Functions / RLS

- فُحصت metadata للسياسات: RLS مفعّل على جداول `public` المسجلة، `FORCE ROW LEVEL SECURITY` غير مفعّل. عدة جداول لا تحتوي سياسة مباشرة؛ بعضها يعتمد على أن عمليات العميل ممنوعة وأن الخدمة تستخدم backend privileged role. هذا ليس إثباتًا وحده على exposed access؛ يلزم استكمال فحص GRANTs/views/storage وسياق كل عملية.
- سياسة `captain_lines` بالـproduction كانت بلا سياسة بحسب metadata الحالية في snapshot المختصر؛ endpoint البحث يستخدم Edge Function. يجب إعادة فحص grants عبر تقرير أمان شامل قبل السماح بأي direct client query.
- `daily_commute_requests` و`matches` يحويان سياسة واحدة لكل جدول. التحقق الفعلي من predicate/policy definition لم يُعد في هذا التقرير، لذا لا أجزم بمستوى كل predicate هنا. المحرك الخادمي الحالي يستخدم API authorization.
- لا يتم تعطيل RLS أو اقتراح فتح الجداول. لا service role في الواجهة بحسب `.env.example` وAPI client (المفتاح publishable/anon فقط). لم يتم فحص قيم البيئة.
- قاعدة schema توجد في migrations سابقة tracked وفي snapshot، لكن المصدر الكامل لجميع triggers/functions غير محفوظ محليًا. يجب pinning/archival لمصدر Edge function وإصدارات migrations من Supabase.

### 12.4 اختلاف ملفات محلية غير مطبقة

- `supabase/migrations/20261030020631_sekka_schema_reset.sql` غير متتبع محليًا ويغيّر نموذج الهوية إلى Supabase Auth `profiles` UUID، ويؤرشف مجموعة جداول public القديمة إلى schema `legacy_archive_20261030`، ويحذف وظائف قديمة `CASCADE`، ثم ينشئ منظومة جداول جديدة.
- `supabase/migrations/20261030141000_sekka_schema_hardening.sql` غير متتبع، يعتمد على بنية reset السابقة ويغير policies والوظائف.
- سجل migrations الحي لا يعرض هذين الإصدارين؛ لذا التقرير لا يعاملهما كـproduction. لكن تشغيل reset قد ينقل بيانات/يدمر سلوكيات functions المعتمدة في التطبيق المنشور، ويبدو schema الجديد غير متوافق مع Edge Function المنشورة (التي تستخدم `users` integer). **يجب عدم تشغيلهما أو نشرهما قبل مراجعة schema/API وخطة ترحيل واسترجاع منفصلة.** لم أنفذهما ولم أختبرهما على الإنتاج.

## 13. الأمان والصلاحيات

### أدلة إيجابية

- الواجهة تستخدم publishable/anon key فقط؛ لا service role في كود المتصفح المقروء.
- API client يرسل token bearer ويتعامل مع `401` بمسح الجلسة وإطلاق expired event.
- `App.tsx` يوجه المستخدم بناء على الدور المحفوظ بعد `GET /auth/me` ويحمي بعض routes من ناحية الواجهة.
- endpoint اليومي match يفحص ملكية الطلب؛ endpoints الأخرى موصوفة بالمصفوفة على أنها user scoped.
- RLS مفعّل في metadata، وunique constraints تمنع match/trip مكرر.

### أسئلة/مخاطر تتطلب تحققًا إضافيًا

1. Edge function `verify_jwt=false` تستلزم توثيق كيف يتحقق كل handler من bearer وrole والownership، واختبارًا سلبيًا لحسابات مختلفة؛ هذا setting لا يثبت وحده vulnerability لكنه يجعل فحص custom auth واجبًا.
2. الرمز محفوظ في `localStorage` لمدة سبعة أيام من جهة العميل (`sekka_api_session_v1`). يجب مطابقة انتهاء client مع TTL server session، حماية logout/revocation، ومراجعة أثر XSS. لم يُختبر انتهاء token فعليًا.
3. Direct Supabase query لا يزال في `CaptainHomeScreen.tsx` إلى `profiles` و`captain_lines.captain_id`. المكون غير موصول حاليًا، لكن إعادة تشغيله على المشروع الحي قد تفشل أو تفتح مسار وصول غير مطابق؛ الأفضل توثيق أنه legacy حتى يتقرر تنظيفه لاحقًا.
4. مراجعة سياسة Storage لحماية documents/avatars والروابط الموقعة، وCORS allowlist، وrate limits، وOTP secrets، لا يمكن حسمها دون configuration/runtime review.
5. admin actions تستخدم `prompt/confirm` وclient form conversions؛ يجب أن يتحقق الخادم من reasons/ranges/role ويكتب audit event. لم تنفذ أي mutation لاختبار ذلك.
6. لا يوجد دليل E2E على منع تلاعب السعر والمقاعد أو تضارب السعة، أو منع duplicate payment confirmation.

## 14. القرارات التجارية والتقنية المفتوحة

### قرارات OPEN-001 إلى OPEN-011 من `DECISION_LOG.md`

| القرار | الموضوع وما يحتاج حسمًا | أثر عدم الحسم |
|---|---|---|
| OPEN-001 | نسبة العمولة مستقبلًا، توقيت/شرط التطبيق والنطاق والاستثناءات؛ حاليًا 0% معتمد | أي تطبيق مستقبلًا أو calculation غير مسموح قبل القرار |
| OPEN-002 | دفعات/frequency وجمهور وتوقيت إشعار خطة العمولة وإلغاؤها | لا schedule إشعارات أو تشغيل تلقائي |
| OPEN-003 | صلاحية كود الدفع، عدد المحاولات، إعادة الإصدار وإبطال السابق | لا يمكن إكمال code policy؛ لا تخمين للمدة أو retries |
| OPEN-004 | تسعير الاشتراك، ثابت/متغير، الشهر الجزئي، المدة والرسوم | يمنع إثبات مبلغ payable/renewal دون المصدر المعتمد |
| OPEN-005 | الحد الأدنى للمجموعة لكل مركبة/استثناءات وما يحدث إذا لم تكتمل | يمنع تحديد متى تعتبر المجموعة جاهزة |
| OPEN-006 | هل سعة المركبة تشمل الكابتن أم الركاب | يمنع eligibility/capacity validation النهائي |
| OPEN-007 | cycle start/end، الاشتراك في منتصف الدورة، expiry/renewal وعلاقته بالدفع | يمنع تفعيل lifecycle الاشتراك |
| OPEN-008 | من ومتى يمكنه الإلغاء وأثره على الحالة/الأموال | يمنع زر إلغاء موثوق وسياسة مالية |
| OPEN-009 | انسحاب كابتن بعد الدفع، وجود بديل/ضمانه/رد الأموال والمسؤول | يمنع replacement workflow ووعوده |
| OPEN-010 | متى يبدأ البحث، المعايير، دور المستخدم في قبول التطابق، no-results والتغييرات والتدخل الإداري | يمنع اعتماد matcher نهائي؛ instruction حديث في محادثة المستخدم يطلب توصية بلا اختيار آلي ويضيف تعارضًا يحتاج تحديث DECISION_LOG رسميًا |
| OPEN-011 | طريقة login/verification، recovery، session expiration | auth الحالي يعمل كعقد لكنه لم يختبر، وقد يخالف القرار المستقبلي |

توجد كذلك حالات `OPEN — CASE BY CASE` في سجل القرار (حوالي سطور 803، 820، 836) تحتاج قراءتها وحسم موضوعاتها قبل إطلاق السياسات المقابلة. لا أضمها إلى أرقام الـ11 المسماة لأنها حالات قرار إضافية منفصلة.

### قرار المطابقة الذي أضافه المستخدم حديثًا

التوجيه الأخير يقرر أن النظام يعرض مرشحين مناسبين ولا يختار/يعين كابتن تلقائيًا، وأن الراكب يختار العرض، مع عدم اختراع scores أو حدود عدد نتائج أو شروط غير معتمدة. هذا يزيل تفسير auto-assignment، لكنه **لم يحدّث** OPEN-010 رسميًا؛ كما أن اختيار عرض محدد/حجزه يفتقد API في النسخة المنشورة. يجب اعتماد تعديل سجل القرار ونموذج البيانات/API بعد حسم حقول request (الوقت والتاريخ وعدد الركاب) وطريقة capacity lock.

## 15. نتائج الاختبارات والجودة

| الفحص | الحالة | الإثبات والحد |
|---|---|---|
| TypeScript | ناجح في الجولة السابقة على HEAD الحالي | `npm run typecheck` داخل `web/`؛ لم يُعَد أثناء هذا التدقيق |
| Production build | ناجح في الجولة السابقة | `npm run build`; Vite أظهر تحذيرًا أن output bundle يتجاوز 500 KB تقريبًا |
| Unit tests | ناجحة (4) | `npm test`؛ فقط مرشح/فلترة Rider matching، ليس backend matching |
| Lint | غير متاح | لا script lint في `web/package.json` |
| API integration tests | غير منفذة | لا suite API مستقلة أو staging credentials |
| E2E | غير منفذة | لا حسابات staging rider/captain/admin |
| RLS/negative authorization | فحص metadata/source جزئي فقط | لم تُرسل محاولات غير مصرح بها؛ لا يجوز وصفها ناجحة |
| Production writes | لم تُنفذ | لا تغييرات مستخدم أو بيانات، ولا DB migration |
| Browser/console/responsive | لم يُختبر في جلسة جديدة | لا قياس عبر أحجام/Console ضمن هذا التدقيق |
| روابط/route smoke | فحص مصدر routes فقط؛ بعض local/browser smoke سابق | ليس اختبار شامل لكل 86 عنصرًا |
| Cloudflare deployment | لم ينفذ | preview قديم موثق في المحادثة، غير معتبر كاختبار وظيفة أو production |

لا تُستخدم هذه الاختبارات كدليل جاهزية release. لا توجد تغطية اختبارات للـEdge Function ضمن Git.

## 16. مشكلات التصميم وتجربة المستخدم

- نظام Design System موجود ويخدم الألوان/العناصر الأساسية؛ لكنه لا يثبت جودة كل route أو مطابقة صورة مرجعية، ولم أجر visual QA.
- كتل صفحات Rider/Captain/Admin الكبيرة تنفذ عدة flows داخل مكونات dispatch واحدة؛ هذا يرفع مخاطر اختلاف empty/error/loading والـforms/status.
- routes كثيرة تقود إلى قالب أو card عام، مما قد يعطي انطباعًا بوجود شاشة دون محتوى وظيفي.
- rider search modal يعرض عرضًا ثم يتيح إرسال demand عام غير مرتبط بالعرض؛ تنبيه النص يقلل التضليل لكنه لا يحقق intent “انضم لهذا العرض”.
- رحلة اشتراك/دفع rider موزعة على routes لكنها جميعًا تعلن أو تُظهر نقص API؛ يجب حجب أفعال الادعاء بالنجاح وعدم اعتبار تصميمها إتمامًا.
- captain home الحالي مفصل داخل `CaptainJourneyScreen`؛ مكون `CaptainHomeScreen` مستقل يستخدم Supabase schema مختلفًا وهو غير مستخدم من `App.tsx`.
- admin uses native prompts for pricing/review/disputes; تجربة ضعيفة على الجوال وإمكانية إدخال قيم غير مناسبة، حتى لو رفضها backend.
- PWA/offline experience: لا دليل ضمن الملف المتتبع على service worker, manifest, install/offline operation; أصول `index.html` فقط لا تكفي. ملفات untracked reset تشير إلى manifest offline في schema? لا تعتبره مصدرًا حيًا.

## 17. النواقص حسب الأولوية

| الأولوية | النقص والأثر | المعالجة/الاعتماد |
|---|---|---|
| P0 | مصدر Edge Function الخادمي ليس متتبعًا في Git، مع جداول إنتاجية ومعلومات schema مختلفة عن migrations محلية. مخاطر فقد reproducibility وانحراف النشر | استعادة source-controlled version وربط hash/version؛ لا migration reset قبل plan/backup وstaging |
| P0 | لا اختبارات E2E للصلاحيات/money/ownership مع عدم معرفة test staging | تجهيز staging وrider/captain/admin fixtures وتأكيد API base قبل الكتابة |
| P1 | اختيار العرض/حجز السعة غير ممكن؛ الطلب العام غير مرتبط بـline | قرار حقول الطلب + API/transaction + tests؛ لا تخترع API قبل اعتماد contract |
| P1 | المطابقة اليومية غير فعالة: status POST قراءة؛ لا matcher endpoint | اعتماد عقد matcher متوافق مع تعليمات المستخدم، role/eligibility/locking والtrigger |
| P1 | الاشتراك والدفع المقصود في PRD غير متصلين بـUI؛ لا payment request/proof/code/activation endpoints المقابلة | حسم OPEN-003/004/007/008/009، ثم تصميم API وربط record lifecycle بدون custody |
| P1 | لا complaint/rating API، ولا profile update | عقود واضحة وownership + validations + UI؛ لا direct table writes |
| P1 | تأكيد التسجيل/OTP/reset/login ليس E2E وOPEN-011 | قرار رسمي وتست staging لمزود Telegram/OTP |
| P1 | كابتن لا يرى daily commute requests ولا candidate details، ولا يوجد flow لاختيار العرض | اعتماد نموذج المطابقة وAPI read candidates أو route تعاقدي موحد |
| P1 | direct Supabase component قديم يطلب `profiles`/`captain_id` خلاف schema الحي | قبل أي إعادة استخدام، استبداله بAPI الفعلي أو حذف بعد مراجعة dependencies (ليس ضمن هذا التدقيق) |
| P2 | لوحة admin فيها 29 key مقابل 23 screen map؛ بعضها generic وAPI mapping غير واضح | ربط كل route بمصدر بيانات/صلاحية وإزالة ما يثبت أنه خارج النطاق في دفعة منفصلة بموافقة |
| P2 | تفاصيل الطلب/المجموعة/الاشتراك تسلك قوالب generic ولا تحوي route-specific fetch | APIs detail محمية أو إعادة توظيف responses المجمعة مع حالات صريحة |
| P2 | Messenger بين rider/captain غير متماثل؛ rider read-only | توحيد تدفق الرسائل وصلاحيات conversation ثم اختبار زوج حقيقي |
| P2 | تفاصيل وثائق/صور خاصة، push, reset secret config غير مثبتة | إعداد test buckets/providers وفحص policies/headers/storage |
| P2 | تصميمات responsive/RTL وconsole غير مفحوصة منهجيًا | visual regression/smoke على 320/375/768 وRTL قبل release |
| P3 | bundle size تجاوز Vite 500 KB في التحذير السابق؛ تحليلات/assets optimization | تقسيم lazy chunks ومراجعة dependencies بعد إغلاق P1 |
| P3 | غياب lint script/workflow CI؛ build/tests لا تمنع نشر edge function drift | CI typecheck/test/build وcontract snapshot versioning |

## 18. خطة استكمال مقترحة (لا تُنفذ ضمن هذه المراجعة)

### المرحلة 0 — تثبيت الحقيقة التشغيلية

- **الهدف:** تحديد source of truth لـEdge Function وDB والتأكد من staging.
- **الملفات:** Edge Function source كامل في Git تحت ownership مناسب، migration history/export snapshot، docs API contract، `.github/workflows/*` إذا اعتمد المشروع CI.
- **Backend/DB:** لا تغيير schema؛ read-only export/audit.
- **القرارات:** اعتماد أن تعليمات الترشيح اليدوي تسود على OPEN-010 أو تحديث DECISION_LOG.
- **الاختبارات:** typecheck/build/unit؛ deploy إلى بيئة staging منفصلة؛ anon/auth negative smoke.
- **الاكتمال:** source hash يطابق المنشور، staging منفصل، لا أسرار في client، DB migrations معروف ترتيبها.

### المرحلة 1 — عقود المستخدم والطلب/العرض

- **الهدف:** توحيد معنى rider daily request والبحث عن العرض المحدد.
- **قرارات قبل البدء:** التاريخ/وقت الوصول/المغادرة/الركاب، معنى السعة (OPEN-006)، أيام الخدمة، no-results، سياسة اعتماد الكابتن.
- **Backend:** candidate search authorized، join/seat reservation atomic أو endpoint ملائم لنموذج الاختيار اليدوي؛ عدم auto-assignment.
- **Frontend:** form payload يعكس contract، details واختيار line وحالة request دقيقة.
- **DB:** schema/migration فقط إذا احتاج contract؛ locking/unique/idempotency.
- **اختبار:** candidate eligibility، full capacity، concurrent joins، duplicate retries، foreign ownership، no result.
- **الاكتمال:** طلب واحد قابل للتتبع؛ API response/state لا يعد بقبول/رحلة قبل تأكيد backend.

### المرحلة 2 — دورة المطابقة/المجموعة

- **الهدف:** تنفيذ النموذج المعتمد ونقل `open` إلى status خادمي متسق.
- **Backend:** تحديد API matcher/selection المناسب؛ توصيل trigger transaction والتحقق من verification/active line/capacity، idempotency.
- **Frontend:** rider result وcaptain workload/status من نفس source of truth.
- **اختبارات:** duplicate/concurrency/no eligible captain/trigger rollback/stale offer/permissions.
- **القرارات:** OPEN-005/006/010.
- **الاكتمال:** لا مسار client privileged، وحالات rider/captain متطابقة في staging.

### المرحلة 3 — الكابتن والعروض والوثائق

- **الهدف:** إكمال create/edit/status وprofile/document lifecycles.
- **Backend:** update vehicle, verified file URLs, role/ownership.
- **Frontend:** منع العرض الكاذب لحقول لا يحفظها الخادم، ترابط errors/retry.
- **اختبارات:** captain pending/approved, own/other line, bad file, duplicate save, storage unauthorized.
- **الاكتمال:** كل action له contract معروف ونتيجة persistent مثبتة.

### المرحلة 4 — الاشتراكات والدفع الشهري

- **الهدف:** بناء actual lifecycle وفق دفع مباشر للكابتن، بلا wallet/escrow.
- **قرارات:** OPEN-003/004/007/008/009؛ لا أسعار أو مدد من الافتراض.
- **Backend/DB:** subscription request, payment record, proof storage, captain receipt confirmation, code create/verify/replay guards, status audit؛ حقول/transactions فقط بعد review.
- **Frontend:** ربط screens 07–17 بحالة حقيقية، التفريق بين receipt والإثبات والاستلام.
- **اختبارات:** cash/e-wallet/Instapay, wrong owner, repeated confirmation, bad/expired code, no false activation.
- **الاكتمال:** لكل transition سجل DB + API response + auth test.

### المرحلة 5 — الرسائل والدعم والإشعارات/الملف

- **الهدف:** توحيد rider/captain communication وprofile/support.
- **Backend:** complaint/rating/profile update APIs إن اعتمدت، notification push lifecycle، participant authorization.
- **Frontend:** send message rider، complaint status, ratings eligible context، profile edit.
- **اختبارات:** cross-account denial, duplicate, content validation, notification read/push.
- **الاكتمال:** كل زر إما API verified أو disabled برسالة دقيقة.

### المرحلة 6 — Admin والأمان

- **الهدف:** مطابقة جميع routes مع API موثق وخادم صلاحيات/audit.
- **Backend:** gaps في admin lists/detail/staff permissions، review, pricing/config validators.
- **Frontend:** شاشات مخصصة بدل generic lists، إقرار إجراءات حساسة accessible.
- **اختبارات:** role matrix، audit records، invalid financial edits، read-only roles.
- **الاكتمال:** لكل Admin screen مصدر بيانات وعملية موثقة وصلاحية server-side مثبتة.

### المرحلة 7 — QA release

- **الهدف:** regression شاملة فقط بعد اكتمال العقود والقرارات.
- **الاختبارات:** unit/integration/e2e mobile viewports, RTL, offline, browser console, security, load/concurrency, deployment preview smoke.
- **الاكتمال:** جميع وظائف MVP المطلوبة `E2E VERIFIED` أو exclusions معتمدة ومعلنة؛ rollback موثق؛ لا تغيير production قبل موافقة صريحة.

## 19. الاعتماديات والمخاطر

1. مصدر Edge Function غير محفوظ محليًا هو خطر أساسي على مراجعة التغييرات/reproducibility.
2. migrations untracked المحلية لا تتطابق مع المخطط المنشور؛ أي تطبيق قد يغيّر هوية/بنية النظام ويرفع خطر downtime/فقد الوصول. لا تنفذها كخطوة ضمنية.
3. API version 61 الحالي يقدم pool endpoints إضافية، بينما current UI targets direct captain-line/demand and incomplete subscriptions. يجب تحديد model واحد لكل journey.
4. وجود unique constraints يمنع duplication بجدول match لكنه لا يضمن حق المستخدم أو أهلية الكابتن وحده.
5. لا staging وحسابات تجعل عمليات الدفع/التسجيل/الوثائق والإدارة غير قابلة للـE2E الآن.
6. localStorage session والـcustom bearer implementation تتطلب اختبار صلاحية وتدوير/revoke ومراجعة XSS.
7. screen map يقر بأن بعض الشاشات حالات داخلية، لكن عدد admin routes وgeneric dispatcher يخلق اختلاف نطاق يجب تسجيله.
8. policy/payment/business decisions تؤثر مباشرة على schema؛ التنفيذ قبل اعتمادها ينتج data migration ثانية.
9. bundle warning وغياب CI يزيدان احتمالات تراجع غير مكتشف، لكنهما ليسا مانع MVP مقارنة بفجوات المطابقة والدفع.

## 20. أسئلة لصاحب المشروع قبل أي تنفيذ يعتمد عليها

1. هل نحدّث OPEN-010 رسميًا لينص على ترشيح عروض للكابتن المناسب ثم اختيار الراكب يدويًا، دون auto-assignment؟ ما الـrules الدنيا المسموحة للفلترة قبل إظهار العرض؟
2. ما الحقول التي يجب أن تحفظ في طلب الرحلة: تاريخ واحد أم أيام الأسبوع، وقت وصول أم انطلاق، عدد ركاب؟
3. هل انضمام الراكب لعرض يحتاج قبول كابتن أم هو حجز مؤكد تلقائيًا بعد توفر السعة؟ هذا قرار منفصل عن “المطابقة التلقائية”.
4. هل سعة vehicle type تشمل الكابتن؟ وكيف تحسب المقاعد المحجوزة/المتاحة عند تعدد الطلبات المتزامنة؟
5. ما الحد الأدنى لتكوين group لكل فئة، وماذا يحدث عندما لا يكتمل؟
6. ما سعر الاشتراك وكيف يحسب الشهر الجزئي/بداية ونهاية الدورة؟
7. مدة كود الدفع ومحاولاته وإعادة إصداره وإبطال القديم؟
8. ما سياسة الإلغاء من rider/captain وما أثرها المالي؟ ماذا يحدث بعد دفع rider وانسحاب captain؟
9. ما طريقة التحقق الرسمية للحساب، وهل يبقى Telegram هو recovery/provider؟ وما session TTL/revoke policy؟
10. هل الإدارة تحتاج مستويات roles متعددة أم دور admin واحد؟ ما permissions exact؟
11. هل تعليقات/تقييمات المستخدمين تدخل MVP أم تريد تأجيلها؟ ما سياستها ومتى يسمح بالتقييم؟
12. ما مصدر البيئة staging ومن يملك حسابات rider/captain/admin وبيانات fixtures؟ لا تستخدم حسابات الإنتاج للاختبار.
13. هل الملفات untracked `supabase_schema_reset` و`hardening` مقصود بها بديل معماري؟ لا تعطي موافقة ضمنية على تطبيقها؛ المطلوب قرار رسمي وخطة توافق API/backup.

## المراجع الداخلية التي فُحصت

- `docs/product-spec/SeKKa_Master_PRD_MVP_v2_AR.md`
- `docs/product-spec/SeKKa_Master_Screen_Map_MVP_v1_AR.md`
- `docs/product-spec/SeKKa_Master_UI_UX_Design_Spec_AR.md`
- `docs/product-spec/DECISION_LOG.md`
- `docs/product-spec/ARCHITECTURE.md`, `IMPLEMENTATION_PLAN_v1.md`, `IMPLEMENTATION_PLAN_v2.md`, `DESIGN.md`
- `docs/SEKKA_FUNCTIONAL_COMPLETION_MATRIX.md`, `docs/PRODUCTION_BACKEND_INTEGRATION.md`, `docs/SEKKA_MATCHING_RANKING_PROPOSAL.md`, `docs/ADMIN_SUPABASE_ALIGNMENT.md`, `docs/UX_NAVIGATION_AUDIT.md`
- `web/src/App.tsx`, `web/src/lib/sekka-api.ts`, `web/src/lib/admin-api.ts`, `web/functions/__sekka-api/[[path]].ts`, وملفات `web/src/screens/*`
- `web/package.json`, `web/vite.config.ts`, `.env.example`
- Supabase read-only metadata: `sekka-api` version 61، tables/columns/indexes/constraints، RLS enabled/force state، applied migrations. لا بيانات مستخدمين أو mutations.

## ملخص تنفيذي قابل للإرسال إلى ChatGPT

مشروع SeKKa الحالي React/TypeScript/Vite في `web/`, منشور كواجهة Cloudflare Pages، ويستدعي Supabase Edge Function `sekka-api` (version 61) عبر Cloudflare proxy. مصدر Edge Function المنشورة غير محفوظ في Git، ولذلك لا توجد reproducible backend source ضمن هذا الفرع. قاعدة البيانات الحية تستخدم `users` بمعرفات integer وجداول `captain_lines`, `daily_commute_requests`, `demand_groups`, `demand_requests`, `matches`, `trips`, `payments` وغيرها؛ RLS مفعّل حسب metadata، لكن بعض الجداول لا تظهر لها policies مستقلة، ما يستلزم فحص grants ومسارات الخدمة. لا توجد staging credentials أو حسابات اختبار، ولذلك لا توجد أي وظيفة E2E VERIFIED.

الواجهة تتضمن 7 عناصر عامة و24 rider و24 captain و23 admin و8 shared وفق screen map، بينما التنفيذ يعرض 18 rider journey keys و24 captain و29 admin و8 shared keys، وبعضها generic templates. تسجيل/دخول، البحث عن خطوط، عروض الكابتن، documents upload، المحادثات، الإشعارات، earnings/receipt confirmation وبعض admin actions متصلة بعقود خادم، لكنها لم تختبر بحسابات فعلية. الاختبارات المتاحة سابقًا على HEAD: typecheck/build ناجحان، 4 Unit tests لفلترة المرشحين ناجحة، لا lint script ولا integration/E2E، وbuild يصدر تحذير bundle >500 KB.

أبرز نقص وظيفي: لا يوجد endpoint يحجز عرضًا محددًا أو يتحقق ذريًا من السعة، و`POST /rider/requests/{id}/match` يقرأ حالة الطلب فقط ولا ينشئ match. Trigger DB عند إدراج match ينشئ trip/stops ويحدث الطلب، لكنه لا يقرر matcher ولا توجد API كتابة آمنة للوصول إليه. يومي request form يحفظ category وcoordinates فقط دون date/time/passenger count. اشتراكات rider ودفعها ظاهرة عبر routes لكنها غير متصلة بـsubscription payment/proof/code/activation APIs. لا complaint/rating/user profile update API مثبتة. rider chat لا يرسل رغم وجود API messaging ويستطيع captain الإرسال. admin screen keys تتجاوز screen map وبعضها generic بلا API واضح. يوجد component قديم `CaptainHomeScreen.tsx` يستخدم مباشرة `profiles` و`captain_lines.captain_id`، المتعارضين مع schema الحي؛ لكنه غير موصول في App الحالي.

DECISION_LOG يترك OPEN-001..011 (عمولة مستقبلية، إشعارات العمولة، صلاحية الكود، التسعير، الحد الأدنى للمجموعة، تعريف السعة، lifecycle الاشتراك، الإلغاء، انسحاب الكابتن بعد الدفع، matching، auth). تعليمات حديثة تريد المرشحين مع اختيار الراكب وعدم تعيين آلي، وهذا لم يحدّث OPEN-010 بعد. كما توجد migrations محلية غير متتبعة باسم `20261030020631_sekka_schema_reset.sql` و`20261030141000_sekka_schema_hardening.sql` تستخدم schema مختلفًا (`profiles` UUID و`rider_requests`/`line_join_requests`/`subscriptions`) وتؤرشف/تحذف functions CASCADE. لم تظهر في migrations المطبقة؛ لا تشغّلها قبل مراجعة منفصلة وخطة توافق وترحيل.

من 45 وحدة التدقيق الحصرية: 0 COMPLETE، 13 PARTIALLY COMPLETE، 8 FRONTEND ONLY، 1 BACKEND ONLY، 6 NOT IMPLEMENTED، 7 BLOCKED، 10 UNVERIFIED، 0 BROKEN مثبت. هذه أعداد عناصر التدقيق وليست نسبة اكتمال المشروع. الأولوية التالية: تثبيت مصدر backend وبيئة staging؛ اعتماد حقول الرحلة والسعة/الحجز ومعايير الترشيح؛ بناء API آمن لاختيار العرض والحجز؛ اختبار match trigger concurrency/ownership؛ ثم subscription/payment contract بناء على قرارات OPEN؛ وبعدها دعم/تقييمات وملفات الحساب وصلاحيات Admin واختبار E2E كامل. لم يُنفذ أي تغيير كود/قاعدة/نشر في التدقيق.
