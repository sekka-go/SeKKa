import {
  dedupeLocationSuggestions,
  formatNominatimAddress,
  formatPhotonAddress,
  isGreaterCairoPoint,
  normalizeLocationQuery,
} from "./locations.ts";

Deno.test("location query normalization handles width, spaces, and case", () => {
  const normalized = normalizeLocationQuery("  Ｃａｉｒｏ　   Downtown  ");
  if (normalized !== "cairo downtown") {
    throw new Error(`Unexpected normalized query: ${normalized}`);
  }
});

Deno.test("Photon address formatting prefers place and local context", () => {
  const address = formatPhotonAddress({
    "name:ar": "جامعة القاهرة",
    street: "شارع الجامعة",
    district: "الجيزة",
    city: "الجيزة",
  });

  if (address.primary !== "جامعة القاهرة") {
    throw new Error(`Unexpected primary label: ${address.primary}`);
  }
  if (
    !address.label.includes("شارع الجامعة") || !address.label.includes("الجيزة")
  ) {
    throw new Error(`Expected street and district context: ${address.label}`);
  }
});

Deno.test("Nominatim address formatting falls back to useful locality", () => {
  const address = formatNominatimAddress({
    display_name: "المنصورة، الدقهلية، مصر",
    address: { city: "المنصورة", state: "الدقهلية" },
  });

  if (
    address.primary !== "المنصورة" || !address.secondary.includes("الدقهلية")
  ) {
    throw new Error(`Unexpected Nominatim address: ${JSON.stringify(address)}`);
  }
});

Deno.test("location suggestions deduplicate normalized labels and coordinates", () => {
  const unique = dedupeLocationSuggestions([
    {
      label: "جامعة القاهرة، الجيزة",
      primary: "جامعة القاهرة",
      secondary: "الجيزة",
      lat: 30.027,
      lng: 31.208,
    },
    {
      label: " جامعة القاهرة، الجيزة ",
      primary: "جامعة القاهرة",
      secondary: "الجيزة",
      lat: 30.028,
      lng: 31.209,
    },
    {
      label: "مكان آخر",
      primary: "مكان آخر",
      secondary: "الجيزة",
      lat: 30.027001,
      lng: 31.208001,
    },
  ]);

  if (unique.length !== 1 || unique[0].label !== "جامعة القاهرة، الجيزة") {
    throw new Error(`Unexpected deduplicated suggestions: ${unique.length}`);
  }
});

Deno.test("Greater Cairo coordinate boundary is enforced", () => {
  if (!isGreaterCairoPoint(30.0, 31.0)) {
    throw new Error("Cairo point rejected.");
  }
  if (isGreaterCairoPoint(31.0, 31.0)) {
    throw new Error("Outside point accepted.");
  }
});
