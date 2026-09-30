import assert from "node:assert/strict";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const PASSWORD = "Passw0rd!";
let phoneCounter = 0;

async function createUser(app: ReturnType<typeof createApp>, role: "rider" | "captain") {
  phoneCounter += 1;
  const phone = `010755${String(phoneCounter).padStart(6, "0")}`;
  await request(app).post("/api/auth/register").send({ full_name: role, phone_number: phone, password: PASSWORD, role });
  const login = await request(app).post("/api/auth/login").send({ phone_number: phone, password: PASSWORD });
  return { token: login.body.token as string, userId: login.body.user.id as number };
}

function addWeeklyGroup(db: ReturnType<typeof freshMigratedDb>, riderId: number, captainId: number | null, status: "minimum_met" | "active") {
  const serviceDates = ["2099-01-04", "2099-01-05", "2099-01-06", "2099-01-07", "2099-01-08"];
  const result = db.prepare(`INSERT INTO pool_groups(
    created_by_user_id,category_id,package_type,service_dates,morning_departure,
    return_departure,status,route_distance_km,route_duration_min,seat_day_fare,fixed_captain_user_id
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
    riderId, "faster_ac", "weekly", JSON.stringify(serviceDates), "07:30", "17:00",
    status, 20, 30, 100, captainId,
  );
  const groupId = Number(result.lastInsertRowid);
  const member = db.prepare(`INSERT INTO pool_members(
    group_id,rider_user_id,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,status,price_decision
  ) VALUES(?,?,?,?,?,?,?,?)`).run(groupId, riderId, 30.0444, 31.2357, 30.05, 31.24, "active", "accepted");
  return { groupId, memberId: Number(member.lastInsertRowid), serviceDate: serviceDates[0]! };
}

function addTrip(db: ReturnType<typeof freshMigratedDb>, groupId: number, memberId: number, serviceDate: string, direction: "outbound" | "return", captainId: number | null, status: "scheduled" | "assigned") {
  const departure = direction === "outbound" ? "2099-01-04T05:30:00.000Z" : "2099-01-04T15:00:00.000Z";
  const result = db.prepare(`INSERT INTO pool_trips(group_id,service_date,direction,departure_at,estimated_arrival_at,captain_user_id,status)
    VALUES(?,?,?,?,?,?,?)`).run(groupId, serviceDate, direction, departure, new Date(Date.parse(departure) + 30 * 60_000).toISOString(), captainId, status);
  const tripId = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO pool_trip_stops(trip_id,member_id,stop_type,sequence,lat,lng,reached_at) VALUES(?,?,?,?,?,?,?)")
    .run(tripId, memberId, "pickup", 1, 30.0444, 31.2357, "2099-01-04T05:31:00.000Z");
  db.prepare("INSERT INTO pool_trip_stops(trip_id,member_id,stop_type,sequence,lat,lng,reached_at) VALUES(?,?,?,?,?,?,?)")
    .run(tripId, memberId, "dropoff", 2, 30.05, 31.24, "2099-01-04T06:00:00.000Z");
  return tripId;
}

function approveCaptain(db: ReturnType<typeof freshMigratedDb>, captainId: number) {
  db.prepare(`INSERT INTO captain_profiles(user_id,vehicle_type_id,license_number,vehicle_plate,verification_status,current_lat,current_lng)
    VALUES(?,?,?,?,?,?,?)`).run(captainId, "private_car", "LIC-ESCROW", "ESCROW", "approved", 30.045, 31.236);
  db.prepare("INSERT INTO pool_captain_capabilities(captain_user_id,has_ac,accepts_faster,accepts_saver) VALUES(?,?,?,?)")
    .run(captainId, 1, 1, 1);
}

describe("Commute Pool fixed-captain escrow API", () => {
  it("creates a four-day reserve when a weekly fixed captain accepts the package", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const rider = await createUser(app, "rider");
    const captain = await createUser(app, "captain");
    approveCaptain(db, captain.userId);
    const group = addWeeklyGroup(db, rider.userId, null, "minimum_met");
    const firstTripId = addTrip(db, group.groupId, group.memberId, group.serviceDate, "outbound", null, "scheduled");
    addTrip(db, group.groupId, group.memberId, group.serviceDate, "return", null, "scheduled");

    const accepted = await request(app)
      .post(`/api/captain/pool/trips/${firstTripId}/accept`)
      .set("Authorization", `Bearer ${captain.token}`);

    assert.equal(accepted.status, 200);
    const escrow = db.prepare("SELECT * FROM pool_captain_escrows WHERE group_id=?").get(group.groupId) as {
      original_captain_user_id: number; service_days: number; daily_captain_share_amount: number; reserved_amount: number; status: string;
    };
    assert.equal(escrow.original_captain_user_id, captain.userId);
    assert.equal(escrow.service_days, 5);
    assert.equal(escrow.daily_captain_share_amount, 80);
    assert.equal(escrow.reserved_amount, 320);
    assert.equal(escrow.status, "reserved");
  });

  it("records replacement funding from escrow on completion and releases the unused reserve", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const rider = await createUser(app, "rider");
    const original = await createUser(app, "captain");
    const replacement = await createUser(app, "captain");
    const group = addWeeklyGroup(db, rider.userId, original.userId, "active");
    const tripId = addTrip(db, group.groupId, group.memberId, group.serviceDate, "outbound", replacement.userId, "assigned");
    const escrowId = Number(db.prepare(`INSERT INTO pool_captain_escrows(
      group_id,original_captain_user_id,package_type,service_days,daily_captain_share_amount,reserved_amount
    ) VALUES(?,?,?,?,?,?)`).run(group.groupId, original.userId, "weekly", 5, 80, 320).lastInsertRowid);

    const completed = await request(app)
      .post(`/api/captain/pool/trips/${tripId}/complete`)
      .set("Authorization", `Bearer ${replacement.token}`);

    assert.equal(completed.status, 200);
    const transfer = db.prepare("SELECT * FROM pool_captain_escrow_transfers WHERE trip_id=?").get(tripId) as {
      escrow_id: number; original_captain_user_id: number; replacement_captain_user_id: number;
      amount_due: number; escrow_funded_amount: number; unfunded_amount: number; transfer_status: string;
    };
    assert.equal(transfer.escrow_id, escrowId);
    assert.equal(transfer.original_captain_user_id, original.userId);
    assert.equal(transfer.replacement_captain_user_id, replacement.userId);
    assert.equal(transfer.amount_due, 40);
    assert.equal(transfer.escrow_funded_amount, 40);
    assert.equal(transfer.unfunded_amount, 0);
    assert.equal(transfer.transfer_status, "pending");

    const closed = db.prepare("SELECT used_amount,released_amount,status FROM pool_captain_escrows WHERE id=?").get(escrowId) as {
      used_amount: number; released_amount: number; status: string;
    };
    assert.equal(closed.used_amount, 40);
    assert.equal(closed.released_amount, 280);
    assert.equal(closed.status, "released");
  });

  it("assigns one replacement captain to both legs of a fixed captain's absent service day", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const rider = await createUser(app, "rider");
    const original = await createUser(app, "captain");
    const replacement = await createUser(app, "captain");
    approveCaptain(db, original.userId);
    approveCaptain(db, replacement.userId);
    const group = addWeeklyGroup(db, rider.userId, original.userId, "active");
    const outboundId = addTrip(db, group.groupId, group.memberId, group.serviceDate, "outbound", original.userId, "assigned");
    addTrip(db, group.groupId, group.memberId, group.serviceDate, "return", original.userId, "assigned");

    const absence = await request(app)
      .post(`/api/captain/pool/trips/${outboundId}/report-absence`)
      .set("Authorization", `Bearer ${original.token}`);
    assert.equal(absence.status, 200);

    let dayTrips = db.prepare("SELECT captain_user_id,status FROM pool_trips WHERE group_id=? AND service_date=? ORDER BY direction")
      .all(group.groupId, group.serviceDate) as { captain_user_id: number | null; status: string }[];
    assert.deepEqual(dayTrips.map((trip) => ({ ...trip })), [
      { captain_user_id: null, status: "needs_captain" },
      { captain_user_id: null, status: "needs_captain" },
    ]);

    const accepted = await request(app)
      .post(`/api/captain/pool/trips/${outboundId}/accept`)
      .set("Authorization", `Bearer ${replacement.token}`);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.trips.length, 2);

    dayTrips = db.prepare("SELECT captain_user_id,status FROM pool_trips WHERE group_id=? AND service_date=? ORDER BY direction")
      .all(group.groupId, group.serviceDate) as { captain_user_id: number | null; status: string }[];
    assert.deepEqual(dayTrips.map((trip) => ({ ...trip })), [
      { captain_user_id: replacement.userId, status: "assigned" },
      { captain_user_id: replacement.userId, status: "assigned" },
    ]);
    const fixed = db.prepare("SELECT fixed_captain_user_id,status FROM pool_groups WHERE id=?").get(group.groupId) as {
      fixed_captain_user_id: number; status: string;
    };
    assert.equal(fixed.fixed_captain_user_id, original.userId);
    assert.equal(fixed.status, "active");
  });

  it("releases the unused reserve when the rider cancels the final package member", async () => {
    const db = freshMigratedDb();
    const app = createApp(db);
    const rider = await createUser(app, "rider");
    const original = await createUser(app, "captain");
    const group = addWeeklyGroup(db, rider.userId, original.userId, "active");
    const escrowId = Number(db.prepare(`INSERT INTO pool_captain_escrows(
      group_id,original_captain_user_id,package_type,service_days,daily_captain_share_amount,reserved_amount,used_amount
    ) VALUES(?,?,?,?,?,?,?)`).run(group.groupId, original.userId, "weekly", 5, 80, 320, 40).lastInsertRowid);

    const cancelled = await request(app)
      .post(`/api/rider/pool/groups/${group.groupId}/cancel`)
      .set("Authorization", `Bearer ${rider.token}`);

    assert.equal(cancelled.status, 200);
    const escrow = db.prepare("SELECT used_amount,released_amount,status FROM pool_captain_escrows WHERE id=?").get(escrowId) as {
      used_amount: number; released_amount: number; status: string;
    };
    assert.equal(escrow.used_amount, 40);
    assert.equal(escrow.released_amount, 280);
    assert.equal(escrow.status, "released");
    const groupStatus = db.prepare("SELECT status FROM pool_groups WHERE id=?").get(group.groupId) as { status: string };
    assert.equal(groupStatus.status, "cancelled");
  });
});
