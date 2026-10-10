const PRODUCTION_ORIGIN = "https://sekka-go.pages.dev";
const LOCAL_ORIGIN = "http://localhost:5173";

function configuredOrigins(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => {
        if (!origin) return false;
        try {
          const parsed = new URL(origin);
          return parsed.origin === origin &&
            (parsed.protocol === "https:" ||
              (parsed.protocol === "http:" && parsed.hostname === "localhost"));
        } catch {
          return false;
        }
      }),
  );
}

export function allowedCorsOrigin(
  origin: string | null,
  configured?: string,
): string | null {
  if (!origin) return null;
  if (origin === PRODUCTION_ORIGIN || origin === LOCAL_ORIGIN) return origin;
  return configuredOrigins(configured).has(origin) ? origin : null;
}

export function corsHeaders(
  origin: string | null,
  configured?: string,
): HeadersInit {
  const allowedOrigin = allowedCorsOrigin(origin, configured);
  if (!allowedOrigin) return { "Vary": "Origin" };
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
