import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const RIDER = {
  full_name: "راكبة منى",
  phone_number: "01077777771",
  password: "Passw0rd!",
  role: "rider",
};

const RIDER_2 = {
  full_name: "راكب أحمد",
  phone_number: "01077777772",
  password: "Passw0rd!",
  role: "rider",
};

const CAPTAIN = {
  full_name: "كابتن محمد",
  phone_number: "01077777773",
  password: "Passw0rd!",
  role: "captain",
};

const VALID_REQUEST = {
  service_category_id: "faster",
  pickup_lat: 30.0444,
  pickup_lng: 31.2357,
  dropoff_lat: 30.05,
  dropoff_lng: 31.24,
};

async function registerAndLogin(app: ReturnType<typeof createApp>, user: typeof RIDER) {
  await request(app).post("/api/auth/register").send(user);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ phone_number: user.phone_number, password: user.password });
  return loginRes.body.token as string;
}

describe("Rider request endpoints — role guard (403 لغير الركاب)", () => {
  it("Captain بيترفض بـ 403 من POST /api/rider/requests", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, CAPTAIN);

    const res = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REQUEST);
    assert.equal(res.status, 403);
  });

  it("Captain بيترفض بـ 403 من GET /api/rider/requests", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, CAPTAIN);

    const res = await request(app)
      .get("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  });
});

describe("POST /api/rider/requests", () => {
  it("بينجح لـ Rider، ودايمًا status='open'", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REQUEST);

    assert.equal(res.status, 201);
    assert.equal(res.body.request.service_category_id, "faster");
    assert.equal(res.body.request.status, "open");
  });

  it("بيتجاهل أي status يحاول الفرونت يبعته — دايمًا open", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_REQUEST, status: "matched" });

    assert.equal(res.status, 201);
    assert.equal(res.body.request.status, "open");
  });

  it("يرفض service_category_id غير موجود", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_REQUEST, service_category_id: "not_a_real_category" });

    assert.equal(res.status, 400);
  });

  it("يرفض إحداثيات ناقصة أو خارج المدى الجغرافي", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const missing = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ service_category_id: "faster", pickup_lat: 30.0444, pickup_lng: 31.2357 });
    assert.equal(missing.status, 400);

    const outOfRange = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_REQUEST, pickup_lat: 999 });
    assert.equal(outOfRange.status, 400);
  });
});

describe("GET /api/rider/requests", () => {
  it("بيرجّع طلبات صاحبه بس، مش طلبات راكب تاني", async () => {
    const app = createApp(freshMigratedDb());
    const token1 = await registerAndLogin(app, RIDER);
    const token2 = await registerAndLogin(app, RIDER_2);

    await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token1}`)
      .send(VALID_REQUEST);
    await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token2}`)
      .send(VALID_REQUEST);

    const res = await request(app)
      .get("/api/rider/requests")
      .set("Authorization", `Bearer ${token1}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.requests.length, 1);
  });

  it("بيرجّع مصفوفة فاضية لو مفيش طلبات", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .get("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.requests, []);
  });
});

describe("POST /api/rider/requests/:id/cancel", () => {
  it("بينجح لطلب open بتاع نفس المستخدم", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const created = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REQUEST);
    const id = created.body.request.id;

    const res = await request(app)
      .post(`/api/rider/requests/${id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.request.status, "cancelled");
  });

  it("يرفض إلغاء طلب مش بتاع المستخدم (403)", async () => {
    const app = createApp(freshMigratedDb());
    const token1 = await registerAndLogin(app, RIDER);
    const token2 = await registerAndLogin(app, RIDER_2);

    const created = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token1}`)
      .send(VALID_REQUEST);
    const id = created.body.request.id;

    const res = await request(app)
      .post(`/api/rider/requests/${id}/cancel`)
      .set("Authorization", `Bearer ${token2}`);

    assert.equal(res.status, 403);
  });

  it("يرفض إلغاء طلب مش open (409)", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const created = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REQUEST);
    const id = created.body.request.id;

    await request(app)
      .post(`/api/rider/requests/${id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    const secondTry = await request(app)
      .post(`/api/rider/requests/${id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(secondTry.status, 409);
  });

  it("يرجّع 404 لطلب مش موجود أصلًا", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .post("/api/rider/requests/999999/cancel")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 404);
  });
});
