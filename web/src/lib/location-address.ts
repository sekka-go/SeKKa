import { api } from "../api";

export type LocationAddress = { label: string; primary: string; secondary: string };
export type LocationSuggestion = LocationAddress & { lat: number; lng: number };

export function reverseGeocode(token: string, lat: number, lng: number) {
  return api<LocationAddress>("/locations/reverse", { method: "POST", token, body: { lat, lng } });
}

export function safeAddressLabel(label: string | null | undefined) {
  const value = (label ?? "").trim();
  return /^-?\d{1,3}(?:\.\d+)?\s*[,،]\s*-?\d{1,3}(?:\.\d+)?$/.test(value) ? "موقع محدد على الخريطة" : value;
}

export function addressParts(label: string | null | undefined) {
  const [primary, ...secondary] = safeAddressLabel(label).split(/[،,]/).map((part) => part.trim()).filter(Boolean);
  return { primary: primary ?? "موقع محدد على الخريطة", secondary: secondary.join("، ") };
}
