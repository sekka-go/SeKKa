import {isInsideCairoDiscovery} from './discoveryCairo.ts';
import {canonicalNamedQuery} from './priorityPlaceQueries.ts';
import {normalizedPlace,placeMatchesArea} from './geoPlace.ts';
import {localPlaceCatalog} from './locationCatalog.ts';
import type {MapPlace,ServiceArea} from './geoPlace';

type ShardEntry={i:string;n:string;a:string|null;e:string|null;c:string;k:string;
 p:[number,number];x:boolean;os:string;v:string[]};
type Shard={version:string;results:ShardEntry[]};
const shardCache=new Map<number,{until:number;rows:ShardEntry[]}>();
let unavailable=false;
const generic=new Set(['شارع','حاره','عطفه','طريق','ميدان','محطه','مسجد','جامع',
 'جامعه','موقف','مول','street','st','road','rd','square','station','mosque','avenue']);
function lookupKey(q:string){
 const terms=q.split(' ');
 while(terms.length&&generic.has(terms[0]))terms.shift();
 return terms.join(' ');
}
function bucketFor(q:string){
 let h=2166136261;
 for(const char of [...q].slice(0,4)){
  const code=char.charCodeAt(0);h^=code;h=Math.imul(h,16777619);
 }
 return (h>>>0)%512;
}
function tokenSequence(alias:string,query:string){
 let start=0;
 for(const part of query.split(' ')){
  const found=alias.indexOf(part,start);
  if(found<0)return false;
  start=found+part.length;
 }
 return true;
}
function trustedLandmarkBoost(item:ShardEntry,query:string):number {
 const suffix=item.i.replace(/^osm:/,'').replace(/^node:/,'N:').replace(/^way:/,'W:').replace(/^relation:/,'R:');
 const q=normalizedPlace(query);
 const matched=localPlaceCatalog.filter(entry=>entry.reference?.osmId===suffix&&
  [entry.ar,entry.en,...entry.aliases].some(name=>normalizedPlace(name)===q));
 return matched.length?510+Math.max(...matched.map(entry=>entry.popularity??0))*10:0;
}
function aliasScore(item:ShardEntry,query:string){
 const effective=lookupKey(query);
 let score=0;
 for(const alias of item.v){
  const reduced=lookupKey(alias);
  if(alias===query)score=Math.max(score,500);
  else if(reduced===effective)score=Math.max(score,470);
  else if(reduced.startsWith(effective+' '))score=Math.max(score,420);
  else if(alias.startsWith(query+' '))score=Math.max(score,450);
  else if(alias.startsWith(query))score=Math.max(score,350);
  else if((' '+alias+' ').includes(' '+query+' '))score=Math.max(score,260);
  else if(query.split(' ').length>=2&&tokenSequence(alias,query))score=Math.max(score,230);
  else if(alias.includes(query))score=Math.max(score,140);
 }
 return score;
}
/** CDN-hosted subset of approved OSM place data. Only the relevant hash shard is downloaded. */
export async function searchStaticCairo(query:string,en:boolean,area:ServiceArea|undefined,
 signal:AbortSignal):Promise<MapPlace[]>{
 const canonical=canonicalNamedQuery(query);
 const q=normalizedPlace(canonical??query),effective=lookupKey(q);
 if((effective.length<4&&!canonical)||unavailable)return [];
 const bucket=bucketFor(effective);
 let records=shardCache.get(bucket)?.rows;
 if(!records||shardCache.get(bucket)!.until<Date.now()){
  try{
   const response=await fetch('/geo-index/'+String(bucket).padStart(3,'0')+'.json',{signal});
   if(response.status===404){unavailable=true;return [];}
   if(!response.ok)throw Error('SHARD_UNAVAILABLE');
   const data=await response.json() as Shard;
   if(!data||!Array.isArray(data.results))return [];
   records=data.results;
   if(shardCache.size>=18){const first=shardCache.keys().next().value;if(first!==undefined)shardCache.delete(first);}
   shardCache.set(bucket,{rows:records,until:Date.now()+600_000});
  }catch{return [];}
 }
 if(signal.aborted)return [];
 const candidate=records.map(row=>{
  const relevance=Math.max(aliasScore(row,q),trustedLandmarkBoost(row,q));
  if(!relevance||!/^osm:(node|way|relation):\d+$/.test(row.i))return null;
  const latitude=Number(row.p?.[0]),longitude=Number(row.p?.[1]);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||
   !isInsideCairoDiscovery({latitude,longitude}))return null;
  const kind:MapPlace['kind']=row.x&&row.os==='node'?'point':
   ['city','town','village','suburb','district','neighbourhood','neighborhood','quarter','borough','locality'].includes(row.k)?'area':
   row.k==='road'?'road':'feature';
  const place:MapPlace={id:row.os[0].toUpperCase()+':'+row.i.split(':')[2],
   name:(en?row.e||row.n:row.a||row.n),detail:row.c,kind,source:'map',
   latitude,longitude,osmValue:row.k,locality:row.c?row.c.split(' · ').map(t=>t.trim()):[]};
  if(area&&!placeMatchesArea(place,area))return null;
  const typeRank=['mall','school','kindergarten','childcare','university','college','office','commercial'].includes(row.k)?6:kind==='area'?4:kind==='point'?3:kind==='feature'?2:1;
  return {place,score:relevance,typeRank};
 }).filter((row):row is {place:MapPlace;score:number;typeRank:number}=>Boolean(row));
 candidate.sort((a,b)=>b.score-a.score||b.typeRank-a.typeRank||
  a.place.id.localeCompare(b.place.id));
 return candidate.slice(0,9).map(x=>x.place);
}
