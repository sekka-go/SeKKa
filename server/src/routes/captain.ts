import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { findUserById, markUserVerified } from "../db/user-repository.js";
import {
  createCaptainProfile,
  findCaptainProfileByUserId,
  updateCaptainCurrentLocation,
} from "../db/captain-repository.js";
import {
  consumeOtpChallenge,
  createOtpChallenge,
  findLatestActiveOtpChallenge,
} from "../db/otp-repository.js";
import { generateOtp, hashOtp, isDevOtpLoggingAllowed, logOtpDevOnly, otpExpiryFromNow } from "../security/otp.js";
import { requireAuth } from "../middleware/require-auth.js";
import { createRateLimiter } from "../middleware/rate-limit.js";
import {
  findTripStopsByTripId,
  findTripWithContextById,
  findCompletedTripsByCaptainId,
} from "../db/trip-repository.js";
import { arriveAtTripStop, completeTripAndLedgerPayment } from "../trip/lifecycle.js";
import { findPaymentByTripId } from "../db/payment-repository.js";

// مصفوفة المركبات النهائية (قاعدة عامة 3) — نفس القيم الموجودة فعليًا في
// vehicle_types (001_init.sql). الـ FK في captain_profiles بيرفض أي قيمة
// تانية برضه (دفاع طبقة تانية)، لكن الفحص هنا بيسمح برسالة 400 عربية واضحة
// بدل خطأ SQL عام لو حد حاول قيمة زي "elite".
const ALLOWED_VEHICLE_TYPES = ["private_car", "hiace"];

// رسالة فشل OTP موحّدة — نفس منطق رسالة فشل الدخول في Phase 2: رسالة واحدة
// عامة لكل أسباب الفشل (غلط / منتهي / مستخدم قبل كده) عشان محدش يقدر يستنتج
// حالة الـ OTP الحقيقية من الرد.
const GENERIC_OTP_FAILURE = "الكود اللي دخلته غلط أو منتهي، جرّب تاني.";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLat(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

function isValidLng(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

/**
 * لازم يتحط بعد requireAuth مباشرة. بيتأكد إن صاحب الجلسة role='captain'
 * فعليًا في DB (مش من أي قيمة جاية من الفرونت) — أي Rider يحاول يستخدم أي
 * Endpoint من دول بيترفض بـ 403 برسالة عربية واضحة.
 */
function requireCaptainRole(db: DatabaseSync): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = findUserById(db, req.auth!.userId);
    if (!user || user.role !== "captain") {
      res.status(403).json({ error: "الخدمة دي متاحة للكباتن بس." });
      return;
    }
    next();
  };
}

