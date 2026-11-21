import {straightLineKm,validCoordinates} from './nearbyRoutes.ts';
import type {GeoPoint} from './nearbyRoutes.ts';

/** Informational only. Default launch band is owner-approved (7–12 EGP/km),
 * but this estimate is NOT OSRM driving distance, nor a publish authorization.
 * Do not persist the result or enforce a final price without the routing
 * distance source and configurable server policy.
 */
export type PriceBand={distanceKm:number;minimumEgp:number;maximumEgp:number;source:'haversine_estimate'};
export function draftPriceGuidance(
 stops:GeoPoint[],priceMinEgpKm=7,priceMaxEgpKm=12
):PriceBand|null{
 if(stops.length<2||stops.length>30||
    !stops.every(validCoordinates)||
    !Number.isFinite(priceMinEgpKm)||priceMinEgpKm<=0||
    !Number.isFinite(priceMaxEgpKm)||priceMaxEgpKm<priceMinEgpKm)return null;
 let direct=0;
 for(let i=1;i<stops.length;i++){
  const segment=straightLineKm(stops[i-1],stops[i]);
  if(!Number.isFinite(segment))return null;
  direct+=segment;
 }
 if(direct<0.1)return null;
 const distanceKm=direct*1.35;
 return {
  distanceKm:Math.round(distanceKm*10)/10,
  minimumEgp:Math.ceil(distanceKm*priceMinEgpKm),
  maximumEgp:Math.ceil(distanceKm*priceMaxEgpKm),
  source:'haversine_estimate'
 };
}
export function outsideDraftPriceGuidance(price:number,band:PriceBand|null):boolean{
 return !!band&&Number.isFinite(price)&&price>0&&
  (price<band.minimumEgp||price>band.maximumEgp);
}
