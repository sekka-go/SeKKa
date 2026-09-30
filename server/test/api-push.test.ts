import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const envBackup = {
  publicKey: process.env.SEKKA_VAPID_PUBLIC_KEY,
  privateKey: process.env.SEKKA_VAPID_PRIVATE_KEY,
  subject: process.env.SEKKA_VAPID_SUBJECT,
};
process.env.SEKKA_VAPID_PUBLIC_KEY = "public-vapid-test-key";
process.env.SEKKA_VAPID_PRIVATE_KEY = "private-vapid-test-key";
process.env.SEKKA_VAPID_SUBJECT = "mailto:test@example.com";
let phoneCounter = 0;

after(() => {
  if (envBackup.publicKey === undefined) delete process.env.SEKKA_VAPID_PUBLIC_KEY;
  else process.env.SEKKA_VAPID_PUBLIC_KEY = envBackup.publicKey;
  if (envBackup.privateKey === undefined) delete process.env.SEKKA_VAPID_PRIVATE_KEY;
  else process.env.SEKKA_VAPID_PRIVATE_KEY = envBackup.privateKey;
  if (envBackup.subject === undefined) delete process.env.SEKKA_VAPID_SUBJECT;
  else process.env.SEKKA_VAPID_SUBJECT = envBackup.subject;
});

async function createUser(app: ReturnType<typeof createApp>) {
  phoneCounter += 1;
  const phone = `010788${String(phoneCounter).padStart(6, "0")}`;
  await request(app).post("/api/auth/register").send({
    full_name: "راكب Push", phone_number: phone, password: "Passw0rd!", role: "rider",
  });
  const login = await request(app).post("/api/auth/login").send({ phone_number: phone, password: "Passw0rd!" });
  return { token: login.body.token as string, userId: login.body.user.id as number };
}

const subscription = {
  endpoint: "https://push.example.test/subscription/one",
  keys: { p256dh: "BValidPublicKeyValue_0123456789abcdef", auth: "ValidAuthKey_1234567890" },
};

describe("Web Push subscription API", () => {
  it("reports unavailable when the VAPID environment is incomplete", async () => {
    const current = [process.env.SEKKA_VAPID_PUBLIC_KEY, process.env.SEKKA_VAPID_PRIVATE_KEY, process.env.SEKKA_VAPID_SUBJECT];
    delete process.env.SEKKA_VAPID_PRIVATE_KEY;
    try {
      const response = await request(createApp(freshMigratedDb())).get("/api/pool/push/vapid-public-key");
      assert.equal(response.status, 503);
    } finally {
      if (current[0] !== undefined) process.env.SEKKA_VAPID_PUBLIC_KEY = current[0];
      if (current[1] !== undefined) process.env.SEKKA_VAPID_PRIVATE_KEY = current[1];
      if (current[2] !== undefined) process.env.SEKKA_VAPID_SUBJECT = current[2];
    }
  });

  it("returns the public VAPID key without exposing the private key", async () => {
    const app = createApp(freshMigratedDb());
    const response = await request(app).get("/api/pool/push/vapid-public-key");
    assert.equal(response.status, 200);
    assert.equal(response.body.public_key, "public-vapid-test-key");
    assert.equal(JSON.stringify(response.body).includes("private-vapid-test-key"), false);
  });

  it("stores, reassigns, and removes only the authenticated user's subscription", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const owner = await createUser(app);
    const other = await createUser(app);

    const unauthenticated = await request(app).put("/api/pool/push/subscriptions").send(subscription);
    assert.equal(unauthenticated.status, 401);

    const saved = await request(app).put("/api/pool/push/subscriptions")
      .set("Authorization", `Bearer ${owner.token}`).send(subscription);
    assert.equal(saved.status, 201);
    assert.equal(saved.body.subscribed, true);
    const row = db.prepare("SELECT user_id,endpoint FROM push_subscriptions").get() as { user_id: number; endpoint: string };
    assert.equal(row.user_id, owner.userId);
    assert.equal(row.endpoint, subscription.endpoint);

    const forbiddenDelete = await request(app).delete("/api/pool/push/subscriptions")
      .set("Authorization", `Bearer ${other.token}`).send({ endpoint: subscription.endpoint });
    assert.equal(forbiddenDelete.status, 200);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM push_subscriptions WHERE endpoint=?").get(subscription.endpoint) as { count: number }).count, 1);

    const removed = await request(app).delete("/api/pool/push/subscriptions")
      .set("Authorization", `Bearer ${owner.token}`).send({ endpoint: subscription.endpoint });
    assert.equal(removed.status, 200);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM push_subscriptions").get() as { count: number }).count, 0);
  });

  it("rejects insecure or malformed browser subscriptions", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const owner = await createUser(app);
    const response = await request(app).put("/api/pool/push/subscriptions")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ endpoint: "http://push.example.test/insecure", keys: { p256dh: "short", auth: "short" } });
    assert.equal(response.status, 400);
  });
});
