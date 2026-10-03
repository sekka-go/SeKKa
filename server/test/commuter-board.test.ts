import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPersonalizedCommuterCards, commuterCardDurationMs, commuterSwipeDirection, nextCommuterCardIndex, runCommuterCardAction } from "../../web/src/lib/commuter-board.ts";
import { isInsideGreaterCairo } from "../../web/src/lib/greater-cairo.ts";
import type { CommuterBoardCard, GroupView, PoolDiscoveryMatch, RiderCommuterPreferences, SavedPlace } from "../../web/src/api.ts";

const preferences: RiderCommuterPreferences = { usual_days: [0, 1, 2, 3, 4], usual_departure_time: "07:30", usual_return_time: "17:00", frequent_places: [] };
const home: SavedPlace = { place_type: "home", label: "مدينة نصر", lat: 30.06, lng: 31.34 };
const work: SavedPlace = { place_type: "work", label: "القرية الذكية", lat: 30.07, lng: 31.02 };
const weeklyGroup = { group: { id: 42, package_type: "weekly", status: "waiting", morning_departure: "07:30:00", return_departure: "17:00:00" } } as unknown as GroupView;
const match = { group: { id: 9, morning_departure: "07:30:00" }, seats_available: 3 } as unknown as PoolDiscoveryMatch;
const campaign: CommuterBoardCard = { id: "campaign-1", type: "campaign", title: "حملة سِكّة", description: "رسالة موجهة", icon: "⌖", cta_text: "افتح", cta_action: "open-trips", priority: 95, targeting_rules: {}, start_date: "2026-10-02T00:00:00Z", end_date: "2026-10-04T00:00:00Z", active: true, display_duration: 10 };

describe("personalized commuter board", () => {
  it("يعرض إعداد الطريق للمستخدم الجديد ويحتفظ بدعوة الأصدقاء", () => {
    const cards = buildPersonalizedCommuterCards({ matches: [], groups: [], preferences, campaigns: [], now: Date.parse("2026-10-03T12:00:00Z") });
    assert.equal(cards[0]?.id, "empty-route");
    assert.ok(cards.some((card) => card.type === "invite_friends"));
  });

  it("يعرض مطابقة الطريق أولًا، ثم بيانات المشوار المعتاد", () => {
    const cards = buildPersonalizedCommuterCards({ home, work, matches: [match], groups: [weeklyGroup], preferences, campaigns: [], now: Date.parse("2026-10-03T12:00:00Z") });
    assert.equal(cards[0]?.type, "new_match");
    assert.equal(cards[0]?.cta_action, "join-group");
    assert.equal(cards[1]?.type, "recurring_commute");
    assert.equal(cards[1]?.cta_action, "open-trips");
    assert.ok(!cards.some((card) => card.type === "weekly_reminder"));
  });

  it("يعرض حالة عدم وجود مجموعات للمسار والتذكيرات المناسبة", () => {
    const cards = buildPersonalizedCommuterCards({ home, work, matches: [], groups: [], preferences, campaigns: [], now: Date.parse("2026-10-03T12:00:00Z") });
    assert.equal(cards[0]?.id, "no-matches");
    assert.ok(cards.some((card) => card.type === "weekly_reminder"));
    assert.ok(cards.some((card) => card.type === "monthly_reminder"));
  });

  it("يرتب الحملات حسب الأولوية ويتجاهل الحملات المنتهية أو غير النشطة", () => {
    const cards = buildPersonalizedCommuterCards({ home, work, matches: [], groups: [], preferences, campaigns: [campaign, { ...campaign, id: "inactive", active: false, priority: 100 }, { ...campaign, id: "expired", end_date: "2026-10-02T00:00:00Z", priority: 99 }], now: Date.parse("2026-10-03T12:00:00Z") });
    assert.ok(cards.some((card) => card.id === "campaign-1"));
    assert.ok(!cards.some((card) => card.id === "inactive" || card.id === "expired"));
  });

  it("يدور المؤشر للأمام والخلف وتبقى بيانات الموقع ضمن حدود القاهرة الكبرى", () => {
    assert.equal(nextCommuterCardIndex(0, 3, 1), 1);
    assert.equal(nextCommuterCardIndex(0, 3, -1), 2);
    assert.equal(nextCommuterCardIndex(2, 3, 1), 0);
    assert.equal(isInsideGreaterCairo(home.lat, home.lng), true);
    assert.equal(isInsideGreaterCairo(31.2, 29.9), false);
  });

  it("يحافظ على مدة ١٠ ثوانٍ، يبدّل بالمسح، ويوصل كل CTA إلى الإجراء المقصود", () => {
    assert.equal(commuterCardDurationMs(), 10_000);
    assert.equal(commuterSwipeDirection(-60), 1);
    assert.equal(commuterSwipeDirection(60), -1);
    assert.equal(commuterSwipeDirection(20), 0);
    const actions: string[] = [];
    const handlers = {
      openBooking: (type?: "daily" | "weekly" | "monthly") => actions.push(`booking:${type ?? "default"}`),
      openTrips: () => actions.push("trips"), inviteFriends: () => actions.push("invite"),
      managePreferences: () => actions.push("preferences"), joinGroup: () => actions.push("join"),
    };
    runCommuterCardAction("open-booking", handlers, "weekly_reminder");
    runCommuterCardAction("open-booking", handlers, "monthly_reminder");
    runCommuterCardAction("open-trips", handlers);
    runCommuterCardAction("invite-friends", handlers);
    runCommuterCardAction("manage-preferences", handlers);
    runCommuterCardAction("join-group", handlers);
    assert.deepEqual(actions, ["booking:weekly", "booking:monthly", "trips", "invite", "preferences", "join"]);
  });
});
