import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { findUserById } from "../db/user-repository.js";
import { serviceCategoryExists } from "../db/config-repository.js";
import {
  cancelOpenDailyCommuteRequest,
  createDailyCommuteRequest,
  findDailyCommuteRequestById,
  findDailyCommuteRequestsByRiderId,
} from "../db/booking-repository.js";
import { requireAuth } from "../middleware/require-auth.js";
import { runAutomaticMatching } from "../matching/engine.js";
import { findMatchByRequestId } from "../db/matching-repository.js";
import { findCompletedTripsByRiderId, findTripStopsByTripId, findTripWithContextById } from "../db/trip-repository.js";
import { currentPaymentStatus, findPaymentByTripId, insertPaymentStatusEvent } from "../db/payment-repository.js";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLat(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

function isValidLng(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * لازم يتحط بعد requireAuth مباشرة. بيتأكد إن صاحب الجلسة role='rider' فعليًا
 * في DB (مش من أي قيمة جاية من الفرونت) — نفس نمط requireCaptainRole في
 * Phase 3 بالظبط، معكوس على role 'rider'.
 */
function requireRiderRole(db: DatabaseSync): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = findUserById(db, req.auth!.userId);
    if (!user || user.role !== "rider") {
      res.status(403).json({ error: "الخدمة دي متاحة للركاب بس." });
      return;
    }
    next();
  };
}

