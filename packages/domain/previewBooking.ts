// Deterministic frontend simulation only. Never a financial ledger or server authority.
export type PreviewReservation<Offer, Quote> = {
  id: string; offerId: string; offer: Offer; quote: Quote;
  reservedAt?: string; riderPaidAt?: string; captainReceivedAt?: string; releasedAt?: string;
  riderPaid: boolean; captainReceived: boolean; securityReleased: boolean;
};
export type PreviewLedger<Offer, Quote> = {
  available: number; reserved: number;
  bookings: PreviewReservation<Offer, Quote>[];
};
export function reservePreview<Offer, Quote>(
  state: PreviewLedger<Offer, Quote>,
  input: { id: string; offerId: string; offer: Offer; quote: Quote; availableSeats: number; reservedAt?: string },
): PreviewLedger<Offer, Quote> {
  // Retry returns the same locked terms, without reserving another seat or EGP 100.
  if (state.bookings.some(b => b.id === input.id)) return state;
  if (!Number.isInteger(input.availableSeats) || input.availableSeats < 1 ||
      state.bookings.filter(b => b.offerId === input.offerId).length >= input.availableSeats)
    throw new Error('SOLD_OUT');
  if (!Number.isFinite(state.available) || state.available < 100) throw new Error('INSUFFICIENT_SECURITY');
  return {...state, available: state.available - 100, reserved: state.reserved + 100,
    bookings: [...state.bookings, {...structuredClone(input), riderPaid:false, captainReceived:false, securityReleased:false}]};
}
export function confirmPreview<Offer, Quote>(state: PreviewLedger<Offer, Quote>, id: string, actor: 'rider'|'captain', at?: string): PreviewLedger<Offer, Quote> {
  const booking = state.bookings.find(b => b.id === id);
  if (!booking) throw new Error('BOOKING_REQUIRED');
  const updated = {...booking, riderPaid: booking.riderPaid || actor === 'rider', captainReceived: booking.captainReceived || actor === 'captain'};
  const release = updated.riderPaid && updated.captainReceived && !booking.securityReleased;
  if (actor === 'rider' && !booking.riderPaid) updated.riderPaidAt = at;
  if (actor === 'captain' && !booking.captainReceived) updated.captainReceivedAt = at;
  if (release) updated.releasedAt = at;
  updated.securityReleased = booking.securityReleased || release;
  return {...state, available: state.available + (release ? 100 : 0), reserved: state.reserved - (release ? 100 : 0), bookings: state.bookings.map(b => b.id === id ? updated : b)};
}
