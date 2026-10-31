import { activeMemberIdForRider } from "./group-view.ts";

Deno.test("group view resolves only the active member belonging to the rider", () => {
  const members = [
    { id: 8, rider_user_id: 41, status: "cancelled" },
    { id: 9, rider_user_id: 42, status: "active" },
    { id: 10, rider_user_id: 41, status: "active" },
  ];

  if (activeMemberIdForRider(members, 41) !== 10) {
    throw new Error("Active rider membership was not resolved correctly.");
  }
  if (activeMemberIdForRider(members, 99) !== null) {
    throw new Error("A different rider was granted a member identity.");
  }
  if (activeMemberIdForRider(members, 0) !== null) {
    throw new Error("Invalid rider id was accepted.");
  }
});
