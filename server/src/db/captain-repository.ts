import type { DatabaseSync } from "node:sqlite";

export type VerificationStatus = "pending" | "approved" | "rejected";

export interface CaptainProfileRecord {
  id: number;
  user_id: number;
  vehicle_type_id: string;
  license_number: string;
  vehicle_plate: string;
  verification_status: VerificationStatus;
  current_lat: number | null;
  current_lng: number | null;
  created_at: string;
}

export interface CreateCaptainProfileInput {
  user_id: number;
  vehicle_type_id: string;
  license_number: string;
  vehicle_plate: string;
}

export function findCaptainProfileByUserId(
  db: DatabaseSync,
  userId: number,
): CaptainProfileRecord | null {
  const row = db
    .prepare(
      `SELECT id, user_id, vehicle_type_id, license_number, vehicle_plate,
              verification_status, current_lat, current_lng, created_at
       FROM captain_profiles WHERE user_id = ?`,
    )
    .get(userId) as unknown as CaptainProfileRecord | undefined;
  return row ? { ...row } : null;
}

/**
 * بترمي أي خطأ SQLite زي هو (UNIQUE على user_id، FK على vehicle_type_id، أو
 * الـ Trigger اللي بيمنع أي user_id مش role=captain) — المسؤولية على الـ
 * Route إنه يفسّرها لرسالة عربية مناسبة، مش هنا. verification_status مش من
 * مدخلات هذه الدالة إطلاقًا — دايمًا بتاخد الـ DEFAULT ('pending') من الـ
 * Schema نفسه، مفيش طريقة تتبعت قيمة تانية من هنا.
 */
export function createCaptainProfile(
  db: DatabaseSync,
  input: CreateCaptainProfileInput,
): CaptainProfileRecord {
  db.prepare(
    `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate)
     VALUES (?, ?, ?, ?)`,
  ).run(input.user_id, input.vehicle_type_id, input.license_number, input.vehicle_plate);

  const created = findCaptainProfileByUserId(db, input.user_id);
  if (!created) {
    throw new Error("فشل غير متوقع بعد إنشاء بروفايل الكابتن.");
  }
  return created;
}

/**
 * إضافة Phase 5 — الكابتن بيحدّث موقعه الحالي بنفسه (current_lat/lng).
 * ده الموقع المعتمد للـ Matching Engine (قرار صريح من المالك، مش
 * home_lat/lng). بترجع null لو الكابتن ده لسه معملش بروفايل مركبة أصلًا
 * (مفيش صف يتحدّث)، الـ Route هو اللي يفسّرها لـ 404.
 */
/**
 * إضافة Phase 7 — الأدمن بيوافق/يرفض بروفايل كابتن. بيرجع null لو الكابتن
 * ده مش موجود أصلًا (مفيش صف يتحدّث)، أو لو الحالة الجديدة هي نفسها القديمة
 * بالظبط (الـ Trigger trg_captain_profiles_verification_no_noop_update
 * بيرفض الـ No-op ده على مستوى الـ DB برضه — دفاع طبقة تانية، الـ Route هو
 * اللي يفسّر الـ Exception الناتج لرسالة 409 عربية).
 */
export function updateVerificationStatus(
  db: DatabaseSync,
  userId: number,
  status: VerificationStatus,
): CaptainProfileRecord | null {
  const result = db
    .prepare(`UPDATE captain_profiles SET verification_status = ? WHERE user_id = ?`)
    .run(status, userId);
  if (result.changes === 0) return null;
  return findCaptainProfileByUserId(db, userId);
}

export function updateCaptainCurrentLocation(
  db: DatabaseSync,
  userId: number,
  lat: number,
  lng: number,
): CaptainProfileRecord | null {
  const result = db
    .prepare(`UPDATE captain_profiles SET current_lat = ?, current_lng = ? WHERE user_id = ?`)
    .run(lat, lng, userId);
  if (result.changes === 0) return null;
  return findCaptainProfileByUserId(db, userId);
}
