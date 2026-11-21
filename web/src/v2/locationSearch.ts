import {useEffect,useId,useState} from 'react';
import type {KeyboardEvent} from 'react';
import {greaterCairoEnvelope,isInsideOperationalRegion} from './greaterCairoBoundary';
import {client} from './api';
import {exactCatalogMatches,inspectPhoton,normalizedPlace,rankMapPlaces,placeMatchesArea} from './geoPlace';
import type {MapPlace,ServiceArea} from './geoPlace';

export const photonEndpoint='https://photon.komoot.io';
type SearchResult={places:MapPlace[];outside:boolean};
type SearchState=SearchResult&{key:string;status:'done'|'error'};
const cache=new Map<string,{expires:number;data:SearchResult}>();

type IndexedRow={place_id:string;name:string;name_ar:string|null;name_en:string|null;
 context_label:string;place_type:string;osm_kind:string;latitude:number;longitude:number;
 is_exact_point:boolean;source_snapshot:string;relevance:number};
export function indexedRowsToPlaces(rows:IndexedRow[],en:boolean,area?:ServiceArea):MapPlace[]{
 if(!Array.isArray(rows))return [];
 const items:MapPlace[]=[];
 for(const row of rows){
  if(!row||!['node','way','relation'].includes(row.osm_kind)||
    !/^osm:(node|way|relation):[0-9]+$/.test(row.place_id))continue;
  const point={latitude:Number(row.latitude),longitude:Number(row.longitude)};
  if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||
    !isInsideOperationalRegion(point))continue;
  const context=typeof row.context_label==='string'?row.context_label:'';
  const kind:MapPlace['kind']=row.is_exact_point&&row.osm_kind==='node'?'point':
   ['neighbourhood','neighborhood','suburb','city','town','quarter','district','borough','village'].includes(row.place_type)?'area':
   row.place_type==='road'?'road':'feature';
  const name=(en?row.name_en||row.name:row.name_ar||row.name).trim();
  if(!name)continue;
  const id=row.osm_kind[0].toUpperCase()+':'+row.place_id.split(':')[2];
  const place:MapPlace={id,source:'map',name,detail:context,
   locality:context?context.split(' · ').map(value=>value.trim()).filter(Boolean):[],
   kind,...point};
  if(!area||placeMatchesArea(place,area))items.push(place);
 }
 return items;
}
async function indexedLookup(query:string,area:ServiceArea|undefined,en:boolean,signal:AbortSignal){
 if(!client)return [] as MapPlace[];
 try{
  const {data,error}=await client.rpc('v31_location_suggest',{p_query:query,p_limit:12})
   .abortSignal(signal);
  if(error||signal.aborted)return [];
  return indexedRowsToPlaces(data as IndexedRow[],en,area);
 }catch{return [];}
}
export async function lookupLocations(query:string,area:ServiceArea|undefined,en:boolean,signal:AbortSignal):Promise<SearchResult>{
 const key=JSON.stringify([query,area?.name_en,en]);
 const cached=cache.get(key);
 if(cached&&cached.expires>Date.now())return cached.data;
 const indexed=await indexedLookup(query,area,en,signal);
 // Search the licensed server index first; Photon is a bounded fallback, not the primary corpus.
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
  url.searchParams.set('bbox',greaterCairoEnvelope);
  url.searchParams.set('limit','12');
  if(en)url.searchParams.set('lang','en');
  try{
   const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(6000)])});
   if(!response.ok)throw Error('MAP_SEARCH_UNAVAILABLE');
   const result=inspectPhoton(await response.json());
   fetched=true;outside ||= result.outside;
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
