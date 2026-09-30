import type { DatabaseSync } from "node:sqlite";

export type CommuteRequestStatus = "open" | "matched" | "cancelled" | "expired";

export interface DailyCommuteRequestRecord {
  id: number;
  rider_user_id: number;
  service_category_id: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  requested_at: string;
  status: CommuteRequestStatus;
  created_at: string;
}

export interface CreateDailyCommuteRequestInput {
  rider_user_id: number;
  service_category_id: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
}

const SELECT_COLUMNS = `id, rider_user_id, service_category_id, pickup_lat, pickup_lng,
       dropoff_lat, dropoff_lng, requested_at, status, created_at`;

export function findDailyCommuteRequestById(
  db: DatabaseSync,
  id: number,
): DailyCommuteRequestRecord | null {
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM daily_commute_requests WHERE id = ?`)
    .get(id) as unknown as DailyCommuteRequestRecord | undefined;
  return row ? { ...row } : null;
}

/** طلبات المستخدم نفسه بس، الأحدث الأول. */
export function findDailyCommuteRequestsByRiderId(
  db: DatabaseSync,
  riderUserId: number,
): DailyCommuteRequestRecord[] {
  const rows = db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM daily_commute_requests
       WHERE rider_user_id = ? ORDER BY id DESC`,
    )
    .all(riderUserId) as unknown as DailyCommuteRequestRecord[];
  return rows.map((row) => ({ ...row }));
}

/**
 * بترمي أي خطأ SQLite زي هو (FK على service_category_id، الـ Trigger اللي
 * بيمنع أي rider_user_id مش role=rider، أو أي CHECK على مدى lat/lng) — نفس
 * نمط createCaptainProfile في Phase 3، الـ Route هو اللي يفسّرها لرسالة
 * عربية. status مش من مدخلات هذه الدالة إطلاقًا — دايمًا DEFAULT 'open' من
 * الـ Schema نفسه.
 */
export function createDailyCommuteRequest(
  db: DatabaseSync,
  input: CreateDailyCommuteRequestInput,
): DailyCommuteRequestRecord {
  const result = db
    .prepare(
      `INSERT INTO daily_commute_requests
         (rider_user_id, service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.rider_user_id,
      input.service_category_id,
      input.pickup_lat,
      input.pickup_lng,
      input.dropoff_lat,
      input.dropoff_lng,
    );

  const created = findDailyCommuteRequestById(db, Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("فشل غير متوقع بعد إنشاء الطلب.");
  }
  return created;
}

/**
 * يغيّر status لـ 'cancelled' — بس لو الطلب لسه 'open' فعليًا وقت التنفيذ
 * (WHERE status = 'open' في نفس الاستعلام، مش فحص منفصل قبله، عشان نتجنب
 * Race condition بين الفحص والتحديث). بيرجّع true لو فعليًا اتلغى دلوقتي.
 * التحقق من ملكية الطلب (rider_user_id) مسؤولية الـ Route قبل ما يستدعي دي.
 */
export function cancelOpenDailyCommuteRequest(db: DatabaseSync, id: number): boolean {
  const result = db
    .prepare(`UPDATE daily_commute_requests SET status = 'cancelled' WHERE id = ? AND status = 'open'`)
    .run(id);
  return result.changes > 0;
}
