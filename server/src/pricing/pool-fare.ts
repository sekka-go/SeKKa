import type { DatabaseSync } from "node:sqlite";
import { calculateFare } from "./fare.js";

/**
 * تسعير Commute Pool (Proposal رقم 6). نفس صيغة calculateFare الوحيدة
 * (أساس + كم × سعر الكيلو + دقايق × سعر الدقيقة) على مستوى المسار الكلي،
 * مقسومة على عدد المقاعد. الأساس ثابت (قرار المالك) ومش بيتحسب على مشوار
 * الكابتن الفاضي — بدل كده في حد أقصى لمسافة الكابتن لأول راكب.
 */

/** أقصى مسافة بين الكابتن وأول نقطة ركوب عشان الطلب يظهرله (قرار المالك). */
export const MAX_CAPTAIN_TO_FIRST_PICKUP_KM = 4;

export interface PoolCategory {
  id: string;
  speed_tier: "faster" | "saver";
  has_ac: number;
  seats: number;
  base_fee: number;
  rate_per_km: number;
  rate_per_min: number;
}

export function findPoolCategory(db: DatabaseSync, id: string): PoolCategory | null {
  const row = db
    .prepare(
      `SELECT id, speed_tier, has_ac, seats, base_fee, rate_per_km, rate_per_min
       FROM pool_categories WHERE id = ?`,
    )
    .get(id) as unknown as PoolCategory | undefined;
  return row ? { ...row } : null;
}

/** سعر المسار الكلي (رحلة واحدة، كل الركاب). */
export function calculatePoolRouteFare(
  category: PoolCategory,
  distanceKm: number,
  durationMin: number,
): number {
  return calculateFare(
    {
      vehicle_type_id: category.id,
      base_fee: category.base_fee,
      rate_per_km: category.rate_per_km,
      rate_per_min: category.rate_per_min,
    },
    distanceKm,
    durationMin,
  );
}

/** سعر الفرد لرحلة واحدة (المسار مكتمل). */
export function calculatePerSeatFare(routeFare: number, seats: number): number {
  return Math.round((routeFare / seats) * 100) / 100;
}

/**
 * سعر الفرد ليوم كامل (ذهاب + عودة). العودة نفس المسار معكوس، فنفس
 * المسافة والوقت، والأساس بيتحسب مرة لكل رحلة.
 */
export function calculateRoundTripPerSeatFare(
  category: PoolCategory,
  legDistanceKm: number,
  legDurationMin: number,
): number {
  const leg = calculatePoolRouteFare(category, legDistanceKm, legDurationMin);
  return calculatePerSeatFare(leg * 2, category.seats);
}

/** الكابتن يظهرله الطلب بس لو أول نقطة ركوب في حدود 4 كم. */
export function isCaptainWithinPickupRange(distanceKm: number): boolean {
  return distanceKm <= MAX_CAPTAIN_TO_FIRST_PICKUP_KM;
}
