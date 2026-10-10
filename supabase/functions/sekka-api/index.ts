// deno-lint-ignore no-import-prefix -- Supabase Edge Functions resolve npm: dependencies directly.
import { createClient } from "npm:@supabase/supabase-js@2";
import { routeWithOsrm, RoutingError } from "./routing.ts";
import { dedupeLocationSuggestions, formatNominatimAddress, formatPhotonAddress, GREATER_CAIRO, isGreaterCairoPoint, normalizeLocationQuery, type LocationAddress, type LocationSuggestion, type NominatimResult, type PhotonProperties } from "./locations.ts";
import { readJsonObjectBody, RequestBodyTooLargeError } from "./request-body.ts";
import { activeMemberIdForRider } from "./group-view.ts";
import { corsHeaders } from "./cors.ts";

type Json = Record<string, unknown>;
type User = { id: number; full_name: string; phone_number: string; role: "rider" | "captain" | "admin"; verified_at: string | null; created_at: string; account_status?: "active" | "suspended" | "banned" };
const encoder = new TextEncoder();
function reply(data: unknown, status = 200, origin = "") {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...corsHeaders(origin || null, Deno.env.get("SEKKA_ALLOWED_ORIGINS")) },
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
function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function cairoDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function validPoint(lat: unknown, lng: unknown) { return number(lat) && lat >= -90 && lat <= 90 && number(lng) && lng >= -180 && lng <= 180; }
function maskAdminIdentifier(value: string | null | undefined) {
  if (!value) return null;
  const compact = value.replace(/\s/g, "");
  return `••••${compact.slice(-4)}`;
}
function normalizeClock(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(?:([01]\d|2[0-3]):([0-5]\d))(?:[:][0-5]\d(?:\.\d{1,6})?)?$/.exec(value);
  return match ? `${match[1]}:${match[2]}` : null;
}
const NOMINATIM_VIEWBOX = "30.8,30.3,31.6,29.7";
const geocodeCache = new Map<string, { expiresAt: number; value: LocationAddress | LocationSuggestion[] }>();
const locationRequests = new Map<string, Promise<LocationSuggestion[]>>();
function cacheRead<T extends LocationAddress | LocationSuggestion[]>(key: string): T | null {
  const hit = geocodeCache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) { geocodeCache.delete(key); return null; }
  return hit.value as T;
}
function cacheWrite<T extends LocationAddress | LocationSuggestion[]>(key: string, value: T, ttlMs = 86_400_000) {
  if (geocodeCache.size > 1_000) {
    for (const [oldKey, item] of geocodeCache) if (item.expiresAt <= Date.now()) geocodeCache.delete(oldKey);
    while (geocodeCache.size > 1_000) geocodeCache.delete(geocodeCache.keys().next().value!);
  }
  geocodeCache.set(key, { expiresAt: Date.now() + ttlMs, value });
}
function photonBaseUrl() {
  const configured = Deno.env.get("PHOTON_API_BASE_URL") ?? "https://photon.komoot.io";
  let base: URL;
  try { base = new URL(configured); } catch { throw new ApiFailure("إعدادات البحث عن العناوين غير صالحة.", 503); }
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new ApiFailure("إعدادات البحث عن العناوين غير صالحة.", 503);
  }
  return base.toString().replace(/\/$/, "");
}
async function fetchPhotonFeatures(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "SeKKa-Ride-App/1.0 (+https://sekka-go.pages.dev/)", "Accept-Language": "ar" },
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiFailure("خدمة البحث عن المواقع غير متاحة مؤقتًا. حاول مرة أخرى.", 503);
    const payload = await response.json() as { features?: Array<{ geometry?: { coordinates?: unknown }; properties?: PhotonProperties }> };
    if (!Array.isArray(payload.features)) throw new ApiFailure("خدمة البحث أعادت نتائج غير صالحة.", 502);
    return payload.features;
  } catch (cause) {
    if (cause instanceof ApiFailure) throw cause;
    throw new ApiFailure("تعذر البحث عن العنوان الآن. حاول مرة أخرى.", 503);
  } finally { clearTimeout(timeout); }
}
function nominatimBaseUrl() {
  const configured = Deno.env.get("NOMINATIM_API_BASE_URL") ?? "https://nominatim.openstreetmap.org";
  let base: URL;
  try { base = new URL(configured); } catch { throw new ApiFailure("إعدادات البحث عن العناوين غير صالحة.", 503); }
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new ApiFailure("إعدادات البحث عن العناوين غير صالحة.", 503);
  return base.toString().replace(/\/$/, "");
}
async function fetchNominatim<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": "SeKKa-Ride-App/1.0 (+https://sekka-go.pages.dev/)", "Accept-Language": "ar" },
    signal: AbortSignal.timeout(7_000),
  }).catch(() => { throw new ApiFailure("خدمة العناوين غير متاحة مؤقتًا.", 503); });
  if (!response.ok) throw new ApiFailure("خدمة العناوين غير متاحة مؤقتًا.", 503);
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") throw new ApiFailure("خدمة العناوين أعادت نتائج غير صالحة.", 502);
  return payload as T;
}
async function searchNominatimGreaterCairo(query: string): Promise<LocationSuggestion[]> {
  const cacheKey = `nominatim-search:${normalizeLocationQuery(query)}`;
  const cached = cacheRead<LocationSuggestion[]>(cacheKey);
  if (cached) return cached;
  // The public Nominatim service forbids autocomplete. This route is called only
  // after an explicit submit, and the shared limiter stays below its 1 req/s cap.
  if (!await takeLimit("nominatim-global", 1, 2)) throw new ApiFailure("خدمة البحث الدقيق مشغولة حاليًا. تقدر تختار من اقتراحات البحث السريع.", 429);
  const searchUrl = new URL(`${nominatimBaseUrl()}/search`);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("format", "jsonv2");
  searchUrl.searchParams.set("addressdetails", "1");
  searchUrl.searchParams.set("namedetails", "1");
  searchUrl.searchParams.set("accept-language", "ar");
  searchUrl.searchParams.set("countrycodes", "eg");
  searchUrl.searchParams.set("viewbox", NOMINATIM_VIEWBOX);
  searchUrl.searchParams.set("bounded", "1");
  searchUrl.searchParams.set("limit", "8");
  const bounds = await fetchNominatim<NominatimResult[]>(searchUrl);
  if (!Array.isArray(bounds)) throw new ApiFailure("خدمة العناوين أعادت نتائج غير صالحة.", 502);
  const suggestions = bounds.flatMap((item) => {
    const lat = Number(item.lat), lng = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isGreaterCairoPoint(lat, lng)) return [];
    const address = formatNominatimAddress(item);
    return [{ ...address, lat, lng }];
  });
  const unique = [...new Map(suggestions.map((item) => [item.label.toLocaleLowerCase("ar-EG"), item])).values()];
  cacheWrite(cacheKey, unique);
  return unique;
}
function searchGreaterCairo(query: string) {
  const cacheKey = `photon-search:${normalizeLocationQuery(query)}`;
  const cached = cacheRead<LocationSuggestion[]>(cacheKey);
  if (cached) return cached;
  const pending = locationRequests.get(cacheKey);
  if (pending) return pending;
  const request = (async () => {
    const searchUrl = new URL(`${photonBaseUrl()}/api`);
    searchUrl.searchParams.set("q", query.trim().replace(/\s+/g, " "));
    searchUrl.searchParams.set("bbox", `${GREATER_CAIRO.west},${GREATER_CAIRO.south},${GREATER_CAIRO.east},${GREATER_CAIRO.north}`);
    searchUrl.searchParams.set("countrycode", "EG");
    // The public Photon instance does not accept `lang=ar`; let its supported
    // language negotiation use the Arabic Accept-Language header instead.
    searchUrl.searchParams.set("limit", "12");
    searchUrl.searchParams.set("lat", "30.0444");
    searchUrl.searchParams.set("lon", "31.2357");
    searchUrl.searchParams.set("zoom", "12");
    searchUrl.searchParams.set("location_bias_scale", "0.25");
    const suggestions = (await fetchPhotonFeatures(searchUrl)).flatMap((feature) => {
      const coordinates = feature.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return [];
      const lng = coordinates[0], lat = coordinates[1];
      if (!number(lng) || !number(lat)) return [];
      if (!isGreaterCairoPoint(lat, lng)) return [];
      const properties = feature.properties ?? {};
      const address = formatPhotonAddress(properties);
      const osmKey = String(properties.osm_key ?? "");
      const isPlaceOfInterest = ["amenity", "shop", "office", "leisure", "tourism", "building"].includes(osmKey);
      const isAddress = Boolean(properties.housenumber || properties.street || ["house", "street"].includes(String(properties.type ?? "")));
      const priority = Number(isPlaceOfInterest) * 2 + Number(isAddress);
      return [{ ...address, lat, lng, priority }];
    });
    const unique = new Map<string, (typeof suggestions)[number]>();
    for (const suggestion of suggestions.sort((left, right) => right.priority - left.priority)) {
      const key = normalizeLocationQuery(suggestion.label).replace(/[\s،,]+/g, " ").trim();
      if (!unique.has(key)) unique.set(key, suggestion);
    }
    const results = dedupeLocationSuggestions([...unique.values()].slice(0, 6).map(({ priority: _priority, ...suggestion }) => suggestion));
    cacheWrite(cacheKey, results, 15 * 60_000);
    return results;
  })().finally(() => locationRequests.delete(cacheKey));
  locationRequests.set(cacheKey, request);
  return request;
}
async function reverseGreaterCairo(lat: number, lng: number): Promise<LocationAddress> {
  const cacheKey = `reverse:${lat.toFixed(5)}:${lng.toFixed(5)}`;
  const cached = cacheRead<LocationAddress>(cacheKey);
  if (cached) return cached;
  let nominatimError: unknown;
  if (await takeLimit("nominatim-global", 1, 2)) {
    const reverseUrl = new URL(`${nominatimBaseUrl()}/reverse`);
    reverseUrl.searchParams.set("format", "jsonv2");
    reverseUrl.searchParams.set("lat", String(lat));
    reverseUrl.searchParams.set("lon", String(lng));
    reverseUrl.searchParams.set("addressdetails", "1");
    reverseUrl.searchParams.set("namedetails", "1");
    reverseUrl.searchParams.set("zoom", "18");
    reverseUrl.searchParams.set("accept-language", "ar");
    try {
      const result = await fetchNominatim<NominatimResult>(reverseUrl);
      if (result && typeof result === "object") {
        const address = formatNominatimAddress(result);
        cacheWrite(cacheKey, address);
        return address;
      }
    } catch (cause) { nominatimError = cause; }
  }
  // Photon remains the responsive OSM-based fallback when Nominatim is busy or sparse.
  const reverseUrl = new URL(`${photonBaseUrl()}/reverse`);
  reverseUrl.searchParams.set("lat", String(lat));
  reverseUrl.searchParams.set("lon", String(lng));
  reverseUrl.searchParams.set("radius", "0.5");
  // Photon rejects `lang=ar`; fetchPhotonFeatures negotiates Arabic through
  // the Accept-Language header, so keep the reverse request compatible too.
  reverseUrl.searchParams.set("limit", "1");
  try {
    const features = await fetchPhotonFeatures(reverseUrl);
    const properties = features[0]?.properties;
    const address = properties ? formatPhotonAddress(properties) : { primary: "موقع داخل القاهرة الكبرى", secondary: "", label: "موقع داخل القاهرة الكبرى" };
    cacheWrite(cacheKey, address);
    return address;
  } catch (cause) {
    if (nominatimError instanceof ApiFailure) throw nominatimError;
    throw cause;
  }
}
function hex(bytes: Uint8Array) { return [...bytes].map((v) => v.toString(16).padStart(2, "0")).join(""); }
function bytesFromHex(value: string) { return new Uint8Array(value.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []); }
async function digest(value: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))); }
async function keyedDigest(value: string) {
  const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
  if (secret.length < 32) throw new ApiFailure("خدمة استعادة كلمة السر غير مهيأة بعد.", 503);
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}
function binaryReply(data: Uint8Array, contentType: string, origin = "") {
  const body = new ArrayBuffer(data.byteLength);
  new Uint8Array(body).set(data);
  return new Response(body, { status: 200, headers: {
    "content-type": contentType, "content-disposition": "inline", "cache-control": "private, no-store",
    "x-content-type-options": "nosniff", ...corsHeaders(origin || null, Deno.env.get("SEKKA_ALLOWED_ORIGINS")),
  } });
}
function phoneCandidates(value: string) {
  const normalized = phoneE164(value);
  if (!normalized) return [value.trim()];
  const digits = normalized.replace(/\D/g, "");
  return [...new Set([normalized, digits, digits.startsWith("20") ? `0${digits.slice(2)}` : digits])];
}
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

