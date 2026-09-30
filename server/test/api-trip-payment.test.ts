import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const VEHICLE = {
  vehicle_type_id: "private_car",
  license_number: "LIC-200",
  vehicle_plate: "أ ب ج 200",
};

const VALID_REQUEST = {
  service_category_id: "faster",
  pickup_lat: 30.0444,
  pickup_lng: 31.2357,
  dropoff_lat: 30.05,
  dropoff_lng: 31.24,
};

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

async function setUpMatchedTrip(
  app: ReturnType<typeof createApp>,
  db: ReturnType<typeof freshMigratedDb>,
  suffix: string,
) {
  const riderPhone = `0106${suffix}1`;
  const captainPhone = `0106${suffix}2`;

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
  assert.equal(createRes.status, 201);
  assert.ok(createRes.body.match, "لازم يتطابق فورًا (كابتن مؤهل واحد متاح)");

  const matchId = createRes.body.match.id as number;
  const trip = db.prepare(`SELECT id FROM trips WHERE match_id = ?`).get(matchId) as { id: number };
  const stops = db
    .prepare(`SELECT id, sequence FROM trip_stops WHERE trip_id = ? ORDER BY sequence`)
    .all(trip.id) as { id: number; sequence: number }[];

  return { riderToken, captainToken, tripId: trip.id, stops };
}

describe("POST /api/captain/trips/:tripId/stops/:stopId/arrive", () => {
  it("الكابتن صاحب الرحلة يقدر يسجّل وصول بالترتيب، مش قبله", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const { captainToken, tripId, stops } = await setUpMatchedTrip(app, db, "10");

    const outOfOrder = await request(app)
      .post(`/api/captain/trips/${tripId}/stops/${stops[1].id}/arrive`)
      .set("Authorization", `Bearer ${captainToken}`);
    assert.equal(outOfOrder.status, 409);

    const first = await request(app)
      .post(`/api/captain/trips/${tripId}/stops/${stops[0].id}/arrive`)
      .set("Authorization", `Bearer ${captainToken}`);
    assert.equal(first.status, 200);
    assert.ok(first.body.stop.reached_at);

    const second = await request(app)
      .post(`/api/captain/trips/${tripId}/stops/${stops[1].id}/arrive`)
      .set("Authorization", `Bearer ${captainToken}`);
    assert.equal(second.status, 200);
  });

  it("كابتن تاني (مش صاحب الرحلة) بيترفض بـ 403", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const { tripId, stops } = await setUpMatchedTrip(app, db, "20");

    const otherCaptainToken = await registerAndLogin(app, {
      full_name: "كابتن تاني",
      phone_number: "0106209",
      password: "Passw0rd!",
      role: "captain",
    });

    const res = await request(app)
      .post(`/api/captain/trips/${tripId}/stops/${stops[0].id}/arrive`)
      .set("Authorization", `Bearer ${otherCaptainToken}`);
    assert.equal(res.status, 403);
  });

  it("رحلة مش موجودة → 404", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const { captainToken } = await setUpMatchedTrip(app, db, "30");

    const res = await request(app)
      .post(`/api/captain/trips/999999/stops/1/arrive`)
      .set("Authorization", `Bearer ${captainToken}`);
    assert.equal(res.status, 404);
  });
});

describe("POST /api/captain/trips/:tripId/complete", () => {
  it("مايكملش قبل وصول كل الـ Stops، وبيقفل + يعمل Payment بعد كده", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const { captainToken, tripId, stops } = await setUpMatchedTrip(app, db, "40");

    const tooEarly = await request(app)
      .post(`/api/captain/trips/${tripId}/complete`)
      .set("Authorization", `Bearer ${captainToken}`);
    assert.equal(tooEarly.status, 409);

    await request(app)
      .post(`/api/captain/trips/${tripId}/stops/${stops[0].id}/arrive`)
      .set("Authorization", `Bearer ${captainToken}`);
    await request(app)
      .post(`/api/captain/trips/${tripId}/stops/${stops[1].id}/arrive`)
      .set("Authorization", `Bearer ${captainToken}`);

    const completeRes = await request(app)
      .post(`/api/captain/trips/${tripId}/complete`)
      .set("Authorization", `Bearer ${captainToken}`);
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.body.trip.status, "completed");
    assert.ok(completeRes.body.payment.amount > 0);

    const again = await request(app)
      .post(`/api/captain/trips/${tripId}/complete`)
      .set("Authorization", `Bearer ${captainToken}`);
    assert.equal(again.status, 409, "مقفولة بالفعل، مش قابلة لإقفال تاني");
  });
});

