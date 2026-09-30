import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshMigratedDb } from "./helpers.js";
import { haversineDistanceKm } from "../src/db/matching-repository.js";
import { runAutomaticMatching } from "../src/matching/engine.js";

function registerUser(db: ReturnType<typeof freshMigratedDb>, params: {
  phone_number: string;
  role: "rider" | "captain";
}): number {
  const result = db
    .prepare(
      `INSERT INTO users (full_name, phone_number, password_hash, role) VALUES ('اسم', ?, 'x', ?)`,
    )
    .run(params.phone_number, params.role);
  return Number(result.lastInsertRowid);
}

function createCaptain(
  db: ReturnType<typeof freshMigratedDb>,
  opts: {
    phone: string;
    vehicleTypeId?: string;
    status?: "pending" | "approved" | "rejected";
    lat?: number | null;
    lng?: number | null;
  },
): number {
  const userId = registerUser(db, { phone_number: opts.phone, role: "captain" });
  db.prepare(
    `INSERT INTO captain_profiles
       (user_id, vehicle_type_id, license_number, vehicle_plate, verification_status, current_lat, current_lng)
     VALUES (?, ?, 'LIC', 'PLT', ?, ?, ?)`,
  ).run(
    userId,
    opts.vehicleTypeId ?? "private_car",
    opts.status ?? "approved",
    opts.lat === undefined ? 30.05 : opts.lat,
    opts.lng === undefined ? 31.24 : opts.lng,
  );
  return userId;
}

function createOpenRequest(
  db: ReturnType<typeof freshMigratedDb>,
  phone: string,
  opts: { serviceCategoryId?: string; pickupLat?: number; pickupLng?: number } = {},
): number {
  const riderId = registerUser(db, { phone_number: phone, role: "rider" });
  const result = db
    .prepare(
      `INSERT INTO daily_commute_requests
         (rider_user_id, service_category_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
       VALUES (?, ?, ?, ?, 30.06, 31.25)`,
    )
    .run(
      riderId,
      opts.serviceCategoryId ?? "faster",
      opts.pickupLat ?? 30.04,
      opts.pickupLng ?? 31.23,
    );
  return Number(result.lastInsertRowid);
}

describe("haversineDistanceKm", () => {
  it("بيرجّع صفر لنفس النقطة بالظبط", () => {
    assert.equal(haversineDistanceKm(30.04, 31.23, 30.04, 31.23), 0);
  });

  it("بيرجّع ~111.19 كم لفرق درجة واحدة خط عرض عند خط الاستواء (قيمة معروفة)", () => {
    const km = haversineDistanceKm(0, 0, 1, 0);
    assert.ok(Math.abs(km - 111.19) < 0.1, `expected ~111.19, got ${km}`);
  });

  it("بيرجّع ~111.19 كم لفرق درجة واحدة خط طول عند خط الاستواء (قيمة معروفة)", () => {
    const km = haversineDistanceKm(0, 0, 0, 1);
    assert.ok(Math.abs(km - 111.19) < 0.1, `expected ~111.19, got ${km}`);
  });
});

