-- ============================================================================
-- SeKKa | سِكَّة — Migration 001: Init (Phase 1 — DB + Config Domain)
--
-- قواعد ثابتة لهذا الملف ولأي Migration لاحق:
--   - ممنوع تعديل هذا الملف بعد ما يتنفذ فعليًا على أي بيئة. أي تعديل DB لاحق
--     لازم يكون ملف Migration جديد مرقّم (002_..., 003_..., ...).
--   - الجداول المُنشأة هنا: فقط الـ Core Data Domain المطلوب فعليًا في Phase 1
--     والمراحل القريبة الجاية (users بأعمدة أساسية، vehicle_types،
--     service_categories). باقي الجداول (services, bookings, payments, ...)
--     تُنشأ في مرحلتها الخاصة — مفيش جداول زيادة هنا.
--   - فئة "Elite" مستبعدة نهائيًا (قرار Phase 0 المُلزم، راجع INVENTORY.md §2).
--     الحماية هنا على مستوى الـ DB بطبقتين: CHECK constraint صريح يمنع أي صف
--     كوده "elite" (بأي حالة أحرف)، + trigger دفاع ثانٍ في المرحلة الجاية (تحت)
--     يمنع max_seats من تخطي capacity_max المرتبط.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- users — أعمدة أساسية فقط. استراتيجية الـ Auth/الأعمدة الإضافية (password
-- hash, role, verification, ...) هتتقرر وتُضاف في Phase 2 كـ Migration جديد
-- (002_...)، مش هنا.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT NOT NULL,
  phone_number  TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- vehicle_types — Backend-controlled config. بيانات ابتدائية (Seed) فقط في
-- هذه المرحلة، مفيش Endpoint لإضافة/تعديل صفوف منها من الفرونت.
-- ----------------------------------------------------------------------------
CREATE TABLE vehicle_types (
  id             TEXT PRIMARY KEY
                   CHECK (lower(id) <> 'elite'),
  name_ar        TEXT NOT NULL
                   CHECK (lower(name_ar) NOT LIKE '%elite%'),
  capacity_max   INTEGER NOT NULL CHECK (capacity_max > 0),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- service_categories — Backend-controlled config، مرتبطة بـ vehicle_types.
-- ac_rule: none (بدون تكييف) | required (تكييف إجباري) | optional (اختياري).
-- ----------------------------------------------------------------------------
CREATE TABLE service_categories (
  id              TEXT PRIMARY KEY
                    CHECK (lower(id) <> 'elite'),
  vehicle_type_id TEXT NOT NULL
                    REFERENCES vehicle_types(id),
  name_ar         TEXT NOT NULL
                    CHECK (lower(name_ar) NOT LIKE '%elite%'),
  max_seats       INTEGER NOT NULL CHECK (max_seats > 0),
  ac_rule         TEXT NOT NULL CHECK (ac_rule IN ('none', 'required', 'optional')),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- دفاع الطبقة الثانية (Triggers): ممنوع أي service_category.max_seats يتخطى
-- capacity_max بتاع الـ vehicle_type المرتبط بيه — سواء عند الإدخال أو أي
-- تحديث لاحق يكسر نفس القاعدة (حتى لو التحديث على العمود ده أو حتى لو
-- vehicle_type.capacity_max اتغيّر لاحقًا بشكل يكسر صف قائم).
-- ----------------------------------------------------------------------------
CREATE TRIGGER trg_service_categories_capacity_on_insert
BEFORE INSERT ON service_categories
FOR EACH ROW
WHEN NEW.max_seats > (
  SELECT capacity_max FROM vehicle_types WHERE id = NEW.vehicle_type_id
)
BEGIN
  SELECT RAISE(ABORT, 'service_categories.max_seats exceeds vehicle_types.capacity_max');
END;

CREATE TRIGGER trg_service_categories_capacity_on_update
BEFORE UPDATE ON service_categories
FOR EACH ROW
WHEN NEW.max_seats > (
  SELECT capacity_max FROM vehicle_types WHERE id = NEW.vehicle_type_id
)
BEGIN
  SELECT RAISE(ABORT, 'service_categories.max_seats exceeds vehicle_types.capacity_max');
END;

-- لو vehicle_types.capacity_max اتحدّث لاحقًا بقيمة أصغر من max_seats بتاع
-- أي service_category مرتبطة بيه، امنع التحديث ده كمان (نفس القاعدة، اتجاه
-- عكسي).
CREATE TRIGGER trg_vehicle_types_capacity_on_update
BEFORE UPDATE ON vehicle_types
FOR EACH ROW
WHEN NEW.capacity_max < (
  SELECT COALESCE(MAX(max_seats), 0) FROM service_categories WHERE vehicle_type_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'vehicle_types.capacity_max would violate an existing service_categories.max_seats');
END;

-- ----------------------------------------------------------------------------
-- Seed data — مصفوفة المركبات النهائية فقط (القسم 3 من القواعد العامة).
-- لا Elite. بيانات ثابتة (Backend-controlled)، مش Sample/Test data.
-- ----------------------------------------------------------------------------
INSERT INTO vehicle_types (id, name_ar, capacity_max) VALUES
  ('private_car', 'ملاكي', 3),
  ('hiace',       'هاي إس', 14);

INSERT INTO service_categories (id, vehicle_type_id, name_ar, max_seats, ac_rule) VALUES
  ('faster', 'private_car', 'فاستر', 3, 'none'),
  ('plus',   'private_car', 'بلس',   3, 'required'),
  ('saver',  'hiace',       'سيفر',  14, 'optional');
