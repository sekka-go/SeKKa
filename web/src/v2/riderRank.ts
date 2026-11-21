export type SortMode='recommended'|'time'|'price'|'seats';
export type ComparableRide={
 route:{seat_price_egp:number;outbound_time:string|null;return_time:string|null};
 reverse:boolean;remaining:number;pickupDistanceKm:number|null;dropoffDistanceKm?:number|null;
};
export function sortRealRides<T extends ComparableRide>(
 items:readonly T[],sort:SortMode,hasLocation:boolean
):T[]{
 const departure=(item:T)=>(item.reverse?item.route.return_time:item.route.outbound_time)||'99:99';
 const distance=(item:T)=>item.pickupDistanceKm!==null&&Number.isFinite(item.pickupDistanceKm)&&item.pickupDistanceKm>=0
  ?item.pickupDistanceKm:Number.POSITIVE_INFINITY;
 return [...items].sort((a,b)=>{
  if(sort==='price')return a.route.seat_price_egp-b.route.seat_price_egp;
  if(sort==='seats')return b.remaining-a.remaining;
  if(sort==='recommended'&&hasLocation){
   // Prefer routes that minimize the combined distance to the Captain's
   // real pickup AND drop-off stops, not merely the nearest pickup alone.
   const endpoint=(item:T)=>item.dropoffDistanceKm!==null&&item.dropoffDistanceKm!==undefined&&
    Number.isFinite(item.dropoffDistanceKm)&&item.dropoffDistanceKm>=0?item.dropoffDistanceKm:0;
   const total=(item:T)=>distance(item)+endpoint(item);
   const delta=total(a)-total(b);
   if(Number.isFinite(delta)&&delta!==0)return delta;
   if(Number.isFinite(total(a))!==Number.isFinite(total(b)))
    return Number.isFinite(total(a))?-1:1;
   const pickupDelta=distance(a)-distance(b);
   if(Number.isFinite(pickupDelta)&&pickupDelta!==0)return pickupDelta;
  }
  return departure(a).localeCompare(departure(b));
 });
}
