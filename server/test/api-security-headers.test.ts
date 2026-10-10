import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

describe("API security headers and request limits", () => {
  it("sets browser security headers and hides Express", async () => {
    const response = await request(createApp(freshMigratedDb())).get("/api/health");
    assert.equal(response.status, 200);
    assert.equal(response.headers["x-powered-by"], undefined);
    assert.match(response.headers["content-security-policy"], /frame-ancestors 'none'/);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(response.headers["permissions-policy"], "geolocation=(self), camera=(), microphone=()");
  });

  it("rejects JSON bodies above the configured limit with a generic 413", async () => {
    const response = await request(createApp(freshMigratedDb()))
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ full_name: "x".repeat(300_000) }));
    assert.equal(response.status, 413);
    assert.deepEqual(response.body, { error: "حجم الطلب أكبر من المسموح." });
  });

  it("returns a generic client error for malformed JSON", async () => {
    const response = await request(createApp(freshMigratedDb()))
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{invalid");
    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: "صيغة الطلب غير صحيحة." });
  });
});
