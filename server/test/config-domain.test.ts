import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getServiceCategories, getVehicleTypes } from "../src/db/config-repository.js";
import { freshMigratedDb } from "./helpers.js";

describe("Config domain — القراءة السليمة", () => {
  it("vehicle_types يرجّع بالضبط private_car (3) و hiace (14)، بدون Elite", () => {
    const db = freshMigratedDb();
    const vehicleTypes = getVehicleTypes(db);

    assert.deepEqual(vehicleTypes, [
      { id: "hiace", name_ar: "هاي إس", capacity_max: 14 },
      { id: "private_car", name_ar: "ملاكي", capacity_max: 3 },
    ]);
    assert.equal(
      vehicleTypes.some((v) => v.id.toLowerCase().includes("elite")),
      false,
    );
  });

  it("service_categories يرجّع بالضبط faster/plus/saver بالقيم الصحيحة، بدون Elite", () => {
    const db = freshMigratedDb();
    const categories = getServiceCategories(db);

    assert.deepEqual(categories, [
      { id: "faster", vehicle_type_id: "private_car", name_ar: "فاستر", max_seats: 3, ac_rule: "none" },
      { id: "plus", vehicle_type_id: "private_car", name_ar: "بلس", max_seats: 3, ac_rule: "required" },
      { id: "saver", vehicle_type_id: "hiace", name_ar: "سيفر", max_seats: 14, ac_rule: "optional" },
    ]);
    assert.equal(
      categories.some((c) => c.id.toLowerCase().includes("elite")),
      false,
    );
  });
});

describe("Config domain — رفض Elite على مستوى الـ DB (CHECK constraint)", () => {
  it("يرفض إدخال vehicle_types بكود 'elite' (بأي حالة أحرف)", () => {
    const db = freshMigratedDb();
    assert.throws(
      () =>
        db
          .prepare("INSERT INTO vehicle_types (id, name_ar, capacity_max) VALUES (?, ?, ?)")
          .run("Elite", "إيليت", 4),
      /CHECK constraint failed/,
    );
  });

  it("يرفض إدخال service_categories بكود 'elite'", () => {
    const db = freshMigratedDb();
    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO service_categories (id, vehicle_type_id, name_ar, max_seats, ac_rule) VALUES (?, ?, ?, ?, ?)",
          )
          .run("ELITE", "private_car", "إيليت", 3, "required"),
      /CHECK constraint failed/,
    );
  });

  it("يرفض service_categories.name_ar لو فيه كلمة elite جواها حتى لو الـ id مختلف", () => {
    const db = freshMigratedDb();
    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO service_categories (id, vehicle_type_id, name_ar, max_seats, ac_rule) VALUES (?, ?, ?, ?, ?)",
          )
          .run("premium", "private_car", "Elite Class", 3, "required"),
      /CHECK constraint failed/,
    );
  });
});

describe("Config domain — رفض max_seats > capacity_max (trigger دفاع ثانٍ)", () => {
  it("يرفض إدخال service_category بـ max_seats أكبر من capacity_max بتاع الـ vehicle_type", () => {
    const db = freshMigratedDb();
    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO service_categories (id, vehicle_type_id, name_ar, max_seats, ac_rule) VALUES (?, ?, ?, ?, ?)",
          )
          .run("oversized", "private_car", "زيادة عن الحد", 5, "none"),
      /exceeds vehicle_types\.capacity_max/,
    );
  });

  it("يرفض تحديث service_category لاحقًا يخليه يتخطى capacity_max", () => {
    const db = freshMigratedDb();
    assert.throws(
      () => db.prepare("UPDATE service_categories SET max_seats = ? WHERE id = ?").run(4, "faster"),
      /exceeds vehicle_types\.capacity_max/,
    );
  });

  it("يرفض تحديث vehicle_types.capacity_max لو هيكسر فئة قائمة مرتبطة بيه", () => {
    const db = freshMigratedDb();
    assert.throws(
      () => db.prepare("UPDATE vehicle_types SET capacity_max = ? WHERE id = ?").run(10, "hiace"),
      /would violate/,
    );
  });

  it("يسمح بإدخال service_category صحيحة (max_seats <= capacity_max)", () => {
    const db = freshMigratedDb();
    assert.doesNotThrow(() =>
      db
        .prepare(
          "INSERT INTO service_categories (id, vehicle_type_id, name_ar, max_seats, ac_rule) VALUES (?, ?, ?, ?, ?)",
        )
        .run("mini_saver", "hiace", "سيفر ميني", 10, "optional"),
    );
  });
});
