-- ============================================================================
-- SeKKa | سِكَّة — Migration 003: Captain Profile Domain (Phase 3)
--
-- ممنوع تعديل 001_init.sql أو 002_auth.sql. هذا الملف نفسه ممنوع تعديله بعد
-- ما يتنفذ فعليًا — أي تعديل لاحق لازم يكون 004_....
--
-- التغييرات:
--   - captain_profiles: جدول جديد. Profile واحد بس لكل Captain (user_id
--     UNIQUE). vehicle_type_id بيشاور على vehicle_types (من 001_init.sql) —
--     القيم الوحيدة الموجودة فعليًا هناك private_car/hiace، فمفيش "elite"
--     ممكن أصلًا عبر الـ FK ده (دفاع طبقة أولى). verification_status دايمًا
--     'pending' عند الإنشاء (DEFAULT صريح) — تغييرها لـ approved/rejected
--     مش جزء من نطاق هذه المرحلة (Admin Dashboard لاحقًا).
--   - دفاع طبقة ثانية (Trigger): امنع أي captain_profiles.user_id لغير
--     مستخدم role='captain' فعليًا وقت الإدخال أو التحديث — بنفس نمط
--     triggers الـ capacity بتوع 001_init.sql. لو user_id مش موجود أصلًا،
--     الـ FK (PRAGMA foreign_keys = ON من connection.ts) هو اللي بيرفض، مش
--     الـ Trigger ده (subquery بترجع NULL في الحالة دي، والمقارنة بـ NULL
--     مش TRUE فالـ Trigger ميتفعّلش — مقصود، مش ثغرة، لأن الـ FK بيغطّيها).
--   - otp_challenges: جدول جديد لتفعيل src/security/otp.ts الفعلي (Phase 2
--     بنته بس ماوصّلوش). purpose محصور بقيمة واحدة بس دلوقتي
--     ('phone_verification') عبر CHECK صريح — أي Purpose تاني يحتاج Migration
--     جديدة تضيفه بوضوح، مش يتقبل بصمت.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- captain_profiles
-- ----------------------------------------------------------------------------
CREATE TABLE captain_profiles (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id),
  vehicle_type_id       TEXT NOT NULL REFERENCES vehicle_types(id),
  license_number        TEXT NOT NULL,
  vehicle_plate         TEXT NOT NULL,
  verification_status   TEXT NOT NULL
                           CHECK (verification_status IN ('pending', 'approved', 'rejected'))
                           DEFAULT 'pending',
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_captain_profiles_user_id ON captain_profiles(user_id);

-- امنع إنشاء/تحديث captain_profiles لأي user_id مش role='captain' فعليًا في
-- users. دفاع ثانٍ فوق الـ 403 اللي الـ Route بيرجّعه أصلًا.
CREATE TRIGGER trg_captain_profiles_role_on_insert
BEFORE INSERT ON captain_profiles
FOR EACH ROW
WHEN (SELECT role FROM users WHERE id = NEW.user_id) <> 'captain'
BEGIN
  SELECT RAISE(ABORT, 'captain_profiles.user_id must reference a user with role = captain');
END;

CREATE TRIGGER trg_captain_profiles_role_on_update
BEFORE UPDATE ON captain_profiles
FOR EACH ROW
WHEN (SELECT role FROM users WHERE id = NEW.user_id) <> 'captain'
BEGIN
  SELECT RAISE(ABORT, 'captain_profiles.user_id must reference a user with role = captain');
END;

-- ----------------------------------------------------------------------------
-- otp_challenges — تفعيل OTP الفعلي (Captain phone verification فقط في هذه
-- المرحلة). الـ Hash بس هو المخزّن (otp_hash)، القيمة الخام ميتسجّلش في الـ
-- DB إطلاقًا — نفس منطق sessions.token_hash في 002_auth.sql.
-- ----------------------------------------------------------------------------
CREATE TABLE otp_challenges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  otp_hash      TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at    TEXT NOT NULL,
  consumed_at   TEXT NULL,
  purpose       TEXT NOT NULL CHECK (purpose = 'phone_verification')
);

CREATE INDEX idx_otp_challenges_user_id ON otp_challenges(user_id);
