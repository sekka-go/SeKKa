/** Pure proximity ranking for public Captain stop coordinates.
 * Distances are straight-line approximations, NOT walking or driving routes.
 * Never persist or transmit the Rider's position to Supabase. */
export type GeoPoint={latitude:number;longitude:number};
export type NearbyStop=GeoPoint&{id:string;route_id:string;position:number;name:string;pickup_allowed:boolean;dropoff_allowed:boolean;area_id:number};
export type NearbyRoute={id:string;direction:string;return_supported:boolean};
export type NearbyCandidate={routeId:string;pickupStopId:string;dropoffStopId:string;reverse:boolean;pickupName:string;dropoffName:string;distanceKm:number};
export function validCoordinates(value:GeoPoint|null|undefined):value is GeoPoint{
 return !!value&&Number.isFinite(value.latitude)&&Number.isFinite(value.longitude)&&
  value.latitude>=-90&&value.latitude<=90&&value.longitude>=-180&&value.longitude<=180;
}
const radians=(v:number)=>v*Math.PI/180;
export function straightLineKm(a:GeoPoint,b:GeoPoint):number{
 if(!validCoordinates(a)||!validCoordinates(b))return NaN;
 const lat=radians(b.latitude-a.latitude),lng=radians(b.longitude-a.longitude);
 const v=Math.sin(lat/2)**2+Math.cos(radians(a.latitude))*Math.cos(radians(b.latitude))*Math.sin(lng/2)**2;
 return 6371.0088*2*Math.atan2(Math.sqrt(Math.min(1,v)),Math.sqrt(Math.max(0,1-v)));
}
export function nearbyPublishedStops(
 point:GeoPoint,routes:NearbyRoute[],stops:NearbyStop[],maxDistanceKm=5
):NearbyCandidate[]{
 if(!validCoordinates(point)||!Number.isFinite(maxDistanceKm)||maxDistanceKm<=0)return [];
 const nearby:NearbyCandidate[]=[];
 for(const route of routes){
  const sequence=stops.filter(s=>s.route_id===route.id).sort((a,b)=>a.position-b.position);
  if(sequence.length<2)continue;
  const directions:{reverse:boolean;enabled:boolean}[]=[
   {reverse:false,enabled:route.direction!=='return'},
   {reverse:true,enabled:route.direction!=='outbound'&&route.return_supported}
  ];
  for(const direction of directions){
   if(!direction.enabled)continue;
   const ordered=direction.reverse?[...sequence].reverse():sequence;
   // One candidate per route/direction: nearest eligible real pickup with
   // a later dropoff. This preserves the actual published stop order.
   let best:NearbyCandidate|null=null;
   for(let i=0;i<ordered.length-1;i++){
    const pickup=ordered[i];
    if(!validCoordinates(pickup))continue;
    if(direction.reverse?!pickup.dropoff_allowed:!pickup.pickup_allowed)continue;
    const dropoff=ordered.slice(i+1).find(s=>direction.reverse?s.pickup_allowed:s.dropoff_allowed);
    if(!dropoff)continue;
    const distanceKm=straightLineKm(point,pickup);
    if(distanceKm>maxDistanceKm)continue;
    if(!best||distanceKm<best.distanceKm)best={
     routeId:route.id,pickupStopId:pickup.id,dropoffStopId:dropoff.id,
     reverse:direction.reverse,pickupName:pickup.name,dropoffName:dropoff.name,distanceKm
    };
   }
   if(best)nearby.push(best);
  }
 }
 return nearby.sort((a,b)=>a.distanceKm-b.distanceKm);
}
