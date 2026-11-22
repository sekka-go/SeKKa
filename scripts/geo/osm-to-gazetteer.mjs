#!/usr/bin/env node
// ODbL geodata: https://download.geofabrik.de/africa/egypt.html
// Input: osmium export --attributes=type,id --format-option=print_record_separator=false -f geojsonseq
import {createReadStream,createWriteStream,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {finished} from 'node:stream/promises';
import path from 'node:path';
import {greaterCairoGeometry} from '../../web/src/v2/greaterCairoGeometry.ts';
const arg=(name,fallback='')=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1];};
const input=arg('input'),out=arg('out','geo-index'),snapshot=arg('snapshot');
if(!input||!existsSync(input)||!/^[a-z0-9_.:-]{5,120}$/i.test(snapshot||'')){
 console.error('Usage: --input cairo.geojsonseq --out geo-index --snapshot SOURCE_SHA256');process.exit(2);
}
mkdirSync(out,{recursive:true});
const text=x=>typeof x==='string'?x.trim():'';
const empty=String.fromCharCode(92)+'N';
function pointOf(g){
 if(!g?.coordinates)return null;
 if(g.type==='Point')return {lon:g.coordinates[0],lat:g.coordinates[1]};
 let x=0,y=0,count=0;
 const visit=v=>{if(Array.isArray(v)&&typeof v[0]==='number'&&typeof v[1]==='number'){
  x+=v[0];y+=v[1];count++;
 }else if(Array.isArray(v))v.forEach(visit);};
 visit(g.coordinates);
 return count?{lon:x/count,lat:y/count}:null;
}
function inRing(x,y,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function inPolygon(point,coords){
 return coords?.length&&inRing(point.lon,point.lat,coords[0])&&
  coords.slice(1).every(hole=>!inRing(point.lon,point.lat,hole));
}
function approved(point){return greaterCairoGeometry.coordinates.some(poly=>inPolygon(point,poly));}
function extent(coords){
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 const walk=v=>{if(Array.isArray(v)&&typeof v[0]==='number'&&typeof v[1]==='number'){
  minX=Math.min(minX,v[0]);maxX=Math.max(maxX,v[0]);minY=Math.min(minY,v[1]);maxY=Math.max(maxY,v[1]);
 }else if(Array.isArray(v))v.forEach(walk);};
 walk(coords);return [minX,minY,maxX,maxY];
}
function contains(feature,point){
 const geom=feature.geometry;
 return (geom.type==='Polygon'?[geom.coordinates]:geom.type==='MultiPolygon'?geom.coordinates:[])
  .some(poly=>inPolygon(point,poly));
}
async function* features(){
 const r=createInterface({input:createReadStream(input,{encoding:'utf8'}),crlfDelay:Infinity});
 for await(let line of r){
  if(line.charCodeAt(0)===30)line=line.slice(1);
  if(!line.trim())continue;
  try{const obj=JSON.parse(line);if(obj?.type==='Feature')yield obj;}catch{}
 }
}
const parentKinds=new Set(['city','town','suburb','neighbourhood','neighborhood','quarter','district','borough','village']);
const parents=[],cells=new Map(),cellSize=.05;
const cellKey=(x,y)=>Math.floor(x/cellSize)+':'+Math.floor(y/cellSize);
for await(const feature of features()){
 const p=feature.properties||{},kind=text(p.place),name=text(p['name:ar'])||text(p.name);
 if(!parentKinds.has(kind)||!name||!['Polygon','MultiPolygon'].includes(feature.geometry?.type))continue;
 const bbox=extent(feature.geometry.coordinates);
 if(!bbox.every(Number.isFinite))continue;
 const index=parents.push({feature,bbox,kind,name,id:p['@id']})-1;
 for(let x=Math.floor(bbox[0]/cellSize);x<=Math.floor(bbox[2]/cellSize);x++)
  for(let y=Math.floor(bbox[1]/cellSize);y<=Math.floor(bbox[3]/cellSize);y++){
   const key=x+':'+y,items=cells.get(key)||[];items.push(index);cells.set(key,items);
  }
}
function parentNames(point,osmId){
 const levels={neighbourhood:0,neighborhood:0,quarter:0,suburb:1,district:2,borough:2,city:3,town:3,village:4};
 return (cells.get(cellKey(point.lon,point.lat))||[]).map(id=>parents[id])
  .filter(x=>x.id!==osmId&&x.bbox[0]<=point.lon&&point.lon<=x.bbox[2]&&
   x.bbox[1]<=point.lat&&point.lat<=x.bbox[3]&&contains(x.feature,point))
  .sort((a,b)=>(levels[a.kind]??9)-(levels[b.kind]??9))
  .map(x=>x.name).slice(0,2);
}
function category(p){
 return text(p.place)||text(p.public_transport)||text(p.railway)||
  (p.highway?'road':'')||text(p.amenity)||text(p.shop)||text(p.tourism)||
  text(p.healthcare)||text(p.leisure)||text(p.office)||
  (['commercial','retail','education','industrial'].includes(text(p.landuse))?text(p.landuse):'')||
  (['school','kindergarten','college','university'].includes(text(p.building))?text(p.building):'')||
  (['childcare','kindergarten','preschool'].includes(text(p.social_facility))?'childcare':'')||
  'landmark';
}
const escapeCopy=value=>value===null||value===undefined||value===''?empty:String(value)
 .replaceAll(String.fromCharCode(92),String.fromCharCode(92,92))
 .replaceAll('\t',String.fromCharCode(92)+'t')
 .replaceAll('\n',String.fromCharCode(92)+'n')
 .replaceAll('\r',String.fromCharCode(92)+'r');
const places=createWriteStream(path.join(out,'places.tsv'));
const aliases=createWriteStream(path.join(out,'aliases.tsv'));
async function write(stream,values){if(!stream.write(values.map(escapeCopy).join('\t')+'\n'))await once(stream,'drain');}
let stored=0,aliasCount=0,processed=0,active=0,candidate=0;
const categories={},seen=new Set();
for await(const feature of features()){
 processed++;
 const p=feature.properties||{},osmKind=text(p['@type']),osmId=String(p['@id']??'');
 if(!['node','way','relation'].includes(osmKind)||!/^\d{1,16}$/.test(osmId))continue;
 const sourceId='osm:'+osmKind+':'+osmId;
 if(seen.has(sourceId))continue;
 const name=text(p.name)||text(p['name:ar'])||text(p['name:en']);
 if(name.length<2||name.length>200)continue;
 const point=pointOf(feature.geometry);
 if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||
  point.lon<30.15||point.lon>32.2||point.lat<29.5||point.lat>30.7)continue;
 seen.add(sourceId);
 const originalContext=[text(p['addr:neighbourhood']),text(p['addr:suburb']),
  text(p['addr:city']),text(p['is_in:city'])].filter(Boolean);
 const hierarchy=[...new Set([...originalContext,...parentNames(point,osmId)])]
  .filter(x=>x!==name).slice(0,3);
 const kind=category(p);
 const exact=feature.geometry?.type==='Point'&&osmKind==='node'&&!p.place&&
  Boolean(p.amenity||p.shop||p.railway||p.public_transport||p.tourism||
   p.healthcare||p.leisure||p.highway==='bus_stop');
 await write(places,[sourceId,osmKind,osmId,name,text(p['name:ar'])||null,
  text(p['name:en'])||null,hierarchy.join(' · ').slice(0,200),kind,
  point.lat,point.lon,exact?'true':'false',snapshot]);
 const names=[name,text(p['name:ar']),text(p['name:en']),text(p['name:ar-EG']),
  text(p.alt_name),text(p.loc_name),text(p.int_name),
  text(p.short_name),text(p.official_name),text(p.old_name)].filter(Boolean);
 const found=new Set(names);
 for(const title of names.slice(0,3)){
  hierarchy.slice(0,2).forEach(label=>found.add(title+' '+label));
  if(hierarchy.length>1)found.add(title+' '+hierarchy.join(' '));
 }
 for(const alias of found){
  if(alias.length<2||alias.length>260)continue;
  await write(aliases,[sourceId,alias,/[\u0600-\u06ff]/u.test(alias)?'ar':'und']);aliasCount++;
 }
 stored++;categories[kind]=(categories[kind]||0)+1;
 if(approved(point))active++;else candidate++;
}
places.end();aliases.end();await Promise.all([finished(places),finished(aliases)]);
const manifest={source_url:'https://download.geofabrik.de/africa/egypt.html',
 license:'ODbL 1.0',snapshot,generated_at:new Date().toISOString(),
 records:stored,aliases:aliasCount,active_point_representatives:active,
 candidate_point_representatives:candidate,source_parent_polygons:parents.length,
 counts_by_type:categories,processed,notes:'Geometry representatives are search context, not exact pickup coordinates. Active SQL geofence is authoritative.'};
writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest));
