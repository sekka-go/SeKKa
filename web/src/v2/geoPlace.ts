import {straightLineKm} from './nearbyRoutes.ts';
import type {GeoPoint} from './nearbyRoutes.ts';
import {isInsideOperationalRegion} from './greaterCairoBoundary.ts';
import {localPlaceCatalog,serviceAreaAliases} from './locationCatalog.ts';
import type {CatalogPlace} from './locationCatalog.ts';

export type MapPlace=GeoPoint&{
 id:string;name:string;detail:string;source:'map';locality?:string[];
 kind?:'point'|'area'|'road'|'feature'; osmKey?:string;osmValue?:string;
};
export type ServiceArea={id:number;name_ar:string;name_en:string};
export type PlaceChoice={kind:'service';area:ServiceArea}|{kind:'map';place:MapPlace};
export const inLaunchRegion=isInsideOperationalRegion;
export const PHOTON_ATTRIBUTION='© OpenStreetMap contributors · Photon';
export const outsideCoverageMessage={
 ar:'المكان ده خارج نطاق تشغيل سِكّة حاليًا. بنخدم القاهرة الكبرى فقط.',
 en:"This location is outside seKKa's current service area. We currently serve Greater Cairo only."
};
export const noMatchingLocation={
 ar:'ملقيناش مكان مطابق داخل القاهرة الكبرى. جرّب اسم المنطقة أو معلم مشهور قريب.',
 en:'No matching location was found within Greater Cairo. Try a neighborhood or nearby landmark.'
};

export function normalizedPlace(value:string):string {
 return value.normalize('NFKC').toLowerCase().normalize('NFD')
  .replace(/\p{Mark}/gu,'').replace(/ـ/g,'').replace(/ٱ/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/[٠-٩]/g,x=>String(x.charCodeAt(0)-0x660))
  .replace(/[۰-۹]/g,x=>String(x.charCodeAt(0)-0x6f0))
  .replace(/[^\p{Letter}\p{Number}]+/gu,' ').trim();
}

const value=(x:unknown)=>typeof x==='string'?x.trim():'';
const phrase=(text:string,part:string)=>Boolean(part)&&(' '+text+' ').includes(' '+part+' ');

// One edit is allowed only for substantial, otherwise matching names.
function oneEdit(a:string,b:string):boolean {
 if(Math.abs(a.length-b.length)>1||Math.min(a.length,b.length)<5)return false;
 if(a.length>b.length)return oneEdit(b,a);
 let i=0,j=0,changes=0;
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;continue;}
  if(++changes>1)return false;
  if(a.length===b.length)i++;
  j++;
 }
 return changes+(b.length-j)===1;
}

export function nameRelevance(name:string,query:string):number {
 const label=normalizedPlace(name),q=normalizedPlace(query);
 if(q.length<2||!label)return 0;
 if(label===q)return 500;
 if(phrase(label,q))return 300;
 if(q.length>=3&&(label.startsWith(q)||label.split(' ').some(part=>part.startsWith(q))))return 200;
 if(oneEdit(label,q))return 100;
 return 0;
}
const localityAliases:Record<string,string[]>={
 'new cairo':['أحياء التجمع الخامس','التجمع الخامس','Fifth Settlement','5th Settlement'],
 '6th of october':['السادس من أكتوبر','مدينة السادس من أكتوبر']
};
const knownAreaNames=(area:ServiceArea)=>[area.name_ar,area.name_en,...(serviceAreaAliases[normalizedPlace(area.name_en)]??[])];
const aliasScore=(aliases:string[],q:string)=>aliases.some(label=>normalizedPlace(label)===q)?400:0;

export function serviceMatches(areas:ServiceArea[],query:string):ServiceArea[]{
 const q=normalizedPlace(query);
 if(q.length<2)return [];
 return areas.map(area=>({area,score:Math.max(nameRelevance(area.name_ar,q),nameRelevance(area.name_en,q),
  aliasScore(knownAreaNames(area).slice(2),q))}))
  .filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.area.id-b.area.id).slice(0,8)
  .map(item=>item.area);
}

export function catalogMatches(query:string,area?:ServiceArea):CatalogPlace[] {
 const q=normalizedPlace(query);
 return localPlaceCatalog.filter(item=>(!area||item.area===normalizedPlace(area.name_en))&&
  ([item.ar,item.en,...item.aliases].some(name=>normalizedPlace(name)===q)||
   Math.max(nameRelevance(item.ar,q),nameRelevance(item.en,q))===100))
  .sort((a,b)=>(b.popularity??0)-(a.popularity??0));
}

export function placeMatchesArea(place:MapPlace,area:ServiceArea):boolean{
 const aliases=[...knownAreaNames(area),...(localityAliases[normalizedPlace(area.name_en)]??[])].map(normalizedPlace);
 const labels=place.locality??place.detail.split('·');
 return labels.some(label=>aliases.includes(normalizedPlace(label)));
}

