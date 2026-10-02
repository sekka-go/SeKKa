import { assertEquals, assertRejects } from "@std/assert";
import { routeWithOsrm, RoutingError } from "./routing.ts";

type OsrmLeg = {
  distance: number;
  duration: number;
};

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function routeResponse(
  distance: number,
  duration: number,
  coordinates: [number, number][],
  legs: OsrmLeg[],
) {
  return {
    code: "Ok",
    routes: [{
      distance,
      duration,
      geometry: { type: "LineString", coordinates },
      legs,
    }],
  };
}

Deno.test("OSRM uses longitude-first coordinates and road legs", async () => {
  let requestedUrl = "";
  let requestedHeaders: Headers | undefined;
  const response = jsonResponse(routeResponse(
    12_000,
    1_200,
    [
      [31.2, 30.1],
      [31.3, 30.2],
    ],
    [{ distance: 12_000, duration: 1_200 }],
  ));
  const result = await routeWithOsrm(
    [
      { lat: 30.1, lng: 31.2 },
      { lat: 30.2, lng: 31.3 },
    ],
    {
      fetcher: (input, init) => {
        requestedUrl = String(input);
        requestedHeaders = new Headers(init?.headers);
        return Promise.resolve(response);
      },
    },
  );

  const url = new URL(requestedUrl);
  assertEquals(
    url.pathname,
    "/route/v1/driving/31.2,30.1;31.3,30.2",
  );
  assertEquals(url.searchParams.get("geometries"), "geojson");
  assertEquals(result.provider, "osrm_demo");
  assertEquals(result.distance_km, 12);
  assertEquals(result.duration_min, 20);
  assertEquals(result.geometry.coordinates, [
    [31.2, 30.1],
    [31.3, 30.2],
  ]);
  assertEquals(result.segments[0], {
    from_stop_sequence: 1,
    to_stop_sequence: 2,
    distance_km: 12,
    duration_min: 20,
  });
  assertEquals(
    requestedHeaders?.get("referer"),
    "https://sekka-go.pages.dev/",
  );
});

Deno.test("identical neighboring stops keep their sequence", async () => {
  const response = jsonResponse(routeResponse(
    2_000,
    600,
    [
      [31, 30],
      [31.1, 30.1],
    ],
    [{ distance: 2_000, duration: 600 }],
  ));
  const result = await routeWithOsrm(
    [
      { lat: 30, lng: 31 },
      { lat: 30, lng: 31 },
      { lat: 30.1, lng: 31.1 },
    ],
    {
      fetcher: () => Promise.resolve(response),
    },
  );

  assertEquals(result.segments, [
    {
      from_stop_sequence: 1,
      to_stop_sequence: 2,
      distance_km: 0,
      duration_min: 0,
    },
    {
      from_stop_sequence: 2,
      to_stop_sequence: 3,
      distance_km: 2,
      duration_min: 10,
    },
  ]);
});

Deno.test("invalid coordinates fail before an upstream request", async () => {
  let requested = false;
  const request = () =>
    routeWithOsrm(
      [
        { lat: 91, lng: 31 },
        { lat: 30, lng: 32 },
      ],
      {
        fetcher: () => {
          requested = true;
          return Promise.resolve(jsonResponse({}));
        },
      },
    );
  await assertRejects(
    request,
    RoutingError,
    "اختر نقطتين صحيحتين",
  );
  assertEquals(requested, false);
});

Deno.test("bad route geometry does not draw a line", async () => {
  const response = jsonResponse(routeResponse(
    1_000,
    300,
    [
      [31, 30],
      [31.1, 30.1],
    ],
    [],
  ));
  const request = () =>
    routeWithOsrm(
      [
        { lat: 30, lng: 31 },
        { lat: 30.1, lng: 31.1 },
      ],
      {
        fetcher: () => Promise.resolve(response),
      },
    );
  await assertRejects(
    request,
    RoutingError,
    "بيانات غير مكتملة",
  );
});