describe("runAutomaticMatching — أساسي", () => {
  it("Matching أوتوماتيكي فعليًا بدون أي خطوة موافقة كابتن — كابتن مؤهل واحد", () => {
    const db = freshMigratedDb();
    const captainId = createCaptain(db, { phone: "01088800001" });
    const requestId = createOpenRequest(db, "01088800002");

    const outcome = runAutomaticMatching(db, requestId);
    assert.equal(outcome.outcome, "matched");
    if (outcome.outcome === "matched") {
      assert.equal(outcome.match.captain_user_id, captainId);
    }
  });

  it("مفيش كباتن مؤهلين — الطلب بيفضل open، مفيش Match", () => {
    const db = freshMigratedDb();
    const requestId = createOpenRequest(db, "01088800010");

    const outcome = runAutomaticMatching(db, requestId);
    assert.equal(outcome.outcome, "no_eligible_captain");

    const row = db
      .prepare("SELECT status FROM daily_commute_requests WHERE id = ?")
      .get(requestId) as { status: string };
    assert.equal(row.status, "open");
  });

  it("كابتن verification_status='pending' مستبعد تمامًا (مش 'not rejected')", () => {
    const db = freshMigratedDb();
    createCaptain(db, { phone: "01088800020", status: "pending" });
    const requestId = createOpenRequest(db, "01088800021");

    const outcome = runAutomaticMatching(db, requestId);
    assert.equal(outcome.outcome, "no_eligible_captain");
  });

  it("كابتن current_lat/lng = NULL مستبعد تمامًا (مفيش Fallback)", () => {
    const db = freshMigratedDb();
    createCaptain(db, { phone: "01088800030", lat: null, lng: null });
    const requestId = createOpenRequest(db, "01088800031");

    const outcome = runAutomaticMatching(db, requestId);
    assert.equal(outcome.outcome, "no_eligible_captain");
  });

  it("كابتن نوع مركبته مش مطابق لـ service_category المطلوبة مستبعد (أقرب لكنه مش مؤهل بيتجاهل)", () => {
    const db = freshMigratedDb();
    // hiace بعيد جغرافيًا لكنه مؤهل فعليًا لـ 'saver' (مطابق لنوع مركبته)
    const eligibleFarCaptain = createCaptain(db, {
      phone: "01088800040",
      vehicleTypeId: "hiace",
      lat: 31.5,
      lng: 32.0,
    });
    // private_car قريب جدًا لكنه مش مطابق لنوع المركبة المطلوبة في الطلب
    createCaptain(db, { phone: "01088800041", vehicleTypeId: "private_car", lat: 30.04, lng: 31.23 });

    const requestId = createOpenRequest(db, "01088800042", {
      serviceCategoryId: "saver",
      pickupLat: 30.04,
      pickupLng: 31.23,
    });

    const outcome = runAutomaticMatching(db, requestId);
    assert.equal(outcome.outcome, "matched");
    if (outcome.outcome === "matched") {
      assert.equal(outcome.match.captain_user_id, eligibleFarCaptain);
    }
  });

  it("أقرب كابتن مؤهل بيفوز (مسافتين مختلفتين، الاتنين مؤهلين)", () => {
    const db = freshMigratedDb();
    const near = createCaptain(db, { phone: "01088800050", lat: 30.041, lng: 31.231 });
    createCaptain(db, { phone: "01088800051", lat: 31.0, lng: 32.0 });

    const requestId = createOpenRequest(db, "01088800052", { pickupLat: 30.04, pickupLng: 31.23 });

    const outcome = runAutomaticMatching(db, requestId);
    assert.equal(outcome.outcome, "matched");
    if (outcome.outcome === "matched") {
      assert.equal(outcome.match.captain_user_id, near);
    }
  });

  it("مسافة متساوية تمامًا: التعادل بيتكسر بالأقدم تسجيلًا (captain_profiles.created_at)", () => {
    const db = freshMigratedDb();
    const later = createCaptain(db, { phone: "01088800060", lat: 30.041, lng: 31.231 });
    const earlier = createCaptain(db, { phone: "01088800061", lat: 30.041, lng: 31.231 });

    // نتحكم صراحة في created_at عشان نضمن تعادل مسافة حقيقي مع ترتيب تسجيل
    // معروف (التسجيل الفعلي عبر الـ API ممكن ياخد نفس الـ Millisecond).
    db.prepare(`UPDATE captain_profiles SET created_at = '2026-01-01T00:00:00.000Z' WHERE user_id = ?`).run(
      earlier,
    );
    db.prepare(`UPDATE captain_profiles SET created_at = '2026-01-02T00:00:00.000Z' WHERE user_id = ?`).run(
      later,
    );

    const requestId = createOpenRequest(db, "01088800062", { pickupLat: 30.04, pickupLng: 31.23 });

    const outcome = runAutomaticMatching(db, requestId);
    assert.equal(outcome.outcome, "matched");
    if (outcome.outcome === "matched") {
      assert.equal(outcome.match.captain_user_id, earlier);
    }
  });

  it("مسافة وتسجيل متساويين تمامًا: الـ Fallback النهائي captain_id (الأصغر)", () => {
    const db = freshMigratedDb();
    const first = createCaptain(db, { phone: "01088800070", lat: 30.041, lng: 31.231 });
    const second = createCaptain(db, { phone: "01088800071", lat: 30.041, lng: 31.231 });
    assert.ok(first < second);

    db.prepare(`UPDATE captain_profiles SET created_at = '2026-01-01T00:00:00.000Z' WHERE user_id IN (?, ?)`).run(
      first,
      second,
    );

    const requestId = createOpenRequest(db, "01088800072", { pickupLat: 30.04, pickupLng: 31.23 });

    const outcome = runAutomaticMatching(db, requestId);
    assert.equal(outcome.outcome, "matched");
    if (outcome.outcome === "matched") {
      assert.equal(outcome.match.captain_user_id, first);
    }
  });
});

