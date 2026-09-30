import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshMigratedDb } from "./helpers.js";
import { arriveAtTripStop, completeTripAndLedgerPayment } from "../src/trip/lifecycle.js";
import { findTripStopsByTripId } from "../src/db/trip-repository.js";
import { currentPaymentStatus, findPaymentByTripId } from "../src/db/payment-repository.js";
import { haversineDistanceKm } from "../src/db/matching-repository.js";

function registerUser(
  db: ReturnType<typeof freshMigratedDb>,
  params: { full_name: string; phone_number: string; role: "rider" | "captain" },
): number {
  const result = db
    .prepare(
      `INSERT INTO users (full_name, phone_number, password_hash, role) VALUES (?, ?, 'x', ?)`,
    )
    .run(params.full_name, params.phone_number, params.role);
  return Number(result.lastInsertRowid);
}

function createApprovedCaptain(db: ReturnType<typeof freshMigratedDb>, phone: string): number {
  const userId = registerUser(db, { full_name: "كابتن", phone_number: phone, role: "captain" });
  db.prepare(
    `INSERT INTO captain_profiles
       (user_id, vehicle_type_id, license_number, vehicle_plate, verification_status, current_lat, current_lng)
     VALUES (?, 'private_car', 'LIC', 'PLT', 'approved', 30.05, 31.24)`,
  ).run(userId);
  return userId;
}

function setupMatchedTrip(db: ReturnType<typeof freshMigratedDb>, phoneSuffix: string) {
  const captainId = createApprovedCaptain(db, `0105${phoneSuffix}1`);
  const riderId = registerUser(db, { full_name: "راكب", phone_number: `0105${phoneSuffix}2`, role: "rider" });
  const reqResult = db
    .prepare(
      `INSERT INTO daily_commute_requests
         (rider_user_id, service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
       VALUES (?, 'faster', 30.04, 31.23, 30.05, 31.24)`,
    )
    .run(riderId);
  const requestId = Number(reqResult.lastInsertRowid);
  const matchResult = db
    .prepare(
      `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km) VALUES (?, ?, 0.5)`,
    )
    .run(requestId, captainId);
  const matchId = Number(matchResult.lastInsertRowid);
  const trip = db.prepare(`SELECT id FROM trips WHERE match_id = ?`).get(matchId) as { id: number };
  const stops = findTripStopsByTripId(db, trip.id);
  return { captainId, riderId, tripId: trip.id, stops };
}

describe("arriveAtTripStop", () => {
  it("وصول Stop رقم 1: distance=0، fare = base_fee + rate_per_min × الدقايق من بداية الرحلة", () => {
    const db = freshMigratedDb();
    const { tripId, stops } = setupMatchedTrip(db, "10");
    const outcome = arriveAtTripStop(db, tripId, stops[0].id);
    assert.equal(outcome.outcome, "arrived");
    if (outcome.outcome === "arrived") {
      assert.ok(outcome.stop.reached_at);
      assert.ok(outcome.stop.fare_at_stop! >= 10.0); // base_fee بتاعة private_car
    }
  });

  it("وصول Stop رقم 2 قبل رقم 1 → out_of_sequence", () => {
    const db = freshMigratedDb();
    const { tripId, stops } = setupMatchedTrip(db, "20");
    const outcome = arriveAtTripStop(db, tripId, stops[1].id);
    assert.equal(outcome.outcome, "out_of_sequence");
  });

  it("وصول نفس الـ Stop مرتين → already_arrived في المرة التانية", () => {
    const db = freshMigratedDb();
    const { tripId, stops } = setupMatchedTrip(db, "30");
    arriveAtTripStop(db, tripId, stops[0].id);
    const second = arriveAtTripStop(db, tripId, stops[0].id);
    assert.equal(second.outcome, "already_arrived");
  });

  it("Stop رقم 2 بعد رقم 1: fare_at_stop تراكمي (المسافة = هافرساين بين الاتنين)", () => {
    const db = freshMigratedDb();
    const { tripId, stops } = setupMatchedTrip(db, "40");
    arriveAtTripStop(db, tripId, stops[0].id);
    const outcome = arriveAtTripStop(db, tripId, stops[1].id);
    assert.equal(outcome.outcome, "arrived");
    const expectedDistance = haversineDistanceKm(stops[0].lat, stops[0].lng, stops[1].lat, stops[1].lng);
    if (outcome.outcome === "arrived") {
      // fare_at_stop لازم يكون على الأقل base_fee + rate_per_km × المسافة المتوقعة
      assert.ok(outcome.stop.fare_at_stop! >= 10.0 + 3.5 * expectedDistance - 0.01);
    }
  });

  it("trip_id مش موجود → trip_not_found", () => {
    const db = freshMigratedDb();
    const outcome = arriveAtTripStop(db, 9999, 1);
    assert.equal(outcome.outcome, "trip_not_found");
  });
});

describe("completeTripAndLedgerPayment", () => {
  it("مايكملش قبل ما كل الـ Stops توصل", () => {
    const db = freshMigratedDb();
    const { tripId, stops } = setupMatchedTrip(db, "50");
    arriveAtTripStop(db, tripId, stops[0].id);
    const outcome = completeTripAndLedgerPayment(db, tripId);
    assert.equal(outcome.outcome, "stops_not_all_reached");
  });

  it("بعد كل الـ Stops: بيقفل الرحلة ويعمل Payment Confirmed أوتوماتيك في نفس اللحظة", () => {
    const db = freshMigratedDb();
    const { tripId, stops, captainId } = setupMatchedTrip(db, "60");
    arriveAtTripStop(db, tripId, stops[0].id);
    const lastArrival = arriveAtTripStop(db, tripId, stops[1].id);
    assert.equal(lastArrival.outcome, "arrived");

    const outcome = completeTripAndLedgerPayment(db, tripId);
    assert.equal(outcome.outcome, "completed");
    if (outcome.outcome === "completed") {
      assert.equal(outcome.trip.status, "completed");
      assert.ok(outcome.trip.total_distance_km! > 0);
      assert.equal(outcome.payment.reported_by_user_id, captainId);
      assert.equal(outcome.payment.amount, outcome.trip.total_amount);

      const status = currentPaymentStatus(db, outcome.payment.id);
      assert.equal(status, "confirmed", "التأكيد نظامي أوتوماتيك من نفس لحظة الإدخال");
    }
  });

  it("Idempotent-safe: استدعاء تاني لرحلة اتقفلت بالفعل بيرجّع trip_not_in_progress من غير Ledger تاني", () => {
    const db = freshMigratedDb();
    const { tripId, stops } = setupMatchedTrip(db, "70");
    arriveAtTripStop(db, tripId, stops[0].id);
    arriveAtTripStop(db, tripId, stops[1].id);
    completeTripAndLedgerPayment(db, tripId);

    const second = completeTripAndLedgerPayment(db, tripId);
    assert.equal(second.outcome, "trip_not_in_progress");

    const paymentsCount = db.prepare(`SELECT COUNT(*) as c FROM payments WHERE trip_id = ?`).get(tripId) as {
      c: number;
    };
    assert.equal(paymentsCount.c, 1);
  });

  it("trip_not_found لرحلة مش موجودة", () => {
    const db = freshMigratedDb();
    const outcome = completeTripAndLedgerPayment(db, 9999);
    assert.equal(outcome.outcome, "trip_not_found");
  });
});
