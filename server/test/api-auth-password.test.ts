import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const RIDER = {
  full_name: "منى خالد",
  phone_number: "01044444444",
  password: "Passw0rd!",
  role: "rider",
};

async function registerAndLogin(app: ReturnType<typeof createApp>) {
  await request(app).post("/api/auth/register").send(RIDER);
  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ phone_number: RIDER.phone_number, password: RIDER.password });
  return loginRes.body.token as string;
}

describe("POST /api/auth/change-password", () => {
  it("يرفض من غير تسجيل دخول أصلًا", async () => {
    const app = createApp(freshMigratedDb());
    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ current_password: "x", new_password: "y12345678" });
    assert.equal(res.status, 401);
  });

  it("يرفض لو كلمة السر الحالية غلط", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_password: "غلط تمامًا", new_password: "NewPassw0rd!" });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, "كلمة السر الحالية غلط.");
  });

  it("يرفض كلمة سر جديدة أقصر من الحد الأدنى", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_password: RIDER.password, new_password: "short" });

    assert.equal(res.status, 400);
  });

  it("يرفض لو كلمة السر الجديدة نفس القديمة بالظبط", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_password: RIDER.password, new_password: RIDER.password });

    assert.equal(res.status, 400);
  });

  it("بينجح، وكلمة السر القديمة بتبقى مرفوضة بعد كده والجديدة هي اللي شغالة", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app);

    const changeRes = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_password: RIDER.password, new_password: "NewPassw0rd!" });
    assert.equal(changeRes.status, 200);
    assert.equal(changeRes.body.success, true);

    const oldLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: RIDER.phone_number, password: RIDER.password });
    assert.equal(oldLoginRes.status, 401);

    const newLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: RIDER.phone_number, password: "NewPassw0rd!" });
    assert.equal(newLoginRes.status, 200);
  });

  it("الجلسة الحالية (اللي عملت التغيير) فضلة شغالة بعد التغيير مباشرة", async () => {
    const app = createApp(freshMigratedDb());
    const token = await registerAndLogin(app);

    await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_password: RIDER.password, new_password: "NewPassw0rd!" });

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(logoutRes.status, 200);
  });

  it("جلسة تانية لنفس المستخدم (جهاز/متصفح مختلف) بتتلغي فورًا بعد التغيير", async () => {
    const app = createApp(freshMigratedDb());
    await request(app).post("/api/auth/register").send(RIDER);

    const session1 = (
      await request(app)
        .post("/api/auth/login")
        .send({ phone_number: RIDER.phone_number, password: RIDER.password })
    ).body.token as string;
    const session2 = (
      await request(app)
        .post("/api/auth/login")
        .send({ phone_number: RIDER.phone_number, password: RIDER.password })
    ).body.token as string;

    const changeRes = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${session1}`)
      .send({ current_password: RIDER.password, new_password: "NewPassw0rd!" });
    assert.equal(changeRes.status, 200);
    assert.equal(changeRes.body.revoked_other_sessions, 1);

    const session1Logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${session1}`);
    assert.equal(session1Logout.status, 200, "الجلسة اللي عملت التغيير لازم تفضل شغالة");

    const session2Logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${session2}`);
    assert.equal(session2Logout.status, 401, "الجلسة التانية لازم تكون اتلغت");
  });

  it("الـ Bootstrap admin يقدر يغيّر كلمة سره بنفس المسار العام (مفيش استثناء خاص بيه)", async () => {
    const app = createApp(freshMigratedDb());
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: "+20000000000", password: "ChangeMe_Admin_2026!" });
    assert.equal(loginRes.status, 200);
    const token = loginRes.body.token as string;

    const changeRes = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ current_password: "ChangeMe_Admin_2026!", new_password: "RealAdminPass1!" });
    assert.equal(changeRes.status, 200);

    const oldLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ phone_number: "+20000000000", password: "ChangeMe_Admin_2026!" });
    assert.equal(oldLoginRes.status, 401);
  });
});
