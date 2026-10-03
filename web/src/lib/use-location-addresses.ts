import { useEffect, useState } from "react";
import type { MapPoint } from "../MapPicker";
import { reverseGeocode, type LocationAddress } from "./location-address";

const addressCache = new Map<string, LocationAddress>();
const pointKey = (point: MapPoint) => `${point.lat}:${point.lng}`;

export function useResolvedLocationPoints(token: string, points: MapPoint[]) {
  const key = points.filter((point) => typeof point.lat === "number" && typeof point.lng === "number")
    .map(pointKey).join("|");
  const [, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const unique = new Map<string, MapPoint>();
    for (const point of points) {
      if (typeof point.lat !== "number" || typeof point.lng !== "number" || addressCache.has(pointKey(point))) continue;
      unique.set(pointKey(point), point);
    }
    if (!unique.size) return () => { active = false; };
    void Promise.all([...unique].map(async ([key, point]) => {
      try { addressCache.set(key, await reverseGeocode(token, point.lat!, point.lng!)); }
      catch { addressCache.set(key, { label: "عنوان قريب غير متاح", primary: "عنوان قريب غير متاح", secondary: "" }); }
    })).then(() => { if (active) setRevision((revision) => revision + 1); });
    return () => { active = false; };
  // The stable coordinate key avoids repeating lookups when callers rebuild point objects.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key]);

  return points.map((point) => {
    if (typeof point.lat !== "number" || typeof point.lng !== "number") return { ...point, label: "الموقع غير متاح", primaryLabel: "الموقع غير متاح", secondaryLabel: "" };
    const address = addressCache.get(pointKey(point));
    return address ? { ...point, label: address.label, primaryLabel: address.primary, secondaryLabel: address.secondary }
      : { ...point, label: point.label ?? "عنوان محدد على الخريطة", primaryLabel: point.primaryLabel ?? "جارٍ تحديد العنوان…", secondaryLabel: point.secondaryLabel ?? "" };
  });
}
