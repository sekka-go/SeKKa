import { routeWithOsrm, RoutingError } from "./routing.ts";

function mockRouteResponse(
  legs: Array<{ distance: number; duration: number }>,
) {
  return new Response(
    JSON.stringify({
      code: "Ok",
      routes: [{
        distance: legs.reduce((total, leg) => total + leg.distance, 0),
        duration: legs.reduce((total, leg) => total + leg.duration, 0),
        geometry: {
          type: "LineString",
          coordinates: [[31.2, 30.0], [31.3, 30.1]],
        },
        legs,
      }],
    }),
    { headers: { "content-type": "application/json" } },
  );
}

Deno.test("OSRM result converts units and maps duplicate stops", async () => {
  let requestUrl = "";
  const result = await routeWithOsrm([
    { lat: 30.0, lng: 31.2 },
    { lat: 30.0, lng: 31.2 },
    { lat: 30.1, lng: 31.3 },
  ], {
    fetcher: async (input) => {
      requestUrl = String(input);
      return mockRouteResponse([{ distance: 1_500, duration: 600 }]);
    },
  });

  const requestedCoordinates = new URL(requestUrl).pathname.split("/").at(-1);
  if (requestedCoordinates !== "31.2,30;31.3,30.1") {
    throw new Error(`Unexpected OSRM request: ${requestUrl}`);
  }
  if (result.distance_km !== 1.5 || result.duration_min !== 10) {
    throw new Error("OSRM distance/time units were not converted.");
  }
  if (result.segments.length !== 2 || result.segments[0].distance_km !== 0) {
    throw new Error(
      "Duplicate stop segment was not represented as zero length.",
    );
  }
});

Deno.test("OSRM rejects invalid or duplicate-only point sets", async () => {
  for (
    const points of [
      [{ lat: 30, lng: 31 }],
      [{ lat: 30, lng: 31 }, { lat: 30, lng: 31 }],
      [{ lat: 91, lng: 31 }, { lat: 30, lng: 31 }],
    ]
  ) {
    try {
      await routeWithOsrm(points);
      throw new Error("Invalid points unexpectedly routed.");
    } catch (cause) {
      if (!(cause instanceof RoutingError) || cause.status !== 400) throw cause;
    }
  }
});

Deno.test("OSRM rejects malformed route results without inventing geometry", async () => {
  try {
    await routeWithOsrm([
      { lat: 30.0, lng: 31.2 },
      { lat: 30.1, lng: 31.3 },
    ], {
      fetcher: async () =>
        new Response(JSON.stringify({ code: "NoRoute", routes: [] })),
    });
    throw new Error("Malformed OSRM response unexpectedly succeeded.");
  } catch (cause) {
    if (!(cause instanceof RoutingError) || cause.status !== 502) throw cause;
  }
});

Deno.test("OSRM maps upstream failures to a safe service error", async () => {
  try {
    await routeWithOsrm([
      { lat: 30.0, lng: 31.2 },
      { lat: 30.1, lng: 31.3 },
    ], { fetcher: async () => new Response("", { status: 503 }) });
    throw new Error("Upstream failure unexpectedly succeeded.");
  } catch (cause) {
    if (!(cause instanceof RoutingError) || cause.status !== 503) throw cause;
  }
});
