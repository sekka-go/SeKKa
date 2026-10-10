import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { freshMigratedDb } from "./helpers.js";

const PASSWORD = "Passw0rd!";
const SERVICE_DATES = ["2099-10-04", "2099-10-05", "2099-10-06", "2099-10-07", "2099-10-08"];
let phoneCounter = 0;
let routingServer: Server | undefined;
let originalRoutingUrl: string | undefined;
let routingDistanceMeters = 10_000;
let expandedRoutingDistanceMeters: number | null = null;

async function startRoutingMock(distanceMeters = 10_000, expandedDistanceMeters: number | null = null) {
  if (routingServer) await stopRoutingMock();
  routingDistanceMeters = distanceMeters;
  expandedRoutingDistanceMeters = expandedDistanceMeters;
  routingServer = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const encodedPoints = url.pathname.split("/driving/")[1] ?? "";
    const coordinates = decodeURIComponent(encodedPoints).split(";").map((value) => {
      const [lng, lat] = value.split(",").map(Number);
      return [lng, lat];
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      code: "Ok",
      routes: [{ distance: coordinates.length >= 4 && expandedRoutingDistanceMeters !== null ? expandedRoutingDistanceMeters : routingDistanceMeters, duration: 600, geometry: { type: "LineString", coordinates } }],
    }));
  });
  await new Promise<void>((resolve) => routingServer!.listen(0, "127.0.0.1", resolve));
  const address = routingServer.address() as AddressInfo;
  originalRoutingUrl = process.env.SEKKA_ROUTING_URL;
  process.env.SEKKA_ROUTING_URL = `http://127.0.0.1:${address.port}`;
}

async function stopRoutingMock() {
  if (originalRoutingUrl === undefined) delete process.env.SEKKA_ROUTING_URL;
  else process.env.SEKKA_ROUTING_URL = originalRoutingUrl;
  routingServer?.closeAllConnections();
  await new Promise<void>((resolve, reject) => routingServer?.close((error) => error ? reject(error) : resolve()));
  routingServer = undefined;
}

after(async () => {
  if (routingServer) await stopRoutingMock();
});

async function createRider(app: ReturnType<typeof createApp>) {
  phoneCounter += 1;
  const phone = `010766${String(phoneCounter).padStart(6, "0")}`;
  await request(app).post("/api/auth/register").send({ full_name: "راكب", phone_number: phone, password: PASSWORD, role: "rider" });
  const login = await request(app).post("/api/auth/login").send({ phone_number: phone, password: PASSWORD });
  return login.body.token as string;
}

async function createCaptain(app: ReturnType<typeof createApp>) {
  phoneCounter += 1;
  const phone = `010777${String(phoneCounter).padStart(6, "0")}`;
  await request(app).post("/api/auth/register").send({ full_name: "كابتن", phone_number: phone, password: PASSWORD, role: "captain" });
  const login = await request(app).post("/api/auth/login").send({ phone_number: phone, password: PASSWORD });
  return { token: login.body.token as string, id: login.body.user.id as number };
}

function createBody(morning = "07:30") {
  return {
    category_id: "faster_ac",
    package_type: "weekly",
    service_dates: SERVICE_DATES,
    morning_departure: morning,
    return_departure: "17:00",
    pickup_lat: 30.0444,
    pickup_lng: 31.2357,
    dropoff_lat: 30.08,
    dropoff_lng: 31.27,
  };
}

