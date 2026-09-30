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

describe("Migration 003_captain_profile", () => {
  it("جدول captain_profiles اتبنى بالأعمدة المطلوبة", () => {
    const db = freshMigratedDb();
    const columns = (
      db.prepare("PRAGMA table_info(captain_profiles)").all() as unknown as { name: string }[]
    ).map((c) => c.name);
    assert.deepEqual(
      columns.sort(),
      [
        "id",
        "user_id",
        "vehicle_type_id",
        "license_number",
        "vehicle_plate",
        "verification_status",
        "current_lat",
        "current_lng",
        "created_at",
      ].sort(),
    );
  });

  it("جدول otp_challenges اتبنى بالأعمدة المطلوبة", () => {
    const db = freshMigratedDb();
    const columns = (
      db.prepare("PRAGMA table_info(otp_challenges)").all() as unknown as { name: string }[]
    ).map((c) => c.name);
    assert.deepEqual(
      columns.sort(),
      ["id", "user_id", "otp_hash", "created_at", "expires_at", "consumed_at", "purpose"].sort(),
    );
  });

  it("verification_status بيبقى 'pending' افتراضيًا لو مفيش قيمة صريحة", () => {
    const db = freshMigratedDb();
    const userId = insertUser(db, "01044444440", "captain");
    db.exec(
      `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate)
       VALUES (${userId}, 'private_car', 'LIC1', 'ABC 123')`,
    );
    const row = db
      .prepare("SELECT verification_status FROM captain_profiles WHERE user_id = ?")
      .get(userId) as { verification_status: string };
    assert.equal(row.verification_status, "pending");
  });

  it("يرفض verification_status غير pending/approved/rejected", () => {
    const db = freshMigratedDb();
    const userId = insertUser(db, "01044444441", "captain");
    assert.throws(() => {
      db.exec(
        `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate, verification_status)
         VALUES (${userId}, 'private_car', 'LIC1', 'ABC 123', 'elite')`,
      );
    });
  });

  it("يرفض vehicle_type_id مش موجود في vehicle_types (بما فيه elite)", () => {
    const db = freshMigratedDb();
    const userId = insertUser(db, "01044444442", "captain");
    assert.throws(() => {
      db.exec(
        `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate)
         VALUES (${userId}, 'elite', 'LIC1', 'ABC 123')`,
      );
    });
  });

  it("يمنع (Trigger) إنشاء captain_profiles لمستخدم role='rider'", () => {
    const db = freshMigratedDb();
    const riderId = insertUser(db, "01044444443", "rider");
    assert.throws(() => {
      db.exec(
        `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate)
         VALUES (${riderId}, 'private_car', 'LIC1', 'ABC 123')`,
      );
    });
  });

  it("يمنع أكتر من captain_profiles لنفس user_id (UNIQUE)", () => {
    const db = freshMigratedDb();
    const userId = insertUser(db, "01044444444", "captain");
    db.exec(
      `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate)
       VALUES (${userId}, 'private_car', 'LIC1', 'ABC 123')`,
    );
    assert.throws(() => {
      db.exec(
        `INSERT INTO captain_profiles (user_id, vehicle_type_id, license_number, vehicle_plate)
         VALUES (${userId}, 'hiace', 'LIC2', 'XYZ 999')`,
      );
    });
  });

  it("يرفض otp_challenges.purpose غير 'phone_verification'", () => {
    const db = freshMigratedDb();
    const userId = insertUser(db, "01044444445", "captain");
    assert.throws(() => {
      db.exec(
        `INSERT INTO otp_challenges (user_id, otp_hash, expires_at, purpose)
         VALUES (${userId}, 'hash', '2999-01-01T00:00:00.000Z', 'something_else')`,
      );
    });
  });
});
