import { assertEquals } from "@std/assert";
import { activeMemberIdForRider } from "./group-view.ts";

const members = [
  { id: 101, rider_user_id: 11, status: "active" },
  { id: 202, rider_user_id: 22, status: "active" },
  { id: 303, rider_user_id: 33, status: "cancelled" },
];

Deno.test("each rider is mapped only to their own active group member", () => {
  assertEquals(activeMemberIdForRider(members, 11), 101);
  assertEquals(activeMemberIdForRider(members, 22), 202);
});

Deno.test("nonmembers and inactive memberships cannot select a subscription", () => {
  assertEquals(activeMemberIdForRider(members, 33), null);
  assertEquals(activeMemberIdForRider(members, 44), null);
  assertEquals(activeMemberIdForRider(members, Number.NaN), null);
});
