import test from "node:test";
import assert from "node:assert/strict";
import { filterRiderOfferCandidates } from "./rider-matching.ts";

const offer = (overrides = {}) => ({
  id: 1,
  captain_verified: true,
  vehicle_type_id: "prime",
  seats_available: 3,
  ...overrides,
});

test("hides offers without backend-confirmed captain approval", () => {
  assert.deepEqual(filterRiderOfferCandidates([
    offer({ id: 1, captain_verified: false }),
    offer({ id: 2 }),
  ], 1, "all").map(({ id }) => id), [2]);
});

test("hides offers without enough seats and honors category filter", () => {
  const offers = [
    offer({ id: 1, seats_available: 1 }),
    offer({ id: 2, seats_available: 2 }),
    offer({ id: 3, vehicle_type_id: "daily", seats_available: 4 }),
  ];
  assert.deepEqual(filterRiderOfferCandidates(offers, 2, "prime").map(({ id }) => id), [2]);
});

test("deduplicates repeated offer rows without changing their order", () => {
  const first = offer({ id: 4 });
  const duplicate = offer({ id: 4, seats_available: 5 });
  const last = offer({ id: 5 });
  assert.deepEqual(filterRiderOfferCandidates([first, duplicate, last], 1, "all"), [first, last]);
});

test("fails closed when the API omits seat availability", () => {
  assert.deepEqual(filterRiderOfferCandidates([
    offer({ id: 1, seats_available: undefined, seats: undefined }),
  ], 1, "all"), []);
});
