import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshMigratedDb } from "./helpers.js";

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

function createOpenRequest(db: ReturnType<typeof freshMigratedDb>, phone: string): number {
  const riderId = registerUser(db, { full_name: "راكب", phone_number: phone, role: "rider" });
  const result = db
    .prepare(
      `INSERT INTO daily_commute_requests
         (rider_user_id, service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
       VALUES (?, 'faster', 30.04, 31.23, 30.05, 31.24)`,
    )
    .run(riderId);
  return Number(result.lastInsertRowid);
}

function createMatch(
  db: ReturnType<typeof freshMigratedDb>,
  requestId: number,
  captainUserId: number,
): number {
  const result = db
    .prepare(
      `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km)
       VALUES (?, ?, 0.5)`,
    )
    .run(requestId, captainUserId);
  return Number(result.lastInsertRowid);
}

describe("006_trip_payment.sql — إنشاء الرحلة تلقائيًا عند الـ Match", () => {
  it("Match جديد بيعمل صف trips واحد (in_progress) + trip_stops اتنين (pickup/dropoff منسوخين من الطلب)", () => {
    const db = freshMigratedDb();
    const captainId = createApprovedCaptain(db, "01011110001");
    const requestId = createOpenRequest(db, "01011110002");
    const matchId = createMatch(db, requestId, captainId);

    const trip = db.prepare(`SELECT * FROM trips WHERE match_id = ?`).get(matchId) as any;
    assert.ok(trip, "لازم يتعمل trip تلقائيًا");
    assert.equal(trip.status, "in_progress");
    assert.equal(trip.completed_at, null);

    const stops = db
      .prepare(`SELECT * FROM trip_stops WHERE trip_id = ? ORDER BY sequence`)
      .all(trip.id) as any[];
    assert.equal(stops.length, 2);
    assert.equal(stops[0].sequence, 1);
    assert.equal(stops[0].lat, 30.04);
    assert.equal(stops[0].lng, 31.23);
    assert.equal(stops[1].sequence, 2);
    assert.equal(stops[1].lat, 30.05);
    assert.equal(stops[1].lng, 31.24);
    assert.equal(stops[0].reached_at, null);
  });

  it("pricing_config متزرّعة (Seed) لكل vehicle_type_id (private_car, hiace)", () => {
    const db = freshMigratedDb();
    const rows = db.prepare(`SELECT vehicle_type_id FROM pricing_config ORDER BY vehicle_type_id`).all() as any[];
    assert.deepEqual(
      rows.map((r) => r.vehicle_type_id),
      ["hiace", "private_car"],
    );
  });
});

