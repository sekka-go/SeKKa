import type { DatabaseSync } from "node:sqlite";

/**
 * التسعير مش نهائي (قرار مالك صريح، راجع Pricing Proposal Log بتاع
 * NEXT_PROMPT.md). كل حساب Fare فعلي في الكود لازم يمر من هنا بس —
 * دالة واحدة قابلة للاستبدال بالكامل، مفيش نسخة تانية من هذا المنطق في أي
 * مكان تاني (قاعدة عامة 5 — Server-Authoritative / لا تكرار منطق).
 */

export interface PricingConfig {
  vehicle_type_id: string;
  base_fee: number;
  rate_per_km: number;
  rate_per_min: number;
}

export function findPricingConfig(
  db: DatabaseSync,
  vehicleTypeId: string,
): PricingConfig | null {
  const row = db
    .prepare(
      `SELECT vehicle_type_id, base_fee, rate_per_km, rate_per_min
       FROM pricing_config WHERE vehicle_type_id = ?`,
    )
    .get(vehicleTypeId) as unknown as PricingConfig | undefined;
  return row ? { ...row } : null;
}

/**
 * إضافة Phase 7 — الأدمن بيعدّل pricing_config (مفيش Endpoint تعديل قبل
 * كده، Seed بس من 006_trip_payment.sql). بيرجع null لو vehicle_type_id ده
 * مش موجود أصلًا في pricing_config (مفيش صف يتحدّث) — الـ Route يفسّرها
 * لـ 404، مش يعمل Insert ضمني.
 */
export function updatePricingConfig(
  db: DatabaseSync,
  vehicleTypeId: string,
  input: { base_fee: number; rate_per_km: number; rate_per_min: number },
): PricingConfig | null {
  const result = db
    .prepare(
      `UPDATE pricing_config
       SET base_fee = ?, rate_per_km = ?, rate_per_min = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE vehicle_type_id = ?`,
    )
    .run(input.base_fee, input.rate_per_km, input.rate_per_min, vehicleTypeId);
  if (result.changes === 0) return null;
  return findPricingConfig(db, vehicleTypeId);
}

/**
 * Placeholder مؤقت: Cost-Recovery Distance/Time Formula (Pricing Proposal
 * رقم 1 في اللوج) — fare = base_fee + distance_km × rate_per_km +
 * duration_min × rate_per_min. مفيش Surge/مضاعِف في هذه المرحلة. القيم كلها
 * من pricing_config (قابلة للتعديل من Admin لاحقًا، مش Hardcoded في الكود).
 */
export function calculateFare(
  config: PricingConfig,
  distanceKm: number,
  durationMin: number,
): number {
  const raw = config.base_fee + distanceKm * config.rate_per_km + durationMin * config.rate_per_min;
  return Math.round(raw * 100) / 100;
}

/** فرق الوقت بالدقايق بين تاريخين ISO — مفيش دقايق سالبة (Clamp لـ 0). */
export function minutesBetween(fromIso: string, toIso: string): number {
  const diffMs = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, diffMs / 60000);
}
