import type { DatabaseSync } from "node:sqlite";
import { findDailyCommuteRequestById } from "../db/booking-repository.js";
import { findServiceCategoryById } from "../db/config-repository.js";
import {
  findEligibleCaptains,
  findMatchByRequestId,
  haversineDistanceKm,
  insertMatch,
  type EligibleCaptain,
  type MatchRecord,
} from "../db/matching-repository.js";

export type MatchOutcome =
  | { outcome: "matched"; match: MatchRecord }
  | { outcome: "already_matched"; match: MatchRecord }
  | { outcome: "no_eligible_captain" }
  | { outcome: "not_open" }
  | { outcome: "not_found" };

interface RankedCaptain extends EligibleCaptain {
  distance_km: number;
}

/**
 * الترتيب بين الكباتن المؤهلين (بعد فلترة الأهلية بالكامل في
 * findEligibleCaptains — الدالة دي مش بتعيد فحص الأهلية، بس بترتّب):
 *   1. أقرب مسافة (Haversine, كيلومتر) لنقطة الـ Pickup.
 *   2. الأقدم تسجيلًا — captain_profiles.created_at (مفيش عمود "Availability"
 *      منفصل في الـ Schema الحالي، فده أقرب تفسير موجود فعلًا للمطلوب،
 *      موثّق في HANDOFF.md).
 *   3. captain_id (user_id) — Fallback نهائي حتمي، تصاعدي.
 * مفيش اختيار عشوائي في أي خطوة.
 */
export function rankEligibleCaptains(
  eligible: EligibleCaptain[],
  pickupLat: number,
  pickupLng: number,
): RankedCaptain[] {
  return eligible
    .map((captain) => ({
      ...captain,
      distance_km: haversineDistanceKm(
        pickupLat,
        pickupLng,
        captain.current_lat,
        captain.current_lng,
      ),
    }))
    .sort((a, b) => {
      if (a.distance_km !== b.distance_km) return a.distance_km - b.distance_km;
      if (a.captain_created_at !== b.captain_created_at) {
        return a.captain_created_at < b.captain_created_at ? -1 : 1;
      }
      return a.user_id - b.user_id;
    });
}

/**
 * الـ Matching Engine الأوحد والمعتمد (قرار عامة 5 — Server-Authoritative،
 * ومفيش تكرار لمنطق الـ Matching في أكتر من مكان). Automatic بالكامل، مفيش
 * خطوة موافقة كابتن (قرار #1 من المالك).
 *
 * Atomicity/Idempotency:
 *   - كل حاجة جوه Transaction واحدة (BEGIN IMMEDIATE/COMMIT/ROLLBACK) —
 *     فحص حالة الطلب، فلترة/ترتيب الكباتن، والإدخال في matches كلهم في نفس
 *     الـ Transaction، فمفيش فجوة بين "الفحص" و"الإدخال" حتى لو استُدعيت
 *     الدالة دي أكتر من مرة على التوازي.
 *   - ملحوظة معمارية موثّقة: node:sqlite في هذا الـ Stack synchronous بالكامل
 *     (مفيش await جوه الدالة دي إطلاقًا)، وExpress هنا Single-process/
 *     Single-threaded على نفس الـ DB Connection — فده بيمنع أي Interleaving
 *     فعلي بين طلبين HTTP متزامنين أصلًا على مستوى Node نفسه. الـ Transaction
 *     + UNIQUE constraint + trg_matches_request_must_be_open_on_insert هنا
 *     كطبقة دفاع صريحة إضافية (توثّق الضمان بدل الاعتماد الضمني على تفصيل
 *     تنفيذ الـ Runtime بس)، ولتغطية أي تعدد اتصالات DB مستقبلي على نفس
 *     الملف.
 *   - إعادة الاستدعاء لطلب اتطابق فعلًا بيرجّع نفس الـ Match (already_matched)
 *     من غير أي صف جديد في matches — Idempotent فعليًا.
 */
export function runAutomaticMatching(db: DatabaseSync, requestId: number): MatchOutcome {
  db.exec("BEGIN IMMEDIATE");
  try {
    const request = findDailyCommuteRequestById(db, requestId);
    if (!request) {
      db.exec("ROLLBACK");
      return { outcome: "not_found" };
    }

    if (request.status === "matched") {
      const existing = findMatchByRequestId(db, requestId);
      db.exec("ROLLBACK");
      return existing ? { outcome: "already_matched", match: existing } : { outcome: "not_open" };
    }

    if (request.status !== "open") {
      db.exec("ROLLBACK");
      return { outcome: "not_open" };
    }

    const category = findServiceCategoryById(db, request.service_category_id);
    if (!category) {
      // مينفعش يحصل عمليًا (FK بيمنع request.service_category_id غير موجود
      // من الأساس) — دفاع أخير بس.
      db.exec("ROLLBACK");
      return { outcome: "no_eligible_captain" };
    }

    const eligible = findEligibleCaptains(db, category.vehicle_type_id);
    if (eligible.length === 0) {
      db.exec("ROLLBACK");
      return { outcome: "no_eligible_captain" };
    }

    const winner = rankEligibleCaptains(eligible, request.pickup_lat, request.pickup_lng)[0];

    const match = insertMatch(db, {
      daily_commute_request_id: requestId,
      captain_user_id: winner.user_id,
      distance_km: winner.distance_km,
    });

    db.exec("COMMIT");
    return { outcome: "matched", match };
  } catch {
    db.exec("ROLLBACK");
    const existing = findMatchByRequestId(db, requestId);
    if (existing) return { outcome: "already_matched", match: existing };
    return { outcome: "not_open" };
  }
}
