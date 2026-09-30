-- ============================================================================
-- SeKKa | سِكَّة — Migration 005: Matching Domain (Phase 5)
--
-- ممنوع تعديل 001_init.sql, 002_auth.sql, 003_captain_profile.sql, أو
-- 004_booking.sql. هذا الملف نفسه ممنوع تعديله بعد ما يتنفذ فعليًا — أي
-- تعديل لاحق لازم يكون 006_....
--
-- قرارات المالك الصريحة لهذه المرحلة (تفاصيل كاملة في HANDOFF.md):
--   1. Matching أوتوماتيكي بالكامل، مفيش خطوة موافقة من الكابتن.
--   2. الأهلية أولًا (verification_status='approved' فقط + نوع المركبة
--      المطابق لـ service_category المطلوبة + موقع حالي صالح)، بعدين
--      الترتيب بالمسافة على الكباتن المؤهلين بس.
--   3. الترتيب: أقرب مسافة (Haversine) → الأقدم تسجيلًا
--      (captain_profiles.created_at) → captain_id (Fallback نهائي حتمي).
--      مفيش اختيار عشوائي إطلاقًا.
--   4. current_lat/current_lng هما موقع الكابتن المعتمد للمسافة (مش
--      home_lat/lng — قرار صريح من المالك). لو NULL، الكابتن ده مستبعد
--      تمامًا من الـ Matching (مفيش Fallback لموقع تاني لأنه مش موجود في
--      الـ Schema أصلًا من قبل كده).
--
-- التغييرات:
--   - captain_profiles: إضافة current_lat/current_lng (REAL NULL، CHECK على
--     المدى الجغرافي الصحيح — نفس نمط pickup/dropoff بتاع 004_booking.sql).
--     اتأكد فعليًا إن SQLite (node:sqlite) بيسمح بـ ALTER TABLE ADD COLUMN
--     مع CHECK طالما مش بيرجع لعمود/جدول تاني (مش محتاجين نمط الـ Rebuild
--     اللي 002_auth.sql استخدمه، ده كان بسبب NOT NULL بدون Default بس).
--     مفيش DEFAULT صريح = NULL هو الابتدائي — كابتن لسه مبعتش موقعه الحالي
--     يبقى مستبعد من الـ Matching، مش خطأ إدخال.
--   - matches: جدول جديد. Match واحد بس لكل Request
--     (UNIQUE على daily_commute_request_id — دفاع طبقة أولى، backstop لأي
--     محاولة Match تانية لنفس الطلب حتى لو منطق التطبيق حاول). captain_user_id
--     FK على users(id) لازم role='captain' فعليًا (Trigger، نفس نمط
--     trg_captain_profiles_role_* بتوع 003_captain_profile.sql). distance_km
--     REAL NOT NULL — المسافة المحسوبة وقت الـ Match (Haversine) للتوثيق/
--     الشفافية بس، مش لأي منطق تسعير في هذه المرحلة.
--   - Triggers دفاع طبقة ثانية:
--     - trg_matches_role_on_insert/_on_update: role='captain' فقط.
--     - trg_matches_request_must_be_open_on_insert: يمنع إدخال صف في matches
--       لو حالة الـ daily_commute_requests المرتبطة مش 'open' وقت الإدخال
--       (يمنع Match لطلب اتلغى/اتطابق قبل كده/expired حتى لو منطق التطبيق
--       حاول، مش بس فحص في الكود).
--     - trg_matches_sets_request_status_on_insert: بعد نجاح الإدخال، يحدّث
--       daily_commute_requests.status لـ 'matched' تلقائيًا لنفس الطلب —
--       دفاع طبقة ثانية يمنع أي تعارض حالة بين الجدولين.
-- ============================================================================

PRAGMA foreign_keys = ON;

ALTER TABLE captain_profiles
  ADD COLUMN current_lat REAL NULL CHECK (current_lat BETWEEN -90 AND 90);

ALTER TABLE captain_profiles
  ADD COLUMN current_lng REAL NULL CHECK (current_lng BETWEEN -180 AND 180);

CREATE TABLE matches (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_commute_request_id   INTEGER NOT NULL UNIQUE
                                REFERENCES daily_commute_requests(id),
  captain_user_id             INTEGER NOT NULL REFERENCES users(id),
  distance_km                 REAL NOT NULL CHECK (distance_km >= 0),
  matched_at                  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_matches_captain_user_id ON matches(captain_user_id);

CREATE TRIGGER trg_matches_role_on_insert
BEFORE INSERT ON matches
FOR EACH ROW
WHEN (SELECT role FROM users WHERE id = NEW.captain_user_id) <> 'captain'
BEGIN
  SELECT RAISE(ABORT, 'matches.captain_user_id must reference a user with role = captain');
END;

CREATE TRIGGER trg_matches_role_on_update
BEFORE UPDATE ON matches
FOR EACH ROW
WHEN (SELECT role FROM users WHERE id = NEW.captain_user_id) <> 'captain'
BEGIN
  SELECT RAISE(ABORT, 'matches.captain_user_id must reference a user with role = captain');
END;

CREATE TRIGGER trg_matches_request_must_be_open_on_insert
BEFORE INSERT ON matches
FOR EACH ROW
WHEN (
  SELECT status FROM daily_commute_requests WHERE id = NEW.daily_commute_request_id
) <> 'open'
BEGIN
  SELECT RAISE(ABORT, 'daily_commute_requests.status must be open to create a match');
END;

CREATE TRIGGER trg_matches_sets_request_status_on_insert
AFTER INSERT ON matches
FOR EACH ROW
BEGIN
  UPDATE daily_commute_requests SET status = 'matched'
  WHERE id = NEW.daily_commute_request_id;
END;
