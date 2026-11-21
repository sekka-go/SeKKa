/**
 * Portable geometry helpers for the new daily-commute experience.
 * PostGIS geography is authoritative for PRODUCTION distances and stop order;
 * these helpers format returned metres and provide deterministic client tests.
 */
export type Point = Readonly<{lat:number;lng:number}>;
export type Place = Point & Readonly<{id:string}>;
export const DUPLICATE_STOP_RADIUS_METERS = 50;
export const COVERAGE_RADIUS_METERS = 30_000;
const RADIUS_METERS = 6_371_008.8;

export function validPoint(p:Point):boolean {
 return Number.isFinite(p.lat)&&Number.isFinite(p.lng) &&
   p.lat>=-90&&p.lat<=90&&p.lng>=-180&&p.lng<=180;
}
export function greatCircleDistanceMeters(a:Point,b:Point):number {
 if(!validPoint(a)||!validPoint(b)) throw new RangeError('Invalid WGS84 point');
 const radians=Math.PI/180;
 const dLat=(b.lat-a.lat)*radians,dLng=(b.lng-a.lng)*radians;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(dLng/2)**2;
 return 2*RADIUS_METERS*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
/** Values are metres from PostGIS geography; never invent absent distances. */
export function formatDistanceMeters(metres:number):string {
 if(!Number.isFinite(metres)||metres<0) throw new RangeError('Invalid distance');
 if(metres<1000) return `${Math.round(metres/10)*10} م`;
 return `${(metres/1000).toFixed(1)} كم`;
}
/** Use Arabic units in Arabic UI and Latin units in English UI. */
export function formatDistanceForLocale(metres:number,english:boolean):string {
 const arabic=formatDistanceMeters(metres);
 if(!english)return arabic;
 return metres<1000?`${Math.round(metres/10)*10} m`:`${(metres/1000).toFixed(1)} km`;
}
export function approximateWalkMinutes(straightLineMetres:number):number {
 if(!Number.isFinite(straightLineMetres)||straightLineMetres<0) throw new RangeError('Invalid distance');
 return Math.ceil(straightLineMetres*1.3/80);
}
/** Road-aware routing can later replace the explicit approximate estimator. */
export interface WalkingRouteEngine {
 distanceMeters(from:Point,to:Point):Promise<number>;
}
export async function walkingEstimate(from:Point,to:Point,engine?:WalkingRouteEngine):
 Promise<{metres:number;minutes:number;approximate:boolean}> {
 const direct=greatCircleDistanceMeters(from,to);
 const metres=engine ? await engine.distanceMeters(from,to) : direct*1.3;
 if(!Number.isFinite(metres)||metres<0) throw new RangeError('Invalid routed distance');
 return {metres,minutes:Math.ceil(metres/80),approximate:!engine};
}
/** Mirrors the requested distance-order spec; PostGIS ST_Distance determines live order. */
export function orderStopsFarthestFirst<T extends Place>(stops:readonly T[],destination:Point):T[] {
 return [...stops].sort((a,b)=>{
  const delta=greatCircleDistanceMeters(b,destination)-greatCircleDistanceMeters(a,destination);
  return Math.abs(delta)>0.000001?delta:a.id.localeCompare(b.id);
 });
}
/** Reuse nearest stop within 50 metres (inclusive); confirm again in an atomic database RPC. */
export function findDuplicateStop<T extends Place>(candidate:Point,existing:readonly T[],radius=50):T|null {
 if(!Number.isFinite(radius)||radius<0) throw new RangeError('Invalid dedupe radius');
 const nearest=existing.map(stop=>({stop,metres:greatCircleDistanceMeters(candidate,stop)}))
  .filter(x=>x.metres<=radius).sort((a,b)=>a.metres-b.metres||a.stop.id.localeCompare(b.stop.id));
 return nearest[0]?.stop??null;
}
export function coverageDistanceMetres(point:Point,available:readonly Point[]):number|null {
 if(!validPoint(point)) throw new RangeError('Invalid WGS84 point');
 return available.length?Math.min(...available.map(x=>greatCircleDistanceMeters(point,x))):null;
}
