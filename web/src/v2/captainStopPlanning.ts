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
