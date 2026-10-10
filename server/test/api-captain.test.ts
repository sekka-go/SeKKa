import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const CAPTAIN = {
  full_name: "كابتن محمد",
  phone_number: "01055555551",
  password: "Passw0rd!",
  role: "captain",
};

const RIDER = {
  full_name: "راكبة منى",
  phone_number: "01055555552",
  password: "Passw0rd!",
  role: "rider",
};

const VEHICLE = {
  vehicle_type_id: "private_car",
  license_number: "LIC-001",
  vehicle_plate: "أ ب ج 123",
};

async function registerAndLogin(app: ReturnType<typeof createApp>, user: typeof CAPTAIN) {
  await request(app).post("/api/auth/register").send(user);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ phone_number: user.phone_number, password: user.password });
  return loginRes.body.token as string;
}

/** بتلتقط قيمة الـ OTP المطبوعة في الـ console (Dev-only) أثناء تنفيذ fn. */
async function captureLoggedOtp(fn: () => Promise<unknown>): Promise<string | null> {
  const originalLog = console.log;
  let captured: string | null = null;
  console.log = (...args: unknown[]) => {
    const line = args.map(String).join(" ");
    const match = /OTP لـ .*?: (\d{6})/.exec(line);
    if (match) captured = match[1];
  };
  try {
    await fn();
  } finally {
    console.log = originalLog;
  }
  return captured;
}

describe("Captain endpoints — role guard (403 لغير الكباتن)", () => {
  it("Rider بيترفض بـ 403 من POST /api/captain/profile", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .post("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(VEHICLE);
    assert.equal(res.status, 403);
  });

  it("Rider بيترفض بـ 403 من GET /api/captain/profile", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const res = await request(app)
      .get("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 403);
  });

  it("Rider بيترفض بـ 403 من endpoints الـ OTP بتاعة Captain", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, RIDER);

    const requestRes = await request(app)
      .post("/api/captain/verify/request")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(requestRes.status, 403);

    const confirmRes = await request(app)
      .post("/api/captain/verify/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp: "000000" });
    assert.equal(confirmRes.status, 403);
  });
});

describe("POST /api/captain/profile", () => {
  it("بينجح لـ Captain، ودايمًا verification_status='pending'", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, CAPTAIN);

    const res = await request(app)
      .post("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(VEHICLE);

    assert.equal(res.status, 201);
    assert.equal(res.body.profile.vehicle_type_id, "private_car");
    assert.equal(res.body.profile.verification_status, "pending");
  });

  it("بيتجاهل أي verification_status يحاول الفرونت يبعته — دايمًا pending", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, CAPTAIN);

    const res = await request(app)
      .post("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VEHICLE, verification_status: "approved" });

    assert.equal(res.status, 201);
    assert.equal(res.body.profile.verification_status, "pending");
  });

  it("يرفض إنشاء تاني لنفس المستخدم (409)", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, CAPTAIN);
    await request(app)
      .post("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(VEHICLE);

    const res = await request(app)
      .post("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(VEHICLE);

    assert.equal(res.status, 409);
    assert.equal(res.body.error, "عندك بيانات مركبة مسجّلة بالفعل.");
  });

  it("يرفض vehicle_type_id غير صحيح (بما فيه محاولة elite)", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, CAPTAIN);

    const res = await request(app)
      .post("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VEHICLE, vehicle_type_id: "elite" });

    assert.equal(res.status, 400);
    assert.equal(JSON.stringify(res.body).toLowerCase().includes("elite"), false);
  });
});

describe("GET /api/captain/profile", () => {
  it("404 قبل الإنشاء، وبيرجّع بروفايل صاحبه بس بعد الإنشاء", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, CAPTAIN);

    const before = await request(app)
      .get("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(before.status, 404);

    await request(app)
      .post("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(VEHICLE);

    const after = await request(app)
      .get("/api/captain/profile")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(after.status, 200);
    assert.equal(after.body.profile.license_number, VEHICLE.license_number);
  });
});

describe("OTP — /api/captain/verify/request + /confirm", () => {
  it("مسار كامل: طلب → تخزين Hash بس → تأكيد صح ينجح ويحدّث verified_at", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await registerAndLogin(app, CAPTAIN);

    let requestStatus = 0;
    const otp = await captureLoggedOtp(async () => {
      const res = await request(app)
        .post("/api/captain/verify/request")
        .set("Authorization", `Bearer ${token}`);
      requestStatus = res.status;
    });
    assert.equal(requestStatus, 200);
    assert.ok(otp, "لازم يتم التقاط OTP من الـ console");

    // الـ Hash بس اللي اتخزن في DB، مش القيمة الخام.
    const row = db
      .prepare("SELECT otp_hash FROM otp_challenges ORDER BY id DESC LIMIT 1")
      .get() as { otp_hash: string };
    assert.notEqual(row.otp_hash, otp);

    const confirmRes = await request(app)
      .post("/api/captain/verify/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp });
    assert.equal(confirmRes.status, 200);

    const userRow = db
      .prepare("SELECT verified_at FROM users WHERE phone_number = ?")
      .get(CAPTAIN.phone_number) as { verified_at: string | null };
    assert.notEqual(userRow.verified_at, null);
  });

  it("نفس الـ OTP تاني مرة يترفض (مُستهلك بالفعل)", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, CAPTAIN);

    const otp = await captureLoggedOtp(async () => {
      await request(app)
        .post("/api/captain/verify/request")
        .set("Authorization", `Bearer ${token}`);
    });

    await request(app)
      .post("/api/captain/verify/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp });

    const secondTry = await request(app)
      .post("/api/captain/verify/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp });

    assert.equal(secondTry.status, 401);
  });

  it("OTP غلط يترفض برسالة عامة", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app, CAPTAIN);

    await captureLoggedOtp(async () => {
      await request(app)
        .post("/api/captain/verify/request")
        .set("Authorization", `Bearer ${token}`);
    });

    const res = await request(app)
      .post("/api/captain/verify/confirm")
      .set("Authorization", `Bearer ${token}`)
      .send({ otp: "000000" });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, "الكود اللي دخلته غلط أو منتهي، جرّب تاني.");
  });
});