describe("runAutomaticMatching — حالات الطلب والمنع", () => {
  it("طلب اتلغى (cancelled) مينفعش يتطابق", () => {
    const db = freshMigratedDb();
    createCaptain(db, { phone: "01088800080" });
    const requestId = createOpenRequest(db, "01088800081");
    db.prepare(`UPDATE daily_commute_requests SET status = 'cancelled' WHERE id = ?`).run(requestId);

    const outcome = runAutomaticMatching(db, requestId);
    assert.equal(outcome.outcome, "not_open");

    const count = db.prepare("SELECT COUNT(*) c FROM matches WHERE daily_commute_request_id = ?").get(
      requestId,
    ) as { c: number };
    assert.equal(count.c, 0);
  });

  it("طلب اتطابق فعلًا مينفعش يتطابق تاني — إعادة الاستدعاء Idempotent (نفس الـ Match، مفيش صف جديد)", () => {
    const db = freshMigratedDb();
    createCaptain(db, { phone: "01088800090" });
    const requestId = createOpenRequest(db, "01088800091");

    const first = runAutomaticMatching(db, requestId);
    assert.equal(first.outcome, "matched");

    const second = runAutomaticMatching(db, requestId);
    assert.equal(second.outcome, "already_matched");
    if (first.outcome === "matched" && second.outcome === "already_matched") {
      assert.equal(second.match.id, first.match.id);
    }

    const count = db.prepare("SELECT COUNT(*) c FROM matches WHERE daily_commute_request_id = ?").get(
      requestId,
    ) as { c: number };
    assert.equal(count.c, 1);
  });

  it("طلب مش موجود أصلًا — not_found", () => {
    const db = freshMigratedDb();
    const outcome = runAutomaticMatching(db, 999999);
    assert.equal(outcome.outcome, "not_found");
  });
});

describe("runAutomaticMatching — Capacity", () => {
  it("مينفعش عدد الـ Matches النشطة بتاعة كابتن يتخطى vehicle_types.capacity_max بتاعه (private_car = 3)", () => {
    const db = freshMigratedDb();
    const captainId = createCaptain(db, { phone: "01088800100" });

    const req1 = createOpenRequest(db, "01088800101");
    const req2 = createOpenRequest(db, "01088800102");
    const req3 = createOpenRequest(db, "01088800103");
    const req4 = createOpenRequest(db, "01088800104");

    assert.equal(runAutomaticMatching(db, req1).outcome, "matched");
    assert.equal(runAutomaticMatching(db, req2).outcome, "matched");
    assert.equal(runAutomaticMatching(db, req3).outcome, "matched");

    // الكابتن الوحيد المؤهل دلوقتي شاغل الـ Capacity بتاعته (3/3) — الطلب
    // الرابع لازم يفضل من غير Match، مش يتطابق لكابتن متخطي سعته.
    const fourth = runAutomaticMatching(db, req4);
    assert.equal(fourth.outcome, "no_eligible_captain");

    const activeMatches = db
      .prepare(
        `SELECT COUNT(*) c FROM matches WHERE captain_user_id = ?`,
      )
      .get(captainId) as { c: number };
    assert.equal(activeMatches.c, 3);
  });
});

describe("Data integrity — منع Duplicate Assignment على مستوى الـ DB", () => {
  it("محاولة إدخال صف matches تاني لنفس daily_commute_request_id مباشرة (بدون المرور بالـ Engine) بترفض بـ UNIQUE — الضمان النهائي ضد أي تعارض حتى لو اتصال DB تاني", () => {
    const db = freshMigratedDb();
    const captainA = createCaptain(db, { phone: "01088800110" });
    const captainB = createCaptain(db, { phone: "01088800111" });
    const requestId = createOpenRequest(db, "01088800112");

    db.prepare(
      `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km) VALUES (?, ?, 1.0)`,
    ).run(requestId, captainA);

    assert.throws(() => {
      db.prepare(
        `INSERT INTO matches (daily_commute_request_id, captain_user_id, distance_km) VALUES (?, ?, 2.0)`,
      ).run(requestId, captainB);
    });
  });
});
