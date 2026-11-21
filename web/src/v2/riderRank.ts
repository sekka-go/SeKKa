export type SortMode='recommended'|'time'|'price'|'seats';
export type ComparableRide={
 route:{seat_price_egp:number;outbound_time:string|null;return_time:string|null};
 reverse:boolean;remaining:number;pickupDistanceKm:number|null;
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
   const delta=distance(a)-distance(b);
   if(Number.isFinite(delta)&&delta!==0)return delta;
   if(Number.isFinite(distance(a))!==Number.isFinite(distance(b)))
    return Number.isFinite(distance(a))?-1:1;
  }
  return departure(a).localeCompare(departure(b));
 });
}
