export type PublicOfferSnapshot = {
  origin: string;
  destination: string;
  service_date: string;
  arrival_time: string;
  return_arrival_time: string | null;
  service_days: number[];
  vehicle_type_id: "prime" | "daily" | "space" | "max";
  seats: number | null;
  price_per_seat: number | null;
};

type OfferShareInput = {
  origin_label: string;
  destination_label: string;
  arrival_time: string;
  return_arrival_time: string | null;
  service_days: number[];
  vehicle_type_id: string;
  seats?: number;
  seats_available?: number;
  price_per_seat: number | null;
};

const vehicleTypes = new Set(["prime", "daily", "space", "max"]);

export function createPublicOfferShareHash(offer: OfferShareInput, serviceDate: string): string | null {
  const snapshot: PublicOfferSnapshot = {
    origin: offer.origin_label.trim().slice(0, 120),
    destination: offer.destination_label.trim().slice(0, 120),
    service_date: serviceDate,
    arrival_time: offer.arrival_time.slice(0, 5),
    return_arrival_time: offer.return_arrival_time?.slice(0, 5) ?? null,
    service_days: offer.service_days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    vehicle_type_id: offer.vehicle_type_id as PublicOfferSnapshot["vehicle_type_id"],
    seats: offer.seats_available ?? offer.seats ?? null,
    price_per_seat: offer.price_per_seat,
  };

  if (!isValidSnapshot(snapshot)) return null;
  return `#${new URLSearchParams({ offer: JSON.stringify(snapshot) })}`;
}

export function readPublicOfferSnapshot(hash: string): PublicOfferSnapshot | null {
  if (hash.length > 5000) return null;
  try {
    const serialized = new URLSearchParams(hash.replace(/^#/, "")).get("offer");
    if (!serialized) return null;
    const value = JSON.parse(serialized) as unknown;
    return isValidSnapshot(value) ? value : null;
  } catch {
    return null;
  }
}

function isValidSnapshot(value: unknown): value is PublicOfferSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  const parsedDate = typeof snapshot.service_date === "string" ? new Date(`${snapshot.service_date}T00:00:00Z`) : null;
  const validDate = parsedDate !== null && /^\d{4}-\d{2}-\d{2}$/.test(snapshot.service_date as string)
    && Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === snapshot.service_date;
  const validTime = (time: unknown) => typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const validSeats = snapshot.seats === null || Number.isInteger(snapshot.seats) && Number(snapshot.seats) > 0 && Number(snapshot.seats) <= 13;
  const validPrice = snapshot.price_per_seat === null || typeof snapshot.price_per_seat === "number" && Number.isFinite(snapshot.price_per_seat) && snapshot.price_per_seat >= 0;

  return typeof snapshot.origin === "string" && snapshot.origin.length > 0 && snapshot.origin.length <= 120
    && typeof snapshot.destination === "string" && snapshot.destination.length > 0 && snapshot.destination.length <= 120
    && validDate
    && validTime(snapshot.arrival_time)
    && (snapshot.return_arrival_time === null || validTime(snapshot.return_arrival_time))
    && Array.isArray(snapshot.service_days) && snapshot.service_days.length > 0 && snapshot.service_days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    && typeof snapshot.vehicle_type_id === "string" && vehicleTypes.has(snapshot.vehicle_type_id)
    && validSeats
    && validPrice;
}