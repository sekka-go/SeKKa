import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const RIDER = {
  full_name: "هبة سامي",
  phone_number: "01055555555",
  password: "Passw0rd!",
  role: "rider",
};

describe("Rate limiting — /api/auth/login", () => {
  it("بيرفض بـ 429 بعد 5 محاولات غلط متتالية لنفس رقم الهاتف", async () => {
    const app = createApp(freshMigratedDb());
    await request(app).post("/api/auth/register").send(RIDER);

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ phone_number: RIDER.phone_number, password: "غلط" });
      assert.equal(res.status, 401, `المحاولة رقم ${i + 1} المفروض تبقى 401 عادي`);
    }

    const sixth = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: RIDER.phone_number, password: "غلط" });
    assert.equal(sixth.status, 429);
    assert.ok(sixth.headers["retry-after"]);

    // حتى بكلمة السر الصح، المحاولة السادسة لسه محظورة — الحظر على رقم
    // الهاتف نفسه (Key) مش على "كلمة سر غلط" تحديدًا.
    const correctButBlocked = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: RIDER.phone_number, password: RIDER.password });
    assert.equal(correctButBlocked.status, 429);
  });

  it("رقم هاتف تاني (Key مختلف) مش متأثر بحظر رقم غيره", async () => {
    const app = createApp(freshMigratedDb());
    await request(app).post("/api/auth/register").send(RIDER);

    for (let i = 0; i < 6; i += 1) {
      await request(app)
        .post("/api/auth/login")
        .send({ phone_number: RIDER.phone_number, password: "غلط" });
    }

    const otherNumberRes = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: "01099999999", password: "أي حاجة" });
    // رقم مش مسجّل → لسه بيرد 401 عادي (مش 429) لأنه Key مختلف تمامًا.
    assert.equal(otherNumberRes.status, 401);
  });
});

describe("Rate limiting — /api/auth/change-password", () => {
  it("بيرفض بـ 429 بعد 5 محاولات غلط لـ current_password لنفس المستخدم", async () => {
    const app = createApp(freshMigratedDb());
    await request(app).post("/api/auth/register").send(RIDER);
    const token = (
      await request(app)
        .post("/api/auth/login")
        .send({ phone_number: RIDER.phone_number, password: RIDER.password })
    ).body.token as string;

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({ current_password: "غلط", new_password: "NewPassw0rd!" });
      assert.equal(res.status, 401);
    }

    const sixth = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_password: RIDER.password, new_password: "NewPassw0rd!" });
    assert.equal(sixth.status, 429);
  });
});
