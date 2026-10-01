import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/security/password.js";
import { freshMigratedDb } from "./helpers.js";

async function registerAndLogin(app: ReturnType<typeof createApp>, role: "rider" | "captain", suffix: string) {
  const phone = `010799${suffix}`;
  await request(app).post("/api/auth/register").send({ full_name: role, phone_number: phone, password: "Passw0rd!", role });
  const response = await request(app).post("/api/auth/login").send({ phone_number: phone, password: "Passw0rd!" });
  return response.body.token as string;
}

describe("Commute Pool account preferences and admin operations", () => {
  it("persists captain vehicle capabilities and search radius", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await registerAndLogin(app, "captain", "001");
    const auth = { Authorization: `Bearer ${token}` };

    const defaults = await request(app).get("/api/captain/pool/preferences").set(auth);
    assert.equal(defaults.status, 200);
    assert.equal(defaults.body.radius_km, 4);
    assert.deepEqual(defaults.body.service_tiers, ["faster", "saver"]);

    await request(app).put("/api/captain/pool/capabilities").set(auth)
      .send({ has_ac: false, service_tiers: ["saver"] }).expect(200);
    await request(app).patch("/api/captain/pool/search-radius").set(auth)
      .send({ radius_km: 8 }).expect(200);

    const saved = await request(app).get("/api/captain/pool/preferences").set(auth);
    assert.equal(saved.body.radius_km, 8);
    assert.equal(saved.body.has_ac, false);
    assert.deepEqual(saved.body.service_tiers, ["saver"]);
  });

  it("protects the deferred pool settlement overview from non-admin users", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const riderToken = await registerAndLogin(app, "rider", "002");
    await request(app).get("/api/admin/pool/overview")
      .set({ Authorization: `Bearer ${riderToken}` }).expect(403);

    const adminPassword = randomBytes(32).toString("base64url");
    const admin = db.prepare("SELECT phone_number FROM users WHERE role = 'admin' LIMIT 1")
      .get() as { phone_number: string };
    db.prepare("UPDATE users SET password_hash = ? WHERE phone_number = ?")
      .run(hashPassword(adminPassword), admin.phone_number);
    const login = await request(app).post("/api/auth/login")
      .send({ phone_number: admin.phone_number, password: adminPassword }).expect(200);
    const result = await request(app).get("/api/admin/pool/overview")
      .set({ Authorization: `Bearer ${login.body.token}` }).expect(200);
    assert.equal(result.body.overview.total_groups, 0);
    assert.equal(result.body.overview.payment_enabled, false);
    assert.equal(result.body.overview.company_due, 0);
    assert.equal(result.body.overview.captains_due, 0);
  });
});
