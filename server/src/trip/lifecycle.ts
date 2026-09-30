import type { DatabaseSync } from "node:sqlite";
import { haversineDistanceKm } from "../db/matching-repository.js";
import { findCaptainProfileByUserId } from "../db/captain-repository.js";
import { calculateFare, findPricingConfig, minutesBetween } from "../pricing/fare.js";
import {
  completeTrip as completeTripRow,
  findTripById,
  findTripStopById,
  findTripStopsByTripId,
  findTripWithContextById,
  markTripStopReached,
  type TripRecord,
  type TripStopRecord,
} from "../db/trip-repository.js";
import { insertPayment, type PaymentRecord } from "../db/payment-repository.js";

/**
 * منطق دورة حياة الرحلة الأوحد والمعتمد (قاعدة عامة 5 — Server-Authoritative،
 * مفيش تكرار لمنطق حساب المسافة/المبلغ في أكتر من مكان). الـ Routes بتنادي
 * الدالتين دول بس، مفيش حساب Fare مباشر في أي Route.
 */

export type ArriveOutcome =
  | { outcome: "arrived"; stop: TripStopRecord }
  | { outcome: "trip_not_found" }
  | { outcome: "stop_not_found" }
  | { outcome: "trip_not_in_progress" }
  | { outcome: "already_arrived" }
  | { outcome: "out_of_sequence" }
  | { outcome: "pricing_unavailable" };

/**
 * يسجّل وصول الكابتن لنقطة Stop، ويحسب fare_at_stop **تراكمي من بداية
 * الرحلة** (مش تراكمي من آخر Stop بس) عبر calculateFare() — المسافة
 * التراكمية = مجموع الأجزاء الجغرافية بين كل Stop والـ Stop اللي قبله لحد
 * دلوقتي (Stop رقم 1 نفسه = صفر كم، مفيش تتبّع لمسار الكابتن قبل الوصول
 * لأول نقطة)، والزمن التراكمي = من trip.started_at لحد دلوقتي مباشرة.
 */
export function arriveAtTripStop(
  db: DatabaseSync,
  tripId: number,
  stopId: number,
): ArriveOutcome {
  const trip = findTripById(db, tripId);
  if (!trip) return { outcome: "trip_not_found" };
  if (trip.status !== "in_progress") return { outcome: "trip_not_in_progress" };

  const stop = findTripStopById(db, stopId);
  if (!stop || stop.trip_id !== tripId) return { outcome: "stop_not_found" };
  if (stop.reached_at !== null) return { outcome: "already_arrived" };

  const allStops = findTripStopsByTripId(db, tripId);
  const previousStop = allStops.find((s) => s.sequence === stop.sequence - 1) ?? null;
  if (stop.sequence > 1 && (!previousStop || previousStop.reached_at === null)) {
    return { outcome: "out_of_sequence" };
  }

  const ctx = findTripWithContextById(db, tripId)!;
  const captainProfile = findCaptainProfileByUserId(db, ctx.captain_user_id);
  const pricing = captainProfile ? findPricingConfig(db, captainProfile.vehicle_type_id) : null;
  if (!pricing) return { outcome: "pricing_unavailable" };

  const cumulativeDistanceKm = previousStop
    ? haversineDistanceKm(previousStop.lat, previousStop.lng, stop.lat, stop.lng)
    : 0;
  const cumulativeDurationMin = minutesBetween(trip.started_at, new Date().toISOString());
  const fare = calculateFare(pricing, cumulativeDistanceKm, cumulativeDurationMin);

  const updated = markTripStopReached(db, stopId, fare);
  // لو null دلوقتي (Race نادر: حد تاني سجّل الوصول في نفس اللحظة)، already_arrived.
  if (!updated) return { outcome: "already_arrived" };
  return { outcome: "arrived", stop: updated };
}

export type CompleteOutcome =
  | { outcome: "completed"; trip: TripRecord; payment: PaymentRecord }
  | { outcome: "trip_not_found" }
  | { outcome: "trip_not_in_progress" }
  | { outcome: "stops_not_all_reached" };

/**
 * يقفل الرحلة (بعد ما يتأكد كل الـ Stops وصلت) ويعمل صف Payment Ledger في
 * نفس الـ Transaction — لحظة إقفال الرحلة بالظبط، مش قبلها ولا بعدها
 * (BEGIN IMMEDIATE/COMMIT/ROLLBACK، نفس نمط runAutomaticMatching بتاع
 * Phase 5). التأكيد نظامي أوتوماتيك (مفيش actor بشري) لأن صف payments نفسه
 * بيتعمل Confirmed من لحظة إنشائه — راجع 006_trip_payment.sql.
 */
export function completeTripAndLedgerPayment(db: DatabaseSync, tripId: number): CompleteOutcome {
  const trip = findTripById(db, tripId);
  if (!trip) return { outcome: "trip_not_found" };
  if (trip.status !== "in_progress") return { outcome: "trip_not_in_progress" };

  const stops = findTripStopsByTripId(db, tripId);
  if (stops.length === 0 || stops.some((s) => s.reached_at === null)) {
    return { outcome: "stops_not_all_reached" };
  }

  let totalDistanceKm = 0;
  for (let i = 1; i < stops.length; i++) {
    totalDistanceKm += haversineDistanceKm(
      stops[i - 1].lat,
      stops[i - 1].lng,
      stops[i].lat,
      stops[i].lng,
    );
  }
  const totalAmount = stops[stops.length - 1].fare_at_stop!;

  const ctx = findTripWithContextById(db, tripId)!;

  db.exec("BEGIN IMMEDIATE");
  try {
    const updatedTrip = completeTripRow(db, tripId, totalDistanceKm, totalAmount);
    if (!updatedTrip) {
      db.exec("ROLLBACK");
      return { outcome: "trip_not_in_progress" };
    }

    const payment = insertPayment(db, {
      trip_id: tripId,
      amount: totalAmount,
      reported_by_user_id: ctx.captain_user_id,
    });

    db.exec("COMMIT");
    return { outcome: "completed", trip: updatedTrip, payment };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
