export const GREATER_CAIRO = {
  south: 29.65,
  west: 30.55,
  north: 30.45,
  east: 31.85
};
export function isGreaterCairoPoint(lat, lng) {
  return lat >= GREATER_CAIRO.south && lat <= GREATER_CAIRO.north && lng >= GREATER_CAIRO.west && lng <= GREATER_CAIRO.east;
}
export function normalizeLocationQuery(query) {
  return query.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ar-EG");
}
function clean(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function unique(values) {
  return values.filter((value, index)=>value && values.findIndex((candidate)=>normalizeLocationQuery(candidate) === normalizeLocationQuery(value)) === index);
}
export function formatPhotonAddress(properties) {
  const text = (...keys)=>keys.map((key)=>properties[key]).find(clean)?.trim() ?? "";
  const name = text("name:ar", "name");
  const street = text("street:ar", "street", "road");
  const number = text("housenumber");
  const streetAddress = [
    street,
    number
  ].filter(Boolean).join(" ");
  const localities = unique([
    text("district"),
    text("suburb"),
    text("locality"),
    text("city"),
    text("county"),
    text("state")
  ]);
  const nameIsLocality = localities.some((part)=>normalizeLocationQuery(part) === normalizeLocationQuery(name));
  const primary = name && !nameIsLocality ? name : streetAddress || name || localities[0] || "موقع محدد على الخريطة";
  const secondary = unique([
    ...name && primary === name && streetAddress !== primary ? [
      streetAddress
    ] : [],
    ...localities
  ]).filter((part)=>normalizeLocationQuery(part) !== normalizeLocationQuery(primary)).join("، ").slice(0, 200);
  return {
    primary: primary.slice(0, 120),
    secondary,
    label: [
      primary,
      secondary
    ].filter(Boolean).join("، ").slice(0, 240)
  };
}
export function formatNominatimAddress(result) {
  const address = result.address ?? {};
  const names = result.namedetails ?? {};
  const get = (...keys)=>keys.map((key)=>address[key]).find(clean)?.trim() ?? "";
  const taggedName = [
    names["name:ar"],
    names.name,
    result.name
  ].find(clean)?.trim() ?? "";
  const addressName = get("amenity", "shop", "office", "tourism", "leisure", "historic", "building");
  const placeName = [
    taggedName,
    addressName && ![
      "yes",
      "residential",
      "commercial",
      "apartments"
    ].includes(addressName.toLocaleLowerCase("ar-EG")) ? addressName : ""
  ].find(clean)?.trim() ?? "";
  const road = get("road", "pedestrian", "footway", "residential", "path");
  const house = get("house_number");
  const street = [
    road,
    house
  ].filter(Boolean).join(" ");
  const localities = unique([
    "neighbourhood",
    "neighborhood",
    "quarter",
    "suburb",
    "city_district",
    "district",
    "borough",
    "city",
    "town",
    "village",
    "municipality",
    "state"
  ].map((key)=>get(key)));
  const displayFocus = result.display_name?.split(",")[0]?.trim() ?? "";
  const primary = placeName || street || displayFocus || localities[0] || "موقع محدد على الخريطة";
  const secondary = unique([
    ...street && street !== primary ? [
      street
    ] : [],
    ...localities
  ]).filter((value)=>normalizeLocationQuery(value) !== normalizeLocationQuery(primary)).join("، ").slice(0, 200);
  return {
    primary: primary.slice(0, 120),
    secondary,
    label: [
      primary,
      secondary
    ].filter(Boolean).join("، ").slice(0, 240)
  };
}
export function dedupeLocationSuggestions(suggestions) {
  const seenLabels = new Set();
  const seenCoordinates = new Set();
  return suggestions.filter((item)=>{
    const label = normalizeLocationQuery(item.label);
    const coordinates = `${item.lat.toFixed(5)}:${item.lng.toFixed(5)}`;
    if (seenLabels.has(label) || seenCoordinates.has(coordinates)) return false;
    seenLabels.add(label);
    seenCoordinates.add(coordinates);
    return true;
  });
}
