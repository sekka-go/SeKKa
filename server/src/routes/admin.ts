import { Router, type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import {
  findCaptainProfileByUserId,
  updateVerificationStatus,
  type VerificationStatus,
} from "../db/captain-repository.js";
import { findPricingConfig, updatePricingConfig } from "../pricing/fare.js";
import {
  currentPaymentStatus,
  findPaymentById,
  findStatusEventsByPaymentId,
  insertPaymentStatusEvent,
} from "../db/payment-repository.js";
import { getPlatformOverview } from "../db/analytics-repository.js";

const VERIFICATION_STATUSES: VerificationStatus[] = ["pending", "approved", "rejected"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

/**
 * الملف ده كله محمي بـ requireAuth + requireRole(db, 'admin') — أي حساب
 * غير role='admin' فعليًا في DB بيترفض بـ 403 قبل ما يوصل لأي Route هنا
 * (نفس نمط requireRiderRole/requireCaptainRole بالظبط، بس عبر الـ Middleware
 * العام الجديد require-role.ts).
 */
export function createAdminRouter(db: DatabaseSync): Router {
  const router = Router();
  const guarded = [requireAuth(db), requireRole(db, "admin")];

  router.post("/admin/notifications/broadcast", ...guarded, (req, res) => {
    const body = (req.body ?? {}) as { title?: unknown; message?: unknown; request_id?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : "";
    if (!title || title.length > 100 || !message || message.length > 1000 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      res.status(400).json({ error: "اكتب عنوانًا ونصًا صحيحين للرسالة ثم حاول مرة أخرى." });
      return;
    }
    const recipients = db.prepare("SELECT id FROM users ORDER BY id").all() as { id: number }[];
    const insert = db.prepare("INSERT OR IGNORE INTO pool_notifications(user_id,group_id,type,event_key,payload) VALUES(?,NULL,'system',?,?)");
    const eventKey = `broadcast:${requestId}`;
    let insertedNotifications = 0;
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const recipient of recipients) {
        const result = insert.run(recipient.id, eventKey, JSON.stringify({ title, message }));
        insertedNotifications += Number(result.changes);
      }
      db.exec("COMMIT");
    } catch {
      db.exec("ROLLBACK");
      res.status(500).json({ error: "تعذر إرسال الرسالة للجميع. لم يتم حفظها." });
      return;
    }
    res.status(200).json({ success: true, notified_users: recipients.length, inserted_notifications: insertedNotifications, request_id: requestId });
  });

  router.get("/admin/captains", ...guarded, (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    if (!VERIFICATION_STATUSES.includes(status as VerificationStatus)) {
      res.status(400).json({ error: "حالة التوثيق المطلوبة مش صحيحة." });
      return;
    }
    const captains = db.prepare(`SELECT u.id AS user_id,u.full_name,u.phone_number,u.verified_at,
      p.vehicle_type_id,p.license_number,p.vehicle_plate,p.verification_status,p.current_lat,p.current_lng,p.created_at
      FROM captain_profiles p JOIN users u ON u.id=p.user_id
      WHERE p.verification_status=? ORDER BY p.created_at DESC`).all(status) as unknown as Record<string, unknown>[];
    res.status(200).json({ captains });
  });

  // POST /api/admin/captains/:userId/verification — قبول/رفض بروفايل كابتن.
  // userId هنا هو users.id بتاع الكابتن (مش captain_profiles.id) — نفس
  // العلاقة المستخدمة في كل مكان تاني (captain_profiles.user_id UNIQUE).
  router.post("/admin/captains/:userId/verification", ...guarded, (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(404).json({ error: "الكابتن ده مش موجود." });
      return;
    }

    const { status } = req.body ?? {};
    if (!isNonEmptyString(status) || !VERIFICATION_STATUSES.includes(status as VerificationStatus)) {
      res.status(400).json({ error: "حالة التوثيق المطلوبة مش صحيحة." });
      return;
    }

    const existing = findCaptainProfileByUserId(db, userId);
    if (!existing) {
      res.status(404).json({ error: "الكابتن ده مش موجود." });
      return;
    }

    if (existing.verification_status === status) {
      res.status(409).json({ error: "الكابتن أصلًا في نفس الحالة دي." });
      return;
    }

    const updated = updateVerificationStatus(db, userId, status as VerificationStatus);
    if (!updated) {
      res.status(404).json({ error: "الكابتن ده مش موجود." });
      return;
    }

    res.status(200).json({ captain_profile: updated });
  });

  // PATCH /api/admin/pricing/:vehicleTypeId — تعديل pricing_config (مفيش
  // مسار تعديل قبل كده، كانت Seed بس من 006_trip_payment.sql). التسعير لسه
  // مش نهائي (راجع NEXT_PROMPT.md، Pricing Proposal Log) — ده بس Endpoint
  // إداري لتحديث نفس Placeholder، مش قرار تسعير جديد.
  router.patch("/admin/pricing/:vehicleTypeId", ...guarded, (req, res) => {
    const vehicleTypeId = req.params.vehicleTypeId;
    if (typeof vehicleTypeId !== "string" || vehicleTypeId.trim().length === 0) {
      res.status(400).json({ error: "معرّف نوع المركبة غير صالح." });
      return;
    }
    const { base_fee, rate_per_km, rate_per_min } = req.body ?? {};

    if (
      !isNonNegativeNumber(base_fee) ||
      !isNonNegativeNumber(rate_per_km) ||
      !isNonNegativeNumber(rate_per_min)
    ) {
      res.status(400).json({ error: "قيم التسعير المطلوبة ناقصة أو غير صحيحة." });
      return;
    }

    const existing = findPricingConfig(db, vehicleTypeId);
    if (!existing) {
      res.status(404).json({ error: "نوع المركبة ده مش موجود في إعدادات التسعير." });
      return;
    }

    const updated = updatePricingConfig(db, vehicleTypeId, {
      base_fee,
      rate_per_km,
      rate_per_min,
    });
    res.status(200).json({ pricing_config: updated });
  });

  // GET /api/admin/payments/:paymentId — تفاصيل Payment + تاريخ حالاته
  // بالكامل، عشان الأدمن يشوف السياق قبل ما يتصرف.
  router.get("/admin/payments/:paymentId", ...guarded, (req, res) => {
    const paymentId = Number(req.params.paymentId);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      res.status(404).json({ error: "الدفعة دي مش موجودة." });
      return;
    }

    const payment = findPaymentById(db, paymentId);
    if (!payment) {
      res.status(404).json({ error: "الدفعة دي مش موجودة." });
      return;
    }

    res.status(200).json({
      payment,
      status: currentPaymentStatus(db, paymentId),
      events: findStatusEventsByPaymentId(db, paymentId),
    });
  });

  /**
   * منطق مشترك لأي فعل إداري (resolve/adjust/void) — كلها بنفس الشكل:
   * لازم الدفعة تكون 'disputed' فعليًا دلوقتي، وبتسجّل حدث جديد Append-only
   * بـ actor_user_id = الأدمن نفسه. الـ Trigger في 007_admin_rbac.sql دفاع
   * طبقة تانية فوق الفحص ده بالظبط (from_status/actor role/adjusted_amount).
   */
  function handleDisputeAction(
    toStatus: "resolved" | "adjusted" | "voided",
    requireAmount: boolean,
  ) {
    return (req: Request, res: Response) => {
      const paymentId = Number(req.params.paymentId);
      if (!Number.isInteger(paymentId) || paymentId <= 0) {
        res.status(404).json({ error: "الدفعة دي مش موجودة." });
        return;
      }

      const payment = findPaymentById(db, paymentId);
      if (!payment) {
        res.status(404).json({ error: "الدفعة دي مش موجودة." });
        return;
      }

      const status = currentPaymentStatus(db, paymentId);
      if (status !== "disputed") {
        res.status(409).json({ error: "الفعل ده متاح بس على دفعة معترض عليها حاليًا." });
        return;
      }

      const { reason, amount } = req.body ?? {};
      if (!isNonEmptyString(reason)) {
        res.status(400).json({ error: "لازم تكتب سبب القرار." });
        return;
      }

      let adjustedAmount: number | null = null;
      if (requireAmount) {
        if (!isNonNegativeNumber(amount)) {
          res.status(400).json({ error: "لازم تحدد المبلغ الجديد بشكل صحيح." });
          return;
        }
        adjustedAmount = amount;
      }

      let event;
      try {
        event = insertPaymentStatusEvent(db, {
          payment_id: paymentId,
          from_status: "disputed",
          to_status: toStatus,
          actor_user_id: req.auth!.userId,
          reason,
          adjusted_amount: adjustedAmount,
        });
      } catch {
        // دفاع إضافي لو الـ Trigger رفض لأي سبب غير متوقع بعد الفحوصات فوق
        // (Race condition نادر) — رسالة عربية عامة، بدون تفاصيل SQL.
        res.status(409).json({ error: "الفعل ده مش ممكن على الدفعة دي دلوقتي." });
        return;
      }

      res.status(200).json({ payment, status: event.to_status, event });
    };
  }

  // POST /api/admin/payments/:paymentId/resolve — الأدمن بيقفل الاعتراض
  // بدون تغيير المبلغ (مثلًا بعد ما تأكد إن المبلغ الأصلي صح).
  router.post("/admin/payments/:paymentId/resolve", ...guarded, handleDisputeAction("resolved", false));

  // POST /api/admin/payments/:paymentId/adjust — الأدمن بيغيّر المبلغ
  // (adjusted_amount)، الأصلي في payments.amount فاضل زي ما هو دايمًا.
  router.post("/admin/payments/:paymentId/adjust", ...guarded, handleDisputeAction("adjusted", true));

  // POST /api/admin/payments/:paymentId/void — الأدمن بيلغي الدفعة تمامًا
  // (مثلًا رحلة اتلغت فعليًا لكن الـ Ledger اتسجل بالغلط).
  router.post("/admin/payments/:paymentId/void", ...guarded, handleDisputeAction("voided", false));

  // GET /api/admin/analytics/overview — لوحة أرقام عامة (راجع
  // analytics-repository.ts للتفاصيل).
  router.get("/admin/analytics/overview", ...guarded, (_req, res) => {
    res.status(200).json({ overview: getPlatformOverview(db) });
  });

  return router;
}
