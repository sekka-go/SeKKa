import type { DatabaseSync } from "node:sqlite";

export type TripStatus = "in_progress" | "completed";

export interface TripRecord {
  id: number;
  match_id: number;
  status: TripStatus;
  started_at: string;
  completed_at: string | null;
  total_distance_km: number | null;
  total_amount: number | null;
}

export interface TripStopRecord {
  id: number;
  trip_id: number;
  sequence: number;
  lat: number;
  lng: number;
  reached_at: string | null;
  fare_at_stop: number | null;
}

/**
 * الرحلة + سياقها (الكابتن بتاعها والراكب بتاعها) في استعلام واحد — الـ
 * Routes محتاجة الاتنين للتحقق من الملكية (403) قبل أي فعل، بدل استعلامين
 * منفصلين لكل Request.
 */
export interface TripWithContext extends TripRecord {
  captain_user_id: number;
  rider_user_id: number;
  daily_commute_request_id: number;
}

const TRIP_COLUMNS = `id, match_id, status, started_at, completed_at, total_distance_km, total_amount`;

export function findTripById(db: DatabaseSync, id: number): TripRecord | null {
  const row = db
    .prepare(`SELECT ${TRIP_COLUMNS} FROM trips WHERE id = ?`)
    .get(id) as unknown as TripRecord | undefined;
  return row ? { ...row } : null;
}

export function findTripByMatchId(db: DatabaseSync, matchId: number): TripRecord | null {
  const row = db
    .prepare(`SELECT ${TRIP_COLUMNS} FROM trips WHERE match_id = ?`)
    .get(matchId) as unknown as TripRecord | undefined;
  return row ? { ...row } : null;
}

export function findTripWithContextById(db: DatabaseSync, id: number): TripWithContext | null {
  const row = db
    .prepare(
      `SELECT t.id, t.match_id, t.status, t.started_at, t.completed_at,
              t.total_distance_km, t.total_amount,
              m.captain_user_id AS captain_user_id,
              m.daily_commute_request_id AS daily_commute_request_id,
              dcr.rider_user_id AS rider_user_id
       FROM trips t
       JOIN matches m ON m.id = t.match_id
       JOIN daily_commute_requests dcr ON dcr.id = m.daily_commute_request_id
       WHERE t.id = ?`,
    )
    .get(id) as unknown as TripWithContext | undefined;
  return row ? { ...row } : null;
}

export function findTripStopsByTripId(db: DatabaseSync, tripId: number): TripStopRecord[] {
  const rows = db
    .prepare(
      `SELECT id, trip_id, sequence, lat, lng, reached_at, fare_at_stop
       FROM trip_stops WHERE trip_id = ? ORDER BY sequence ASC`,
    )
    .all(tripId) as unknown as TripStopRecord[];
  return rows.map((row) => ({ ...row }));
}

export function findTripStopById(db: DatabaseSync, id: number): TripStopRecord | null {
  const row = db
    .prepare(
      `SELECT id, trip_id, sequence, lat, lng, reached_at, fare_at_stop
       FROM trip_stops WHERE id = ?`,
    )
    .get(id) as unknown as TripStopRecord | undefined;
  return row ? { ...row } : null;
}

/**
 * يسجّل وصول الكابتن لنقطة معينة (reached_at + fare_at_stop المحسوبة).
 * بيرجع null لو الصف مش موجود أصلًا أو كان وصل قبل كده (WHERE reached_at IS
 * NULL في نفس الاستعلام، مش فحص منفصل، عشان نتجنب Race condition). الـ
 * Trigger (trg_trip_stops_sequence_order) هو اللي بيرفض لو ده مش دوره في
 * التسلسل — بيتفجّر كـ Exception، الـ Route هو اللي يفسّرها.
 */
export function markTripStopReached(
  db: DatabaseSync,
  stopId: number,
  fareAtStop: number,
): TripStopRecord | null {
  const result = db
    .prepare(
      `UPDATE trip_stops
       SET reached_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), fare_at_stop = ?
       WHERE id = ? AND reached_at IS NULL`,
    )
    .run(fareAtStop, stopId);
  if (result.changes === 0) return null;
  return findTripStopById(db, stopId);
}

/**
 * يقفل الرحلة (status='completed') ويسجّل المسافة/المبلغ الكليين. بيرجع
 * null لو الرحلة مش in_progress فعليًا وقت التنفيذ (WHERE status =
 * 'in_progress' في نفس الاستعلام). الـ Trigger
 * (trg_trips_complete_requires_all_stops_reached) دفاع طبقة ثانية لو حاول
 * حد يقفلها قبل آخر Stop حتى لو الكود فوقه فشل يتحقق صح.
 */
export function completeTrip(
  db: DatabaseSync,
  tripId: number,
  totalDistanceKm: number,
  totalAmount: number,
): TripRecord | null {
  const result = db
    .prepare(
      `UPDATE trips
       SET status = 'completed',
           completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
           total_distance_km = ?,
           total_amount = ?
       WHERE id = ? AND status = 'in_progress'`,
    )
    .run(totalDistanceKm, totalAmount, tripId);
  if (result.changes === 0) return null;
  return findTripById(db, tripId);
}

/** رحلات مكتملة بتاعة راكب معيّن — "رحلاتي" (Trip History). الأحدث الأول. */
export function findCompletedTripsByRiderId(db: DatabaseSync, riderUserId: number) {
  const rows = db
    .prepare(
      `SELECT t.id, t.match_id, t.status, t.started_at, t.completed_at,
              t.total_distance_km, t.total_amount,
              m.captain_user_id AS captain_user_id
       FROM trips t
       JOIN matches m ON m.id = t.match_id
       JOIN daily_commute_requests dcr ON dcr.id = m.daily_commute_request_id
       WHERE dcr.rider_user_id = ? AND t.status = 'completed'
       ORDER BY t.completed_at DESC`,
    )
    .all(riderUserId) as unknown as (TripRecord & { captain_user_id: number })[];
  return rows.map((row) => ({ ...row }));
}

/** رحلات مكتملة بتاعة كابتن معيّن — "أرباحي" (Earnings). الأحدث الأول. */
export function findCompletedTripsByCaptainId(db: DatabaseSync, captainUserId: number) {
  const rows = db
    .prepare(
      `SELECT t.id, t.match_id, t.status, t.started_at, t.completed_at,
              t.total_distance_km, t.total_amount
       FROM trips t
       JOIN matches m ON m.id = t.match_id
       WHERE m.captain_user_id = ? AND t.status = 'completed'
       ORDER BY t.completed_at DESC`,
    )
    .all(captainUserId) as unknown as TripRecord[];
  return rows.map((row) => ({ ...row }));
}
