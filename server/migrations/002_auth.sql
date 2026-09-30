-- ============================================================================
-- SeKKa | سِكَّة — Migration 002: Auth Domain (Phase 2)
--
-- ممنوع تعديل 001_init.sql. هذا الملف نفسه ممنوع تعديله بعد ما يتنفذ فعليًا —
-- أي تعديل لاحق لازم يكون 003_....
--
-- التغييرات:
--   - users: إضافة password_hash / role / verified_at. SQLite مايسمحش بإضافة
--     عمود NOT NULL بدون DEFAULT عبر ALTER TABLE ADD COLUMN (خصوصًا role اللي
--     محتاج CHECK بدون Default صراحة زي ما طُلب) — فبنعيد بناء الجدول بنمط
--     "rebuild": جدول جديد بالـ Schema الكامل، نقل أي صفوف موجودة (متوقّع
--     يكون صفر صف لأنه مفيش تسجيل كان موجود قبل كده في users)، حذف القديم،
--     إعادة تسمية الجديد. نفس الـ id/AUTOINCREMENT بيتحافظ عليه.
--   - role: CHECK (role IN ('rider', 'captain')) فقط — بدون Default، وبدون
--     أي قيمة زيادة (زي admin). ده برضه بيمنع "elite" تلقائيًا كقيمة role
--     (مش من القيم المسموحة أصلًا).
--   - verified_at: NULL دايمًا في هذه المرحلة (التفعيل الفعلي جزء من مرحلة
--     Captain Onboarding الخاصة، هنا بس بنجهّز العمود لاستخدامها لاحقًا).
--   - sessions: جدول جديد. الـ Token الخام نفسه ميتسجّلش في الـ DB إطلاقًا —
--     token_hash بس (SHA-256 هنا، منفصل عن scrypt المستخدم لكلمة السر لأنه
--     مش سرّي بنفس درجة كلمة السر ومحتاج بحث سريع عند كل Request محمي).
-- ============================================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name      TEXT NOT NULL,
  phone_number   TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('rider', 'captain')),
  verified_at    TEXT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- نقل أي صفوف قديمة (متوقّع صفر صف — users كانت من غير أي مسار تسجيل فعلي في
-- Phase 1). لو فيه صفوف فعلًا، هترفض هنا لأن password_hash/role مفيش لهم قيمة
-- مصدر — وده الصح (ميتقبلش صف Auth ناقص بصمت).
INSERT INTO users_new (id, full_name, phone_number, created_at)
SELECT id, full_name, phone_number, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- sessions — جلسة دخول واحدة لكل Token. الـ Middleware بيدوّر على token_hash
-- بس (SHA-256 للـ Token الخام اللي العميل بيبعته في Header).
-- ----------------------------------------------------------------------------
CREATE TABLE sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
