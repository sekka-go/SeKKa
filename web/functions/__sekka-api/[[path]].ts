type PagesFunctionContext = {
  request: Request;
};

const API_ORIGIN = "https://uorxfakceqnhxqnaawdy.supabase.co/functions/v1/sekka-api";

export async function onRequest({ request }: PagesFunctionContext) {
  const incoming = new URL(request.url);
  const suffix = incoming.pathname.slice("/__sekka-api".length).replace(/^\/+/, "");
  if (!suffix || suffix.split("/").some((part) => part === "." || part === "..")) {
    return new Response(JSON.stringify({ error: "المسار غير موجود." }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const target = new URL(`${API_ORIGIN}/${suffix}`);
  target.search = incoming.search;
  const upstream = new Request(target, request);
  return fetch(upstream);
}
