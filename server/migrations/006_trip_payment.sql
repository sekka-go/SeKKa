-- ============================================================================
-- SeKKa | سِكَّة — Migration 006: Trip Lifecycle + Payment Ledger (Phase 6)
--
-- ممنوع تعديل 001_init.sql إلى 005_matching.sql. هذا الملف نفسه ممنوع
-- تعديله بعد ما يتنفّذ فعليًا — أي تعديل لاحق لازم يكون 007_....
--
-- قرارات المالك الصريحة لهذه المرحلة (تفاصيل كاملة في HANDOFF.md):
--   1. Trip Completion trigger = الكابتن بيدوس "Done" عند آخر Stop، مش
--      أوتوماتيك ولا الراكب.
--   2. الـ Ledger بيتعمل لحظة إقفال الرحلة (trip.status = 'completed')،
--      مش لحظة الـ Match.
--   3. التأكيد نظامي أوتوماتيك (مش الراكب) — النظام نفسه يأكد المبلغ في نفس
--      لحظة إقفال الرحلة (نفس الـ Transaction)، الراكب يقدر يعترض بس.
--   4. التسعير مش نهائي — Placeholder مؤقت خلف calculateFare() واحدة قابلة
--      للاستبدال، مش قرار نهائي (راجع NEXT_PROMPT.md، Pricing Proposal Log).
--
-- تفسير موثّق (مش اختراع، راجع HANDOFF.md لتفاصيل كل قرار):
--   - "Ledger واحد بس لكل Trip" (trip_id UNIQUE في payments) + "Append-only
--     بالكامل" اتفسّروا سوا كالتالي: صف payments نفسه غير قابل للتعديل/الحذف
--     إطلاقًا بعد إنشائه (Triggers تحت)، وأي انتقال حالة لاحق (Confirmed →
--     Disputed → Resolved/Adjusted/Voided) بيتسجل كصف جديد في
--     payment_status_events (تاريخ الأحداث، مرتبط بـ payment_id مش trip_id،
--     فمفيش تعارض مع الـ UNIQUE). "الحالة الحالية" = آخر صف في
--     payment_status_events لنفس الـ payment، أو 'confirmed' افتراضيًا لو
--     مفيش صفوف لسه (لأن الإدخال الأول في payments نفسه دايمًا Confirmed
--     أوتوماتيك من لحظة إنشائه — مفيش حالة "Reported" منفصلة كصف قائم بذاته،
--     لأن الإبلاغ والتأكيد بيحصلوا في نفس الـ Transaction بالظبط زي ما قرر
--     المالك).
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- trips — نقطة واحدة لكل Match (Phase 5). بيتعمل تلقائيًا (Trigger تحت) لحظة
-- إنشاء أي match، status='in_progress' من البداية — مفيش مسار تاني لإنشاء
-- trip غير كده.
-- ----------------------------------------------------------------------------
CREATE TABLE trips (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id             INTEGER NOT NULL UNIQUE REFERENCES matches(id),
  status               TEXT NOT NULL CHECK (status IN ('in_progress', 'completed'))
                         DEFAULT 'in_progress',
  started_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  completed_at         TEXT NULL,
  total_distance_km    REAL NULL CHECK (total_distance_km IS NULL OR total_distance_km >= 0),
  total_amount         REAL NULL CHECK (total_amount IS NULL OR total_amount >= 0)
);

-- ----------------------------------------------------------------------------
-- trip_stops — نقطتين بس للـ MVP دي (1=pickup، 2=dropoff)، منسوخة من
-- daily_commute_requests وقت إنشاء الـ Trip (مش مرجع حي — لو الطلب اتغيّر
-- بعد كده مفيش تأثير على رحلة اتبدأت أصلًا، مفيش مسار تعديل طلب بعد الـ Match
-- أصلًا في النطاق الحالي).
-- ----------------------------------------------------------------------------
CREATE TABLE trip_stops (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id       INTEGER NOT NULL REFERENCES trips(id),
  sequence      INTEGER NOT NULL CHECK (sequence IN (1, 2)),
  lat           REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng           REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  reached_at    TEXT NULL,
  fare_at_stop  REAL NULL CHECK (fare_at_stop IS NULL OR fare_at_stop >= 0),
  UNIQUE (trip_id, sequence)
);

