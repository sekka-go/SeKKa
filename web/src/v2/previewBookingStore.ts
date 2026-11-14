import { reservePreview, confirmPreview, type PreviewLedger } from '../../../packages/domain/previewBooking';
import type { Line } from './Discovery';
import type { Quote } from './api';
const key='sekka.preview.bookingLedger.v31';
export type PreviewBookingLedger=PreviewLedger<Line,Quote>;
export function readPreviewBookings():PreviewBookingLedger {
 try {const v=JSON.parse(sessionStorage.getItem(key)||'null');if(v && Number.isFinite(v.available) && Number.isFinite(v.reserved) && Array.isArray(v.bookings))return v;}catch{/* A new preview session is safe; no server money exists. */}
 return {available:150,reserved:0,bookings:[]};
}
function save(state:PreviewBookingLedger){sessionStorage.setItem(key,JSON.stringify(state));return state;}
export function reservePreviewBooking(offer:Line,quote:Quote){
 if(!offer.selectedStops)throw Error('INVALID_STOP_ORDER');
 return save(reservePreview(readPreviewBookings(),{id:`preview-${offer.id}`,offerId:offer.id,offer,quote,availableSeats:offer.available,reservedAt:new Date().toISOString()}));
}
export function confirmPreviewBooking(id:string,actor:'rider'|'captain'){
 return save(confirmPreview(readPreviewBookings(),id,actor,new Date().toISOString()));
}

export function previewSubscriberRows(ledger: PreviewBookingLedger) {
  return ledger.bookings.map(b => ({
    id: b.id, route_id: b.offer.routeId || b.offerId, rider_name: "راكب المعاينة",
    origin: b.offer.origin, destination: b.offer.destination,
    price: b.quote.price, starts_on: b.quote.start, ends_before: b.quote.endExclusive,
    period: b.offer.period, direction: b.offer.direction, category: b.offer.category,
    pickup_stop: b.offer.selectedStops?.pickup.name, dropoff_stop: b.offer.selectedStops?.dropoff.name,
    status: b.securityReleased ? "confirmed" : "reserved",
    security_state: b.securityReleased ? "released" : "reserved",
    rider_paid_at: b.riderPaid ? b.riderPaidAt || b.quote.start : null,
    captain_received_at: b.captainReceived ? b.captainReceivedAt || b.quote.start : null,
    created_at: b.reservedAt || b.quote.start,
  }));
}

export function previewSecurityTransactions(ledger: PreviewBookingLedger) {
  return ledger.bookings.flatMap(b => {
    const reserve = {id: b.id + "-reserve", kind: "reserve", available_delta: -100,
      reserved_delta: 100, created_at: b.reservedAt || b.quote.start};
    return b.securityReleased ? [reserve, {id: b.id + "-release", kind: "release",
      available_delta: 100, reserved_delta: -100, created_at: b.releasedAt || b.quote.start}] : [reserve];
  });
}
