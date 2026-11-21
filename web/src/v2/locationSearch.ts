import {useEffect,useId,useState} from 'react';
import type {KeyboardEvent} from 'react';
import {greaterCairoEnvelope} from './greaterCairoBoundary';
import {catalogMatches,inspectPhoton,normalizedPlace,rankMapPlaces} from './geoPlace';
import type {MapPlace,ServiceArea} from './geoPlace';

export const photonEndpoint='https://photon.komoot.io';
type SearchResult={places:MapPlace[];outside:boolean};
type SearchState=SearchResult&{key:string;status:'done'|'error'};
const cache=new Map<string,{expires:number;data:SearchResult}>();

export async function lookupLocations(query:string,area:ServiceArea|undefined,en:boolean,signal:AbortSignal):Promise<SearchResult>{
 const key=JSON.stringify([query,area?.name_en,en]);
 const cached=cache.get(key);
 if(cached&&cached.expires>Date.now())return cached.data;
 const catalog=catalogMatches(query,area);
 const probes=catalog.length?catalog.map(entry=>
  (en?entry.en:entry.ar)+', '+(area?.name_en??entry.area)):
  [area?query+', '+area.name_en:query];
 if (probes.length===1&&probes[0]!==query)probes.push(query);
 let outside=false;
 const places:MapPlace[]=[];
 let fetched=false,lastError:unknown;
 for(const probe of [...new Set(probes)].slice(0,2)){
  signal.throwIfAborted();
  const url=new URL('/api/',photonEndpoint);
  url.searchParams.set('q',probe);
  url.searchParams.set('bbox',greaterCairoEnvelope);
  url.searchParams.set('limit','12');
  if(en)url.searchParams.set('lang','en');
  try{
   const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(6000)])});
   if(!response.ok)throw Error('MAP_SEARCH_UNAVAILABLE');
   const result=inspectPhoton(await response.json());
   fetched=true;outside ||= result.outside;
   for(const place of result.places)if(!places.some(item=>item.id===place.id))places.push(place);
   if(catalog.length<2&&rankMapPlaces(places,query,area).length)break;
  }catch(error){
   if(signal.aborted)throw error;
   lastError=error;
  }
 }
 if(!fetched)throw lastError??Error('MAP_SEARCH_UNAVAILABLE');
 const data={places:rankMapPlaces(places,query,area),outside};
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
  },immediate?0:450);
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
