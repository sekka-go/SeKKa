import { t } from "./i18n/runtime";

export type Role = "rider" | "captain" | "admin";
export interface User { id: number; full_name: string; phone_number: string; role: Role; verified_at: string | null; created_at?: string }
export interface Category {
  id: string; speed_tier: "faster" | "saver"; has_ac: number; seats: number;
  base_fee: number; rate_per_km: number; rate_per_min: number;
}
export interface SavedPlace { place_type: "home" | "work" | "frequent"; label: string; lat: number; lng: number; }
export interface RiderCommuterPreferences {
  usual_days: number[];
  usual_departure_time: string;
  usual_return_time: string;
  frequent_places: Array<{ label: string; lat: number; lng: number }>;
}
export type CommuterCardType = "commute_match" | "recurring_commute" | "weekly_reminder" | "monthly_reminder" | "invite_friends" | "new_match" | "empty" | "campaign";
export type CommuterCardAction = "open-booking" | "open-trips" | "invite-friends" | "manage-preferences" | "join-group";
export interface CommuterBoardCard {
  id: string; type: CommuterCardType; title: string; description: string; icon: string;
  cta_text: string; cta_action: CommuterCardAction; priority: number;
  targeting_rules: Record<string, unknown>; start_date: string | null; end_date: string | null;
  active: boolean; display_duration: number; group_id?: number;
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
  id: number; rider_user_id?: number; pickup_lat: number | null; pickup_lng: number | null; dropoff_lat: number | null; dropoff_lng: number | null;
  pickup_place_id: string | null; dropoff_place_id: string | null;
  seats_reserved: number; status: string; price_decision: string; pickup_order: number;
}
export interface PoolGroup {
  id: number; created_by_user_id?: number; category_id: string; package_type: "daily" | "weekly" | "monthly"; service_dates: string;
  morning_departure: string; return_departure: string; status: string; route_distance_km: number | null;
  route_duration_min: number | null; seat_day_fare: number | null; route_geometry: RouteGeometry | null;
  route_version: number; fixed_captain_user_id: number | null;
}
export interface GroupView { group: PoolGroup; members: PoolMember[]; trips: PoolTrip[]; subscription?: { amount_due: number; refund_amount: number; service_days: number; discount_rate: number } }
export interface PoolDiscoveryMatch { group: PoolGroup; seats_available: number; pickup_distance_km: number; dropoff_distance_km: number }
export interface Notification { id: number; group_id: number | null; actor_id?: number | null; type?: "ride" | "chat" | "rating" | "alert" | "system"; event_key: string; payload: Record<string, unknown>; created_at: string; read_at: string | null }
export interface CaptainProfile { verification_status: "pending" | "approved" | "rejected"; status?: "active" | "suspended_grace_expired"; grace_period_expires_at?: string | null; vehicle_type_id: string; license_number: string; vehicle_plate: string; current_lat: number | null; current_lng: number | null }
export type VerificationDocumentType = "national_id_front" | "national_id_back" | "driving_license_front" | "driving_license_back" | "vehicle_license_front" | "vehicle_license_back" | "criminal_record" | "drug_test";
export type VerificationDocument = { id: number; document_type: VerificationDocumentType; status: "pending" | "approved" | "rejected"; rejection_reason: string | null; uploaded_at: string; reviewed_at: string | null };
export interface CaptainOffer { group_id: number; category_id: string; package_type: string; route_distance_km: number | null; seat_day_fare: number | null; route_geometry: RouteGeometry | null; trip: PoolTrip }
export interface CaptainLine {
  id: number; vehicle_type_id: "private_car" | "hiace"; origin_label: string; destination_label: string;
  arrival_time: string; service_days: number[]; seats: number; price_per_seat: number;
  payment_methods: string[]; status: "active" | "paused" | "cancelled";
}

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

export async function api<T>(path: string, options: { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) forwardAbort();
  else options.signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, Math.max(1, options.timeoutMs ?? 15_000));
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (API_BASE_URL) headers.apikey = SUPABASE_PUBLISHABLE_KEY;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      method: options.method ?? "GET", headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });
    let payload: { error?: string } & T;
    try { payload = await response.json() as { error?: string } & T; }
    catch (cause) {
      if (timedOut || controller.signal.aborted) throw cause;
      payload = {} as { error?: string } & T;
    }
    if (!response.ok) throw new ApiError(response.status, payload.error ?? "حصل خطأ غير متوقع. حاول مرة أخرى.");
    return payload;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    if (timedOut) throw new ApiError(408, t("تعذر التحميل، يرجى المحاولة مرة أخرى."));
    if (options.signal?.aborted) throw cause;
    throw new ApiError(0, "تعذر الاتصال بالخادم. تأكد أنه يعمل ثم حاول مرة أخرى.");
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}

export async function uploadVerificationDocument(token: string, documentType: VerificationDocumentType, file: File): Promise<{ document: VerificationDocument }> {
  const form = new FormData();
  form.append("file", file, file.name);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  if (API_BASE_URL) headers.apikey = SUPABASE_PUBLISHABLE_KEY;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/verification/documents/${documentType}`, { method: "POST", headers, body: form });
  } catch {
    throw new ApiError(0, "تعذر رفع الملف الآن. تأكد من اتصالك وحاول مرة أخرى.");
  }
  const payload = await response.json().catch(() => ({})) as { error?: string; document?: VerificationDocument };
  if (!response.ok) throw new ApiError(response.status, payload.error ?? "تعذر رفع المستند.");
  if (!payload.document) throw new ApiError(502, "لم يصل تأكيد رفع المستند من الخادم.");
  return { document: payload.document };
}

async function profileAvatarRequest(token: string, method: "POST" | "DELETE", file?: File): Promise<void> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  if (API_BASE_URL) headers.apikey = SUPABASE_PUBLISHABLE_KEY;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/profile/avatar`, {
      method, headers,
      ...(file ? { body: (() => { const form = new FormData(); form.append("file", file, file.name); return form; })() } : {}),
    });
  } catch { throw new ApiError(0, "تعذر الاتصال بالخادم. حاول مرة أخرى."); }
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new ApiError(response.status, payload.error ?? "تعذر تحديث الصورة الشخصية.");
}

export function uploadProfileAvatar(token: string, file: File) { return profileAvatarRequest(token, "POST", file); }
export function deleteProfileAvatar(token: string) { return profileAvatarRequest(token, "DELETE"); }

export async function fetchProfileAvatar(token: string, userId: number, signal: AbortSignal): Promise<string | null> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "image/*" };
  if (API_BASE_URL) headers.apikey = SUPABASE_PUBLISHABLE_KEY;
  const response = await fetch(`${API_BASE_URL}/api/profile/${userId}/avatar`, { headers, signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError(response.status, "تعذر تحميل الصورة الشخصية.");
  return URL.createObjectURL(await response.blob());
}
