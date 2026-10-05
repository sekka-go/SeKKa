import { Router, type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { requireAuth } from "../middleware/require-auth.js";
import { requireRole } from "../middleware/require-role.js";
import { calculatePerSeatFare, calculatePoolRouteFare, findPoolCategory } from "../pricing/pool-fare.js";
import { isWithinGroupPath, isWithinRouteLine, routeLineDistanceKm, planDiscount, routeStops, serviceDates, roundMoney, distanceKm, type PoolRouteMember } from "../pool/geometry.js";
import { getRoadRoute } from "../pool/osrm.js";
import { calculatePoolSettlement } from "../finance/settlement.js";
import { calculateCaptainEscrowReserve, calculateCaptainEscrowTransfer } from "../finance/captain-escrow.js";
import { getWebPushPublicKey, sendWebPushToUser } from "../notifications/web-push.js";

type Group = { id: number; created_by_user_id: number; category_id: string; package_type: string; service_dates: string; morning_departure: string; return_departure: string; status: string; route_distance_km: number | null; route_duration_min: number | null; seat_day_fare: number | null; route_geometry: string | null; route_version: number; fixed_captain_user_id: number | null };
type Member = PoolRouteMember & { group_id: number; rider_user_id: number; status: string; price_decision: string; seats_reserved: number };
const MIN_SEATS: Record<string, number> = { faster: 2, saver: 3 };
const MAX_CAPTAIN_RANGE_KM = 10;
const GREATER_CAIRO = { south: 29.65, west: 30.55, north: 30.45, east: 31.85 };
function insideGreaterCairo(lat: number, lng: number) { return lat >= GREATER_CAIRO.south && lat <= GREATER_CAIRO.north && lng >= GREATER_CAIRO.west && lng <= GREATER_CAIRO.east; }
async function routeFare(category: NonNullable<ReturnType<typeof findPoolCategory>>, members: PoolRouteMember[]) {
  const outbound = routeStops(members, "outbound");
  const returning = routeStops(members, "return");
  const [outboundRoute, returnRoute] = await Promise.all([
    getRoadRoute(outbound.map(({ lat, lng }) => ({ lat, lng }))),
    getRoadRoute(returning.map(({ lat, lng }) => ({ lat, lng }))),
  ]);
  const outboundFare = calculatePoolRouteFare(category, outboundRoute.distanceKm, outboundRoute.durationMin);
  const returnFare = calculatePoolRouteFare(category, returnRoute.distanceKm, returnRoute.durationMin);
  return {
    distanceKm: outboundRoute.distanceKm,
    durationMin: outboundRoute.durationMin,
    seatDayFare: calculatePerSeatFare(outboundFare + returnFare, category.seats),
    oneWayFare: calculatePerSeatFare(outboundFare, category.seats),
    routeGeometry: JSON.stringify({ outbound: outboundRoute.geometry, return: returnRoute.geometry }),
  };
}
type PoolRouteQuote = Awaited<ReturnType<typeof routeFare>>;
function cairoToday(): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date()); }

function cairoDepartureIso(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(year!, month! - 1, day!, hour!, minute!, 0);
  let guess = localAsUtc;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess = localAsUtc - (representedAsUtc - guess);
  }
  return new Date(guess).toISOString();
}

