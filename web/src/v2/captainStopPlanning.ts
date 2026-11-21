import {placeMatchesArea} from './geoPlace.ts';
import {localPlaceCatalog} from './locationCatalog.ts';
import type {MapPlace,ServiceArea} from './geoPlace.ts';

/** Derive area only from documented OSM locality or catalog membership.
 * Never silently assign the nearest unrelated district to a Captain stop. */
export function inferCaptainArea<T extends ServiceArea>(place:MapPlace,areas:readonly T[]):T|null {
 const tagged=place.catalogKey&&localPlaceCatalog.find(entry=>entry.key===place.catalogKey);
 if(tagged){
  const matching=areas.filter(a=>a.name_en.toLowerCase()===tagged.area);
  if(matching.length===1)return matching[0];
 }
 const matching=areas.filter(a=>placeMatchesArea(place,a));
 return matching.length===1?matching[0]:null;
}
/**
 * Existing v31 route_stops have a required legacy service-area FK, although
 * the passenger and Captain both search by actual coordinates.
 *
 * An OSM locality/catalog match is preferred. If it is absent, assign the
 * nearest *internal routing zone* to the verified coordinate. This zone is not
 * a claim that the named place lies inside that district, and should never
 * be presented as the public place address. Never prompt the Captain to guess.
 */
const routingAnchors:Record<string,{latitude:number;longitude:number}>={
 'maadi':{latitude:29.9605,longitude:31.2600},
 'new cairo':{latitude:30.0255,longitude:31.4700},
 'nasr city':{latitude:30.0610,longitude:31.3450},
 'dokki':{latitude:30.0384,longitude:31.2111},
 'mohandessin':{latitude:30.0560,longitude:31.2020},
 'zamalek':{latitude:30.0640,longitude:31.2190},
 'sheikh zayed':{latitude:30.0360,longitude:30.9710},
 '6th of october':{latitude:29.9737,longitude:30.9418},
 'heliopolis':{latitude:30.0940,longitude:31.3200}
};
export function resolveCaptainRoutingArea<T extends ServiceArea>(place:MapPlace,areas:readonly T[]):T|null {
 const named=inferCaptainArea(place,areas);
 if(named)return named;
 if(!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude))return null;
 const mapped=areas.flatMap(area=>{
  const anchor=routingAnchors[area.name_en.trim().toLowerCase()];
  if(!anchor)return [];
  const latDiff=(place.latitude-anchor.latitude)*111.2;
  const lonDiff=(place.longitude-anchor.longitude)*111.2*Math.cos(place.latitude*Math.PI/180);
  return [{area,distanceKm:Math.hypot(latDiff,lonDiff)}];
 }).sort((a,b)=>a.distanceKm-b.distanceKm||a.area.id-b.area.id);
 return mapped[0]?.area??null;
}
export type StopWithTimes={outboundStopTime:string;returnStopTime:string};

/** Draft times are optional service preferences, not guaranteed departure dates.
 * Overnight services may pass midnight once, never run backwards twice. */
export function validClock(value:string):boolean {
 return value===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function validStopSchedule<T extends StopWithTimes>(stops:readonly T[]):boolean {
 if(!stops.every(stop=>validClock(stop.outboundStopTime)&&validClock(stop.returnStopTime)))return false;
 const chronological=(times:string[]):boolean=>{
  const specified=times.filter(Boolean).map(v=>Number(v.slice(0,2))*60+Number(v.slice(3)));
  let previous=-1,rollovers=0;
  for(const minute of specified){
   let absolute=minute+rollovers*1440;
   if(absolute<previous){rollovers++;absolute+=1440;}
   if(rollovers>1||absolute<previous)return false;
   previous=absolute;
  }
  return true;
 };
 return chronological(stops.map(s=>s.outboundStopTime))&&
  chronological([...stops].reverse().map(s=>s.returnStopTime));
}
