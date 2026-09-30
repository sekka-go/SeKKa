import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { getServiceCategories, getVehicleTypes } from "../db/config-repository.js";

/**
 * GET /api/config
 * بيرجّع vehicle_types + service_categories من الـ DB (Server-Authoritative —
 * الفرونت هيقرأ منه بدل ما يهاردكود القيم، حسب القاعدة العامة رقم 5).
 */
export function createConfigRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/config", (_req, res) => {
    try {
      const vehicle_types = getVehicleTypes(db);
      const service_categories = getServiceCategories(db);
      res.status(200).json({ vehicle_types, service_categories });
    } catch {
      // رسالة عربي مصري بسيطة للمستخدم، بدون تسريب أي تفاصيل SQL/تقنية (قاعدة 7).
      res.status(500).json({ error: "حصل خطأ ونحن بنجيب الإعدادات، جرّب تاني بعد شوية." });
    }
  });

  return router;
}
