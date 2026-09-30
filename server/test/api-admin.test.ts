import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const ADMIN_PHONE = "+20000000000";
const ADMIN_PASSWORD = "ChangeMe_Admin_2026!";

const VEHICLE = {
  vehicle_type_id: "private_car",
  license_number: "LIC-300",
  vehicle_plate: "أ ب ج 300",
};

const VALID_REQUEST = {
  service_category_id: "faster",
  pickup_lat: 30.0444,
  pickup_lng: 31.2357,
  dropoff_lat: 30.05,
  dropoff_lng: 31.24,
};

async function loginAdmin(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ phone_number: ADMIN_PHONE, password: ADMIN_PASSWORD });
  return res.body.token as string;
}

async function registerAndLogin(
  app: ReturnType<typeof createApp>,
  user: { full_name: string; phone_number: string; password: string; role: string },
) {
  await request(app).post("/api/auth/register").send(user);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ phone_number: user.phone_number, password: user.password });
  return loginRes.body.token as string;
}

/** كابتن + راكب متطابقين ورحلة اتقفلت (Payment 'confirmed')، بدون اعتراض. */
async function completeAFullTrip(
  app: ReturnType<typeof createApp>,
  db: ReturnType<typeof freshMigratedDb>,
  suffix: string,
) {
  const riderPhone = `0107${suffix}1`;
  const captainPhone = `0107${suffix}2`;

  const riderToken = await registerAndLogin(app, {
    full_name: "راكبة",
    phone_number: riderPhone,
    password: "Passw0rd!",
    role: "rider",
  });
  const captainToken = await registerAndLogin(app, {
    full_name: "كابتن",
    phone_number: captainPhone,
    password: "Passw0rd!",
    role: "captain",
  });

  await request(app).post("/api/captain/profile").set("Authorization", `Bearer ${captainToken}`).send(VEHICLE);
  await request(app)
    .post("/api/captain/location")
    .set("Authorization", `Bearer ${captainToken}`)
    .send({ current_lat: 30.045, current_lng: 31.236 });
  db.prepare(
    `UPDATE captain_profiles SET verification_status = 'approved'
     WHERE user_id = (SELECT id FROM users WHERE phone_number = ?)`,
  ).run(captainPhone);

  const createRes = await request(app)
    .post("/api/rider/requests")
    .set("Authorization", `Bearer ${riderToken}`)
    .send(VALID_REQUEST);
  const matchId = createRes.body.match.id as number;
  const trip = db.prepare(`SELECT id FROM trips WHERE match_id = ?`).get(matchId) as { id: number };
  const stops = db
    .prepare(`SELECT id FROM trip_stops WHERE trip_id = ? ORDER BY sequence`)
    .all(trip.id) as { id: number }[];

  for (const stop of stops) {
    await request(app)
      .post(`/api/captain/trips/${trip.id}/stops/${stop.id}/arrive`)
      .set("Authorization", `Bearer ${captainToken}`);
  }
  const completeRes = await request(app)
    .post(`/api/captain/trips/${trip.id}/complete`)
    .set("Authorization", `Bearer ${captainToken}`);

  return {
    riderToken,
    captainToken,
    captainPhone,
    tripId: trip.id,
    paymentId: completeRes.body.payment.id as number,
    amount: completeRes.body.payment.amount as number,
  };
}

describe("Admin endpoints — role guard (403 لغير الأدمن، 200 للأدمن)", () => {
  it("Rider و Captain بيترفضوا بـ 403 من GET /api/admin/analytics/overview", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const riderToken = await registerAndLogin(app, {
      full_name: "راكب",
      phone_number: "0107900001",
      password: "Passw0rd!",
      role: "rider",
    });
    const captainToken = await registerAndLogin(app, {
      full_name: "كابتن",
      phone_number: "0107900002",
      password: "Passw0rd!",
      role: "captain",
    });

    const riderRes = await request(app)
      .get("/api/admin/analytics/overview")
      .set("Authorization", `Bearer ${riderToken}`);
    assert.equal(riderRes.status, 403);

    const captainRes = await request(app)
      .get("/api/admin/analytics/overview")
      .set("Authorization", `Bearer ${captainToken}`);
    assert.equal(captainRes.status, 403);
  });

  it("حساب الأدمن المزروع (Bootstrap) يقدر يدخل ويوصل لـ Endpoint إداري", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);
    assert.ok(adminToken, "لازم تسجيل الدخول بحساب الأدمن ينجح");

    const res = await request(app)
      .get("/api/admin/analytics/overview")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
  });
});

