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
 return save(reservePreview(readPreviewBookings(),{id:`preview-${offer.id}`,offerId:offer.id,offer,quote,availableSeats:offer.available}));
}
export function confirmPreviewBooking(id:string,actor:'rider'|'captain'){
 return save(confirmPreview(readPreviewBookings(),id,actor));
}
