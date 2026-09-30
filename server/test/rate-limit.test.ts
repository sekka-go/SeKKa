import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { createRateLimiter } from "../src/middleware/rate-limit.js";

function appWithLimiter(max: number, windowMs = 60_000) {
  const app = express();
  app.use(express.json());
  const limiter = createRateLimiter({
    windowMs,
    max,
    keyFn: () => "fixed-key",
    message: "too many",
  });
  app.get("/ping", limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe("createRateLimiter", () => {
  it("يسمح بالمحاولات لغاية الحد الأقصى", async () => {
    const app = appWithLimiter(3);
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get("/ping");
      assert.equal(res.status, 200);
    }
  });

  it("يرفض بـ 429 بعد تخطي الحد الأقصى جوه نفس النافذة", async () => {
    const app = appWithLimiter(3);
    for (let i = 0; i < 3; i += 1) {
      await request(app).get("/ping");
    }
    const res = await request(app).get("/ping");
    assert.equal(res.status, 429);
    assert.equal(res.body.error, "too many");
    assert.ok(res.headers["retry-after"]);
  });

  it("مفاتيح مختلفة (Keys مختلفة) بتتعامل بشكل منفصل تمامًا", async () => {
    const app = express();
    app.use(express.json());
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      keyFn: (req) => String(req.query.who ?? "anon"),
      message: "too many",
    });
    app.get("/ping", limiter, (_req, res) => res.status(200).json({ ok: true }));

    const first = await request(app).get("/ping?who=ali");
    assert.equal(first.status, 200);
    const second = await request(app).get("/ping?who=ali");
    assert.equal(second.status, 429);
    // مفتاح مختلف (who=sara) لسه معاه محاولاته كاملة رغم إن ali استهلك حده.
    const third = await request(app).get("/ping?who=sara");
    assert.equal(third.status, 200);
  });

  it("العداد بيتصفّر تاني بعد ما النافذة الزمنية تخلص", async () => {
    const app = appWithLimiter(1, 50);
    const first = await request(app).get("/ping");
    assert.equal(first.status, 200);
    const blocked = await request(app).get("/ping");
    assert.equal(blocked.status, 429);

    await new Promise((resolve) => setTimeout(resolve, 70));

    const afterWindow = await request(app).get("/ping");
    assert.equal(afterWindow.status, 200);
  });
});
