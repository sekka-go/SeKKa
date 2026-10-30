export type RiderOfferCandidate = {
  id: number;
  captain_verified: boolean;
  vehicle_type_id: string;
  seats_available?: number;
  seats?: number;
};

/** Keep only server-confirmed eligible offers with enough seats for display. */
export function filterRiderOfferCandidates<T extends RiderOfferCandidate>(
  candidates: T[],
  passengerCount: number,
  vehicleTypeId: string,
): T[] {
  const unique = new Map<number, T>();
  for (const candidate of candidates) {
    const availableSeats = candidate.seats_available ?? candidate.seats ?? 0;
    if (!candidate.captain_verified || availableSeats < passengerCount) continue;
    if (vehicleTypeId !== "all" && candidate.vehicle_type_id !== vehicleTypeId) continue;
    if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
  }
  return [...unique.values()];
}