describe("GET /api/rider/trips و GET /api/captain/earnings", () => {
  it("الرحلة المقفولة بتظهر في 'رحلاتي' وفي 'أرباحي' بعد الإقفال، مش قبله", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const { riderToken, captainToken, tripId, stops } = await setUpMatchedTrip(app, db, "50");

    const beforeRider = await request(app).get("/api/rider/trips").set("Authorization", `Bearer ${riderToken}`);
    assert.equal(beforeRider.body.trips.length, 0);

    for (const stop of stops) {
      await request(app)
        .post(`/api/captain/trips/${tripId}/stops/${stop.id}/arrive`)
        .set("Authorization", `Bearer ${captainToken}`);
    }
    await request(app).post(`/api/captain/trips/${tripId}/complete`).set("Authorization", `Bearer ${captainToken}`);

    const afterRider = await request(app).get("/api/rider/trips").set("Authorization", `Bearer ${riderToken}`);
    assert.equal(afterRider.body.trips.length, 1);
    assert.equal(afterRider.body.trips[0].payment_status, "confirmed");

    const earnings = await request(app).get("/api/captain/earnings").set("Authorization", `Bearer ${captainToken}`);
    assert.equal(earnings.body.earnings.length, 1);
    assert.ok(earnings.body.total_amount > 0);
  });
});

describe("POST /api/rider/trips/:id/dispute", () => {
  async function completeAFullTrip(app: ReturnType<typeof createApp>, db: ReturnType<typeof freshMigratedDb>, suffix: string) {
    const setup = await setUpMatchedTrip(app, db, suffix);
    for (const stop of setup.stops) {
      await request(app)
        .post(`/api/captain/trips/${setup.tripId}/stops/${stop.id}/arrive`)
        .set("Authorization", `Bearer ${setup.captainToken}`);
    }
    await request(app)
      .post(`/api/captain/trips/${setup.tripId}/complete`)
      .set("Authorization", `Bearer ${setup.captainToken}`);
    return setup;
  }

  it("الراكب يقدر يعترض على مبلغ confirmed، مش تاني على disputed", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const { riderToken, tripId } = await completeAFullTrip(app, db, "60");

    const dispute = await request(app)
      .post(`/api/rider/trips/${tripId}/dispute`)
      .set("Authorization", `Bearer ${riderToken}`)
      .send({ reason: "المبلغ غلط" });
    assert.equal(dispute.status, 200);
    assert.equal(dispute.body.status, "disputed");

    const again = await request(app)
      .post(`/api/rider/trips/${tripId}/dispute`)
      .set("Authorization", `Bearer ${riderToken}`)
      .send({ reason: "تاني" });
    assert.equal(again.status, 409, "مش قابل للاعتراض تاني وهو أصلًا disputed");
  });

  it("راكب تاني (مش صاحب الرحلة) بيترفض بـ 403", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const { tripId } = await completeAFullTrip(app, db, "70");

    const otherRiderToken = await registerAndLogin(app, {
      full_name: "راكب تاني",
      phone_number: "0106709",
      password: "Passw0rd!",
      role: "rider",
    });

    const res = await request(app)
      .post(`/api/rider/trips/${tripId}/dispute`)
      .set("Authorization", `Bearer ${otherRiderToken}`)
      .send({ reason: "test" });
    assert.equal(res.status, 403);
  });

  it("سبب فاضي → 400", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const { riderToken, tripId } = await completeAFullTrip(app, db, "80");

    const res = await request(app)
      .post(`/api/rider/trips/${tripId}/dispute`)
      .set("Authorization", `Bearer ${riderToken}`)
      .send({});
    assert.equal(res.status, 400);
  });
});
