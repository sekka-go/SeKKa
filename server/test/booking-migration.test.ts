import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshMigratedDb } from "./helpers.js";

function insertUser(
  db: ReturnType<typeof freshMigratedDb>,
  phoneNumber: string,
  role: "rider" | "captain",
) {
  db.exec(
    `INSERT INTO users (full_name, phone_number, password_hash, role)
     VALUES ('اسم', '${phoneNumber}', 'hash', '${role}')`,
  );
  const row = db.prepare("SELECT id FROM users WHERE phone_number = ?").get(phoneNumber) as {
    id: number;
  };
  return row.id;
}

const VALID_POINTS = `30.0444, 31.2357, 30.0500, 31.2400`; // pickup_lat, pickup_lng, dropoff_lat, dropoff_lng

describe("Migration 004_booking", () => {
  it("جدول daily_commute_requests اتبنى بالأعمدة المطلوبة", () => {
    const db = freshMigratedDb();
    const columns = (
      db.prepare("PRAGMA table_info(daily_commute_requests)").all() as unknown as {
        name: string;
      }[]
    ).map((c) => c.name);
    assert.deepEqual(
      columns.sort(),
      [
        "id",
        "rider_user_id",
        "service_category_id",
        "pickup_lat",
        "pickup_lng",
        "dropoff_lat",
        "dropoff_lng",
        "requested_at",
        "status",
        "created_at",
      ].sort(),
    );
  });

  it("status بيبقى 'open' افتراضيًا لو مفيش قيمة صريحة", () => {
    const db = freshMigratedDb();
    const riderId = insertUser(db, "01066666660", "rider");
    db.exec(
      `INSERT INTO daily_commute_requests
         (rider_user_id, service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
       VALUES (${riderId}, 'faster', ${VALID_POINTS})`,
    );
    const row = db
      .prepare("SELECT status FROM daily_commute_requests WHERE rider_user_id = ?")
      .get(riderId) as { status: string };
    assert.equal(row.status, "open");
  });

  it("يرفض status غير open/matched/cancelled/expired", () => {
    const db = freshMigratedDb();
    const riderId = insertUser(db, "01066666661", "rider");
    assert.throws(() => {
      db.exec(
        `INSERT INTO daily_commute_requests
           (rider_user_id, service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status)
         VALUES (${riderId}, 'faster', ${VALID_POINTS}, 'weird_status')`,
      );
    });
  });

  it("يرفض service_category_id مش موجود في service_categories", () => {
    const db = freshMigratedDb();
    const riderId = insertUser(db, "01066666662", "rider");
    assert.throws(() => {
      db.exec(
        `INSERT INTO daily_commute_requests
           (rider_user_id, service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
         VALUES (${riderId}, 'not_a_real_category', ${VALID_POINTS})`,
      );
    });
  });

  it("يمنع (Trigger) إنشاء daily_commute_requests لمستخدم role='captain'", () => {
    const db = freshMigratedDb();
    const captainId = insertUser(db, "01066666663", "captain");
    assert.throws(() => {
      db.exec(
        `INSERT INTO daily_commute_requests
           (rider_user_id, service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
         VALUES (${captainId}, 'faster', ${VALID_POINTS})`,
      );
    });
  });

  it("يرفض pickup_lat/dropoff_lat خارج المدى (-90..90)", () => {
    const db = freshMigratedDb();
    const riderId = insertUser(db, "01066666664", "rider");
    assert.throws(() => {
      db.exec(
        `INSERT INTO daily_commute_requests
           (rider_user_id, service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
         VALUES (${riderId}, 'faster', 95.0, 31.2357, 30.0500, 31.2400)`,
      );
    });
  });

  it("يرفض pickup_lng/dropoff_lng خارج المدى (-180..180)", () => {
    const db = freshMigratedDb();
    const riderId = insertUser(db, "01066666665", "rider");
    assert.throws(() => {
      db.exec(
        `INSERT INTO daily_commute_requests
           (rider_user_id, service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
         VALUES (${riderId}, 'faster', 30.0444, 200.0, 30.0500, 31.2400)`,
      );
    });
  });
});
