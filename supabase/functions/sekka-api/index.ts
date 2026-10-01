import { createClient } from "npm:@supabase/supabase-js@2";

type Json = Record<string, unknown>;
type User = { id: number; full_name: string; phone_number: string; role: "rider" | "captain" | "admin"; verified_at: string | null; created_at: string };
const encoder = new TextEncoder();
const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function reply(data: unknown, status = 200, origin = "") {
  const corsOrigin = origin === "http://localhost:5173" || origin.endsWith(".sekka-go.pages.dev") ? origin : "null";
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": corsOrigin, "vary": "Origin", ...corsHeaders },
  });
}
function error(message: string, status = 400, origin = "") { return reply({ error: message }, status, origin); }
function clean(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function number(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function validPoint(lat: unknown, lng: unknown) { return number(lat) && lat >= -90 && lat <= 90 && number(lng) && lng >= -180 && lng <= 180; }
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
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function validDates(value: unknown, type: string): string[] | null {
  const count = packageDays(type);
  if (!count || !Array.isArray(value) || value.length !== count || !value.every((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))) return null;
  const dates = [...new Set(value as string[])].sort();
  if (dates.length !== count || dates[0] < new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date())) return null;
  for (const date of dates) {
    const parsed = new Date(date + "T12:00:00Z");
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date || [5, 6].includes(parsed.getUTCDay())) return null;
  }
  if (type === "weekly" && new Set(dates.map((date) => { const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0, 10); })).size !== 1) return null;
  if (type === "monthly" && new Set(dates.map((date) => date.slice(0, 7))).size !== 1) return null;
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
async function roadRoute(points: { lat: number; lng: number }[]) {
  const base = (Deno.env.get("SEKKA_ROUTING_URL") ?? "http://127.0.0.1:5000").replace(/\/+$/, "");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const response = await fetch(`${base}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal });
    if (!response.ok) throw new Error("تعذر الوصول لخدمة حساب المسار.");
    const data = await response.json();
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !number(route?.distance) || !number(route?.duration) || !Array.isArray(route?.geometry?.coordinates)) throw new Error("خدمة حساب المسار أعادت بيانات غير صحيحة.");
    return { distanceKm: roundMoney(route.distance / 1000), durationMin: roundMoney(route.duration / 60), geometry: route.geometry };
  } finally { clearTimeout(timer); }
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
    ...members.map((m) => ({ lat: Number(m.pickup_lat), lng: Number(m.pickup_lng), member_id: m.id, stop_type: "pickup" })),
    ...members.map((m) => ({ lat: Number(m.dropoff_lat), lng: Number(m.dropoff_lng), member_id: m.id, stop_type: "dropoff" })),
  ];
  return direction === "outbound" ? forward : [...forward].reverse().map((s) => ({ ...s, stop_type: s.stop_type === "pickup" ? "dropoff" : "pickup" }));
}
async function quote(members: Json[], category: Json) {
  const outPoints = routePoints(members, "outbound"), returnPoints = routePoints(members, "return");
  const [out, back] = await Promise.all([roadRoute(outPoints), roadRoute(returnPoints)]);
  const outFare = Number(category.base_fee) + out.distanceKm * Number(category.rate_per_km) + out.durationMin * Number(category.rate_per_min);
  const backFare = Number(category.base_fee) + back.distanceKm * Number(category.rate_per_km) + back.durationMin * Number(category.rate_per_min);
  return { out, back, total: roundMoney(outFare + backFare), seatDayFare: roundMoney((outFare + backFare) / Number(category.seats)), geometry: { outbound: out.geometry, return: back.geometry } };
}
async function activateGroup(group: Json, members: Json[], category: Json, quoteData: Json) {
  const min = category.speed_tier === "faster" ? 2 : 3;
  const memberCount = members.reduce((sum, m) => sum + Number(m.seats_reserved), 0);
  if (memberCount < min && memberCount < Number(category.seats)) return;
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
      const rows = stops.map((s, index) => ({ trip_id: trip.id, member_id: s.member_id, stop_type: s.stop_type, sequence: index + 1, lat: s.lat, lng: s.lng }));
      const { error: se } = await db!.from("pool_trip_stops").insert(rows);
      if (se) throw se;
    }
  }
  await db!.from("pool_groups").update({ status: "active", seat_day_fare: quoteData.seatDayFare, route_geometry: quoteData.geometry, route_distance_km: quoteData.out.distanceKm, route_duration_min: quoteData.out.durationMin, updated_at: new Date().toISOString() }).eq("id", group.id);
  for (const m of members) await notifyUser(m.rider_user_id, Number(group.id), `group-active-${group.id}`, { message: "اكتمل الحد الأدنى وبدأ تفعيل مسارك." });
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
  const suffix = url.pathname.replace(/^\/functions\/v1\/sekka-api/, "");
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
      return reply({ vehicle_types: vehicles.data, service_categories: categories.data }, 200, origin);
    }
    if (req.method === "GET" && path === "/pool/categories") {
      const { data, error: e } = await db.from("pool_categories").select("id,speed_tier,has_ac,seats,base_fee,rate_per_km,rate_per_min").order("id");
      if (e) throw e; return reply({ categories: data }, 200, origin);
    }
    const user = await authenticate(req);
    if (req.method === "POST" && path === "/auth/register") {
      const { full_name, phone_number, password, role } = body;
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
        if (!await verifyPassword(String(body.current_password), row.password_hash)) return error("كلمة السر الحالية غير صحيحة.", 401, origin);
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
      if (!validPoint(body.pickup_lat, body.pickup_lng) || !validPoint(body.dropoff_lat, body.dropoff_lng)) return error("إحداثيات الركوب أو النزول غير صحيحة.", 400, origin);
      const { data: category } = await db.from("pool_categories").select("*").eq("id", category_id).maybeSingle();
      if (!category) return error("فئة الرحلة غير موجودة.", 404, origin);
      let q; try { q = await quote([{ id: 0, pickup_lat: body.pickup_lat, pickup_lng: body.pickup_lng, dropoff_lat: body.dropoff_lat, dropoff_lng: body.dropoff_lng, pickup_order: 0 }], category); }
      catch { return error("خدمة حساب المسار غير متاحة. يلزم إعداد SEKKA_ROUTING_URL لخادم OSRM خاص قبل إنشاء المجموعات.", 503, origin); }
      const { data: group, error: ge } = await db.from("pool_groups").insert({ created_by_user_id: user!.id, category_id, package_type, service_dates: dates, morning_departure: morning_departure + ":00", return_departure: return_departure + ":00", route_distance_km: q.out.distanceKm, route_duration_min: q.out.durationMin, seat_day_fare: q.seatDayFare, route_geometry: q.geometry, status: "waiting" }).select().single();
      if (ge) throw ge;
      const { error: memberError } = await db.from("pool_members").insert({ group_id: group.id, rider_user_id: user!.id, pickup_lat: body.pickup_lat, pickup_lng: body.pickup_lng, dropoff_lat: body.dropoff_lat, dropoff_lng: body.dropoff_lng, seats_reserved: 1, status: "active", price_decision: "accepted", pickup_order: 0 });
      if (memberError) throw memberError;
      return reply({ ...(await groupView(group)), auto_matched: false }, 201, origin);
    }
    const joinMatch = path.match(/^\/rider\/pool\/groups\/(\d+)\/join$/);
    if (req.method === "POST" && joinMatch) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      if (!validPoint(body.pickup_lat, body.pickup_lng) || !validPoint(body.dropoff_lat, body.dropoff_lng)) return error("إحداثيات الركوب أو النزول غير صحيحة.", 400, origin);
      const group = await getGroup(Number(joinMatch[1]));
      if (!group || group.status !== "waiting") return error("المجموعة غير متاحة للانضمام.", 409, origin);
      const members = await getMembers(Number(group.id));
      if (members.some((m) => Number(m.rider_user_id) === user!.id)) return error("أنت منضم للمجموعة بالفعل.", 409, origin);
      const { data: category } = await db.from("pool_categories").select("*").eq("id", group.category_id).single();
      const capacityUsed = members.reduce((sum, m) => sum + Number(m.seats_reserved), 0);
      if (capacityUsed >= Number(category.seats)) return error("المقاعد المتاحة اكتملت.", 409, origin);
      const line = (group.route_geometry as Json | null)?.outbound as Json | undefined;
      if (lineDistanceKm({ lat: Number(body.pickup_lat), lng: Number(body.pickup_lng) }, line?.coordinates) > 3 || lineDistanceKm({ lat: Number(body.dropoff_lat), lng: Number(body.dropoff_lng) }, line?.coordinates) > 3) return error("نقطتا الركوب والنزول لازم تكونا في حدود ٣ كم من خط المجموعة.", 400, origin);
      const candidate = { id: 0, group_id: group.id, rider_user_id: user!.id, pickup_lat: body.pickup_lat, pickup_lng: body.pickup_lng, dropoff_lat: body.dropoff_lat, dropoff_lng: body.dropoff_lng, seats_reserved: 1, status: "active", price_decision: "accepted", pickup_order: members.length };
      let q; try { q = await quote([...members, candidate], category); } catch { return error("خدمة حساب المسار غير متاحة حاليًا.", 503, origin); }
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
        const minimum = category.speed_tier === "faster" ? 2 : 3;
        const seats = remaining.reduce((s, m) => s + Number(m.seats_reserved), 0);
        if (seats < minimum && seats < Number(category.seats)) {
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

    if (req.method === "POST" && path === "/internal/pool/process-deadlines") {
      const configured = Deno.env.get("SEKKA_CRON_TOKEN") ?? "";
      const supplied = req.headers.get("x-sekka-cron-token") ?? "";
      if (!configured || !supplied || !await crypto.subtle.digest("SHA-256", encoder.encode(configured)).then(async a => {
        const b = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(supplied)));
        return new Uint8Array(a).every((value, index) => value === b[index]);
      })) return error("غير مصرح.", 401, origin);
      const now = new Date();
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(now);
      const { data: waiting, error: waitingError } = await db.from("pool_groups").select("*").eq("status", "waiting").lte("waiting_since", new Date(now.getTime() - 72 * 3600_000).toISOString());
      if (waitingError) throw waitingError;
      let notices = 0, expired = 0, missed = 0;
      for (const group of waiting ?? []) {
        const dates = Array.isArray(group.service_dates) ? group.service_dates as string[] : JSON.parse(String(group.service_dates));
        if (dates.some((date: string) => date >= today)) {
          const members = await getMembers(Number(group.id));
          for (const member of members) await notifyUser(Number(member.rider_user_id), Number(group.id), `pool-wait-72h:${group.id}`, { options: ["wait", "book_remaining_seats", "cancel_free"] });
          notices += members.length;
        } else {
          await db.from("pool_groups").update({ status: "cancelled", updated_at: now.toISOString() }).eq("id", group.id).eq("status", "waiting");
          const members = await getMembers(Number(group.id));
          for (const member of members) await notifyUser(Number(member.rider_user_id), Number(group.id), `pool-dates-expired:${group.id}`, { cancelled_free: true, create_new_group: true });
          expired++;
        }
      }
      const { data: missedTrips, error: missedError } = await db.from("pool_trips").select("*").eq("status", "needs_captain").is("captain_user_id", null).lte("departure_at", now.toISOString());
      if (missedError) throw missedError;
      const handled = new Set<string>();
      for (const trip of missedTrips ?? []) {
        const key = `${trip.group_id}:${trip.service_date}`;
        if (handled.has(key)) continue;
        handled.add(key);
        const { data: group } = await db.from("pool_groups").select("*").eq("id", trip.group_id).maybeSingle();
        if (!group) continue;
        const { data: dayTrips } = await db.from("pool_trips").select("*").eq("group_id", trip.group_id).eq("service_date", trip.service_date).in("status", ["needs_captain", "scheduled", "assigned"]);
        const members = await getMembers(Number(group.id));
        const discount = discountRate(String(group.package_type));
        const dayPrice = Number(group.seat_day_fare ?? 0) * Number(members.reduce((sum, m) => sum + Number(m.seats_reserved), 0)) * (1 - discount);
        for (const dayTrip of dayTrips ?? []) {
          const half = roundMoney(dayPrice / Math.max(1, (dayTrips?.length ?? 2)));
          await db.from("pool_trips").update({ status: "cancelled", captain_user_id: null }).eq("id", dayTrip.id).in("status", ["needs_captain", "scheduled", "assigned"]);
          for (const member of members) await db.from("pool_trip_cancellations").upsert({ trip_id: dayTrip.id, member_id: member.id, charge_amount: 0, refund_amount: roundMoney(Number(group.seat_day_fare ?? 0) * Number(member.seats_reserved) * (1 - discount) / Math.max(1, (dayTrips?.length ?? 2))) }, { onConflict: "trip_id,member_id", ignoreDuplicates: true });
        }
        const { data: subscriptions } = await db.from("pool_subscriptions").select("*").in("member_id", members.map(m => m.id));
        for (const sub of subscriptions ?? []) {
          const member = members.find(m => Number(m.id) === Number(sub.member_id));
          const refund = roundMoney(Number(group.seat_day_fare ?? 0) * Number(member?.seats_reserved ?? 1) * (1 - discount));
          await db.from("pool_subscriptions").update({ amount_due: Math.max(0, Number(sub.amount_due) - refund), refund_amount: Number(sub.refund_amount) + refund, service_days: Math.max(0, Number(sub.service_days) - 1) }).eq("id", sub.id);
        }
        const { data: remaining } = await db.from("pool_trips").select("id").eq("group_id", group.id).in("status", ["scheduled", "assigned", "needs_captain", "in_progress"]);
        const nextStatus = remaining?.length ? (group.fixed_captain_user_id ? "active" : "needs_captain") : "cancelled";
        await db.from("pool_groups").update({ status: nextStatus }).eq("id", group.id);
        for (const member of members) await notifyUser(Number(member.rider_user_id), Number(group.id), `pool-no-replacement:${group.id}:${trip.service_date}`, { service_date: trip.service_date, charge: 0, refund: "service_day" });
        missed++;
      }
      return reply({ success: true, notices, expired_groups: expired, missed_service_days: missed }, 200, origin);
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
      if (cancelPackage && group.package_type === "daily") return error("استخدم إلغاء يوم الخدمة للحجز اليومي.", 400, origin);
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
        if (cancelPackage) {
          const adminFee = roundMoney(refundTotal * 0.10);
          refundTotal = roundMoney(refundTotal - adminFee);
        }
        await db.from("pool_members").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", member.id).eq("status", "active");
      }
      if (subscription && processed > 0) {
        const { error: se } = await db.from("pool_subscriptions").update({
          amount_due: Math.max(0, Number(subscription.amount_due) - (cancelPackage ? roundMoney(refundTotal / 0.9) : refundTotal)),
          refund_amount: roundMoney(Number(subscription.refund_amount) + refundTotal),
          cancelled_at: cancelPackage ? new Date().toISOString() : null,
        }).eq("id", subscription.id);
        if (se) throw se;
      }
      if (!cancelDay) {
        const { data: active } = await db.from("pool_members").select("id").eq("group_id", groupId).eq("status", "active");
        if (!active?.length) await db.from("pool_groups").update({ status: "cancelled" }).eq("id", groupId);
      }
      return reply({ success: true, days_processed: processed, charged_amount: roundMoney(chargeTotal), refund_amount: roundMoney(refundTotal), admin_fee: cancelPackage ? roundMoney(refundTotal / 9) : 0, payment: "deferred" }, 200, origin);
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
    if (req.method === "POST" && path === "/captain/verify/request") return error("إرسال رمز SMS غير مهيأ بعد. أضف مزود OTP آمنًا قبل تفعيل توثيق الهاتف.", 503, origin);
    if (req.method === "POST" && path === "/captain/verify/confirm") return error("توثيق الهاتف غير متاح قبل إعداد مزود OTP.", 503, origin);
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
          offers.push({ group_id: group.id, category_id: group.category_id, package_type: group.package_type, route_distance_km: group.route_distance_km, seat_day_fare: group.seat_day_fare, route_geometry: group.route_geometry, trip });
        }
        return reply({ offers }, 200, origin);
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
      const [stats, capabilities] = await Promise.all([
        db.from("pool_captain_stats").select("*").eq("captain_user_id", user.id).maybeSingle(),
        db.from("pool_captain_capabilities").select("*").eq("captain_user_id", user.id).maybeSingle(),
      ]);
      if (stats.error || capabilities.error) throw new Error("captain preferences query failed");
      return reply({ radius_km: stats.data?.search_radius_km ?? 4, effective_radius_km: Math.max(4, Number(stats.data?.search_radius_km ?? 4) - Math.min(3, Number(stats.data?.absences ?? 0))), absences: stats.data?.absences ?? 0, capabilities: capabilities.data ?? null }, 200, origin);
    }
    return error("المسار غير موجود.", 404, origin);
  } catch (err) {
    console.error("[sekka-api] request failed:", err instanceof Error ? err.name : "UnknownError");
    return error("حصل خطأ غير متوقع. حاول مرة أخرى.", 500, origin);
  }
});
