import type { DatabaseSync } from "node:sqlite";

/**
 * حالة الـ Ledger الفعلية لأي Payment. مفيش 'reported' كصف قائم بذاته —
 * الإبلاغ والتأكيد النظامي بيحصلوا في نفس لحظة إنشاء صف payments (قرار
 * المالك: التطبيق نفسه بيأكد، مش الراكب)، فأول حالة "قابلة للملاحظة" دايمًا
 * confirmed. أي انتقال بعد كده (disputed/resolved/adjusted/voided) بيتسجل
 * كصف جديد في payment_status_events — راجع 006_trip_payment.sql.
 */
export type PaymentStatus = "confirmed" | "disputed" | "resolved" | "adjusted" | "voided";

export interface PaymentRecord {
  id: number;
  trip_id: number;
  amount: number;
  reported_by_user_id: number;
  reported_at: string;
  confirmed_at: string;
}

export interface PaymentStatusEventRecord {
  id: number;
  payment_id: number;
  from_status: PaymentStatus;
  to_status: PaymentStatus;
  actor_user_id: number | null;
  reason: string | null;
  // اتضاف في Phase 7 (007_admin_rbac.sql) — بس لحظة to_status='adjusted'،
  // NULL لغيرها. راجع 007_admin_rbac.sql للـ Trigger اللي بيفرض ده.
  adjusted_amount: number | null;
  created_at: string;
}

const PAYMENT_COLUMNS = `id, trip_id, amount, reported_by_user_id, reported_at, confirmed_at`;

export function findPaymentByTripId(db: DatabaseSync, tripId: number): PaymentRecord | null {
  const row = db
    .prepare(`SELECT ${PAYMENT_COLUMNS} FROM payments WHERE trip_id = ?`)
    .get(tripId) as unknown as PaymentRecord | undefined;
  return row ? { ...row } : null;
}

export function findPaymentById(db: DatabaseSync, id: number): PaymentRecord | null {
  const row = db
    .prepare(`SELECT ${PAYMENT_COLUMNS} FROM payments WHERE id = ?`)
    .get(id) as unknown as PaymentRecord | undefined;
  return row ? { ...row } : null;
}

/**
 * بترمي أي خطأ SQLite زي هو (UNIQUE على trip_id، أو الـ Trigger اللي بيمنع
 * الإدخال لو الرحلة لسه مش completed) — المسؤولية على الـ Route إنه يفسّرها.
 * الرحلة لازم تتقفل (completeTrip) في نفس الـ Transaction قبل الاستدعاء ده.
 */
export function insertPayment(
  db: DatabaseSync,
  input: { trip_id: number; amount: number; reported_by_user_id: number },
): PaymentRecord {
  const result = db
    .prepare(
      `INSERT INTO payments (trip_id, amount, reported_by_user_id) VALUES (?, ?, ?)`,
    )
    .run(input.trip_id, input.amount, input.reported_by_user_id);

  const created = findPaymentById(db, Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("فشل غير متوقع بعد إنشاء صف الـ Payment Ledger.");
  }
  return created;
}

/** آخر حدث حالة مسجّل لهذا الـ Payment، أو null لو لسه مفيش أي حدث. */
export function findLatestStatusEvent(
  db: DatabaseSync,
  paymentId: number,
): PaymentStatusEventRecord | null {
  const row = db
    .prepare(
      `SELECT id, payment_id, from_status, to_status, actor_user_id, reason, adjusted_amount, created_at
       FROM payment_status_events WHERE payment_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(paymentId) as unknown as PaymentStatusEventRecord | undefined;
  return row ? { ...row } : null;
}

/** كل تاريخ الحالات لهذا الـ Payment (الأقدم أولًا) — Admin محتاجها كاملة. */
export function findStatusEventsByPaymentId(
  db: DatabaseSync,
  paymentId: number,
): PaymentStatusEventRecord[] {
  const rows = db
    .prepare(
      `SELECT id, payment_id, from_status, to_status, actor_user_id, reason, adjusted_amount, created_at
       FROM payment_status_events WHERE payment_id = ? ORDER BY id ASC`,
    )
    .all(paymentId) as unknown as PaymentStatusEventRecord[];
  return rows.map((row) => ({ ...row }));
}

/** الحالة الحالية الفعلية للـ Payment (راجع تعليق PaymentStatus فوق). */
export function currentPaymentStatus(db: DatabaseSync, paymentId: number): PaymentStatus {
  const latest = findLatestStatusEvent(db, paymentId);
  return latest ? latest.to_status : "confirmed";
}

/**
 * بيسجّل انتقال حالة جديد (Append-only — صف جديد دايمًا، مفيش UPDATE على
 * صف قديم). بترمي أي خطأ SQLite زي هو (الـ Trigger اللي بيمنع المُبلِّغ من
 * تأكيد نفسه) — المسؤولية على الـ Route إنه يفسّرها.
 */
export function insertPaymentStatusEvent(
  db: DatabaseSync,
  input: {
    payment_id: number;
    from_status: PaymentStatus;
    to_status: PaymentStatus;
    actor_user_id: number | null;
    reason: string | null;
    // اختياري — بيتبعت بس مع to_status='adjusted' (الـ Trigger بيرفض لو
    // adjusted من غير قيمة، وبيرفض برضه لو أي to_status تاني اتبعتله قيمة
    // من غير قصد مش هيتفحص هنا، بس مش المتوقع من الـ Routes).
    adjusted_amount?: number | null;
  },
): PaymentStatusEventRecord {
  const result = db
    .prepare(
      `INSERT INTO payment_status_events
         (payment_id, from_status, to_status, actor_user_id, reason, adjusted_amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.payment_id,
      input.from_status,
      input.to_status,
      input.actor_user_id,
      input.reason,
      input.adjusted_amount ?? null,
    );

  const row = db
    .prepare(
      `SELECT id, payment_id, from_status, to_status, actor_user_id, reason, adjusted_amount, created_at
       FROM payment_status_events WHERE id = ?`,
    )
    .get(Number(result.lastInsertRowid)) as unknown as PaymentStatusEventRecord | undefined;
  if (!row) {
    throw new Error("فشل غير متوقع بعد تسجيل حدث تغيير حالة الدفع.");
  }
  return { ...row };
}
