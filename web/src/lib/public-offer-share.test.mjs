import test from "node:test";
import assert from "node:assert/strict";
import { createPublicOfferShareHash, readPublicOfferSnapshot } from "./public-offer-share.ts";

const offer = {
  id: 912,
  captain_user_id: 45,
  captain_name: "اسم خاص",
  origin_label: "مدينة نصر",
  destination_label: "التحرير",
  origin_lat: 30.05,
  origin_lng: 31.3,
  arrival_time: "08:15:00",
  return_arrival_time: "17:30:00",
  service_days: [0, 2, 4],
  vehicle_type_id: "daily",
  seats: 4,
  seats_available: 2,
  price_per_seat: 125,
};

test("shares only allowlisted trip details and reads the snapshot", () => {
  const hash = createPublicOfferShareHash(offer, "2026-11-02");
  assert.ok(hash);
  const snapshot = readPublicOfferSnapshot(hash);

  assert.deepEqual(Object.keys(snapshot), [
    "origin", "destination", "service_date", "arrival_time", "return_arrival_time",
    "service_days", "vehicle_type_id", "seats", "price_per_seat",
  ]);
  assert.equal(snapshot.seats, 2);
  assert.equal(snapshot.captain_name, undefined);
  assert.equal(snapshot.captain_user_id, undefined);
  assert.equal(snapshot.origin_lat, undefined);
});

test("rejects malformed or invalid public snapshots", () => {
  assert.equal(readPublicOfferSnapshot("#offer=not-json"), null);
  assert.equal(readPublicOfferSnapshot(`#offer=${encodeURIComponent(JSON.stringify({ origin: "A", destination: "B", service_date: "2026-11-02", arrival_time: "08:15", return_arrival_time: null, service_days: [0], vehicle_type_id: "unknown", seats: 2, price_per_seat: 125 }))}`), null);
  assert.equal(readPublicOfferSnapshot(`#offer=${encodeURIComponent(JSON.stringify({ origin: "A", destination: "B", service_date: "2026-02-31", arrival_time: "08:15", return_arrival_time: null, service_days: [0], vehicle_type_id: "daily", seats: 2, price_per_seat: 125 }))}`), null);
  assert.equal(createPublicOfferShareHash({ ...offer, seats_available: 0 }, "2026-11-02"), null);
});