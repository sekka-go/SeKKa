/**
 * Clean up *every* attempted QA booking, including bookings committed before
 * a lost HTTP response. A booking is identified by its fresh idempotency key
 * and signed-in Rider identity; no customer booking can match those keys.
 * Pure dependency injection permits failure-path tests without credentials.
 */
export async function cleanupQaSeatAttempts({riders,riderIds,routeId,attemptKeys,check}){
 const errors=[];
 let cancelled=0;
 for(let i=0;i<riders.length;i++){
  try{
   const rows=check(await riders[i].from('v31_bookings')
    .select('id,status').eq('route_id',routeId).eq('rider_id',riderIds[i])
    .eq('idempotency_key',attemptKeys[i]),'find own QA booking for cleanup');
   for(const row of rows){
    if(row.status==='pending'){
     check(await riders[i].rpc('v31_cancel_pending_booking',{p_booking:row.id}),'cancel own QA booking');
     cancelled++;
    }else if(row.status==='confirmed'){
     errors.push(`RIDER_${i+1}_BOOKING_CONFIRMED_REQUIRES_REVIEW`);
    }
   }
  }catch(e){
   errors.push(`RIDER_${i+1}_CLEANUP_FAILED: ${e instanceof Error?e.message:'unknown'}`);
  }
 }
 try{
  const available=check(await riders[0].rpc('v31_published_route_available_seats',{p_route:routeId}),
   'QA route capacity after cleanup');
  if(available!==1)errors.push('QA_CAPACITY_NOT_RESTORED');
 }catch(e){
  errors.push('QA_AVAILABILITY_VERIFICATION_FAILED: '+(e instanceof Error?e.message:'unknown'));
 }
 if(errors.length)throw new Error(errors.join('; '));
 return {cancelled};
}
