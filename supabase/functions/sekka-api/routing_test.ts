import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { routeWithOsrm, RoutingError } from "./routing.ts";

function okResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

Deno.test("requests real road geometry with longitude,latitude coordinates", async () => {
  let requestedUrl = "";
  let requestedHeaders: Headers | undefined;
  const result = await routeWithOsrm(
    [{ lat: 30.1, lng: 31.2 }, { lat: 30.2, lng: 31.3 }],
    {
      fetcher: async (input, init) => {
        requestedUrl = String(input);
        requestedHeaders = new Headers(init?.headers);
        return okResponse({
          code: "Ok",
          routes: [{
            distance: 12_000,
            duration: 1_200,
            geometry: { type: "LineString", coordinates: [[31.2, 30.1], [31.3, 30.2]] },
            legs: [{ distance: 12_000, duration: 1_200 }],
          }],
        });
      },
    },
  );

  const url = new URL(requestedUrl);
  assertEquals(url.pathname, "/route/v1/driving/31.2,30.1;31.3,30.2");
  assertEquals(url.searchParams.get("geometries"), "geojson");
  assertEquals(result.provider, "osrm_demo");
  assertEquals(result.distance_km, 12);
  assertEquals(result.duration_min, 20);
  assertEquals(result.geometry.coordinates, [[31.2, 30.1], [31.3, 30.2]]);
  assertEquals(result.segments[0], {
    from_stop_sequence: 1,
    to_stop_sequence: 2,
    distance_km: 12,
    duration_min: 20,
  });
  assertEquals(requestedHeaders?.get("referer"), "https://sekka-go.pages.dev/");
});

Deno.test("keeps stop sequence when consecutive coordinates are identical", async () => {
  const result = await routeWithOsrm(
    [
      { lat: 30, lng: 31 },
      { lat: 30, lng: 31 },
      { lat: 30.1, lng: 31.1 },
    ],
    {
      fetcher: async () => okResponse({
        code: "Ok",
        routes: [{
          distance: 2_000,
          duration: 600,
          geometry: { type: "LineString", coordinates: [[31, 30], [31.1, 30.1]] },
          legs: [{ distance: 2_000, duration: 600 }],
        }],
      }),
    },
  );

  assertEquals(result.segments, [
    { from_stop_sequence: 1, to_stop_sequence: 2, distance_km: 0, duration_min: 0 },
    { from_stop_sequence: 2, to_stop_sequence: 3, distance_km: 2, duration_min: 10 },
  ]);
});

Deno.test("rejects invalid coordinates before making an upstream request", async () => {
  let requested = false;
  await assertRejects(
    () => routeWithOsrm(
      [{ lat: 91, lng: 31 }, { lat: 30, lng: 32 }],
      { fetcher: async () => { requested = true; return okResponse({}); } },
    ),
    RoutingError,
    "اختر نقطتين صحيحتين",
  );
  assertEquals(requested, false);
});

Deno.test("rejects malformed OSRM geometry instead of drawing a straight line", async () => {
  await assertRejects(
    () => routeWithOsrm(
      [{ lat: 30, lng: 31 }, { lat: 30.1, lng: 31.1 }],
      {
        fetcher: async () => okResponse({
          code: "Ok",
          routes: [{
            distance: 1_000,
            duration: 300,
            geometry: { type: "LineString", coordinates: [[31, 30], [31.1, 30.1]] },
            legs: [],
          }],
        }),
      },
    ),
    RoutingError,
    "بيانات غير مكتملة",
  );
});
