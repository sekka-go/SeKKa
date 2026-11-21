// Supplement OSM neighbourhood aliases with a spatially verified municipal breadcrumb.
// Input and output are public discovery data. No service-area IDs are generated.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isInsideOperationalRegion,polygonCovers} from '../../web/src/v2/greaterCairoBoundary.ts';
const sources={october:'Oct_BOU',zayed:'Zayed',newCairo:'New_Cairo_City',obour:'Obour_boun',shorouk:'Sherouk_boun',shubra:'Shubra Al-Kheima'};
export function buildMunicipalAreas(dir){
 const base=fileURLToPath(new URL('./municipalities/',import.meta.url));
 const municipalities=Object.entries(sources).map(([key,file])=>{
  const fc=JSON.parse(fs.readFileSync(path.join(base,file+'.geojson'),'utf8'));
  const polys=fc.features.filter(f=>key!=='october'||f.properties.Name==='6th_oct')
   .flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);
  return {key,polys,rows:new Map()};
 });
 const kinds=new Set(['city','town','suburb','village','neighbourhood','quarter','district','hamlet','locality']);
 const {snapshot}=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 for(const file of fs.readdirSync(dir).filter(name=>/^\d{3}\.json$/.test(name)).sort()){
  const shard=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  if(shard.version!==snapshot)throw Error('Mixed OSM snapshots');
  for(const row of shard.results){
   if(!kinds.has(row.k))continue;
   const [latitude,longitude]=row.p;
   if(!isInsideOperationalRegion({latitude,longitude}))continue;
   for(const {polys,rows} of municipalities){
    if(!polys.some(polygon=>polygonCovers(longitude,latitude,polygon)))continue;
    const prev=rows.get(row.i);
    if(prev)prev.v=[...new Set([...prev.v,...row.v])];else rows.set(row.i,{...row,x:false});
   }
  }
 }
 const attribution='Municipal hierarchy: Built Environment Observatory, Greater Cairo (CC BY 4.0), https://archive.org/details/greater-cairo. Municipal labels are for search only.';
 const licenseFile=path.join(dir,'ATTRIBUTION.txt');
 const notice=fs.readFileSync(licenseFile,'utf8');
 if(!notice.includes(attribution))fs.appendFileSync(licenseFile,attribution+'\n');
 for(const {key,rows} of municipalities){
  fs.writeFileSync(path.join(dir,'areas-'+key+'.json'),JSON.stringify({version:snapshot,results:[...rows.values()]}));
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url))buildMunicipalAreas(process.argv[2]||'web/public/geo-index');
