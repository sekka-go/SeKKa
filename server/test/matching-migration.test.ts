import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshMigratedDb } from "./helpers.js";

function registerUser(db: ReturnType<typeof freshMigratedDb>, params: {
  full_name: string;
  phone_number: string;
  role: "rider" | "captain";
}): number {
  const result = db
    .prepare(
      `INSERT INTO users (full_name, phone_number, password_hash, role) VALUES (?, ?, 'x', ?)`,
    )
    .run(params.full_name, params.phone_number, params.role);
  return Number(result.lastInsertRowid);
}

function createApprovedCaptain(
  db: ReturnType<typeof freshMigratedDb>,
  phone: string,
  lat: number | null = 30.05,
  lng: number | null = 31.24,
): number {
  const userId = registerUser(db, { full_name: "كابتن", phone_number: phone, role: "captain" });
  db.prepare(
    `INSERT INTO captain_profiles
       (user_id, vehicle_type_id, license_number, vehicle_plate, verification_status, current_lat, current_lng)
     VALUES (?, 'private_car', 'LIC', 'PLT', 'approved', ?, ?)`,
  ).run(userId, lat, lng);
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

describe("Migration 005 — captain_profiles.current_lat/current_lng", () => {
  it("بتقبل NULL افتراضيًا (كابتن لسه مبعتش موقعه)", () => {
    const db = freshMigratedDb();
    const userId = registerUser(db, {
      full_name: "كابتن",
      phone_number: "01099900001",
      role: "captain",
    });
    db.prepare(
      `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate)
       VALUES (?, 'private_car', 'L', 'P')`,
    ).run(userId);

    const row = db
      .prepare("SELECT current_lat, current_lng FROM captain_profiles WHERE user_id = ?")
      .get(userId) as { current_lat: number | null; current_lng: number | null };
    assert.equal(row.current_lat, null);
    assert.equal(row.current_lng, null);
  });

  it("يرفض current_lat/current_lng خارج المدى الجغرافي", () => {
    const db = freshMigratedDb();
    const userId = registerUser(db, {
      full_name: "كابتن",
      phone_number: "01099900002",
      role: "captain",
    });

    assert.throws(() => {
      db.prepare(
        `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate, current_lat)
         VALUES (?, 'private_car', 'L', 'P', 999)`,
      ).run(userId);
    });

    assert.throws(() => {
      db.prepare(
        `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate, current_lng)
         VALUES (?, 'private_car', 'L', 'P', -999)`,
      ).run(userId);
    });
  });
});

describe("Migration 005 — matches", () => {
  it("Match واحد بس لكل Request (UNIQUE)", () => {
    const db = freshMigratedDb();
    const captainId = createApprovedCaptain(db, "01099900010");
    const requestId = createOpenRequest(db, "01099900011");

    db.prepare(
      `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km) VALUES (?, ?, 1.0)`,
    ).run(requestId, captainId);

    assert.throws(() => {
      db.prepare(
        `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km) VALUES (?, ?, 2.0)`,
      ).run(requestId, captainId);
    });
  });

  it("الـ Trigger بيمنع captain_user_id لغير role='captain'", () => {
    const db = freshMigratedDb();
    const riderId = registerUser(db, {
      full_name: "راكب",
      phone_number: "01099900020",
      role: "rider",
    });
    const requestId = createOpenRequest(db, "01099900021");

    assert.throws(() => {
      db.prepare(
        `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km) VALUES (?, ?, 1.0)`,
      ).run(requestId, riderId);
    });
  });

  it("الـ Trigger بيمنع Match لطلب مش open", () => {
    const db = freshMigratedDb();
    const captainId = createApprovedCaptain(db, "01099900030");
    const requestId = createOpenRequest(db, "01099900031");
    db.prepare(`UPDATE daily_commute_requests SET status = 'cancelled' WHERE id = ?`).run(
      requestId,
    );

    assert.throws(() => {
      db.prepare(
        `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km) VALUES (?, ?, 1.0)`,
      ).run(requestId, captainId);
    });
  });

  it("بعد إدخال Match، daily_commute_requests.status بيتحدّث تلقائيًا لـ matched", () => {
    const db = freshMigratedDb();
    const captainId = createApprovedCaptain(db, "01099900040");
    const requestId = createOpenRequest(db, "01099900041");

    db.prepare(
      `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km) VALUES (?, ?, 1.0)`,
    ).run(requestId, captainId);

    const row = db
      .prepare("SELECT status FROM daily_commute_requests WHERE id = ?")
      .get(requestId) as { status: string };
    assert.equal(row.status, "matched");
  });

  it("يرفض distance_km سالبة", () => {
    const db = freshMigratedDb();
    const captainId = createApprovedCaptain(db, "01099900050");
    const requestId = createOpenRequest(db, "01099900051");

    assert.throws(() => {
      db.prepare(
        `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km) VALUES (?, ?, -1)`,
      ).run(requestId, captainId);
    });
  });
});