function randomUrlToken(byteLength = 18) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
const verificationDocuments = {
  rider: ["national_id_front", "national_id_back"],
  captainImmediate: ["national_id_front", "national_id_back", "driving_license_front", "driving_license_back", "vehicle_license_front", "vehicle_license_back"],
  captainDeferred: ["criminal_record", "drug_test"],
} as const;
const verificationDocLabels: Record<string, string> = {
  national_id_front: "الرقم القومي — الوجه الأمامي", national_id_back: "الرقم القومي — الوجه الخلفي",
  driving_license_front: "رخصة القيادة — الوجه الأمامي", driving_license_back: "رخصة القيادة — الوجه الخلفي",
  vehicle_license_front: "رخصة المركبة — الوجه الأمامي", vehicle_license_back: "رخصة المركبة — الوجه الخلفي",
  criminal_record: "الفيش والتشبيه", drug_test: "تحليل المخدرات",
};
async function telegramRequest(method: string, payload: Json) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new ApiFailure("خدمة التحقق المجانية غير مهيأة بعد.", 503);
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
  });
  const result = await response.json().catch(() => ({})) as Json;
  if (!response.ok || result.ok !== true) throw new ApiFailure("تعذر الاتصال بخدمة التحقق. حاول لاحقًا.", 502);
  return result;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function handleTelegramVerificationWebhook(body: Json, origin: string) {
  const message = isRecord(body.message) ? body.message : null;
  const from = message && isRecord(message.from) ? message.from : null;
  const chat = message && isRecord(message.chat) ? message.chat : null;
  if (!message || !from || !chat || !Number.isSafeInteger(from.id) || !Number.isSafeInteger(chat.id)) return reply({ ok: true }, 200, origin);
  const chatId = chat.id as number, telegramUserId = from.id as number;
  const text = typeof message.text === "string" ? message.text : "";
  const contact = isRecord(message.contact) ? message.contact : null;
  const resetStart = /^\/start\s+reset_([A-Za-z0-9_-]{20,32})$/.exec(text);
  if (resetStart) {
    const tokenHash = await digest(resetStart[1]);
    const { data: challenge, error: challengeError } = await db!.from("telegram_password_reset_challenges").select("token_hash,status,expires_at").eq("token_hash", tokenHash).maybeSingle();
    if (challengeError) throw challengeError;
    if (!challenge || challenge.status !== "waiting_start" || Date.parse(challenge.expires_at) <= Date.now()) {
      await telegramRequest("sendMessage", { chat_id: chatId, text: "انتهت صلاحية رابط الاستعادة. ارجع إلى سِكّة واطلب رابطًا جديدًا." });
      return reply({ ok: true }, 200, origin);
    }
    const { error: updateError } = await db!.from("telegram_password_reset_challenges").update({ telegram_user_id: telegramUserId, status: "waiting_contact" }).eq("token_hash", tokenHash).eq("status", "waiting_start");
    if (updateError) throw updateError;
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: "للتأكد من ملكية حسابك، شارك رقم هاتفك المسجل في سِكّة باستخدام الزر. لن نطلب منك كلمة السر الحالية.",
      reply_markup: { keyboard: [[{ text: "مشاركة رقم هاتفي", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
    });
    return reply({ ok: true }, 200, origin);
  }
  if (contact && contact.user_id === telegramUserId) {
    const { data: resetChallenges, error: resetError } = await db!.from("telegram_password_reset_challenges").select("token_hash,phone_hash,attempts").eq("telegram_user_id", telegramUserId).eq("status", "waiting_contact").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
    if (resetError) throw resetError;
    const resetChallenge = resetChallenges?.[0];
    if (resetChallenge) {
      const phone = phoneE164(typeof contact.phone_number === "string" ? contact.phone_number : "");
      if (!phone || await keyedDigest(phone) !== resetChallenge.phone_hash) {
        await telegramRequest("sendMessage", { chat_id: chatId, text: "رقم الهاتف لا يطابق الرقم المستخدم في الطلب. أرسل رقمك المسجل أو ابدأ طلبًا جديدًا.", reply_markup: { remove_keyboard: true } });
        return reply({ ok: true }, 200, origin);
      }
      const candidates = phoneCandidates(phone);
      const { data: account, error: accountError } = await db!.from("users").select("id,phone_number").in("phone_number", candidates).maybeSingle();
      if (accountError) throw accountError;
      if (!account) {
        await db!.from("telegram_password_reset_challenges").update({ status: "used", used_at: new Date().toISOString() }).eq("token_hash", resetChallenge.token_hash).eq("status", "waiting_contact");
        await telegramRequest("sendMessage", { chat_id: chatId, text: "إذا كان الرقم مرتبطًا بحساب في سِكّة، فستصلك خطوات الاستعادة. يمكنك الرجوع إلى التطبيق.", reply_markup: { remove_keyboard: true } });
        return reply({ ok: true }, 200, origin);
      }
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
      const codeHash = await keyedDigest(`${resetChallenge.phone_hash}:${code}`);
      const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
      const { error: updateError } = await db!.from("telegram_password_reset_challenges").update({ status: "code_sent", code_hash: codeHash, attempts: 0, expires_at: expiresAt }).eq("token_hash", resetChallenge.token_hash).eq("status", "waiting_contact");
      if (updateError) throw updateError;
      await telegramRequest("sendMessage", { chat_id: chatId, text: `رمز تغيير كلمة السر في سِكّة: ${code}\nصالح لمدة ١٥ دقيقة. لا تشاركه مع أي شخص.` , reply_markup: { remove_keyboard: true } });
      return reply({ ok: true }, 200, origin);
    }
  }
  const start = /^\/start\s+verify_([A-Za-z0-9_-]{20,32})$/.exec(text);
  if (start) {
    const tokenHash = await digest(start[1]);
    const { data: challenge, error: challengeError } = await db!.from("telegram_phone_verification_challenges").select("token_hash,user_id,status,expires_at").eq("token_hash", tokenHash).maybeSingle();
    if (challengeError) throw challengeError;
    if (!challenge || challenge.status !== "waiting_start" || Date.parse(challenge.expires_at) <= Date.now()) {
      await telegramRequest("sendMessage", { chat_id: chatId, text: "انتهت صلاحية رابط التحقق. ارجع إلى سِكّة واطلب رابطًا جديدًا." });
      return reply({ ok: true }, 200, origin);
    }
    const { error: updateError } = await db!.from("telegram_phone_verification_challenges").update({ telegram_user_id: telegramUserId, status: "waiting_contact" }).eq("token_hash", tokenHash).eq("status", "waiting_start");
    if (updateError) throw updateError;
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: "لإثبات ملكية رقم الهاتف المسجّل في سِكّة، استخدم زر مشاركة رقم هاتفي. يجب إرسال رقمك أنت من حساب تيليجرام نفسه.",
      reply_markup: { keyboard: [[{ text: "مشاركة رقم هاتفي", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
    });
    return reply({ ok: true }, 200, origin);
  }
  if (contact && contact.user_id === telegramUserId) {
    const { data: challenges, error: challengeError } = await db!.from("telegram_phone_verification_challenges").select("token_hash,user_id").eq("telegram_user_id", telegramUserId).eq("status", "waiting_contact").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
    if (challengeError) throw challengeError;
    const challenge = challenges?.[0];
    if (!challenge) {
      await telegramRequest("sendMessage", { chat_id: chatId, text: "لا يوجد طلب تحقق نشط. ارجع إلى سِكّة وابدأ من جديد.", reply_markup: { remove_keyboard: true } });
      return reply({ ok: true }, 200, origin);
    }
    const [{ data: target, error: userError }, { data: sender, error: challengeUpdateError }] = await Promise.all([
      db!.from("users").select("id,phone_number,verified_at").eq("id", challenge.user_id).maybeSingle(),
      db!.from("telegram_phone_verification_challenges").select("telegram_user_id").eq("token_hash", challenge.token_hash).maybeSingle(),
    ]);
    if (userError || challengeUpdateError) throw userError ?? challengeUpdateError;
    const phone = phoneE164(typeof contact.phone_number === "string" ? contact.phone_number : "");
    if (!target || sender?.telegram_user_id !== telegramUserId || phone !== phoneE164(target.phone_number)) {
      await telegramRequest("sendMessage", { chat_id: chatId, text: "الرقم المرسل لا يطابق الرقم المسجّل في سِكّة. أرسل جهة اتصال رقمك المسجّل وحاول مرة أخرى.", reply_markup: { remove_keyboard: true } });
      return reply({ ok: true }, 200, origin);
    }
    const verifiedAt = target.verified_at ?? new Date().toISOString();
    const [{ error: userUpdateError }, { error: challengeCompleteError }] = await Promise.all([
      db!.from("users").update({ verified_at: verifiedAt }).eq("id", challenge.user_id).is("verified_at", null),
      db!.from("telegram_phone_verification_challenges").update({ status: "verified", verified_at: verifiedAt }).eq("token_hash", challenge.token_hash).eq("status", "waiting_contact"),
    ]);
    if (userUpdateError || challengeCompleteError) throw userUpdateError ?? challengeCompleteError;
    await telegramRequest("sendMessage", { chat_id: chatId, text: "تم توثيق رقمك بنجاح. يمكنك الرجوع إلى تطبيق سِكّة.", reply_markup: { remove_keyboard: true } });
  }
  return reply({ ok: true }, 200, origin);
}
async function requireVerificationActivation(user: User, origin: string) {
  if (!user.verified_at) return error("وثّق رقم هاتفك وأكمل مستنداتك من صفحة التوثيق قبل حجز رحلة.", 403, origin);
  const { data: documents, error: documentsError } = await db!.from("user_verifications").select("document_type,status").eq("user_id", user.id);
  if (documentsError) throw documentsError;
  const approved = new Set((documents ?? []).filter((row) => row.status === "approved").map((row) => row.document_type));
  const required = user.role === "rider" ? verificationDocuments.rider : verificationDocuments.captainImmediate;
  if (required.some((type) => !approved.has(type))) return error("أكمل توثيق مستنداتك من صفحة التوثيق قبل تنفيذ هذا الإجراء.", 403, origin);
  if (user.role === "captain") {
    const { data: profile, error: profileError } = await db!.from("captain_profiles").select("status,verification_status").eq("user_id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.status !== "active" || profile.verification_status !== "approved") return error("حساب الكابتن غير مفعّل لاستقبال الرحلات. راجع حالة التوثيق.", 403, origin);
  }
  return null;
}
async function captainHasImmediateVerification(userId: number) {
  const [{ data: account, error: accountError }, { data: documents, error: documentsError }] = await Promise.all([
    db!.from("users").select("verified_at").eq("id", userId).maybeSingle(),
    db!.from("user_verifications").select("document_type,status").eq("user_id", userId),
  ]);
  if (accountError || documentsError) throw accountError ?? documentsError;
  const approved = new Set((documents ?? []).filter((row) => row.status === "approved").map((row) => row.document_type));
  return Boolean(account?.verified_at) && verificationDocuments.captainImmediate.every((type) => approved.has(type));
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
  const { data: user, error: userError } = await db!.from("users").select("id,full_name,phone_number,role,verified_at,created_at").eq("id", session.user_id).is("deleted_at", null).maybeSingle();
  if (userError || !user) return null;
  const { data: controls, error: controlsError } = await db!.from("admin_user_controls").select("status").eq("user_id", user.id).maybeSingle();
  if (controlsError) throw controlsError;
  return { ...user, account_status: (controls?.status ?? "active") as User["account_status"] };
}
async function getDirectMessageContactIds(userId: number): Promise<number[]> {
  const { data, error: contactsError } = await db!.rpc("direct_message_contact_ids", { p_user_id: userId });
  if (contactsError) throw contactsError;
  return (data ?? []).map((row: { contact_user_id: number | string }) => Number(row.contact_user_id)).filter(Number.isSafeInteger);
}
function requireRole(user: User | null, roles: User["role"][], origin: string) {
  if (!user) return error("سجّل الدخول أولًا.", 401, origin);
  if (!roles.includes(user.role)) return error("ما عندكش صلاحية لتنفيذ الإجراء ده.", 403, origin);
  return null;
}
async function requireSuperAdmin(user: User | null, origin: string) {
  const roleGate = await requireRole(user, ["admin"], origin);
  if (roleGate) return roleGate;
  const { data, error: lookupError } = await db!.from("super_admins").select("user_id").eq("user_id", user!.id).maybeSingle();
  if (lookupError) throw lookupError;
  return data ? null : error("هذا الإجراء متاح لحساب Super Admin فقط.", 403, origin);
}
async function writeAdminAudit(actorId: number, action: string, resourceType: string, resourceId: string | null, reason: string | null, before: Json = {}, after: Json = {}) {
  const { error: auditError } = await db!.rpc("admin_write_audit", {
    p_actor_user_id: actorId, p_action: action, p_resource_type: resourceType, p_resource_id: resourceId,
    p_reason: reason, p_before: before, p_after: after,
  });
  if (auditError) throw auditError;
}
async function deleteAccountData(actorId: number, targetId: number, reason: string | null) {
  const [{ data: profile, error: profileError }, { data: documents, error: documentsError }] = await Promise.all([
    db!.from("users").select("avatar_path").eq("id", targetId).is("deleted_at", null).maybeSingle(),
    db!.from("user_verifications").select("object_path").eq("user_id", targetId),
  ]);
  if (profileError || documentsError) throw profileError ?? documentsError;
  if (!profile) throw new Error("account not found or already deleted");
  const paths = (documents ?? []).map((document) => document.object_path).filter((path): path is string => typeof path === "string" && path.length > 0);
  const { data, error: deletionError } = await db!.rpc("sekka_delete_account_v1", {
    p_actor_user_id: actorId, p_target_user_id: targetId, p_reason: reason,
  });
  if (deletionError) throw deletionError;
  // Commit the account redaction first. A policy rejection must never remove
  // verification files from an account that was not actually deleted.
  const cleanupErrors: string[] = [];
  if (paths.length) {
    const { error: storageError } = await db!.storage.from("verification-documents").remove(paths);
    if (storageError) cleanupErrors.push(storageError.message);
  }
  if (profile.avatar_path) {
    const { error: avatarError } = await db!.storage.from("avatars").remove([profile.avatar_path]);
    if (avatarError) cleanupErrors.push(avatarError.message);
  }
  if (cleanupErrors.length) console.error("account deletion storage cleanup failed", { targetId, errors: cleanupErrors });
  return data;
}
async function notifyUser(userId: number, groupId: number | null, eventKey: string, payload: Json = {}) {
  if (groupId !== null) {
    const { data: muted, error: muteError } = await db!.from("pool_notification_mutes").select("user_id").eq("user_id", userId).eq("group_id", groupId).maybeSingle();
    if (muteError) throw muteError;
    if (muted) return;
  }
  const type = eventKey.includes("chat") ? "chat" : eventKey.includes("rating") || eventKey.includes("feedback") ? "rating" : eventKey.startsWith("broadcast:") || eventKey.includes("verification") || eventKey.startsWith("admin-") ? "system" : ["cancel", "delay", "route", "no-captain", "expired", "replacement", "price"].some((part) => eventKey.includes(part)) ? "alert" : "ride";
  await db!.from("pool_notifications").upsert({ user_id: userId, group_id: groupId, actor_id: typeof payload.actor_id === "number" ? payload.actor_id : null, type, event_key: eventKey, payload }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
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
      const expected = new Date(dates[index - 1]! + "T12:00:00Z");
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
  const [members, trips] = await Promise.all([
    getMembers(Number(group.id), false),
    db!.from("pool_trips").select("*").eq("group_id", group.id).order("service_date").order("direction"),
  ]);
  let subscription;
  const ownActiveMemberId = activeMemberIdForRider(
    members as Array<{ id: number; rider_user_id: number; status: string }>,
    Number(_currentRiderId),
  );
  if (ownActiveMemberId !== null) {
    const { data, error: subscriptionError } = await db!.from("pool_subscriptions")
      .select("amount_due,refund_amount,service_days,discount_rate")
      .eq("member_id", ownActiveMemberId)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    subscription = data ?? undefined;
  }
  return { group: { ...publicGroup, service_dates: JSON.stringify(group.service_dates), route_geometry: group.route_geometry }, members, trips: trips.data ?? [], ...(subscription ? { subscription } : {}) };
}


async function automaticMatch(request: Json) {
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
  const multipart = req.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data") === true;
  if (!["GET", "HEAD"].includes(req.method) && !multipart) {
    try {
      body = await readJsonObjectBody(req);
    } catch (cause) {
      if (cause instanceof RequestBodyTooLargeError) return error("حجم الطلب أكبر من المسموح.", 413, origin);
      return error("بيانات الطلب غير صالحة.", 400, origin);
    }
  }
  try {
    if (req.method === "POST" && path === "/webhooks/telegram") {
      const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
      const received = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
      if (expected.length < 32 || received !== expected) return error("Webhook غير مصرح به.", 401, origin);
      return await handleTelegramVerificationWebhook(body, origin);
    }
    if (req.method === "GET" && (path === "/health" || path === "/")) {
      const { error: healthError } = await db.from("pool_categories").select("id").limit(1);
      if (healthError) return error("قاعدة البيانات غير متاحة مؤقتًا.", 503, origin);
      return reply({ status: "ok", service: "sekka-supabase-api", phase: 14, time: new Date().toISOString() }, 200, origin);
    }
    if (req.method === "GET" && path === "/config") {
      const [vehicles, categories] = await Promise.all([db.from("vehicle_types").select("*").order("id"), db.from("service_categories").select("*").order("id")]);
      if (vehicles.error || categories.error) return error("حصل خطأ ونحن بنجيب الإعدادات، جرّب تاني بعد شوية.", 500, origin);
      return reply({ vehicle_types: vehicles.data, service_categories: categories.data, maps: { address_search_enabled: true, provider: "photon+nominatim", routing_provider: "osrm", service_area: "greater-cairo" } }, 200, origin);
    }
    if (req.method === "GET" && path === "/pool/categories") {
      const { data, error: e } = await db.from("pool_categories").select("id,speed_tier,has_ac,seats,base_fee,rate_per_km,rate_per_min").order("id");
      if (e) throw e; return reply({ categories: data }, 200, origin);
    }
    const user = await authenticate(req);
    if (user && user.account_status !== "active" && path !== "/auth/logout" && !(req.method === "DELETE" && path === "/account")) return error("الحساب موقوف حاليًا. تواصل مع خدمة العملاء للمساعدة.", 403, origin);
    const avatarRoute = path.match(/^\/profile\/(\d+)\/avatar$/);
    if (req.method === "GET" && avatarRoute) {
      if (!user) return error("سجّل الدخول لعرض الصور الشخصية.", 401, origin);
      const userId = Number(avatarRoute[1]);
      const { data: profile, error: profileError } = await db.from("users").select("avatar_path").eq("id", userId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.avatar_path) return error("لا توجد صورة شخصية.", 404, origin);
      const { data: image, error: imageError } = await db.storage.from("avatars").download(profile.avatar_path);
      if (imageError || !image) throw imageError ?? new Error("Avatar could not be loaded");
      const bytes = new Uint8Array(await image.arrayBuffer());
      const contentType = image.type === "image/png" || image.type === "image/webp" ? image.type : "image/jpeg";
      return binaryReply(bytes, contentType, origin);
    }
    if (req.method === "POST" && path === "/profile/avatar") {
      if (!user) return error("سجّل الدخول لتحديث صورتك الشخصية.", 401, origin);
      const contentLength = Number(req.headers.get("content-length") ?? 0);
      if (contentLength > 2_150_000) return error("حجم الصورة لازم يكون أقل من 2 ميجابايت.", 413, origin);
      let form: FormData;
      try { form = await req.formData(); } catch { return error("تعذر قراءة الصورة المرفقة.", 400, origin); }
      const file = form.get("file");
      if (!(file instanceof File) || file.size < 1 || file.size > 2 * 1024 * 1024) return error("ارفع صورة لا يتجاوز حجمها 2 ميجابايت.", 400, origin);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const typeFromBytes = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg"
        : bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? "image/png"
        : bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" ? "image/webp" : null;
      if (!typeFromBytes || file.type !== typeFromBytes) return error("صيغة الصورة غير مدعومة. استخدم JPEG أو PNG أو WebP.", 415, origin);
      const extension = typeFromBytes === "image/jpeg" ? "jpg" : typeFromBytes.split("/")[1];
      const objectPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { data: previous, error: previousError } = await db.from("users").select("avatar_path").eq("id", user.id).maybeSingle();
      if (previousError) throw previousError;
      const { error: uploadError } = await db.storage.from("avatars").upload(objectPath, bytes, { contentType: typeFromBytes, upsert: false });
      if (uploadError) throw uploadError;
      const { error: saveError } = await db.from("users").update({ avatar_path: objectPath }).eq("id", user.id);
      if (saveError) { await db.storage.from("avatars").remove([objectPath]); throw saveError; }
      if (previous?.avatar_path) await db.storage.from("avatars").remove([previous.avatar_path]);
      return reply({ success: true }, 200, origin);
    }
    if (req.method === "DELETE" && path === "/profile/avatar") {
      if (!user) return error("سجّل الدخول لحذف صورتك الشخصية.", 401, origin);
      const { data: previous, error: previousError } = await db.from("users").select("avatar_path").eq("id", user.id).maybeSingle();
      if (previousError) throw previousError;
      const { error: saveError } = await db.from("users").update({ avatar_path: null }).eq("id", user.id);
      if (saveError) throw saveError;
      if (previous?.avatar_path) await db.storage.from("avatars").remove([previous.avatar_path]);
      return reply({ success: true }, 200, origin);
    }
    if (req.method === "GET" && path === "/verification") {
      const gate = await requireRole(user, ["rider", "captain"], origin); if (gate) return gate;
      const [{ data: documents, error: documentsError }, { data: profile, error: profileError }] = await Promise.all([
        db.from("user_verifications").select("id,document_type,status,rejection_reason,uploaded_at,reviewed_at").eq("user_id", user!.id).order("document_type"),
        user!.role === "captain" ? db.from("captain_profiles").select("status,verification_status,grace_period_expires_at").eq("user_id", user!.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (documentsError || profileError) throw documentsError ?? profileError;
      const botUsername = Deno.env.get("TELEGRAM_BOT_USERNAME")?.replace(/^@/, "") ?? "";
      return reply({
        role: user!.role,
        phone_verified: Boolean(user!.verified_at),
        telegram_enabled: Boolean(Deno.env.get("TELEGRAM_BOT_TOKEN") && botUsername && Deno.env.get("TELEGRAM_WEBHOOK_SECRET")),
        telegram_bot_username: /^[A-Za-z0-9_]{5,32}$/.test(botUsername) ? botUsername : null,
        documents: documents ?? [],
        captain_status: profile?.status ?? null,
        verification_status: profile?.verification_status ?? null,
        grace_period_expires_at: profile?.grace_period_expires_at ?? null,
        requirements: { rider: verificationDocuments.rider, captain_immediate: verificationDocuments.captainImmediate, captain_deferred: verificationDocuments.captainDeferred, labels: verificationDocLabels },
      }, 200, origin);
    }
    if (req.method === "POST" && path === "/verification/phone/telegram") {
      const gate = await requireRole(user, ["rider", "captain"], origin); if (gate) return gate;
      if (user!.verified_at) return reply({ success: true, already_verified: true }, 200, origin);
      const botUsername = (Deno.env.get("TELEGRAM_BOT_USERNAME") ?? "").replace(/^@/, "");
      if (!Deno.env.get("TELEGRAM_BOT_TOKEN") || !Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || !/^[A-Za-z0-9_]{5,32}$/.test(botUsername)) return error("خدمة التحقق المجانية غير مهيأة بعد. تواصل مع الدعم.", 503, origin);
      if (!phoneE164(user!.phone_number)) return error("رقم الهاتف المسجل غير صالح. حدّثه قبل بدء التحقق.", 400, origin);
      if (!await takeLimit(`telegram-verification:${user!.id}`, 3, 3600)) return error("طلبت روابط تحقق كثيرة. حاول بعد قليل.", 429, origin);
      const token = randomUrlToken();
      const tokenHash = await digest(token);
      const { error: insertError } = await db.from("telegram_phone_verification_challenges").insert({ token_hash: tokenHash, user_id: user!.id, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() });
      if (insertError) throw insertError;
      return reply({ verification_url: `https://t.me/${botUsername}?start=verify_${token}`, expires_in_seconds: 900 }, 201, origin);
    }
    const documentUploadRoute = path.match(/^\/verification\/documents\/([a-z_]+)$/);
    if (req.method === "POST" && documentUploadRoute) {
      const gate = await requireRole(user, ["rider", "captain"], origin); if (gate) return gate;
      const documentType = documentUploadRoute[1];
      const allowed = user!.role === "rider" ? verificationDocuments.rider : [...verificationDocuments.captainImmediate, ...verificationDocuments.captainDeferred];
      if (!(allowed as readonly string[]).includes(documentType)) return error("نوع المستند غير مطلوب لهذا الحساب.", 400, origin);
      const contentLength = Number(req.headers.get("content-length") ?? 0);
      if (contentLength > 9_000_000) return error("حجم الملف أكبر من 8 ميجابايت.", 413, origin);
      let form: FormData;
      try { form = await req.formData(); } catch { return error("تعذر قراءة الملف المرفق.", 400, origin); }
      const file = form.get("file");
      if (!(file instanceof File) || file.size < 1 || file.size > 8 * 1024 * 1024) return error("ارفع صورة أو PDF لا يتجاوز 8 ميجابايت.", 400, origin);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const typeFromBytes = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg"
        : bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 ? "image/png"
        : bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" ? "image/webp"
        : bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 ? "application/pdf" : null;
      if (!typeFromBytes || (file.type && file.type !== typeFromBytes)) return error("صيغة الملف غير مدعومة. استخدم JPEG أو PNG أو WebP أو PDF.", 415, origin);
      const extension = typeFromBytes === "image/jpeg" ? "jpg" : typeFromBytes.split("/")[1];
      const objectPath = `${user!.id}/${documentType}/${crypto.randomUUID()}.${extension}`;
      const { data: previous, error: previousError } = await db.from("user_verifications").select("object_path").eq("user_id", user!.id).eq("document_type", documentType).maybeSingle();
      if (previousError) throw previousError;
      const { error: uploadError } = await db.storage.from("verification-documents").upload(objectPath, bytes, { contentType: typeFromBytes, upsert: false });
      if (uploadError) throw uploadError;
      const { data: document, error: saveError } = await db.from("user_verifications").upsert({
        user_id: user!.id, document_type: documentType, status: "pending", object_path: objectPath,
        content_type: typeFromBytes, file_size_bytes: bytes.byteLength,
        rejection_reason: null, uploaded_at: new Date().toISOString(), reviewed_at: null, reviewed_by: null,
      }, { onConflict: "user_id,document_type" }).select("id,document_type,status,rejection_reason,uploaded_at,reviewed_at").single();
      if (saveError) { await db.storage.from("verification-documents").remove([objectPath]); throw saveError; }
      if (previous?.object_path) await db.storage.from("verification-documents").remove([previous.object_path]);
      return reply({ document }, 201, origin);
    }
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
    if ((req.method === "GET" || req.method === "PUT") && path === "/rider/commuter-preferences") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      if (req.method === "GET") {
        const { data, error: preferencesError } = await db.from("rider_commuter_preferences").select("usual_days,usual_departure_time,usual_return_time,frequent_places").eq("user_id", user!.id).maybeSingle();
        if (preferencesError) throw preferencesError;
        return reply({ preferences: data ?? { usual_days: [0,1,2,3,4], usual_departure_time: "07:30:00", usual_return_time: "17:00:00", frequent_places: [] } }, 200, origin);
      }
      const days = Array.isArray(body.usual_days) ? body.usual_days : [];
      const departure = normalizeClock(body.usual_departure_time);
      const returning = normalizeClock(body.usual_return_time);
      const places = Array.isArray(body.frequent_places) ? body.frequent_places : [];
      if (!days.length || days.length > 7 || days.some(day => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6) || new Set(days).size !== days.length || !departure || !returning || returning <= departure || places.length > 5 || places.some(place => !place || typeof place !== "object" || typeof place.label !== "string" || !place.label.trim() || place.label.length > 240 || !validPoint(place.lat, place.lng) || !isGreaterCairoPoint(Number(place.lat), Number(place.lng)))) {
        return error("راجع أيام المشوار ومواعيده والأماكن المتكررة داخل القاهرة الكبرى.", 400, origin);
      }
      const frequentPlaces = places.map(place => ({ label: String(place.label).trim(), lat: Number(place.lat), lng: Number(place.lng) }));
      const { data, error: saveError } = await db.from("rider_commuter_preferences").upsert({ user_id: user!.id, usual_days: days, usual_departure_time: departure, usual_return_time: returning, frequent_places: frequentPlaces, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("usual_days,usual_departure_time,usual_return_time,frequent_places").single();
      if (saveError) throw saveError;
      return reply({ preferences: data }, 200, origin);
    }
    if (req.method === "GET" && path === "/rider/commuter-board-cards") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const now = Date.now();
      const [{ data: campaigns, error: campaignError }, { data: savedPlaces, error: savedError }, { data: preferences }] = await Promise.all([
        db.from("commuter_board_campaigns").select("id,type,title,description,icon,cta_text,cta_action,priority,targeting_rules,start_date,end_date,active,display_duration").eq("active", true).order("priority", { ascending: false }).limit(50),
        db.from("rider_saved_places").select("place_type,label").eq("user_id", user!.id),
        db.from("rider_commuter_preferences").select("usual_days,usual_departure_time,usual_return_time").eq("user_id", user!.id).maybeSingle(),
      ]);
      if (campaignError || savedError) throw new Error("commuter board campaigns query failed");
      const homeLabels = new Set((savedPlaces ?? []).filter(place => place.place_type === "home").map(place => String(place.label).toLocaleLowerCase("ar")));
      const workLabels = new Set((savedPlaces ?? []).filter(place => place.place_type === "work").map(place => String(place.label).toLocaleLowerCase("ar")));
      const days = new Set((preferences?.usual_days ?? [0,1,2,3,4]).map(Number));
      const cards = (campaigns ?? []).filter(card => {
        const starts = card.start_date ? Date.parse(String(card.start_date)) : Number.NEGATIVE_INFINITY;
        const ends = card.end_date ? Date.parse(String(card.end_date)) : Number.POSITIVE_INFINITY;
        if (starts > now || ends <= now) return false;
        const rules = card.targeting_rules && typeof card.targeting_rules === "object" ? card.targeting_rules as Record<string, unknown> : {};
        const from = Array.isArray(rules.from_labels) ? rules.from_labels.map(value => String(value).toLocaleLowerCase("ar")) : [];
        const to = Array.isArray(rules.to_labels) ? rules.to_labels.map(value => String(value).toLocaleLowerCase("ar")) : [];
        const commuteDays = Array.isArray(rules.commute_days) ? rules.commute_days.map(Number) : [];
        const departure = String(preferences?.usual_departure_time ?? "07:30").slice(0, 5);
        return (!from.length || from.some(value => homeLabels.has(value))) && (!to.length || to.some(value => workLabels.has(value))) && (!commuteDays.length || commuteDays.some(value => days.has(value))) && (!rules.departure_after || departure >= String(rules.departure_after)) && (!rules.departure_before || departure <= String(rules.departure_before));
      }).map(card => ({ id: String(card.id), type: card.type, title: card.title, description: card.description, icon: card.icon, cta_text: card.cta_text, cta_action: card.cta_action, priority: Number(card.priority), targeting_rules: card.targeting_rules ?? {}, start_date: card.start_date, end_date: card.end_date, active: card.active, display_duration: Number(card.display_duration) }));
      return reply({ cards }, 200, origin);
    }
    const savedPlaceAction = path.match(/^\/rider\/saved-places\/(home|work)$/);
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
      const gate = await requireRole(user, ["rider", "captain"], origin); if (gate) return gate;
      const query = clean(body.query) ? body.query.trim().replace(/\s+/g, " ") : "";
      if (query.length < 3 || query.length > 120) return error("اكتب من ٣ إلى ١٢٠ حرفًا للبحث عن العنوان.", 400, origin);
      if (!await takeLimit(`location-search:user:${user!.id}`, 20, 300)) return error("استخدم البحث بعد دقائق؛ عدد المحاولات كبير.", 429, origin);
      return reply({ suggestions: await searchGreaterCairo(query) }, 200, origin);
    }
    if (req.method === "POST" && path === "/locations/search/precise") {
      const gate = await requireRole(user, ["rider", "captain"], origin); if (gate) return gate;
      const query = clean(body.query) ? body.query.trim().replace(/\s+/g, " ") : "";
      if (query.length < 3 || query.length > 120) return error("اكتب من ٣ إلى ١٢٠ حرفًا للبحث عن العنوان.", 400, origin);
      if (!await takeLimit(`location-precise:user:${user!.id}`, 10, 300)) return error("استخدم البحث الدقيق بعد دقائق؛ عدد المحاولات كبير.", 429, origin);
      return reply({ suggestions: await searchNominatimGreaterCairo(query) }, 200, origin);
    }
    if (req.method === "POST" && path === "/locations/reverse") {
      const gate = await requireRole(user, ["rider", "captain"], origin); if (gate) return gate;
      if (!validPoint(body.lat, body.lng) || !isGreaterCairoPoint(Number(body.lat), Number(body.lng))) return error("اختار نقطة صحيحة داخل القاهرة الكبرى.", 400, origin);
      if (!await takeLimit(`location-reverse:user:${user!.id}`, 30, 300)) return error("استخدم تحديد العنوان بعد دقائق؛ عدد المحاولات كبير.", 429, origin);
      return reply(await reverseGreaterCairo(Number(body.lat), Number(body.lng)), 200, origin);
    }
    if (req.method === "POST" && path === "/locations/resolve") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      return error("اختار العنوان من نتائج البحث الظاهرة.", 410, origin);
    }
    if (req.method === "POST" && path === "/auth/password-reset/telegram") {
      const suppliedPhone = typeof body.phone_number === "string" ? body.phone_number.trim() : "";
      const normalizedPhone = phoneE164(suppliedPhone);
      if (!normalizedPhone) return error("اكتب رقم هاتف صحيحًا.", 400, origin);
      const username = (Deno.env.get("TELEGRAM_BOT_USERNAME") ?? "").replace(/^@/, "");
      if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) return error("خدمة استعادة كلمة السر غير مهيأة بعد.", 503, origin);
      const phoneHash = await keyedDigest(normalizedPhone);
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
      if (!await takeLimit(`password-reset:ip:${ip}`, 5, 900) || !await takeLimit(`password-reset:phone:${phoneHash}`, 3, 3600)) return error("وصلت للحد المؤقت لطلبات الاستعادة. حاول مرة أخرى بعد قليل.", 429, origin);
      await db.from("telegram_password_reset_challenges").update({ status: "expired" }).eq("phone_hash", phoneHash).in("status", ["waiting_start", "waiting_contact", "code_sent"]);
      const token = randomUrlToken(24);
      const { error: insertError } = await db.from("telegram_password_reset_challenges").insert({ token_hash: await digest(token), phone_hash: phoneHash });
      if (insertError) throw insertError;
      return reply({ reset_url: `https://t.me/${username}?start=reset_${token}` }, 200, origin);
    }
    if (req.method === "POST" && path === "/auth/password-reset/complete") {
      const phone = typeof body.phone_number === "string" ? phoneE164(body.phone_number) : null;
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const nextPassword = typeof body.new_password === "string" ? body.new_password : "";
      if (!phone || !/^\d{6}$/.test(code) || nextPassword.length < 8 || nextPassword.length > 128) return error("أدخل رقم الهاتف والرمز المكوّن من ٦ أرقام وكلمة سر من ٨ إلى ١٢٨ حرفًا.", 400, origin);
      const phoneHash = await keyedDigest(phone);
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
      if (!await takeLimit(`password-reset-complete:ip:${ip}`, 10, 900) || !await takeLimit(`password-reset-complete:phone:${phoneHash}`, 5, 900)) return error("محاولات كثيرة. ابدأ استعادة جديدة بعد قليل.", 429, origin);
      const { data: challenges, error: queryError } = await db.from("telegram_password_reset_challenges").select("token_hash,code_hash,attempts").eq("phone_hash", phoneHash).eq("status", "code_sent").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
      if (queryError) throw queryError;
      const challenge = challenges?.[0];
      if (!challenge) return error("رمز الاستعادة غير صالح أو انتهت صلاحيته. ابدأ طلبًا جديدًا.", 400, origin);
      const suppliedHash = await keyedDigest(`${phoneHash}:${code}`);
      if (suppliedHash !== challenge.code_hash) {
        const attempts = Number(challenge.attempts ?? 0) + 1;
        await db.from("telegram_password_reset_challenges").update({ attempts, status: attempts >= 5 ? "locked" : "code_sent" }).eq("token_hash", challenge.token_hash).eq("attempts", challenge.attempts).eq("status", "code_sent");
        return error(attempts >= 5 ? "تم إيقاف هذا الرمز. ابدأ طلب استعادة جديدًا." : "رمز التحقق غير صحيح.", 400, origin);
      }
      const { data: consumed, error: consumeError } = await db.from("telegram_password_reset_challenges").update({ status: "used", used_at: new Date().toISOString() }).eq("token_hash", challenge.token_hash).eq("code_hash", challenge.code_hash).eq("attempts", challenge.attempts).eq("status", "code_sent").select("token_hash").maybeSingle();
      if (consumeError) throw consumeError;
      if (!consumed) return error("تم استخدام هذا الرمز بالفعل. ابدأ طلبًا جديدًا.", 409, origin);
      const { data: account, error: accountError } = await db.from("users").select("id").in("phone_number", phoneCandidates(phone)).maybeSingle();
      if (accountError) throw accountError;
      if (!account) return error("تعذر إكمال الاستعادة. ابدأ طلبًا جديدًا.", 400, origin);
      const { error: updateError } = await db.from("users").update({ password_hash: await hashPassword(nextPassword), password_changed_at: new Date().toISOString() }).eq("id", account.id);
      if (updateError) throw updateError;
      const { error: sessionsError } = await db.from("sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", account.id).is("revoked_at", null);
      if (sessionsError) throw sessionsError;
      return reply({ success: true }, 200, origin);
    }
    if (req.method === "POST" && path === "/auth/register") {
      const { full_name, phone_number, password, role } = body;
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
      const phone = typeof phone_number === "string" ? phone_number.trim().slice(0, 100) : "";
      if (!await takeLimit(`register:ip:${ip}`, 10, 3600) || !await takeLimit(`register:phone:${phone}`, 5, 3600)) {
        return error("تم إنشاء حسابات كثيرة مؤخرًا من هذا الجهاز أو الرقم. حاول بعد ساعة.", 429, origin);
      }
      if (!clean(full_name) || String(full_name).trim().length > 100 || !clean(phone_number) || String(phone_number).trim().length > 32 || !clean(password)) return error("بيانات الحساب غير صحيحة. تأكد من الاسم ورقم الهاتف وطول كلمة السر.", 400, origin);
      if (!["rider", "captain"].includes(String(role))) return error("نوع الحساب المطلوب مش متاح.", 400, origin);
      if (String(password).length < 8 || String(password).length > 128) return error("كلمة السر لازم تكون من ٨ إلى ١٢٨ حرفًا.", 400, origin);
      if (body.accepted_terms !== true || body.terms_version !== "2026-10-05" || body.privacy_version !== "2026-10-05") return error("اقرأ الشروط وسياسة الخصوصية ووافق عليهما قبل إنشاء الحساب.", 400, origin);
      const { data: existing } = await db.from("users").select("id").eq("phone_number", String(phone_number).trim()).maybeSingle();
      if (existing) return error("الرقم ده مسجّل قبل كده.", 409, origin);
      const { data, error: e } = await db.from("users").insert({ full_name: String(full_name).trim(), phone_number: String(phone_number).trim(), password_hash: await hashPassword(String(password)), role, terms_accepted_at: new Date().toISOString(), terms_version: "2026-10-05", privacy_version: "2026-10-05" }).select("id,full_name,phone_number,role,verified_at,created_at").single();
      if (e) return error("تعذر إنشاء الحساب؛ تأكد أن رقم الهاتف غير مسجل.", 409, origin);
      return reply({ user: data }, 201, origin);
    }
    if (req.method === "POST" && path === "/auth/login") {
      const phone = typeof body.phone_number === "string" ? body.phone_number.trim() : "";
      if (phone.length > 32 || String(body.password ?? "").length > 128) return error("رقم الهاتف أو كلمة السر غير صحيحة.", 400, origin);
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
      if (!await takeLimit(`login:${ip}:${phone}`, 5, 900)) return error("محاولات كتير في وقت قصير. حاول تاني بعد شوية.", 429, origin);
      const { data: record } = await db.from("users").select("id,full_name,phone_number,password_hash,role,verified_at,created_at").eq("phone_number", phone).is("deleted_at", null).maybeSingle();
      const valid = record ? await verifyPassword(String(body.password ?? ""), record.password_hash) : await verifyPassword(String(body.password ?? ""), "pbkdf2$310000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000");
      if (!record || !valid) return error("رقم الهاتف أو كلمة السر غلط.", 401, origin);
      const { data: accountControl, error: controlError } = await db.from("admin_user_controls").select("status").eq("user_id", record.id).maybeSingle();
      if (controlError) throw controlError;
      if (accountControl && accountControl.status !== "active") return error("الحساب موقوف حاليًا. تواصل مع خدمة العملاء للمساعدة.", 403, origin);
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
        if (!clean(body.current_password) || String(body.current_password).length > 128 || !clean(body.new_password) || String(body.new_password).length < 8 || String(body.new_password).length > 128) return error("بيانات كلمة السر غير صحيحة. يجب أن تكون الجديدة من ٨ إلى ١٢٨ حرفًا.", 400, origin);
        if (!await takeLimit(`password:${user.id}`, 5, 900)) return error("محاولات كتير في وقت قصير. حاول تاني بعد شوية.", 429, origin);
        const { data: row } = await db.from("users").select("password_hash").eq("id", user.id).single();
        if (!row || typeof row.password_hash !== "string" || !await verifyPassword(String(body.current_password), row.password_hash)) return error("كلمة السر الحالية غير صحيحة.", 401, origin);
        const { error: pe } = await db.from("users").update({ password_hash: await hashPassword(String(body.new_password)), password_changed_at: new Date().toISOString() }).eq("id", user.id);
        if (pe) throw pe;
        await db.from("sessions").update({ revoked_at: new Date().toISOString() }).eq("user_id", user.id).neq("token_hash", await digest(req.headers.get("authorization")!.replace(/^Bearer\s+/i, "")));
        return reply({ success: true, revoked_other_sessions: 1 }, 200, origin);
      }
    }

    if (req.method === "DELETE" && path === "/account") {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      if (!clean(body.current_password) || String(body.current_password).length > 128) return error("أدخل كلمة السر الحالية لتأكيد حذف الحساب.", 400, origin);
      if (!await takeLimit(`account-delete:${user.id}`, 3, 3600)) return error("محاولات حذف كثيرة. حاول مرة أخرى بعد قليل.", 429, origin);
      const { data: credentials, error: credentialError } = await db.from("users").select("password_hash").eq("id", user.id).is("deleted_at", null).maybeSingle();
      if (credentialError) throw credentialError;
      if (!credentials || !await verifyPassword(String(body.current_password), credentials.password_hash)) return error("كلمة السر الحالية غير صحيحة.", 401, origin);
      try { await deleteAccountData(user.id, user.id, null); }
      catch (deletionError) {
        const message = deletionError instanceof Error ? deletionError.message : "";
        if (message.includes("finish or cancel active trips")) return error("أنه مشاويرك النشطة أو ألغها قبل حذف الحساب.", 409, origin);
        if (message.includes("protected super administrator")) return error("لا يمكن حذف حساب مسؤول النظام المحمي.", 403, origin);
        if (message.includes("account not found")) return error("الحساب غير موجود أو سبق حذفه.", 404, origin);
        throw deletionError;
      }
      return reply({ success: true }, 200, origin);
    }

    if (path === "/rider/requests") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      if (req.method === "POST") {
        const activationGate = await requireVerificationActivation(user!, origin); if (activationGate) return activationGate;
        if (!clean(body.service_category_id) || !validPoint(body.pickup_lat, body.pickup_lng) || !validPoint(body.dropoff_lat, body.dropoff_lng)) return error("فئة الخدمة أو إحداثيات الرحلة غير صحيحة.", 400, origin);
        const { data: request, error: insertError } = await db.from("daily_commute_requests").insert({ rider_user_id: user!.id, service_category_id: body.service_category_id, pickup_lat: body.pickup_lat, pickup_lng: body.pickup_lng, dropoff_lat: body.dropoff_lat, dropoff_lng: body.dropoff_lng }).select().single();
        if (insertError) throw insertError;
        const result = await automaticMatch(request);
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
    if (path === "/rider/demand-requests") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      if (req.method === "POST") {
        const activationGate = await requireVerificationActivation(user!, origin); if (activationGate) return activationGate;
        if (!(["private_car", "hiace"].includes(String(body.vehicle_type_id))) || !validIsoDate(body.trip_date) || String(body.trip_date) < cairoDateKey() || normalizeClock(body.arrival_time) !== body.arrival_time || !clean(body.pickup_label) || !clean(body.dropoff_label) || !validPoint(body.pickup_lat, body.pickup_lng) || !validPoint(body.dropoff_lat, body.dropoff_lng) || !isGreaterCairoPoint(Number(body.pickup_lat), Number(body.pickup_lng)) || !isGreaterCairoPoint(Number(body.dropoff_lat), Number(body.dropoff_lng))) return error("راجع نوع المركبة والتاريخ والوقت ونقطتي الركوب والوصول داخل القاهرة الكبرى.", 400, origin);
        const { data, error: createError } = await db.rpc("create_demand_request", { actor_id: user!.id, vehicle_id: body.vehicle_type_id, trip_on: body.trip_date, arrives: body.arrival_time, pickup_name: body.pickup_label.trim(), pickup_y: body.pickup_lat, pickup_x: body.pickup_lng, dropoff_name: body.dropoff_label.trim(), dropoff_y: body.dropoff_lat, dropoff_x: body.dropoff_lng, seat_count: Number(body.seats ?? 1) });
        if (createError) {
          if (createError.code === "42501") return error("يلزم توثيق الحساب ورقم الهاتف لإرسال طلب الرحلة.", 403, origin);
          throw createError;
        }
        const request = Array.isArray(data) ? data[0] : data;
        const [{ data: group }, { data: vehicle }] = await Promise.all([
          db.from("demand_groups").select("id,status,captain_line_id").eq("id", request.demand_group_id).maybeSingle(),
          db.from("vehicle_types").select("id,name_ar").eq("id", request.vehicle_type_id).maybeSingle(),
        ]);
        let line = null;
        if (group?.captain_line_id) {
          const { data: found } = await db.from("captain_lines").select("id,captain_user_id,origin_label,destination_label,arrival_time,seats,price_per_seat").eq("id", group.captain_line_id).maybeSingle();
          const { data: captain } = found ? await db.from("users").select("full_name").eq("id", found.captain_user_id).maybeSingle() : { data: null };
          line = found ? { id: found.id, origin_label: found.origin_label, destination_label: found.destination_label, arrival_time: found.arrival_time, seats: found.seats, price_per_seat: found.price_per_seat, captain_name: captain?.full_name ?? "الكابتن" } : null;
        }
        return reply({ request, demand_group: group, vehicle, line }, 201, origin);
      }
      if (req.method === "GET") {
        const { data, error: queryError } = await db.from("demand_requests").select("*,demand_groups(status,captain_line_id)").eq("rider_user_id", user!.id).order("created_at", { ascending: false }).limit(50);
        if (queryError) throw queryError;
        const requests = [];
        for (const item of data ?? []) {
          const group = Array.isArray(item.demand_groups) ? item.demand_groups[0] : item.demand_groups;
          let line = null;
          if (group?.captain_line_id) {
            const { data: found, error: lineError } = await db.from("captain_lines").select("id,captain_user_id,origin_label,destination_label,arrival_time,price_per_seat").eq("id", group.captain_line_id).maybeSingle();
            if (lineError) throw lineError;
            const { data: captain } = found ? await db.from("users").select("full_name").eq("id", found.captain_user_id).maybeSingle() : { data: null };
            line = found ? { origin_label: found.origin_label, destination_label: found.destination_label, arrival_time: found.arrival_time, price_per_seat: found.price_per_seat, captain_name: captain?.full_name ?? "الكابتن" } : null;
          }
          requests.push({ ...item, demand_groups: group ?? null, line });
        }
        return reply({ requests }, 200, origin);
      }
    }
    if (req.method === "POST" && path === "/rider/lines/search") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      if (!(["private_car", "hiace"].includes(String(body.vehicle_type_id))) || !validIsoDate(body.trip_date) || String(body.trip_date) < cairoDateKey() || normalizeClock(body.arrival_time) !== body.arrival_time || !validPoint(body.pickup_lat, body.pickup_lng) || !validPoint(body.dropoff_lat, body.dropoff_lng) || !isGreaterCairoPoint(Number(body.pickup_lat), Number(body.pickup_lng)) || !isGreaterCairoPoint(Number(body.dropoff_lat), Number(body.dropoff_lng))) return error("راجع بيانات البحث عن المسار.", 400, origin);
      const day = new Date(`${body.trip_date}T12:00:00Z`).getUTCDay();
      const { data: config, error: configError } = await db.from("app_config").select("config_key,numeric_value").in("config_key", ["demand_route_radius_km", "demand_arrival_window_minutes"]);
      if (configError) throw configError;
      const radiusKm = Number(config?.find((item) => item.config_key === "demand_route_radius_km")?.numeric_value);
      const arrivalWindow = Number(config?.find((item) => item.config_key === "demand_arrival_window_minutes")?.numeric_value);
      if (!Number.isFinite(radiusKm) || !Number.isFinite(arrivalWindow)) return error("إعدادات البحث غير متاحة الآن.", 503, origin);
      const { data: lines, error: searchError } = await db.from("captain_lines").select("id,vehicle_type_id,origin_label,origin_lat,origin_lng,destination_label,destination_lat,destination_lng,intermediate_stops,arrival_time,service_days,seats,price_per_seat,payment_methods,status").eq("status", "active").eq("vehicle_type_id", body.vehicle_type_id).contains("service_days", [day]).limit(100);
      if (searchError) throw searchError;
      const lineIds = (lines ?? []).map((line) => Number(line.id));
      const usedSeats = new Map<number, number>();
      if (lineIds.length) {
        const { data: matchedGroups, error: matchedError } = await db.from("demand_groups").select("id,captain_line_id").in("captain_line_id", lineIds).eq("trip_date", body.trip_date).eq("status", "matched");
        if (matchedError) throw matchedError;
        const groupIds = (matchedGroups ?? []).map((group) => Number(group.id));
        if (groupIds.length) {
          const { data: requests, error: requestsError } = await db.from("demand_requests").select("demand_group_id,seats").in("demand_group_id", groupIds);
          if (requestsError) throw requestsError;
          const ownerByGroup = new Map((matchedGroups ?? []).map((group) => [Number(group.id), Number(group.captain_line_id)]));
          for (const request of requests ?? []) { const lineId = ownerByGroup.get(Number(request.demand_group_id)); if (lineId) usedSeats.set(lineId, (usedSeats.get(lineId) ?? 0) + Number(request.seats)); }
        }
      }
      const pickup = { lat: Number(body.pickup_lat), lng: Number(body.pickup_lng) }, dropoff = { lat: Number(body.dropoff_lat), lng: Number(body.dropoff_lng) };
      const arrivalMinutes = Number(String(body.arrival_time).slice(0, 2)) * 60 + Number(String(body.arrival_time).slice(3, 5));
      const matches = (lines ?? []).map((line) => {
        const pickupDistanceKm = distanceKm(pickup, { lat: Number(line.origin_lat), lng: Number(line.origin_lng) });
        const dropoffDistanceKm = distanceKm(dropoff, { lat: Number(line.destination_lat), lng: Number(line.destination_lng) });
        const lineMinutes = Number(String(line.arrival_time).slice(0, 2)) * 60 + Number(String(line.arrival_time).slice(3, 5));
        const timeDiff = Math.min(Math.abs(arrivalMinutes - lineMinutes), 1440 - Math.abs(arrivalMinutes - lineMinutes));
        return { ...line, seats_available: Number(line.seats) - (usedSeats.get(Number(line.id)) ?? 0), pickup_distance_km: Math.round(pickupDistanceKm * 100) / 100, dropoff_distance_km: Math.round(dropoffDistanceKm * 100) / 100, arrival_difference_minutes: timeDiff };
      }).filter((line) => line.seats_available > 0 && line.pickup_distance_km <= radiusKm && line.dropoff_distance_km <= radiusKm && line.arrival_difference_minutes <= arrivalWindow).sort((a, b) => a.pickup_distance_km + a.dropoff_distance_km - b.pickup_distance_km - b.dropoff_distance_km).slice(0, 20);
      return reply({ lines: matches }, 200, origin);
    }
    const dailyMatch = path.match(/^\/rider\/requests\/(\d+)\/match$/);
    if (req.method === "POST" && dailyMatch) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const { data: request, error: queryError } = await db.from("daily_commute_requests").select("*").eq("id", dailyMatch[1]).maybeSingle();
      if (queryError) throw queryError;
      if (!request) return error("الطلب ده مش موجود.", 404, origin);
      if (Number(request.rider_user_id) !== user!.id) return error("الطلب ده مش بتاعك.", 403, origin);
      const result = await automaticMatch(request);
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
    if (req.method === "POST" && path === "/rider/pool/discover") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      if (!validPoint(body.pickup_lat, body.pickup_lng) || !validPoint(body.dropoff_lat, body.dropoff_lng) || !isGreaterCairoPoint(Number(body.pickup_lat), Number(body.pickup_lng)) || !isGreaterCairoPoint(Number(body.dropoff_lat), Number(body.dropoff_lng))) {
        return error("حدد نقطتي ركوب ووصول داخل القاهرة الكبرى.", 400, origin);
      }
      const [{ data: groups, error: groupsError }, { data: memberships, error: membershipsError }] = await Promise.all([
        db.from("pool_groups").select("id,category_id,package_type,service_dates,morning_departure,return_departure,status,route_distance_km,route_duration_min,seat_day_fare,route_geometry,route_version,created_at").eq("status", "waiting").order("created_at", { ascending: false }).limit(100),
        db.from("pool_members").select("group_id").eq("rider_user_id", user!.id).in("status", ["active", "awaiting_confirmation"]),
      ]);
      if (groupsError || membershipsError) throw new Error("route discovery query failed");
      const groupIds = (groups ?? []).map((group) => Number(group.id));
      if (!groupIds.length) return reply({ matches: [] }, 200, origin);
      const categoryIds = [...new Set((groups ?? []).map((group) => group.category_id))];
      const [{ data: members, error: membersError }, { data: categories, error: categoriesError }] = await Promise.all([
        db.from("pool_members").select("group_id,rider_user_id,seats_reserved").in("group_id", groupIds).eq("status", "active"),
        db.from("pool_categories").select("id,seats").in("id", categoryIds),
      ]);
      if (membersError || categoriesError) throw new Error("route discovery detail query failed");
      const existingIds = new Set((memberships ?? []).map((membership) => Number(membership.group_id)));
      const capacityByCategory = new Map((categories ?? []).map((category) => [String(category.id), Number(category.seats)]));
      const membersByGroup = new Map<number, typeof members>();
      for (const member of members ?? []) {
        const groupId = Number(member.group_id), list = membersByGroup.get(groupId) ?? [];
        list.push(member); membersByGroup.set(groupId, list);
      }
      const pickup = { lat: Number(body.pickup_lat), lng: Number(body.pickup_lng) }, dropoff = { lat: Number(body.dropoff_lat), lng: Number(body.dropoff_lng) };
      const matches = [] as { group: Json; seats_available: number; pickup_distance_km: number; dropoff_distance_km: number; score: number }[];
      for (const group of groups ?? []) {
        const id = Number(group.id);
        if (existingIds.has(id)) continue;
        const capacity = capacityByCategory.get(String(group.category_id));
        const activeMembers = membersByGroup.get(id) ?? [];
        if (!capacity) continue;
        const seatsUsed = activeMembers.reduce((total, member) => total + Number(member.seats_reserved), 0);
        const seatsAvailable = capacity - seatsUsed;
        if (seatsAvailable <= 0) continue;
        const geometry = group.route_geometry && typeof group.route_geometry === "object" ? group.route_geometry as Json : null;
        const outbound = geometry?.outbound && typeof geometry.outbound === "object" ? geometry.outbound as Json : null;
        const coordinates = outbound?.coordinates;
        const pickupDistance = lineDistanceKm(pickup, coordinates), dropoffDistance = lineDistanceKm(dropoff, coordinates);
        if (pickupDistance > 3 || dropoffDistance > 3) continue;
        const normalizedDates = Array.isArray(group.service_dates) ? JSON.stringify(group.service_dates) : String(group.service_dates);
        const publicGroup: Json = { id, category_id: group.category_id, package_type: group.package_type, service_dates: normalizedDates, morning_departure: group.morning_departure, return_departure: group.return_departure, status: group.status, route_distance_km: group.route_distance_km, route_duration_min: group.route_duration_min, seat_day_fare: group.seat_day_fare, route_version: group.route_version ?? 1, fixed_captain_user_id: null, route_geometry: null };
        matches.push({ group: publicGroup, seats_available: seatsAvailable, pickup_distance_km: Math.round(pickupDistance * 100) / 100, dropoff_distance_km: Math.round(dropoffDistance * 100) / 100, score: pickupDistance + dropoffDistance });
      }
      matches.sort((a, b) => a.score - b.score || Number(a.group.id) - Number(b.group.id));
      return reply({ matches: matches.slice(0, 10).map(({ score: _score, ...match }) => match) }, 200, origin);
    }
    if (req.method === "POST" && path === "/rider/pool/groups") {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      return error("لم يعد الراكب ينشئ مجموعة. أرسل طلب رحلة فرديًا، وسيتولى التطبيق تجميع الطلبات المتشابهة.", 410, origin);
    }
    const editGroupMatch = path.match(/^\/rider\/pool\/groups\/(\d+)$/);
    if (req.method === "PUT" && editGroupMatch) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const groupId = Number(editGroupMatch[1]);
      const group = await getGroup(groupId);
      if (!group) return error("المجموعة غير موجودة.", 404, origin);
      if (Number(group.created_by_user_id) !== user!.id) return error("يمكن لصاحب المجموعة تعديل المشوار فقط.", 403, origin);
      if (group.status !== "waiting") return error("يمكن تعديل المشوار قبل اكتمال المجموعة فقط.", 409, origin);
      const members = await getMembers(groupId);
      if (members.length !== 1 || Number(members[0].rider_user_id) !== user!.id) return error("لا يمكن تعديل المشوار بعد انضمام ركاب آخرين.", 409, origin);
      const [tripCheck, subscriptionCheck] = await Promise.all([
        db.from("pool_trips").select("id").eq("group_id", groupId).limit(1),
        db.from("pool_subscriptions").select("id").eq("group_id", groupId).limit(1),
      ]);
      if (tripCheck.error || subscriptionCheck.error) throw tripCheck.error ?? subscriptionCheck.error;
      if (tripCheck.data?.length || subscriptionCheck.data?.length) return error("لا يمكن تعديل مشوار بدأ تفعيله.", 409, origin);
      const { category_id, package_type, service_dates, morning_departure, return_departure } = body;
      const dates = validDates(service_dates, String(package_type));
      if (!clean(category_id) || !dates || !/^\d{2}:\d{2}$/.test(String(morning_departure)) || !/^\d{2}:\d{2}$/.test(String(return_departure)) || String(return_departure) <= String(morning_departure)) return error("راجع الفئة والأيام ومواعيد الذهاب والعودة.", 400, origin);
      let pickup, dropoff;
      try { pickup = await selectLocation(body, "pickup"); dropoff = await selectLocation(body, "dropoff"); }
      catch (err) { if (err instanceof ApiFailure) return error(err.message, err.status, origin); throw err; }
      const { data: category } = await db.from("pool_categories").select("*").eq("id", category_id).maybeSingle();
      if (!category) return error("فئة الرحلة غير موجودة.", 404, origin);
      const member = members[0];
      const updatedMember = { ...member, pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_place_id: pickup.place_id, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, dropoff_place_id: dropoff.place_id };
      let q; try { q = await quote([updatedMember], category); }
      catch (err) { if (err instanceof ApiFailure) return error(err.message, err.status, origin); return error("خدمة حساب المسار غير متاحة حاليًا.", 503, origin); }
      const memberPatch = { pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_place_id: pickup.place_id, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, dropoff_place_id: dropoff.place_id };
      const { error: memberUpdateError } = await db.from("pool_members").update(memberPatch).eq("id", member.id).eq("status", "active");
      if (memberUpdateError) throw memberUpdateError;
      const { data: updatedGroup, error: groupUpdateError } = await db.from("pool_groups").update({
        category_id, package_type, service_dates: dates, morning_departure: morning_departure + ":00",
        return_departure: return_departure + ":00", route_distance_km: q.out.distanceKm,
        route_duration_min: q.out.durationMin, seat_day_fare: q.seatDayFare, route_geometry: q.geometry,
        updated_at: new Date().toISOString(),
      }).eq("id", groupId).eq("created_by_user_id", user!.id).eq("status", "waiting").select().maybeSingle();
      if (groupUpdateError || !updatedGroup) {
        await db.from("pool_members").update({
          pickup_lat: member.pickup_lat, pickup_lng: member.pickup_lng, pickup_place_id: member.pickup_place_id,
          dropoff_lat: member.dropoff_lat, dropoff_lng: member.dropoff_lng, dropoff_place_id: member.dropoff_place_id,
        }).eq("id", member.id);
        if (groupUpdateError) throw groupUpdateError;
        return error("تغيرت حالة المشوار؛ حدّث الصفحة وحاول مرة أخرى.", 409, origin);
      }
      return reply(await groupView({ ...updatedGroup, current_rider_id: user!.id }), 200, origin);
    }
    const joinMatch = path.match(/^\/rider\/pool\/groups\/(\d+)\/join$/);
    if (req.method === "POST" && joinMatch) {
      const gate = await requireRole(user, ["rider"], origin); if (gate) return gate;
      const activationGate = await requireVerificationActivation(user!, origin); if (activationGate) return activationGate;
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
      if (body.action === "accept") { const activationGate = await requireVerificationActivation(user!, origin); if (activationGate) return activationGate; }
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
      const privateKey = Deno.env.get("SEKKA_VAPID_PRIVATE_KEY") ?? "";
      const subject = Deno.env.get("SEKKA_VAPID_SUBJECT") ?? "";
      if (!publicKey || !privateKey || !subject) return error("إشعارات الجهاز غير مهيأة على الخادم.", 503, origin);
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

    if (req.method === "GET" && path === "/messages/contacts") {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      if (user.role === "admin") return reply({ contacts: [] }, 200, origin);
      const contactIds = await getDirectMessageContactIds(user.id);
      if (!contactIds.length) return reply({ contacts: [] }, 200, origin);
      const { data: contacts, error: contactsError } = await db.from("users").select("id,full_name,role,avatar_path").in("id", contactIds).is("deleted_at", null).order("full_name");
      if (contactsError) throw contactsError;
      return reply({ contacts: contacts ?? [] }, 200, origin);
    }
    if (req.method === "GET" && path === "/messages/conversations") {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      const { data: rows, error: conversationsError } = await db.from("message_conversations")
        .select("id,participant_low_id,participant_high_id,last_message_at,last_message_body,last_message_sender_id,unread_low,unread_high,created_at")
        .or(`participant_low_id.eq.${user.id},participant_high_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).limit(100);
      if (conversationsError) throw conversationsError;
      const conversationRows = rows ?? [];
      const otherUserIds = [...new Set(conversationRows.map((row) => Number(row.participant_low_id) === user.id ? Number(row.participant_high_id) : Number(row.participant_low_id)))];
      const { data: contacts, error: usersError } = otherUserIds.length
        ? await db.from("users").select("id,full_name,role,avatar_path").in("id", otherUserIds).is("deleted_at", null)
        : { data: [], error: null };
      if (usersError) throw usersError;
      const byId = new Map((contacts ?? []).map((contact) => [Number(contact.id), contact]));
      const conversations = conversationRows.flatMap((row) => {
        const otherUserId = Number(row.participant_low_id) === user.id ? Number(row.participant_high_id) : Number(row.participant_low_id);
        const contact = byId.get(otherUserId);
        return contact ? [{ ...row, other_user: contact, unread_count: Number(row.participant_low_id) === user.id ? row.unread_low : row.unread_high }] : [];
      });
      return reply({ conversations, unread_total: conversations.reduce((sum, row) => sum + Number(row.unread_count), 0) }, 200, origin);
    }
    if (req.method === "POST" && path === "/messages/conversations") {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      const recipientId = Number(body.recipient_user_id);
      if (!Number.isSafeInteger(recipientId) || recipientId < 1 || recipientId === user.id) return error("اختار مستخدمًا صحيحًا لبدء المحادثة.", 400, origin);
      if (user.role === "admin" || !(await getDirectMessageContactIds(user.id)).includes(recipientId)) return error("يمكنك مراسلة مستخدم شاركك رحلة أو مجموعة فقط.", 403, origin);
      const { data: recipient, error: recipientError } = await db.from("users").select("id").eq("id", recipientId).is("deleted_at", null).maybeSingle();
      if (recipientError) throw recipientError;
      if (!recipient) return error("المستخدم غير موجود.", 404, origin);
      const participantLowId = Math.min(user.id, recipientId), participantHighId = Math.max(user.id, recipientId);
      const { data: existing, error: lookupError } = await db.from("message_conversations").select("id").eq("participant_low_id", participantLowId).eq("participant_high_id", participantHighId).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) return reply({ conversation: existing }, 200, origin);
      const { data: conversation, error: createError } = await db.from("message_conversations").insert({ participant_low_id: participantLowId, participant_high_id: participantHighId }).select("id").single();
      if (createError?.code === "23505") {
        const { data: concurrent, error: concurrentError } = await db.from("message_conversations").select("id").eq("participant_low_id", participantLowId).eq("participant_high_id", participantHighId).single();
        if (concurrentError) throw concurrentError;
        return reply({ conversation: concurrent }, 200, origin);
      }
      if (createError) throw createError;
      return reply({ conversation }, 201, origin);
    }
    const directMessageHistory = path.match(/^\/messages\/conversations\/(\d+)\/messages$/);
    if (req.method === "GET" && directMessageHistory) {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      const conversationId = Number(directMessageHistory[1]);
      const { data: conversation, error: conversationError } = await db.from("message_conversations").select("id").eq("id", conversationId).or(`participant_low_id.eq.${user.id},participant_high_id.eq.${user.id}`).maybeSingle();
      if (conversationError) throw conversationError;
      if (!conversation) return error("المحادثة غير موجودة.", 404, origin);
      const beforeRaw = url.searchParams.get("before_id");
      const beforeId = beforeRaw === null ? null : Number(beforeRaw);
      if (beforeRaw !== null && (!Number.isSafeInteger(beforeId) || beforeId! < 1)) return error("مؤشر الرسائل غير صالح.", 400, origin);
      let query = db.from("direct_messages").select("id,conversation_id,sender_user_id,body,created_at,read_at").eq("conversation_id", conversationId);
      if (beforeId !== null) query = query.lt("id", beforeId);
      const { data: messages, error: messagesError } = await query.order("id", { ascending: false }).limit(100);
      if (messagesError) throw messagesError;
      return reply({ messages: (messages ?? []).reverse(), has_older: (messages ?? []).length === 100 }, 200, origin);
    }
    const directMessageRead = path.match(/^\/messages\/conversations\/(\d+)\/read$/);
    if (req.method === "POST" && directMessageRead) {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      const conversationId = Number(directMessageRead[1]);
      const { data: conversation, error: conversationError } = await db.from("message_conversations").select("id").eq("id", conversationId).or(`participant_low_id.eq.${user.id},participant_high_id.eq.${user.id}`).maybeSingle();
      if (conversationError) throw conversationError;
      if (!conversation) return error("المحادثة غير موجودة.", 404, origin);
      const { data: markedCount, error: markError } = await db.rpc("mark_direct_messages_read", { p_user_id: user.id, p_conversation_id: conversationId });
      if (markError) throw markError;
      return reply({ marked_count: markedCount }, 200, origin);
    }
    if (req.method === "POST" && directMessageHistory) {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      if (!clean(body.body) || body.body.trim().length > 2000) return error("اكتب رسالة من حرف واحد إلى 2000 حرف.", 400, origin);
      if (!await takeLimit(`direct-message-send:${user.id}`, 30, 60)) return error("أرسلت رسائل كثيرة في وقت قصير. حاول بعد قليل.", 429, origin);
      const conversationId = Number(directMessageHistory[1]);
      const { data: conversation, error: conversationError } = await db.from("message_conversations").select("id").eq("id", conversationId).or(`participant_low_id.eq.${user.id},participant_high_id.eq.${user.id}`).maybeSingle();
      if (conversationError) throw conversationError;
      if (!conversation) return error("المحادثة غير موجودة.", 404, origin);
      const { data: message, error: sendError } = await db.rpc("send_direct_message", { p_sender_user_id: user.id, p_conversation_id: conversationId, p_body: body.body.trim() });
      if (sendError) throw sendError;
      return reply({ message: Array.isArray(message) ? message[0] : message }, 201, origin);
    }

    if (req.method === "GET" && path === "/pool/notifications") {
      if (!user) return error("سجّل الدخول أولًا.", 401, origin);
      const { data, error: e } = await db.from("pool_notifications").select("*").eq("user_id", user.id).is("deleted_at", null).order("id", { ascending: false }).limit(100);
      if (e) throw e; return reply({ notifications: data }, 200, origin);
    }
    const readNotice = path.match(/^\/pool\/notifications\/(\d+)\/read$/);
    if (req.method === "POST" && readNotice && user) {
      await db.from("pool_notifications").update({ read_at: new Date().toISOString() }).eq("id", readNotice[1]).eq("user_id", user.id);
      return reply({ success: true }, 200, origin);
    }
    const deleteNotice = path.match(/^\/pool\/notifications\/(\d+)\/delete$/);
    if (req.method === "POST" && deleteNotice && user) {
      const { error: deleteError } = await db.from("pool_notifications").update({ deleted_at: new Date().toISOString() }).eq("id", deleteNotice[1]).eq("user_id", user.id).is("deleted_at", null);
      if (deleteError) throw deleteError;
      return reply({ deleted: true }, 200, origin);
    }
    const muteNotice = path.match(/^\/pool\/notifications\/(\d+)\/mute$/);
    if (req.method === "POST" && muteNotice && user) {
      const { data: notice, error: noticeError } = await db.from("pool_notifications").select("group_id").eq("id", muteNotice[1]).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
      if (noticeError) throw noticeError;
      if (!notice) return error("الإشعار غير موجود.", 404, origin);
      if (notice.group_id === null) return error("هذا الإشعار غير مرتبط بمشوار.", 400, origin);
      const { error: muteError } = await db.from("pool_notification_mutes").upsert({ user_id: user.id, group_id: notice.group_id }, { onConflict: "user_id,group_id", ignoreDuplicates: true });
      if (muteError) throw muteError;
      return reply({ muted: true, group_id: notice.group_id }, 200, origin);
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
      if (path === "/captain/lines" && req.method === "GET") {
        const { data, error: queryError } = await db.from("captain_lines").select("*").eq("captain_user_id", user!.id).order("created_at", { ascending: false });
        if (queryError) throw queryError;
        return reply({ lines: data ?? [] }, 200, origin);
      }
      if (path === "/captain/demand-groups" && req.method === "GET") {
        const { data: lines, error: linesError } = await db.from("captain_lines").select("id,origin_label,destination_label").eq("captain_user_id", user!.id);
        if (linesError) throw linesError;
        const lineIds = (lines ?? []).map((line) => Number(line.id));
        if (!lineIds.length) return reply({ groups: [] }, 200, origin);
        const { data: groups, error: groupsError } = await db.from("demand_groups").select("id,captain_line_id,vehicle_type_id,trip_date,arrival_time,status").in("captain_line_id", lineIds).eq("status", "matched").order("trip_date").order("arrival_time");
        if (groupsError) throw groupsError;
        const groupIds = (groups ?? []).map((group) => Number(group.id));
        if (!groupIds.length) return reply({ groups: [] }, 200, origin);
        const { data: requests, error: requestsError } = await db.from("demand_requests").select("id,demand_group_id,rider_user_id,pickup_label,dropoff_label,seats,status").in("demand_group_id", groupIds).in("status", ["open", "matched"]);
        if (requestsError) throw requestsError;
        const riderIds = [...new Set((requests ?? []).map((request) => Number(request.rider_user_id)))];
        const { data: riders, error: ridersError } = riderIds.length ? await db.from("users").select("id,full_name").in("id", riderIds) : { data: [], error: null };
        if (ridersError) throw ridersError;
        const riderNames = new Map((riders ?? []).map((rider) => [Number(rider.id), String(rider.full_name)]));
        return reply({ groups: (groups ?? []).map((group) => ({ ...group, requests: (requests ?? []).filter((request) => Number(request.demand_group_id) === Number(group.id)).map((request) => ({ ...request, rider_name: riderNames.get(Number(request.rider_user_id)) ?? "راكب" })) })) }, 200, origin);
      }
      if (path === "/captain/lines" && req.method === "POST") {
        const { data: profile, error: profileError } = await db.from("captain_profiles").select("vehicle_type_id,verification_status,status").eq("user_id", user!.id).maybeSingle();
        if (profileError) throw profileError;
        if (!profile || profile.verification_status !== "approved" || profile.status === "suspended_grace_expired" || !user!.verified_at) return error("يلزم اعتماد مستندات الكابتن وتوثيق الهاتف قبل نشر المسار.", 403, origin);
        const activationGate = await requireVerificationActivation(user!, origin); if (activationGate) return activationGate;
        const { data: vehicle, error: vehicleError } = await db.from("vehicle_types").select("capacity_max").eq("id", profile.vehicle_type_id).maybeSingle();
        if (vehicleError) throw vehicleError;
        const days = Array.isArray(body.service_days) ? body.service_days.map(Number) : [];
        const methods = Array.isArray(body.payment_methods) ? body.payment_methods.map(String) : [];
        const arrival = String(body.arrival_time ?? "");
        if (!vehicle || String(body.vehicle_type_id) !== String(profile.vehicle_type_id) || !clean(body.origin_label) || !clean(body.destination_label) || !validPoint(body.origin_lat, body.origin_lng) || !validPoint(body.destination_lat, body.destination_lng) || !isGreaterCairoPoint(Number(body.origin_lat), Number(body.origin_lng)) || !isGreaterCairoPoint(Number(body.destination_lat), Number(body.destination_lng)) || !/^\d{2}:\d{2}$/.test(arrival) || !days.length || days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || new Set(days).size !== days.length || !Number.isInteger(Number(body.seats)) || Number(body.seats) < 1 || Number(body.seats) > Number(vehicle.capacity_max) || !number(body.price_per_seat) || body.price_per_seat < 0 || !methods.length || methods.some((m) => !["cash", "instapay", "wallet"].includes(m))) return error("راجع المسار والأيام والمقاعد والسعر وطريقة الدفع.", 400, origin);
        const stops = Array.isArray(body.intermediate_stops) ? body.intermediate_stops.slice(0, 10) : [];
        if (stops.some((stop) => !stop || typeof stop.label !== "string" || !validPoint(stop.lat, stop.lng) || !isGreaterCairoPoint(Number(stop.lat), Number(stop.lng)))) return error("تأكد أن كل المحطات داخل القاهرة الكبرى.", 400, origin);
        const { data, error: createError } = await db.rpc("publish_captain_line", { actor_id: user!.id, vehicle_id: profile.vehicle_type_id, origin_name: body.origin_label.trim(), origin_y: body.origin_lat, origin_x: body.origin_lng, destination_name: body.destination_label.trim(), destination_y: body.destination_lat, destination_x: body.destination_lng, stops, arrival: `${arrival}:00`, days, seat_count: Number(body.seats), seat_price: body.price_per_seat, methods });
        if (createError) {
          if (createError.code === "42501") return error("يلزم اعتماد مستندات الكابتن وتوثيق الهاتف قبل نشر المسار.", 403, origin);
          throw createError;
        }
        return reply({ line: Array.isArray(data) ? data[0] : data }, 201, origin);
      }
      const lineStatus = path.match(/^\/captain\/lines\/(\d+)\/status$/);
      if (req.method === "PATCH" && lineStatus) {
        const { data, error: updateError } = await db.rpc("set_captain_line_status", { actor_id: user!.id, line_id: Number(lineStatus[1]), next_status: body.status });
        if (updateError) {
          if (updateError.code === "42501") return error("المسار غير موجود أو لا تملك صلاحية تعديله.", 403, origin);
          throw updateError;
        }
        return reply({ line: Array.isArray(data) ? data[0] : data }, 200, origin);
      }
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
        const { data: profile, error: profileError } = await db.from("captain_profiles").select("*").eq("user_id", user!.id).maybeSingle();
        if (profileError) throw profileError;
        if (profile?.status === "suspended_grace_expired") return error("توقف استقبال المسارات لانتهاء مهلة المستندات المؤجلة. أكمل رفعها ثم تواصل مع الدعم.", 403, origin);
        if (!profile || profile.verification_status !== "approved" || !user!.verified_at) return error("يلزم توثيق ملف المركبة والهاتف قبل عرض المسارات.", 403, origin);
        const activationGate = await requireVerificationActivation(user!, origin); if (activationGate) return activationGate;
        const [{ data: capability, error: capabilityError }, { data: stats, error: statsError }] = await Promise.all([
          db.from("pool_captain_capabilities").select("*").eq("captain_user_id", user!.id).maybeSingle(),
          db.from("pool_captain_stats").select("*").eq("captain_user_id", user!.id).maybeSingle(),
        ]);
        if (capabilityError || statsError) throw capabilityError ?? statsError;
        if (!capability || profile.current_lat == null || profile.current_lng == null) return reply({ offers: [] }, 200, origin);
        const { data: trips, error: tripsError } = await db.from("pool_trips").select("*").in("status", ["scheduled", "needs_captain"]).is("captain_user_id", null).gte("departure_at", new Date().toISOString()).order("departure_at").limit(100);
        if (tripsError) throw tripsError;
        const offers = [];
        for (const trip of trips ?? []) {
          const { data: group, error: groupError } = await db.from("pool_groups").select("*").eq("id", trip.group_id).maybeSingle();
          if (groupError) throw groupError;
          const { data: category, error: categoryError } = group ? await db.from("pool_categories").select("*").eq("id", group.category_id).maybeSingle() : { data: null, error: null };
          if (categoryError) throw categoryError;
          const { data: members, error: membersError } = group ? await db.from("pool_members").select("*").eq("group_id", group.id).eq("status", "active").order("pickup_order") : { data: [], error: null };
          if (membersError) throw membersError;
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
        const { data: commissionSetting, error: commissionError } = await db.from("admin_system_settings").select("numeric_value").eq("setting_key", "company_commission_rate").maybeSingle();
        if (commissionError) throw commissionError;
        const commissionRate = number(Number(commissionSetting?.numeric_value)) ? Number(commissionSetting!.numeric_value) : 0.2;
        const { data: members } = await db.from("pool_members").select("*").eq("group_id", trip.group_id).eq("status", "active");
        for (const m of members ?? []) {
          const listAmount = roundMoney(Number(group.seat_day_fare) * Number(m.seats_reserved));
          const discount = discountRate(group.package_type);
          const riderAmount = roundMoney(listAmount * (1 - discount));
          await db.from("pool_ledger").upsert({ trip_id: tripId, member_id: m.id, list_amount: listAmount, rider_amount: riderAmount, discount_amount: roundMoney(listAmount - riderAmount), captain_share_amount: roundMoney(listAmount * (1 - commissionRate)), company_share_amount: roundMoney(Math.max(0, listAmount * commissionRate - (listAmount - riderAmount))), company_commission_rate: commissionRate, settlement_status: "pending" }, { onConflict: "trip_id,member_id" });
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

      return error("مسار واجهة غير معروف ضمن خدمات الكابتن.", 404, origin);
    }
    const adminGate = path.startsWith("/admin/") ? await requireSuperAdmin(user, origin) : null;
    if (adminGate) return adminGate;
    if (req.method === "POST" && path === "/admin/verification/telegram-webhook") {
      const baseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
      if (!baseUrl || !Deno.env.get("TELEGRAM_BOT_TOKEN") || !/^[A-Za-z0-9_-]{32,256}$/.test(secret)) return error("أكمل إعداد TELEGRAM_BOT_TOKEN وTELEGRAM_WEBHOOK_SECRET في أسرار Supabase أولًا.", 503, origin);
      const hookUrl = `${baseUrl.replace(/\/$/, "")}/functions/v1/sekka-api/webhooks/telegram`;
      await telegramRequest("setWebhook", { url: hookUrl, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: false });
      await writeAdminAudit(user!.id, "verification.telegram_webhook_configured", "telegram_bot", "phone_verification", null);
      return reply({ success: true, webhook_url: hookUrl }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/verifications") {
      const status = url.searchParams.get("status") ?? "pending";
      const requestedUserId = url.searchParams.get("user_id");
      const userId = requestedUserId === null ? null : Number(requestedUserId);
      if (!(["pending", "approved", "rejected", "all"] as const).includes(status as "pending" | "approved" | "rejected" | "all")) return error("حالة التوثيق غير صحيحة.", 400, origin);
      let query = db.from("user_verifications").select("id,user_id,document_type,status,rejection_reason,uploaded_at,reviewed_at,reviewed_by").order("uploaded_at", { ascending: false }).limit(200);
      if (status !== "all") query = query.eq("status", status);
      if (requestedUserId !== null && (!Number.isSafeInteger(userId) || userId! < 1)) return error("رقم المستخدم غير صالح.", 400, origin);
      if (userId !== null) query = query.eq("user_id", userId);
      const { data: documents, error: documentsError } = await query;
      if (documentsError) throw documentsError;
      const userIds = [...new Set((documents ?? []).map((row) => row.user_id))];
      const { data: users, error: usersError } = userIds.length ? await db.from("users").select("id,full_name,phone_number,role,verified_at").in("id", userIds) : { data: [], error: null };
      if (usersError) throw usersError;
      const usersById = new Map((users ?? []).map((row) => [row.id, row]));
      return reply({ documents: (documents ?? []).map((row) => {
        const owner = usersById.get(row.user_id);
        return { ...row, document_label: verificationDocLabels[row.document_type] ?? row.document_type, user: owner ? { ...owner, phone_number: maskAdminIdentifier(owner.phone_number) } : null };
      }) }, 200, origin);
    }
    const adminVerificationFile = path.match(/^\/admin\/verifications\/(\d+)\/file$/);
    if (req.method === "GET" && adminVerificationFile) {
      const { data: document, error: documentError } = await db.from("user_verifications").select("object_path").eq("id", adminVerificationFile[1]).maybeSingle();
      if (documentError) throw documentError;
      if (!document) return error("المستند غير موجود.", 404, origin);
      const { data: signed, error: signedError } = await db.storage.from("verification-documents").createSignedUrl(document.object_path, 60);
      if (signedError) throw signedError;
      await writeAdminAudit(user!.id, "verification.document_viewed", "verification_document", String(adminVerificationFile[1]), null);
      return reply({ signed_url: signed.signedUrl, expires_in_seconds: 60 }, 200, origin);
    }
    const reviewVerification = path.match(/^\/admin\/verifications\/(\d+)\/review$/);
    if (req.method === "POST" && reviewVerification) {
      const rejectionReason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!["approved", "rejected"].includes(String(body.status)) || (body.status === "rejected" && (!rejectionReason || rejectionReason.length > 1000))) return error("اختر قرارًا واكتب سبب الرفض عند الحاجة.", 400, origin);
      const { data: document, error: reviewError } = await db.rpc("admin_review_user_verification", {
        p_actor_user_id: user!.id, p_verification_id: Number(reviewVerification[1]), p_status: body.status,
        p_rejection_reason: body.status === "rejected" ? rejectionReason : null,
      });
      if (reviewError) throw reviewError;
      return reply({ document }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/users") {
      const q = (url.searchParams.get("q") ?? "").trim().replace(/[^\p{L}\p{N}\s+\-]/gu, "").slice(0, 100);
      const role = url.searchParams.get("role");
      const requestedLimit = Number(url.searchParams.get("limit") ?? 25);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const status = url.searchParams.get("status") ?? "all";
      if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50 || !Number.isSafeInteger(offset) || offset < 0 || offset > 100_000 || !["all", "active", "suspended", "banned"].includes(status)) return error("إعدادات ترقيم المستخدمين غير صحيحة.", 400, origin);
      let filteredControlIds: number[] | null = null;
      if (status !== "all") {
        let controlsQuery = db.from("admin_user_controls").select("user_id");
        controlsQuery = status === "active" ? controlsQuery.neq("status", "active") : controlsQuery.eq("status", status);
        const { data: filteredControls, error: filteredControlsError } = await controlsQuery;
        if (filteredControlsError) throw filteredControlsError;
        filteredControlIds = (filteredControls ?? []).map((item) => item.user_id);
        if (status === "active" && filteredControlIds.length === 0) filteredControlIds = null;
      }
      let query = db.from("users").select("id,full_name,phone_number,role,verified_at,created_at", { count: "exact" }).is("deleted_at", null).order("created_at", { ascending: false }).range(offset, offset + requestedLimit - 1);
      if (["rider", "captain", "admin"].includes(String(role))) query = query.eq("role", role);
      if (filteredControlIds?.length) {
        if (status === "active") query = query.not("id", "in", `(${filteredControlIds.join(",")})`);
        else query = query.in("id", filteredControlIds);
      } else if (["suspended", "banned"].includes(status)) {
        return reply({ users: [], total: 0, offset, limit: requestedLimit, has_more: false }, 200, origin);
      }
      if (q) {
        query = query.or(`full_name.ilike.%${q}%,phone_number.ilike.%${q}%`);
      }
      const { data, count: total, error: userQueryError } = await query;
      if (userQueryError) throw userQueryError;
      const ids = (data ?? []).map((item) => item.id);
      const [controls, profiles] = await Promise.all([
        ids.length ? db.from("admin_user_controls").select("user_id,status,reason,updated_at").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? db.from("captain_profiles").select("user_id,vehicle_type_id,license_number,vehicle_plate,verification_status").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
      ]);
      if (controls.error || profiles.error) throw controls.error ?? profiles.error;
      const statusById = new Map((controls.data ?? []).map((item) => [item.user_id, item]));
      const profileById = new Map((profiles.data ?? []).map((item) => [item.user_id, item]));
      const users = (data ?? []).map((item) => {
        const captain = profileById.get(item.id);
        return { ...item, phone_number: maskAdminIdentifier(item.phone_number), account_status: statusById.get(item.id)?.status ?? "active", control: statusById.get(item.id) ?? null, captain: captain ? { ...captain, license_number: maskAdminIdentifier(captain.license_number) } : null };
      });
      return reply({ users, total: total ?? 0, offset, limit: requestedLimit, has_more: (total ?? 0) > offset + users.length }, 200, origin);
    }
    const userStatusRoute = path.match(/^\/admin\/users\/(\d+)\/status$/);
    if (req.method === "PATCH" && userStatusRoute) {
      if (!clean(body.reason) || body.reason.trim().length > 1000 || !["active", "suspended", "banned"].includes(String(body.status))) return error("حدد الحالة وسبب التغيير (حتى 1000 حرف).", 400, origin);
      const { data, error: statusError } = await db.rpc("admin_set_user_status", { p_actor_user_id: user!.id, p_target_user_id: Number(userStatusRoute[1]), p_status: body.status, p_reason: body.reason.trim() });
      if (statusError) throw statusError;
      return reply({ user_control: data }, 200, origin);
    }
    const userProfileRoute = path.match(/^\/admin\/users\/(\d+)$/);
    if (req.method === "DELETE" && userProfileRoute) {
      const targetUserId = Number(userProfileRoute[1]);
      const reason = clean(body.reason) ? body.reason.trim() : "";
      if (!Number.isSafeInteger(targetUserId) || targetUserId < 1) return error("رقم المستخدم غير صالح.", 400, origin);
      if (targetUserId === user!.id) return error("لا يمكن حذف حساب المسؤول الذي ينفذ الإجراء.", 409, origin);
      if (!reason || reason.length > 1000) return error("اكتب سبب حذف الحساب (حتى 1000 حرف).", 400, origin);
      try { await deleteAccountData(user!.id, targetUserId, reason); }
      catch (deletionError) {
        const message = deletionError instanceof Error ? deletionError.message : "";
        if (message.includes("finish or cancel active trips")) return error("لا يمكن الحذف أثناء وجود مشوار نشط. أنهِه أو ألغِه أولًا.", 409, origin);
        if (message.includes("protected super administrator")) return error("لا يمكن حذف حساب مسؤول النظام المحمي.", 403, origin);
        if (message.includes("target account not found")) return error("المستخدم غير موجود أو سبق حذفه.", 404, origin);
        throw deletionError;
      }
      return reply({ success: true }, 200, origin);
    }
    if (req.method === "GET" && userProfileRoute) {
      const targetUserId = Number(userProfileRoute[1]);
      if (!Number.isSafeInteger(targetUserId) || targetUserId < 1) return error("رقم المستخدم غير صالح.", 400, origin);
      const [target, controls, captain, documents] = await Promise.all([
        db.from("users").select("id,full_name,phone_number,role,verified_at,created_at").eq("id", targetUserId).is("deleted_at", null).maybeSingle(),
        db.from("admin_user_controls").select("status,reason,updated_at,updated_by_user_id").eq("user_id", targetUserId).maybeSingle(),
        db.from("captain_profiles").select("vehicle_type_id,vehicle_plate,license_number,verification_status,status,grace_period_expires_at").eq("user_id", targetUserId).maybeSingle(),
        db.from("user_verifications").select("id,document_type,status,rejection_reason,uploaded_at,reviewed_at,reviewed_by").eq("user_id", targetUserId).order("uploaded_at", { ascending: false }).limit(20),
      ]);
      const queryError = target.error ?? controls.error ?? captain.error ?? documents.error;
      if (queryError) throw queryError;
      if (!target.data) return error("المستخدم غير موجود.", 404, origin);

      const isRider = target.data.role === "rider";
      const [membersResult, dailyRequestsResult, demandRequestsResult, savedPlacesResult, preferredRoutesResult, commuterPreferencesResult, captainLinesResult, captainPoolTripsResult, captainMatchesResult] = await Promise.all([
        isRider ? db.from("pool_members").select("id,group_id,status,joined_at,cancelled_at,price_decision").eq("rider_user_id", targetUserId).order("joined_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
        isRider ? db.from("daily_commute_requests").select("id,status,created_at,requested_at").eq("rider_user_id", targetUserId).order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
        isRider ? db.from("demand_requests").select("id,status,trip_date,arrival_time,pickup_label,dropoff_label,seats,created_at").eq("rider_user_id", targetUserId).order("created_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
        isRider ? db.from("rider_saved_places").select("place_type,label,updated_at").eq("user_id", targetUserId).order("updated_at", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
        isRider ? db.from("rider_preferred_routes").select("pickup_label,dropoff_label,updated_at").eq("user_id", targetUserId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        isRider ? db.from("rider_commuter_preferences").select("usual_days,usual_departure_time,usual_return_time,frequent_places,updated_at").eq("user_id", targetUserId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        !isRider && target.data.role === "captain" ? db.from("captain_lines").select("id,vehicle_type_id,origin_label,destination_label,arrival_time,service_days,seats,price_per_seat,payment_methods,women_only,status,created_at").eq("captain_user_id", targetUserId).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
        !isRider && target.data.role === "captain" ? db.from("pool_trips").select("id,group_id,service_date,direction,departure_at,status,completed_at").eq("captain_user_id", targetUserId).order("departure_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
        !isRider && target.data.role === "captain" ? db.from("matches").select("id,daily_commute_request_id,matched_at").eq("captain_user_id", targetUserId).order("matched_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
      ]);
      const activityError = membersResult.error ?? dailyRequestsResult.error ?? demandRequestsResult.error ?? savedPlacesResult.error ?? preferredRoutesResult.error ?? commuterPreferencesResult.error ?? captainLinesResult.error ?? captainPoolTripsResult.error ?? captainMatchesResult.error;
      if (activityError) throw activityError;

      const poolMembers = membersResult.data ?? [];
      const groupIds = [...new Set(poolMembers.map((item) => item.group_id))];
      const groupTripsResult = groupIds.length
        ? await db.from("pool_trips").select("id,group_id,service_date,direction,departure_at,status,completed_at").in("group_id", groupIds).order("departure_at", { ascending: false }).limit(1000)
        : { data: [], error: null };
      if (groupTripsResult.error) throw groupTripsResult.error;
      const poolTrips = isRider
        ? (groupTripsResult.data ?? []).filter((trip) => poolMembers.some((member) => {
            if (member.group_id !== trip.group_id) return false;
            const rawTripTime = String(trip.departure_at ?? trip.service_date ?? "");
            const joinedAt = String(member.joined_at ?? "");
            const cancelledAt = member.cancelled_at ? String(member.cancelled_at) : null;
            if (rawTripTime.length === 10) return joinedAt.slice(0, 10) <= rawTripTime && (!cancelledAt || cancelledAt.slice(0, 10) >= rawTripTime);
            const tripTime = Date.parse(rawTripTime);
            const joinedTime = Date.parse(joinedAt);
            const cancelledTime = cancelledAt ? Date.parse(cancelledAt) : Number.POSITIVE_INFINITY;
            return Number.isFinite(tripTime) && Number.isFinite(joinedTime) && joinedTime <= tripTime && cancelledTime >= tripTime;
          }))
        : (captainPoolTripsResult.data ?? []);

      const matchIds = (captainMatchesResult.data ?? []).map((item) => item.id);
      const riderRequestIds = (dailyRequestsResult.data ?? []).map((item) => item.id);
      const dailyMatchesResult = isRider && riderRequestIds.length
        ? await db.from("matches").select("id,daily_commute_request_id,matched_at").in("daily_commute_request_id", riderRequestIds).order("matched_at", { ascending: false }).limit(1000)
        : { data: [], error: null };
      if (dailyMatchesResult.error) throw dailyMatchesResult.error;
      const tripMatchIds = isRider ? (dailyMatchesResult.data ?? []).map((item) => item.id) : matchIds;
      const dailyTripsResult = tripMatchIds.length
        ? await db.from("trips").select("id,match_id,status,started_at,completed_at,total_distance_km,total_amount").in("match_id", tripMatchIds).order("started_at", { ascending: false }).limit(1000)
        : { data: [], error: null };
      if (dailyTripsResult.error) throw dailyTripsResult.error;

      const memberIds = poolMembers.map((item) => item.id);
      const poolTripIds = poolTrips.map((item) => item.id);
      const [settlementsResult, paymentsResult, savedAuditResult] = await Promise.all([
        isRider && memberIds.length
          ? db.from("pool_ledger").select("id,trip_id,member_id,rider_amount,captain_share_amount,settlement_status,created_at").in("member_id", memberIds).order("created_at", { ascending: false }).limit(1000)
          : !isRider && poolTripIds.length
            ? db.from("pool_ledger").select("id,trip_id,member_id,rider_amount,captain_share_amount,settlement_status,created_at").in("trip_id", poolTripIds).order("created_at", { ascending: false }).limit(1000)
            : Promise.resolve({ data: [], error: null }),
        dailyTripsResult.data?.length
          ? db.from("payments").select("id,trip_id,amount,reported_at,confirmed_at").in("trip_id", dailyTripsResult.data.map((item) => item.id)).order("confirmed_at", { ascending: false }).limit(1000)
          : Promise.resolve({ data: [], error: null }),
        db.from("admin_audit_logs").select("id,action,reason,created_at,actor_user_id").eq("resource_type", "user").eq("resource_id", String(targetUserId)).order("created_at", { ascending: false }).limit(50),
      ]);
      if (settlementsResult.error || paymentsResult.error || savedAuditResult.error) throw settlementsResult.error ?? paymentsResult.error ?? savedAuditResult.error;
      const paymentRows = paymentsResult.data ?? [];
      const paymentIds = paymentRows.map((item) => item.id);
      const paymentEventsResult = paymentIds.length
        ? await db.from("payment_status_events").select("payment_id,to_status,adjusted_amount,created_at").in("payment_id", paymentIds).order("created_at", { ascending: true }).limit(2000)
        : { data: [], error: null };
      if (paymentEventsResult.error) throw paymentEventsResult.error;
      const latestPaymentEvent = new Map<number, { to_status: string; adjusted_amount: number | null }>();
      for (const event of paymentEventsResult.data ?? []) latestPaymentEvent.set(event.payment_id, event);
      const effectivePayments = paymentRows.map((item) => {
        const event = latestPaymentEvent.get(item.id);
        const status = event?.to_status ?? "confirmed";
        return { id: item.id, trip_id: item.trip_id, amount: event && status === "adjusted" && event.adjusted_amount !== null ? event.adjusted_amount : item.amount, status, confirmed_at: item.confirmed_at, reported_at: item.reported_at };
      });
      const validPayments = effectivePayments.filter((item) => item.confirmed_at && ["confirmed", "resolved", "adjusted"].includes(item.status));
      const settledRows = (settlementsResult.data ?? []).filter((item) => item.settlement_status === "settled");
      const journeyRows = [...poolTrips.map((item) => ({ id: item.id, type: "pool", status: item.status, date: item.departure_at ?? item.service_date })), ...(dailyTripsResult.data ?? []).map((item) => ({ id: item.id, type: "daily", status: item.status, date: item.started_at ?? item.completed_at }))]
        .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
      const requestRows = [
        ...(dailyRequestsResult.data ?? []).map((item) => ({ id: item.id, type: "daily", status: item.status, date: item.requested_at ?? item.created_at })),
        ...(demandRequestsResult.data ?? []).map((item) => ({ id: item.id, type: "pool", status: item.status, date: item.created_at, trip_date: item.trip_date })),
      ].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
      const recentDocuments = (documents.data ?? []).map((document) => ({ ...document, document_label: verificationDocLabels[document.document_type] ?? document.document_type }));
      const commuterPreferences = commuterPreferencesResult.data;
      const frequentPlaces = Array.isArray(commuterPreferences?.frequent_places)
        ? commuterPreferences.frequent_places.map((place: unknown) => typeof place === "object" && place !== null ? { label: clean((place as Record<string, unknown>).label) ? String((place as Record<string, unknown>).label).slice(0, 120) : "" } : null).filter((place): place is { label: string } => Boolean(place?.label))
        : [];
      await writeAdminAudit(user!.id, "user.details_viewed", "user", String(targetUserId), null);
      return reply({ user: {
        ...target.data,
        account_status: controls.data?.status ?? "active",
        control: controls.data,
        captain: captain.data,
        verification_documents: recentDocuments,
        journey_summary: {
          requests_total: (dailyRequestsResult.data?.length ?? 0) + (demandRequestsResult.data?.length ?? 0),
          requests_cancelled: (dailyRequestsResult.data ?? []).filter((item) => item.status === "cancelled").length + (demandRequestsResult.data ?? []).filter((item) => item.status === "cancelled").length,
          pool_memberships_total: poolMembers.length,
          pool_memberships_cancelled: poolMembers.filter((item) => item.status === "cancelled").length,
          journeys_completed: journeyRows.filter((item) => item.status === "completed").length,
          journeys_cancelled: journeyRows.filter((item) => item.status === "cancelled").length,
          history_truncated: poolMembers.length >= 500 || (dailyRequestsResult.data?.length ?? 0) >= 500 || (demandRequestsResult.data?.length ?? 0) >= 500 || poolTrips.length >= 500 || (dailyTripsResult.data?.length ?? 0) >= 1000 || journeyRows.length > 100 || requestRows.length > 100,
        },
        journey_history: journeyRows.slice(0, 100),
        request_history: requestRows.slice(0, 100),
        saved_places: savedPlacesResult.data ?? [],
        preferred_route: preferredRoutesResult.data,
        commuter_preferences: commuterPreferences ? { usual_days: commuterPreferences.usual_days, usual_departure_time: commuterPreferences.usual_departure_time, usual_return_time: commuterPreferences.usual_return_time, frequent_places: frequentPlaces, updated_at: commuterPreferences.updated_at } : null,
        captain_lines: captainLinesResult.data ?? [],
        financial_summary: {
          confirmed_payments_total: validPayments.reduce((total, item) => total + Number(item.amount ?? 0), 0),
          confirmed_payments_count: validPayments.length,
          settled_ledger_total: settledRows.reduce((total, item) => total + Number(isRider ? item.rider_amount : item.captain_share_amount), 0),
          settled_ledger_count: settledRows.length,
          latest_payment_at: validPayments.map((item) => item.confirmed_at).filter(Boolean).sort().at(-1) ?? null,
          latest_settlement_at: settledRows.map((item) => item.created_at).filter(Boolean).sort().at(-1) ?? null,
          history_truncated: paymentRows.length >= 1000 || (settlementsResult.data?.length ?? 0) >= 1000 || (paymentEventsResult.data?.length ?? 0) >= 2000 || effectivePayments.length + settledRows.length > 100,
        },
        payment_history: [
          ...effectivePayments.map((item) => ({ id: item.id, trip_id: item.trip_id, source: "daily", amount: Number(item.amount), status: item.status, created_at: item.confirmed_at ?? item.reported_at })),
          ...settledRows.map((item) => ({ id: item.id, trip_id: item.trip_id, source: "pool", amount: Number(isRider ? item.rider_amount : item.captain_share_amount), status: "settled", created_at: item.created_at })),
        ].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))).slice(0, 100),
        account_history: savedAuditResult.data ?? [],
      } }, 200, origin);
    }
    if (req.method === "PATCH" && userProfileRoute) {
      if (!clean(body.reason) || body.reason.trim().length > 1000) return error("اكتب سبب تعديل الحساب.", 400, origin);
      const patch: Record<string, string> = {};
      if ("full_name" in body) { if (!clean(body.full_name) || body.full_name.trim().length > 120) return error("الاسم غير صالح.", 400, origin); patch.full_name = body.full_name.trim(); }
      if ("phone_number" in body) { if (!clean(body.phone_number) || body.phone_number.trim().length > 20) return error("رقم الهاتف غير صالح.", 400, origin); patch.phone_number = body.phone_number.trim(); }
      if (!Object.keys(patch).length) return error("لا توجد بيانات صالحة للتحديث.", 400, origin);
      const { data: before, error: readError } = await db.from("users").select("id,full_name,phone_number,role").eq("id", userProfileRoute[1]).maybeSingle();
      if (readError) throw readError;
      if (!before) return error("المستخدم غير موجود.", 404, origin);
      if (before.role === "admin") return error("لا يمكن تعديل حسابات الإدارة من هذه الشاشة.", 403, origin);
      const { data, error: updateError } = await db.from("users").update(patch).eq("id", userProfileRoute[1]).select("id,full_name,phone_number,role,verified_at,created_at").single();
      if (updateError) throw updateError;
      await writeAdminAudit(user!.id, "user.profile_updated", "user", String(data.id), body.reason.trim(), before as Json, data as Json);
      return reply({ user: data }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/trips") {
      const [daily, pooled, groups] = await Promise.all([
        db.from("trips").select("id,status,started_at,completed_at,total_distance_km,total_amount,match_id").eq("status", "in_progress").order("started_at", { ascending: false }).limit(100),
        db.from("pool_trips").select("id,group_id,service_date,direction,departure_at,estimated_arrival_at,captain_user_id,status,group:pool_groups!inner(category_id,status,created_by_user_id)").in("status", ["scheduled", "assigned", "needs_captain"]).order("departure_at", { ascending: true }).limit(100),
        db.from("pool_groups").select("id,category_id,package_type,service_dates,morning_departure,return_departure,status,route_distance_km,seat_day_fare,waiting_since").in("status", ["waiting", "minimum_met", "price_review", "needs_captain", "active"]).order("waiting_since", { ascending: true }).limit(100),
      ]);
      if (daily.error || pooled.error || groups.error) throw daily.error ?? pooled.error ?? groups.error;
      const matchIds = (daily.data ?? []).map((trip) => trip.match_id);
      const { data: matches, error: matchError } = matchIds.length ? await db.from("matches").select("id,captain_user_id,daily_commute_request_id").in("id", matchIds) : { data: [], error: null };
      if (matchError) throw matchError;
      const requestIds = (matches ?? []).map((match) => match.daily_commute_request_id);
      const { data: requests, error: requestError } = requestIds.length ? await db.from("daily_commute_requests").select("id,rider_user_id,service_category_id,created_at").in("id", requestIds) : { data: [], error: null };
      if (requestError) throw requestError;
      const matchById = new Map((matches ?? []).map((match) => [match.id, match]));
      const requestById = new Map((requests ?? []).map((request) => [request.id, request]));
      const dailyTrips = (daily.data ?? []).map((trip) => {
        const match = matchById.get(trip.match_id);
        return { ...trip, captain_user_id: match?.captain_user_id ?? null, request: match ? requestById.get(match.daily_commute_request_id) ?? null : null };
      });
      return reply({ daily_trips: dailyTrips, pool_trips: pooled.data ?? [], pool_groups: groups.data ?? [] }, 200, origin);
    }
    const tripActionRoute = path.match(/^\/admin\/trips\/(daily|pool)\/(\d+)\/(cancel|captain)$/);
    if (req.method === "POST" && tripActionRoute) {
      const [, kind, rawTripId, action] = tripActionRoute;
      const tripId = Number(rawTripId);
      if (!clean(body.reason) || body.reason.trim().length > 1000) return error("اكتب سبب الإجراء بوضوح (حتى 1000 حرف).", 400, origin);
      const reasonTag = clean(body.reason_tag) ? body.reason_tag.trim().slice(0, 80) : action === "cancel" ? "other" : "operational_reassignment";
      if (action === "cancel") {
        if (!clean(body.reason_tag)) return error("اختر تصنيفًا لسبب إلغاء الرحلة.", 400, origin);
        let before: Json;
        let affectedUsers: number[] = [];
        if (kind === "daily") {
          const { data, error: lookupError } = await db.from("trips").select("id,status,match_id").eq("id", tripId).maybeSingle();
          if (lookupError) throw lookupError;
          if (!data || data.status !== "in_progress") return error("الرحلة غير موجودة أو لم تعد قابلة للإلغاء.", 409, origin);
          before = data as unknown as Json;
          const { data: match, error: matchError } = await db.from("matches").select("captain_user_id,daily_commute_request_id").eq("id", data.match_id).maybeSingle();
          if (matchError) throw matchError;
          const { data: request, error: requestError } = match ? await db.from("daily_commute_requests").select("rider_user_id").eq("id", match.daily_commute_request_id).maybeSingle() : { data: null, error: null };
          if (requestError) throw requestError;
          const captainId = Number(match?.captain_user_id ?? 0);
          const riderId = Number(request?.rider_user_id ?? 0);
          affectedUsers = [captainId, riderId].filter((id) => id > 0);
          const { data: updated, error: updateError } = await db.from("trips").update({ status: "cancelled" }).eq("id", tripId).eq("status", "in_progress").select("id,status").maybeSingle();
          if (updateError) throw updateError;
          if (!updated) return error("تغيرت حالة الرحلة. حدّث القائمة وحاول مرة أخرى.", 409, origin);
        } else {
          const { data, error: lookupError } = await db.from("pool_trips").select("id,group_id,status,captain_user_id").eq("id", tripId).maybeSingle();
          if (lookupError) throw lookupError;
          if (!data || !["scheduled", "assigned", "needs_captain"].includes(data.status)) return error("الرحلة غير موجودة أو بدأت بالفعل ولا يمكن إلغاؤها من هنا.", 409, origin);
          before = data as unknown as Json;
          const { data: members, error: memberError } = await db.from("pool_members").select("rider_user_id").eq("group_id", data.group_id).eq("status", "active");
          if (memberError) throw memberError;
          affectedUsers = [...new Set([data.captain_user_id, ...(members ?? []).map((member) => member.rider_user_id)].filter((id): id is number => Number.isInteger(id)))];
          const { data: updated, error: updateError } = await db.from("pool_trips").update({ status: "cancelled" }).eq("id", tripId).in("status", ["scheduled", "assigned", "needs_captain"]).select("id,status").maybeSingle();
          if (updateError) throw updateError;
          if (!updated) return error("تغيرت حالة الرحلة. حدّث القائمة وحاول مرة أخرى.", 409, origin);
        }
        const { error: actionError } = await db.from("admin_trip_actions").insert({ trip_kind: kind, trip_id: tripId, action: "cancelled", reason_tag: reasonTag, reason: body.reason.trim(), actor_user_id: user!.id });
        if (actionError) throw actionError;
        await writeAdminAudit(user!.id, "trip.cancelled", `${kind}_trip`, String(tripId), body.reason.trim(), before, { status: "cancelled", reason_tag: reasonTag });
        await Promise.all(affectedUsers.map((id) => notifyUser(id, null, `admin-trip-cancelled:${kind}:${tripId}`, { title: "تم إلغاء الرحلة", message: "تم إلغاء الرحلة بواسطة فريق الدعم. افتح التطبيق لمراجعة التفاصيل." })));
        return reply({ success: true, status: "cancelled" }, 200, origin);
      }
      if (!Number.isInteger(body.captain_user_id)) return error("اختر كابتنًا صالحًا لإعادة التعيين.", 400, origin);
      const captainId = Number(body.captain_user_id);
      const { data: captain, error: captainError } = await db.from("captain_profiles").select("user_id,verification_status").eq("user_id", captainId).eq("verification_status", "approved").maybeSingle();
      if (captainError) throw captainError;
      if (!captain) return error("لا يمكن تعيين هذا الحساب؛ يجب أن يكون كابتنًا موثقًا.", 409, origin);
      let before: Json;
      if (kind === "daily") {
        const { data, error: lookupError } = await db.from("trips").select("id,status,match_id").eq("id", tripId).maybeSingle();
        if (lookupError) throw lookupError;
        if (!data || data.status !== "in_progress") return error("الرحلة غير موجودة أو لا يمكن إعادة تعيينها.", 409, origin);
        before = data as unknown as Json;
        const { error: updateError } = await db.from("matches").update({ captain_user_id: captainId }).eq("id", data.match_id);
        if (updateError) throw updateError;
      } else {
        const { data, error: lookupError } = await db.from("pool_trips").select("id,group_id,status,captain_user_id").eq("id", tripId).maybeSingle();
        if (lookupError) throw lookupError;
        if (!data || !["scheduled", "assigned", "needs_captain"].includes(data.status)) return error("الرحلة غير موجودة أو بدأت بالفعل ولا يمكن إعادة تعيينها.", 409, origin);
        before = data as unknown as Json;
        const { data: updated, error: updateError } = await db.from("pool_trips").update({ captain_user_id: captainId, status: "assigned" }).eq("id", tripId).in("status", ["scheduled", "assigned", "needs_captain"]).select("id,status,captain_user_id").maybeSingle();
        if (updateError) throw updateError;
        if (!updated) return error("تغيرت حالة الرحلة. حدّث القائمة وحاول مرة أخرى.", 409, origin);
      }
      const { error: actionError } = await db.from("admin_trip_actions").insert({ trip_kind: kind, trip_id: tripId, action: "captain_reassigned", reason_tag: reasonTag, reason: body.reason.trim(), actor_user_id: user!.id });
      if (actionError) throw actionError;
      await writeAdminAudit(user!.id, "trip.captain_reassigned", `${kind}_trip`, String(tripId), body.reason.trim(), before, { captain_user_id: captainId });
      await notifyUser(captainId, null, `admin-trip-assigned:${kind}:${tripId}`, { title: "تم تعيين رحلة لك", message: "راجع تفاصيل الرحلة ومواعيدها من التطبيق." });
      return reply({ success: true, captain_user_id: captainId }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/disputes") {
      const { data: events, error: eventError } = await db.from("payment_status_events").select("id,payment_id,from_status,to_status,actor_user_id,reason,adjusted_amount,created_at").eq("to_status", "disputed").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
      if (eventError) throw eventError;
      const paymentIds = [...new Set((events ?? []).map((event) => event.payment_id))];
      const [payments, history] = await Promise.all([
        paymentIds.length ? db.from("payments").select("id,trip_id,amount,reported_by_user_id,reported_at").in("id", paymentIds) : Promise.resolve({ data: [], error: null }),
        paymentIds.length ? db.from("payment_status_events").select("id,payment_id,from_status,to_status,actor_user_id,reason,adjusted_amount,created_at").in("payment_id", paymentIds).order("created_at", { ascending: false }).order("id", { ascending: false }) : Promise.resolve({ data: [], error: null }),
      ]);
      if (payments.error || history.error) throw payments.error ?? history.error;
      const paymentById = new Map((payments.data ?? []).map((payment) => [payment.id, payment]));
      const latestByPayment = new Map<number, NonNullable<typeof history.data>[number]>();
      for (const event of history.data ?? []) if (!latestByPayment.has(event.payment_id)) latestByPayment.set(event.payment_id, event);
      const disputes = [...latestByPayment.entries()]
        .filter(([, event]) => event.to_status === "disputed")
        .map(([paymentId, event]) => ({ ...event, payment: paymentById.get(paymentId), history: (history.data ?? []).filter((item) => item.payment_id === paymentId) }))
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
      if (url.searchParams.get("summary") === "true") return reply({ total_count: disputes.length, capped: (events ?? []).length === 100 }, 200, origin);
      return reply({ disputes }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/settings") {
      const [pricing, categories, commission] = await Promise.all([
        db.from("pricing_config").select("*,vehicle:vehicle_types(id,name_ar)").order("vehicle_type_id"),
        db.from("pool_categories").select("id,speed_tier,has_ac,seats,base_fee,rate_per_km,rate_per_min").order("id"),
        db.from("admin_system_settings").select("setting_key,numeric_value,updated_at").eq("setting_key", "company_commission_rate").maybeSingle(),
      ]);
      if (pricing.error || categories.error || commission.error) throw pricing.error ?? categories.error ?? commission.error;
      return reply({ pricing: pricing.data ?? [], pool_categories: categories.data ?? [], commission_rate: commission.data?.numeric_value ?? 0.2 }, 200, origin);
    }
    if (req.method === "PATCH" && path === "/admin/settings/commission") {
      if (!number(body.rate) || body.rate < 0 || body.rate > 1) return error("نسبة العمولة يجب أن تكون بين 0 و1.", 400, origin);
      if (!clean(body.reason)) return error("اكتب سبب تغيير العمولة.", 400, origin);
      const { data, error: settingsError } = await db.rpc("admin_set_commission_rate", { p_actor_user_id: user!.id, p_rate: body.rate, p_reason: body.reason.trim() });
      if (settingsError) throw settingsError;
      return reply({ setting: data }, 200, origin);
    }
    const poolPricingRoute = path.match(/^\/admin\/settings\/pool-categories\/([^/]+)$/);
    if (req.method === "PATCH" && poolPricingRoute) {
      const values = [body.base_fee, body.rate_per_km, body.rate_per_min];
      if (!values.every((value) => number(value) && value >= 0) || !clean(body.reason)) return error("راجع قيم التسعير وسبب التعديل.", 400, origin);
      const { data: before, error: readError } = await db.from("pool_categories").select("*").eq("id", poolPricingRoute[1]).maybeSingle();
      if (readError) throw readError;
      if (!before) return error("الفئة غير موجودة.", 404, origin);
      const { data, error: updateError } = await db.from("pool_categories").update({ base_fee: values[0], rate_per_km: values[1], rate_per_min: values[2], updated_at: new Date().toISOString() }).eq("id", poolPricingRoute[1]).select().maybeSingle();
      if (updateError) throw updateError;
      if (!data) return error("الفئة غير موجودة.", 404, origin);
      await writeAdminAudit(user!.id, "pricing.pool_category_updated", "pool_category", poolPricingRoute[1], body.reason.trim(), before as Json, data as Json);
      return reply({ pool_category: data }, 200, origin);
    }
    if (req.method === "POST" && path === "/admin/ledger/adjustments") {
      if (!Number.isInteger(body.trip_id) || !["daily", "pool"].includes(String(body.trip_kind)) || !number(body.amount) || body.amount === 0 || !clean(body.reason)) return error("راجع الرحلة والمبلغ وسبب التسوية.", 400, origin);
      const memberId = body.member_id === null || body.member_id === undefined ? null : Number(body.member_id);
      if (memberId !== null && !Number.isInteger(memberId)) return error("رقم الراكب غير صالح.", 400, origin);
      const { data, error: adjustmentError } = await db.rpc("admin_add_ledger_adjustment", { p_actor_user_id: user!.id, p_trip_kind: body.trip_kind, p_trip_id: body.trip_id, p_member_id: memberId, p_amount: body.amount, p_reason: body.reason.trim() });
      if (adjustmentError) throw adjustmentError;
      return reply({ adjustment: data }, 201, origin);
    }
    if (req.method === "GET" && path === "/admin/ledger/adjustments") {
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
      const { data, error: adjustmentError } = await db.from("admin_ledger_adjustments").select("id,trip_kind,trip_id,member_id,amount,reason,actor_user_id,created_at").order("created_at", { ascending: false }).limit(limit);
      if (adjustmentError) throw adjustmentError;
      return reply({ adjustments: data ?? [], total_adjustment_amount: (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0) }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/audit") {
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
      const { data, error: auditError } = await db.from("admin_audit_logs").select("id,actor_user_id,action,resource_type,resource_id,reason,before_state,after_state,created_at").order("created_at", { ascending: false }).limit(limit);
      if (auditError) throw auditError;
      return reply({ audit_logs: data ?? [] }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/commuter-board-campaigns") {
      const { data, error: campaignError } = await db.from("commuter_board_campaigns").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false });
      if (campaignError) throw campaignError;
      return reply({ cards: data ?? [] }, 200, origin);
    }
    if (req.method === "POST" && path === "/admin/commuter-board-campaigns") {
      const allowedTypes = ["weekly_reminder", "monthly_reminder", "invite_friends", "campaign"];
      const allowedActions = ["open-booking", "open-trips", "invite-friends", "manage-preferences"];
      const title = clean(body.title) ? body.title.trim() : "", description = clean(body.description) ? body.description.trim() : "", ctaText = clean(body.cta_text) ? body.cta_text.trim() : "";
      if (!title || title.length > 120 || !description || description.length > 500 || !ctaText || ctaText.length > 60 || !allowedTypes.includes(String(body.type)) || !allowedActions.includes(String(body.cta_action)) || typeof body.active !== "boolean" || !Number.isInteger(body.priority) || Number(body.priority) < 0 || Number(body.priority) > 100 || !Number.isInteger(body.display_duration) || Number(body.display_duration) < 5 || Number(body.display_duration) > 30 || (body.targeting_rules !== undefined && (!body.targeting_rules || typeof body.targeting_rules !== "object" || Array.isArray(body.targeting_rules)))) return error("راجع محتوى البطاقة ونوعها وأولوية العرض ومدة ظهورها.", 400, origin);
      const starts = body.start_date === null || body.start_date === undefined || body.start_date === "" ? null : String(body.start_date);
      const ends = body.end_date === null || body.end_date === undefined || body.end_date === "" ? null : String(body.end_date);
      if ((starts && !Number.isFinite(Date.parse(starts))) || (ends && !Number.isFinite(Date.parse(ends))) || (starts && ends && Date.parse(ends) <= Date.parse(starts))) return error("راجع تاريخ بداية البطاقة ونهايتها.", 400, origin);
      const { data, error: insertError } = await db.from("commuter_board_campaigns").insert({ type: body.type, title, description, icon: typeof body.icon === "string" ? body.icon.slice(0, 16) : "⌖", cta_text: ctaText, cta_action: body.cta_action, priority: body.priority, targeting_rules: body.targeting_rules ?? {}, start_date: starts, end_date: ends, active: body.active, display_duration: body.display_duration, created_by_admin: user!.id }).select().single();
      if (insertError) throw insertError;
      await writeAdminAudit(user!.id, "campaign.created", "commuter_board_campaign", String(data.id), null, {}, data as Json);
      return reply({ card: data }, 201, origin);
    }
    const campaignAction = path.match(/^\/admin\/commuter-board-campaigns\/([0-9a-f-]{36})$/i);
    if (campaignAction && req.method === "PATCH") {
      const patch: Record<string, unknown> = {};
      for (const field of ["type", "title", "description", "icon", "cta_text", "cta_action", "priority", "targeting_rules", "start_date", "end_date", "active", "display_duration"] as const) if (field in body) patch[field] = body[field];
      if (!Object.keys(patch).length) return error("مافيش تغييرات لحفظها.", 400, origin);
      if (patch.title !== undefined && (typeof patch.title !== "string" || !patch.title.trim() || patch.title.length > 120) || patch.description !== undefined && (typeof patch.description !== "string" || !patch.description.trim() || patch.description.length > 500) || patch.cta_text !== undefined && (typeof patch.cta_text !== "string" || !patch.cta_text.trim() || patch.cta_text.length > 60) || patch.icon !== undefined && (typeof patch.icon !== "string" || patch.icon.length > 16) || patch.type !== undefined && !["weekly_reminder", "monthly_reminder", "invite_friends", "campaign"].includes(String(patch.type)) || patch.cta_action !== undefined && !["open-booking", "open-trips", "invite-friends", "manage-preferences"].includes(String(patch.cta_action)) || patch.priority !== undefined && (!Number.isInteger(patch.priority) || Number(patch.priority) < 0 || Number(patch.priority) > 100) || patch.display_duration !== undefined && (!Number.isInteger(patch.display_duration) || Number(patch.display_duration) < 5 || Number(patch.display_duration) > 30) || patch.active !== undefined && typeof patch.active !== "boolean" || patch.targeting_rules !== undefined && (!patch.targeting_rules || typeof patch.targeting_rules !== "object" || Array.isArray(patch.targeting_rules))) return error("راجع بيانات البطاقة قبل الحفظ.", 400, origin);
      if (patch.start_date === "") patch.start_date = null;
      if (patch.end_date === "") patch.end_date = null;
      for (const field of ["start_date", "end_date"] as const) if (patch[field] !== undefined && patch[field] !== null && !Number.isFinite(Date.parse(String(patch[field])))) return error("تاريخ الحملة غير صحيح.", 400, origin);
      const { data: existingCampaign, error: campaignLookupError } = await db.from("commuter_board_campaigns").select("*").eq("id", campaignAction[1]).maybeSingle();
      if (campaignLookupError) throw campaignLookupError;
      if (!existingCampaign) return error("بطاقة الحملة غير موجودة.", 404, origin);
      const nextStart = patch.start_date === undefined ? existingCampaign.start_date : patch.start_date;
      const nextEnd = patch.end_date === undefined ? existingCampaign.end_date : patch.end_date;
      if (nextStart && nextEnd && Date.parse(String(nextEnd)) <= Date.parse(String(nextStart))) return error("تاريخ نهاية الحملة يجب أن يأتي بعد تاريخ بدايتها.", 400, origin);
      patch.updated_at = new Date().toISOString();
      const { data, error: updateError } = await db.from("commuter_board_campaigns").update(patch).eq("id", campaignAction[1]).select().maybeSingle();
      if (updateError) throw updateError;
      if (!data) return error("بطاقة الحملة غير موجودة.", 404, origin);
      await writeAdminAudit(user!.id, "campaign.updated", "commuter_board_campaign", campaignAction[1], clean(body.reason) ? body.reason.trim() : null, existingCampaign as Json, data as Json);
      return reply({ card: data }, 200, origin);
    }
    if (campaignAction && req.method === "DELETE") {
      const { data: before, error: readError } = await db.from("commuter_board_campaigns").select("*").eq("id", campaignAction[1]).maybeSingle();
      if (readError) throw readError;
      if (!before) return error("بطاقة الحملة غير موجودة.", 404, origin);
      const { data, error: deleteError } = await db.from("commuter_board_campaigns").delete().eq("id", campaignAction[1]).select("id").maybeSingle();
      if (deleteError) throw deleteError;
      if (!data) return error("بطاقة الحملة غير موجودة.", 404, origin);
      await writeAdminAudit(user!.id, "campaign.deleted", "commuter_board_campaign", campaignAction[1], null, before as Json, {});
      return reply({ success: true }, 200, origin);
    }
    if (req.method === "POST" && path === "/admin/notifications/broadcast") {
      const title = clean(body.title) ? body.title.trim() : "";
      const message = clean(body.message) ? body.message.trim() : "";
      const requestId = clean(body.request_id) ? body.request_id.trim() : "";
      if (!title || title.length > 100 || !message || message.length > 1000 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
        return error("اكتب عنوانًا ونصًا صحيحين للرسالة ثم حاول مرة أخرى.", 400, origin);
      }
      const requestKey = `broadcast:${requestId}`;
      let offset = 0, recipientCount = 0;
      while (true) {
        const { data: recipients, error: recipientsError } = await db.from("users").select("id").is("deleted_at", null).order("id", { ascending: true }).range(offset, offset + 999);
        if (recipientsError) throw recipientsError;
        if (!recipients?.length) break;
        const rows = recipients.map(({ id }) => ({ user_id: id, group_id: null, type: "system", event_key: requestKey, payload: { title, message } }));
        recipientCount += rows.length;
        const { error: insertError } = await db.from("pool_notifications").upsert(rows, { onConflict: "user_id,event_key", ignoreDuplicates: true });
        if (insertError) throw insertError;
        offset += recipients.length;
        if (recipients.length < 1000) break;
      }
      await writeAdminAudit(user!.id, "notification.broadcast", "notification_batch", requestId, null, {}, { title, notified_users: recipientCount });
      return reply({ success: true, notified_users: recipientCount, request_id: requestId }, 200, origin);
    }
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
      await writeAdminAudit(user!.id, "config.captain_otp_changed", "feature_flag", "captain_phone_otp", null, { enabled: !body.enabled }, { enabled: data.enabled });
      return reply({ otp: { enabled: data.enabled === true, provider: "twilio_verify", provider_ready: otpProviderReady() } }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/captains") {
      const status = url.searchParams.get("status") ?? "pending";
      if (!["pending", "approved", "rejected"].includes(status)) return error("حالة التوثيق المطلوبة مش صحيحة.", 400, origin);
      const { data: profiles, error: profileError } = await db.from("captain_profiles").select("*").eq("verification_status", status).order("created_at", { ascending: false });
      if (profileError) throw profileError;
      const captains = [];
      for (const p of profiles ?? []) {
        const { data: u, error: userError } = await db.from("users").select("id,full_name,phone_number,verified_at").eq("id", p.user_id).single();
        if (userError) throw userError;
        captains.push({ user_id: p.user_id, ...u, vehicle_type_id: p.vehicle_type_id, license_number: p.license_number, vehicle_plate: p.vehicle_plate, verification_status: p.verification_status, current_lat: p.current_lat, current_lng: p.current_lng, created_at: p.created_at });
      }
      return reply({ captains }, 200, origin);
    }
    const verifyCaptain = path.match(/^\/admin\/captains\/(\d+)\/verification$/);
    if (req.method === "POST" && verifyCaptain) {
      if (!["pending", "approved", "rejected"].includes(String(body.status)) || !clean(body.reason)) return error("حدد حالة التوثيق واكتب سبب القرار.", 400, origin);
      const { data: oldProfile, error: readError } = await db.from("captain_profiles").select("*").eq("user_id", verifyCaptain[1]).maybeSingle();
      if (readError) throw readError;
      if (!oldProfile) return error("الكابتن غير موجود.", 404, origin);
      if (body.status === "approved" && !await captainHasImmediateVerification(Number(verifyCaptain[1]))) return error("لا يمكن اعتماد ملف الكابتن قبل توثيق الهاتف واعتماد المستندات الستة المطلوبة.", 409, origin);
      const { data, error: e } = await db.from("captain_profiles").update({ verification_status: body.status }).eq("user_id", verifyCaptain[1]).neq("verification_status", body.status).select().maybeSingle();
      if (e) throw e; if (!data) return error("الكابتن غير موجود أو حالته لم تتغير.", 404, origin);
      await writeAdminAudit(user!.id, "captain.verification_changed", "captain", String(verifyCaptain[1]), body.reason.trim(), oldProfile as Json, data as Json);
      await notifyUser(Number(verifyCaptain[1]), null, `admin-verification:${data.verification_status}:${Date.now()}`, { title: "تحديث توثيق الكابتن", message: body.status === "approved" ? "تم توثيق حسابك ويمكنك استقبال الرحلات." : body.status === "rejected" ? "لم يتم قبول التوثيق. راجع بيانات المركبة والرخصة ثم تواصل مع الدعم." : "تم تحديث حالة التوثيق." });
      return reply({ captain_profile: data }, 200, origin);
    }
    const captainProfileRoute = path.match(/^\/admin\/captains\/(\d+)$/);
    if (req.method === "PATCH" && captainProfileRoute) {
      const allowed = ["vehicle_type_id", "license_number", "vehicle_plate", "verification_status"] as const;
      const patch: Record<string, string> = {};
      for (const field of allowed) if (field in body) {
        if (!clean(body[field]) || body[field].trim().length > (field === "license_number" || field === "vehicle_plate" ? 40 : 80)) return error("راجع بيانات الكابتن قبل الحفظ.", 400, origin);
        patch[field] = body[field].trim();
      }
      if (!Object.keys(patch).length || (patch.verification_status && !["pending", "approved", "rejected"].includes(patch.verification_status))) return error("لا توجد تغييرات صالحة للحفظ.", 400, origin);
      if (!clean(body.reason)) return error("اكتب سبب تعديل بيانات الكابتن.", 400, origin);
      const { data: before, error: readError } = await db.from("captain_profiles").select("*").eq("user_id", captainProfileRoute[1]).maybeSingle();
      if (readError) throw readError;
      if (!before) return error("بيانات الكابتن غير موجودة.", 404, origin);
      if (patch.verification_status === "approved" && !await captainHasImmediateVerification(Number(captainProfileRoute[1]))) return error("لا يمكن اعتماد ملف الكابتن قبل توثيق الهاتف واعتماد المستندات الستة المطلوبة.", 409, origin);
      const { data, error: updateError } = await db.from("captain_profiles").update(patch).eq("user_id", captainProfileRoute[1]).select().single();
      if (updateError) throw updateError;
      await writeAdminAudit(user!.id, "captain.profile_updated", "captain", captainProfileRoute[1], body.reason.trim(), before as Json, data as Json);
      if (patch.verification_status && patch.verification_status !== before.verification_status) await notifyUser(Number(captainProfileRoute[1]), null, `admin-verification:${data.verification_status}:${Date.now()}`, { title: "تحديث توثيق الكابتن", message: patch.verification_status === "approved" ? "تم توثيق حسابك ويمكنك استقبال الرحلات." : patch.verification_status === "rejected" ? "لم يتم قبول التوثيق. راجع بيانات المركبة والرخصة ثم تواصل مع الدعم." : "تم تحديث حالة التوثيق." });
      return reply({ captain_profile: data }, 200, origin);
    }

    const priceUpdate = path.match(/^\/admin\/pricing\/([^/]+)$/);
    if (req.method === "PATCH" && priceUpdate) {
      const values = [body.base_fee, body.rate_per_km, body.rate_per_min];
      if (!values.every(value => number(value) && value >= 0)) return error("قيم التسعير المطلوبة ناقصة أو غير صحيحة.", 400, origin);
      const { data: before, error: readError } = await db.from("pricing_config").select("*").eq("vehicle_type_id", priceUpdate[1]).maybeSingle();
      if (readError) throw readError;
      if (!before) return error("نوع المركبة ده مش موجود في إعدادات التسعير.", 404, origin);
      const { data, error: pe } = await db.from("pricing_config").update({ base_fee: values[0], rate_per_km: values[1], rate_per_min: values[2], updated_at: new Date().toISOString() }).eq("vehicle_type_id", priceUpdate[1]).select().maybeSingle();
      if (pe) throw pe; if (!data) return error("نوع المركبة ده مش موجود في إعدادات التسعير.", 404, origin);
      const reason = clean(body.reason) ? body.reason.trim() : "تحديث تسعير النظام";
      await writeAdminAudit(user!.id, "pricing.updated", "pricing_config", String(priceUpdate[1]), reason, before as Json, data as Json);
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
      if (!clean(body.reason) || body.reason.trim().length > 1000) return error("اكتب سبب معالجة الاعتراض.", 400, origin);
      const { data: payment, error: pe } = await db.from("payments").select("id").eq("id", paymentId).maybeSingle();
      if (pe) throw pe; if (!payment) return error("الدفعة دي مش موجودة.", 404, origin);
      const { data: events, error: ee } = await db.from("payment_status_events").select("id,to_status").eq("payment_id", paymentId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1);
      if (ee) throw ee;
      if ((events?.[0]?.to_status ?? "confirmed") !== "disputed") return error("لا يمكن اتخاذ إجراء إلا على دفعة معترض عليها.", 409, origin);
      const target = action === "resolve" ? "resolved" : action === "adjust" ? "adjusted" : "voided";
      if (action === "adjust" && (!number(body.adjusted_amount) || body.adjusted_amount < 0)) return error("المبلغ المعدل غير صالح.", 400, origin);
      const { data: event, error: insertError } = await db.from("payment_status_events").insert({ payment_id: paymentId, from_status: "disputed", to_status: target, actor_user_id: user!.id, reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : null, adjusted_amount: action === "adjust" ? body.adjusted_amount : null }).select().single();
      if (insertError) throw insertError;
      await writeAdminAudit(user!.id, `payment.${action}`, "payment", String(paymentId), body.reason.trim(), { status: "disputed" }, { status: target, adjusted_amount: action === "adjust" ? body.adjusted_amount : null });
      return reply({ event }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/analytics/overview") {
      const count = (table: string, column?: string, value?: string) => {
        let query = db!.from(table).select("id", { count: "exact", head: true });
        if (column && value) query = query.eq(column, value);
        return query;
      };
      const queries = await Promise.all([
        count("users"), count("users", "role", "rider"), count("captain_profiles"),
        count("captain_profiles", "verification_status", "pending"), count("captain_profiles", "verification_status", "approved"),
        count("trips", "status", "in_progress"), count("pool_trips", "status", "in_progress"),
        count("trips", "status", "completed"), count("pool_trips", "status", "completed"),
        count("pool_groups", "status", "price_review"),
      ]);
      const failed = queries.map((result, index) => result.error ? { query: index, code: result.error.code, message: result.error.message } : null).filter(Boolean);
      if (failed.length) {
        console.error("[sekka-api] admin analytics queries failed", failed);
        throw new Error("admin analytics queries failed");
      }
      const value = (index: number) => queries[index].count ?? 0;
      const overview: Record<string, number> = {
        total_users: value(0), total_riders: value(1), total_captains: value(2),
        captains_pending_verification: value(3), captains_approved: value(4),
        total_trips_in_progress: value(5) + value(6), total_trips_completed: value(7) + value(8),
        pending_price_approvals: value(9),
      };
      return reply({ overview }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/pool/overview") {
      const countStatus = (status: string) => db.from("pool_groups").select("id", { count: "exact", head: true }).eq("status", status);
      const [waiting, minimumMet, priceReview, needsCaptain, active] = await Promise.all([
        countStatus("waiting"), countStatus("minimum_met"), countStatus("price_review"), countStatus("needs_captain"), countStatus("active"),
      ]);
      const failed = [waiting, minimumMet, priceReview, needsCaptain, active].map((result, index) => result.error ? { query: index, code: result.error.code, message: result.error.message } : null).filter(Boolean);
      if (failed.length) {
        console.error("[sekka-api] admin pool overview queries failed", failed);
        throw new Error("admin pool overview queries failed");
      }
      return reply({ overview: {
        waiting_groups: (waiting.count ?? 0) + (minimumMet.count ?? 0),
        price_review_groups: priceReview.count ?? 0,
        needs_captain_groups: needsCaptain.count ?? 0,
        active_groups: active.count ?? 0,
      } }, 200, origin);
    }
    if (req.method === "GET" && path === "/admin/finance/summary") {
      let lastId = 0;
      let companyDue = 0;
      let captainsDue = 0;
      let pendingRows = 0;
      while (true) {
        const { data, error: ledgerError } = await db.from("pool_ledger")
          .select("id,company_share_amount,captain_share_amount")
          .eq("settlement_status", "pending")
          .gt("id", lastId)
          .order("id", { ascending: true })
          .limit(1000);
        if (ledgerError) {
          console.error("[sekka-api] admin finance summary query failed", { code: ledgerError.code, message: ledgerError.message, lastId });
          throw new Error("admin finance summary query failed");
        }
        for (const row of data ?? []) {
          companyDue += Number(row.company_share_amount);
          captainsDue += Number(row.captain_share_amount);
        }
        const received = data?.length ?? 0;
        pendingRows += received;
        if (received < 1000) break;
        lastId = data?.[received - 1]?.id ?? lastId;
      }
      return reply({ company_due: companyDue, captains_due: captainsDue, pending_settlements: pendingRows }, 200, origin);
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
