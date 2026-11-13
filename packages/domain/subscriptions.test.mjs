import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boundary,
  startDate,
  quote,
  eligible,
  categories,
  normalizePhone,
  parseDate,
} from "./subscriptions.ts";
const calendar = {
  coveredFrom: "2024-01-01",
  coveredThrough: "2028-12-31",
  excluded: [],
};
const at = (s) => new Date(s);
test("approved categories and capacities", () =>
  assert.deepEqual(categories, { PRIME: 3, SAVER: 4, SPACE: 9, MAX: 13 }));
test("monthly cycle ends at calendar month end", () => {
  assert.equal(boundary("2025-01-31", "monthly", 1), "2025-02-01");
  assert.equal(boundary("2025-01-31", "monthly", 2), "2025-03-01");
  assert.equal(boundary("2024-01-31", "monthly", 1), "2024-02-01");
});
test("weekly uses seven calendar days", () =>
  assert.equal(boundary("2026-11-01", "weekly", 1), "2026-11-08"));
test("Cairo midnight last second stays same day", () =>
  assert.equal(startDate(at("2026-11-07T22:00:59Z"), calendar), "2026-11-08"));
test("Cairo 00:01 advances one operating day", () =>
  assert.equal(startDate(at("2026-11-07T22:01:00Z"), calendar), "2026-11-09"));
test("Thursday after cutoff skips Friday and Saturday", () =>
  assert.equal(startDate(at("2026-11-11T22:01:00Z"), calendar), "2026-11-15"));
test("holiday skips and coverage fails closed", () => {
  assert.equal(
    startDate(at("2026-11-07T22:00:00Z"), {
      ...calendar,
      excluded: ["2026-11-08"],
    }),
    "2026-11-09",
  );
  assert.throws(() => eligible("2029-01-01", calendar), /UNAPPROVED/);
});
test("Cairo summer offset handled through IANA timezone", () =>
  assert.equal(startDate(at("2026-07-04T21:00:59Z"), calendar), "2026-07-05"));
test("proration rounds half up to EGP", () => {
  const q = quote({
    anchor: "2026-11-08",
    period: "weekly",
    fullPrice: 1001,
    now: at("2026-11-08T08:00:00Z"),
    calendar,
  });
  assert.equal(q.totalDays, 5);
  assert.equal(q.remainingDays, 4);
  assert.equal(q.price, 801);
  assert.equal(q.endExclusive, "2026-11-15");
  assert.equal(q.securityEgp, 100);
  assert.ok(Object.isFrozen(q));
});
test("monthly calendar has no 22-day cap", () => {
  const q = quote({
    anchor: "2026-03-01",
    period: "monthly",
    fullPrice: 2300,
    now: at("2026-02-28T22:00:00Z"),
    calendar,
  });
  assert.equal(q.totalDays, 23);
  assert.equal(q.price, 2300);
});
test("proration denominator excludes official holidays", () => {
  const q = quote({
    anchor: "2026-11-08",
    period: "weekly",
    fullPrice: 1000,
    now: at("2026-11-08T08:00:00Z"),
    calendar: { ...calendar, excluded: ["2026-11-10"] },
  });
  assert.equal(q.totalDays, 4);
  assert.equal(q.remainingDays, 3);
  assert.equal(q.price, 750);
});
test("end boundary belongs to next cycle", () => {
  const q = quote({
    anchor: "2026-11-08",
    period: "weekly",
    fullPrice: 1000,
    now: at("2026-11-14T22:00:00Z"),
    calendar,
  });
  assert.equal(q.cycleStart, "2026-11-15");
  assert.equal(q.price, 1000);
});
test("reject impossible dates, future anchors, and invalid prices", () => {
  assert.throws(() => parseDate("2026-02-30"));
  assert.throws(() =>
    quote({
      anchor: "2027-01-01",
      period: "weekly",
      fullPrice: 100,
      now: at("2026-11-08T00:00:00Z"),
      calendar,
    }),
  );
  assert.throws(() =>
    quote({
      anchor: "2026-01-01",
      period: "weekly",
      fullPrice: 1.5,
      now: new Date(),
      calendar,
    }),
  );
});
test("phone normalized and malformed foreign numbers rejected", () => {
  assert.equal(normalizePhone("010 1234 5678"), "+201012345678");
  assert.throws(() => normalizePhone("+15555555555"));
});
