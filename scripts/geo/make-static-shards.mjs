#!/usr/bin/env node
// Build 512 on-demand static autocomplete shards from licensed Geofabrik OSM.
// ODbL 1.0 data; NEVER export Google Maps content. Not bundled into app JS.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {buildMunicipalAreas} from './build-municipal-areas.mjs';
import {isInsideCairoDiscovery} from '../../web/src/v2/discoveryCairo.ts';

const root=process.argv[2]||'geo-index';
const output=process.argv[3]||'web/public/geo-index';
const input=JSON.parse(readFileSync(path.join(root,'manifest.json'),'utf8'));
mkdirSync(output,{recursive:true});
const normalize=x=>String(x||'').normalize('NFKC').toLowerCase().normalize('NFD')
 .replace(/\p{Mark}/gu,'').replace(/ـ/g,'').replace(/ٱ/g,'ا')
 .replace(/ى/g,'ي').replace(/ة/g,'ه')
 .replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660))
 .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0))
 .replace(/[^\p{Letter}\p{Number}]+/gu,' ').trim();
function covered(lon,lat){return isInsideCairoDiscovery({latitude:lat,longitude:lon});}
function parse(x){return x==='\\N'?null:x.replace(/\\t/g,'\t').replace(/\\n/g,'\n')
 .replace(/\\r/g,'\r').replace(/\\\\/g,'\\');}
function hash(s){
 let value=2166136261;
 for(let i=0;i<s.length;i++){value^=s.charCodeAt(i);value=Math.imul(value,16777619);}
 return value>>>0;
}
const lines=(filename)=>readFileSync(path.join(root,filename),'utf8').split('\n').filter(Boolean);
const places=new Map(),roadSeen=new Set();let approvedCount=0,roadDuplicateCount=0;
for(const line of lines('places.tsv')){
 const [id,osmKind,osmId,name,ar,en,context,kind,lat,lon,exact]=line.split('\t').map(parse);
 const latitude=Number(lat),longitude=Number(lon);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!covered(longitude,latitude))continue;
 approvedCount++;
 if(kind==='road'){
  const dedup=normalize(name)+'|'+normalize(context);
  if(roadSeen.has(dedup)){roadDuplicateCount++;continue;}
  roadSeen.add(dedup);
 }
 places.set(id,{i:id,n:name,a:ar||null,e:en||null,c:context||'',k:kind,
  p:[latitude,longitude],x:exact==='true',os:osmKind});
}
const generic=new Set(['شارع','حاره','عطفه','طريق','ميدان','محطه','مسجد','جامع',
 'جامعه','موقف','مول','street','st','road','rd','square','station','mosque','avenue']);
function lookupKey(q){
 const terms=q.split(' ');
 while(terms.length&&generic.has(terms[0]))terms.shift();
 return terms.join(' ');
}
const buckets=Array.from({length:512},()=>new Map());
let aliasCount=0;
for(const line of lines('aliases.tsv')){
 const [id,alias]=line.split('\t').map(parse),item=places.get(id);
 if(!item)continue;
 const q=normalize(alias);
 const effective=lookupKey(q);
 if(effective.length<4)continue;
 const index=hash([...effective].slice(0,4).join(''))%512;
 const shard=buckets[index];
 let copy=shard.get(id);
 if(!copy){copy={...item,v:[]};shard.set(id,copy);}
 if(!copy.v.includes(q)){copy.v.push(q);aliasCount++;}
}
// Coverage counts are searchable OSM entities, never claims of exhaustive
// real-world business/school listings. This also exposes data gaps early.
const categories={};
for(const item of places.values())categories[item.k]=(categories[item.k]||0)+1;
const prioritySources=[
 ['Cairo Festival City Mall','osm:way:253593226'],
 ['Cairo Mall','osm:way:771784390'],
 ['Talaat Harb Mall','osm:way:39700935'],
 ['Mall of Arabia','osm:relation:13478008'],
 ['Mall of Egypt','osm:way:83811548'],
 ['Smart Village business park','osm:way:545580264']
];
const priorityCoverage=Object.fromEntries(prioritySources.map(([name,id])=>
 [name,{osm_id:id,present:places.has(id)}]));
let stored=0,maxBucket=0,maximumBytes=0;
for(let bucket=0;bucket<512;bucket++){
 const items=[...buckets[bucket].values()];
 stored+=items.length;maxBucket=Math.max(maxBucket,items.length);
 const json=JSON.stringify({version:input.snapshot,results:items});
 maximumBytes=Math.max(maximumBytes,Buffer.byteLength(json));
 writeFileSync(path.join(output,String(bucket).padStart(3,'0')+'.json'),json);
}
const summary={data_license:'ODbL 1.0',source:input.source_url,snapshot:input.snapshot,
 source_records:input.records,source_aliases:input.aliases,
 records_inside_discovery_envelope:approvedCount,
 indexed_unique_records:places.size,category_counts:categories,priority_osm_coverage:priorityCoverage,
 road_segment_duplicates_collapsed:roadDuplicateCount,
 indexed_alias_entries:aliasCount,shards:512,shard_record_references:stored,
 max_records_in_one_shard:maxBucket,max_uncompressed_shard_bytes:maximumBytes,
 generated_at:new Date().toISOString(),
 note:'All imported features are inside the Cairo DISCOVERY envelope; operational geofence and pin approval are separate. Area and road coordinates are context only, not pickup pins.'};
writeFileSync(path.join(output,'manifest.json'),JSON.stringify(summary,null,2)+'\n');
writeFileSync(path.join(output,'ATTRIBUTION.txt'),
 'Contains OpenStreetMap data © OpenStreetMap contributors, ODbL 1.0.\nSource: '+
 input.source_url+'\nSnapshot SHA-256: '+input.snapshot+'\nSee https://www.openstreetmap.org/copyright\n');
buildMunicipalAreas(output);
console.log(JSON.stringify(summary));
