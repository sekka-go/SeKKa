-- ============================================================================
-- SeKKa | سِكَّة — Migration 008: Password Change (Phase 8)
--
-- ممنوع تعديل 001_init.sql إلى 007_admin_rbac.sql. هذا الملف نفسه ممنوع
-- تعديله بعد ما يتنفّذ فعليًا — أي تعديل لاحق لازم يكون 009_....
--
-- التغييرات:
--   - users.password_changed_at: عمود جديد (TEXT NULL). مفيش CHECK ومفيش
--     NOT NULL هنا، فـ ALTER TABLE ADD COLUMN عادي كفاية — مفيش داعي
--     لـ rebuild الجدول زي 002_auth.sql/007_admin_rbac.sql (ده بس لازم لما
--     العمود الجديد NOT NULL بدون Default أو لما فيه CHECK constraint جديد
--     على الجدول كله، ومفيش حاجة من دول هنا).
--   - NULL يعني "لسه زي ما اتسجّل أول مرة" (register عادي أو Bootstrap admin
--     المزروع في 007) — مش قيمة إجبارية، مجرد توثيق "آخر مرة اتغيّرت فيها
--     كلمة السر فعليًا" لو حصل.
-- ============================================================================

ALTER TABLE users ADD COLUMN password_changed_at TEXT NULL;
