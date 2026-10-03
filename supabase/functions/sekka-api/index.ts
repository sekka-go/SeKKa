import { createClient } from "npm:@supabase/supabase-js@2";
import { routeWithOsrm, RoutingError } from "./routing.ts";

type Json = Record<string, unknown>;
type User = { id: number; full_name: string; phone_number: string; role: "rider" | "captain" | "admin"; verified_at: string | null; created_at: string };
const encoder = new TextEncoder();
const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function reply(data: unknown, status = 200, origin = "") {
  const corsOrigin = origin === "http://localhost:5173" || origin === "https://sekka-go.pages.dev" || origin.endsWith(".sekka-go.pages.dev") ? origin : "null";
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": corsOrigin, "vary": "Origin", ...corsHeaders },
  });
}
function error(message: string, status = 400, origin = "") { return reply({ error: message }, status, origin); }
class ApiFailure extends Error { constructor(message: string, readonly status: number) { super(message); } }
function selectLocation(body: Json, prefix: "pickup" | "dropoff"): { lat: number; lng: number; place_id: null; label: string } {
  if (clean(body[`${prefix}_place_id`]) || clean(body[`${prefix}_search_id`])) {
    throw new ApiFailure("البحث النصي عن العناوين غير متاح؛ اختر الموقع بالنقر على الخريطة.", 410);
  }
  const lat = body[`${prefix}_lat`], lng = body[`${prefix}_lng`];
  if (!validPoint(lat, lng)) throw new ApiFailure("اختر نقطة صحيحة للركوب والنزول بالنقر على الخريطة.", 400);
  if (!isGreaterCairoPoint(Number(lat), Number(lng))) throw new ApiFailure("المشاوير متاحة داخل القاهرة الكبرى فقط.", 400);
  return { lat: Number(lat), lng: Number(lng), place_id: null, label: "" };
}
function clean(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function number(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function validPoint(lat: unknown, lng: unknown) { return number(lat) && lat >= -90 && lat <= 90 && number(lng) && lng >= -180 && lng <= 180; }
const GREATER_CAIRO = { south: 29.65, west: 30.55, north: 30.45, east: 31.85 } as const;
function isGreaterCairoPoint(lat: number, lng: number) {
  return lat >= GREATER_CAIRO.south && lat <= GREATER_CAIRO.north && lng >= GREATER_CAIRO.west && lng <= GREATER_CAIRO.east;
}
async function searchGreaterCairo(query: string) {
  const configured = Deno.env.get("PHOTON_API_BASE_URL") ?? "https://photon.komoot.io";
  let base: URL;
  try { base = new URL(configured); } catch { throw new ApiFailure("إعدادات البحث عن العناوين غير صالحة.", 503); }
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new ApiFailure("إعدادات البحث عن العناوين غير صالحة.", 503);
  }
  const searchUrl = new URL(`${base.toString().replace(/\/$/, "")}/api`);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("bbox", `${GREATER_CAIRO.west},${GREATER_CAIRO.south},${GREATER_CAIRO.east},${GREATER_CAIRO.north}`);
  searchUrl.searchParams.set("countrycode", "EG");

  searchUrl.searchParams.set("limit", "8");
  searchUrl.searchParams.set("lat", "30.0444");
  searchUrl.searchParams.set("lon", "31.2357");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(searchUrl, {
      headers: { "User-Agent": "SeKKa-Ride-App/1.0 (+https://sekka-go.pages.dev/)" },
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiFailure("خدمة البحث عن المواقع غير متاحة مؤقتًا. حاول مرة أخرى.", 503);
    const payload = await response.json() as { features?: Array<{ geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> }> };
    if (!Array.isArray(payload.features)) throw new ApiFailure("خدمة البحث أعادت نتائج غير صالحة.", 502);
    const suggestions = payload.features.flatMap((feature) => {
      const coordinates = feature.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
      const lng = coordinates[0], lat = coordinates[1];
      if (!number(lng) || !number(lat)) return [];
      if (!isGreaterCairoPoint(lat, lng)) return [];
      const properties = feature.properties ?? {};
      const name = clean(properties.name) ? properties.name : "موقع داخل القاهرة الكبرى";
      const detail = [properties.housenumber, properties.street, properties.district, properties.city, properties.state]
        .filter((part): part is string => typeof part === "string" && part.trim().length > 0 && part.trim() !== name.trim());
      const label = [name, ...detail].filter((part, index, all) => all.indexOf(part) === index).join("، ").slice(0, 240);
      return [{ label, lat, lng }];
    });
    return suggestions.slice(0, 5);
  } catch (cause) {
    if (cause instanceof ApiFailure) throw cause;
    throw new ApiFailure("تعذر البحث عن العنوان الآن. حاول مرة أخرى.", 503);
  } finally { clearTimeout(timeout); }
}
function hex(bytes: Uint8Array) { return [...bytes].map((v) => v.toString(16).padStart(2, "0")).join(""); }
function bytesFromHex(value: string) { return new Uint8Array(value.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []); }
async function digest(value: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))); }
async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 310_000 }, key, 256));
  return `pbkdf2$310000$${hex(salt)}$${hex(derived)}`;
}
async function verifyPassword(password: string, stored: string) {
  const [kind, rounds, saltText, expected] = stored.split("$");
  if (kind !== "pbkdf2" || Number(rounds) !== 310_000 || !saltText || !expected) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: bytesFromHex(saltText), iterations: 310_000 }, key, 256));
  const target = bytesFromHex(expected);
  if (actual.length !== target.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ target[i];
  return diff === 0;
}
const url = Deno.env.get("SUPABASE_URL") ?? "";
const apiKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ?? ""; } catch { return ""; }
})();
const db = url && apiKey ? createClient(url, apiKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

async function readBody(req: Request): Promise<Json> {
  const text = await req.text();
  if (text.length > 1_000_000) throw new Error("حجم الطلب أكبر من المسموح.");
  if (!text) return {};
  const value = JSON.parse(text);
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}
async function takeLimit(key: string, limit: number, seconds: number) {
  const { data, error: dbError } = await db!.rpc("sekka_take_rate_limit", { p_key: key.slice(0, 512), p_limit: limit, p_window_seconds: seconds });
  if (dbError) throw dbError;
  return data === true;
}
async function authenticate(req: Request): Promise<User | null> {
  const raw = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw) return null;
  const tokenHash = await digest(raw);
  const { data: session, error: queryError } = await db!.from("sessions").select("user_id,expires_at,revoked_at").eq("token_hash", tokenHash).maybeSingle();
  if (queryError || !session || session.revoked_at || Date.parse(session.expires_at) <= Date.now()) return null;
  const { data: user } = await db!.from("users").select("id,full_name,phone_number,role,verified_at,created_at").eq("id", session.user_id).maybeSingle();
  return user as User | null;
}
async function requireRole(user: User | null, roles: User["role"][], origin: string) {
  if (!user) return error("سجّل الدخول أولًا.", 401, origin);
  if (!roles.includes(user.role)) return error("ما عندكش صلاحية لتنفيذ الإجراء ده.", 403, origin);
  return null;
}
async function notifyUser(userId: number, groupId: number | null, eventKey: string, payload: Json = {}) {
  await db!.from("pool_notifications").upsert({ user_id: userId, group_id: groupId, event_key: eventKey, payload }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
}
function packageDays(type: string) { return type === "weekly" ? 5 : type === "monthly" ? 22 : type === "daily" ? 1 : 0; }
function discountRate(type: string) { return type === "weekly" ? 0.05 : type === "monthly" ? 0.10 : 0; }
function otpProviderReady() {
  return ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"].every((name) => clean(Deno.env.get(name)));
}
async function captainOtpEnabled() {
  const { data, error: queryError } = await db!.from("app_feature_flags").select("enabled").eq("flag_name", "captain_phone_otp").maybeSingle();
  if (queryError) throw queryError;
  return data?.enabled === true;
}
function phoneE164(value: string) {
  const trimmed = value.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00") && /^[1-9]\d{7,14}$/.test(digits.slice(2))) return `+${digits.slice(2)}`;
  if (/^20\d{9,10}$/.test(digits)) return `+${digits}`;
  if (/^01[0125]\d{8}$/.test(digits)) return `+20${digits.slice(1)}`;
  if (/^1[0125]\d{8}$/.test(digits)) return `+20${digits}`;
  return null;
}
async function callTwilioVerify(path: "Verifications" | "VerificationCheck", params: URLSearchParams) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const service = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")!;
  const response = await fetch(`https://verify.twilio.com/v2/Services/${service}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    signal: AbortSignal.timeout(8_000),
  });
  const result = await response.json().catch(() => ({})) as Json;
  return { response, result };
}
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function validDates(value: unknown, type: string): string[] | null {
  const count = packageDays(type);
  if (!count || !Array.isArray(value) || value.length !== count || !value.every((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))) return null;
  const dates = value as string[];
  if (new Set(dates).size !== count || dates[0]! < new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date())) return null;
  for (let index = 0; index < dates.length; index++) {
    const date = dates[index]!;
    const parsed = new Date(date + "T12:00:00Z");
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date || [5, 6].includes(parsed.getUTCDay())) return null;
    if (index > 0) {
      let expected = new Date(dates[index - 1]! + "T12:00:00Z");
      expected.setUTCDate(expected.getUTCDate() + 1);
      while ([5, 6].includes(expected.getUTCDay())) expected.setUTCDate(expected.getUTCDate() + 1);
      if (expected.toISOString().slice(0, 10) !== date) return null;
    }
  }
  return dates;
}
function cairoIso(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number); const [h, min] = time.split(":").map(Number);
  const localAsUtc = Date.UTC(y, m - 1, d, h, min, 0); let guess = localAsUtc;
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess = localAsUtc - (represented - guess);
  }
  return new Date(guess).toISOString();
}
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => d * Math.PI / 180;
  const x = rad(b.lng - a.lng) * Math.cos(rad((a.lat + b.lat) / 2)), y = rad(b.lat - a.lat);
  return Math.hypot(x, y) * 6371.0088;
}
async function roadRoute(points: Json[]) {
  if (points.length < 2) throw new ApiFailure("المسار يحتاج نقطتين على الأقل.", 400);
  if (!points.every((point) => validPoint(point.lat, point.lng))) {
    throw new ApiFailure("إحدى محطات المسار لا تحتوي إحداثيات صالحة؛ أعد اختيارها على الخريطة.", 400);
  }
  try {
    const result = await routeWithOsrm(
      points.map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })),
      { baseUrl: Deno.env.get("SEKKA_ROUTING_URL") ?? "https://router.project-osrm.org" },
    );
    return {
      distanceKm: roundMoney(result.distance_km),
      durationMin: roundMoney(result.duration_min),
      provider: result.provider,
      geometry: result.geometry,
      segments: result.segments.map((segment) => ({
        ...segment,
        distance_km: roundMoney(segment.distance_km),
        duration_min: roundMoney(segment.duration_min),
      })),
    };
  } catch (err) {
    if (err instanceof RoutingError) throw new ApiFailure(err.message, err.status);
    throw new ApiFailure("خدمة حساب الطريق غير متاحة حاليًا. لم يتغير الحجز.", 503);
  }
}
function lineDistanceKm(point: { lat: number; lng: number }, coordinates: unknown) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1], b = coordinates[i];
    if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) continue;
    const mean = (point.lat + a[1] + b[1]) / 3 * Math.PI / 180, scale = 6371.0088 * Math.PI / 180;
    const px = point.lng * scale * Math.cos(mean), py = point.lat * scale, ax = a[0] * scale * Math.cos(mean), ay = a[1] * scale, bx = b[0] * scale * Math.cos(mean), by = b[1] * scale;
    const dx = bx - ax, dy = by - ay, t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
}
async function getGroup(id: number) {
  const { data, error: e } = await db!.from("pool_groups").select("*").eq("id", id).maybeSingle();
  if (e) throw e; return data;
}
async function getMembers(id: number, active = true) {
  let query = db!.from("pool_members").select("*").eq("group_id", id).order("pickup_order").order("id");
  if (active) query = query.eq("status", "active");
  const { data, error: e } = await query;
  if (e) throw e; return data ?? [];
}
function routePoints(members: Json[], direction: "outbound" | "return") {
  const forward = [
    ...members.map((m) => ({ lat: validPoint(m.pickup_lat, m.pickup_lng) ? Number(m.pickup_lat) : null, lng: validPoint(m.pickup_lat, m.pickup_lng) ? Number(m.pickup_lng) : null, place_id: null, member_id: m.id, stop_type: "pickup" })),
    ...members.map((m) => ({ lat: validPoint(m.dropoff_lat, m.dropoff_lng) ? Number(m.dropoff_lat) : null, lng: validPoint(m.dropoff_lat, m.dropoff_lng) ? Number(m.dropoff_lng) : null, place_id: null, member_id: m.id, stop_type: "dropoff" })),
  ];
  return direction === "outbound" ? forward : [...forward].reverse().map((s) => ({ ...s, stop_type: s.stop_type === "pickup" ? "dropoff" : "pickup" }));
}
async function quote(members: Json[], category: Json) {
  const outPoints = routePoints(members, "outbound"), returnPoints = routePoints(members, "return");
  const [out, back] = await Promise.all([roadRoute(outPoints), roadRoute(returnPoints)]);
  const outFare = Number(category.base_fee) + out.distanceKm * Number(category.rate_per_km) + out.durationMin * Number(category.rate_per_min);
  const backFare = Number(category.base_fee) + back.distanceKm * Number(category.rate_per_km) + back.durationMin * Number(category.rate_per_min);
  return { out, back, total: roundMoney(outFare + backFare), seatDayFare: roundMoney((outFare + backFare) / Number(category.seats)), geometry: { outbound: out.geometry, outbound_segments: out.segments, return: back.geometry, return_segments: back.segments, provider: out.provider } };
}
async function activateGroup(group: Json, members: Json[], category: Json, quoteData: Awaited<ReturnType<typeof quote>>) {
  const occupiedSeats = members.reduce((sum, m) => sum + Number(m.seats_reserved), 0);
  if (occupiedSeats < Number(category.seats)) return;
  if (members.some((m) => m.price_decision !== "accepted")) return;
  const dates = Array.isArray(group.service_dates) ? group.service_dates as string[] : JSON.parse(String(group.service_dates));
  const type = String(group.package_type), discount = discountRate(type);
  for (const member of members) {
    const amountDue = roundMoney(Number(quoteData.seatDayFare) * dates.length * Number(member.seats_reserved) * (1 - discount));
    await db!.from("pool_subscriptions").upsert({ group_id: group.id, member_id: member.id, package_type: type, seat_day_fare: quoteData.seatDayFare, discount_rate: discount, service_days: dates.length, seats_reserved: member.seats_reserved, amount_due: amountDue }, { onConflict: "member_id" });
  }
  for (const date of dates) {
    for (const direction of ["outbound", "return"] as const) {
      const departure = direction === "outbound" ? group.morning_departure : group.return_departure;
      const { data: trip, error: te } = await db!.from("pool_trips").upsert({ group_id: group.id, service_date: date, direction, departure_at: cairoIso(date, String(departure).slice(0, 5)), status: "scheduled" }, { onConflict: "group_id,service_date,direction" }).select().single();
      if (te) throw te;
      const stops = routePoints(members, direction);
      await db!.from("pool_trip_stops").delete().eq("trip_id", trip.id);
      const rows = stops.map((s, index) => ({ trip_id: trip.id, member_id: s.member_id, stop_type: s.stop_type, sequence: index + 1, lat: s.lat, lng: s.lng, place_id: s.place_id }));
      const { error: se } = await db!.from("pool_trip_stops").insert(rows);
      if (se) throw se;
    }
  }
  await db!.from("pool_groups").update({ status: "active", seat_day_fare: quoteData.seatDayFare, route_geometry: quoteData.geometry, route_distance_km: quoteData.out.distanceKm, route_duration_min: quoteData.out.durationMin, updated_at: new Date().toISOString() }).eq("id", group.id);
  for (const m of members) { const riderUserId = Number(m.rider_user_id); if (!Number.isSafeInteger(riderUserId)) throw new Error("invalid rider user ID"); await notifyUser(riderUserId, Number(group.id), `group-active-${group.id}`, { message: "اكتمل عدد ركاب الفئة وبدأ تفعيل مسارك." }); }
}
async function groupView(group: Json) {
  const { current_rider_id: _currentRiderId, ...publicGroup } = group;
  const [members, trips, subs] = await Promise.all([
    getMembers(Number(group.id), false),
    db!.from("pool_trips").select("*").eq("group_id", group.id).order("service_date").order("direction"),
    db!.from("pool_members").select("id").eq("group_id", group.id).eq("status", "active"),
  ]);
  const memberIds = (subs.data ?? []).map((m) => m.id);
  let subscription;
  if (memberIds.length) {
    const { data } = await db!.from("pool_subscriptions").select("amount_due,refund_amount,service_days,discount_rate").in("member_id", memberIds);
    subscription = data?.find((s) => members.some((m: Json) => m.rider_user_id === Number(_currentRiderId) && memberIds.includes(m.id)));
  }
  return { group: { ...publicGroup, service_dates: JSON.stringify(group.service_dates), route_geometry: group.route_geometry }, members, trips: trips.data ?? [], ...(subscription ? { subscription } : {}) };
}


async function automaticMatch(request: Json, riderId: number) {
  const requestId = Number(request.id);
  if (request.status === "matched") {
    const { data: existing } = await db!.from("matches").select("*").eq("daily_commute_request_id", requestId).maybeSingle();
    return { request, match: existing, already_matched: true };
  }
  if (request.status !== "open") return { request, match: null, not_open: true };
  const { data: category, error: categoryError } = await db!.from("service_categories").select("vehicle_type_id").eq("id", request.service_category_id).maybeSingle();
  if (categoryError) throw categoryError;
  if (!category) return { request, match: null };
  const { data: verifiedUsers, error: usersError } = await db!.from("users").select("id,verified_at").eq("role", "captain").not("verified_at", "is", null);
  if (usersError) throw usersError;
  const ids = (verifiedUsers ?? []).map(x => x.id);
  if (!ids.length) return { request, match: null };
  const { data: profiles, error: profilesError } = await db!.from("captain_profiles").select("user_id,vehicle_type_id,current_lat,current_lng,created_at").eq("verification_status", "approved").eq("vehicle_type_id", category.vehicle_type_id).not("current_lat", "is", null).not("current_lng", "is", null).in("user_id", ids);
  if (profilesError) throw profilesError;
  const ranked = (profiles ?? []).map(p => ({ ...p, distance_km: distanceKm({ lat: Number(request.pickup_lat), lng: Number(request.pickup_lng) }, { lat: Number(p.current_lat), lng: Number(p.current_lng) }) })).sort((a,b) => a.distance_km-b.distance_km || String(a.created_at).localeCompare(String(b.created_at)) || Number(a.user_id)-Number(b.user_id));
  for (const candidate of ranked) {
    const { data: match, error: matchError } = await db!.from("matches").insert({ daily_commute_request_id: requestId, captain_user_id: candidate.user_id, distance_km: candidate.distance_km }).select().maybeSingle();
    if (!matchError && match) return { request: { ...request, status: "matched" }, match };
    const { data: existing } = await db!.from("matches").select("*").eq("daily_commute_request_id", requestId).maybeSingle();
    if (existing) return { request: { ...request, status: "matched" }, match: existing };
    if (matchError?.code !== "23505") throw matchError;
  }
  return { request, match: null };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") return reply({}, 204, origin);
  if (!db) return error("إعدادات ربط Supabase غير مكتملة.", 503, origin);
  const url = new URL(req.url);
  const suffix = url.pathname.replace(/^\/(?:functions\/v1\/)?sekka-api(?=\/|$)/, "") || "/";
  const path = suffix.startsWith("/api/") ? suffix.slice(4) : suffix === "/api" ? "/" : suffix;
  let body: Json = {};
  if (!["GET", "HEAD"].includes(req.method)) {
    try { body = await readBody(req); } catch { return error("بيانات الطلب غير صالحة.", 400, origin); }
  }
  try {
    if (req.method === "GET" && (path === "/health" || path === "/")) {
      const { error: healthError } = await db.from("pool_categories").select("id").limit(1);
      if (healthError) return error("قاعدة البيانات غير متاحة مؤقتًا.", 503, origin);
      return reply({ status: "ok", service: "sekka-supabase-api", phase: 14, time: new Date().toISOString() }, 200, origin);
    }
    if (req.method === "GET" && path === "/config") {
      const [vehicles, categories] = await Promise.all([db.from("vehicle_types").select("*").order("id"), db.from("service_categories").select("*").order("id")]);
      if (vehicles.error || categories.error) return error("حصل خطأ ونحن بنجيب الإعدادات، جرّب تاني بعد شوية.", 500, origin);
      return reply({ vehicle_types: vehicles.data, service_categories: categories.data, maps: { address_search_enabled: true, provider: "photon", routing_provider: "osrm", service_area: "greater-cairo" } }, 200, origin);
    }
    if (req.method === "GET" && path === "/pool/categories") {
      const { data, error: e } = await db.from("pool_categories").select("id,speed_tier,has_ac,seats,base_fee,rate_per_km,rate_per_min").order("id");
      if (e) throw e; return reply({ categories: data }, 200, origin);
    }
    const user = await authenticate(req);
    if (req.method === "POST" && path === "/rider/pool/quote") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      let pickup, dropoff;
      try { pickup = await selectLocation(body, "pickup"); dropoff = await selectLocation(body, "dropoff"); }
      catch (err) { if (err instanceof ApiFailure) return error(err.message, err.status, origin); throw err; }
      const { data: categories, error: categoryError } = await db.from("pool_categories").select("id,seats,base_fee,rate_per_km,rate_per_min").order("id");
      if (categoryError) throw categoryError;
      const outboundPoints = [{ lat: pickup.lat, lng: pickup.lng }, { lat: dropoff.lat, lng: dropoff.lng }];
      const returnPoints = [...outboundPoints].reverse();
      const [out, back] = await Promise.all([roadRoute(outboundPoints), roadRoute(returnPoints)]);
      const prices = (categories ?? []).map((category) => {
        const outbound = Number(category.base_fee) + out.distanceKm * Number(category.rate_per_km) + out.durationMin * Number(category.rate_per_min);
        const returning = Number(category.base_fee) + back.distanceKm * Number(category.rate_per_km) + back.durationMin * Number(category.rate_per_min);
        const seat_day_fare = roundMoney((outbound + returning) / Number(category.seats));
        return { category_id: category.id, seat_day_fare, daily: seat_day_fare, weekly: roundMoney(seat_day_fare * 5 * 0.95), monthly: roundMoney(seat_day_fare * 22 * 0.9) };
      });
      return reply({ prices }, 200, origin);
    }
    if (req.method === "GET" && path === "/rider/saved-places") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const { data, error: placesError } = await db.from("rider_saved_places").select("place_type,label,lat,lng").eq("user_id", user!.id).order("place_type");
      if (placesError) throw placesError;
      return reply({ places: data ?? [] }, 200, origin);
    }
    const savedPlaceAction = path.match(/^\\/rider\\/saved-places\\/(home|work)$/);
    if (savedPlaceAction && (req.method === "PUT" || req.method === "DELETE")) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const placeType = savedPlaceAction[1] as "home" | "work";
      if (req.method === "DELETE") {
        const { error: deleteError } = await db.from("rider_saved_places").delete().eq("user_id", user!.id).eq("place_type", placeType);
        if (deleteError) throw deleteError;
        return reply({ success: true }, 200, origin);
      }
      const label = typeof body.label === "string" ? body.label.trim().slice(0, 240) : "";
      const lat = body.lat, lng = body.lng;
      if (!label || !validPoint(lat, lng) || !isGreaterCairoPoint(Number(lat), Number(lng))) return error("اختار عنوانًا صحيحًا داخل القاهرة الكبرى.", 400, origin);
      const { data, error: saveError } = await db.from("rider_saved_places").upsert({ user_id: user!.id, place_type: placeType, label, lat: Number(lat), lng: Number(lng), updated_at: new Date().toISOString() }, { onConflict: "user_id,place_type" }).select("place_type,label,lat,lng").single();
      if (saveError) throw saveError;
      return reply({ place: data }, 200, origin);
    }
    if (req.method === "POST" && path === "/locations/search") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const query = clean(body.query) ? body.query.trim().replace(/\s+/g, " ") : "";
      if (query.length < 3 || query.length > 120) return error("اكتب من ٣ إلى ١٢٠ حرفًا للبحث عن العنوان.", 400, origin);
      if (!await takeLimit(`location-search:user:${user!.id}`, 20, 300)) return error("استخدم البحث بعد دقائق؛ عدد المحاولات كبير.", 429, origin);
      return reply({ suggestions: await searchGreaterCairo(query) }, 200, origin);
    }
    if (req.method === "POST" && path === "/locations/resolve") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      return error("اختار العنوان من نتائج البحث الظاهرة.", 410, origin);
    }
    if (req.method === "POST" && path === "/auth/register") {
      const { full_name, phone_number, password, role } = body;
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
      const phone = typeof phone_number === "string" ? phone_number.trim().slice(0, 100) : "";
      if (!await takeLimit(`register:ip:${ip}`, 10, 3600) || !await takeLimit(`register:phone:${phone}`, 5, 3600)) {
        return error("تم إنشاء حسابات كثيرة مؤخرًا من هذا الجهاز أو الرقم. حاول بعد ساعة.", 429, origin);
      }
      if (!clean(full_name) || !clean(phone_number) || !clean(password)) return error("لازم تكتب الاسم ورقم الهاتف وكلمة السر.", 400, origin);
      if (!["rider", "captain"].includes(String(role))) return error("نوع الحساب المطلوب مش متاح.", 400, origin);
      if (String(password).length < 8) return error("كلمة السر لازم تكون ٨ أحرف على الأقل.", 400, origin);
      const { data: existing } = await db.from("users").select("id").eq("phone_number", String(phone_number).trim()).maybeSingle();
      if (existing) return error("الرقم ده مسجّل قبل كده.", 409, origin);
      const { data, error: e } = await db.from("users").insert({ full_name: String(full_name).trim(), phone_number: String(phone_number).trim(), password_hash: await hashPassword(String(password)), role }).select("id,full_name,phone_number,role,verified_at,created_at").single();
      if (e) return error("تعذر إنشاء الحساب؛ تأكد أن رقم الهاتف غير مسجل.", 409, origin);
      return reply({ user: data }, 201, origin);
    }
    if (req.method === "POST" && path === "/auth/login") {
      const phone = typeof body.phone_number === "string" ? body.phone_number.trim() : "";
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
      if (!await takeLimit(`login:${ip}:${phone}`, 5, 900)) return error("محاولات كتير في وقت قصير. حاول تاني بعد شوية.", 429, origin);
      const { data: record } = await db.from("users").select("id,full_name,phone_number,password_hash,role,verified_at,created_at").eq("phone_number", phone).maybeSingle();
      const valid = record ? await verifyPassword(String(body.password ?? ""), record.password_hash) : await verifyPassword(String(body.password ?? ""), "pbkdf2$310000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000");
      if (!record || !valid) return error("رقم الهاتف أو كلمة السر غلط.", 401, origin);
      const token = hex(crypto.getRandomValues(new Uint8Array(32))), tokenHash = await digest(token);
      const { error: se } = await db.from("sessions").insert({ user_id: record.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 7 * 86400_000).toISOString() });
      if (se) throw se;
      const { password_hash: _secret, ...publicUser } = record;
      return reply({ token, user: publicUser }, 200, origin);
    }
    if (path.startsWith("/auth/")) {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      if (req.method === "GET" && path === "/auth/me") return reply({ user }, 200, origin);
      if (req.method === "POST" && path === "/auth/logout") {
        const raw = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (raw) await db.from("sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", await digest(raw));
        return reply({ success: true }, 200, origin);
      }
      if (req.method === "POST" && path === "/auth/change-password") {
        if (!clean(body.current_password) || !clean(body.new_password) || String(body.new_password).length < 8) return error("بيانات كلمة السر غير صحيحة أو أقصر من ٨ أحرف.", 400, origin);
        if (!await takeLimit(`password:${user.id}`, 5, 900)) return error("محاولات كتير في وقت قصير. حاول تاني بعد شوية.", 429, origin);
        const { data: row } = await db.from("users").select("password_hash").eq("id", user.id).single();
        if (!row || typeof row.password_hash !== "string" || !await verifyPassword(String(body.current_password), row.password_hash)) return error("كلمة السر الحالية غير صحيحة.", 401, origin);
        const { error: pe } = await db.from("users").update({ password_hash: await hashPassword(String(body.new_password)), password_changed_at: new Date().toISOString() }).eq("id", user.id);
        if (pe) throw pe;
        await db.from("sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", user.id).neq("token_hash", await digest(req.headers.get("authorization")!.replace(/^Bearer\s+/i, "")));
        return reply({ success: true, revoked_other_sessions: 1 }, 200, origin);
      }
    }

    if (path === "/rider/requests") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      if (req.method === "POST") {
        if (!clean(body.service_category_id) || !validPoint(body.pickup_lat, body.pickup_lng) || !validPoint(body.dropoff_lat, body.dropoff_lng)) return error("فئة الخدمة أو إحداثيات الرحلة غير صحيحة.", 400, origin);
        const { data: request, error: insertError } = await db.from("daily_commute_requests").insert({ rider_user_id: user!.id, service_category_id: body.service_category_id, pickup_lat: body.pickup_lat, pickup_lng: body.pickup_lng, dropoff_lat: body.dropoff_lat, dropoff_lng: body.dropoff_lng }).select().single();
        if (insertError) throw insertError;
        const result = await automaticMatch(request, user!.id);
        return reply({ request: result.request, match: result.match }, 201, origin);
      }
      if (req.method === "GET") {
        const { data: requests, error: queryError } = await db.from("daily_commute_requests").select("*").eq("rider_user_id", user!.id).order("requested_at", { ascending: false });
        if (queryError) throw queryError;
        const rows = [];
        for (const request of requests ?? []) {
          const { data: match } = await db.from("matches").select("*").eq("daily_commute_request_id", request.id).maybeSingle();
          rows.push({ ...request, match: match ?? null });
        }
        return reply({ requests: rows }, 200, origin);
      }
    }
    const dailyMatch = path.match(/^\/rider\/requests\/(\d+)\/match$/);
    if (req.method === "POST" && dailyMatch) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const { data: request, error: queryError } = await db.from("daily_commute_requests").select("*").eq("id", dailyMatch[1]).maybeSingle();
      if (queryError) throw queryError;
      if (!request) return error("الطلب ده مش موجود.", 404, origin);
      if (Number(request.rider_user_id) !== user!.id) return error("الطلب ده مش بتاعك.", 403, origin);
      const result = await automaticMatch(request, user!.id);
      if (result.not_open) return error("الطلب ده لم يعد مفتوحًا للمطابقة.", 409, origin);
      return reply({ request: result.request, match: result.match }, 200, origin);
    }
    const dailyCancel = path.match(/^\/rider\/requests\/(\d+)\/cancel$/);
    if (req.method === "POST" && dailyCancel) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const { data: request, error: queryError } = await db.from("daily_commute_requests").select("*").eq("id", dailyCancel[1]).maybeSingle();
      if (queryError) throw queryError;
      if (!request) return error("الطلب ده مش موجود.", 404, origin);
      if (Number(request.rider_user_id) !== user!.id) return error("الطلب ده مش بتاعك.", 403, origin);
      if (request.status !== "open") return error("الطلب ده مش قابل للإلغاء دلوقتي.", 409, origin);
      const { data: cancelled, error: updateError } = await db.from("daily_commute_requests").update({ status: "cancelled" }).eq("id", request.id).eq("status", "open").select().maybeSingle();
      if (updateError) throw updateError;
      if (!cancelled) return error("الطلب ده مش قابل للإلغاء دلوقتي.", 409, origin);
      return reply({ request: cancelled }, 200, origin);
    }
    if (req.method === "GET" && path === "/rider/trips") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const { data: requests, error: requestsError } = await db.from("daily_commute_requests").select("id").eq("rider_user_id", user!.id);
      if (requestsError) throw requestsError;
      const requestIds = (requests ?? []).map(r => r.id);
      if (!requestIds.length) return reply({ trips: [] }, 200, origin);
      const { data: matches, error: matchesError } = await db.from("matches").select("id,daily_commute_request_id,captain_user_id").in("daily_commute_request_id", requestIds);
      if (matchesError) throw matchesError;
      const trips = [];
      for (const match of matches ?? []) {
        const { data: trip } = await db.from("trips").select("*").eq("match_id", match.id).maybeSingle();
        if (!trip || trip.status !== "completed") continue;
        const [{ data: stops }, { data: payment }] = await Promise.all([db.from("trip_stops").select("*").eq("trip_id", trip.id).order("sequence"), db.from("payments").select("*").eq("trip_id", trip.id).maybeSingle()]);
        let paymentStatus: string | null = null;
        if (payment) { const { data: events } = await db.from("payment_status_events").select("to_status").eq("payment_id", payment.id).order("created_at", { ascending: false }).limit(1); paymentStatus = events?.[0]?.to_status ?? "confirmed"; }
        trips.push({ trip, stops: stops ?? [], payment: payment ?? null, payment_status: paymentStatus });
      }
      return reply({ trips }, 200, origin);
    }
    const dispute = path.match(/^\/rider\/trips\/(\d+)\/dispute$/);
    if (req.method === "POST" && dispute) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const tripId = Number(dispute[1]);
      const { data: trip } = await db.from("trips").select("id,match_id").eq("id", tripId).maybeSingle();
      if (!trip) return error("الرحلة دي مش موجودة.", 404, origin);
      const { data: match } = await db.from("matches").select("daily_commute_request_id").eq("id", trip.match_id).maybeSingle();
      const { data: request } = match ? await db.from("daily_commute_requests").select("rider_user_id").eq("id", match.daily_commute_request_id).maybeSingle() : { data: null };
      if (!request || Number(request.rider_user_id) !== user!.id) return error("الرحلة دي مش بتاعتك.", 403, origin);
      const { data: payment } = await db.from("payments").select("id").eq("trip_id", tripId).maybeSingle();
      if (!payment) return error("لسه مفيش مبلغ متسجّل لهذه الرحلة.", 409, origin);
      const { data: events } = await db.from("payment_status_events").select("to_status").eq("payment_id", payment.id).order("created_at", { ascending: false }).limit(1);
      if ((events?.[0]?.to_status ?? "confirmed") !== "confirmed") return error("الاعتراض متاح بس على مبلغ مؤكد لسه ماعترضش عليه.", 409, origin);
      if (!clean(body.reason)) return error("لازم تكتب سبب الاعتراض.", 400, origin);
      const { data: event, error: eventError } = await db.from("payment_status_events").insert({ payment_id: payment.id, from_status: "confirmed", to_status: "disputed", actor_user_id: user!.id, reason: body.reason.trim().slice(0, 1000) }).select().single();
      if (eventError) throw eventError;
      return reply({ event }, 201, origin);
    }

    if (req.method === "GET" && path === "/rider/pool/groups") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const { data: memberships, error: me } = await db.from("pool_members").select("group_id").eq("rider_user_id", user!.id).in("status", ["active", "awaiting_confirmation"]);
      if (me) throw me;
      const ids = [...new Set((memberships ?? []).map((m) => m.group_id))];
      if (!ids.length) return reply({ groups: [] }, 200, origin);
      const { data: groups, error: ge } = await db.from("pool_groups").select("*").in("id", ids).order("created_at", { ascending: false });
      if (ge) throw ge;
      const views = [];
      for (const g of groups ?? []) views.push(await groupView({ ...g, current_rider_id: user!.id }));
      return reply({ groups: views }, 200, origin);
    }
    if (req.method === "POST" && path === "/rider/pool/groups") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const { category_id, package_type, service_dates, morning_departure, return_departure } = body;
      const dates = validDates(service_dates, String(package_type));
      if (!clean(category_id) || !dates || !/^\d{2}:\d{2}$/.test(String(morning_departure)) || !/^\d{2}:\d{2}$/.test(String(return_departure)) || String(return_departure) <= String(morning_departure)) return error("راجع الفئة والأيام ومواعيد الذهاب والعودة.", 400, origin);
      let pickup, dropoff;
      try { pickup = await selectLocation(body, "pickup"); dropoff = await selectLocation(body, "dropoff"); }
      catch (err) { if (err instanceof ApiFailure) return error(err.message, err.status, origin); throw err; }
      const { data: category } = await db.from("pool_categories").select("*").eq("id", category_id).maybeSingle();
      if (!category) return error("فئة الرحلة غير موجودة.", 404, origin);
      const initialMember = { id: 0, pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_place_id: pickup.place_id, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, dropoff_place_id: dropoff.place_id, pickup_order: 0 };
      let q; try { q = await quote([initialMember], category); }
      catch (err) { if (err instanceof ApiFailure) return error(err.message, err.status, origin); return error("خدمة حساب المسار غير متاحة حاليًا.", 503, origin); }
      const { data: group, error: ge } = await db.from("pool_groups").insert({ created_by_user_id: user!.id, category_id, package_type, service_dates: dates, morning_departure: morning_departure + ":00", return_departure: return_departure + ":00", route_distance_km: q.out.distanceKm, route_duration_min: q.out.durationMin, seat_day_fare: q.seatDayFare, route_geometry: q.geometry, status: "waiting" }).select().single();
      if (ge) throw ge;
      const { error: memberError } = await db.from("pool_members").insert({ group_id: group.id, rider_user_id: user!.id, pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_place_id: pickup.place_id, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, dropoff_place_id: dropoff.place_id, seats_reserved: 1, status: "active", price_decision: "accepted", pickup_order: 0 });
      if (memberError) throw memberError;
      return reply({ ...(await groupView(group)), auto_matched: false }, 201, origin);
    }
    const joinMatch = path.match(/^\/rider\/pool\/groups\/(\d+)\/join$/);
    if (req.method === "POST" && joinMatch) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const group = await getGroup(Number(joinMatch[1]));
      if (!group || group.status !== "waiting") return error("المجموعة غير متاحة للانضمام.", 409, origin);
      const members = await getMembers(Number(group.id));
      if (members.some((m) => Number(m.rider_user_id) === user!.id)) return error("أنت منضم للمجموعة بالفعل.", 409, origin);
      const { data: category } = await db.from("pool_categories").select("*").eq("id", group.category_id).single();
      const capacityUsed = members.reduce((sum, m) => sum + Number(m.seats_reserved), 0);
      if (capacityUsed >= Number(category.seats)) return error("المقاعد المتاحة اكتملت.", 409, origin);
      let pickup: { lat: number | null; lng: number | null; place_id: string | null; label: string };
      let dropoff: { lat: number | null; lng: number | null; place_id: string | null; label: string };
      try {
        pickup = await selectLocation(body, "pickup");
        dropoff = await selectLocation(body, "dropoff");
      } catch (err) {
        if (err instanceof ApiFailure) return error(err.message, err.status, origin);
        throw err;
      }
      if (!validPoint(pickup.lat, pickup.lng) || !validPoint(dropoff.lat, dropoff.lng)) return error("تعذر تحديد العنوان. اختر نتيجة بحث صحيحة.", 400, origin);
      let groupGeometry = group.route_geometry as Json | null;
      let line = groupGeometry?.outbound as Json | undefined;
      if (!Array.isArray(line?.coordinates) || line.coordinates.length < 2) {
        try { groupGeometry = (await quote(members, category)).geometry as Json; line = groupGeometry.outbound as Json; }
        catch (err) { if (err instanceof ApiFailure) return error(err.message, err.status, origin); return error("تعذر تحديث خط المجموعة.", 503, origin); }
      }
      if (lineDistanceKm({ lat: Number(pickup.lat), lng: Number(pickup.lng) }, line?.coordinates) > 3 || lineDistanceKm({ lat: Number(dropoff.lat), lng: Number(dropoff.lng) }, line?.coordinates) > 3) return error("نقطتا الركوب والنزول لازم تكونا في حدود ٣ كم من خط المجموعة.", 400, origin);
      const candidate = { id: 0, group_id: group.id, rider_user_id: user!.id, pickup_lat: Number(pickup.lat), pickup_lng: Number(pickup.lng), pickup_place_id: pickup.place_id, dropoff_lat: Number(dropoff.lat), dropoff_lng: Number(dropoff.lng), dropoff_place_id: dropoff.place_id, seats_reserved: 1, status: "active", price_decision: "accepted", pickup_order: members.length };
      let q; try { q = await quote([...members, candidate], category); } catch (err) { if (err instanceof ApiFailure) return error(err.message, err.status, origin); return error("خدمة حساب المسار غير متاحة حاليًا.", 503, origin); }
      const { data: member, error: ie } = await db.from("pool_members").insert({ ...candidate, group_id: group.id }).select().single();
      if (ie) throw ie;
      const all = [...members, member];
      const oldFare = Number(group.seat_day_fare ?? 0), changed = oldFare > 0 && (q.seatDayFare - oldFare) / oldFare > 0.15;
      await db.from("pool_groups").update({ route_distance_km: q.out.distanceKm, route_duration_min: q.out.durationMin, route_geometry: q.geometry, seat_day_fare: q.seatDayFare, status: changed ? "price_review" : "waiting", updated_at: new Date().toISOString() }).eq("id", group.id);
      if (changed) {
        await db.from("pool_members").update({ price_decision: "pending" }).eq("group_id", group.id).eq("status", "active");
        for (const m of all) await notifyUser(m.rider_user_id, Number(group.id), `price-review-${group.id}-${Date.now()}`, { message: "تغير السعر بأكثر من ١٥٪. راجع السعر الجديد ووافق أو ارفض." });
      } else await activateGroup(group, all, category, q);
      const refreshed = await getGroup(Number(group.id));
      return reply({ group: refreshed, member, price_review: changed }, 200, origin);
    }

    const confirmInvite = path.match(/^\/rider\/pool\/groups\/(\d+)\/confirm$/);
    if (req.method === "POST" && confirmInvite) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      if (!["accept", "decline"].includes(String(body.action))) return error("الاختيار غير صحيح.", 400, origin);
      const group = await getGroup(Number(confirmInvite[1]));
      const { data: member, error: memberError } = await db.from("pool_members").select("*").eq("group_id", confirmInvite[1]).eq("rider_user_id", user!.id).eq("status", "awaiting_confirmation").maybeSingle();
      if (memberError) throw memberError;
      if (!group || !member || group.status !== "waiting") return error("الدعوة غير متاحة أو انتهت.", 409, origin);
      const accepted = body.action === "accept";
      const { error: updateError } = await db.from("pool_members").update({ status: accepted ? "active" : "cancelled", price_decision: accepted ? "accepted" : "pending", cancelled_at: accepted ? null : new Date().toISOString() }).eq("id", member.id).eq("status", "awaiting_confirmation");
      if (updateError) throw updateError;
      const active = await getMembers(Number(group.id));
      if (!active.length) {
        await db.from("pool_groups").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", group.id);
        return reply({ success: true, group: await groupView({ ...group, current_rider_id: user!.id }) }, 200, origin);
      }
      const { data: category, error: categoryError } = await db.from("pool_categories").select("*").eq("id", group.category_id).single();
      if (categoryError) throw categoryError;
      const q = await quote(active, category);
      const baseline = Number(group.seat_day_fare ?? 0);
      const changed = accepted && baseline > 0 && (q.seatDayFare - baseline) / baseline > 0.15;
      await db.from("pool_groups").update({ route_distance_km: q.out.distanceKm, route_duration_min: q.out.durationMin, route_geometry: q.geometry, seat_day_fare: q.seatDayFare, status: changed ? "price_review" : "waiting", updated_at: new Date().toISOString() }).eq("id", group.id);
      if (changed) {
        await db.from("pool_members").update({ price_decision: "pending" }).eq("group_id", group.id).eq("status", "active");
        for (const m of active) await notifyUser(Number(m.rider_user_id), Number(group.id), `price-review-invite-${group.id}-${Date.now()}-${m.id}`, { message: "تغير السعر بأكثر من ١٥٪ بعد تأكيد الدعوات. راجع السعر ووافق أو ارفض." });
      } else await activateGroup(group, active, category, q);
      const refreshed = await getGroup(Number(group.id));
      return reply({ success: true, group: await groupView({ ...refreshed, current_rider_id: user!.id }) }, 200, origin);
    }

    const priceAction = path.match(/^\/rider\/pool\/groups\/(\d+)\/price-decision$/);
    if (req.method === "POST" && priceAction) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      if (!["accept", "decline"].includes(String(body.action))) return error("الاختيار غير صحيح.", 400, origin);
      const group = await getGroup(Number(priceAction[1]));
      const { data: member } = await db.from("pool_members").select("*").eq("group_id", priceAction[1]).eq("rider_user_id", user!.id).eq("status", "active").maybeSingle();
      if (!group || group.status !== "price_review" || !member) return error("لا يوجد طلب موافقة سعر لهذا المسار.", 409, origin);
      if (body.action === "decline") {
        await db.from("pool_members").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", member.id);
        const remaining = await getMembers(Number(group.id));
        const { data: category } = await db.from("pool_categories").select("*").eq("id", group.category_id).single();
        const seats = remaining.reduce((s, m) => s + Number(m.seats_reserved), 0);
        if (seats < Number(category.seats)) {
          await db.from("pool_groups").update({ status: "cancelled" }).eq("id", group.id);
        } else if (remaining.every((m) => m.price_decision === "accepted")) {
          const q = await quote(remaining, category);
          await db.from("pool_groups").update({ status: "waiting" }).eq("id", group.id);
          await activateGroup(group, remaining, category, q);
        }
      } else {
        await db.from("pool_members").update({ price_decision: "accepted" }).eq("id", member.id);
        const remaining = await getMembers(Number(group.id));
        const { data: category } = await db.from("pool_categories").select("*").eq("id", group.category_id).single();
        if (remaining.every((m) => m.price_decision === "accepted")) {
          await db.from("pool_groups").update({ status: "waiting" }).eq("id", group.id);
          const q = await quote(remaining, category);
          await activateGroup(group, remaining, category, q);
        }
      }
      return reply({ success: true }, 200, origin);
    }

    const completeSeats = path.match(/^\/rider\/pool\/groups\/(\d+)\/complete-seats$/);
    if (req.method === "POST" && completeSeats) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const group = await getGroup(Number(completeSeats[1]));
      if (!group || group.status !== "waiting") return error("المجموعة لم تعد تنتظر مقاعد.", 409, origin);
      const members = await getMembers(Number(group.id));
      const member = members.find(m => Number(m.rider_user_id) === user!.id);
      if (!member) return error("أنت لست عضوًا في المجموعة.", 404, origin);
      const { data: category, error: categoryError } = await db.from("pool_categories").select("*").eq("id", group.category_id).single();
      if (categoryError || !category) throw categoryError ?? new Error("missing category");
      const used = members.reduce((sum, m) => sum + Number(m.seats_reserved), 0);
      const remaining = Number(category.seats) - used;
      if (remaining <= 0) return error("لا توجد مقاعد متبقية.", 409, origin);
      const proposedMember = { ...member, seats_reserved: Number(member.seats_reserved) + remaining, price_decision: "accepted" };
      const proposed = members.map(m => Number(m.id) === Number(member.id) ? proposedMember : m);
      const q = await quote(proposed, category);
      const { data: updatedMember, error: memberError } = await db.from("pool_members").update({ seats_reserved: proposedMember.seats_reserved, price_decision: "accepted" }).eq("id", member.id).eq("status", "active").select().single();
      if (memberError) throw memberError;
      const updated = members.map(m => Number(m.id) === Number(member.id) ? updatedMember : m);
      await db.from("pool_groups").update({ route_distance_km: q.out.distanceKm, route_duration_min: q.out.durationMin, route_geometry: q.geometry, seat_day_fare: q.seatDayFare, updated_at: new Date().toISOString() }).eq("id", group.id);
      const refreshed = await getGroup(Number(group.id));
      await activateGroup(refreshed, updated, category, q);
      return reply({ group: await groupView({ ...refreshed, current_rider_id: user!.id }), reserved_seats: remaining, payment: "deferred" }, 200, origin);
    }

    const waitingDecision = path.match(/^\/rider\/pool\/groups\/(\d+)\/waiting-decision$/);
    if (req.method === "POST" && waitingDecision) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      if (!["wait", "book_remaining_seats", "cancel_free"].includes(String(body.action))) return error("الاختيار غير صحيح.", 400, origin);
      const group = await getGroup(Number(waitingDecision[1]));
      const { data: member, error: memberError } = await db.from("pool_members").select("*").eq("group_id", waitingDecision[1]).eq("rider_user_id", user!.id).eq("status", "active").maybeSingle();
      if (memberError) throw memberError;
      if (!group || !member || group.status !== "waiting") return error("المجموعة لم تعد في حالة انتظار.", 409, origin);
      if (body.action === "wait") {
        await db.from("pool_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).eq("group_id", group.id).eq("event_key", `pool-wait-72h:${group.id}`);
        return reply({ success: true, status: "waiting" }, 200, origin);
      }
      if (body.action === "cancel_free") {
        const { error: cancelError } = await db.from("pool_members").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", member.id).eq("status", "active");
        if (cancelError) throw cancelError;
        const remaining = await getMembers(Number(group.id));
        if (!remaining.length) await db.from("pool_groups").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", group.id);
        else {
          const { data: category } = await db.from("pool_categories").select("*").eq("id", group.category_id).single();
          const quoteData = await quote(remaining, category);
          await db.from("pool_groups").update({ seat_day_fare: quoteData.seatDayFare, route_distance_km: quoteData.out.distanceKm, route_duration_min: quoteData.out.durationMin, route_geometry: quoteData.geometry, updated_at: new Date().toISOString() }).eq("id", group.id);
        }
        return reply({ success: true, cancelled_free: true }, 200, origin);
      }
      const { data: category, error: categoryError } = await db.from("pool_categories").select("*").eq("id", group.category_id).single();
      if (categoryError) throw categoryError;
      const members = await getMembers(Number(group.id));
      const used = members.reduce((sum, m) => sum + Number(m.seats_reserved), 0), remainingSeats = Number(category.seats) - used;
      if (remainingSeats <= 0) return error("لا توجد مقاعد متبقية لحجزها.", 409, origin);
      const proposedMember = { ...member, seats_reserved: Number(member.seats_reserved) + remainingSeats, price_decision: "accepted" };
      const proposed = members.map(m => Number(m.id) === Number(member.id) ? proposedMember : m);
      const q = await quote(proposed, category);
      const { data: updatedMember, error: seatError } = await db.from("pool_members").update({ seats_reserved: proposedMember.seats_reserved, price_decision: "accepted" }).eq("id", member.id).eq("status", "active").select().single();
      if (seatError) throw seatError;
      const finalMembers = members.map(m => Number(m.id) === Number(member.id) ? updatedMember : m);
      const { error: groupError } = await db.from("pool_groups").update({ seat_day_fare: q.seatDayFare, route_distance_km: q.out.distanceKm, route_duration_min: q.out.durationMin, route_geometry: q.geometry }).eq("id", group.id);
      if (groupError) throw groupError;
      await activateGroup(group, finalMembers, category, q);
      return reply({ success: true, reserved_seats: remainingSeats, payment: "deferred" }, 200, origin);
    }

    const cancelDay = path.match(/^\/rider\/pool\/groups\/(\d+)\/days\/(\d{4}-\d{2}-\d{2})\/cancel$/);
    const cancelPackage = path.match(/^\/rider\/pool\/groups\/(\d+)\/cancel$/);
    if (req.method === "POST" && (cancelDay || cancelPackage)) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const groupId = Number((cancelDay ?? cancelPackage)![1]);
      const group = await getGroup(groupId);
      const { data: member, error: memberError } = await db.from("pool_members").select("*").eq("group_id", groupId).eq("rider_user_id", user!.id).eq("status", "active").maybeSingle();
      if (memberError) throw memberError;
      if (!group || !member) return error("الحجز النشط غير موجود.", 404, origin);
      const { data: subscription } = await db.from("pool_subscriptions").select("*").eq("member_id", member.id).maybeSingle();
      const dates = Array.isArray(group.service_dates) ? group.service_dates as string[] : JSON.parse(String(group.service_dates));
      const dateToCancel = cancelDay?.[2];
      if (dateToCancel && !dates.includes(dateToCancel)) return error("التاريخ غير موجود ضمن أيام الحجز.", 404, origin);
      const targetDates = dateToCancel ? [dateToCancel] : dates;
      let refundTotal = 0, chargeTotal = 0, processed = 0;
      const discount = discountRate(String(group.package_type));
      for (const date of targetDates) {
        const { data: legs, error: legsError } = await db.from("pool_trips").select("*").eq("group_id", groupId).eq("service_date", date);
        if (legsError) throw legsError;
        if (!legs?.length) continue;
        const departure = cairoIso(date, String(group.morning_departure).slice(0, 5));
        if (legs.some(t => ["completed", "in_progress"].includes(t.status))) return error("لا يمكن إلغاء يوم بدأت رحلته بالفعل.", 409, origin);
        const free = Date.parse(departure) - Date.now() >= 12 * 3600_000;
        const dayValue = roundMoney(Number(subscription?.seat_day_fare ?? group.seat_day_fare ?? 0) * Number(member.seats_reserved) * (1 - discount));
        const prior = await db.from("pool_trip_cancellations").select("trip_id").in("trip_id", legs.map(t => t.id)).eq("member_id", member.id);
        if (prior.error) throw prior.error;
        if (prior.data?.length) continue;
        for (const trip of legs) {
          const split = roundMoney(dayValue / legs.length);
          const { error: ce } = await db.from("pool_trip_cancellations").insert({ trip_id: trip.id, member_id: member.id, charge_amount: free ? 0 : split, refund_amount: free ? split : 0 });
          if (ce) throw ce;
        }
        if (free) refundTotal += dayValue; else chargeTotal += dayValue;
        processed++;
      }
      if (cancelPackage || (cancelDay && group.package_type === "daily")) {
        if (cancelPackage && group.package_type !== "daily") {
          const adminFee = roundMoney(refundTotal * 0.10);
          refundTotal = roundMoney(refundTotal - adminFee);
        }
        await db.from("pool_members").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", member.id).eq("status", "active");
      }
      if (subscription && processed > 0) {
        const { error: se } = await db.from("pool_subscriptions").update({
          amount_due: Math.max(0, Number(subscription.amount_due) - (cancelPackage && group.package_type !== "daily" ? roundMoney(refundTotal / 0.9) : refundTotal)),
          refund_amount: roundMoney(Number(subscription.refund_amount) + refundTotal),
          cancelled_at: cancelPackage ? new Date().toISOString() : null,
        }).eq("id", subscription.id);
        if (se) throw se;
      }
      if (!cancelDay) {
        const { data: active } = await db.from("pool_members").select("id").eq("group_id", groupId).eq("status", "active");
        if (!active?.length) await db.from("pool_groups").update({ status: "cancelled" }).eq("id", groupId);
      }
      return reply({ success: true, days_processed: processed, charged_amount: roundMoney(chargeTotal), refund_amount: roundMoney(refundTotal), admin_fee: cancelPackage && group.package_type !== "daily" ? roundMoney(refundTotal / 9) : 0, payment: "deferred" }, 200, origin);
    }

    if (req.method === "GET" && path === "/pool/push/vapid-public-key") {
      const publicKey = Deno.env.get("SEKKA_VAPID_PUBLIC_KEY") ?? "";
      if (!publicKey) return error("إشعارات الجهاز غير مهيأة على الخادم.", 503, origin);
      return reply({ public_key: publicKey }, 200, origin);
    }
    if (req.method === "PUT" && path === "/pool/push/subscriptions") {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
      const keys = body.keys && typeof body.keys === "object" ? body.keys as Json : {};
      const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
      const authKey = typeof keys.auth === "string" ? keys.auth : "";
      let secureEndpoint = false;
      try { secureEndpoint = new URL(endpoint).protocol === "https:"; } catch { /* invalid endpoint */ }
      if (endpoint.length < 12 || endpoint.length > 4096 || !secureEndpoint || !/^[A-Za-z0-9_-]{16,256}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,128}$/.test(authKey)) return error("بيانات اشتراك الإشعارات غير صالحة.", 400, origin);
      const { data, error: pushError } = await db.from("push_subscriptions").upsert({ user_id: user.id, endpoint, p256dh, auth: authKey, updated_at: new Date().toISOString() }, { onConflict: "endpoint" }).select("id,endpoint").single();
      if (pushError) throw pushError;
      return reply({ subscription: data }, 200, origin);
    }
    if (req.method === "DELETE" && path === "/pool/push/subscriptions") {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      if (!clean(body.endpoint)) return error("عنوان الاشتراك مطلوب.", 400, origin);
      const { error: deleteError } = await db.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", body.endpoint);
      if (deleteError) throw deleteError;
      return reply({ success: true }, 200, origin);
    }

    if (req.method === "GET" && path === "/pool/notifications") {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      const { data, error: e } = await db.from("pool_notifications").select("*").eq("user_id", user.id).order("id", { ascending: false }).limit(100);
      if (e) throw e; return reply({ notifications: data }, 200, origin);
    }
    const readNotice = path.match(/^\/pool\/notifications\/(\d+)\/read$/);
    if (req.method === "POST" && readNotice && user) {
      await db.from("pool_notifications").update({ read_at: new Date().toISOString() }).eq("id", readNotice[1]).eq("user_id", user.id);
      return reply({ success: true }, 200, origin);
    }
    if (req.method === "GET" && path === "/captain/verify/status") {
      const gate = await requireRole(user, ["captain"], origin); if (gate) return gate;
      return reply({ enabled: await captainOtpEnabled(), provider_ready: otpProviderReady() }, 200, origin);
    }
    if (req.method === "POST" && path === "/captain/verify/request") {
      const gate = await requireRole(user, ["captain"], origin); if (gate) return gate;
      if (!await captainOtpEnabled()) return error("توثيق الهاتف متوقف مؤقتًا من الإدارة.", 409, origin);
      if (!otpProviderReady()) return error("خدمة SMS غير مهيأة بعد. تواصل مع الإدارة لإعداد المزوّد.", 503, origin);
      if (user!.verified_at) return reply({ success: true, already_verified: true }, 200, origin);
      const phone = phoneE164(user!.phone_number);
      if (!phone) return error("رقم الهاتف غير صالح لرسائل SMS. حدّثه بصيغة مصرية صحيحة.", 400, origin);
      if (!await takeLimit(`otp-send-minute:${user!.id}`, 1, 60) || !await takeLimit(`otp-send-hour:${user!.id}`, 5, 3600)) {
        return error("تم إرسال أكواد كثيرة مؤخرًا. حاول بعد قليل.", 429, origin);
      }
      try {
        const params = new URLSearchParams({ To: phone, Channel: "sms" });
        const { response } = await callTwilioVerify("Verifications", params);
        if (!response.ok) {
          console.error("[sekka-api] SMS provider rejected OTP request:", response.status);
          return error(response.status === 429 ? "تم إرسال أكواد كثيرة مؤخرًا. حاول بعد قليل." : "تعذر إرسال رسالة التحقق الآن.", response.status === 429 ? 429 : 502, origin);
        }
        return reply({ success: true, expires_in_seconds: 600 }, 200, origin);
      } catch {
        return error("تعذر الاتصال بخدمة SMS الآن. حاول لاحقًا.", 502, origin);
      }
    }
    if (req.method === "POST" && path === "/captain/verify/confirm") {
      const gate = await requireRole(user, ["captain"], origin); if (gate) return gate;
      if (!await captainOtpEnabled()) return error("توثيق الهاتف متوقف مؤقتًا من الإدارة.", 409, origin);
      if (!otpProviderReady()) return error("خدمة SMS غير مهيأة بعد. تواصل مع الإدارة لإعداد المزوّد.", 503, origin);
      if (user!.verified_at) return reply({ success: true, already_verified: true }, 200, origin);
      const code = typeof body.otp === "string" ? body.otp.trim() : "";
      if (!/^\d{4,10}$/.test(code)) return error("الكود غير صحيح أو انتهت صلاحيته. حاول مرة أخرى.", 400, origin);
      if (!await takeLimit(`otp-check:${user!.id}`, 5, 600)) return error("محاولات تحقق كثيرة. حاول بعد 10 دقائق.", 429, origin);
      const phone = phoneE164(user!.phone_number);
      if (!phone) return error("رقم الهاتف غير صالح لرسائل SMS. حدّثه بصيغة مصرية صحيحة.", 400, origin);
      try {
        const params = new URLSearchParams({ To: phone, Code: code });
        const { response, result } = await callTwilioVerify("VerificationCheck", params);
        if (!response.ok || result.status !== "approved") return error("الكود غير صحيح أو انتهت صلاحيته. حاول مرة أخرى.", 401, origin);
        const { data: updated, error: updateError } = await db!.from("users").update({ verified_at: new Date().toISOString() }).eq("id", user!.id).is("verified_at", null).select("id").maybeSingle();
        if (updateError) throw updateError;
        if (!updated) {
          const { data: latest, error: readError } = await db!.from("users").select("verified_at").eq("id", user!.id).maybeSingle();
          if (readError) throw readError;
          if (!latest?.verified_at) return error("تعذر حفظ حالة التوثيق. حاول مرة أخرى.", 500, origin);
        }
        return reply({ success: true }, 200, origin);
      } catch {
        return error("تعذر التحقق من الكود الآن. حاول مرة أخرى.", 502, origin);
      }
    }

    if (path.startsWith("/captain/")) {
      const gate = await requireRole(user, ["captain"], origin); if (gate) return gate;
      if (req.method === "GET" && path === "/captain/profile") {
        const { data } = await db.from("captain_profiles").select("*").eq("user_id", user!.id).maybeSingle();
        return data ? reply({ profile: data }, 200, origin) : error("ملف الكابتن غير موجود.", 404, origin);
      }
      if (req.method === "POST" && path === "/captain/profile") {
        const { vehicle_type_id, license_number, vehicle_plate } = body;
        if (!clean(vehicle_type_id) || !clean(license_number) || !clean(vehicle_plate)) return error("بيانات المركبة والرخصة مطلوبة.", 400, origin);
        const { data: profile, error: pe } = await db.from("captain_profiles").upsert({ user_id: user!.id, vehicle_type_id, license_number, vehicle_plate }, { onConflict: "user_id", ignoreDuplicates: true }).select().maybeSingle();
        if (pe) throw pe;
        if (profile) return reply({ profile }, 200, origin);
        const { data: existing } = await db.from("captain_profiles").select("*").eq("user_id", user!.id).single();
        return reply({ profile: existing }, 200, origin);
      }
      if (req.method === "POST" && path === "/captain/location") {
        if (!validPoint(body.current_lat, body.current_lng)) return error("إحداثيات الموقع غير صحيحة.", 400, origin);
        const { data, error: e } = await db.from("captain_profiles").update({ current_lat: body.current_lat, current_lng: body.current_lng }).eq("user_id", user!.id).select().single();
        if (e) throw e; return reply({ profile: data }, 200, origin);
      }

      if (req.method === "POST" && path === "/captain/pool/groups") {
        const profileResult = await db.from("captain_profiles").select("verification_status").eq("user_id", user!.id).maybeSingle();
        if (profileResult.error) throw profileResult.error;
        if (!profileResult.data || profileResult.data.verification_status !== "approved" || !user!.verified_at) return error("يلزم توثيق الكابتن والمركبة قبل إنشاء دعوة.", 403, origin);
        const { category_id, package_type, service_dates, morning_departure, return_departure, riders } = body;
        const dates = validDates(service_dates, String(package_type));
        if (!clean(category_id) || !dates || !/^\d{2}:\d{2}$/.test(String(morning_departure)) || !/^\d{2}:\d{2}$/.test(String(return_departure)) || String(return_departure) <= String(morning_departure) || !Array.isArray(riders) || riders.length < 1) return error("راجع الفئة والأيام والمواعيد وقائمة الركاب.", 400, origin);
        const { data: category, error: categoryError } = await db.from("pool_categories").select("*").eq("id", category_id).maybeSingle();
        if (categoryError) throw categoryError;
        if (!category) return error("فئة الرحلة غير موجودة.", 404, origin);
        if (riders.length > Number(category.seats)) return error("عدد الركاب يتجاوز سعة الفئة.", 400, origin);
        const ids = riders.map((r: Json) => Number(r.rider_user_id));
        if (ids.some((id: number) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) return error("قائمة الركاب غير صالحة أو بها تكرار.", 400, origin);
        const { data: riderUsers, error: usersError } = await db.from("users").select("id").eq("role", "rider").in("id", ids);
        if (usersError) throw usersError;
        if ((riderUsers ?? []).length !== ids.length) return error("تأكد أن كل المدعوين لديهم حساب راكب.", 400, origin);
        const candidates = riders.map((r: Json, i: number) => ({ id: -(i + 1), rider_user_id: ids[i], pickup_lat: r.pickup_lat, pickup_lng: r.pickup_lng, dropoff_lat: r.dropoff_lat, dropoff_lng: r.dropoff_lng, seats_reserved: 1, status: "awaiting_confirmation", price_decision: "pending", pickup_order: i }));
        if (candidates.some(m => !validPoint(m.pickup_lat, m.pickup_lng) || !validPoint(m.dropoff_lat, m.dropoff_lng))) return error("إحداثيات أحد الركاب غير صحيحة.", 400, origin);
        let q; try { q = await quote(candidates, category); } catch { return error("خدمة حساب المسار غير متاحة حاليًا.", 503, origin); }
        const { data: group, error: groupError } = await db.from("pool_groups").insert({ created_by_user_id: user!.id, category_id, package_type, service_dates: dates, morning_departure: String(morning_departure) + ":00", return_departure: String(return_departure) + ":00", route_distance_km: q.out.distanceKm, route_duration_min: q.out.durationMin, seat_day_fare: q.seatDayFare, route_geometry: q.geometry, status: "waiting" }).select().single();
        if (groupError) throw groupError;
        const memberRows = candidates.map(m => ({ group_id: group.id, rider_user_id: m.rider_user_id, pickup_lat: m.pickup_lat, pickup_lng: m.pickup_lng, dropoff_lat: m.dropoff_lat, dropoff_lng: m.dropoff_lng, seats_reserved: 1, status: "awaiting_confirmation", price_decision: "pending", pickup_order: m.pickup_order }));
        const { error: inviteError } = await db.from("pool_members").insert(memberRows);
        if (inviteError) { await db.from("pool_groups").update({ status: "cancelled" }).eq("id", group.id); throw inviteError; }
        for (const member of memberRows) await notifyUser(member.rider_user_id, Number(group.id), `pool-invite-${group.id}-${member.rider_user_id}`, { message: "الكابتن دعاك للانضمام إلى مجموعة مشوار.", group_id: group.id });
        return reply({ ...(await groupView(group)), invitations_sent: memberRows.length }, 201, origin);
      }

      if (req.method === "PUT" && path === "/captain/pool/capabilities") {
        if (typeof body.has_ac !== "boolean" || !Array.isArray(body.service_tiers) || !body.service_tiers.length || body.service_tiers.some((v) => !["faster", "saver"].includes(String(v)))) return error("تفضيلات المركبة غير صحيحة.", 400, origin);
        const { error: e } = await db.from("pool_captain_capabilities").upsert({ captain_user_id: user!.id, has_ac: Number(body.has_ac), accepts_faster: Number(body.service_tiers.includes("faster")), accepts_saver: Number(body.service_tiers.includes("saver")) }, { onConflict: "captain_user_id" });
        if (e) throw e; return reply({ success: true }, 200, origin);
      }
      if (req.method === "PATCH" && path === "/captain/pool/search-radius") {
        if (!number(body.radius_km) || body.radius_km < 4 || body.radius_km > 10) return error("نطاق البحث لازم يكون من ٤ إلى ١٠ كم.", 400, origin);
        const { error: e } = await db.from("pool_captain_stats").upsert({ captain_user_id: user!.id, search_radius_km: body.radius_km }, { onConflict: "captain_user_id" });
        if (e) throw e; return reply({ success: true }, 200, origin);
      }
      if (req.method === "GET" && path === "/captain/pool/offers") {
        const { data: profile } = await db.from("captain_profiles").select("*").eq("user_id", user!.id).maybeSingle();
        if (!profile || profile.verification_status !== "approved" || !user!.verified_at) return error("يلزم توثيق ملف المركبة والهاتف قبل عرض المسارات.", 403, origin);
        const { data: capability } = await db.from("pool_captain_capabilities").select("*").eq("captain_user_id", user!.id).maybeSingle();
        const { data: stats } = await db.from("pool_captain_stats").select("*").eq("captain_user_id", user!.id).maybeSingle();
        if (!capability || profile.current_lat == null || profile.current_lng == null) return reply({ offers: [] }, 200, origin);
        const { data: trips } = await db.from("pool_trips").select("*").in("status", ["scheduled", "needs_captain"]).is("captain_user_id", null).gte("departure_at", new Date().toISOString()).order("departure_at").limit(100);
        const offers = [];
        for (const trip of trips ?? []) {
          const { data: group } = await db.from("pool_groups").select("*").eq("id", trip.group_id).maybeSingle();
          const { data: category } = group ? await db.from("pool_categories").select("*").eq("id", group.category_id).maybeSingle() : { data: null };
          const { data: members } = group ? await db.from("pool_members").select("*").eq("group_id", group.id).eq("status", "active").order("pickup_order") : { data: [] };
          const first = members?.[0];
          if (!group || !category || !first || group.status !== "active") continue;
          if ((category.speed_tier === "faster" && !capability.accepts_faster) || (category.speed_tier === "saver" && !capability.accepts_saver) || Number(category.has_ac) !== Number(capability.has_ac)) continue;
          const effective = Math.max(4, Number(stats?.search_radius_km ?? 4) - Number(stats?.absences ?? 0));
          if (distanceKm({ lat: profile.current_lat, lng: profile.current_lng }, { lat: first.pickup_lat, lng: first.pickup_lng }) > effective) continue;
          const stops = routePoints(members, trip.direction).map((stop, index) => ({
            id: index + 1,
            member_id: Number(stop.member_id),
            stop_type: stop.stop_type,
            sequence: index + 1,
            lat: stop.lat,
            lng: stop.lng,
            place_id: null,
            reached_at: null,
          }));
          offers.push({ group_id: group.id, category_id: group.category_id, package_type: group.package_type, route_distance_km: group.route_distance_km, seat_day_fare: group.seat_day_fare, route_geometry: group.route_geometry, trip: { ...trip, stops } });
        }
        return reply({ offers }, 200, origin);
      }

      const poolTripDetail = path.match(/^\/captain\/pool\/trips\/(\d+)$/);
      if (req.method === "GET" && poolTripDetail) {
        const { data: trip, error: tripError } = await db.from("pool_trips").select("*").eq("id", poolTripDetail[1]).maybeSingle();
        if (tripError) throw tripError;
        if (!trip) return error("الرحلة غير موجودة.", 404, origin);
        const { data: group, error: groupError } = await db.from("pool_groups").select("*").eq("id", trip.group_id).maybeSingle();
        if (groupError) throw groupError;
        if (!group) return error("المجموعة غير موجودة.", 404, origin);
        let allowed = Number(trip.captain_user_id) === user!.id;
        if (!allowed && !trip.captain_user_id && ["scheduled", "needs_captain"].includes(trip.status) && ["minimum_met", "active", "needs_captain"].includes(group.status)) {
          const [{ data: profile }, { data: capability }, { data: stats }, { data: category }, members] = await Promise.all([
            db.from("captain_profiles").select("*").eq("user_id", user!.id).eq("verification_status", "approved").maybeSingle(),
            db.from("pool_captain_capabilities").select("*").eq("captain_user_id", user!.id).maybeSingle(),
            db.from("pool_captain_stats").select("*").eq("captain_user_id", user!.id).maybeSingle(),
            db.from("pool_categories").select("*").eq("id", group.category_id).maybeSingle(),
            getMembers(Number(group.id)),
          ]);
          const first = members[0];
          allowed = !!profile && !!capability && !!category && profile.current_lat != null && profile.current_lng != null && !!first &&
            Number(category.has_ac) === Number(capability.has_ac) &&
            (category.speed_tier === "faster" ? capability.accepts_faster === 1 : capability.accepts_saver === 1) &&
            distanceKm({ lat: Number(profile.current_lat), lng: Number(profile.current_lng) }, { lat: Number(first.pickup_lat), lng: Number(first.pickup_lng) }) <= Math.max(4, Number(stats?.search_radius_km ?? 4) - Math.min(3, Number(stats?.absences ?? 0)));
        }
        if (!allowed) return error("الرحلة غير متاحة ضمن نطاقك أو ليست مسندة إليك.", 404, origin);
        const { data: stops, error: stopsError } = await db.from("pool_trip_stops").select("*").eq("trip_id", trip.id).order("sequence");
        if (stopsError) throw stopsError;
        return reply({ trip: { ...trip, route_geometry: group.route_geometry, category_id: group.category_id, package_type: group.package_type }, stops: stops ?? [] }, 200, origin);
      }

      if (req.method === "GET" && path === "/captain/pool/trips") {
        const { data: trips } = await db.from("pool_trips").select("*").eq("captain_user_id", user!.id).in("status", ["assigned", "in_progress"]).order("departure_at");
        const out = [];
        for (const trip of trips ?? []) {
          const { data: stops } = await db.from("pool_trip_stops").select("*").eq("trip_id", trip.id).order("sequence");
          const { data: group } = await db.from("pool_groups").select("id,route_geometry").eq("id", trip.group_id).single();
          out.push({ trip: { ...trip, group_id: group?.id, route_geometry: group?.route_geometry }, stops: stops ?? [] });
        }
        return reply({ trips: out }, 200, origin);
      }

      const reorder = path.match(/^\/captain\/pool\/groups\/(\d+)\/reorder$/);
      if (req.method === "POST" && reorder) {
        const group = await getGroup(Number(reorder[1]));
        if (!group) return error("المجموعة غير موجودة.", 404, origin);
        const { data: assigned, error: assignedError } = await db.from("pool_trips").select("id").eq("group_id", group.id).eq("captain_user_id", user!.id).limit(1);
        if (assignedError) throw assignedError;
        if (!assigned?.length) return error("يمكن للكابتن المكلّف فقط تعديل ترتيب الوقفات.", 403, origin);
        const members = await getMembers(Number(group.id));
        if (!Array.isArray(body.member_ids) || body.member_ids.length !== members.length) return error("أرسل كل أعضاء المجموعة مرة واحدة وبالترتيب المطلوب.", 400, origin);
        const memberIds = body.member_ids as number[];
        if (memberIds.some(id => !Number.isInteger(id)) || new Set(memberIds).size !== members.length || members.some(m => !memberIds.includes(Number(m.id)))) return error("أرسل كل أعضاء المجموعة مرة واحدة وبالترتيب المطلوب.", 400, origin);
        const ordered = memberIds.map((id, i) => ({ ...members.find(m => Number(m.id) === Number(id))!, pickup_order: i }));
        const { data: category, error: categoryError } = await db.from("pool_categories").select("*").eq("id", group.category_id).single();
        if (categoryError) throw categoryError;
        let q; try { q = await quote(ordered, category); } catch { return error("خدمة حساب الطريق غير متاحة الآن. لم يتغير ترتيب الوقفات.", 503, origin); }
        for (const member of ordered) {
          const { error: orderError } = await db.from("pool_members").update({ pickup_order: member.pickup_order }).eq("id", member.id);
          if (orderError) throw orderError;
        }
        const { data: futureTrips, error: tripsError } = await db.from("pool_trips").select("*").eq("group_id", group.id).in("status", ["scheduled", "needs_captain", "assigned"]);
        if (tripsError) throw tripsError;
        for (const trip of futureTrips ?? []) {
          await db.from("pool_trip_stops").delete().eq("trip_id", trip.id);
          const rows = routePoints(ordered, trip.direction).map((stop, i) => ({ trip_id: trip.id, member_id: stop.member_id, stop_type: stop.stop_type, sequence: i + 1, lat: stop.lat, lng: stop.lng }));
          if (rows.length) { const { error: stopError } = await db.from("pool_trip_stops").insert(rows); if (stopError) throw stopError; }
          const departure = Date.parse(trip.departure_at);
          const { error: updateError } = await db.from("pool_trips").update({ estimated_arrival_at: new Date(departure + q.out.durationMin * 60_000).toISOString() }).eq("id", trip.id);
          if (updateError) throw updateError;
        }
        const { error: groupError } = await db.from("pool_groups").update({ route_distance_km: q.out.distanceKm, route_duration_min: q.out.durationMin, route_geometry: q.geometry, updated_at: new Date().toISOString() }).eq("id", group.id);
        if (groupError) throw groupError;
        for (const member of members) await notifyUser(Number(member.rider_user_id), Number(group.id), `pool-stop-order-${group.id}-${Date.now()}-${member.id}`, { message: "حدّث الكابتن ترتيب نقاط الرحلة.", route_version: group.route_version });
        return reply({ group: await groupView(await getGroup(Number(group.id))) }, 200, origin);
      }

      const accept = path.match(/^\/captain\/pool\/trips\/(\d+)\/accept$/);
      if (req.method === "POST" && accept) {
        const { data, error: e } = await db.from("pool_trips").update({ captain_user_id: user!.id, status: "assigned" }).eq("id", accept[1]).is("captain_user_id", null).in("status", ["scheduled", "needs_captain"]).select().maybeSingle();
        if (e) throw e; if (!data) return error("سبق كابتن آخر وقبل المسار أو لم يعد متاحًا.", 409, origin);
        const { data: group } = await db.from("pool_groups").select("package_type").eq("id", data.group_id).single();
        if (["weekly", "monthly"].includes(group?.package_type)) {
          await db.from("pool_groups").update({ fixed_captain_user_id: user!.id }).eq("id", data.group_id);
          await db.from("pool_trips").update({ captain_user_id: user!.id, status: "assigned" }).eq("group_id", data.group_id).is("captain_user_id", null).in("status", ["scheduled", "needs_captain"]);
        } else {
          await db.from("pool_trips").update({ captain_user_id: user!.id, status: "assigned" }).eq("group_id", data.group_id).eq("service_date", data.service_date).is("captain_user_id", null).in("status", ["scheduled", "needs_captain"]);
        }
        return reply({ trip: data }, 200, origin);
      }
      const reached = path.match(/^\/captain\/pool\/trips\/(\d+)\/stops\/(\d+)\/reached$/);
      if (req.method === "POST" && reached) {
        const tripId = Number(reached[1]), stopId = Number(reached[2]);
        const { data: trip } = await db.from("pool_trips").select("id,captain_user_id,status").eq("id", tripId).maybeSingle();
        if (!trip || trip.captain_user_id !== user!.id || !["assigned", "in_progress"].includes(trip.status)) return error("الرحلة غير مسندة إليك.", 403, origin);
        const { data: stops } = await db.from("pool_trip_stops").select("*").eq("trip_id", tripId).order("sequence");
        const next = stops?.find((s) => !s.reached_at);
        if (!next || next.id !== stopId) return error("سجّل الوصول إلى النقاط بالترتيب.", 409, origin);
        await db.from("pool_trip_stops").update({ reached_at: new Date().toISOString() }).eq("id", stopId).is("reached_at", null);
        await db.from("pool_trips").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", tripId).eq("status", "assigned");
        return reply({ success: true }, 200, origin);
      }
      const complete = path.match(/^\/captain\/pool\/trips\/(\d+)\/complete$/);
      if (req.method === "POST" && complete) {
        const tripId = Number(complete[1]);
        const { data: trip } = await db.from("pool_trips").select("*").eq("id", tripId).eq("captain_user_id", user!.id).maybeSingle();
        const { data: stops } = await db.from("pool_trip_stops").select("id,reached_at").eq("trip_id", tripId);
        if (!trip) return error("الرحلة غير مسندة إليك.", 403, origin);
        if (stops?.some((s) => !s.reached_at)) return error("لا يمكن إنهاء الرحلة قبل تسجيل الوصول لكل النقاط.", 409, origin);
        const { data: group } = await db.from("pool_groups").select("package_type,seat_day_fare").eq("id", trip.group_id).single();
        if (!group) return error("بيانات المجموعة المرتبطة بالرحلة غير متاحة.", 500, origin);
        const { data: members } = await db.from("pool_members").select("*").eq("group_id", trip.group_id).eq("status", "active");
        for (const m of members ?? []) {
          const listAmount = roundMoney(Number(group.seat_day_fare) * Number(m.seats_reserved));
          const discount = discountRate(group.package_type);
          const riderAmount = roundMoney(listAmount * (1 - discount));
          await db.from("pool_ledger").upsert({ trip_id: tripId, member_id: m.id, list_amount: listAmount, rider_amount: riderAmount, discount_amount: roundMoney(listAmount - riderAmount), captain_share_amount: roundMoney(listAmount * 0.8), company_share_amount: roundMoney(Math.max(0, listAmount * 0.2 - (listAmount - riderAmount))), company_commission_rate: 0.2, settlement_status: "pending" }, { onConflict: "trip_id,member_id" });
        }
        const { error: e } = await db.from("pool_trips").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", tripId).eq("captain_user_id", user!.id);
        if (e) throw e;
        return reply({ success: true, payment: "deferred", settlement_status: "pending" }, 200, origin);
      }
      const absence = path.match(/^\/captain\/pool\/trips\/(\d+)\/report-absence$/);
      if (req.method === "POST" && absence) {
        const tripId = Number(absence[1]);
        const { data: trip } = await db.from("pool_trips").select("*").eq("id", tripId).eq("captain_user_id", user!.id).maybeSingle();
        if (!trip) return error("الرحلة غير مسندة إليك.", 403, origin);
        await db.from("pool_trips").update({ captain_user_id: null, status: "needs_captain" }).eq("group_id", trip.group_id).eq("service_date", trip.service_date);
        const { data: stats } = await db.from("pool_captain_stats").select("absences").eq("captain_user_id", user!.id).maybeSingle();
        await db.from("pool_captain_stats").upsert({ captain_user_id: user!.id, absences: Number(stats?.absences ?? 0) + 1 }, { onConflict: "captain_user_id" });
        return reply({ success: true, replacement_search: "open" }, 200, origin);
      }

      const dailyTripView = path.match(/^\/captain\/trips\/(\d+)$/);
      if (req.method === "GET" && dailyTripView) {
        const { data: trip, error: tripError } = await db.from("trips").select("*,matches!inner(captain_user_id,daily_commute_request_id)").eq("id", dailyTripView[1]).maybeSingle();
        if (tripError) throw tripError;
        if (!trip || Number(trip.matches.captain_user_id) !== user!.id) return error("الرحلة دي مش بتاعتك.", 404, origin);
        const { data: stops, error: stopsError } = await db.from("trip_stops").select("*").eq("trip_id", trip.id).order("sequence");
        if (stopsError) throw stopsError;
        const { matches: _matches, ...publicTrip } = trip;
        return reply({ trip: publicTrip, stops: stops ?? [] }, 200, origin);
      }
      const dailyArrive = path.match(/^\/captain\/trips\/(\d+)\/stops\/(\d+)\/arrive$/);
      if (req.method === "POST" && dailyArrive) {
        const tripId = Number(dailyArrive[1]), stopId = Number(dailyArrive[2]);
        const { data: trip, error: tripError } = await db.from("trips").select("*,matches!inner(captain_user_id)").eq("id", tripId).maybeSingle();
        if (tripError) throw tripError;
        if (!trip || Number(trip.matches.captain_user_id) !== user!.id) return error("الرحلة دي مش بتاعتك.", 404, origin);
        if (trip.status !== "in_progress") return error("الرحلة دي مش شغّالة دلوقتي.", 409, origin);
        const { data: stops, error: stopsError } = await db.from("trip_stops").select("*").eq("trip_id", tripId).order("sequence");
        if (stopsError) throw stopsError;
        const stop = stops?.find(s => Number(s.id) === stopId);
        if (!stop) return error("الرحلة أو النقطة دي مش موجودة.", 404, origin);
        if (stop.reached_at) return error("الوصول اتسجّل لهذه النقطة قبل كده.", 409, origin);
        const next = stops?.find(s => !s.reached_at);
        if (!next || Number(next.id) !== stopId) return error("لازم توصل للنقطة السابقة الأول.", 409, origin);
        const previous = stops?.filter(s => Number(s.sequence) < Number(stop.sequence)).sort((a,b) => Number(a.sequence)-Number(b.sequence)) ?? [];
        const totalDistance = previous.reduce((sum, item, i) => {
          const nextPoint = i === previous.length - 1 ? stop : previous[i + 1];
          return sum + distanceKm({ lat: Number(item.lat), lng: Number(item.lng) }, { lat: Number(nextPoint.lat), lng: Number(nextPoint.lng) });
        }, 0);
        const profile = await db.from("captain_profiles").select("vehicle_type_id").eq("user_id", user!.id).maybeSingle();
        const pricing = profile.data ? await db.from("pricing_config").select("*").eq("vehicle_type_id", profile.data.vehicle_type_id).maybeSingle() : { data: null, error: null };
        if (profile.error || pricing.error) throw profile.error ?? pricing.error;
        if (!pricing.data) return error("إعدادات التسعير غير متاحة.", 503, origin);
        const duration = Math.max(0, (Date.now() - Date.parse(trip.started_at)) / 60000);
        const fare = roundMoney(Number(pricing.data.base_fee) + totalDistance * Number(pricing.data.rate_per_km) + duration * Number(pricing.data.rate_per_min));
        const { data: reached, error: updateError } = await db.from("trip_stops").update({ reached_at: new Date().toISOString(), fare_at_stop: fare }).eq("id", stopId).eq("trip_id", tripId).is("reached_at", null).select().maybeSingle();
        if (updateError) throw updateError;
        if (!reached) return error("الوصول اتسجّل لهذه النقطة قبل كده.", 409, origin);
        return reply({ stop: reached }, 200, origin);
      }
      const dailyComplete = path.match(/^\/captain\/trips\/(\d+)\/complete$/);
      if (req.method === "POST" && dailyComplete) {
        const tripId = Number(dailyComplete[1]);
        const { data: trip, error: tripError } = await db.from("trips").select("*,matches!inner(captain_user_id)").eq("id", tripId).maybeSingle();
        if (tripError) throw tripError;
        if (!trip || Number(trip.matches.captain_user_id) !== user!.id) return error("الرحلة دي مش بتاعتك.", 404, origin);
        if (trip.status !== "in_progress") return error("الرحلة دي مقفولة بالفعل.", 409, origin);
        const { data: stops, error: stopsError } = await db.from("trip_stops").select("*").eq("trip_id", tripId).order("sequence");
        if (stopsError) throw stopsError;
        if (!stops?.length || stops.some(s => !s.reached_at)) return error("لازم توصل كل نقط الرحلة قبل ما تقفلها.", 409, origin);
        const totalDistance = stops.slice(1).reduce((sum, stop, i) => sum + distanceKm({ lat: Number(stops[i].lat), lng: Number(stops[i].lng) }, { lat: Number(stop.lat), lng: Number(stop.lng) }), 0);
        const totalAmount = Number(stops[stops.length - 1].fare_at_stop ?? 0);
        const { data: completed, error: completeError } = await db.from("trips").update({ status: "completed", completed_at: new Date().toISOString(), total_distance_km: roundMoney(totalDistance), total_amount: roundMoney(totalAmount) }).eq("id", tripId).eq("status", "in_progress").select().maybeSingle();
        if (completeError) throw completeError;
        if (!completed) return error("الرحلة اتقفلت بالفعل.", 409, origin);
        const { data: existingPayment } = await db.from("payments").select("*").eq("trip_id", tripId).maybeSingle();
        if (existingPayment) return reply({ trip: completed, payment: existingPayment }, 200, origin);
        const { data: payment, error: paymentError } = await db.from("payments").insert({ trip_id: tripId, amount: totalAmount, reported_by_user_id: user!.id }).select().single();
        if (paymentError) throw paymentError;
        return reply({ trip: completed, payment }, 200, origin);
      }
      if (req.method === "GET" && path === "/captain/earnings") {
        const { data: matches, error: matchesError } = await db.from("matches").select("id").eq("captain_user_id", user!.id);
        if (matchesError) throw matchesError;
        const matchIds = (matches ?? []).map(m => m.id);
        if (!matchIds.length) return reply({ earnings: [], total_amount: 0 }, 200, origin);
        const { data: trips, error: tripsError } = await db.from("trips").select("*").eq("status", "completed").in("match_id", matchIds).order("completed_at", { ascending: false });
        if (tripsError) throw tripsError;
        const earnings = [];
        for (const trip of trips ?? []) {
          const [{ data: stops }, { data: payment }] = await Promise.all([db.from("trip_stops").select("*").eq("trip_id", trip.id).order("sequence"), db.from("payments").select("*").eq("trip_id", trip.id).maybeSingle()]);
          earnings.push({ trip, stops: stops ?? [], payment: payment ?? null });
        }
        return reply({ earnings, total_amount: earnings.reduce((sum, item) => sum + Number(item.payment?.amount ?? 0), 0) }, 200, origin);
      }

      return error("المسار غير موجود في واجهة Supabase بعد.", 501, origin);
    }
    const adminGate = path.startsWith("/admin/") ? await requireRole(user, ["admin"], origin) : null;
    if (adminGate) return adminGate;
    if (req.method === "GET" && path === "/admin/settings/otp") {
      const { data, error: settingsError } = await db.from("app_feature_flags").select("enabled").eq("flag_name", "captain_phone_otp").maybeSingle();
      if (settingsError) throw settingsError;
      return reply({ otp: { enabled: data?.enabled === true, provider: "twilio_verify", provider_ready: otpProviderReady() } }, 200, origin);
    }
    if (req.method === "PATCH" && path === "/admin/settings/otp") {
      if (typeof body.enabled !== "boolean") return error("حالة تشغيل OTP المطلوبة غير صحيحة.", 400, origin);
      if (body.enabled && !otpProviderReady()) return error("أضف أسرار Twilio إلى Supabase أولًا قبل تشغيل OTP.", 409, origin);
      const { data, error: settingsError } = await db.from("app_feature_flags").update({ enabled: body.enabled, updated_by_user_id: user!.id, updated_at: new Date().toISOString() }).eq("flag_name", "captain_phone_otp").select("enabled").maybeSingle();
      if (settingsError) throw settingsError;
      if (!data) return error("إعداد توثيق الهاتف غير موجود.", 500, origin);
      return reply({ otp: { enabled: data.enabled === true, provider: "twilio_verify", provider_ready: otpProviderReady() } }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/captains") {
      const status = url.searchParams.get("status") ?? "pending";
      if (!["pending", "approved", "rejected"].includes(status)) return error("حالة التوثيق المطلوبة مش صحيحة.", 400, origin);
      const { data: profiles } = await db.from("captain_profiles").select("*").eq("verification_status", status).order("created_at", { ascending: false });
      const captains = [];
      for (const p of profiles ?? []) {
        const { data: u } = await db.from("users").select("id,full_name,phone_number,verified_at").eq("id", p.user_id).single();
        captains.push({ user_id: p.user_id, ...u, vehicle_type_id: p.vehicle_type_id, license_number: p.license_number, vehicle_plate: p.vehicle_plate, verification_status: p.verification_status, current_lat: p.current_lat, current_lng: p.current_lng, created_at: p.created_at });
      }
      return reply({ captains }, 200, origin);
    }
    const verifyCaptain = path.match(/^\/admin\/captains\/(\d+)\/verification$/);
    if (req.method === "POST" && verifyCaptain) {
      if (!["pending", "approved", "rejected"].includes(String(body.status))) return error("حالة التوثيق المطلوبة مش صحيحة.", 400, origin);
      const { data, error: e } = await db.from("captain_profiles").update({ verification_status: body.status }).eq("user_id", verifyCaptain[1]).neq("verification_status", body.status).select().maybeSingle();
      if (e) throw e; if (!data) return error("الكابتن غير موجود أو حالته لم تتغير.", 404, origin);
      return reply({ captain_profile: data }, 200, origin);
    }

    const priceUpdate = path.match(/^\/admin\/pricing\/([^/]+)$/);
    if (req.method === "PATCH" && priceUpdate) {
      const values = [body.base_fee, body.rate_per_km, body.rate_per_min];
      if (!values.every(value => number(value) && value >= 0)) return error("قيم التسعير المطلوبة ناقصة أو غير صحيحة.", 400, origin);
      const { data, error: pe } = await db.from("pricing_config").update({ base_fee: values[0], rate_per_km: values[1], rate_per_min: values[2], updated_at: new Date().toISOString() }).eq("vehicle_type_id", priceUpdate[1]).select().maybeSingle();
      if (pe) throw pe; if (!data) return error("نوع المركبة ده مش موجود في إعدادات التسعير.", 404, origin);
      return reply({ pricing_config: data }, 200, origin);
    }
    const paymentView = path.match(/^\/admin\/payments\/(\d+)$/);
    if (req.method === "GET" && paymentView) {
      const { data: payment, error: pe } = await db.from("payments").select("*").eq("id", paymentView[1]).maybeSingle();
      if (pe) throw pe; if (!payment) return error("الدفعة دي مش موجودة.", 404, origin);
      const { data: events, error: ee } = await db.from("payment_status_events").select("*").eq("payment_id", payment.id).order("created_at", { ascending: false });
      if (ee) throw ee;
      return reply({ payment, status: events?.[0]?.to_status ?? "confirmed", events: events ?? [] }, 200, origin);
    }
    const paymentAction = path.match(/^\/admin\/payments\/(\d+)\/(resolve|adjust|void)$/);
    if (req.method === "POST" && paymentAction) {
      const paymentId = Number(paymentAction[1]), action = paymentAction[2];
      const { data: payment, error: pe } = await db.from("payments").select("id").eq("id", paymentId).maybeSingle();
      if (pe) throw pe; if (!payment) return error("الدفعة دي مش موجودة.", 404, origin);
      const { data: events, error: ee } = await db.from("payment_status_events").select("to_status").eq("payment_id", paymentId).order("created_at", { ascending: false }).limit(1);
      if (ee) throw ee;
      if ((events?.[0]?.to_status ?? "confirmed") !== "disputed") return error("لا يمكن اتخاذ إجراء إلا على دفعة معترض عليها.", 409, origin);
      const target = action === "resolve" ? "resolved" : action === "adjust" ? "adjusted" : "voided";
      if (action === "adjust" && (!number(body.adjusted_amount) || body.adjusted_amount < 0)) return error("المبلغ المعدل غير صالح.", 400, origin);
      const { data: event, error: insertError } = await db.from("payment_status_events").insert({ payment_id: paymentId, from_status: "disputed", to_status: target, actor_user_id: user!.id, reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : null, adjusted_amount: action === "adjust" ? body.adjusted_amount : null }).select().single();
      if (insertError) throw insertError;
      return reply({ event }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/analytics/overview") {
      const names = ["users", "captain_profiles", "daily_commute_requests", "trips", "payments", "pool_groups", "pool_members", "pool_trips"];
      const counts = await Promise.all(names.map(name => db!.from(name).select("id", { count: "exact", head: true })));
      const amounts = await db.from("payments").select("amount");
      if (counts.some(x => x.error) || amounts.error) throw new Error("analytics query failed");
      const overview: Record<string, number> = Object.fromEntries(names.map((name, i) => [name, counts[i].count ?? 0]));
      overview.confirmed_payment_amount = (amounts.data ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
      return reply({ overview }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/pool/overview") {
      const [groups, ledgers, trips] = await Promise.all([
        db.from("pool_groups").select("id,status,package_type,category_id,created_at,waiting_since,route_distance_km,seat_day_fare"),
        db.from("pool_ledger").select("list_amount,rider_amount,company_share_amount,captain_share_amount,settlement_status"),
        db.from("pool_trips").select("id,status"),
      ]);
      if (groups.error || ledgers.error || trips.error) throw new Error("pool overview query failed");
      return reply({ groups: groups.data ?? [], trips: trips.data ?? [], totals: { list_amount: (ledgers.data ?? []).reduce((sum, x) => sum + Number(x.list_amount), 0), rider_amount: (ledgers.data ?? []).reduce((sum, x) => sum + Number(x.rider_amount), 0), company_share_amount: (ledgers.data ?? []).reduce((sum, x) => sum + Number(x.company_share_amount), 0), captain_share_amount: (ledgers.data ?? []).reduce((sum, x) => sum + Number(x.captain_share_amount), 0), pending_settlements: (ledgers.data ?? []).filter(x => x.settlement_status === "pending").length } }, 200, origin);
    }
    if (req.method === "GET" && path === "/captain/pool/preferences") {
      const gate = await requireRole(user, ["captain"], origin); if (gate) return gate;
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      const [stats, capabilities] = await Promise.all([
        db.from("pool_captain_stats").select("*").eq("captain_user_id", user.id).maybeSingle(),
        db.from("pool_captain_capabilities").select("*").eq("captain_user_id", user.id).maybeSingle(),
      ]);
      if (stats.error || capabilities.error) throw new Error("captain preferences query failed");
      return reply({ radius_km: stats.data?.search_radius_km ?? 4, effective_radius_km: Math.max(4, Number(stats.data?.search_radius_km ?? 4) - Math.min(3, Number(stats.data?.absences ?? 0))), absences: stats.data?.absences ?? 0, capabilities: capabilities.data ?? null }, 200, origin);
    }
    return error("المسار غير موجود.", 404, origin);
  } catch (err) {
    if (err instanceof ApiFailure) return error(err.message, err.status, origin);
    console.error("[sekka-api] request failed:", err instanceof Error ? err.name : "UnknownError");
    return error("حصل خطأ غير متوقع. حاول مرة أخرى.", 500, origin);
  }
});