type PhotonFeature={geometry?:{type?:unknown;coordinates?:unknown};properties?:Record<string,unknown>};
const areaKeys=new Set(['city','town','village','suburb','quarter','neighbourhood','neighborhood','district','borough','municipality','hamlet']);
function photonKind(osmType:string,key:string,tag:string):MapPlace['kind']{
 if((key==='place'&&areaKeys.has(tag))||key==='boundary')return 'area';
 if(key==='highway'&&osmType!=='N')return 'road';
 return osmType==='N'?'point':'feature';
}

export function inspectPhoton(raw:unknown):{places:MapPlace[];outside:boolean}{
 const places:MapPlace[]=[];
 let outside=false;
 if(!raw||typeof raw!=='object'||!('features' in raw)||!Array.isArray(raw.features))return {places,outside};
 for(const feature of raw.features.slice(0,30) as PhotonFeature[]){
  if(!feature||typeof feature!=='object')continue;
  const coords=feature.geometry?.coordinates,props=feature.properties;
  if(!Array.isArray(coords)||coords.length!==2||!props||
     (feature.geometry?.type&&feature.geometry.type!=='Point')||
     typeof coords[0]!=='number'||typeof coords[1]!=='number'||
     !Number.isFinite(coords[0])||!Number.isFinite(coords[1]))continue;
  const point={latitude:coords[1],longitude:coords[0]};
  if(value(props.countrycode).toLowerCase()!=='eg'||!inLaunchRegion(point)){outside=true;continue;}
  const osmType=value(props.osm_type).toUpperCase();
  const osmId=String(props.osm_id??'');
  if(!/^[NWR]$/.test(osmType)||!/^\d{1,16}$/.test(osmId))continue;
  const name=value(props.name)||value(props.street);
  if(!name)continue;
  const locality=[props.district,props.suburb,props.neighbourhood,props.city].map(value).filter(Boolean);
  const detail=[...locality, ...[props.county,props.state].map(value)]
   .filter((part,i,all)=>Boolean(part&&part!==name&&all.indexOf(part)===i)).join(' · ');
  const id=osmType+':'+osmId,osmKey=value(props.osm_key),osmValue=value(props.osm_value);
  if(places.some(place=>place.id===id))continue;
  places.push({id,name,detail,locality,source:'map',kind:photonKind(osmType,osmKey,osmValue),osmKey,osmValue,...point});
 }
 return {places,outside};
}
export const mapPlacesFromPhoton=(raw:unknown)=>inspectPhoton(raw).places;

export function selectOperationalMapPlace(place:MapPlace):boolean{
 return place.source==='map'&&place.kind==='point'&&inLaunchRegion(place)&&/^N:\d{1,16}$/.test(place.id);
}

function catalogCandidate(place:MapPlace,item:CatalogPlace):boolean {
 if(!place.locality?.some(label=>
  [item.area,...(serviceAreaAliases[item.area]??[]),...(localityAliases[item.area]??[])].map(normalizedPlace)
   .includes(normalizedPlace(label))))return false;
 if(item.kind==='area'&&place.kind!=='area')return false;
 if(item.kind==='road'&&place.kind!=='road')return false;
 if(item.kind==='square'&&place.osmKey&&!(place.osmKey==='place'&&place.osmValue==='square'))return false;
 if(item.kind==='mosque'&&place.osmKey&&!(place.osmValue==='place_of_worship'||place.osmValue==='mosque'))return false;
 const sharedAliases=['الحصري','Hosary','El Hosary','Al Hosary','التجمع'];
 return [item.ar,item.en,...item.aliases.filter(alias=>!sharedAliases.includes(alias))]
  .some(label=>nameRelevance(place.name,label)>=300);
}

export function rankMapPlaces(places:MapPlace[],query:string,area?:ServiceArea):MapPlace[]{
 const catalog=catalogMatches(query,area);
 return places.filter(place=>inLaunchRegion(place)&&(!area||placeMatchesArea(place,area)))
  .map(place=>{
   const entry=catalog.find(item=>catalogCandidate(place,item));
   const match=catalog.length?(entry?Math.max(nameRelevance(place.name,query),400):0):nameRelevance(place.name,query);
   return {place,entry,match};
  }).filter(row=>row.match>0)
  .sort((a,b)=>b.match-a.match||(b.entry?.popularity??0)-(a.entry?.popularity??0)||
   (a.place.id<b.place.id?-1:1))
  .slice(0,7).map(row=>row.place);
}

export function stopNearPoint(stop:GeoPoint,chosen:GeoPoint,radiusKm=3):boolean{
 return inLaunchRegion(chosen)&&inLaunchRegion(stop)&&straightLineKm(stop,chosen)<=radiusKm;
}
export function geoRequestAvailable(origin:PlaceChoice|null,destination:PlaceChoice|null):boolean{
 return origin?.kind==='service'&&destination?.kind==='service'&&origin.area.id!==destination.area.id;
}
