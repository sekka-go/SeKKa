import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const RIDER = {
  full_name: "راكبة منى",
  phone_number: "01066666601",
  password: "Passw0rd!",
  role: "rider",
};

const CAPTAIN = {
  full_name: "كابتن محمد",
  phone_number: "01066666602",
  password: "Passw0rd!",
  role: "captain",
};

const VEHICLE = {
  vehicle_type_id: "private_car",
  license_number: "LIC-100",
  vehicle_plate: "أ ب ج 100",
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

/**
 * بيسجّل كابتن، يعمله بروفايل مركبة، ويحدّث موقعه الحالي (كل ده عبر الـ
 * API). verification_status بيفضل 'pending' من الـ API نفسه (مفيش Endpoint
 * إداري ينقله لـ 'approved' — قيد معروف وموثّق في HANDOFF.md) — فبنعتمده
 * مباشرة على الـ DB زي ما اتوثّق، نفس منطق "تحقق بديل مباشر" اللي المراحل
 * السابقة استخدمته أصلًا لأسباب تانية.
 */
async function setUpApprovedCaptain(
  app: ReturnType<typeof createApp>,
  db: ReturnType<typeof freshMigratedDb>,
  phone: string,
  lat: number,
  lng: number,
): Promise<number> {
  const captain = { ...CAPTAIN, phone_number: phone };
  const token = await registerAndLogin(app, captain);
  await request(app)
    .post("/api/captain/profile")
    .set("Authorization", `Bearer ${token}`)
    .send(VEHICLE);
  await request(app)
    .post("/api/captain/location")
    .set("Authorization", `Bearer ${token}`)
    .send({ current_lat: lat, current_lng: lng });

  db.prepare(`UPDATE captain_profiles SET verification_status = 'approved'
              WHERE user_id = (SELECT id FROM users WHERE phone_number = ?)`).run(phone);

  const row = db.prepare(`SELECT id FROM users WHERE phone_number = ?`).get(phone) as {
    id: number;
  };
  return row.id;
}

describe("POST /api/rider/requests — Phase 5: matching أوتوماتيكي فور الإنشاء", () => {
  it("مفيش كباتن مؤهلين — الطلب بيتعمل وبيفضل open، match: null", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REQUEST);

    assert.equal(res.status, 201);
    assert.equal(res.body.request.status, "open");
    assert.equal(res.body.match, null);
  });

  it("فيه كابتن مؤهل — الطلب بيتطابق فورًا، status='matched'، match مرفق", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const captainId = await setUpApprovedCaptain(app, db, "01066666610", 30.045, 31.236);
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REQUEST);

    assert.equal(res.status, 201);
    assert.equal(res.body.request.status, "matched");
    assert.ok(res.body.match);
    assert.equal(res.body.match.captain_user_id, captainId);
  });
});

describe("GET /api/rider/requests — Phase 5: تفاصيل الـ Match مرفقة", () => {
  it("طلب matched بيرجع معاه match، طلب open بيرجع match: null", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    await setUpApprovedCaptain(app, db, "01066666620", 30.045, 31.236);
    const token = await registerAndLogin(app, RIDER);

    await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REQUEST);

    const res = await request(app)
      .get("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.requests.length, 1);
    assert.equal(res.body.requests[0].status, "matched");
    assert.ok(res.body.requests[0].match);
  });
});

describe("POST /api/rider/requests/:id/match — إعادة محاولة يدوية", () => {
  it("مفيش كابتن وقت الإنشاء، بعدين كابتن بيبقى متاح — إعادة المحاولة بتنجح", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await registerAndLogin(app, RIDER);

    const created = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REQUEST);
    assert.equal(created.body.request.status, "open");

    await setUpApprovedCaptain(app, db, "01066666630", 30.045, 31.236);

    const retry = await request(app)
      .post(`/api/rider/requests/${created.body.request.id}/match`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(retry.status, 200);
    assert.equal(retry.body.request.status, "matched");
    assert.ok(retry.body.match);
  });

  it("طلب اتطابق فعلًا — إعادة المحاولة Idempotent، بترجع نفس الـ Match", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    await setUpApprovedCaptain(app, db, "01066666640", 30.045, 31.236);
    const token = await registerAndLogin(app, RIDER);

    const created = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REQUEST);
    const firstMatchId = created.body.match.id;

    const retry = await request(app)
      .post(`/api/rider/requests/${created.body.request.id}/match`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(retry.status, 200);
    assert.equal(retry.body.match.id, firstMatchId);
  });

  it("طلب اتلغى — 409", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await registerAndLogin(app, RIDER);

    const created = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REQUEST);
    await request(app)
      .post(`/api/rider/requests/${created.body.request.id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    const retry = await request(app)
      .post(`/api/rider/requests/${created.body.request.id}/match`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(retry.status, 409);
  });

  it("يرفض إعادة محاولة على طلب مش بتاع المستخدم (403)", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token1 = await registerAndLogin(app, RIDER);
    const token2 = await registerAndLogin(app, {
      ...RIDER,
      phone_number: "01066666650",
    });

    const created = await request(app)
      .post("/api/rider/requests")
      .set("Authorization", `Bearer ${token1}`)
      .send(VALID_REQUEST);

    const res = await request(app)
      .post(`/api/rider/requests/${created.body.request.id}/match`)
      .set("Authorization", `Bearer ${token2}`);

    assert.equal(res.status, 403);
  });

  it("يرجّع 404 لطلب مش موجود أصلًا", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .post("/api/rider/requests/999999/match")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 404);
  });
});

describe("POST /api/captain/location", () => {
  it("بينجح لكابتن عنده بروفايل مركبة، ويحدّث current_lat/current_lng", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await registerAndLogin(app, CAPTAIN);
    await request(app)
      .post("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(VEHICLE);

    const res = await request(app)
      .post("/api/captain/location")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_lat: 30.05, current_lng: 31.24 });

    assert.equal(res.status, 200);
    assert.equal(res.body.profile.current_lat, 30.05);
    assert.equal(res.body.profile.current_lng, 31.24);
  });

  it("يرفض إحداثيات خارج المدى الجغرافي (400)", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await registerAndLogin(app, CAPTAIN);
    await request(app)
      .post("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(VEHICLE);

    const res = await request(app)
      .post("/api/captain/location")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_lat: 999, current_lng: 31.24 });

    assert.equal(res.status, 400);
  });

  it("يرجّع 404 لو الكابتن لسه معملش بروفايل مركبة", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await registerAndLogin(app, CAPTAIN);

    const res = await request(app)
      .post("/api/captain/location")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_lat: 30.05, current_lng: 31.24 });

    assert.equal(res.status, 404);
  });

  it("يرفض 403 لغير الكباتن", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .post("/api/captain/location")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_lat: 30.05, current_lng: 31.24 });

    assert.equal(res.status, 403);
  });
});
