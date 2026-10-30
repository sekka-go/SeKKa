export type SekkaRole = "rider" | "captain" | "admin";

export type SekkaUser = {
  id: number;
  full_name: string;
  phone_number: string;
  role: SekkaRole;
  verified_at: string | null;
  created_at: string;
  account_status?: "active" | "suspended" | "banned";
};

export type SekkaSession = {
  token: string;
  user: SekkaUser;
  expiresAt: number;
};

export class SekkaApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "SekkaApiError";
  }
}

const SESSION_KEY = "sekka_api_session_v1";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function apiKey() {
  return (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
}

function apiBase() {
  if (!apiKey()) throw new SekkaApiError("إعداد الاتصال بخدمة سِكّة غير مكتمل.", 503);
  return "/__sekka-api";
}

export function getSekkaSession(): SekkaSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as SekkaSession;
    if (!session.token || !session.user || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      clearSekkaSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSekkaSession(session: { token: string; user: SekkaUser }) {
  const value: SekkaSession = { ...session, expiresAt: Date.now() + SESSION_LIFETIME_MS };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  return value;
}

export function clearSekkaSession() {
  try { window.localStorage.removeItem(SESSION_KEY); } catch { /* storage may be disabled */ }
}

export async function sekkaApi<T>(path: string, options: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const currentToken = options.token === undefined ? getSekkaSession()?.token : options.token;
  const headers = new Headers({ apikey: apiKey() ?? "", Accept: "application/json" });
  if (currentToken) headers.set("Authorization", `Bearer ${currentToken}`);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new SekkaApiError("تعذر الاتصال بخدمة سِكّة. تحقق من الإنترنت ثم حاول مرة أخرى.", 0);
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload.error === "string" ? payload.error : "تعذر إكمال الطلب الآن. حاول مرة أخرى.";
    if (response.status === 401 && currentToken && getSekkaSession()?.token === currentToken) {
      clearSekkaSession();
      window.dispatchEvent(new Event("sekka:session-expired"));
    }
    throw new SekkaApiError(message, response.status);
  }
  return payload as T;
}

export async function sekkaApiForm<T>(path: string, form: FormData): Promise<T> {
  const token = getSekkaSession()?.token;
  const headers = new Headers({ apikey: apiKey() ?? "", Accept: "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try { response = await fetch(`${apiBase()}${path}`, { method: "POST", headers, body: form }); }
  catch { throw new SekkaApiError("تعذر الاتصال بخدمة سِكّة. تحقق من الإنترنت ثم حاول مرة أخرى.", 0); }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload.error === "string" ? payload.error : "تعذر إكمال الطلب الآن. حاول مرة أخرى.";
    if (response.status === 401 && token && getSekkaSession()?.token === token) { clearSekkaSession(); window.dispatchEvent(new Event("sekka:session-expired")); }
    throw new SekkaApiError(message, response.status);
  }
  return payload as T;
}

export async function logoutSekkaSession() {
  const session = getSekkaSession();
  if (!session) return;
  try { await sekkaApi<unknown>("/auth/logout", { method: "POST", token: session.token }); }
  finally {
    clearSekkaSession();
    window.dispatchEvent(new Event("sekka:session-expired"));
  }
}

export function normalizeEgyptianPhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (/^01[0125]\d{8}$/.test(compact)) return `+20${compact.slice(1)}`;
  if (/^20?1[0125]\d{8}$/.test(compact.replace(/^\+/, ""))) return `+${compact.replace(/^\+/, "")}`;
  return compact;
}
