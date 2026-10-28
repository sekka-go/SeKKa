import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const RIDER = {
  full_name: "سارة أحمد",
  phone_number: "01011111111",
  password: "Passw0rd!",
  role: "rider",
};

describe("POST /api/auth/register", () => {
  it("بينجح لـ role=rider ويرجّع المستخدم بدون password_hash", async () => {
    const app = createApp(freshMigratedDb());
    const res = await request(app).post("/api/auth/register").send(RIDER);

    assert.equal(res.status, 201);
    assert.equal(res.body.user.phone_number, RIDER.phone_number);
    assert.equal(res.body.user.role, "rider");
    assert.equal("password_hash" in res.body.user, false);
    assert.equal(res.body.user.verified_at, null);
  });

  it("بينجح لـ role=captain", async () => {
    const app = createApp(freshMigratedDb());
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...RIDER, phone_number: "01022222222", role: "captain" });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "captain");
  });

  it("يرفض أي role تالت (بما فيها elite)", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);

    const eliteRes = await request(app)
      .post("/api/auth/register")
      .send({ ...RIDER, phone_number: "01033333333", role: "elite" });
    assert.equal(eliteRes.status, 400);

    const adminRes = await request(app)
      .post("/api/auth/register")
      .send({ ...RIDER, phone_number: "01033333334", role: "admin" });
    assert.equal(adminRes.status, 400);

    const raw = JSON.stringify(eliteRes.body).toLowerCase();
    assert.equal(raw.includes("elite"), false);
  });

  it("يرفض كلمات السر القصيرة أو الطويلة والحقول التي تتجاوز حدود الإدخال", async () => {
    const app = createApp(freshMigratedDb());
    for (const input of [
      { ...RIDER, password: "short" },
      { ...RIDER, password: "x".repeat(129) },
      { ...RIDER, full_name: "x".repeat(101) },
      { ...RIDER, phone_number: "1".repeat(33) },
    ]) {
      const response = await request(app).post("/api/auth/register").send(input);
      assert.equal(response.status, 400);
    }
  });

  it("يرفض رقم هاتف مكرر برسالة عربية واضحة (مش رسالة SQL)", async () => {
    const app = createApp(freshMigratedDb());
    await request(app).post("/api/auth/register").send(RIDER);
    const res = await request(app).post("/api/auth/register").send(RIDER);

    assert.equal(res.status, 409);
    assert.equal(res.body.error, "الرقم ده مسجّل قبل كده.");
    assert.equal(/sql|constraint|unique/i.test(res.body.error), false);
  });

  it("الـ password_hash المخزّن في DB مش نفس كلمة السر الأصلية (مش Plaintext)", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    await request(app).post("/api/auth/register").send(RIDER);

    const row = db
      .prepare("SELECT password_hash FROM users WHERE phone_number = ?")
      .get(RIDER.phone_number) as unknown as { password_hash: string };

    assert.notEqual(row.password_hash, RIDER.password);
    assert.equal(row.password_hash.includes(RIDER.password), false);
  });
});

describe("POST /api/auth/login", () => {
  it("بينجح برقم/كلمة سر صح ويرجّع Session token شغال", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    await request(app).post("/api/auth/register").send(RIDER);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: RIDER.phone_number, password: RIDER.password });

    assert.equal(loginRes.status, 200);
    assert.equal(typeof loginRes.body.token, "string");
    assert.ok(loginRes.body.token.length >= 32);

    // التوكن فعليًا شغال على Route محمي (logout).
    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${loginRes.body.token}`);
    assert.equal(logoutRes.status, 200);
  });

  it("يرفض كلمة سر غلط برسالة عامة", async () => {
    const app = createApp(freshMigratedDb());
    await request(app).post("/api/auth/register").send(RIDER);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: RIDER.phone_number, password: "غلط تمامًا" });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, "رقم الهاتف أو كلمة السر غلط.");
  });

  it("يرفض رقم هاتف مش موجود بنفس الرسالة العامة بالظبط (بدون كشف وجود الحساب)", async () => {
    const app = createApp(freshMigratedDb());
    await request(app).post("/api/auth/register").send(RIDER);

    const wrongPasswordRes = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: RIDER.phone_number, password: "غلط تمامًا" });

    const noSuchUserRes = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: "01099999999", password: "أي حاجة" });

    assert.equal(noSuchUserRes.status, 401);
    assert.equal(noSuchUserRes.body.error, wrongPasswordRes.body.error);
  });
});

describe("POST /api/auth/logout", () => {
  it("بيلغي الجلسة فعليًا — استخدامها بعد كده يترفض", async () => {
    const app = createApp(freshMigratedDb());
    await request(app).post("/api/auth/register").send(RIDER);
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: RIDER.phone_number, password: RIDER.password });
    const token = loginRes.body.token as string;

    const firstLogout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(firstLogout.status, 200);

    const secondLogout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(secondLogout.status, 401);
  });

  it("يرفض logout من غير token أصلًا", async () => {
    const app = createApp(freshMigratedDb());
    const res = await request(app).post("/api/auth/logout");
    assert.equal(res.status, 401);
  });
});
