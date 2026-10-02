export type Role = "rider" | "captain" | "admin";
export interface User { id: number; full_name: string; phone_number: string; role: Role; verified_at: string | null; created_at?: string }
export interface Category {
  id: string; speed_tier: "faster" | "saver"; has_ac: number; seats: number;
  base_fee: number; rate_per_km: number; rate_per_min: number;
}
export interface RouteLine { type: "LineString"; coordinates: [number, number][] }
export interface RouteSegment {
  from_stop_sequence: number;
  to_stop_sequence: number;
  distance_km: number;
  duration_min: number;
}
export interface RouteGeometry {
  outbound?: RouteLine;
  return?: RouteLine;
  outbound_segments?: RouteSegment[];
  return_segments?: RouteSegment[];
  provider?: "osrm" | "osrm_demo" | "openstreetmap" | "google";
}
export interface PoolTrip {
  id: number; service_date: string; direction: "outbound" | "return"; departure_at: string;
  estimated_arrival_at: string | null; captain_user_id: number | null; status: string; group_id?: number;
  stops?: PoolStop[];
}
export interface PoolStop { id: number; member_id: number; stop_type: "pickup" | "dropoff"; sequence: number; lat: number | null; lng: number | null; place_id?: string | null; reached_at: string | null }
export interface PoolMember {
  id: number; pickup_lat: number | null; pickup_lng: number | null; dropoff_lat: number | null; dropoff_lng: number | null;
  pickup_place_id: string | null; dropoff_place_id: string | null;
  seats_reserved: number; status: string; price_decision: string; pickup_order: number;
}
export interface PoolGroup {
  id: number; category_id: string; package_type: "daily" | "weekly" | "monthly"; service_dates: string;
  morning_departure: string; return_departure: string; status: string; route_distance_km: number | null;
  route_duration_min: number | null; seat_day_fare: number | null; route_geometry: RouteGeometry | null;
  route_version: number; fixed_captain_user_id: number | null;
}
export interface GroupView { group: PoolGroup; members: PoolMember[]; trips: PoolTrip[]; subscription?: { amount_due: number; refund_amount: number; service_days: number; discount_rate: number } }
export interface Notification { id: number; group_id: number | null; event_key: string; payload: Record<string, unknown>; created_at: string; read_at: string | null }
export interface CaptainProfile { verification_status: "pending" | "approved" | "rejected"; vehicle_type_id: string; license_number: string; vehicle_plate: string; current_lat: number | null; current_lng: number | null }
export interface CaptainOffer { group_id: number; category_id: string; package_type: string; route_distance_km: number | null; seat_day_fare: number | null; route_geometry: RouteGeometry | null; trip: PoolTrip }

const TOKEN_KEY = "sekka.session.token";
const USER_KEY = "sekka.session.user";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "" : "https://uorxfakceqnhxqnaawdy.supabase.co/functions/v1/sekka-api")).replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? "sb_publishable__gh8lr-A5tr5Q9CMi7YIuw_yrRFwgJl";

export function getStoredSession(): { token: string; user: User } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);
    return token && user ? { token, user: JSON.parse(user) as User } : null;
  } catch { return null; }
}

export function storeSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (API_BASE_URL) headers.apikey = SUPABASE_PUBLISHABLE_KEY;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      method: options.method ?? "GET", headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new ApiError(0, "تعذر الاتصال بالخادم. تأكد أنه يعمل ثم حاول مرة أخرى.");
  }
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new ApiError(response.status, payload.error ?? "حصل خطأ غير متوقع. حاول مرة أخرى.");
  return payload;
}