describe("006_trip_payment.sql — ترتيب الـ Stops والإقفال", () => {
  function setupTrip(db: ReturnType<typeof freshMigratedDb>) {
    const captainId = createApprovedCaptain(db, "01022220001");
    const requestId = createOpenRequest(db, "01022220002");
    const matchId = createMatch(db, requestId, captainId);
    const trip = db.prepare(`SELECT * FROM trips WHERE match_id = ?`).get(matchId) as any;
    const stops = db
      .prepare(`SELECT * FROM trip_stops WHERE trip_id = ? ORDER BY sequence`)
      .all(trip.id) as any[];
    return { captainId, trip, stops };
  }

  it("مايسمحش بتسجيل وصول Stop رقم 2 قبل ما رقم 1 يوصل", () => {
    const db = freshMigratedDb();
    const { stops } = setupTrip(db);
    assert.throws(() => {
      db.prepare(`UPDATE trip_stops SET reached_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(
        stops[1].id,
      );
    });
  });

  it("بيسمح بتسجيل وصول Stop رقم 1 مباشرة (مفيش Stop قبله)", () => {
    const db = freshMigratedDb();
    const { stops } = setupTrip(db);
    db.prepare(`UPDATE trip_stops SET reached_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(
      stops[0].id,
    );
    const updated = db.prepare(`SELECT reached_at FROM trip_stops WHERE id = ?`).get(stops[0].id) as any;
    assert.ok(updated.reached_at);
  });

  it("مايسمحش بإقفال Trip قبل ما كل الـ Stops توصل", () => {
    const db = freshMigratedDb();
    const { trip, stops } = setupTrip(db);
    db.prepare(`UPDATE trip_stops SET reached_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(
      stops[0].id,
    );
    assert.throws(() => {
      db.prepare(`UPDATE trips SET status = 'completed' WHERE id = ?`).run(trip.id);
    });
  });

  it("بيسمح بإقفال Trip بعد ما كل الـ Stops توصل", () => {
    const db = freshMigratedDb();
    const { trip, stops } = setupTrip(db);
    for (const stop of stops) {
      db.prepare(`UPDATE trip_stops SET reached_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(
        stop.id,
      );
    }
    db.prepare(`UPDATE trips SET status = 'completed' WHERE id = ?`).run(trip.id);
    const updated = db.prepare(`SELECT status FROM trips WHERE id = ?`).get(trip.id) as any;
    assert.equal(updated.status, "completed");
  });
});

describe("006_trip_payment.sql — Payment Ledger: Append-only ومرتبط بإقفال الرحلة", () => {
  function setupCompletedTrip(db: ReturnType<typeof freshMigratedDb>) {
    const captainId = createApprovedCaptain(db, "01033330001");
    const requestId = createOpenRequest(db, "01033330002");
    const matchId = createMatch(db, requestId, captainId);
    const trip = db.prepare(`SELECT * FROM trips WHERE match_id = ?`).get(matchId) as any;
    const stops = db.prepare(`SELECT id FROM trip_stops WHERE trip_id = ?`).all(trip.id) as any[];
    for (const stop of stops) {
      db.prepare(`UPDATE trip_stops SET reached_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(
        stop.id,
      );
    }
    db.prepare(`UPDATE trips SET status = 'completed' WHERE id = ?`).run(trip.id);
    return { captainId, trip };
  }

  it("مايسمحش بإدخال payment لرحلة لسه in_progress", () => {
    const db = freshMigratedDb();
    const captainId = createApprovedCaptain(db, "01044440001");
    const requestId = createOpenRequest(db, "01044440002");
    const matchId = createMatch(db, requestId, captainId);
    const trip = db.prepare(`SELECT * FROM trips WHERE match_id = ?`).get(matchId) as any;

    assert.throws(() => {
      db.prepare(
        `INSERT INTO payments (trip_id, amount, reported_by_user_id) VALUES (?, 20, ?)`,
      ).run(trip.id, captainId);
    });
  });

  it("بيسمح بإدخال payment بعد ما الرحلة تتقفل، وtrip_id UNIQUE (مفيش Ledger تاني لنفس الرحلة)", () => {
    const db = freshMigratedDb();
    const { trip, captainId } = setupCompletedTrip(db);

    db.prepare(`INSERT INTO payments (trip_id, amount, reported_by_user_id) VALUES (?, 20, ?)`).run(
      trip.id,
      captainId,
    );

    assert.throws(() => {
      db.prepare(`INSERT INTO payments (trip_id, amount, reported_by_user_id) VALUES (?, 30, ?)`).run(
        trip.id,
        captainId,
      );
    });
  });

  it("صف payments غير قابل للتعديل أو الحذف بعد إنشائه (Append-only DB-level)", () => {
    const db = freshMigratedDb();
    const { trip, captainId } = setupCompletedTrip(db);
    const result = db
      .prepare(`INSERT INTO payments (trip_id, amount, reported_by_user_id) VALUES (?, 20, ?)`)
      .run(trip.id, captainId);
    const paymentId = Number(result.lastInsertRowid);

    assert.throws(() => {
      db.prepare(`UPDATE payments SET amount = 999 WHERE id = ?`).run(paymentId);
    });
    assert.throws(() => {
      db.prepare(`DELETE FROM payments WHERE id = ?`).run(paymentId);
    });
  });

  it("payment_status_events غير قابل للتعديل أو الحذف، ومايسمحش للمُبلِّغ يأكد نفسه", () => {
    const db = freshMigratedDb();
    const { trip, captainId } = setupCompletedTrip(db);
    const paymentResult = db
      .prepare(`INSERT INTO payments (trip_id, amount, reported_by_user_id) VALUES (?, 20, ?)`)
      .run(trip.id, captainId);
    const paymentId = Number(paymentResult.lastInsertRowid);

    assert.throws(() => {
      db.prepare(
        `INSERT INTO payment_status_events (payment_id, from_status, to_status, actor_user_id)
         VALUES (?, 'confirmed', 'confirmed', ?)`,
      ).run(paymentId, captainId);
    }, "المُبلِّغ نفسه ما يقدرش يبقى actor لحدث confirmed");

    const eventResult = db
      .prepare(
        `INSERT INTO payment_status_events (payment_id, from_status, to_status, actor_user_id, reason)
         VALUES (?, 'confirmed', 'disputed', NULL, 'test')`,
      )
      .run(paymentId);
    const eventId = Number(eventResult.lastInsertRowid);

    assert.throws(() => {
      db.prepare(`UPDATE payment_status_events SET reason = 'x' WHERE id = ?`).run(eventId);
    });
    assert.throws(() => {
      db.prepare(`DELETE FROM payment_status_events WHERE id = ?`).run(eventId);
    });
  });
});
