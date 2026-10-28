import { api } from "../api";
import { getLanguage, t } from "../i18n/runtime";

export type LocationAddress = { label: string; primary: string; secondary: string };
export type LocationSuggestion = LocationAddress & { lat: number; lng: number };

export function reverseGeocode(token: string, lat: number, lng: number) {
  return api<LocationAddress>("/locations/reverse", { method: "POST", token, body: { lat, lng } });
}

export function safeAddressLabel(label: string | null | undefined) {
  const value = (label ?? "").trim();
  const coordinatePair = /(?<![\d.])-?\d{1,2}\.\d{3,}\s*[,،]\s*-?\d{1,3}\.\d{3,}(?![\d.])/g;
  if (!coordinatePair.test(value)) return value;
  const withoutCoordinates = value.replace(coordinatePair, "").replace(/[\s·•،,؛:–—-]+$/g, "").trim();
  return withoutCoordinates || t("موقع محدد على الخريطة");
}

export function addressParts(label: string | null | undefined) {
  const [primary, ...secondary] = safeAddressLabel(label).split(/[،,]/).map((part) => part.trim()).filter(Boolean);
  return { primary: primary ?? t("موقع محدد على الخريطة"), secondary: secondary.join(getLanguage() === "ar" ? "، " : ", ") };
}