export function createRiderRouter(db: DatabaseSync): Router {
  const router = Router();
  const guarded: RequestHandler[] = [requireAuth(db), requireRiderRole(db)];

  // POST /api/rider/requests — إنشاء Daily Commute Request جديد. status
  // دايمًا 'open' عند الإنشاء (DEFAULT من الـ DB نفسها) — مش بتتقرا من
  // req.body إطلاقًا، نفس نمط verification_status في Phase 3.
  router.post("/rider/requests", ...guarded, (req, res) => {
    const { service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng } =
      req.body ?? {};

    if (!isNonEmptyString(service_category_id) || !serviceCategoryExists(db, service_category_id)) {
      res.status(400).json({ error: "فئة الخدمة المطلوبة مش موجودة." });
      return;
    }

    if (
      !isValidLat(pickup_lat) ||
      !isValidLng(pickup_lng) ||
      !isValidLat(dropoff_lat) ||
      !isValidLng(dropoff_lng)
    ) {
      res.status(400).json({ error: "إحداثيات نقطة التجمّع أو الوجهة ناقصة أو غير صحيحة." });
      return;
    }

    let commuteRequest;
    try {
      commuteRequest = createDailyCommuteRequest(db, {
        rider_user_id: req.auth!.userId,
        service_category_id,
        pickup_lat,
        pickup_lng,
        dropoff_lat,
        dropoff_lng,
      });
    } catch {
      // دفاع إضافي لو حصل أي خطأ DB غير متوقع بعد الفحوصات فوق (زي Race
      // condition نادر على service_category_id) — رسالة عربية عامة، بدون
      // تفاصيل SQL (قاعدة 7).
      res.status(400).json({ error: "حصل خطأ في بيانات الطلب، اتأكد منها وجرّب تاني." });
      return;
    }

    // Phase 5 — Matching أوتوماتيكي فورًا بعد الإنشاء (قرار #1 من المالك،
    // مفيش خطوة موافقة كابتن). لو مفيش كابتن مؤهل دلوقتي، الطلب بيفضل
    // 'open' عادي — ده مش خطأ، ممكن يتحاول تاني عبر /match لاحقًا.
    const matchOutcome = runAutomaticMatching(db, commuteRequest.id);
    const finalRequest =
      matchOutcome.outcome === "matched"
        ? findDailyCommuteRequestById(db, commuteRequest.id)!
        : commuteRequest;

    res.status(201).json({
      request: finalRequest,
      match: matchOutcome.outcome === "matched" ? matchOutcome.match : null,
    });
  });

  // GET /api/rider/requests — طلبات صاحب الجلسة بس (مش طلبات راكب تاني).
  // Phase 5: أي طلب status='matched' بيترفق معاه تفاصيل الـ Match (بدون كسر
  // شكل الحقول الحالية بتاعة الطلب لغير الحالة دي).
  router.get("/rider/requests", ...guarded, (req, res) => {
    const requests = findDailyCommuteRequestsByRiderId(db, req.auth!.userId);
    // بنضيف حقل match واحد بس فوق حقول الطلب الأصلية كلها (مفيش أي حقل
    // موجود قبل كده اتشال أو اتغيّر) — match: null لغير الحالة matched، عشان
    // شكل الاستجابة يفضل زي ما هو بالظبط لغير هذه الحالة.
    const withMatches = requests.map((request) => ({
      ...request,
      match: request.status === "matched" ? findMatchByRequestId(db, request.id) : null,
    }));
    res.status(200).json({ requests: withMatches });
  });

  // POST /api/rider/requests/:id/match — إضافة Phase 5. إعادة محاولة
  // Matching لطلب لسه 'open' (مثلًا لو مفيش كابتن كان متاح وقت الإنشاء).
  // Idempotent: لو الطلب اتطابق فعلًا، بيرجّع نفس الـ Match من غير أي تكرار.
  router.post("/rider/requests/:id/match", ...guarded, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(404).json({ error: "الطلب ده مش موجود." });
      return;
    }

    const existing = findDailyCommuteRequestById(db, id);
    if (!existing) {
      res.status(404).json({ error: "الطلب ده مش موجود." });
      return;
    }

    if (existing.rider_user_id !== req.auth!.userId) {
      res.status(403).json({ error: "الطلب ده مش بتاعك." });
      return;
    }

    const outcome = runAutomaticMatching(db, id);

    if (outcome.outcome === "matched" || outcome.outcome === "already_matched") {
      res.status(200).json({
        request: findDailyCommuteRequestById(db, id),
        match: outcome.match,
      });
      return;
    }

    if (outcome.outcome === "no_eligible_captain") {
      res.status(200).json({
        request: findDailyCommuteRequestById(db, id),
        match: null,
        message: "لسه مفيش كابتن متاح، الطلب لسه مفتوح.",
      });
      return;
    }

    // not_open (اتلغى/expired) أو not_found (مش متوقع هنا لأننا اتأكدنا فوق)
    res.status(409).json({ error: "الطلب ده مش قابل للـ Matching دلوقتي." });
  });

  // POST /api/rider/requests/:id/cancel — إلغاء طلب لسه 'open' وبتاع صاحب
  // الجلسة نفسه بس.
  router.post("/rider/requests/:id/cancel", ...guarded, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(404).json({ error: "الطلب ده مش موجود." });
      return;
    }

    const existing = findDailyCommuteRequestById(db, id);
    if (!existing) {
      res.status(404).json({ error: "الطلب ده مش موجود." });
      return;
    }

    if (existing.rider_user_id !== req.auth!.userId) {
      res.status(403).json({ error: "الطلب ده مش بتاعك." });
      return;
    }

    if (existing.status !== "open") {
      res.status(409).json({ error: "الطلب ده مش قابل للإلغاء دلوقتي." });
      return;
    }

    const cancelled = cancelOpenDailyCommuteRequest(db, id);
    if (!cancelled) {
      // Race condition نادر: اتغيّرت حالته بين الفحص فوق والتحديث ده — نفس
      // الرسالة، مش تفصيل تقني.
      res.status(409).json({ error: "الطلب ده مش قابل للإلغاء دلوقتي." });
      return;
    }

    res.status(200).json({ request: findDailyCommuteRequestById(db, id) });
  });

  // GET /api/rider/trips — إضافة Phase 6. "رحلاتي": الرحلات المقفولة
  // بتاعة صاحب الجلسة بس، مع الـ Stops والـ Payment Ledger بتاع كل واحدة.
  router.get("/rider/trips", ...guarded, (req, res) => {
    const trips = findCompletedTripsByRiderId(db, req.auth!.userId);
    const withDetails = trips.map((trip) => {
      const payment = findPaymentByTripId(db, trip.id);
      return {
        trip,
        stops: findTripStopsByTripId(db, trip.id),
        payment,
        payment_status: payment ? currentPaymentStatus(db, payment.id) : null,
      };
    });
    res.status(200).json({ trips: withDetails });
  });

  // POST /api/rider/trips/:id/dispute — إضافة Phase 6. الراكب يعترض على
  // مبلغ 'confirmed' بس (مفيش اعتراض على أي حالة تانية). التأكيد الأولي
  // نظامي أوتوماتيك (راجع lifecycle.ts/006_trip_payment.sql) — الاعتراض ده
  // أول انتقال حالة ممكن يعمله إنسان فعليًا.
  router.post("/rider/trips/:id/dispute", ...guarded, (req, res) => {
    const tripId = Number(req.params.id);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      res.status(404).json({ error: "الرحلة دي مش موجودة." });
      return;
    }

    const ctx = findTripWithContextById(db, tripId);
    if (!ctx) {
      res.status(404).json({ error: "الرحلة دي مش موجودة." });
      return;
    }
    if (ctx.rider_user_id !== req.auth!.userId) {
      res.status(403).json({ error: "الرحلة دي مش بتاعتك." });
      return;
    }

    const payment = findPaymentByTripId(db, tripId);
    if (!payment) {
      res.status(409).json({ error: "لسه مفيش مبلغ متسجّل لهذه الرحلة." });
      return;
    }

    const status = currentPaymentStatus(db, payment.id);
    if (status !== "confirmed") {
      res.status(409).json({ error: "الاعتراض متاح بس على مبلغ مؤكد لسه ماعترضش عليه." });
      return;
    }

    const { reason } = req.body ?? {};
    if (!isNonEmptyString(reason)) {
      res.status(400).json({ error: "لازم تكتب سبب الاعتراض." });
      return;
    }

    const event = insertPaymentStatusEvent(db, {
      payment_id: payment.id,
      from_status: "confirmed",
      to_status: "disputed",
      actor_user_id: req.auth!.userId,
      reason,
    });

    res.status(200).json({ payment, status: event.to_status });
  });

  return router;
}
