import test from "node:test";
import assert from "node:assert/strict";
import { filterApprovedCaptainLines } from "../../../supabase/functions/sekka-api/captain-eligibility.ts";

test("only returns lines for approved captains and preserves server order", () => {
  const lines = [
    { id: 1, captain_user_id: 20 },
    { id: 2, captain_user_id: 10 },
    { id: 3, captain_user_id: 20 },
  ];

  assert.deepEqual(filterApprovedCaptainLines(lines, new Set([20])), [lines[0], lines[2]]);
});

test("fails closed when no captain approval records are available", () => {
  assert.deepEqual(filterApprovedCaptainLines([
    { id: 1, captain_user_id: 20 },
  ], new Set()), []);
});