export function createCaptainRouter(db: DatabaseSync): Router {
  const router = Router();
  const guarded: RequestHandler[] = [requireAuth(db), requireCaptainRole(db)];
  const otpRequestRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 3,
    keyFn: (req) => `user:${req.auth!.userId}`,
    message: "طلبت رموز تحقق كثيرة. حاول بعد قليل.",
  });
  const otpConfirmRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyFn: (req) => `user:${req.auth!.userId}`,
    message: "محاولات تحقق كثيرة. حاول بعد قليل.",
  });

  // POST /api/captain/verify/request — بيولّد OTP، يخزّن الـ Hash بس، وبيطبعه
  // في الـ Server console بدل SMS حقيقي (Dev-only، زي ما موثّق في otp.ts).
  router.post("/captain/verify/request", ...guarded, otpRequestRateLimiter, (req, res) => {
    if (!isDevOtpLoggingAllowed()) {
      res.status(503).json({ error: "خدمة إرسال رمز التحقق غير متاحة حاليًا." });
      return;
    }
    const user = findUserById(db, req.auth!.userId)!;
    const otp = generateOtp();
    const expiresAt = otpExpiryFromNow().toISOString();

    createOtpChallenge(db, user.id, hashOtp(otp), expiresAt);
    logOtpDevOnly(user.phone_number, otp);

    res.status(200).json({
      message: "اتبعت الكود في الـ Server console، مفيش SMS حقيقي في هذه البيئة (Dev-only).",
    });
  });

  // POST /api/captain/verify/confirm — يتحقق من آخر OTP غير منتهي وغير
  // مستخدم لنفس المستخدم، ولو مطابق يحدّث verified_at.
  router.post("/captain/verify/confirm", ...guarded, otpConfirmRateLimiter, (req, res) => {
    const { otp } = req.body ?? {};
    if (!isNonEmptyString(otp)) {
      res.status(400).json({ error: GENERIC_OTP_FAILURE });
      return;
    }

    const challenge = findLatestActiveOtpChallenge(db, req.auth!.userId);
    if (!challenge || challenge.otp_hash !== hashOtp(otp)) {
      res.status(401).json({ error: GENERIC_OTP_FAILURE });
      return;
    }

    // الاستهلاك بـ WHERE consumed_at IS NULL — لو فشل (Race condition نادر)
    // معناه حد تاني استهلكها فعلًا بين التحقق والتحديث، فنرفض برضه.
    const consumed = consumeOtpChallenge(db, challenge.id);
    if (!consumed) {
      res.status(401).json({ error: GENERIC_OTP_FAILURE });
      return;
    }

    markUserVerified(db, req.auth!.userId);
    res.status(200).json({ success: true });
  });

  // POST /api/captain/profile — إنشاء Profile واحد بس لكل Captain.
  // verification_status مش بتتقرا من req.body إطلاقًا — دايمًا 'pending'
  // (DEFAULT من الـ DB نفسها) بغض النظر عن أي قيمة يحاول الفرونت يبعتها.
  router.post("/captain/profile", ...guarded, (req, res) => {
    const { vehicle_type_id, license_number, vehicle_plate } = req.body ?? {};

    if (
      !isNonEmptyString(vehicle_type_id) ||
      !ALLOWED_VEHICLE_TYPES.includes(vehicle_type_id) ||
      !isNonEmptyString(license_number) ||
      !isNonEmptyString(vehicle_plate)
    ) {
      res.status(400).json({ error: "بيانات المركبة ناقصة أو غير صحيحة." });
      return;
    }

    const existing = findCaptainProfileByUserId(db, req.auth!.userId);
    if (existing) {
      res.status(409).json({ error: "عندك بيانات مركبة مسجّلة بالفعل." });
      return;
    }

    try {
      const profile = createCaptainProfile(db, {
        user_id: req.auth!.userId,
        vehicle_type_id,
        license_number,
        vehicle_plate,
      });
      res.status(201).json({ profile });
    } catch {
      // دفاع إضافي لو حصل Race condition بين فحص التكرار والإدخال (UNIQUE
      // constraint في DB هيرفضه برضه) — نفس الرسالة، بدون تفاصيل SQL.
      res.status(409).json({ error: "عندك بيانات مركبة مسجّلة بالفعل." });
    }
  });

  // GET /api/captain/profile — بروفايل صاحب الجلسة نفسه بس.
  router.get("/captain/profile", ...guarded, (req, res) => {
    const profile = findCaptainProfileByUserId(db, req.auth!.userId);
    if (!profile) {
      res.status(404).json({ error: "لسه معملتش بيانات مركبة." });
      return;
    }
    res.status(200).json({ profile });
  });

  // POST /api/captain/location — إضافة Phase 5. تحديث الموقع الحالي بتاع
  // الكابتن (current_lat/current_lng)، ده الموقع المعتمد لـ Matching Engine
  // (قرار صريح من المالك، مش home/موقع تسجيل ثابت). محتاج بروفايل مركبة
  // موجود أصلًا (404 لو لسه مفيش).
  router.post("/captain/location", ...guarded, (req, res) => {
    const { current_lat, current_lng } = req.body ?? {};

    if (!isValidLat(current_lat) || !isValidLng(current_lng)) {
      res.status(400).json({ error: "إحداثيات الموقع الحالي ناقصة أو غير صحيحة." });
      return;
    }

    const updated = updateCaptainCurrentLocation(db, req.auth!.userId, current_lat, current_lng);
    if (!updated) {
      res.status(404).json({ error: "لسه معملتش بيانات مركبة." });
      return;
    }

    res.status(200).json({ profile: updated });
  });

  // GET /api/captain/trips/:tripId — إضافة Phase 6 (خارج نطاق قائمة
  // Endpoints المطلوبة صراحة في NEXT_PROMPT.md، بس لازمة عمليًا عشان
  // الكابتن يعرف tripId/stopId اللي يستخدمهم مع /arrive و/complete —
  // مفيش أي مصدر تاني حاليًا يرجّعهم). بترجع الرحلة + الـ Stops بتاعتها،
  // بس لو الكابتن ده صاحبها فعليًا.
  router.get("/captain/trips/:tripId", ...guarded, (req, res) => {
    const tripId = Number(req.params.tripId);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      res.status(404).json({ error: "الرحلة دي مش موجودة." });
      return;
    }

    const ctx = findTripWithContextById(db, tripId);
    if (!ctx) {
      res.status(404).json({ error: "الرحلة دي مش موجودة." });
      return;
    }
    if (ctx.captain_user_id !== req.auth!.userId) {
      res.status(403).json({ error: "الرحلة دي مش بتاعتك." });
      return;
    }

    res.status(200).json({
      trip: {
        id: ctx.id,
        match_id: ctx.match_id,
        status: ctx.status,
        started_at: ctx.started_at,
        completed_at: ctx.completed_at,
        total_distance_km: ctx.total_distance_km,
        total_amount: ctx.total_amount,
      },
      stops: findTripStopsByTripId(db, tripId),
    });
  });

  // POST /api/captain/trips/:tripId/stops/:stopId/arrive — إضافة Phase 6.
  // الكابتن يدوس "وصلت" عند نقطة (Pickup أو Dropoff). بيرجّع fare_at_stop
  // (المسافة/المبلغ التراكمي لحد دلوقتي) — راجع src/trip/lifecycle.ts
  // للمنطق الأوحد المعتمد لهذا الحساب.
  router.post("/captain/trips/:tripId/stops/:stopId/arrive", ...guarded, (req, res) => {
    const tripId = Number(req.params.tripId);
    const stopId = Number(req.params.stopId);
    if (!Number.isInteger(tripId) || tripId <= 0 || !Number.isInteger(stopId) || stopId <= 0) {
      res.status(404).json({ error: "الرحلة أو النقطة دي مش موجودة." });
      return;
    }

    const ctx = findTripWithContextById(db, tripId);
    if (!ctx) {
      res.status(404).json({ error: "الرحلة دي مش موجودة." });
      return;
    }
    if (ctx.captain_user_id !== req.auth!.userId) {
      res.status(403).json({ error: "الرحلة دي مش بتاعتك." });
      return;
    }

    const outcome = arriveAtTripStop(db, tripId, stopId);
    switch (outcome.outcome) {
      case "arrived":
        res.status(200).json({ stop: outcome.stop });
        return;
      case "trip_not_found":
      case "stop_not_found":
        res.status(404).json({ error: "الرحلة أو النقطة دي مش موجودة." });
        return;
      case "trip_not_in_progress":
        res.status(409).json({ error: "الرحلة دي مش شغّالة دلوقتي." });
        return;
      case "already_arrived":
        res.status(409).json({ error: "الوصول اتسجّل لهذه النقطة قبل كده." });
        return;
      case "out_of_sequence":
        res.status(409).json({ error: "لازم توصل النقطة اللي قبل دي الأول." });
        return;
      case "pricing_unavailable":
        res.status(500).json({ error: "حصل خطأ في إعدادات التسعير، حاول تاني لاحقًا." });
        return;
    }
  });

  // POST /api/captain/trips/:tripId/complete — إضافة Phase 6. يقفل الرحلة
  // (بعد وصول كل الـ Stops) ويعمل صف Payment Ledger أول حالة (Confirmed
  // أوتوماتيك، الكابتن كمُبلِّغ) في نفس اللحظة — راجع lifecycle.ts.
  router.post("/captain/trips/:tripId/complete", ...guarded, (req, res) => {
    const tripId = Number(req.params.tripId);
    if (!Number.isInteger(tripId) || tripId <= 0) {
      res.status(404).json({ error: "الرحلة دي مش موجودة." });
      return;
    }

    const ctx = findTripWithContextById(db, tripId);
    if (!ctx) {
      res.status(404).json({ error: "الرحلة دي مش موجودة." });
      return;
    }
    if (ctx.captain_user_id !== req.auth!.userId) {
      res.status(403).json({ error: "الرحلة دي مش بتاعتك." });
      return;
    }

    const outcome = completeTripAndLedgerPayment(db, tripId);
    switch (outcome.outcome) {
      case "completed":
        res.status(200).json({ trip: outcome.trip, payment: outcome.payment });
        return;
      case "trip_not_found":
        res.status(404).json({ error: "الرحلة دي مش موجودة." });
        return;
      case "trip_not_in_progress":
        res.status(409).json({ error: "الرحلة دي مقفولة بالفعل." });
        return;
      case "stops_not_all_reached":
        res.status(409).json({ error: "لازم توصل كل نقط الرحلة قبل ما تقفلها." });
        return;
    }
  });

  // GET /api/captain/earnings — إضافة Phase 6. "أرباحي": الرحلات المقفولة
  // بتاعة الكابتن نفسه + مبلغ كل واحدة من الـ Ledger.
  router.get("/captain/earnings", ...guarded, (req, res) => {
    const trips = findCompletedTripsByCaptainId(db, req.auth!.userId);
    const earnings = trips.map((trip) => ({
      trip,
      stops: findTripStopsByTripId(db, trip.id),
      payment: findPaymentByTripId(db, trip.id),
    }));
    const totalConfirmedAmount = earnings.reduce(
      (sum, item) => sum + (item.payment?.amount ?? 0),
      0,
    );
    res.status(200).json({ earnings, total_amount: totalConfirmedAmount });
  });

  return router;
}