CREATE INDEX idx_trip_stops_trip_id ON trip_stops(trip_id);

-- ----------------------------------------------------------------------------
-- pricing_config — Placeholder مؤقت (Proposal رقم 1 من Pricing Proposal Log،
-- NEXT_PROMPT.md بتاع Phase 5) لحد ما المالك يختار لوجيك نهائي. قابل للتعديل
-- من Admin لاحقًا (Phase 7) — مفيش Endpoint تعديل في هذه المرحلة، Seed بس.
-- خلف دالة calculateFare() واحدة قابلة للاستبدال بالكامل (src/pricing/fare.ts).
-- ----------------------------------------------------------------------------
CREATE TABLE pricing_config (
  vehicle_type_id  TEXT PRIMARY KEY REFERENCES vehicle_types(id),
  base_fee         REAL NOT NULL CHECK (base_fee >= 0),
  rate_per_km      REAL NOT NULL CHECK (rate_per_km >= 0),
  rate_per_min     REAL NOT NULL CHECK (rate_per_min >= 0),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- أرقام تقديرية بحتة (EGP)، Placeholder صريح مش قرار مالك نهائي — راجع
-- Pricing Proposal Log لتفاصيل ليه الأرقام دي بالذات.
INSERT INTO pricing_config (vehicle_type_id, base_fee, rate_per_km, rate_per_min) VALUES
  ('private_car', 10.0, 3.5, 0.5),
  ('hiace',       15.0, 5.0, 0.75);

-- ----------------------------------------------------------------------------
-- payments — Ledger. صف واحد بس لكل Trip (UNIQUE trip_id)، غير قابل للتعديل/
-- الحذف بعد إنشائه (Triggers تحت). بيتعمل بس في لحظة إقفال الرحلة، دايمًا
-- بواسطة الكابتن كمُبلِّغ، ودايمًا "Confirmed" أوتوماتيك من نفس لحظة
-- الإدخال (النظام هو المؤكِّد، مفيش confirmed_by_user_id بشري — قرار المالك
-- صراحة، راجع الشرح فوق).
-- ----------------------------------------------------------------------------
CREATE TABLE payments (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id               INTEGER NOT NULL UNIQUE REFERENCES trips(id),
  amount                REAL NOT NULL CHECK (amount >= 0),
  reported_by_user_id   INTEGER NOT NULL REFERENCES users(id),
  reported_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  confirmed_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- payment_status_events — سجل تاريخي Append-only لأي انتقال حالة بعد الإنشاء
-- الأولي (Confirmed → Disputed → Resolved/Adjusted/Voided). actor_user_id
-- NULL يعني النظام نفسه (التأكيد الأول)، مش أي مستخدم بشري.
-- ----------------------------------------------------------------------------
CREATE TABLE payment_status_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id      INTEGER NOT NULL REFERENCES payments(id),
  from_status     TEXT NOT NULL
                    CHECK (from_status IN ('confirmed', 'disputed', 'resolved', 'adjusted', 'voided')),
  to_status       TEXT NOT NULL
                    CHECK (to_status IN ('confirmed', 'disputed', 'resolved', 'adjusted', 'voided')),
  actor_user_id   INTEGER NULL REFERENCES users(id),
  reason          TEXT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_payment_status_events_payment_id ON payment_status_events(payment_id);

-- ============================================================================
-- Triggers — دفاع طبقة ثانية (نفس نمط كل المراحل اللي فاتت)
-- ============================================================================

-- بعد أي match جديد (Phase 5)، اتعمل تلقائيًا trip واحد + trip_stops (pickup،
-- dropoff) منسوخة من الـ daily_commute_request المرتبطة، بدون أي كود تطبيق
-- إضافي — Trip موجود دايمًا لحظة الـ Match، مفيش حالة "مفيش trip" ممكنة.
CREATE TRIGGER trg_matches_creates_trip_on_insert
AFTER INSERT ON matches
FOR EACH ROW
BEGIN
  INSERT INTO trips (match_id) VALUES (NEW.id);

  INSERT INTO trip_stops (trip_id, sequence, lat, lng)
  SELECT (SELECT id FROM trips WHERE match_id = NEW.id), 1, dcr.pickup_lat, dcr.pickup_lng
  FROM daily_commute_requests dcr
  WHERE dcr.id = NEW.daily_commute_request_id;

  INSERT INTO trip_stops (trip_id, sequence, lat, lng)
  SELECT (SELECT id FROM trips WHERE match_id = NEW.id), 2, dcr.dropoff_lat, dcr.dropoff_lng
  FROM daily_commute_requests dcr
  WHERE dcr.id = NEW.daily_commute_request_id;
END;

-- ترتيب الـ Stops لازم يتم بالتسلسل: Stop رقم 2 مايتسجّلش reached_at قبل ما
-- Stop رقم 1 بتاع نفس الرحلة يوصله الأول.
CREATE TRIGGER trg_trip_stops_sequence_order
BEFORE UPDATE OF reached_at ON trip_stops
FOR EACH ROW
WHEN NEW.reached_at IS NOT NULL
  AND NEW.sequence > 1
  AND (
    SELECT reached_at FROM trip_stops
    WHERE trip_id = NEW.trip_id AND sequence = NEW.sequence - 1
  ) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'trip_stops must be reached in sequence order');
END;

-- مفيش إقفال Trip (status='completed') قبل ما كل الـ Stops بتاعته توصل
-- (reached_at مش NULL لكل صف).
CREATE TRIGGER trg_trips_complete_requires_all_stops_reached
BEFORE UPDATE OF status ON trips
FOR EACH ROW
WHEN NEW.status = 'completed'
  AND OLD.status <> 'completed'
  AND EXISTS (
    SELECT 1 FROM trip_stops WHERE trip_id = NEW.id AND reached_at IS NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'all trip_stops must be reached before completing a trip');
END;

-- Payment Ledger بيتعمل بس لو الـ Trip المرتبطة 'completed' فعليًا وقت
-- الإدخال — مش قبل الإقفال بأي حال.
CREATE TRIGGER trg_payments_trip_must_be_completed_on_insert
BEFORE INSERT ON payments
FOR EACH ROW
WHEN (SELECT status FROM trips WHERE id = NEW.trip_id) <> 'completed'
BEGIN
  SELECT RAISE(ABORT, 'payments can only be recorded for a completed trip');
END;

-- الـ Ledger الأساسي (payments) غير قابل للتعديل أو الحذف نهائيًا بعد
-- إنشائه — أي انتقال حالة لاحق لازم يكون صف جديد في payment_status_events.
CREATE TRIGGER trg_payments_no_update
BEFORE UPDATE ON payments
BEGIN
  SELECT RAISE(ABORT, 'payments ledger rows are append-only and cannot be updated');
END;

CREATE TRIGGER trg_payments_no_delete
BEFORE DELETE ON payments
BEGIN
  SELECT RAISE(ABORT, 'payments ledger rows are append-only and cannot be deleted');
END;

-- سجل تاريخ الحالات نفسه Append-only كمان — مفيش تعديل/حذف لأي حدث اتسجل.
CREATE TRIGGER trg_payment_status_events_no_update
BEFORE UPDATE ON payment_status_events
BEGIN
  SELECT RAISE(ABORT, 'payment_status_events rows are append-only and cannot be updated');
END;

CREATE TRIGGER trg_payment_status_events_no_delete
BEFORE DELETE ON payment_status_events
BEGIN
  SELECT RAISE(ABORT, 'payment_status_events rows are append-only and cannot be deleted');
END;

-- دفاع إضافي (حتى لو مفيش مسار تأكيد يدوي حاليًا في التصميم): الطرف اللي
-- بلّغ عن المبلغ (الكابتن) ما يقدرش يبقى هو نفسه actor_user_id لحدث
-- to_status='confirmed' — التأكيد لازم يكون نظامي (actor_user_id IS NULL)
-- مش بشري، بالضبط زي ما اتقرر.
CREATE TRIGGER trg_payment_status_events_no_self_confirm
BEFORE INSERT ON payment_status_events
FOR EACH ROW
WHEN NEW.to_status = 'confirmed'
  AND NEW.actor_user_id IS NOT NULL
  AND NEW.actor_user_id = (SELECT reported_by_user_id FROM payments WHERE id = NEW.payment_id)
BEGIN
  SELECT RAISE(ABORT, 'the reporter cannot confirm their own payment report');
END;
