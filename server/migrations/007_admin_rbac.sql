-- ============================================================================
-- SeKKa | سِكَّة — Migration 007: Admin & RBAC + Analytics (Phase 7)
--
-- ممنوع تعديل 001_init.sql إلى 006_trip_payment.sql. هذا الملف نفسه ممنوع
-- تعديله بعد ما يتنفّذ فعليًا — أي تعديل لاحق لازم يكون 008_....
--
-- التغييرات:
--   1. users.role: إضافة 'admin' كقيمة مسموحة تالتة (كانت rider/captain بس).
--      نفس نمط "rebuild الجدول" بتاع 002_auth.sql بالظبط — SQLite مايسمحش
--      بتعديل CHECK constraint موجود عبر ALTER TABLE. تسجيل حساب Admin
--      بالـ role ده مش متاح عبر POST /auth/register (لسه محصور rider/
--      captain هناك عمدًا) — حساب Admin واحد بس بيتزرع هنا (Bootstrap)،
--      وأي Admin إضافي لازم يتزرع بنفس الطريقة (Migration جديدة) لحد ما
--      تتضاف واجهة "Admin بيعمل Admin تاني" في مرحلة لاحقة لو اتقرر.
--   2. payment_status_events.adjusted_amount: عمود جديد (نطاقه الأصلي
--      NULL)، بيتسجّل بس لحظة to_status='adjusted' — المبلغ الجديد بعد
--      تعديل الأدمن، منفصل عن payments.amount الأصلي (اللي فضل زي ما هو،
--      Append-only، مش بيتلمس — "الحقيقة" التاريخية إن الكابتن بلّغ بالمبلغ
--      ده أصلًا تفضل موجودة دايمًا).
--   3. Triggers جديدة (دفاع طبقة ثانية، نفس نمط كل المراحل):
--      - أي حدث to_status IN ('resolved','adjusted','voided') (فعل إداري)
--        لازم from_status بتاعه يكون 'disputed' بالظبط — مفيش Admin يقدر
--        يحل/يعدّل/يلغي مبلغ لسه مش متعارض عليه.
--      - نفس الحدث ده لازم actor_user_id يكون مستخدم role='admin' فعليًا
--        (مش NULL، ومش أي مستخدم تاني) — دفاع إضافي فوق requireRole في
--        الكود.
--      - to_status='adjusted' لازم adjusted_amount يكون له قيمة (مش NULL).
--      - captain_profiles.verification_status: ممنوع تحديث "بلا فايدة"
--        (نفس القيمة القديمة) — بيرفض الـ No-op بدل ما يعدّي بصمت.
-- ============================================================================

PRAGMA foreign_keys = OFF;

-- ----------------------------------------------------------------------------
-- users: rebuild لإضافة 'admin' للـ CHECK. legacy_alter_table لازم يكون ON
-- وقت الـ DROP/RENAME هنا بالذات: بدونه SQLite بيحاول "يصلّح" تلقائيًا نص
-- أي Trigger على جدول تاني بيشاور على users بالاسم (زي
-- trg_captain_profiles_role_on_insert/_on_update بتوع 003_captain_profile.sql)
-- وقت الـ Rename، وده بيفشل هنا لأن الجدول القديم اتشال فعلًا قبل الـ Rename
-- (تشخيص فعلي، مش تخمين — نفس الخطأ اتكرر في وقت التطوير قبل ما القرار ده
-- يتاخد). legacy_alter_table=ON بيوقف "الإصلاح التلقائي" ده، فالـ Rename
-- بيبقى عملية بسيطة (تغيير اسم بس) زي ما 002_auth.sql عمل بالظبط قبل ما فيه
-- أي Trigger على جدول تاني يشاور على users أصلًا.
-- ----------------------------------------------------------------------------
PRAGMA legacy_alter_table = ON;

CREATE TABLE users_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name      TEXT NOT NULL,
  phone_number   TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('rider', 'captain', 'admin')),
  verified_at    TEXT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO users_new (id, full_name, phone_number, password_hash, role, verified_at, created_at)
SELECT id, full_name, phone_number, password_hash, role, verified_at, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

