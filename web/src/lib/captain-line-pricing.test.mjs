import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MAX_CAPTAIN_LINE_PRICE,
  MIN_CAPTAIN_LINE_PRICE,
  validateCaptainLinePricing,
} from "../../../shared/captainLinePricing.ts";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20261031150000_captain_line_pricing_phase1.sql", import.meta.url),
  "utf8",
);
const apiSource = readFileSync(new URL("../../../supabase/functions/sekka-api/index.ts", import.meta.url), "utf8");
const formSource = readFileSync(new URL("../screens/CaptainLineForm.tsx", import.meta.url), "utf8");
const captainJourneySource = readFileSync(new URL("../screens/CaptainJourneyScreen.tsx", import.meta.url), "utf8");
const riderJourneySource = readFileSync(new URL("../screens/RiderJourneyScreen.tsx", import.meta.url), "utf8");
const riderTripsSource = readFileSync(new URL("../screens/RiderTripsScreen.tsx", import.meta.url), "utf8");

test("shared captain offer rules accept required price and all approved direct payment methods", () => {
  assert.deepEqual(validateCaptainLinePricing(125.5, ["cash", "instapay", "wallet"]), {
    ok: true,
    pricePerSeat: 125.5,
    paymentMethods: ["cash", "instapay", "wallet"],
  });
});

test("shared captain offer rules reject absent, invalid, and out-of-range prices", () => {
  for (const price of [null, undefined, "", true, 0, -1, Number.NaN, Infinity, MAX_CAPTAIN_LINE_PRICE + 0.01]) {
    assert.equal(validateCaptainLinePricing(price, ["cash"]).ok, false, `price ${String(price)}`);
  }
  assert.equal(validateCaptainLinePricing(MIN_CAPTAIN_LINE_PRICE, ["cash"]).ok, true);
  assert.equal(validateCaptainLinePricing(MAX_CAPTAIN_LINE_PRICE, ["cash"]).ok, true);
});

test("shared captain offer rules exclude unknown payment methods", () => {
  for (const methods of [[], ["unknown"], ["cash", "bank"]]) {
    assert.equal(validateCaptainLinePricing(50, methods).ok, false, methods.join(","));
  }
});

test("shared captain offer rules remove repeated payment methods", () => {
  assert.deepEqual(validateCaptainLinePricing(50, ["cash", "cash", "wallet"]), {
    ok: true,
    pricePerSeat: 50,
    paymentMethods: ["cash", "wallet"],
  });
});

test("frontend and both write endpoints use the shared required-price contract", () => {
  assert.match(formSource, /validateCaptainLinePricing\(price, paymentMethods\)/);
  assert.match(formSource, /price_per_seat:\s*pricing\.pricePerSeat/);
  assert.match(formSource, /سعر الرحلة الواحدة لكل مقعد[\s\S]*required/);
  assert.match(apiSource, /validateCaptainLinePricing\(body\.price_per_seat, body\.payment_methods\)/);
  assert.ok((apiSource.match(/validateCaptainLinePricing\(body\.price_per_seat, body\.payment_methods\)/g) ?? []).length >= 2);
});

test("frontend names offer price as one trip per seat and describes wallet as external", () => {
  assert.match(formSource, /سعر الرحلة الواحدة لكل مقعد/);
  assert.match(formSource, /محفظة إلكترونية خارجية/);
  assert.match(formSource, /لا تستقبل سِكّة الأموال ولا تحتفظ بها/);
  assert.match(captainJourneySource, /سعر رحلة واحدة لكل مقعد/);
  assert.doesNotMatch(captainJourneySource, /السعر الشهري/);
  assert.match(riderTripsSource, /لكل رحلة واحدة لكل مقعد/);
  assert.match(riderJourneySource, /wallet:"محفظة إلكترونية خارجية"/);
  assert.doesNotMatch(riderJourneySource, /monthly_price:\s*item\.line\?\.price_per_seat/);
  assert.match(riderJourneySource, /السعر المعلن لكل رحلة لكل مقعد/);
  assert.match(riderJourneySource, /سعر الاشتراك الشهري/);
});

test("independent migration matches API RPC contract without changing stored offers", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.publish_captain_line\([\s\S]*?seat_price numeric,[\s\S]*?methods text\[\]/);
  assert.match(migration, /NEW\.price_per_seat IS NULL OR NEW\.price_per_seat < 0\.01 OR NEW\.price_per_seat > 99999999\.99/);
  assert.match(migration, /methods <@ ARRAY\['cash','instapay','wallet'\]::text\[\]/);
  assert.match(migration, /NEW\.payment_methods <@ ARRAY\['cash','instapay','wallet'\]::text\[\]/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.publish_captain_line\([\s\S]*?\) TO service_role/);
  assert.equal((migration.match(/CREATE OR REPLACE FUNCTION public\.publish_captain_line\(/g) ?? []).length, 3);
  assert.equal((migration.match(/CREATE OR REPLACE FUNCTION public\.update_captain_line\(/g) ?? []).length, 1);
  assert.doesNotMatch(migration, /captain_line_join_requests|sekka_match_demand_group|sekka_cluster_demand_request|CREATE TABLE/i);
  assert.doesNotMatch(migration, /DROP FUNCTION/i);
  assert.doesNotMatch(migration, /route_distance_km\s*\*|configured_rate|NEW\.price_per_seat\s*:=\s*ROUND/i);
  assert.match(migration, /WHERE price_per_seat IS NULL OR price_per_seat <= 0/);
  assert.match(migration, /ALTER COLUMN price_per_seat SET NOT NULL/);
  assert.doesNotMatch(migration.slice(0, migration.indexOf("CREATE OR REPLACE FUNCTION public.enforce_captain_line_pricing")), /UPDATE\s+public\.captain_lines/i);
  assert.match(migration, /payment_methods\s*\nON public\.captain_lines/);
});