function number(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
type CoordBody = Record<string, unknown> & { pickup_lat: number; pickup_lng: number; dropoff_lat: number; dropoff_lng: number };
function coords(b: Record<string, unknown>): b is CoordBody {
  return number(b.pickup_lat) && b.pickup_lat >= -90 && b.pickup_lat <= 90 && number(b.pickup_lng) && b.pickup_lng >= -180 && b.pickup_lng <= 180 &&
    number(b.dropoff_lat) && b.dropoff_lat >= -90 && b.dropoff_lat <= 90 && number(b.dropoff_lng) && b.dropoff_lng >= -180 && b.dropoff_lng <= 180;
}
function getGroup(db: DatabaseSync, id: number): Group | null {
  return (db.prepare("SELECT * FROM pool_groups WHERE id=?").get(id) as unknown as Group | undefined) ?? null;
}
function getMembers(db: DatabaseSync, groupId: number, activeOnly = true): Member[] {
  const sql = `SELECT * FROM pool_members WHERE group_id=? ${activeOnly ? "AND status='active'" : ""} ORDER BY pickup_order, joined_at, id`;
  return db.prepare(sql).all(groupId) as unknown as Member[];
}
function notificationType(key: string): string {
  if (key.includes("chat")) return "chat";
  if (key.includes("rating") || key.includes("feedback")) return "rating";
  if (key.startsWith("broadcast:") || key.includes("verification") || key.startsWith("admin-")) return "system";
  if (["cancel", "delay", "route", "no-captain", "expired", "replacement", "price"].some((part) => key.includes(part))) return "alert";
  return "ride";
}
function notify(db: DatabaseSync, userId: number, groupId: number | null, key: string, payload: object = {}) {
  if (groupId !== null && db.prepare("SELECT 1 FROM pool_notification_mutes WHERE user_id=? AND group_id=?").get(userId, groupId)) return;
  const actorId = typeof (payload as Record<string, unknown>).actor_id === "number" ? (payload as Record<string, unknown>).actor_id as number : null;
  const inserted = db.prepare("INSERT OR IGNORE INTO pool_notifications(user_id,group_id,actor_id,type,event_key,payload) VALUES(?,?,?,?,?,?)")
    .run(userId, groupId, actorId, notificationType(key), key, JSON.stringify(payload));
  if (Number(inserted.changes) > 0) queueMicrotask(() => sendWebPushToUser(db, userId, key));
}
function notifyGroup(db: DatabaseSync, groupId: number, key: string, payload: object = {}) {
  for (const member of getMembers(db, groupId)) notify(db, member.rider_user_id, groupId, key, payload);
}
function releaseCaptainEscrow(db: DatabaseSync, groupId: number) {
  db.prepare(`UPDATE pool_captain_escrows
    SET released_amount=MAX(0,reserved_amount-used_amount),status='released',closed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE group_id=? AND status='reserved'`).run(groupId);
}
function rebuildTripStops(db: DatabaseSync, groupId: number, onlyFuture = true) {
  const members = getMembers(db, groupId);
  const trips = db.prepare(`SELECT id,direction FROM pool_trips WHERE group_id=? ${onlyFuture ? "AND status IN ('scheduled','needs_captain','assigned')" : ""}`).all(groupId) as unknown as { id: number; direction: "outbound" | "return" }[];
  for (const trip of trips) {
    db.prepare("DELETE FROM pool_trip_stops WHERE trip_id=?").run(trip.id);
    const stops = routeStops(members, trip.direction);
    stops.forEach((stop, i) => db.prepare("INSERT INTO pool_trip_stops(trip_id,member_id,stop_type,sequence,lat,lng) VALUES(?,?,?,?,?,?)")
      .run(trip.id, stop.member_id, stop.stop_type, i + 1, stop.lat, stop.lng));
  }
}
function createTrips(db: DatabaseSync, group: Group, members: Member[]) {
  const dates = (JSON.parse(group.service_dates) as string[]).filter((date) => date >= cairoToday());
  if (dates.length === 0) {
    db.prepare("UPDATE pool_groups SET status='cancelled' WHERE id=?").run(group.id);
    notifyGroup(db, group.id, `pool-dates-expired:${group.id}`, { cancelled_free: true, create_new_group: true });
    return;
  }
  db.prepare("UPDATE pool_groups SET service_dates=? WHERE id=?").run(JSON.stringify(dates), group.id);
  const scheduledGroup = { ...group, service_dates: JSON.stringify(dates) };
  for (const date of dates) for (const direction of ["outbound", "return"] as const) {
    const time = direction === "outbound" ? group.morning_departure : group.return_departure;
    const departure = cairoDepartureIso(date, time);
    const arrival = new Date(Date.parse(departure) + (group.route_duration_min ?? 0) * 60_000).toISOString();
    db.prepare(`INSERT INTO pool_trips(group_id,service_date,direction,departure_at,estimated_arrival_at) VALUES(?,?,?,?,?)
      ON CONFLICT(group_id,service_date,direction) DO UPDATE SET departure_at=excluded.departure_at,estimated_arrival_at=excluded.estimated_arrival_at,
      status=CASE WHEN pool_trips.status='cancelled' THEN 'scheduled' ELSE pool_trips.status END`)
      .run(scheduledGroup.id, date, direction, departure, arrival);
  }
  rebuildTripStops(db, scheduledGroup.id, false);
  const discount = planDiscount(scheduledGroup.package_type);
  const days = dates.length;
  for (const member of members) {
    const amount = roundMoney((scheduledGroup.seat_day_fare ?? 0) * member.seats_reserved * days * (1 - discount));
    db.prepare(`INSERT OR IGNORE INTO pool_subscriptions(group_id,member_id,package_type,seat_day_fare,discount_rate,service_days,seats_reserved,amount_due)
      VALUES(?,?,?,?,?,?,?,?)`).run(scheduledGroup.id, member.id, scheduledGroup.package_type, scheduledGroup.seat_day_fare, discount, days, member.seats_reserved, amount);
    notify(db, member.rider_user_id, scheduledGroup.id, `pool-confirmed:${scheduledGroup.id}:${member.id}`, { service_days: days, seat_day_fare: scheduledGroup.seat_day_fare, amount_due: amount });
  }
  const first = members[0];
  if (first) {
    const captains = db.prepare(`SELECT user_id,current_lat,current_lng FROM captain_profiles
      WHERE verification_status='approved' AND current_lat IS NOT NULL AND current_lng IS NOT NULL`).all() as unknown as { user_id: number; current_lat: number; current_lng: number }[];
    const nearby = captains.some((captain) => distanceKm({ lat: captain.current_lat, lng: captain.current_lng }, { lat: first.pickup_lat, lng: first.pickup_lng }) <= 4);
    if (!nearby) {
      db.prepare("UPDATE pool_groups SET status='needs_captain' WHERE id=?").run(scheduledGroup.id);
      db.prepare("UPDATE pool_trips SET status='needs_captain' WHERE group_id=? AND status='scheduled'").run(scheduledGroup.id);
      notifyGroup(db, scheduledGroup.id, `pool-no-captain:${scheduledGroup.id}:${scheduledGroup.route_version}`, { search_radius_km: 4, can_expand_to_km: 10 });
    }
  }
}
async function recalculate(db: DatabaseSync, group: Group, members: Member[], quote?: PoolRouteQuote) {
  const category = findPoolCategory(db, group.category_id);
  if (!category || members.length === 0) return null;
  const estimate = quote ?? await routeFare(category, members);
  const seats = members.reduce((sum, m) => sum + m.seats_reserved, 0);
  const min = MIN_SEATS[category.speed_tier] ?? category.seats;
  const minimumMet = members.length >= min || members.some((m) => m.seats_reserved >= category.seats);
  const status = minimumMet ? "minimum_met" : "waiting";
  const nextVersion = group.route_version + 1;
  db.prepare(`UPDATE pool_groups SET route_distance_km=?,route_duration_min=?,seat_day_fare=?,route_geometry=?,route_version=?,status=?,
    waiting_since=CASE WHEN ?='waiting' AND status<>'waiting' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE waiting_since END,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .run(estimate.distanceKm, estimate.durationMin, estimate.seatDayFare, estimate.routeGeometry, nextVersion, status, status, group.id);
  const refreshed = getGroup(db, group.id)!;
  if (status === "minimum_met") createTrips(db, refreshed, members);
  return { estimate, status, seats, min, category };
}
function responseGroup(db: DatabaseSync, groupId: number, riderId?: number) {
  const group = getGroup(db, groupId);
  if (!group) return null;
  const { created_by_user_id: _createdBy, route_geometry: routeGeometry, ...publicGroup } = group;
  const route_geometry = routeGeometry ? JSON.parse(routeGeometry) : null;
  const members = db.prepare(`SELECT id,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,seats_reserved,status,price_decision,pickup_order,joined_at FROM pool_members WHERE group_id=? ORDER BY pickup_order,joined_at,id`).all(groupId);
  const trips = (db.prepare("SELECT id,service_date,direction,departure_at,estimated_arrival_at,captain_user_id,status FROM pool_trips WHERE group_id=? ORDER BY departure_at,direction").all(groupId) as unknown as { id: number }[])
    .map((trip) => ({ ...trip, stops: db.prepare("SELECT id,member_id,stop_type,sequence,lat,lng,reached_at FROM pool_trip_stops WHERE trip_id=? ORDER BY sequence").all(trip.id) }));
  const subscription = riderId ? db.prepare("SELECT id,package_type,seat_day_fare,discount_rate,service_days,seats_reserved,amount_due,refund_amount FROM pool_subscriptions WHERE group_id=? AND member_id=(SELECT id FROM pool_members WHERE group_id=? AND rider_user_id=? AND status='active')").get(groupId, groupId, riderId) : undefined;
  return { group: { ...publicGroup, route_geometry }, members, trips, ...(subscription ? { subscription } : {}) };
}
function captainHasScheduleConflict(db: DatabaseSync, captainId: number, candidateIds: number[]): boolean {
  const proposed = candidateIds.map((id) => db.prepare(`SELECT t.id,t.service_date,t.departure_at,t.estimated_arrival_at,t.group_id FROM pool_trips t WHERE t.id=?`).get(id) as
    { id: number; service_date: string; departure_at: string; estimated_arrival_at: string | null; group_id: number } | undefined).filter((x): x is NonNullable<typeof x> => !!x);
  const assigned = db.prepare(`SELECT id,service_date,departure_at,estimated_arrival_at,group_id FROM pool_trips WHERE captain_user_id=? AND status IN ('assigned','in_progress')`)
    .all(captainId) as unknown as { id: number; service_date: string; departure_at: string; estimated_arrival_at: string | null; group_id: number }[];
  const compare = [...assigned, ...proposed];
  const ends = (groupId: number, direction: string) => {
    const members = getMembers(db, groupId);
    const stops = routeStops(members, direction === "outbound" ? "outbound" : "return");
    return { first: stops[0], last: stops.at(-1) };
  };
  for (const next of proposed) {
    const newDir = db.prepare("SELECT direction FROM pool_trips WHERE id=?").get(next.id) as { direction: string };
    const newPath = ends(next.group_id, newDir.direction);
    for (const current of compare) {
      if (current.id === next.id) continue;
      if (current.service_date !== next.service_date) continue;
      const currentDir = db.prepare("SELECT direction FROM pool_trips WHERE id=?").get(current.id) as { direction: string };
      const currentPath = ends(current.group_id, currentDir.direction);
      const startA = Date.parse(current.departure_at), endA = Date.parse(current.estimated_arrival_at ?? current.departure_at);
      const startB = Date.parse(next.departure_at), endB = Date.parse(next.estimated_arrival_at ?? next.departure_at);
      const deadhead = (from: typeof currentPath.last, to: typeof newPath.first) => !from || !to ? 0 : distanceKm(from, to) / 25 * 3_600_000;
      if (endA <= startB && endA + deadhead(currentPath.last, newPath.first) > startB) return true;
      if (endB <= startA && endB + deadhead(newPath.last, currentPath.first) > startA) return true;
      if (startA < endB && startB < endA) return true;
    }
  }
  return false;
}
function idParam(req: Request): number | null { const id = Number(req.params.id); return Number.isInteger(id) && id > 0 ? id : null; }
function ownsActiveMember(db: DatabaseSync, groupId: number, riderId: number) {
  return db.prepare("SELECT * FROM pool_members WHERE group_id=? AND rider_user_id=? AND status='active'").get(groupId, riderId) as unknown as Member | undefined;
}
function captainCanServe(db: DatabaseSync, captainId: number, categoryId: string): boolean {
  const category = findPoolCategory(db, categoryId);
  const capability = db.prepare("SELECT has_ac,accepts_faster,accepts_saver FROM pool_captain_capabilities WHERE captain_user_id=?").get(captainId) as
    { has_ac: number; accepts_faster: number; accepts_saver: number } | undefined;
  return !!category && !!capability && capability.has_ac === category.has_ac &&
    (category.speed_tier === "faster" ? capability.accepts_faster === 1 : capability.accepts_saver === 1);
}
function readRouteOrder(db: DatabaseSync, groupId: number, memberIds: unknown): Member[] | null {
  const active = getMembers(db, groupId);
  if (!Array.isArray(memberIds) || memberIds.length !== active.length || !memberIds.every((x) => Number.isInteger(x))) return null;
  const ids = memberIds as number[];
  if (new Set(ids).size !== active.length || active.some((m) => !ids.includes(m.id))) return null;
  const byId = new Map(active.map((m) => [m.id, m]));
  return ids.map((id, index) => ({ ...byId.get(id)!, pickup_order: index }));
}

async function tryAutoJoinWaitingGroup(db: DatabaseSync, input: {
  riderId: number; categoryId: string; packageType: string; serviceDates: string[];
  morningDeparture: string; returnDeparture: string; pickupLat: number; pickupLng: number;
  dropoffLat: number; dropoffLng: number;
}): Promise<number | null> {
  const candidates = db.prepare(`SELECT * FROM pool_groups
    WHERE status='waiting' AND category_id=? AND package_type=? AND service_dates=?
      AND morning_departure=? AND return_departure=? AND created_by_user_id<>?
      AND NOT EXISTS (SELECT 1 FROM pool_members m WHERE m.group_id=pool_groups.id AND m.rider_user_id=? AND m.status='active')
      AND NOT EXISTS (SELECT 1 FROM pool_members invited WHERE invited.group_id=pool_groups.id AND invited.status='awaiting_confirmation')
    ORDER BY created_at,id`).all(
    input.categoryId, input.packageType, JSON.stringify(input.serviceDates),
    input.morningDeparture, input.returnDeparture, input.riderId, input.riderId,
  ) as unknown as Group[];

  for (const candidate of candidates) {
    const category = findPoolCategory(db, candidate.category_id);
    const current = getMembers(db, candidate.id);
    const usedSeats = current.reduce((total, member) => total + member.seats_reserved, 0);
    if (!category || usedSeats + 1 > category.seats || !candidate.route_geometry) continue;

    let geometry: { outbound?: { coordinates?: unknown } };
    try { geometry = JSON.parse(candidate.route_geometry) as typeof geometry; }
    catch { continue; }
    const nearRoute = (lat: number, lng: number) => isWithinRouteLine({ lat, lng }, geometry.outbound?.coordinates);
    if (!nearRoute(input.pickupLat, input.pickupLng) || !nearRoute(input.dropoffLat, input.dropoffLng)) continue;

    let comparisonFare = candidate.seat_day_fare;
    if (comparisonFare === null) comparisonFare = (await routeFare(category, current)).seatDayFare;
    const proposed = await routeFare(category, [...current, {
      id: -1, pickup_order: current.length,
      pickup_lat: input.pickupLat, pickup_lng: input.pickupLng,
      dropoff_lat: input.dropoffLat, dropoff_lng: input.dropoffLng,
    }]);

    db.exec("BEGIN IMMEDIATE");
    try {
      const latest = getGroup(db, candidate.id);
      const latestMembers = getMembers(db, candidate.id);
      const sameMembers = latestMembers.map((member) => member.id).join(",") === current.map((member) => member.id).join(",");
      const latestSeats = latestMembers.reduce((total, member) => total + member.seats_reserved, 0);
      if (!latest || latest.status !== "waiting" || !sameMembers || latestSeats + 1 > category.seats || ownsActiveMember(db, candidate.id, input.riderId)) {
        db.exec("ROLLBACK");
        continue;
      }

      db.prepare(`INSERT INTO pool_members(group_id,rider_user_id,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,pickup_order)
        VALUES(?,?,?,?,?,?,?)`).run(candidate.id, input.riderId, input.pickupLat, input.pickupLng, input.dropoffLat, input.dropoffLng, latestMembers.length);
      const joinedMembers = getMembers(db, candidate.id);
      const result = await recalculate(db, latest, joinedMembers, proposed);
      if (result && comparisonFare !== null && result.estimate.seatDayFare > comparisonFare * 1.15) {
        db.prepare("UPDATE pool_groups SET status='price_review' WHERE id=?").run(candidate.id);
        db.prepare("UPDATE pool_members SET price_decision='pending' WHERE group_id=? AND status='active'").run(candidate.id);
        const version = getGroup(db, candidate.id)!.route_version;
        notifyGroup(db, candidate.id, `pool-price-review:${candidate.id}:${version}`, {
          new_seat_day_fare: result.estimate.seatDayFare, route_version: version,
        });
      }
      db.exec("COMMIT");
      notify(db, input.riderId, candidate.id, `pool-auto-match:${candidate.id}:${input.riderId}`, { automatically_matched: true });
      notifyGroup(db, candidate.id, `pool-auto-match-group:${candidate.id}:${input.riderId}`, { automatically_matched: true });
      return candidate.id;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return null;
}

/** Notify riders once when a group has remained below the minimum for 72 hours. */
export function processPoolDeadlines(db: DatabaseSync) {
  const rows = db.prepare(`SELECT id,service_dates FROM pool_groups WHERE status='waiting' AND julianday('now')-julianday(waiting_since)>=3`).all() as unknown as { id: number; service_dates: string }[];
  for (const row of rows) {
    if ((JSON.parse(row.service_dates) as string[]).some((date) => date >= cairoToday())) notifyGroup(db, row.id, `pool-wait-72h:${row.id}`, { options: ["wait", "book_remaining_seats", "cancel_free"] });
  }
  const stale = db.prepare("SELECT id,service_dates FROM pool_groups WHERE status='waiting'").all() as unknown as { id: number; service_dates: string }[];
  for (const row of stale) {
    const future = (JSON.parse(row.service_dates) as string[]).some((date) => date >= cairoToday());
    if (!future) {
      db.prepare("UPDATE pool_groups SET status='cancelled' WHERE id=?").run(row.id);
      notifyGroup(db, row.id, `pool-dates-expired:${row.id}`, { cancelled_free: true, create_new_group: true });
    }
  }
  const missed = db.prepare(`SELECT t.id,t.group_id,t.service_date FROM pool_trips t
    WHERE t.status='needs_captain' AND t.captain_user_id IS NULL AND t.departure_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).all() as unknown as { id: number; group_id: number; service_date: string }[];
  const handledDays = new Set<string>();
  for (const trip of missed) {
    const dayKey = `${trip.group_id}:${trip.service_date}`;
    if (handledDays.has(dayKey)) continue;
    handledDays.add(dayKey);
    const group = getGroup(db, trip.group_id);
    if (!group) continue;
    const dayTrips = db.prepare("SELECT id FROM pool_trips WHERE group_id=? AND service_date=?").all(trip.group_id, trip.service_date) as unknown as { id: number }[];
    const discount = planDiscount(group.package_type), dailyFare = group.seat_day_fare ?? 0;
    for (const dayTrip of dayTrips) {
      db.prepare("UPDATE pool_trips SET status='cancelled',captain_user_id=NULL WHERE id=?").run(dayTrip.id);
      for (const member of getMembers(db, trip.group_id)) {
        const amount = roundMoney(dailyFare * member.seats_reserved * (1 - discount));
        db.prepare("INSERT OR IGNORE INTO pool_trip_cancellations(trip_id,member_id,charge_amount,refund_amount) VALUES(?,?,0,?)")
          .run(dayTrip.id, member.id, roundMoney(amount / 2));
      }
    }
    for (const member of getMembers(db, trip.group_id)) {
      const amount = roundMoney(dailyFare * member.seats_reserved * (1 - discount));
      db.prepare(`UPDATE pool_subscriptions SET refund_amount=refund_amount+?,amount_due=MAX(0,amount_due-?) WHERE member_id=?`)
        .run(amount, amount, member.id);
    }
    const open = db.prepare("SELECT COUNT(*) AS n FROM pool_trips WHERE group_id=? AND status IN ('scheduled','assigned','needs_captain','in_progress')").get(trip.group_id) as { n: number };
    const nextStatus = open.n === 0 ? "cancelled" : group.fixed_captain_user_id ? "active" : "needs_captain";
    db.prepare("UPDATE pool_groups SET status=? WHERE id=?").run(nextStatus, trip.group_id);
    if (nextStatus === "cancelled") releaseCaptainEscrow(db, trip.group_id);
    notifyGroup(db, trip.group_id, `pool-no-replacement:${trip.group_id}:${trip.service_date}`, { service_date: trip.service_date, charge: 0, refund: "service_day" });
  }
}

export function createPoolRouter(db: DatabaseSync) {
  const router = Router();
  const rider = [requireAuth(db), requireRole(db, "rider")];
  const captain = [requireAuth(db), requireRole(db, "captain")];
  const admin = [requireAuth(db), requireRole(db, "admin")];

  router.get("/pool/push/vapid-public-key", (_req, res) => {
    const publicKey = getWebPushPublicKey();
    if (!publicKey) { res.status(503).json({ error: "إشعارات الجهاز غير مهيأة على الخادم." }); return; }
    res.json({ public_key: publicKey });
  });

  router.put("/pool/push/subscriptions", requireAuth(db), (req, res) => {
    const body = (req.body ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    if (typeof body.endpoint !== "string" || body.endpoint.length > 4096 || typeof body.keys?.p256dh !== "string" ||
        typeof body.keys.auth !== "string" || !/^[A-Za-z0-9_-]{16,256}$/.test(body.keys.p256dh) ||
        !/^[A-Za-z0-9_-]{8,128}$/.test(body.keys.auth)) {
      res.status(400).json({ error: "بيانات اشتراك الإشعارات غير صالحة." }); return;
    }
    let secureEndpoint = false;
    try { secureEndpoint = new URL(body.endpoint).protocol === "https:"; } catch { /* invalid endpoint */ }
    if (!secureEndpoint) { res.status(400).json({ error: "يجب أن يكون عنوان خدمة الإشعارات آمنًا." }); return; }
    db.prepare(`INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth)
      VALUES(?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,
      auth=excluded.auth,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .run(req.auth!.userId, body.endpoint, body.keys.p256dh, body.keys.auth);
    res.status(201).json({ subscribed: true });
  });

  router.delete("/pool/push/subscriptions", requireAuth(db), (req, res) => {
    const endpoint = (req.body as { endpoint?: unknown } | undefined)?.endpoint;
    if (typeof endpoint !== "string") { res.status(400).json({ error: "عنوان الاشتراك مطلوب." }); return; }
    db.prepare("DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?").run(req.auth!.userId, endpoint);
    res.json({ unsubscribed: true });
  });

  router.get("/pool/categories", (_req, res) => {
    const categories = db.prepare("SELECT id,speed_tier,has_ac,seats,base_fee,rate_per_km,rate_per_min FROM pool_categories ORDER BY speed_tier,has_ac").all();
    res.json({ categories, minimum_seats: MIN_SEATS });
  });

  router.get("/admin/pool/overview", ...admin, (_req, res) => {
    const groups = db.prepare("SELECT status,COUNT(*) AS count FROM pool_groups GROUP BY status")
      .all() as unknown as { status: string; count: number }[];
    const settlements = db.prepare(`SELECT COUNT(*) AS entries,
      COALESCE(SUM(company_share_amount),0) AS company_due,
      COALESCE(SUM(captain_share_amount),0) AS captains_due
      FROM pool_ledger WHERE settlement_status='pending'`).get() as
      { entries: number; company_due: number; captains_due: number };
    const statusCounts = Object.fromEntries(groups.map((row) => [row.status, row.count]));
    res.json({ overview: {
      total_groups: groups.reduce((total, row) => total + row.count, 0),
      waiting_groups: statusCounts.waiting ?? 0,
      price_review_groups: statusCounts.price_review ?? 0,
      needs_captain_groups: statusCounts.needs_captain ?? 0,
      active_groups: statusCounts.active ?? 0,
      pending_settlement_entries: settlements.entries,
      company_due: Math.round(settlements.company_due * 100) / 100,
      captains_due: Math.round(settlements.captains_due * 100) / 100,
      settlement_status: "pending",
      payment_enabled: false,
    } });
  });

  router.get("/captain/pool/preferences", ...captain, (req, res) => {
    const stats = db.prepare("SELECT search_radius_km,absences FROM pool_captain_stats WHERE captain_user_id=?")
      .get(req.auth!.userId) as { search_radius_km: number; absences: number } | undefined;
    const capabilities = db.prepare("SELECT has_ac,accepts_faster,accepts_saver FROM pool_captain_capabilities WHERE captain_user_id=?")
      .get(req.auth!.userId) as { has_ac: number; accepts_faster: number; accepts_saver: number } | undefined;
    res.json({
      radius_km: stats?.search_radius_km ?? 4,
      absences: stats?.absences ?? 0,
      has_capabilities: Boolean(capabilities),
      has_ac: capabilities ? Boolean(capabilities.has_ac) : true,
      service_tiers: capabilities
        ? [capabilities.accepts_faster ? "faster" : null, capabilities.accepts_saver ? "saver" : null].filter(Boolean)
        : ["faster", "saver"],
    });
  });

  router.post("/rider/pool/groups", ...rider, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const categoryId = body.category_id, packageType = body.package_type;
    if (typeof categoryId !== "string" || !["daily", "weekly", "monthly"].includes(String(packageType))) { res.status(400).json({ error: "اختار الفئة ونوع الباقة بشكل صحيح." }); return; }
    const category = findPoolCategory(db, categoryId);
    const dates = serviceDates(body.service_dates, String(packageType));
    const timeOk = (v: unknown): v is string => typeof v === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
    const firstDepartureFuture = !!dates && timeOk(body.morning_departure) && Date.parse(cairoDepartureIso(dates[0]!, String(body.morning_departure))) > Date.now();
    if (!category || !dates || !coords(body) || !timeOk(body.morning_departure) || !timeOk(body.return_departure) || String(body.return_departure) <= String(body.morning_departure) || !firstDepartureFuture) { res.status(400).json({ error: "راجع الفئة، نقاط الركوب والنزول، أيام الخدمة والأوقات. الخدمة متاحة من الأحد إلى الخميس، ويجب أن يكون موعد الذهاب مستقبلًا." }); return; }
    let initialRoute: Awaited<ReturnType<typeof routeFare>>;
    try {
      initialRoute = await routeFare(category, [{ id: 0, pickup_order: 0, pickup_lat: body.pickup_lat, pickup_lng: body.pickup_lng, dropoff_lat: body.dropoff_lat, dropoff_lng: body.dropoff_lng }]);
    } catch {
      res.status(503).json({ error: "خدمة الخرائط المحلية غير متاحة الآن. شغّل OSRM ثم أعد المحاولة." }); return;
    }
    let autoMatchedGroupId: number | null;
    try {
      autoMatchedGroupId = await tryAutoJoinWaitingGroup(db, {
        riderId: req.auth!.userId, categoryId, packageType: String(packageType), serviceDates: dates,
        morningDeparture: String(body.morning_departure), returnDeparture: String(body.return_departure),
        pickupLat: body.pickup_lat, pickupLng: body.pickup_lng, dropoffLat: body.dropoff_lat, dropoffLng: body.dropoff_lng,
      });
    } catch {
      res.status(503).json({ error: "تعذر استكمال مجموعة قريبة الآن بسبب خدمة التوجيه. لم يتم إنشاء حجز منفصل." }); return;
    }
    if (autoMatchedGroupId) {
      res.status(200).json({ ...responseGroup(db, autoMatchedGroupId, req.auth!.userId), auto_matched: true });
      return;
    }
    let groupId = 0;
    db.exec("BEGIN IMMEDIATE");
    try {
      const created = db.prepare(`INSERT INTO pool_groups(created_by_user_id,category_id,package_type,service_dates,morning_departure,return_departure)
        VALUES(?,?,?,?,?,?)`).run(req.auth!.userId, categoryId, String(packageType), JSON.stringify(dates), String(body.morning_departure), String(body.return_departure));
      groupId = Number(created.lastInsertRowid);
      db.prepare(`INSERT INTO pool_members(group_id,rider_user_id,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,pickup_order)
        VALUES(?,?,?,?,?,?,0)`).run(groupId, req.auth!.userId, body.pickup_lat, body.pickup_lng, body.dropoff_lat, body.dropoff_lng);
      db.prepare("UPDATE pool_groups SET route_distance_km=?,route_duration_min=?,route_geometry=? WHERE id=?")
        .run(initialRoute.distanceKm, initialRoute.durationMin, initialRoute.routeGeometry, groupId);
      db.exec("COMMIT");
    } catch { db.exec("ROLLBACK"); res.status(400).json({ error: "تعذر إنشاء مجموعة المشوار، راجع البيانات وحاول مرة أخرى." }); return; }
    res.status(201).json(responseGroup(db, groupId, req.auth!.userId));
  });

  router.get("/rider/pool/groups", ...rider, (req, res) => {
    processPoolDeadlines(db);
    const ids = db.prepare("SELECT DISTINCT group_id FROM pool_members WHERE rider_user_id=? ORDER BY group_id DESC").all(req.auth!.userId) as unknown as { group_id: number }[];
    res.json({ groups: ids.map(({ group_id }) => responseGroup(db, group_id, req.auth!.userId)) });
  });

  router.post("/rider/pool/discover", ...rider, (req, res) => {
    processPoolDeadlines(db);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!coords(body) || !insideGreaterCairo(body.pickup_lat, body.pickup_lng) || !insideGreaterCairo(body.dropoff_lat, body.dropoff_lng)) {
      res.status(400).json({ error: "حدد نقطتي ركوب ووصول داخل القاهرة الكبرى." }); return;
    }
    const existing = new Set((db.prepare("SELECT group_id FROM pool_members WHERE rider_user_id=? AND status IN ('active','awaiting_confirmation')").all(req.auth!.userId) as { group_id: number }[]).map((row) => row.group_id));
    const groups = db.prepare("SELECT * FROM pool_groups WHERE status='waiting' ORDER BY created_at DESC LIMIT 100").all() as unknown as Group[];
    const matches = [] as { group: Record<string, unknown>; seats_available: number; pickup_distance_km: number; dropoff_distance_km: number; score: number }[];
    for (const group of groups) {
      if (existing.has(group.id)) continue;
      const category = findPoolCategory(db, group.category_id);
      if (!category) continue;
      const members = getMembers(db, group.id);
      const seatsUsed = members.reduce((total, member) => total + member.seats_reserved, 0);
      const seatsAvailable = category.seats - seatsUsed;
      if (seatsAvailable <= 0) continue;
      let geometry: { outbound?: { coordinates?: unknown } } | null = null;
      try { geometry = group.route_geometry ? JSON.parse(group.route_geometry) as { outbound?: { coordinates?: unknown } } : null; } catch { geometry = null; }
      const coordinates = geometry?.outbound?.coordinates;
      const pickup = { lat: body.pickup_lat, lng: body.pickup_lng }, dropoff = { lat: body.dropoff_lat, lng: body.dropoff_lng };
      const publicGroup = { id: group.id, category_id: group.category_id, package_type: group.package_type, service_dates: group.service_dates, morning_departure: group.morning_departure, return_departure: group.return_departure, status: group.status, route_distance_km: group.route_distance_km, route_duration_min: group.route_duration_min, seat_day_fare: group.seat_day_fare, route_version: group.route_version, fixed_captain_user_id: null, route_geometry: null };
      if (Array.isArray(coordinates)) {
        const pickupDistance = routeLineDistanceKm(pickup, coordinates), dropoffDistance = routeLineDistanceKm(dropoff, coordinates);
        if (pickupDistance > 3 || dropoffDistance > 3) continue;
        matches.push({ group: publicGroup, seats_available: seatsAvailable, pickup_distance_km: pickupDistance, dropoff_distance_km: dropoffDistance, score: pickupDistance + dropoffDistance });
      } else if (members.length && isWithinGroupPath(pickup, members) && isWithinGroupPath(dropoff, members)) {
        matches.push({ group: publicGroup, seats_available: seatsAvailable, pickup_distance_km: 0, dropoff_distance_km: 0, score: 0 });
      }
    }
    matches.sort((a, b) => a.score - b.score || Number(a.group.id) - Number(b.group.id));
    res.json({ matches: matches.slice(0, 10).map(({ score: _score, ...match }) => match) });
  });

  router.post("/rider/pool/groups/:id/join", ...rider, async (req, res) => {
    const groupId = idParam(req), body = (req.body ?? {}) as Record<string, unknown>;
    if (!groupId) { res.status(404).json({ error: "المجموعة غير موجودة." }); return; }
    const group = getGroup(db, groupId), category = group && findPoolCategory(db, group.category_id);
    if (!group || !category) { res.status(404).json({ error: "المجموعة غير موجودة." }); return; }
    if (!coords(body)) { res.status(400).json({ error: "إحداثيات الركوب أو النزول غير صحيحة." }); return; }
    const existing = ownsActiveMember(db, groupId, req.auth!.userId);
    if (existing) { res.status(409).json({ error: "أنت بالفعل ضمن المجموعة." }); return; }
    const current = getMembers(db, groupId);
    const seatsUsed = current.reduce((n, m) => n + m.seats_reserved, 0);
    if (!["waiting", "minimum_met", "needs_captain"].includes(group.status) || seatsUsed >= category.seats) { res.status(409).json({ error: "المجموعة لم تعد تستقبل ركابًا." }); return; }
    const savedGeometry = group.route_geometry ? JSON.parse(group.route_geometry) as { outbound?: { coordinates?: unknown } } : null;
    const nearRoute = (point: { lat: number; lng: number }) => savedGeometry?.outbound?.coordinates
      ? isWithinRouteLine(point, savedGeometry.outbound.coordinates)
      : isWithinGroupPath(point, current);
    if (!nearRoute({ lat: body.pickup_lat, lng: body.pickup_lng }) ||
        !nearRoute({ lat: body.dropoff_lat, lng: body.dropoff_lng })) { res.status(400).json({ error: "نقاطك أبعد من 3 كم عن خط مسار المجموعة." }); return; }
    let proposedRoute: PoolRouteQuote;
    let comparisonFare = group.seat_day_fare;
    try {
      if (comparisonFare === null) comparisonFare = (await routeFare(category, current)).seatDayFare;
      proposedRoute = await routeFare(category, [...current, { id: -1, pickup_order: current.length, pickup_lat: body.pickup_lat, pickup_lng: body.pickup_lng, dropoff_lat: body.dropoff_lat, dropoff_lng: body.dropoff_lng }]);
    } catch {
      res.status(503).json({ error: "خدمة الخرائط المحلية غير متاحة الآن. تعذر تحديث سعر ومسار المجموعة." }); return;
    }
    db.exec("BEGIN IMMEDIATE");
    let memberId = 0;
    try {
      const added = db.prepare(`INSERT INTO pool_members(group_id,rider_user_id,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,pickup_order)
        VALUES(?,?,?,?,?,?,?)`).run(groupId, req.auth!.userId, body.pickup_lat, body.pickup_lng, body.dropoff_lat, body.dropoff_lng, current.length);
      memberId = Number(added.lastInsertRowid);
      const nextMembers = getMembers(db, groupId);
      const result = await recalculate(db, group, nextMembers, proposedRoute);
      const latest = getGroup(db, groupId);
      if (result && latest?.status !== "cancelled" && comparisonFare !== null && result.estimate.seatDayFare > comparisonFare * 1.15) {
        db.prepare("UPDATE pool_groups SET status='price_review' WHERE id=?").run(groupId);
        db.prepare("UPDATE pool_members SET price_decision='pending' WHERE group_id=? AND status='active'").run(groupId);
        notifyGroup(db, groupId, `pool-price-review:${groupId}:${getGroup(db, groupId)!.route_version}`, { new_seat_day_fare: result.estimate.seatDayFare, route_version: getGroup(db, groupId)!.route_version });
      } else if (result && latest?.status !== "cancelled" && group.seat_day_fare !== null) {
        db.prepare("UPDATE pool_groups SET seat_day_fare=? WHERE id=?").run(group.seat_day_fare, groupId);
        rebuildTripStops(db, groupId);
        const updatedGroup = getGroup(db, groupId)!;
        const amount = roundMoney(group.seat_day_fare * (packageTypeDays(updatedGroup) * (1 - planDiscount(group.package_type))));
        db.prepare(`INSERT OR IGNORE INTO pool_subscriptions(group_id,member_id,package_type,seat_day_fare,discount_rate,service_days,seats_reserved,amount_due)
          VALUES(?,?,?,?,?,?,1,?)`).run(groupId, memberId, group.package_type, group.seat_day_fare, planDiscount(group.package_type), packageTypeDays(updatedGroup), amount);
        db.prepare("UPDATE pool_subscriptions SET seat_day_fare=?,discount_rate=?,service_days=?,seats_reserved=1,amount_due=? WHERE member_id=?")
          .run(group.seat_day_fare, planDiscount(group.package_type), packageTypeDays(updatedGroup), amount, memberId);
      }
      db.exec("COMMIT");
    } catch { db.exec("ROLLBACK"); res.status(409).json({ error: "تعذر الانضمام؛ ربما اكتملت المقاعد الآن." }); return; }
    res.status(200).json(responseGroup(db, groupId, req.auth!.userId));
  });

  router.post("/rider/pool/groups/:id/confirm", ...rider, async (req, res) => {
    const groupId = idParam(req), group = groupId && getGroup(db, groupId);
    if (!group || !groupId) { res.status(404).json({ error: "المجموعة غير موجودة." }); return; }
    const member = db.prepare("SELECT * FROM pool_members WHERE group_id=? AND rider_user_id=? AND status='awaiting_confirmation'").get(groupId, req.auth!.userId) as unknown as Member | undefined;
    if (!member) { res.status(404).json({ error: "لا يوجد انضمام بانتظار تأكيدك." }); return; }
    const action = (req.body as { action?: unknown } | undefined)?.action;
    if (!["accept", "decline"].includes(String(action))) { res.status(400).json({ error: "اختار قبول أو رفض." }); return; }
    const pending = db.prepare("SELECT COUNT(*) AS n FROM pool_members WHERE group_id=? AND status='awaiting_confirmation'").get(groupId) as { n: number };
    let finalRoute: PoolRouteQuote | undefined;
    if (pending.n === 1) {
      const current = getMembers(db, groupId);
      const finalMembers = action === "accept" ? [...current, member] : current;
      if (finalMembers.length > 0) {
        try { finalRoute = await routeFare(findPoolCategory(db, group.category_id)!, finalMembers); }
        catch { res.status(503).json({ error: "خدمة الخرائط المحلية غير متاحة الآن. تعذر تأكيد المجموعة." }); return; }
      }
    }
    db.prepare("UPDATE pool_members SET status=?,price_decision=? WHERE id=?").run(action === "accept" ? "active" : "cancelled", action === "accept" ? "accepted" : "pending", member.id);
    if (action === "decline") {
      const groupCreator = group.created_by_user_id;
      notify(db, groupCreator, groupId, `pool-invite-declined:${groupId}:${member.id}`, { member_id: member.id });
    }
    if (pending.n === 1) {
      const current = getMembers(db, groupId);
      if (current.length > 0) await recalculate(db, group, current, finalRoute);
    }
    res.json(responseGroup(db, groupId, req.auth!.userId));
  });

  router.post("/captain/pool/groups", ...captain, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const categoryId = body.category_id, packageType = body.package_type;
    const category = typeof categoryId === "string" ? findPoolCategory(db, categoryId) : null;
    const dates = serviceDates(body.service_dates, String(packageType));
    const timeOk = (v: unknown): v is string => typeof v === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
    const firstDepartureFuture = !!dates && timeOk(body.morning_departure) && Date.parse(cairoDepartureIso(dates[0]!, String(body.morning_departure))) > Date.now();
    if (!category || !dates || !["daily", "weekly", "monthly"].includes(String(packageType)) || !timeOk(body.morning_departure) || !timeOk(body.return_departure) || String(body.return_departure) <= String(body.morning_departure) || !firstDepartureFuture || !Array.isArray(body.riders) || body.riders.length < 1 || body.riders.length > category.seats) {
      res.status(400).json({ error: "راجع الفئة والباقة والأيام والأوقات والركاب. كل راكب يحتاج نقطة ركوب ونزول صحيحة." }); return;
    }
    const riders = body.riders as Record<string, unknown>[];
    if (riders.some((r) => !Number.isInteger(r.rider_user_id) || Number(r.rider_user_id) <= 0 || !coords(r)) || new Set(riders.map((r) => r.rider_user_id)).size !== riders.length) {
      res.status(400).json({ error: "بيانات الركاب أو النقاط غير صحيحة، ولا يمكن تكرار الراكب." }); return;
    }
    let quote: PoolRouteQuote;
    try {
      quote = await routeFare(category, riders.map((member, index) => ({
        id: index + 1, pickup_order: index,
        pickup_lat: member.pickup_lat as number, pickup_lng: member.pickup_lng as number,
        dropoff_lat: member.dropoff_lat as number, dropoff_lng: member.dropoff_lng as number,
      })));
    } catch {
      res.status(503).json({ error: "خدمة الخرائط المحلية غير متاحة الآن. شغّل OSRM ثم أعد المحاولة." }); return;
    }
    let groupId = 0;
    db.exec("BEGIN IMMEDIATE");
    try {
      const created = db.prepare(`INSERT INTO pool_groups(created_by_user_id,category_id,package_type,service_dates,morning_departure,return_departure)
        VALUES(?,?,?,?,?,?)`).run(req.auth!.userId, category.id, String(packageType), JSON.stringify(dates), String(body.morning_departure), String(body.return_departure));
      groupId = Number(created.lastInsertRowid);
      riders.forEach((member, index) => {
        db.prepare(`INSERT INTO pool_members(group_id,rider_user_id,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,status,price_decision,pickup_order)
          VALUES(?,?,?,?,?,?,'awaiting_confirmation','pending',?)`)
          .run(groupId, member.rider_user_id as number, member.pickup_lat as number, member.pickup_lng as number, member.dropoff_lat as number, member.dropoff_lng as number, index);
      });
      const all = getMembers(db, groupId, false);
      db.prepare("UPDATE pool_groups SET route_distance_km=?,route_duration_min=?,seat_day_fare=?,route_geometry=? WHERE id=?").run(quote.distanceKm, quote.durationMin, quote.seatDayFare, quote.routeGeometry, groupId);
      for (const member of all) notify(db, member.rider_user_id, groupId, `pool-invite:${groupId}:${member.id}`, { category_id: category.id, package_type: packageType, seat_day_fare: quote.seatDayFare, service_dates: dates });
      db.exec("COMMIT");
    } catch { db.exec("ROLLBACK"); res.status(400).json({ error: "تعذر تسجيل المجموعة. تأكد أن حسابات الركاب موجودة وصحيحة." }); return; }
    res.status(201).json(responseGroup(db, groupId));
  });

  router.post("/rider/pool/groups/:id/complete-seats", ...rider, async (req, res) => {
    const groupId = idParam(req), group = groupId && getGroup(db, groupId);
    if (!group || !groupId) { res.status(404).json({ error: "المجموعة غير موجودة." }); return; }
    const member = ownsActiveMember(db, groupId, req.auth!.userId), category = findPoolCategory(db, group.category_id);
    if (!member || !category || !["waiting", "minimum_met", "needs_captain"].includes(group.status)) { res.status(409).json({ error: "لا يمكن حجز المقاعد المتبقية لهذه المجموعة." }); return; }
    const members = getMembers(db, groupId), used = members.reduce((n, m) => n + m.seats_reserved, 0);
    const reserved = category.seats - used;
    if (reserved < 1) { res.status(409).json({ error: "كل المقاعد محجوزة بالفعل." }); return; }
    let routeQuote: PoolRouteQuote;
    try { routeQuote = await routeFare(category, members); }
    catch { res.status(503).json({ error: "خدمة الخرائط المحلية غير متاحة الآن. تعذر تحديث السعر." }); return; }
    db.prepare("UPDATE pool_members SET seats_reserved=seats_reserved+? WHERE id=?").run(reserved, member.id);
    const all = getMembers(db, groupId), result = await recalculate(db, group, all, routeQuote);
    if (result) {
      const refreshed = getGroup(db, groupId)!;
      if (refreshed.status === "cancelled") { res.status(409).json({ error: "انتهت كل تواريخ هذه الباقة. أنشئ مجموعة بتواريخ جديدة." }); return; }
      const subscription = db.prepare("SELECT id FROM pool_subscriptions WHERE member_id=?").get(member.id) as { id: number } | undefined;
      const amount = roundMoney((refreshed.seat_day_fare ?? 0) * category.seats * packageTypeDays(refreshed) * (1 - planDiscount(refreshed.package_type)));
      if (subscription) db.prepare("UPDATE pool_subscriptions SET seats_reserved=?,amount_due=? WHERE id=?").run(category.seats, amount, subscription.id);
      notify(db, req.auth!.userId, groupId, `pool-full-car:${groupId}`, { seats_reserved: category.seats, amount_due: amount });
    }
    res.status(200).json(responseGroup(db, groupId, req.auth!.userId));
  });

  router.post("/rider/pool/groups/:id/price-decision", ...rider, (req, res) => {
    const groupId = idParam(req), group = groupId && getGroup(db, groupId);
    const action = (req.body as { action?: unknown } | undefined)?.action;
    if (!group || !groupId) { res.status(404).json({ error: "المجموعة غير موجودة." }); return; }
    const member = ownsActiveMember(db, groupId, req.auth!.userId);
    if (!member || group.status !== "price_review" || !["accept", "decline"].includes(String(action))) { res.status(409).json({ error: "لا يوجد تغيير سعر بانتظار ردك." }); return; }
    if (action === "decline") {
      db.prepare("UPDATE pool_members SET status='cancelled',cancelled_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(member.id);
      db.prepare(`UPDATE pool_subscriptions SET cancelled_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
        refund_amount=refund_amount+amount_due,amount_due=0 WHERE member_id=?`).run(member.id);
      const active = getMembers(db, groupId), category = findPoolCategory(db, group.category_id)!;
      const used = active.reduce((n, m) => n + m.seats_reserved, 0);
      if (active.length < (MIN_SEATS[category.speed_tier] ?? category.seats) && !active.some((m) => m.seats_reserved >= category.seats)) {
        db.prepare("UPDATE pool_groups SET status='cancelled' WHERE id=?").run(groupId);
        db.prepare("UPDATE pool_trips SET status='cancelled',captain_user_id=NULL WHERE group_id=? AND status IN ('scheduled','assigned','needs_captain')").run(groupId);
        releaseCaptainEscrow(db, groupId);
        db.prepare(`UPDATE pool_subscriptions SET refund_amount=refund_amount+amount_due,amount_due=0
          WHERE group_id=? AND member_id IN (SELECT id FROM pool_members WHERE status='active')`).run(groupId);
        notifyGroup(db, groupId, `pool-below-minimum:${groupId}`, { refund: "full" });
      } else {
        const pending = db.prepare("SELECT COUNT(*) AS n FROM pool_members WHERE group_id=? AND status='active' AND price_decision='pending'").get(groupId) as { n: number };
        if (pending.n === 0) db.prepare("UPDATE pool_groups SET status='active' WHERE id=?").run(groupId);
        rebuildTripStops(db, groupId);
      }
    } else {
      const newFare = group.seat_day_fare ?? 0;
      const days = packageTypeDays(group), amount = roundMoney(newFare * member.seats_reserved * days * (1 - planDiscount(group.package_type)));
      db.prepare("UPDATE pool_members SET price_decision='accepted' WHERE id=?").run(member.id);
      db.prepare("UPDATE pool_subscriptions SET seat_day_fare=?,amount_due=? WHERE member_id=?").run(newFare, amount, member.id);
      const pending = db.prepare("SELECT COUNT(*) AS n FROM pool_members WHERE group_id=? AND status='active' AND price_decision='pending'").get(groupId) as { n: number };
      if (pending.n === 0) db.prepare("UPDATE pool_groups SET status='active' WHERE id=?").run(groupId);
    }
    res.json(responseGroup(db, groupId, req.auth!.userId));
  });

  router.post("/rider/pool/groups/:id/cancel", ...rider, (req, res) => {
    const groupId = idParam(req), group = groupId && getGroup(db, groupId);
    if (!group || !groupId) { res.status(404).json({ error: "المجموعة غير موجودة." }); return; }
    const member = ownsActiveMember(db, groupId, req.auth!.userId);
    if (!member) { res.status(404).json({ error: "اشتراكك في هذه المجموعة غير موجود." }); return; }
    const completed = db.prepare("SELECT COUNT(*) AS n FROM (SELECT service_date FROM pool_trips WHERE group_id=? GROUP BY service_date HAVING COUNT(*)=2 AND SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END)=2)").get(groupId) as { n: number };
    const alreadyCancelled = db.prepare("SELECT COUNT(DISTINCT t.service_date) AS n FROM pool_trip_cancellations c JOIN pool_trips t ON t.id=c.trip_id WHERE t.group_id=? AND c.member_id=?").get(groupId, member.id) as { n: number };
    const totalDays = packageTypeDays(group), unused = Math.max(0, totalDays - completed.n - alreadyCancelled.n);
    const discount = planDiscount(group.package_type), listDay = group.seat_day_fare ?? 0;
    let dailyCancelHours = 24;
    if (group.package_type === "daily") {
      const departure = db.prepare("SELECT departure_at,status FROM pool_trips WHERE group_id=? AND direction='outbound'").get(groupId) as { departure_at: string; status: string } | undefined;
      dailyCancelHours = departure ? (Date.parse(departure.departure_at) - Date.now()) / 3_600_000 : -1;
      if (!departure || dailyCancelHours <= 0 || ["completed", "cancelled", "in_progress"].includes(departure.status)) { res.status(409).json({ error: "انتهت مهلة إلغاء الرحلة اليومية." }); return; }
    }
    const sub = db.prepare("SELECT id FROM pool_subscriptions WHERE member_id=?").get(member.id) as { id: number } | undefined;
    const refundBeforeCap = group.package_type === "daily"
      ? (dailyCancelHours >= 12 ? listDay * member.seats_reserved : 0)
      : roundMoney(unused * listDay * member.seats_reserved * (1 - discount) * 0.90);
    const refundableUnused = roundMoney(refundBeforeCap);
    const refund = sub ? refundableUnused : 0;
    const chargeAmount = group.package_type === "daily" && dailyCancelHours < 12 ? roundMoney(listDay * member.seats_reserved) : 0;
    db.prepare("UPDATE pool_members SET status='cancelled',cancelled_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(member.id);
    if (sub) db.prepare(`UPDATE pool_subscriptions SET cancelled_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),refund_amount=refund_amount+?,
      amount_due=CASE WHEN ?=1 THEN ? ELSE amount_due END WHERE id=?`).run(refund, group.package_type === "daily" ? 0 : 1, chargeAmount, sub.id);
    const active = getMembers(db, groupId);
    const category = findPoolCategory(db, group.category_id)!;
    const belowMinimum = active.length < (MIN_SEATS[category.speed_tier] ?? category.seats) && !active.some((m) => m.seats_reserved >= category.seats);
    if (active.length === 0) {
      db.prepare("UPDATE pool_groups SET status='cancelled' WHERE id=?").run(groupId);
      db.prepare("UPDATE pool_trips SET status='cancelled',captain_user_id=NULL WHERE group_id=? AND status IN ('scheduled','assigned','needs_captain')").run(groupId);
      releaseCaptainEscrow(db, groupId);
    } else if (group.package_type === "daily" && belowMinimum) {
      db.prepare("UPDATE pool_groups SET status='waiting',fixed_captain_user_id=NULL,waiting_since=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(groupId);
      db.prepare("UPDATE pool_trips SET status='scheduled',captain_user_id=NULL WHERE group_id=? AND status IN ('scheduled','assigned','needs_captain')").run(groupId);
      rebuildTripStops(db, groupId);
      notifyGroup(db, groupId, `pool-seat-reopened:${groupId}:${group.service_dates}`, { seats_open: true });
    } else {
      if (group.status === "price_review") {
        const pending = db.prepare("SELECT COUNT(*) AS n FROM pool_members WHERE group_id=? AND status='active' AND price_decision='pending'").get(groupId) as { n: number };
        if (pending.n === 0) db.prepare("UPDATE pool_groups SET status='active' WHERE id=?").run(groupId);
      }
      rebuildTripStops(db, groupId);
    }
    res.json({ cancelled: true, charge_amount: chargeAmount, refund_amount: refund, administrative_fee_rate: group.package_type === "daily" ? 0 : 0.10,
      cancellation_hours_before_departure: group.package_type === "daily" ? roundMoney(dailyCancelHours) : null,
      group: responseGroup(db, groupId, req.auth!.userId) });
  });

  router.post("/rider/pool/groups/:id/days/:date/cancel", ...rider, (req, res) => {
    const groupId = idParam(req), group = groupId && getGroup(db, groupId), date = String(req.params.date);
    if (!group || !groupId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(404).json({ error: "المجموعة أو تاريخ الخدمة غير موجود." }); return; }
    const member = ownsActiveMember(db, groupId, req.auth!.userId);
    if (!member) { res.status(403).json({ error: "هذه الخدمة ليست ضمن اشتراكك." }); return; }
    const trips = db.prepare("SELECT id,direction,departure_at,status FROM pool_trips WHERE group_id=? AND service_date=? ORDER BY direction").all(groupId, date) as unknown as { id: number; direction: string; departure_at: string; status: string }[];
    if (trips.length !== 2 || trips.some((t) => ["completed", "cancelled", "in_progress"].includes(t.status))) { res.status(409).json({ error: "لا يمكن إلغاء يوم الخدمة الآن." }); return; }
    if (trips.some((trip) => db.prepare("SELECT 1 FROM pool_trip_cancellations WHERE trip_id=? AND member_id=?").get(trip.id, member.id))) { res.status(409).json({ error: "هذا اليوم ملغي بالفعل لهذا الراكب." }); return; }
    const outbound = trips.find((t) => t.direction === "outbound")!;
    const hours = (Date.parse(outbound.departure_at) - Date.now()) / 3_600_000;
    if (hours <= 0) { res.status(409).json({ error: "موعد الرحلة بدأ بالفعل." }); return; }
    const dailyFare = group.seat_day_fare ?? 0;
    const discountedDaily = roundMoney(dailyFare * member.seats_reserved * (1 - planDiscount(group.package_type)));
    const charge = hours < 12 ? discountedDaily : 0;
    const refund = roundMoney(discountedDaily - charge);
    for (const trip of trips) {
      const halfCharge = roundMoney(charge / 2), halfRefund = roundMoney(refund / 2);
      db.prepare("INSERT OR IGNORE INTO pool_trip_cancellations(trip_id,member_id,charge_amount,refund_amount) VALUES(?,?,?,?)").run(trip.id, member.id, halfCharge, halfRefund);
      db.prepare("DELETE FROM pool_trip_stops WHERE trip_id=? AND member_id=?").run(trip.id, member.id);
    }
    const sub = db.prepare("SELECT id FROM pool_subscriptions WHERE member_id=?").get(member.id) as { id: number } | undefined;
    if (sub && refund > 0) db.prepare(`UPDATE pool_subscriptions SET refund_amount=refund_amount+?,
      amount_due=MAX(0,amount_due-?) WHERE id=?`).run(refund, refund, sub.id);
    if (group.package_type === "daily") {
      db.prepare("UPDATE pool_members SET status='cancelled',cancelled_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(member.id);
      const remaining = getMembers(db, groupId), category = findPoolCategory(db, group.category_id)!;
      if (remaining.length < (MIN_SEATS[category.speed_tier] ?? category.seats) && !remaining.some((m) => m.seats_reserved >= category.seats)) {
        db.prepare("UPDATE pool_groups SET status='waiting',fixed_captain_user_id=NULL,waiting_since=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(groupId);
        db.prepare("UPDATE pool_trips SET status='scheduled',captain_user_id=NULL WHERE group_id=? AND service_date=?").run(groupId, date);
        rebuildTripStops(db, groupId, false);
        notifyGroup(db, groupId, `pool-seat-reopened:${groupId}:${date}`, { seats_open: true });
      }
    }
    res.json({ cancelled: true, service_date: date, charge_amount: roundMoney(charge), refund_amount: refund, seat_reopened: group.package_type === "daily" });
  });

  router.post("/captain/pool/trips/:id/stops/:stopId/reached", ...captain, (req, res) => {
    const tripId = Number(req.params.id), stopId = Number(req.params.stopId);
    const trip = db.prepare("SELECT t.captain_user_id,t.status,g.status AS group_status FROM pool_trips t JOIN pool_groups g ON g.id=t.group_id WHERE t.id=?").get(tripId) as { captain_user_id: number | null; status: string; group_status: string } | undefined;
    const stop = db.prepare("SELECT sequence,reached_at FROM pool_trip_stops WHERE id=? AND trip_id=?").get(stopId, tripId) as { sequence: number; reached_at: string | null } | undefined;
    if (!trip || !stop) { res.status(404).json({ error: "الرحلة أو الوقفة غير موجودة." }); return; }
    if (trip.captain_user_id !== req.auth!.userId || !["assigned", "in_progress"].includes(trip.status)) { res.status(403).json({ error: "الرحلة غير مسندة إليك." }); return; }
    if (trip.group_status === "price_review") { res.status(409).json({ error: "انتظر موافقة الركاب على السعر الجديد قبل بدء الرحلة." }); return; }
    if (stop.reached_at) { res.status(200).json({ reached: true }); return; }
    if (stop.sequence > 1) {
      const previous = db.prepare("SELECT reached_at FROM pool_trip_stops WHERE trip_id=? AND sequence=?").get(tripId, stop.sequence - 1) as { reached_at: string | null } | undefined;
      if (!previous?.reached_at) { res.status(409).json({ error: "سجّل الوصول إلى الوقفات بالترتيب." }); return; }
    }
    db.prepare("UPDATE pool_trip_stops SET reached_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(stopId);
    db.prepare("UPDATE pool_trips SET status='in_progress',started_at=COALESCE(started_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id=?").run(tripId);
    res.json({ reached: true, stop_id: stopId });
  });

  router.get("/pool/notifications", requireAuth(db), (req, res) => {
    const notifications = db.prepare("SELECT id,group_id,actor_id,type,event_key,payload,created_at,read_at FROM pool_notifications WHERE user_id=? AND deleted_at IS NULL ORDER BY id DESC LIMIT 100").all(req.auth!.userId) as unknown as { payload: string }[];
    res.json({ notifications: notifications.map((n) => ({ ...n, payload: JSON.parse(n.payload) })) });
  });
  router.post("/pool/notifications/:id/read", requireAuth(db), (req, res) => {
    const id = Number(req.params.id);
    const result = db.prepare("UPDATE pool_notifications SET read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=? AND read_at IS NULL").run(id, req.auth!.userId);
    res.status(Number(result.changes) ? 200 : 404).json(Number(result.changes) ? { read: true } : { error: "الإشعار غير موجود." });
  });
  router.post("/pool/notifications/:id/delete", requireAuth(db), (req, res) => {
    const result = db.prepare("UPDATE pool_notifications SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=? AND deleted_at IS NULL").run(Number(req.params.id), req.auth!.userId);
    res.status(Number(result.changes) ? 200 : 404).json(Number(result.changes) ? { deleted: true } : { error: "الإشعار غير موجود." });
  });
  router.post("/pool/notifications/:id/mute", requireAuth(db), (req, res) => {
    const item = db.prepare("SELECT group_id FROM pool_notifications WHERE id=? AND user_id=? AND deleted_at IS NULL").get(Number(req.params.id), req.auth!.userId) as { group_id: number | null } | undefined;
    if (!item) { res.status(404).json({ error: "الإشعار غير موجود." }); return; }
    if (item.group_id === null) { res.status(400).json({ error: "هذا الإشعار غير مرتبط بمشوار." }); return; }
    db.prepare("INSERT OR IGNORE INTO pool_notification_mutes(user_id,group_id) VALUES(?,?)").run(req.auth!.userId, item.group_id);
    res.json({ muted: true, group_id: item.group_id });
  });

  router.get("/captain/pool/offers", ...captain, (req, res) => {
    if (req.query.radius_km !== undefined) { res.status(400).json({ error: "غيّر نطاق البحث أولًا عبر PATCH /captain/pool/search-radius." }); return; }
    const preference = db.prepare("SELECT search_radius_km,absences FROM pool_captain_stats WHERE captain_user_id=?").get(req.auth!.userId) as { search_radius_km: number; absences: number } | undefined;
    const radius = preference?.search_radius_km ?? 4;
    const profile = db.prepare("SELECT current_lat,current_lng FROM captain_profiles WHERE user_id=? AND verification_status='approved'").get(req.auth!.userId) as { current_lat: number | null; current_lng: number | null } | undefined;
    if (!profile || profile.current_lat === null || profile.current_lng === null) { res.status(409).json({ error: "حدّث موقعك الحالي أولًا لاستقبال مسارات قريبة." }); return; }
    if (!db.prepare("SELECT 1 FROM pool_captain_capabilities WHERE captain_user_id=?").get(req.auth!.userId)) { res.status(409).json({ error: "سجّل تكييف السيارة وفئات الخدمة التي تقبلها أولًا." }); return; }
    const effectiveRadius = Math.max(4, radius - Math.min(3, preference?.absences ?? 0));
    const groups = db.prepare("SELECT * FROM pool_groups WHERE status IN ('minimum_met','active','needs_captain') ORDER BY created_at").all() as unknown as Group[];
    const offers = groups.flatMap((group) => {
      if (!captainCanServe(db, req.auth!.userId, group.category_id)) return [];
      const members = getMembers(db, group.id);
      if (!members.length) return [];
      const first = members[0]!;
      const pickupDistance = distanceKm({ lat: profile.current_lat!, lng: profile.current_lng! }, { lat: first.pickup_lat, lng: first.pickup_lng });
      if (pickupDistance > effectiveRadius) return [];
      const trip = db.prepare("SELECT id,service_date,direction,departure_at,status FROM pool_trips WHERE group_id=? AND captain_user_id IS NULL AND status IN ('scheduled','needs_captain') ORDER BY departure_at LIMIT 1").get(group.id);
      return trip ? [{ group_id: group.id, category_id: group.category_id, package_type: group.package_type, route_distance_km: group.route_distance_km,
          seat_day_fare: group.seat_day_fare, route_geometry: group.route_geometry ? JSON.parse(group.route_geometry) : null, trip }] : [];
    });
    res.json({ radius_km: radius, effective_radius_km: effectiveRadius, offers });
  });

  router.get("/captain/pool/trips", ...captain, (req, res) => {
    const trips = db.prepare(`SELECT t.*,g.category_id,g.package_type,g.route_distance_km,g.route_duration_min,g.seat_day_fare,g.route_geometry
      FROM pool_trips t JOIN pool_groups g ON g.id=t.group_id
      WHERE t.captain_user_id=? ORDER BY t.departure_at DESC LIMIT 100`).all(req.auth!.userId) as unknown as
      { id: number; route_geometry: string | null }[];
    res.json({ trips: trips.map((trip) => {
      const { route_geometry: routeGeometry, ...publicTrip } = trip;
      return { trip: { ...publicTrip, route_geometry: routeGeometry ? JSON.parse(routeGeometry) : null },
        stops: db.prepare("SELECT id,member_id,stop_type,sequence,lat,lng,reached_at FROM pool_trip_stops WHERE trip_id=? ORDER BY sequence").all(trip.id) };
    }) });
  });

  router.get("/captain/pool/trips/:id", ...captain, (req, res) => {
    const tripId = Number(req.params.id);
    const trip = db.prepare(`SELECT t.*,g.category_id,g.package_type,g.status AS group_status,g.route_distance_km,g.route_duration_min,g.seat_day_fare,g.route_geometry
      FROM pool_trips t JOIN pool_groups g ON g.id=t.group_id WHERE t.id=?`).get(tripId) as
      { id: number; group_id: number; captain_user_id: number | null; status: string; group_status: string; category_id: string; package_type: string; route_distance_km: number | null; route_duration_min: number | null; seat_day_fare: number | null; route_geometry: string | null } | undefined;
    if (!trip) { res.status(404).json({ error: "الرحلة غير موجودة." }); return; }
    if (trip.captain_user_id !== req.auth!.userId) {
      const profile = db.prepare("SELECT current_lat,current_lng FROM captain_profiles WHERE user_id=? AND verification_status='approved'").get(req.auth!.userId) as { current_lat: number | null; current_lng: number | null } | undefined;
      const first = getMembers(db, trip.group_id)[0];
      const stat = db.prepare("SELECT search_radius_km,absences FROM pool_captain_stats WHERE captain_user_id=?").get(req.auth!.userId) as { search_radius_km: number; absences: number } | undefined;
      const limit = Math.max(4, (stat?.search_radius_km ?? 4) - Math.min(3, stat?.absences ?? 0));
      if (!profile || profile.current_lat === null || profile.current_lng === null || !first || distanceKm({ lat: profile.current_lat, lng: profile.current_lng }, { lat: first.pickup_lat, lng: first.pickup_lng }) > limit || !["minimum_met", "active", "needs_captain"].includes(trip.group_status) || !captainCanServe(db, req.auth!.userId, trip.category_id)) {
        res.status(404).json({ error: "الرحلة غير موجودة ضمن نطاقك الحالي." }); return;
      }
    }
    const stops = db.prepare("SELECT id,member_id,stop_type,sequence,lat,lng,reached_at FROM pool_trip_stops WHERE trip_id=? ORDER BY sequence").all(tripId);
    const { route_geometry: routeGeometry, ...publicTrip } = trip;
    res.json({ trip: { ...publicTrip, route_geometry: routeGeometry ? JSON.parse(routeGeometry) : null }, stops });
  });

  router.patch("/captain/pool/search-radius", ...captain, (req, res) => {
    const radius = (req.body as { radius_km?: unknown } | undefined)?.radius_km;
    if (!number(radius) || radius < 4 || radius > MAX_CAPTAIN_RANGE_KM) { res.status(400).json({ error: "نطاق البحث يجب أن يكون بين 4 و10 كم." }); return; }
    db.prepare(`INSERT INTO pool_captain_stats(captain_user_id,search_radius_km) VALUES(?,?)
      ON CONFLICT(captain_user_id) DO UPDATE SET search_radius_km=excluded.search_radius_km`).run(req.auth!.userId, radius);
    res.json({ radius_km: radius });
  });

  router.put("/captain/pool/capabilities", ...captain, (req, res) => {
    const body = (req.body ?? {}) as { has_ac?: unknown; service_tiers?: unknown };
    if (typeof body.has_ac !== "boolean" || !Array.isArray(body.service_tiers) || body.service_tiers.length < 1 ||
        !body.service_tiers.every((tier) => tier === "faster" || tier === "saver") || new Set(body.service_tiers).size !== body.service_tiers.length) {
      res.status(400).json({ error: "حدد وجود التكييف وفئة واحدة على الأقل من Faster وSaver." }); return;
    }
    const faster = body.service_tiers.includes("faster") ? 1 : 0;
    const saver = body.service_tiers.includes("saver") ? 1 : 0;
    db.prepare(`INSERT INTO pool_captain_capabilities(captain_user_id,has_ac,accepts_faster,accepts_saver) VALUES(?,?,?,?)
      ON CONFLICT(captain_user_id) DO UPDATE SET has_ac=excluded.has_ac,accepts_faster=excluded.accepts_faster,accepts_saver=excluded.accepts_saver,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
      .run(req.auth!.userId, body.has_ac ? 1 : 0, faster, saver);
    res.json({ has_ac: body.has_ac, service_tiers: body.service_tiers });
  });

  router.post("/captain/pool/trips/:id/accept", ...captain, (req, res) => {
    const tripId = Number(req.params.id);
    const trip = db.prepare("SELECT t.*,g.package_type,g.service_dates,g.seat_day_fare,g.status AS group_status,g.fixed_captain_user_id FROM pool_trips t JOIN pool_groups g ON g.id=t.group_id WHERE t.id=?").get(tripId) as { id: number; group_id: number; service_date: string; departure_at: string; status: string; package_type: string; service_dates: string; seat_day_fare: number | null; group_status: string; fixed_captain_user_id: number | null } | undefined;
    if (!trip) { res.status(404).json({ error: "الرحلة غير موجودة." }); return; }
    if (!["minimum_met", "active", "needs_captain"].includes(trip.group_status) || !["scheduled", "needs_captain"].includes(trip.status)) { res.status(409).json({ error: "المسار غير متاح للقبول الآن." }); return; }
    if (trip.fixed_captain_user_id && trip.fixed_captain_user_id !== req.auth!.userId && trip.package_type !== "daily" && trip.status !== "needs_captain") { res.status(409).json({ error: "هذه الباقة لها كابتن ثابت." }); return; }
    const categoryId = (db.prepare("SELECT category_id FROM pool_groups WHERE id=?").get(trip.group_id) as { category_id: string }).category_id;
    if (!captainCanServe(db, req.auth!.userId, categoryId)) { res.status(409).json({ error: "سيارتك أو فئات الخدمة المسجلة لا تطابق هذا المسار." }); return; }
    const profile = db.prepare("SELECT current_lat,current_lng FROM captain_profiles WHERE user_id=? AND verification_status='approved'").get(req.auth!.userId) as { current_lat: number | null; current_lng: number | null } | undefined;
    if (!profile || profile.current_lat === null || profile.current_lng === null) { res.status(409).json({ error: "حدّث موقعك الحالي قبل قبول المسار." }); return; }
    const first = getMembers(db, trip.group_id)[0];
    const preference = db.prepare("SELECT search_radius_km,absences FROM pool_captain_stats WHERE captain_user_id=?").get(req.auth!.userId) as { search_radius_km: number; absences: number } | undefined;
    const effectiveRadius = Math.max(4, (preference?.search_radius_km ?? 4) - Math.min(3, preference?.absences ?? 0));
    if (!first || distanceKm({ lat: profile.current_lat, lng: profile.current_lng }, { lat: first.pickup_lat, lng: first.pickup_lng }) > effectiveRadius) { res.status(409).json({ error: `المسار خارج نطاقك الحالي (${effectiveRadius} كم).` }); return; }
    const isFixedCaptainReplacement = trip.package_type !== "daily" && trip.fixed_captain_user_id !== null &&
      trip.fixed_captain_user_id !== req.auth!.userId && trip.status === "needs_captain";
    const updates = trip.package_type === "daily" ? [tripId]
      : isFixedCaptainReplacement
        ? (db.prepare("SELECT id FROM pool_trips WHERE group_id=? AND service_date=? AND status='needs_captain'").all(trip.group_id, trip.service_date) as unknown as { id: number }[]).map((r) => r.id)
        : trip.fixed_captain_user_id
          ? [tripId]
          : (db.prepare("SELECT id FROM pool_trips WHERE group_id=? AND status IN ('scheduled','needs_captain')").all(trip.group_id) as unknown as { id: number }[]).map((r) => r.id);
    if (captainHasScheduleConflict(db, req.auth!.userId, updates)) { res.status(409).json({ error: "يوجد تعارض في الوقت أو المسافة مع رحلة أخرى مسندة إليك." }); return; }
    db.exec("BEGIN IMMEDIATE");
    for (const id of updates) {
      const result = db.prepare("UPDATE pool_trips SET captain_user_id=?,status='assigned' WHERE id=? AND captain_user_id IS NULL AND status IN ('scheduled','needs_captain')").run(req.auth!.userId, id);
      if (!Number(result.changes)) { db.exec("ROLLBACK"); res.status(409).json({ error: "قبل كابتن آخر هذا المشوار للتو." }); return; }
    }
    if (trip.package_type !== "daily" && !trip.fixed_captain_user_id) {
      db.prepare("UPDATE pool_groups SET fixed_captain_user_id=?,status='active' WHERE id=?").run(req.auth!.userId, trip.group_id);
      const seats = getMembers(db, trip.group_id).reduce((total, member) => total + member.seats_reserved, 0);
      const serviceDays = (JSON.parse(trip.service_dates) as string[]).length;
      const reserve = calculateCaptainEscrowReserve((trip.seat_day_fare ?? 0) * seats, serviceDays);
      db.prepare(`INSERT OR IGNORE INTO pool_captain_escrows(
        group_id,original_captain_user_id,package_type,service_days,daily_captain_share_amount,reserved_amount
      ) VALUES(?,?,?,?,?,?)`).run(
        trip.group_id, req.auth!.userId, trip.package_type, serviceDays,
        reserve.dailyCaptainShareAmount, reserve.reservedAmount,
      );
    } else if (isFixedCaptainReplacement) {
      db.prepare("UPDATE pool_groups SET status='active' WHERE id=?").run(trip.group_id);
    } else {
      db.prepare("UPDATE pool_groups SET status='active' WHERE id=? AND status<>'needs_captain'").run(trip.group_id);
    }
    db.exec("COMMIT");
    notifyGroup(db, trip.group_id, `pool-captain:${trip.group_id}:${req.auth!.userId}`, { captain_assigned: true });
    res.json({ accepted: true, trips: updates.map((id) => db.prepare("SELECT * FROM pool_trips WHERE id=?").get(id)) });
  });

  router.post("/captain/pool/groups/:id/reorder", ...captain, async (req, res) => {
    const groupId = idParam(req), group = groupId && getGroup(db, groupId);
    const body = (req.body ?? {}) as { member_ids?: unknown };
    if (!group || !groupId) { res.status(404).json({ error: "المجموعة غير موجودة." }); return; }
    const assigned = db.prepare("SELECT 1 FROM pool_trips WHERE group_id=? AND captain_user_id=? LIMIT 1").get(groupId, req.auth!.userId);
    if (!assigned) { res.status(403).json({ error: "يمكن للكابتن المكلّف فقط تعديل ترتيب الوقفات." }); return; }
    const ordered = readRouteOrder(db, groupId, body.member_ids);
    if (!ordered) { res.status(400).json({ error: "أرسل كل أعضاء المجموعة مرة واحدة وبالترتيب المطلوب." }); return; }
    const category = findPoolCategory(db, group.category_id)!;
    let revised: PoolRouteQuote;
    try { revised = await routeFare(category, ordered); }
    catch { res.status(503).json({ error: "خدمة الخرائط المحلية غير متاحة الآن. لم يتغير ترتيب الوقفات." }); return; }
    ordered.forEach((m, index) => db.prepare("UPDATE pool_members SET pickup_order=? WHERE id=?").run(index, m.id));
    rebuildTripStops(db, groupId);
    // ترتيب الكابتن قد يطوّل المسار؛ السعر المتفق عليه يظل ثابتًا والزيادة على الكابتن.
    db.prepare("UPDATE pool_groups SET route_distance_km=?,route_duration_min=?,route_geometry=? WHERE id=?")
      .run(revised.distanceKm, revised.durationMin, revised.routeGeometry, groupId);
    const futureTrips = db.prepare("SELECT id,departure_at FROM pool_trips WHERE group_id=? AND status IN ('scheduled','needs_captain','assigned')").all(groupId) as unknown as { id: number; departure_at: string }[];
    const newTimes = futureTrips.map((trip) => {
      const arrival = new Date(Date.parse(trip.departure_at) + revised.durationMin * 60_000).toISOString();
      db.prepare("UPDATE pool_trips SET estimated_arrival_at=? WHERE id=?").run(arrival, trip.id);
      return { trip_id: trip.id, estimated_arrival_at: arrival };
    });
    notifyGroup(db, groupId, `pool-stop-order:${groupId}:${Date.now()}`, { member_ids: ordered.map((m) => m.id), updated_times: newTimes });
    res.json({ group: responseGroup(db, groupId) });
  });

  router.post("/captain/pool/trips/:id/complete", ...captain, (req, res) => {
    const tripId = Number(req.params.id);
    const trip = db.prepare("SELECT t.*,g.seat_day_fare,g.package_type,g.status AS group_status,g.fixed_captain_user_id FROM pool_trips t JOIN pool_groups g ON g.id=t.group_id WHERE t.id=?").get(tripId) as { id: number; group_id: number; captain_user_id: number | null; status: string; seat_day_fare: number | null; package_type: string; group_status: string; fixed_captain_user_id: number | null } | undefined;
    if (!trip) { res.status(404).json({ error: "الرحلة غير موجودة." }); return; }
    if (trip.captain_user_id !== req.auth!.userId || !["assigned", "in_progress"].includes(trip.status)) { res.status(409).json({ error: "هذه الرحلة غير مسندة إليك أو غير قابلة للإقفال." }); return; }
    if (trip.group_status === "price_review") { res.status(409).json({ error: "انتظر موافقة الركاب على السعر الجديد." }); return; }
    const unreached = db.prepare("SELECT COUNT(*) AS n FROM pool_trip_stops WHERE trip_id=? AND reached_at IS NULL").get(tripId) as { n: number };
    if (unreached.n > 0) { res.status(409).json({ error: "سجّل الوصول إلى كل الوقفات قبل تأكيد تنفيذ الرحلة." }); return; }
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE pool_trips SET status='completed',completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(tripId);
      const members = getMembers(db, trip.group_id);
      const listAmount = (trip.seat_day_fare ?? 0) / 2;
      for (const member of members) {
        if (db.prepare("SELECT 1 FROM pool_trip_cancellations WHERE trip_id=? AND member_id=?").get(tripId, member.id)) continue;
        const settlement = calculatePoolSettlement(listAmount, trip.package_type as "daily" | "weekly" | "monthly");
        db.prepare(`INSERT OR IGNORE INTO pool_ledger(
          trip_id,member_id,list_amount,rider_amount,discount_amount,
          company_share_amount,captain_share_amount,company_commission_rate,settlement_status
        ) VALUES(?,?,?,?,?,?,?,?,?)`)
          .run(
            tripId,
            member.id,
            roundMoney(settlement.listAmount * member.seats_reserved),
            roundMoney(settlement.riderAmount * member.seats_reserved),
            roundMoney(settlement.discountAmount * member.seats_reserved),
            roundMoney(settlement.companyShareAmount * member.seats_reserved),
            roundMoney(settlement.captainShareAmount * member.seats_reserved),
            settlement.companyCommissionRate,
            settlement.settlementStatus,
          );
      }
      if (trip.package_type !== "daily" && trip.fixed_captain_user_id !== null && trip.captain_user_id !== trip.fixed_captain_user_id) {
        const escrow = db.prepare("SELECT id,reserved_amount,used_amount FROM pool_captain_escrows WHERE group_id=? AND status='reserved'").get(trip.group_id) as { id: number; reserved_amount: number; used_amount: number } | undefined;
        if (escrow) {
          const due = db.prepare("SELECT COALESCE(SUM(captain_share_amount),0) AS amount FROM pool_ledger WHERE trip_id=?").get(tripId) as { amount: number };
          const transfer = calculateCaptainEscrowTransfer(due.amount, escrow.reserved_amount - escrow.used_amount);
          db.prepare(`INSERT OR IGNORE INTO pool_captain_escrow_transfers(
            escrow_id,trip_id,original_captain_user_id,replacement_captain_user_id,
            amount_due,escrow_funded_amount,unfunded_amount
          ) VALUES(?,?,?,?,?,?,?)`).run(
            escrow.id, tripId, trip.fixed_captain_user_id, trip.captain_user_id,
            transfer.amountDue, transfer.escrowFundedAmount, transfer.unfundedAmount,
          );
          db.prepare("UPDATE pool_captain_escrows SET used_amount=used_amount+? WHERE id=?").run(transfer.escrowFundedAmount, escrow.id);
        }
      }
      const remaining = db.prepare("SELECT COUNT(*) AS n FROM pool_trips WHERE group_id=? AND status NOT IN ('completed','cancelled')").get(trip.group_id) as { n: number };
      if (remaining.n === 0) {
        db.prepare("UPDATE pool_groups SET status='completed' WHERE id=?").run(trip.group_id);
        releaseCaptainEscrow(db, trip.group_id);
      }
      db.exec("COMMIT");
    } catch { db.exec("ROLLBACK"); res.status(409).json({ error: "تعذر تسجيل إقفال الرحلة." }); return; }
    res.json({ trip: db.prepare("SELECT * FROM pool_trips WHERE id=?").get(tripId), ledger: db.prepare("SELECT * FROM pool_ledger WHERE trip_id=?").all(tripId) });
  });

  router.post("/captain/pool/trips/:id/report-absence", ...captain, (req, res) => {
    const tripId = Number(req.params.id);
    const trip = db.prepare(`SELECT t.group_id,t.service_date,t.captain_user_id,t.status,g.package_type,g.fixed_captain_user_id
      FROM pool_trips t JOIN pool_groups g ON g.id=t.group_id WHERE t.id=?`).get(tripId) as {
      group_id: number; service_date: string; captain_user_id: number | null; status: string;
      package_type: string; fixed_captain_user_id: number | null;
    } | undefined;
    if (!trip || trip.captain_user_id !== req.auth!.userId || !["assigned", "scheduled"].includes(trip.status)) { res.status(409).json({ error: "لا يمكن تسجيل الغياب لهذه الرحلة." }); return; }
    if (trip.package_type !== "daily" && trip.fixed_captain_user_id === req.auth!.userId) {
      db.prepare(`UPDATE pool_trips SET captain_user_id=NULL,status='needs_captain'
        WHERE group_id=? AND service_date=? AND status IN ('scheduled','assigned','needs_captain')`)
        .run(trip.group_id, trip.service_date);
    } else {
      db.prepare("UPDATE pool_trips SET captain_user_id=NULL,status='needs_captain' WHERE id=?").run(tripId);
    }
    db.prepare("UPDATE pool_groups SET status='needs_captain' WHERE id=?").run(trip.group_id);
    db.prepare("INSERT INTO pool_captain_stats(captain_user_id,absences) VALUES(?,1) ON CONFLICT(captain_user_id) DO UPDATE SET absences=absences+1").run(req.auth!.userId);
    notifyGroup(db, trip.group_id, `pool-captain-absent:${trip.group_id}:${tripId}`, { replacement_search: true, charge: 0 });
    res.json({ replacement_search_started: true, original_captain_returns_next_service_day: true });
  });

  return router;
}

function packageTypeDays(group: Group): number { return (JSON.parse(group.service_dates) as string[]).length; }
