/** Cairo/Giza map places returned by Photon (OpenStreetMap).
 * Never manufacture a service-area ID from a map coordinate.
 * OSM is a discovery source; published Captain stops remain booking authority.
 */
import {straightLineKm,validCoordinates} from './nearbyRoutes.ts';
import type {GeoPoint} from './nearbyRoutes.ts';
export type MapPlace=GeoPoint&{id:string;name:string;detail:string;source:'map';locality?:string[]};
export type ServiceArea={id:number;name_ar:string;name_en:string};
export type PlaceChoice={kind:'service';area:ServiceArea}|{kind:'map';place:MapPlace};
type PhotonFeature={geometry?:{coordinates?:unknown};properties?:Record<string,unknown>};
const CAIRO_GIZA={south:29.45,north:30.45,west:30.45,east:31.95};
export function inLaunchRegion(p:GeoPoint):boolean{
 return validCoordinates(p)&&p.latitude>=CAIRO_GIZA.south&&p.latitude<=CAIRO_GIZA.north&&p.longitude>=CAIRO_GIZA.west&&p.longitude<=CAIRO_GIZA.east;
}
const value=(x:unknown)=>typeof x==='string'?x.trim():'';
export function mapPlacesFromPhoton(raw:unknown):MapPlace[]{
 if(!raw||typeof raw!=='object'||!('features' in raw)||!Array.isArray(raw.features))return [];
 const results:MapPlace[]=[];
 for(const item of raw.features as PhotonFeature[]){
  const coords=item.geometry?.coordinates,properties=item.properties;
  if(!Array.isArray(coords)||coords.length!==2||!properties)continue;
  const point={latitude:coords[1],longitude:coords[0]};
  if(typeof point.latitude!=='number'||typeof point.longitude!=='number'||!inLaunchRegion(point))continue;
  const country=value(properties.countrycode).toLowerCase();
  if(country&&country!=='eg')continue;
  const name=value(properties.name)||value(properties.street)||value(properties.district);
  if(!name)continue;
  const parts=[properties.district,properties.suburb,properties.neighbourhood,properties.city,properties.county,properties.state].map(value)
   .filter((part,i,all)=>!!part&&part!==name&&all.indexOf(part)===i);
  const id=String(properties.osm_id||'')+':'+String(properties.osm_type||'')+':'+point.latitude+':'+point.longitude;
  if(results.some(x=>x.id===id))continue;
  results.push({id,name,detail:parts.join(' · '),locality:parts,source:'map',...point});
 }
 return results.slice(0,8);
}
export const normalizedPlace=(name:string)=>name.normalize('NFKC').toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[إأآ]/g,'ا').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
export function serviceMatches(areas:ServiceArea[],query:string):ServiceArea[]{
 const q=normalizedPlace(query);
 if(!q)return [];
 return areas.filter(a=>normalizedPlace(a.name_ar).includes(q)||normalizedPlace(a.name_en).includes(q)).slice(0,12);
}
/** Map results and user-entered GPS stops must agree with the selected registered service area.
 * This is a fail-closed locality check, NOT a claim of administrative polygon accuracy.
 * Do not infer an area ID from coordinates, the query text, or broad Cairo/Giza bounds.
 */
export function placeMatchesArea(place:MapPlace,area:ServiceArea):boolean{
 const labels=(place.locality||[place.detail]).filter(Boolean);
 const known=[area.name_ar,area.name_en];
 const key=normalizedPlace(area.name_en);
 const aliases:Record<string,string[]>={
  'maadi':['el maadi','al maadi','المعادى'],
  'new cairo':['fifth settlement','5th settlement','التجمع الخامس','القاهره الجديده','القاهرة الجديدة'],
  'nasr city':['مدينة نصر','madinet nasr','nasr'],
  'dokki':['الدقي','الدقى','el dokki'],
  'mohandessin':['المهندسين','mohandiseen'],
  'zamalek':['الزمالك','el zamalek'],
  'sheikh zayed':['الشيخ زايد','sheikh zayed city','zayed city'],
  '6th of october':['6 october','6th october','مدينة 6 اكتوبر','مدينة ٦ أكتوبر','sixth of october'],
  'heliopolis':['مصر الجديدة','masr el gedida','misr el gedida']
 };
 known.push(...(aliases[key]||[]));
 const matches=(label:string,alias:string)=>{
  const a=normalizedPlace(alias).replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)));
  const l=normalizedPlace(label).replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)));
  return Boolean(a&&l)&&(l===a||l.startsWith(a+' ')||l.endsWith(' '+a)||l.includes(' '+a+' '));
 };
 return labels.some(label=>known.some(alias=>matches(label,alias)));
}
export function stopNearPoint(stop:GeoPoint,chosen:GeoPoint,radiusKm=3):boolean{
 return inLaunchRegion(chosen)&&validCoordinates(stop)&&straightLineKm(stop,chosen)<=radiusKm;
}
export function geoRequestAvailable(origin:PlaceChoice|null,destination:PlaceChoice|null):boolean{
 // Request RPC stores exact service-area IDs. A map place is not an ID; never
 // silently assign an unrelated zone or submit an inaccurate journey.
 return origin?.kind==='service'&&destination?.kind==='service'&&origin.area.id!==destination.area.id;
}
export const PHOTON_ATTRIBUTION='© OpenStreetMap contributors · Photon';