describe("rider pool automatic matching", () => {
  it("ignores client-supplied fare, total, owner and workflow state", async () => {
    await startRoutingMock();
    const db = freshMigratedDb();
    const app = createApp(db);
    const token = await createRider(app);
    const sessionUser = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    const userId = sessionUser.body.user.id as number;

    const response = await request(app).post("/api/rider/pool/groups")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...createBody(), seat_day_fare: 0, amount_due: 0, total: 0, created_by_user_id: userId + 1000, status: "active", route_distance_km: 0 });

    assert.equal(response.status, 201);
    assert.equal(response.body.group.status, "waiting");
    assert.equal(response.body.group.seat_day_fare, null);
    assert.equal(response.body.group.route_distance_km, 10);
    const stored = db.prepare("SELECT created_by_user_id,status,route_distance_km FROM pool_groups WHERE id=?")
      .get(response.body.group.id) as { created_by_user_id: number; status: string; route_distance_km: number };
    assert.equal(stored.created_by_user_id, userId);
    assert.equal(stored.status, "waiting");
    assert.equal(stored.route_distance_km, 10);
  });

  it("joins a compatible waiting route and activates it at the Faster minimum", async () => {
    await startRoutingMock();
    const db = freshMigratedDb();
    const app = createApp(db);
    const firstToken = await createRider(app);
    const secondToken = await createRider(app);

    const first = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${firstToken}`).send(createBody());
    assert.equal(first.status, 201);

    const second = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${secondToken}`).send({
      ...createBody(), pickup_lat: 30.045, pickup_lng: 31.236, dropoff_lat: 30.081, dropoff_lng: 31.271,
    });

    assert.equal(second.status, 200);
    assert.equal(second.body.auto_matched, true);
    assert.equal(second.body.group.id, first.body.group.id);
    assert.equal(second.body.members.length, 2);
    assert.equal(second.body.group.status, "needs_captain");
    assert.equal(second.body.trips.length, SERVICE_DATES.length * 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pool_groups").get() && (db.prepare("SELECT COUNT(*) AS count FROM pool_groups").get() as { count: number }).count, 1);
  });

  it("matches a third Saver rider along a route that already has two members", async () => {
    await startRoutingMock();
    const db = freshMigratedDb();
    const app = createApp(db);
    const firstToken = await createRider(app);
    const secondToken = await createRider(app);
    const thirdToken = await createRider(app);
    const saverBody = { ...createBody(), category_id: "saver_ac" };

    const first = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${firstToken}`).send(saverBody);
    const second = await request(app).post(`/api/rider/pool/groups/${first.body.group.id}/join`)
      .set("Authorization", `Bearer ${secondToken}`).send({ pickup_lat: 30.045, pickup_lng: 31.236, dropoff_lat: 30.081, dropoff_lng: 31.271 });
    assert.equal(second.status, 200);
    assert.equal(second.body.group.status, "waiting");
    assert.equal(second.body.members.length, 2);

    const third = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${thirdToken}`).send({
      ...saverBody, pickup_lat: 30.046, pickup_lng: 31.237, dropoff_lat: 30.082, dropoff_lng: 31.272,
    });

    assert.equal(third.status, 200);
    assert.equal(third.body.auto_matched, true);
    assert.equal(third.body.group.id, first.body.group.id);
    assert.equal(third.body.members.length, 3);
    assert.equal(third.body.group.status, "needs_captain");
    assert.equal(third.body.group.category_id, "saver_ac");
  });

  it("does not combine requests with different departure times", async () => {
    await startRoutingMock();
    const db = freshMigratedDb();
    const app = createApp(db);
    const firstToken = await createRider(app);
    const secondToken = await createRider(app);

    const first = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${firstToken}`).send(createBody());
    const second = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${secondToken}`).send(createBody("08:00"));

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(second.body.group.id, first.body.group.id);
    assert.equal(second.body.auto_matched, undefined);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pool_groups").get() && (db.prepare("SELECT COUNT(*) AS count FROM pool_groups").get() as { count: number }).count, 2);
  });

  it("does not auto-match into a captain group with unconfirmed invitations", async () => {
    await startRoutingMock();
    const db = freshMigratedDb();
    const app = createApp(db);
    const ownerToken = await createRider(app);
    await createRider(app);
    const invitedRiderId = (db.prepare("SELECT id FROM users ORDER BY id DESC LIMIT 1").get() as { id: number }).id;
    const incomingToken = await createRider(app);

    const waiting = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${ownerToken}`).send(createBody());
    const groupId = Number(waiting.body.group.id);
    db.prepare(`INSERT INTO pool_members(group_id,rider_user_id,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,status)
      VALUES(?,?,?,?,?,?,?)`).run(groupId, invitedRiderId, 30.044, 31.235, 30.08, 31.27, "awaiting_confirmation");

    const incoming = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${incomingToken}`).send(createBody());

    assert.equal(incoming.status, 201);
    assert.notEqual(incoming.body.group.id, groupId);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM pool_groups").get() as { count: number }).count, 2);
  });

  it("keeps the quoted fare fixed when captain stop reordering increases route distance", async () => {
    await startRoutingMock(20_000);
    const db = freshMigratedDb();
    const app = createApp(db);
    const firstRiderId = Number(db.prepare("INSERT INTO users(full_name,phone_number,password_hash,role) VALUES('راكب أول','01070000001','unused','rider')").run().lastInsertRowid);
    const secondRiderId = Number(db.prepare("INSERT INTO users(full_name,phone_number,password_hash,role) VALUES('راكب ثان','01070000002','unused','rider')").run().lastInsertRowid);
    const captain = await createCaptain(app);
    const group = db.prepare(`INSERT INTO pool_groups(
      created_by_user_id,category_id,package_type,service_dates,morning_departure,return_departure,
      status,route_distance_km,route_duration_min,seat_day_fare,route_geometry
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
      firstRiderId, "faster_ac", "daily", JSON.stringify(["2099-10-04"]), "07:30", "17:00",
      "active", 10, 30, 100, JSON.stringify({ outbound: { type: "LineString", coordinates: [[31.2357, 30.0444], [31.27, 30.08]] } }),
    );
    const groupId = Number(group.lastInsertRowid);
    const memberIds = [firstRiderId, secondRiderId].map((riderId, index) => Number(db.prepare(`INSERT INTO pool_members(
      group_id,rider_user_id,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,status,price_decision,pickup_order
    ) VALUES(?,?,?,?,?,?,?,?,?)`).run(groupId, riderId, 30.0444 + index * 0.001, 31.2357, 30.08 + index * 0.001, 31.27, "active", "accepted", index).lastInsertRowid));
    db.prepare("INSERT INTO pool_trips(group_id,service_date,direction,departure_at,captain_user_id,status) VALUES(?,?,?,?,?,'assigned')")
      .run(groupId, "2099-10-04", "outbound", "2099-10-04T05:30:00.000Z", captain.id);

    const reordered = await request(app).post(`/api/captain/pool/groups/${groupId}/reorder`)
      .set("Authorization", `Bearer ${captain.token}`).send({ member_ids: [...memberIds].reverse() });

    assert.equal(reordered.status, 200);
    assert.equal(reordered.body.group.group.seat_day_fare, 100);
    assert.equal(reordered.body.group.group.route_distance_km, 20);
    assert.equal(reordered.body.group.group.status, "active");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pool_notifications WHERE group_id=? AND event_key LIKE 'pool-price-review:%'").get(groupId) &&
      (db.prepare("SELECT COUNT(*) AS count FROM pool_notifications WHERE group_id=? AND event_key LIKE 'pool-price-review:%'").get(groupId) as { count: number }).count, 0);
  });

  it("asks all riders to approve an automatic match when the fare rises by more than 15%", async () => {
    await startRoutingMock(10_000, 30_000);
    const db = freshMigratedDb();
    const app = createApp(db);
    const firstToken = await createRider(app);
    const secondToken = await createRider(app);
    const first = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${firstToken}`).send(createBody());
    const baselineFare = 2 * (12 + 10 * 8.2 + 10 * 0.6) / 3;

    const second = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${secondToken}`).send({
      ...createBody(), pickup_lat: 30.045, pickup_lng: 31.236, dropoff_lat: 30.081, dropoff_lng: 31.271,
    });

    assert.equal(second.status, 200);
    assert.equal(second.body.auto_matched, true);
    assert.equal(second.body.group.status, "price_review");
    assert.ok(second.body.group.seat_day_fare > baselineFare * 1.15);
    assert.ok(second.body.members.every((member: { price_decision: string }) => member.price_decision === "pending"));
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pool_subscriptions WHERE group_id=?").get(first.body.group.id) &&
      (db.prepare("SELECT COUNT(*) AS count FROM pool_subscriptions WHERE group_id=?").get(first.body.group.id) as { count: number }).count, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pool_notifications WHERE group_id=? AND event_key LIKE 'pool-price-review:%'").get(first.body.group.id) &&
      (db.prepare("SELECT COUNT(*) AS count FROM pool_notifications WHERE group_id=? AND event_key LIKE 'pool-price-review:%'").get(first.body.group.id) as { count: number }).count, 2);
  });

  it("asks for approval when a manual join expands a waiting route by more than 15%", async () => {
    await startRoutingMock(10_000, 30_000);
    const db = freshMigratedDb();
    const app = createApp(db);
    const firstToken = await createRider(app);
    const secondToken = await createRider(app);
    const first = await request(app).post("/api/rider/pool/groups").set("Authorization", `Bearer ${firstToken}`).send(createBody());

    const second = await request(app).post(`/api/rider/pool/groups/${first.body.group.id}/join`)
      .set("Authorization", `Bearer ${secondToken}`).send({ pickup_lat: 30.045, pickup_lng: 31.236, dropoff_lat: 30.081, dropoff_lng: 31.271 });

    assert.equal(second.status, 200);
    assert.equal(second.body.group.status, "price_review");
    assert.ok(second.body.group.seat_day_fare > 66.66 * 1.15);
    assert.ok(second.body.members.every((member: { price_decision: string }) => member.price_decision === "pending"));
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pool_subscriptions WHERE group_id=?").get(first.body.group.id) &&
      (db.prepare("SELECT COUNT(*) AS count FROM pool_subscriptions WHERE group_id=?").get(first.body.group.id) as { count: number }).count, 2);
  });
});
