type PagesFunctionContext = {
  request: Request;
  env: {
    SEKKA_API_ORIGIN: string;
  };
};

export async function onRequest({ request, env }: PagesFunctionContext) {
  const incoming = new URL(request.url);
  const suffix = incoming.pathname.slice("/__sekka-api".length).replace(/^\/+/, "");
  if (!suffix || suffix.split("/").some((part) => part === "." || part === "..")) {
    return new Response(JSON.stringify({ error: "المسار غير موجود." }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const apiOrigin = env.SEKKA_API_ORIGIN.replace(/\/+$/, "");
  const target = new URL(`${apiOrigin}/${suffix}`);
  target.search = incoming.search;
  const upstream = new Request(target, request);
  return fetch(upstream);
}
