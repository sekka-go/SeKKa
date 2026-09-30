import type { DatabaseSync } from "node:sqlite";

/**
 * لوحة أرقام عامة للأدمن (Phase 7) — قراءة فقط، مفيش أي تعديل هنا. كل رقم
 * بيتحسب مباشرة من الجداول الموجودة (مفيش جدول Analytics منفصل مخزّن —
 * دايمًا Live من الـ Ledger/الجداول الأساسية، عشان محدش يقدر يشك في دقّته).
 */
export interface PlatformOverview {
  total_users: number;
  total_riders: number;
  total_captains: number;
  total_admins: number;
  captains_pending_verification: number;
  captains_approved: number;
  captains_rejected: number;
  total_trips_in_progress: number;
  total_trips_completed: number;
  /**
   * إجمالي الإيراد الفعلي (EGP) — مجموع المبلغ "الساري" لكل Payment (آخر
   * adjusted_amount لو اتعدّل، وإلا المبلغ الأصلي المبلَّغ)، ما عدا أي
   * Payment اتلغى (voided) نهائيًا — نفس منطق currentPaymentStatus() في
   * payment-repository.ts لكن محسوب بـ SQL هنا (الرقم بيتحسب على كل الصفوف
   * مش صف واحد، Query واحد أسرع من N استدعاء لدالة الـ TS).
   */
  total_revenue: number;
  /** عدد الـ Payments اللي اعترض عليها الراكب في أي وقت (حتى لو اتحلّت بعد كده). */
  disputed_payments_count_total: number;
  /** عدد الـ Payments اللي لسه Disputed فعليًا دلوقتي (محتاجة Admin يتصرف). */
  disputes_awaiting_admin: number;
}

// الحالة الحالية لأي Payment = آخر to_status في payment_status_events ليه،
// أو 'confirmed' افتراضيًا لو مفيش أي حدث لسه (نفس تعريف currentPaymentStatus
// بالظبط، راجع payment-repository.ts).
const CURRENT_STATUS_SUBQUERY = `
  COALESCE(
    (SELECT e.to_status FROM payment_status_events e
     WHERE e.payment_id = p.id ORDER BY e.id DESC LIMIT 1),
    'confirmed'
  )
`;

// المبلغ الساري = آخر adjusted_amount مسجّل (لو فيه حدث to_status='adjusted')،
// وإلا المبلغ الأصلي في payments.amount.
const EFFECTIVE_AMOUNT_SUBQUERY = `
  COALESCE(
    (SELECT e.adjusted_amount FROM payment_status_events e
     WHERE e.payment_id = p.id AND e.to_status = 'adjusted'
     ORDER BY e.id DESC LIMIT 1),
    p.amount
  )
`;

export function getPlatformOverview(db: DatabaseSync): PlatformOverview {
  const usersByRole = db
    .prepare(`SELECT role, COUNT(*) AS c FROM users GROUP BY role`)
    .all() as unknown as { role: string; c: number }[];
  const roleCounts = Object.fromEntries(usersByRole.map((r) => [r.role, r.c]));

  const captainsByStatus = db
    .prepare(`SELECT verification_status, COUNT(*) AS c FROM captain_profiles GROUP BY verification_status`)
    .all() as unknown as { verification_status: string; c: number }[];
  const verificationCounts = Object.fromEntries(
    captainsByStatus.map((r) => [r.verification_status, r.c]),
  );

  const tripsByStatus = db
    .prepare(`SELECT status, COUNT(*) AS c FROM trips GROUP BY status`)
    .all() as unknown as { status: string; c: number }[];
  const tripCounts = Object.fromEntries(tripsByStatus.map((r) => [r.status, r.c]));

  const revenueRow = db
    .prepare(
      `SELECT COALESCE(SUM(${EFFECTIVE_AMOUNT_SUBQUERY}), 0) AS total
       FROM payments p
       WHERE ${CURRENT_STATUS_SUBQUERY} <> 'voided'`,
    )
    .get() as unknown as { total: number };

  const disputedTotalRow = db
    .prepare(
      `SELECT COUNT(*) AS c FROM payments p
       WHERE EXISTS (
         SELECT 1 FROM payment_status_events e
         WHERE e.payment_id = p.id AND e.to_status = 'disputed'
       )`,
    )
    .get() as unknown as { c: number };

  const disputesOpenRow = db
    .prepare(`SELECT COUNT(*) AS c FROM payments p WHERE ${CURRENT_STATUS_SUBQUERY} = 'disputed'`)
    .get() as unknown as { c: number };

  return {
    total_users: (roleCounts.rider ?? 0) + (roleCounts.captain ?? 0) + (roleCounts.admin ?? 0),
    total_riders: roleCounts.rider ?? 0,
    total_captains: roleCounts.captain ?? 0,
    total_admins: roleCounts.admin ?? 0,
    captains_pending_verification: verificationCounts.pending ?? 0,
    captains_approved: verificationCounts.approved ?? 0,
    captains_rejected: verificationCounts.rejected ?? 0,
    total_trips_in_progress: tripCounts.in_progress ?? 0,
    total_trips_completed: tripCounts.completed ?? 0,
    total_revenue: revenueRow.total,
    disputed_payments_count_total: disputedTotalRow.c,
    disputes_awaiting_admin: disputesOpenRow.c,
  };
}
