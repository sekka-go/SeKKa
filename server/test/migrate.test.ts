import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrate.js";

describe("runMigrations", () => {
  it("يطبّق كل ملفات الـ migrations (001_init.sql إلى 010_pool_domain.sql) ويسجّلهم في schema_migrations", () => {
    const db = openDatabase(":memory:");
    const applied = runMigrations(db);

    assert.deepEqual(applied, [
      "001_init.sql",
      "002_auth.sql",
      "003_captain_profile.sql",
      "004_booking.sql",
      "005_matching.sql",
      "006_trip_payment.sql",
      "007_admin_rbac.sql",
      "008_password_change.sql",
      "009_pool_categories.sql",
      "010_pool_domain.sql",
    ]);

    for (const filename of [
      "001_init.sql",
      "002_auth.sql",
      "003_captain_profile.sql",
      "004_booking.sql",
      "005_matching.sql",
      "006_trip_payment.sql",
      "007_admin_rbac.sql",
      "008_password_change.sql",
      "009_pool_categories.sql",
      "010_pool_domain.sql",
    ]) {
      const row = db
        .prepare("SELECT filename FROM schema_migrations WHERE filename = ?")
        .get(filename);
      assert.ok(row, `${filename} لازم يكون متسجّل في schema_migrations`);
    }
  });

  it("لا يطبّق نفس الـ migration مرتين (Idempotent) عند تشغيله مرة تانية على نفس الـ DB", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);
    const secondRun = runMigrations(db);

    assert.deepEqual(secondRun, []);

    const count = db.prepare("SELECT COUNT(*) as c FROM schema_migrations").get() as {
      c: number;
    };
    assert.equal(count.c, 10);
  });

  it("بيبني الجداول المطلوبة فقط (Phase 6 + 7 + 8 + 10 + 11)", () => {
    const db = openDatabase(":memory:");
    runMigrations(db);

    const tables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        )
        .all() as unknown as { name: string }[]
    )
      .map((r) => r.name)
      .sort();

    assert.deepEqual(tables, [
      "captain_profiles",
      "daily_commute_requests",
      "matches",
      "otp_challenges",
      "payment_status_events",
      "payments",
      "pool_captain_capabilities",
      "pool_captain_stats",
      "pool_categories",
      "pool_groups",
      "pool_ledger",
      "pool_members",
      "pool_notifications",
      "pool_subscriptions",
      "pool_trip_cancellations",
      "pool_trip_stops",
      "pool_trips",
      "pricing_config",
      "schema_migrations",
      "service_categories",
      "sessions",
      "trip_stops",
      "trips",
      "users",
      "vehicle_types",
    ]);
  });
});