PRAGMA legacy_alter_table = OFF;
PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- Bootstrap admin — حساب Admin واحد بس، مزروع مباشرة (مش عبر /auth/register
-- اللي لسه محصور rider/captain عمدًا). كلمة السر Placeholder صريح، لازم
-- تتغيّر فورًا في أي بيئة إنتاج فعلية — موثّق هنا بدل ما يتم افتراضه ضمنيًا.
-- الـ Hash اتولّد بنفس دالة hashPassword() بالظبط (scrypt، src/security/
-- password.ts) لكلمة السر "ChangeMe_Admin_2026!" — salt عشوائي، مش Hardcoded
-- بمعنى قابل للتخمين، لكنه معروف هنا عمدًا عشان صاحب النظام يقدر يدخل أول
-- مرة ويغيّرها (مفيش Endpoint لتغيير كلمة سر لسه في أي Phase، قيد معروف).
-- ----------------------------------------------------------------------------
INSERT INTO users (full_name, phone_number, password_hash, role, verified_at)
VALUES (
  'مدير النظام (Placeholder — غيّر كلمة السر دي فورًا)',
  '+20000000000',
  '5c4b37273676cd9d6d5f6e5402556609:c62222ced38e3b3541892ded22761ecafac9f73cfc06ecf4a65828b1dc956ef8644dcaab6259639159a3cf621b7e6094cc804c2f78c4230a03f41f9fbe200310',
  'admin',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

-- ----------------------------------------------------------------------------
-- payment_status_events.adjusted_amount — المبلغ الجديد بعد تعديل الأدمن،
-- بس لحظة to_status='adjusted' (الـ Trigger تحت بيفرض ده). payments.amount
-- الأصلي فاضل زي ما هو دايمًا (Append-only محفوظة حرفيًا، راجع
-- 006_trip_payment.sql).
-- ----------------------------------------------------------------------------
ALTER TABLE payment_status_events
  ADD COLUMN adjusted_amount REAL NULL CHECK (adjusted_amount IS NULL OR adjusted_amount >= 0);

-- ============================================================================
-- Triggers — دفاع طبقة ثانية (نفس نمط كل المراحل اللي فاتت)
-- ============================================================================

-- أي فعل إداري (resolve/adjust/void) لازم يبدأ من حالة 'disputed' بالظبط —
-- مفيش Admin يقدر يتصرّف في مبلغ Confirmed عادي لسه مفيش اعتراض عليه.
CREATE TRIGGER trg_payment_status_events_admin_actions_require_disputed
BEFORE INSERT ON payment_status_events
FOR EACH ROW
WHEN NEW.to_status IN ('resolved', 'adjusted', 'voided')
  AND NEW.from_status <> 'disputed'
BEGIN
  SELECT RAISE(ABORT, 'admin actions (resolve/adjust/void) require the payment to currently be disputed');
END;

-- نفس الفعل الإداري لازم actor_user_id يكون مستخدم role='admin' فعليًا في
-- users وقت الإدخال — دفاع إضافي فوق requireRole(db, 'admin') في الكود.
CREATE TRIGGER trg_payment_status_events_admin_actions_require_admin_actor
BEFORE INSERT ON payment_status_events
FOR EACH ROW
WHEN NEW.to_status IN ('resolved', 'adjusted', 'voided')
  AND (
    NEW.actor_user_id IS NULL
    OR (SELECT role FROM users WHERE id = NEW.actor_user_id) <> 'admin'
  )
BEGIN
  SELECT RAISE(ABORT, 'admin actions (resolve/adjust/void) require a real admin actor');
END;

-- to_status='adjusted' من غير adjusted_amount ممنوع — مفيش "تعديل" بلا رقم.
CREATE TRIGGER trg_payment_status_events_adjusted_requires_amount
BEFORE INSERT ON payment_status_events
FOR EACH ROW
WHEN NEW.to_status = 'adjusted' AND NEW.adjusted_amount IS NULL
BEGIN
  SELECT RAISE(ABORT, 'an adjusted payment status event requires adjusted_amount');
END;

-- تحديث verification_status لنفس القيمة القديمة (No-op) ممنوع — بيرفض
-- بدل ما يعدّي بصمت من غير أي تأثير فعلي (دفاع إضافي، مش تفعيل جديد).
CREATE TRIGGER trg_captain_profiles_verification_no_noop_update
BEFORE UPDATE OF verification_status ON captain_profiles
FOR EACH ROW
WHEN NEW.verification_status = OLD.verification_status
BEGIN
  SELECT RAISE(ABORT, 'verification_status update must actually change the value');
END;
