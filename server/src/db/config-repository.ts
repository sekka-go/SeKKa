import type { DatabaseSync } from "node:sqlite";

export interface VehicleType {
  id: string;
  name_ar: string;
  capacity_max: number;
}

export interface ServiceCategory {
  id: string;
  vehicle_type_id: string;
  name_ar: string;
  max_seats: number;
  ac_rule: "none" | "required" | "optional";
}

/**
 * قراءة فقط — vehicle_types و service_categories هي Backend-controlled config
 * (بيانات Seed فقط)، مفيش Insert/Update/Delete من هنا في هذه المرحلة.
 */
// node:sqlite بيرجّع صفوف بـ null prototype (Object.create(null)) — بنحوّلها
// لـ plain object عادي هنا عشان تتقارن بسهولة في الاختبارات وتتسلسل بشكل
// متوقع في أي مكان تاني.
export function getVehicleTypes(db: DatabaseSync): VehicleType[] {
  const rows = db
    .prepare("SELECT id, name_ar, capacity_max FROM vehicle_types ORDER BY id")
    .all() as unknown as VehicleType[];
  return rows.map((row) => ({ ...row }));
}

export function getServiceCategories(db: DatabaseSync): ServiceCategory[] {
  const rows = db
    .prepare(
      "SELECT id, vehicle_type_id, name_ar, max_seats, ac_rule FROM service_categories ORDER BY id",
    )
    .all() as unknown as ServiceCategory[];
  return rows.map((row) => ({ ...row }));
}

/**
 * بيتحقق إن service_category_id موجود فعليًا (Phase 4 — رفض أي id مش حقيقي
 * قبل استخدامه في daily_commute_requests، بنفس روح الفحص الصريح اللي Phase 3
 * عمله لـ vehicle_type_id بدل الاعتماد على رسالة SQL الخام بس).
 */
export function serviceCategoryExists(db: DatabaseSync, id: string): boolean {
  const row = db.prepare("SELECT 1 FROM service_categories WHERE id = ?").get(id);
  return row !== undefined;
}

/**
 * إضافة Phase 5 — الـ Matching Engine محتاج vehicle_type_id بتاعة
 * service_category الطلب عشان يفلتر الكباتن المؤهلين بيه. قراءة فقط، نفس
 * نمط باقي الملف.
 */
export function findServiceCategoryById(db: DatabaseSync, id: string): ServiceCategory | null {
  const row = db
    .prepare(
      "SELECT id, vehicle_type_id, name_ar, max_seats, ac_rule FROM service_categories WHERE id = ?",
    )
    .get(id) as unknown as ServiceCategory | undefined;
  return row ? { ...row } : null;
}
