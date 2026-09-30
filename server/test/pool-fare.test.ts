import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshMigratedDb } from "./helpers.js";
import {
  MAX_CAPTAIN_TO_FIRST_PICKUP_KM,
  calculatePerSeatFare,
  calculatePoolRouteFare,
  calculateRoundTripPerSeatFare,
  findPoolCategory,
  isCaptainWithinPickupRange,
} from "../src/pricing/pool-fare.js";

describe("pool_categories (009)", () => {
  it("الفئات الأربعة موجودة بالأرقام المعتمدة", () => {
    const db = freshMigratedDb();
    const expected: Record<string, [number, number, number, number]> = {
      faster_non_ac: [3, 10, 7.3, 0.5],
      faster_ac: [3, 12, 8.2, 0.6],
      saver_non_ac: [4, 15, 7.3, 0.75],
      saver_ac: [4, 17, 8.2, 0.85],
    };
    for (const [id, [seats, base, km, min]] of Object.entries(expected)) {
      const c = findPoolCategory(db, id)!;
      assert.ok(c, id);
      assert.deepEqual([c.seats, c.base_fee, c.rate_per_km, c.rate_per_min], [seats, base, km, min]);
    }
    assert.equal(findPoolCategory(db, "nope"), null);
  });
});

describe("pool fare", () => {
  const db = freshMigratedDb();

  it("Faster-AC: رحلة الخريطة (37كم/41.5د) = 226.87 للفرد يوميًا", () => {
    const c = findPoolCategory(db, "faster_ac")!;
    assert.equal(calculatePoolRouteFare(c, 37, 41.5), 340.3);
    assert.equal(calculateRoundTripPerSeatFare(c, 37, 41.5), 226.87);
  });

  it("باقي الفئات على نفس الرحلة", () => {
    const expected: Record<string, number> = {
      faster_non_ac: 200.57,
      saver_non_ac: 158.11,
      saver_ac: 177.84,
    };
    for (const [id, price] of Object.entries(expected)) {
      assert.equal(calculateRoundTripPerSeatFare(findPoolCategory(db, id)!, 37, 41.5), price, id);
    }
  });

  it("تقسيم السعر على المقاعد", () => {
    assert.equal(calculatePerSeatFare(105, 3), 35);
    assert.equal(calculatePerSeatFare(112.5, 4), 28.13);
  });

  it("حد الكابتن 4 كم", () => {
    assert.equal(MAX_CAPTAIN_TO_FIRST_PICKUP_KM, 4);
    assert.equal(isCaptainWithinPickupRange(4), true);
    assert.equal(isCaptainWithinPickupRange(4.01), false);
  });
});
