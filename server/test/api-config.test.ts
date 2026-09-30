import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

describe("GET /api/config", () => {
  it("يرجّع 200 مع vehicle_types و service_categories صحيحين من الـ DB", async () => {
    const app = createApp(freshMigratedDb());
    const res = await request(app).get("/api/config");

    assert.equal(res.status, 200);
    assert.equal(res.body.vehicle_types.length, 2);
    assert.equal(res.body.service_categories.length, 3);
    assert.deepEqual(
      res.body.vehicle_types.map((v: { id: string }) => v.id).sort(),
      ["hiace", "private_car"],
    );
    assert.deepEqual(
      res.body.service_categories.map((c: { id: string }) => c.id).sort(),
      ["faster", "plus", "saver"],
    );
  });

  it("مفيش أي أثر لـ Elite في استجابة /api/config", async () => {
    const app = createApp(freshMigratedDb());
    const res = await request(app).get("/api/config");

    const raw = JSON.stringify(res.body).toLowerCase();
    assert.equal(raw.includes("elite"), false);
  });
});

describe("GET /api/health", () => {
  it("لسه بيرجّع 200 (باقي من Phase 0)", async () => {
    const app = createApp(freshMigratedDb());
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });
});
