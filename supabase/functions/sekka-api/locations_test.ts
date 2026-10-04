import { assertEquals } from "@std/assert";
import {
  dedupeLocationSuggestions,
  formatNominatimAddress,
  formatPhotonAddress,
  isGreaterCairoPoint,
  normalizeLocationQuery,
} from "./locations.ts";

Deno.test("location labels prioritize a named place and put the street and district second", () => {
  assertEquals(
    formatNominatimAddress({
      name: "مركز طبي",
      display_name:
        "مركز طبي، شارع النصر، النرجس، القاهرة الجديدة، القاهرة، مصر",
      address: {
        road: "شارع النصر",
        neighbourhood: "النرجس",
        suburb: "القاهرة الجديدة",
        city: "القاهرة",
        state: "القاهرة",
      },
      namedetails: { "name:ar": "مركز طبي" },
    }),
    {
      primary: "مركز طبي",
      secondary: "شارع النصر، النرجس، القاهرة الجديدة، القاهرة",
      label: "مركز طبي، شارع النصر، النرجس، القاهرة الجديدة، القاهرة",
    },
  );
});

Deno.test("Photon address formatting falls back to street and removes repeated localities", () => {
  assertEquals(
    formatPhotonAddress({
      name: "النرجس",
      street: "شارع التسعين",
      housenumber: "12",
      district: "النرجس",
      suburb: "القاهرة الجديدة",
      city: "القاهرة الجديدة",
    }),
    {
      primary: "شارع التسعين 12",
      secondary: "النرجس، القاهرة الجديدة",
      label: "شارع التسعين 12، النرجس، القاهرة الجديدة",
    },
  );
});

Deno.test("search normalization and deduplication are stable across whitespace and repeated coordinates", () => {
  assertEquals(
    normalizeLocationQuery("  شارع   النصر "),
    normalizeLocationQuery("شارع النصر"),
  );
  const first = {
    primary: "شارع النصر",
    secondary: "القاهرة",
    label: "شارع النصر، القاهرة",
    lat: 30.04,
    lng: 31.23,
  };
  const duplicateLabel = { ...first, label: "شارع النصر ، القاهرة" };
  const duplicateCoordinates = {
    ...first,
    primary: "مدخل شارع النصر",
    label: "مدخل شارع النصر، القاهرة",
  };
  assertEquals(
    dedupeLocationSuggestions([first, duplicateLabel, duplicateCoordinates]),
    [first],
  );
});

Deno.test("Greater Cairo bounds keep edge points and reject locations outside service area", () => {
  assertEquals(isGreaterCairoPoint(29.65, 30.55), true);
  assertEquals(isGreaterCairoPoint(30.45, 31.85), true);
  assertEquals(isGreaterCairoPoint(30.451, 31.2), false);
  assertEquals(isGreaterCairoPoint(30.04, 31.851), false);
});
