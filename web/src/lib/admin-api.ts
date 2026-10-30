const ADMIN_TOKEN_KEY = "sekka_admin_api_token";

export type AdminApiSession = { token: string; user: { id: number; full_name: string; role: string } };

export function getAdminApiToken() {
  return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminApiToken(token: string) {
  window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminApiToken() {
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function adminApi<T>(path: string, options: { token?: string | null; method?: string; body?: unknown } = {}): Promise<T> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
  if (!url || !publishableKey) throw new Error("إعداد الاتصال بخدمة سِكّة غير مكتمل.");
  const headers = new Headers({ apikey: publishableKey, Accept: "application/json" });
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const baseUrl = import.meta.env.DEV ? "/__sekka-api" : `${url}/functions/v1/sekka-api`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload.error === "string" ? payload.error : `تعذر إكمال الطلب (${response.status}).`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

