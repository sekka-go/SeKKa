import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshMigratedDb } from "./helpers.js";

function registerUser(
  db: ReturnType<typeof freshMigratedDb>,
  params: { full_name: string; phone_number: string; role: "rider" | "captain" | "admin" },
): number {
  const result = db
    .prepare(
      `INSERT INTO users (full_name, phone_number, password_hash, role) VALUES (?, ?, 'x', ?)`,
    )
    .run(params.full_name, params.phone_number, params.role);
  return Number(result.lastInsertRowid);
}

function createCaptainWithStatus(
  db: ReturnType<typeof freshMigratedDb>,
  phone: string,
  status: "pending" | "approved" | "rejected",
): number {
  const userId = registerUser(db, { full_name: "كابتن", phone_number: phone, role: "captain" });
  db.prepare(
    `INSERT INTO captain_profiles
       (user_id, vehicle_type_id, license_number, vehicle_plate, verification_status)
     VALUES (?, 'private_car', 'LIC', 'PLT', ?)`,
  ).run(userId, status);
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

/** يبني رحلة مقفولة + Payment Ledger 'confirmed'، وبيسجّل حدث 'disputed' فوقه. */
function setupDisputedPayment(db: ReturnType<typeof freshMigratedDb>, seed: string) {
  const captainId = createCaptainWithStatus(db, `0105${seed}1`, "approved");
  const riderRequestId = createOpenRequest(db, `0105${seed}2`);
  const matchResult = db
    .prepare(
      `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km) VALUES (?, ?, 0.5)`,
    )
    .run(riderRequestId, captainId);
  const matchId = Number(matchResult.lastInsertRowid);
  const trip = db.prepare(`SELECT * FROM trips WHERE match_id = ?`).get(matchId) as any;
  const stops = db.prepare(`SELECT id FROM trip_stops WHERE trip_id = ?`).all(trip.id) as any[];
  for (const stop of stops) {
    db.prepare(
      `UPDATE trip_stops SET reached_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    ).run(stop.id);
  }
  db.prepare(`UPDATE trips SET status = 'completed' WHERE id = ?`).run(trip.id);

  const paymentResult = db
    .prepare(`INSERT INTO payments (trip_id, amount, reported_by_user_id) VALUES (?, 20, ?)`)
    .run(trip.id, captainId);
  const paymentId = Number(paymentResult.lastInsertRowid);

  db.prepare(
    `INSERT INTO payment_status_events (payment_id, from_status, to_status, actor_user_id, reason)
     VALUES (?, 'confirmed', 'disputed', NULL, 'اعتراض تجريبي')`,
  ).run(paymentId);

  return { paymentId };
}

describe("007_admin_rbac.sql — role admin و Bootstrap account", () => {
  it("الجدول users بيقبل role='admin' بعد إعادة البناء", () => {
    const db = freshMigratedDb();
    assert.doesNotThrow(() => {
      registerUser(db, { full_name: "أدمن", phone_number: "01099990000", role: "admin" });
    });
  });

  it("فيه حساب Admin مزروع (Bootstrap) واحد بالظبط بعد الـ Migrations", () => {
    const db = freshMigratedDb();
    const admins = db.prepare(`SELECT * FROM users WHERE role = 'admin'`).all() as any[];
    assert.equal(admins.length, 1);
    assert.equal(admins[0].phone_number, "+20000000000");
    assert.ok(admins[0].password_hash.includes(":"), "لازم يكون Hash بصيغة salt:key");
  });

  it("Triggers Phase 3 (captain_profiles role guard) لسه شغالة بعد rebuild جدول users في 007", () => {
    // دفاع ضد الـ Bug اللي اتصلح فعليًا (legacy_alter_table) — لو الـ
    // Triggers دي اتكسرت، الإدخال هنا كان هيفشل بخطأ "no such table" بدل
    // الرفض المتوقع (role != captain).
    const db = freshMigratedDb();
    const riderId = registerUser(db, {
      full_name: "راكب",
      phone_number: "01099990001",
      role: "rider",
    });
    assert.throws(() => {
      db.prepare(
        `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate)
         VALUES (?, 'private_car', 'LIC', 'PLT')`,
      ).run(riderId);
    });
  });
});

describe("007_admin_rbac.sql — أفعال الأدمن على payment_status_events", () => {
  it("مايسمحش resolve/adjust/void إلا لو from_status='disputed'", () => {
    const db = freshMigratedDb();
    const { paymentId } = setupDisputedPayment(db, "1000");
    const adminId = registerUser(db, {
      full_name: "أدمن",
      phone_number: "01099990002",
      role: "admin",
    });

    assert.throws(() => {
      db.prepare(
        `INSERT INTO payment_status_events
           (payment_id, from_status, to_status, actor_user_id, reason)
         VALUES (?, 'confirmed', 'resolved', ?, 'x')`,
      ).run(paymentId, adminId);
    });
  });

  it("مايسمحش actor_user_id يكون NULL أو مستخدم مش admin لفعل إداري", () => {
    const db = freshMigratedDb();
    const { paymentId } = setupDisputedPayment(db, "2000");
    const riderId = registerUser(db, {
      full_name: "راكب تاني",
      phone_number: "01099990003",
      role: "rider",
    });

    assert.throws(() => {
      db.prepare(
        `INSERT INTO payment_status_events
           (payment_id, from_status, to_status, actor_user_id, reason)
         VALUES (?, 'disputed', 'resolved', NULL, 'x')`,
      ).run(paymentId);
    }, "actor_user_id NULL لازم يترفض");

    assert.throws(() => {
      db.prepare(
        `INSERT INTO payment_status_events
           (payment_id, from_status, to_status, actor_user_id, reason)
         VALUES (?, 'disputed', 'resolved', ?, 'x')`,
      ).run(paymentId, riderId);
    }, "actor_user_id لمستخدم مش admin لازم يترفض");
  });

  it("مايسمحش to_status='adjusted' من غير adjusted_amount", () => {
    const db = freshMigratedDb();
    const { paymentId } = setupDisputedPayment(db, "3000");
    const adminId = registerUser(db, {
      full_name: "أدمن",
      phone_number: "01099990004",
      role: "admin",
    });

    assert.throws(() => {
      db.prepare(
        `INSERT INTO payment_status_events
           (payment_id, from_status, to_status, actor_user_id, reason, adjusted_amount)
         VALUES (?, 'disputed', 'adjusted', ?, 'x', NULL)`,
      ).run(paymentId, adminId);
    });
  });

  it("بيسمح بـ resolve/adjust/void صحيحة (admin حقيقي + from_status='disputed')", () => {
    const db = freshMigratedDb();
    const adminId = registerUser(db, {
      full_name: "أدمن",
      phone_number: "01099990005",
      role: "admin",
    });

    const resolved = setupDisputedPayment(db, "4000");
    assert.doesNotThrow(() => {
      db.prepare(
        `INSERT INTO payment_status_events
           (payment_id, from_status, to_status, actor_user_id, reason)
         VALUES (?, 'disputed', 'resolved', ?, 'اتأكد إن المبلغ صح')`,
      ).run(resolved.paymentId, adminId);
    });

    const adjusted = setupDisputedPayment(db, "5000");
    assert.doesNotThrow(() => {
      db.prepare(
        `INSERT INTO payment_status_events
           (payment_id, from_status, to_status, actor_user_id, reason, adjusted_amount)
         VALUES (?, 'disputed', 'adjusted', ?, 'تعديل بعد المراجعة', 15)`,
      ).run(adjusted.paymentId, adminId);
    });

    const voided = setupDisputedPayment(db, "6000");
    assert.doesNotThrow(() => {
      db.prepare(
        `INSERT INTO payment_status_events
           (payment_id, from_status, to_status, actor_user_id, reason)
         VALUES (?, 'disputed', 'voided', ?, 'رحلة ملغاة بالغلط')`,
      ).run(voided.paymentId, adminId);
    });
  });
});

describe("007_admin_rbac.sql — منع تحديث verification_status بلا فايدة (No-op)", () => {
  it("مايسمحش UPDATE لنفس القيمة القديمة بالظبط", () => {
    const db = freshMigratedDb();
    const captainId = createCaptainWithStatus(db, "01099990006", "pending");
    assert.throws(() => {
      db.prepare(`UPDATE captain_profiles SET verification_status = 'pending' WHERE user_id = ?`).run(
        captainId,
      );
    });
  });

  it("بيسمح بتحديث لقيمة مختلفة فعليًا", () => {
    const db = freshMigratedDb();
    const captainId = createCaptainWithStatus(db, "01099990007", "pending");
    db.prepare(`UPDATE captain_profiles SET verification_status = 'approved' WHERE user_id = ?`).run(
      captainId,
    );
    const row = db
      .prepare(`SELECT verification_status FROM captain_profiles WHERE user_id = ?`)
      .get(captainId) as any;
    assert.equal(row.verification_status, "approved");
  });
});
