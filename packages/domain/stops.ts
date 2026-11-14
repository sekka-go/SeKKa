export type Stop = { id: string; name: string; area: string; pickup: boolean; dropoff: boolean };
export function selectStops(stops: readonly Stop[], pickup: string, dropoff: string, returnStops?: readonly Stop[]) {
  const from = stops.findIndex(s => s.id === pickup && s.pickup);
  const to = stops.findIndex(s => s.id === dropoff && s.dropoff);
  if (from < 0 || to <= from) throw new Error('INVALID_STOP_ORDER');
  if (returnStops) {
    const backFrom = returnStops.findIndex(s => s.id === dropoff && s.pickup);
    const backTo = returnStops.findIndex(s => s.id === pickup && s.dropoff);
    if (backFrom < 0 || backTo <= backFrom) throw new Error('RETURN_STOPS_UNSUPPORTED');
  }
  return Object.freeze({ pickup: stops[from], dropoff: stops[to], returnPickup: returnStops ? stops[to] : null, returnDropoff: returnStops ? stops[from] : null });
}
export function matchesStops(stops: readonly Stop[], origin: string, destination: string) {
  return stops.some((s, i) => s.area === origin && s.pickup && stops.slice(i+1).some(d => d.area === destination && d.dropoff));
}
