import {isInsideCairoDiscovery} from './discoveryCairo.ts';
import {placeMatchesArea} from './geoPlace.ts';
import type {MapPlace,ServiceArea} from './geoPlace.ts';

export type IndexedRow={place_id:string;name:string;name_ar:string|null;name_en:string|null;
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
    !isInsideCairoDiscovery(point))continue;
  const context=typeof row.context_label==='string'?row.context_label:'';
  const kind:MapPlace['kind']=row.is_exact_point&&row.osm_kind==='node'?'point':
   ['neighbourhood','neighborhood','suburb','city','town','quarter','district','borough','village'].includes(row.place_type)?'area':
   row.place_type==='road'?'road':'feature';
  const name=(en?row.name_en||row.name:row.name_ar||row.name).trim();
  if(!name)continue;
  const id=row.osm_kind[0].toUpperCase()+':'+row.place_id.split(':')[2];
  const place:MapPlace={id,source:'map',name,detail:context,
   locality:context?context.split(' · ').map(value=>value.trim()).filter(Boolean):[],
   kind,osmValue:row.place_type,...point};
  if(!area||placeMatchesArea(place,area))items.push(place);
 }
 return items;
}
