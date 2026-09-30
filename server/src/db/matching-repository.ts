import type { DatabaseSync } from "node:sqlite";

const EARTH_RADIUS_KM = 6371;

/**
 * صيغة Haversine — المسافة الجغرافية بالكيلومتر (km) بين نقطتين (lat/lng
 * بالدرجات). قرار عامة 2 لسه سارية: حساب محلي بحت، مفيش أي API خرائط
 * مدفوع. الوحدة: كيلومتر دايمًا.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export interface EligibleCaptain {
  user_id: number;
  current_lat: number;
  current_lng: number;
  captain_created_at: string;
}

/**
 * كباتن مؤهلين فعليًا لنوع مركبة معين (vehicle_type_id بتاع service_category
 * المطلوبة في الـ Request)، قبل أي ترتيب بالمسافة. شروط الأهلية (كلها من
 * قرارات المالك الصريحة أو من الـ Schema الموجود فعلًا، مفيش قاعدة مخترعة):
 *   - verification_status = 'approved' بس (قرار صريح من المالك).
 *   - vehicle_type_id بيطابق المطلوب (أهلية موجودة أصلًا في الـ Schema).
 *   - current_lat/current_lng مش NULL (موقع حالي صالح — قرار صريح من
 *     المالك، مفيش Fallback لموقع تاني).
 *   - Capacity: عدد الـ Matches النشطة بتاعته (الطلبات المرتبطة لسه
 *     status='matched') أقل من vehicle_types.capacity_max بتاع نوع مركبته.
 *     مفهوم "Capacity" موجود أصلًا في 001_init.sql (vehicle_types.capacity_max)
 *     — استخدامه هنا كحد أقصى للـ Matches المتزامنة بتاع كل كابتن قرار
 *     تفسير موثّق في HANDOFF.md (مش اختراع مفهوم جديد)، لأن النطاق الحالي
 *     مفيش فيه أي مسار لإنهاء رحلة (Trip completion) فتفضل شاغلة Capacity
 *     لحد ما مرحلة لاحقة تضيف ده — قيد معروف وموثّق.
 *
 * ملحوظة: قاعدة ac_rule بتاعة service_categories (تكييف إجباري/بدون/اختياري)
 * ماتتفحصش هنا لأن captain_profiles مفيش فيها عمود يسجّل هل مركبة الكابتن
 * فيها تكييف فعليًا ولا لأ — قيد معروف موثّق في HANDOFF.md، مش تجاهل صامت
 * ولا قاعدة مخترعة.
 */
export function findEligibleCaptains(
  db: DatabaseSync,
  requiredVehicleTypeId: string,
): EligibleCaptain[] {
  const rows = db
    .prepare(
      `SELECT cp.user_id AS user_id,
              cp.current_lat AS current_lat,
              cp.current_lng AS current_lng,
              cp.created_at AS captain_created_at
       FROM captain_profiles cp
       JOIN vehicle_types vt ON vt.id = cp.vehicle_type_id
       WHERE cp.verification_status = 'approved'
         AND cp.vehicle_type_id = ?
         AND cp.current_lat IS NOT NULL
         AND cp.current_lng IS NOT NULL
         AND (
           SELECT COUNT(*)
           FROM matches m
           JOIN daily_commute_requests dcr ON dcr.id = m.daily_commute_request_id
           WHERE m.captain_user_id = cp.user_id AND dcr.status = 'matched'
         ) < vt.capacity_max`,
    )
    .all(requiredVehicleTypeId) as unknown as EligibleCaptain[];
  return rows.map((row) => ({ ...row }));
}

export interface MatchRecord {
  id: number;
  daily_commute_request_id: number;
  captain_user_id: number;
  distance_km: number;
  matched_at: string;
}

const MATCH_SELECT_COLUMNS = `id, daily_commute_request_id, captain_user_id, distance_km, matched_at`;

export function findMatchById(db: DatabaseSync, id: number): MatchRecord | null {
  const row = db
    .prepare(`SELECT ${MATCH_SELECT_COLUMNS} FROM matches WHERE id = ?`)
    .get(id) as unknown as MatchRecord | undefined;
  return row ? { ...row } : null;
}

export function findMatchByRequestId(
  db: DatabaseSync,
  requestId: number,
): MatchRecord | null {
  const row = db
    .prepare(`SELECT ${MATCH_SELECT_COLUMNS} FROM matches WHERE daily_commute_request_id = ?`)
    .get(requestId) as unknown as MatchRecord | undefined;
  return row ? { ...row } : null;
}

export interface InsertMatchInput {
  daily_commute_request_id: number;
  captain_user_id: number;
  distance_km: number;
}

/**
 * بترمي أي خطأ SQLite زي هو (UNIQUE على daily_commute_request_id، الـ
 * Trigger اللي بيمنع Match لطلب مش open، أو الـ Trigger اللي بيمنع
 * captain_user_id لغير role='captain') — نفس نمط createDailyCommuteRequest.
 * المسؤولية على الكود اللي بينادي الدالة دي (matching engine) إنه يفسّرها.
 */
export function insertMatch(db: DatabaseSync, input: InsertMatchInput): MatchRecord {
  const result = db
    .prepare(
      `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km)
       VALUES (?, ?, ?)`,
    )
    .run(input.daily_commute_request_id, input.captain_user_id, input.distance_km);

  const created = findMatchById(db, Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("فشل غير متوقع بعد إنشاء الـ Match.");
  }
  return created;
}