describe("POST /api/admin/captains/:userId/verification", () => {
  it("الأدمن يقدر يوافق على كابتن pending، ومايسمحش بتحديث لنفس الحالة تاني", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);

    const captainToken = await registerAndLogin(app, {
      full_name: "كابتن جديد",
      phone_number: "0107910001",
      password: "Passw0rd!",
      role: "captain",
    });
    await request(app).post("/api/captain/profile").set("Authorization", `Bearer ${captainToken}`).send(VEHICLE);
    const captainUser = db
      .prepare(`SELECT id FROM users WHERE phone_number = ?`)
      .get("0107910001") as { id: number };

    const approve = await request(app)
      .post(`/api/admin/captains/${captainUser.id}/verification`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" });
    assert.equal(approve.status, 200);
    assert.equal(approve.body.captain_profile.verification_status, "approved");

    const again = await request(app)
      .post(`/api/admin/captains/${captainUser.id}/verification`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" });
    assert.equal(again.status, 409);
  });

  it("كابتن مش موجود → 404", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);

    const res = await request(app)
      .post(`/api/admin/captains/999999/verification`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" });
    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/admin/pricing/:vehicleTypeId", () => {
  it("الأدمن يقدر يعدّل pricing_config لنوع مركبة موجود", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);

    const res = await request(app)
      .patch("/api/admin/pricing/private_car")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ base_fee: 12, rate_per_km: 4, rate_per_min: 0.6 });
    assert.equal(res.status, 200);
    assert.equal(res.body.pricing_config.base_fee, 12);
  });

  it("نوع مركبة مش موجود → 404، وقيم غير صحيحة → 400", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);

    const notFound = await request(app)
      .patch("/api/admin/pricing/spaceship")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ base_fee: 12, rate_per_km: 4, rate_per_min: 0.6 });
    assert.equal(notFound.status, 404);

    const badInput = await request(app)
      .patch("/api/admin/pricing/private_car")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ base_fee: -1, rate_per_km: 4, rate_per_min: 0.6 });
    assert.equal(badInput.status, 400);
  });
});

describe("POST /api/admin/payments/:paymentId/(resolve|adjust|void)", () => {
  it("الأفعال دي متاحة بس على دفعة disputed فعليًا", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);
    const { paymentId } = await completeAFullTrip(app, db, "1");

    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "مراجعة" });
    assert.equal(res.status, 409, "لسه مفيش اعتراض، الحالة confirmed مش disputed");
  });

  it("resolve بعد الاعتراض بيرجّع الحالة لـ resolved بدون تغيير المبلغ", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);
    const { riderToken, tripId, paymentId } = await completeAFullTrip(app, db, "2");

    await request(app)
      .post(`/api/rider/trips/${tripId}/dispute`)
      .set("Authorization", `Bearer ${riderToken}`)
      .send({ reason: "المبلغ غلط" });

    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "اتأكد إن المبلغ صح" });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "resolved");
  });

  it("adjust بعد الاعتراض بيحتاج amount، وبيسجّل adjusted_amount", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);
    const { riderToken, tripId, paymentId } = await completeAFullTrip(app, db, "3");

    await request(app)
      .post(`/api/rider/trips/${tripId}/dispute`)
      .set("Authorization", `Bearer ${riderToken}`)
      .send({ reason: "المبلغ غلط" });

    const missingAmount = await request(app)
      .post(`/api/admin/payments/${paymentId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "تعديل" });
    assert.equal(missingAmount.status, 400);

    const res = await request(app)
      .post(`/api/admin/payments/${paymentId}/adjust`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "تعديل بعد المراجعة", amount: 15 });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "adjusted");
    assert.equal(res.body.event.adjusted_amount, 15);
  });

  it("void بعد الاعتراض بيلغي الدفعة، ومفيش فعل تاني ممكن بعد كده (مش disputed تاني)", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);
    const { riderToken, tripId, paymentId } = await completeAFullTrip(app, db, "4");

    await request(app)
      .post(`/api/rider/trips/${tripId}/dispute`)
      .set("Authorization", `Bearer ${riderToken}`)
      .send({ reason: "المبلغ غلط" });

    const voidRes = await request(app)
      .post(`/api/admin/payments/${paymentId}/void`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "رحلة ملغاة بالغلط" });
    assert.equal(voidRes.status, 200);
    assert.equal(voidRes.body.status, "voided");

    const again = await request(app)
      .post(`/api/admin/payments/${paymentId}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "x" });
    assert.equal(again.status, 409);
  });

  it("دفعة مش موجودة → 404", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);

    const res = await request(app)
      .post(`/api/admin/payments/999999/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "x" });
    assert.equal(res.status, 404);
  });
});

describe("GET /api/admin/analytics/overview", () => {
  it("بيرجّع أرقام صحيحة بعد رحلة مقفولة ودفعة معترض عليها", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const adminToken = await loginAdmin(app);
    const { riderToken, tripId } = await completeAFullTrip(app, db, "5");

    await request(app)
      .post(`/api/rider/trips/${tripId}/dispute`)
      .set("Authorization", `Bearer ${riderToken}`)
      .send({ reason: "المبلغ غلط" });

    const res = await request(app)
      .get("/api/admin/analytics/overview")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.overview.total_trips_completed, 1);
    assert.equal(res.body.overview.disputes_awaiting_admin, 1);
    assert.equal(res.body.overview.total_admins, 1);
  });
});
