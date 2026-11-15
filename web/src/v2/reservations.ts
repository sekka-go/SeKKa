import {client} from './api';

export type SeatReservationResult = {bookingId:string};

/**
 * Reserve capacity after Google Auth. OTP and payments are postponed.
 * The database locks the route row and checks capacity atomically.
 * Never interpret this as a payment confirmation.
 */
export async function reserveSeats(routeId:string,seats:number,idempotencyKey:string):Promise<SeatReservationResult>{
  if(!client)throw new Error('BACKEND_NOT_CONFIGURED');
  if(!routeId||!Number.isInteger(seats)||seats<1||seats>13)throw new Error('INVALID_SEATS');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey))throw new Error('INVALID_IDEMPOTENCY_KEY');
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error('AUTH_REQUIRED');
  const {data,error}=await client.rpc('v31_reserve_seats',{
    p_route:routeId,p_seats:seats,p_idempotency:idempotencyKey,
  });
  if(error)throw new Error(error.message);
  if(typeof data!=='string')throw new Error('BOOKING_NOT_CONFIRMED');
  return {bookingId:data};
}

/** Cancel only the current rider's pending booking; the database releases capacity atomically. */
export async function cancelPendingBooking(bookingId:string):Promise<void>{
  if(!client)throw new Error('BACKEND_NOT_CONFIGURED');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingId))throw new Error('INVALID_BOOKING_ID');
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error('AUTH_REQUIRED');
  const {data,error}=await client.rpc('v31_cancel_pending_booking',{p_booking:bookingId});
  if(error)throw new Error(error.message);
  if(data!==true)throw new Error('CANCELLATION_NOT_CONFIRMED');
}

/**
 * Complete reservation: immutable route price/period and validated ordered stop IDs
 * are copied into the booking by a single atomic server transaction.
 */
export async function reserveSeatsWithStops(routeId:string,seats:number,idempotencyKey:string,pickupStopId:string,dropoffStopId:string,reverse=false):Promise<SeatReservationResult>{
 if(!client)throw new Error('BACKEND_NOT_CONFIGURED');
 if(!routeId||!Number.isInteger(seats)||seats<1||seats>13)throw new Error('INVALID_SEATS');
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user)throw new Error('AUTH_REQUIRED');
 const {data,error}=await client.rpc('v31_reserve_seats_with_stops',{
  p_route:routeId,p_seats:seats,p_idempotency:idempotencyKey,
  p_pickup:pickupStopId,p_dropoff:dropoffStopId,p_reverse:reverse
 });
 if(error)throw new Error(error.message);
 if(typeof data!=='string')throw new Error('BOOKING_NOT_CONFIRMED');
 return {bookingId:data};
}
