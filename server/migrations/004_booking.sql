-- ============================================================================
-- SeKKa | سِكَّة — Migration 004: Booking Domain (Phase 4)
--
-- ممنوع تعديل 001_init.sql, 002_auth.sql, أو 003_captain_profile.sql. هذا
-- الملف نفسه ممنوع تعديله بعد ما يتنفذ فعليًا — أي تعديل لاحق لازم يكون
-- 005_....
--
-- نطاق هذه المرحلة (زي ما محدد في NEXT_PROMPT.md): Daily Commute Request
-- أساسي بس — لا Matching فعلي، لا Real-time، لا Payment (ولا حتى الـ Ledger)،
-- لا واجهة Captain لقبول/رفض. دي كلها مراحلها الخاصة الجاية.
--
-- التغييرات:
--   - daily_commute_requests: جدول جديد.
--     - rider_user_id: FK على users(id). دفاع طبقة تانية (Trigger تحت) بيمنع
--       أي صف لمستخدم role != 'rider' — نفس نمط trg_captain_profiles_role_*
--       بتوع 003_captain_profile.sql بالظبط.
--     - service_category_id: FK على service_categories(id) من 001_init.sql —
--       فئة "Elite" مستبعدة أصلًا هناك (مفيش صف اسمه elite في الجدول ده من
--       الأساس)، فمفيش داعي لأي CHECK إضافي هنا لنفس السبب اللي خلّى Phase 3
--       يعتمد على الـ FK بس لـ vehicle_type_id.
--     - Meeting Point (قرار صريح من المالك، مش افتراض): إحداثيات (lat/lng)
--       مُدخَلة يدويًا من المستخدم — مفيش أي Geocoding API خارجي مدفوع (قاعدة
--       عامة 2). عمودين منفصلين لكل نقطة (pickup/dropoff) بدل عمود نصي واحد،
--       مع CHECK على المدى الجغرافي الصحيح (lat بين -90 و90، lng بين -180
--       و180) كطبقة دفاع أولى ضد قيم فاسدة قبل أي منطق Matching لاحق.
--     - status: نفس نمط verification_status بتاع Phase 3 — CHECK صريح +
--       DEFAULT 'open'. الانتقالات المسموحة في نطاق هذه المرحلة فقط:
--       open → cancelled (لصاحب الطلب، عبر /cancel). open → matched/expired
--       مش جزء من نطاق هذه المرحلة (Matching الفعلي مرحلته الخاصة، Phase 5).
--     - requested_at: وقت تقديم الطلب (Server-generated، نفس لحظة created_at
--       في هذه المرحلة — مفيش جدولة لوقت مستقبلي في النطاق الحالي، الجدولة لو
--       اتطلبت لاحقًا محتاجة قرار ونطاق منفصل).
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE daily_commute_requests (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  rider_user_id         INTEGER NOT NULL REFERENCES users(id),
  service_category_id   TEXT NOT NULL REFERENCES service_categories(id),
  pickup_lat            REAL NOT NULL CHECK (pickup_lat BETWEEN -90 AND 90),
  pickup_lng            REAL NOT NULL CHECK (pickup_lng BETWEEN -180 AND 180),
  dropoff_lat           REAL NOT NULL CHECK (dropoff_lat BETWEEN -90 AND 90),
  dropoff_lng           REAL NOT NULL CHECK (dropoff_lng BETWEEN -180 AND 180),
  requested_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  status                TEXT NOT NULL
                          CHECK (status IN ('open', 'matched', 'cancelled', 'expired'))
                          DEFAULT 'open',
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_daily_commute_requests_rider_user_id ON daily_commute_requests(rider_user_id);
CREATE INDEX idx_daily_commute_requests_status ON daily_commute_requests(status);

-- امنع إنشاء/تحديث daily_commute_requests لأي rider_user_id مش role='rider'
-- فعليًا في users. دفاع ثانٍ فوق الـ 403 اللي الـ Route بيرجّعه أصلًا — نفس
-- منطق trg_captain_profiles_role_on_insert/update بالظبط، معكوس على role
-- 'rider' بدل 'captain'. لو rider_user_id مش موجود أصلًا، الـ FK هو اللي
-- بيرفض (subquery بترجع NULL، والمقارنة بـ NULL مش TRUE) — نفس التوثيق
-- الموجود في 003_captain_profile.sql، مش ثغرة.
CREATE TRIGGER trg_daily_commute_requests_role_on_insert
BEFORE INSERT ON daily_commute_requests
FOR EACH ROW
WHEN (SELECT role FROM users WHERE id = NEW.rider_user_id) <> 'rider'
BEGIN
  SELECT RAISE(ABORT, 'daily_commute_requests.rider_user_id must reference a user with role = rider');
END;

CREATE TRIGGER trg_daily_commute_requests_role_on_update
BEFORE UPDATE ON daily_commute_requests
FOR EACH ROW
WHEN (SELECT role FROM users WHERE id = NEW.rider_user_id) <> 'rider'
BEGIN
  SELECT RAISE(ABORT, 'daily_commute_requests.rider_user_id must reference a user with role = rider');
END;
