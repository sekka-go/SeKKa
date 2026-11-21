import {useEffect,useId,useState} from 'react';
import type {KeyboardEvent} from 'react';
import {cairoDiscoveryPhotonBbox,isInsideCairoDiscovery} from './discoveryCairo';
import {client} from './api';
import {searchStaticCairo} from './staticCairoSearch';
import {exactCatalogMatches,inspectPhoton,normalizedPlace,rankMapPlaces} from './geoPlace';
import {indexedRowsToPlaces} from './indexedPlaceRows';
import type {IndexedRow} from './indexedPlaceRows';
import type {MapPlace,ServiceArea} from './geoPlace';

export const photonEndpoint='https://photon.komoot.io';
type SearchResult={places:MapPlace[];outside:boolean};
type SearchState=SearchResult&{key:string;status:'done'|'error'};
const cache=new Map<string,{expires:number;data:SearchResult}>();

async function indexedLookup(query:string,area:ServiceArea|undefined,en:boolean,signal:AbortSignal){
 if(!client)return [] as MapPlace[];
 try{
  const {data,error}=await client.rpc('v31_location_suggest',{p_query:query,p_limit:12})
   .abortSignal(signal);
  if(error||signal.aborted)return [];
  return indexedRowsToPlaces(data as IndexedRow[],en,area);
 }catch{return [];}
}
/** Only classify an outside region when a named geographic settlement itself
 * matches the typed query. Unrelated provider hits must not imply exclusion. */
function confirmedOutsideSettlement(raw:unknown,query:string):boolean {
 if(!raw||typeof raw!=='object'||!('features' in raw)||!Array.isArray(raw.features))return false;
 const q=normalizedPlace(query);
 if(q.length<4)return false;
 return raw.features.some((item:unknown)=>{
  if(!item||typeof item!=='object'||!('properties' in item)||!('geometry' in item))return false;
  const f=item as {properties?:Record<string,unknown>;geometry?:{coordinates?:unknown}};
  const p=f.properties??{},name=p.name,coords=f.geometry?.coordinates;
  if(typeof name!=='string'||normalizedPlace(name)!==q||!Array.isArray(coords)||
    coords.length!==2||typeof coords[0]!=='number'||typeof coords[1]!=='number')return false;
  if(p.osm_key!=='place'||!['city','town','village'].includes(String(p.osm_value)))return false;
  return !isInsideCairoDiscovery({latitude:coords[1],longitude:coords[0]});
 });
}
export async function lookupLocations(query:string,area:ServiceArea|undefined,en:boolean,signal:AbortSignal):Promise<SearchResult>{
 const key=JSON.stringify([query,area?.name_en,en]);
 const cached=cache.get(key);
 if(cached&&cached.expires>Date.now())return cached.data;
 const staticResults=await searchStaticCairo(query,en,area,signal);
 if(staticResults.length>0){
  const data={places:staticResults.slice(0,8),outside:false};
  cache.set(key,{expires:Date.now()+300_000,data});
  return data;
 }
 const serverResults=await indexedLookup(query,area,en,signal);
 const seenIndex=new Set(staticResults.map(place=>place.id));
 const indexed=[...staticResults,...serverResults.filter(place=>!seenIndex.has(place.id))];
 if(indexed.length>=5){
  const data={places:indexed.slice(0,8),outside:false};
  cache.set(key,{expires:Date.now()+300_000,data});
  return data;
 }
 const catalog=exactCatalogMatches(query,area);
 const probes=catalog.length?catalog.map(entry=>
  (en?entry.en:entry.ar)+', '+(area?.name_en??entry.area)):
  [area?query+', '+area.name_en:query];
 if (probes.length===1&&probes[0]!==query)probes.push(query);
 let outside=false;
 const places:MapPlace[]=[...indexed];
 let fetched=false,lastError:unknown;
 for(const probe of [...new Set(probes)].slice(0,2)){
  signal.throwIfAborted();
  const url=new URL('/api/',photonEndpoint);
  url.searchParams.set('q',probe);
  url.searchParams.set('bbox',cairoDiscoveryPhotonBbox);
  url.searchParams.set('limit','12');
  if(en)url.searchParams.set('lang','en');
  try{
   const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(6000)])});
   if(!response.ok)throw Error('MAP_SEARCH_UNAVAILABLE');
   const raw=await response.json();
   const result=inspectPhoton(raw);
   fetched=true;outside ||= result.outside&&confirmedOutsideSettlement(raw,query);
   for(const place of result.places)if(!places.some(item=>item.id===place.id))places.push(place);
   if(catalog.length<2&&rankMapPlaces(places,query,area).length>=3)break;
  }catch(error){
   if(signal.aborted)throw error;
   lastError=error;
  }
 }
 if(!fetched&&!indexed.length)throw lastError??Error('MAP_SEARCH_UNAVAILABLE');
 const indexedIds=new Set(indexed.map(place=>place.id));
 const photon=rankMapPlaces(places.filter(place=>!indexedIds.has(place.id)),query,area);
 const data={places:[...indexed,...photon].slice(0,8),outside};
 // A partial outage should not cache incomplete ambiguity resolution.
 if(!lastError&&data.places.length){
  if(cache.size>=64){const oldest=cache.keys().next().value;if(oldest)cache.delete(oldest);}
  cache.set(key,{expires:Date.now()+300_000,data});
 }
 return data;
}

export function useLocationSearch(query:string,enabled:boolean,area:ServiceArea|undefined,en:boolean,immediate:number){
 const q=query.trim();
 const active=enabled&&normalizedPlace(q).length>=3&&q.length<=120;
 const key=JSON.stringify([q,area,en,immediate]);
 const [state,setState]=useState<SearchState>();
 useEffect(()=>{
  if(!active)return;
  const abort=new AbortController();
  const timer=setTimeout(()=>{
   void lookupLocations(q,area,en,abort.signal).then(
    result=>{if(!abort.signal.aborted)setState({...result,key,status:'done'});},
    ()=>{if(!abort.signal.aborted)setState({key,status:'error',places:[],outside:false});}
   );
  },immediate?0:300);
  return ()=>{clearTimeout(timer);abort.abort();};
 },[q,active,area,en,immediate,key]);
 const result=active&&state?.key===key?state:null;
 return {places:result?.places??[],outside:result?.outside??false,busy:active&&!result,status:result?.status};
}

export function useLocationOptions(){
 const id=useId();
 const [highlight,setHighlight]=useState(-1);
 const optionId=(index:number)=>id+'-place-'+index;
 function keys(event:KeyboardEvent<HTMLInputElement>,menuOpen:boolean,length:number,pick:(index:number)=>void,close:()=>void,search:()=>void){
  if(event.nativeEvent.isComposing)return;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   if(!length)return;
   event.preventDefault();
   const next=highlight<0?(event.key==='ArrowDown'?0:length-1):
    (highlight+(event.key==='ArrowDown'?1:length-1))%length;
   setHighlight(next);
   document.getElementById(optionId(next))?.scrollIntoView({block:'nearest'});
  }
  if(event.key==='Escape'&&menuOpen){event.preventDefault();setHighlight(-1);close();}
  if(event.key==='Enter'){
   event.preventDefault();
   if(highlight>=0&&highlight<length)pick(highlight);
   else search();
  }
 }
 return {id,highlight,reset:()=>setHighlight(-1),optionId,keys};
}
