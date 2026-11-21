/* global Response, AbortController */
import test from 'node:test';
import {URL} from 'node:url';
import assert from 'node:assert/strict';
import {searchStaticCairo} from './staticCairoSearch.ts';
import {indexedRowsToPlaces} from './indexedPlaceRows.ts';
test('cached OSM index shows sourced areas without pretending centroids are boarding pins',async()=>{
 const original=globalThis.fetch;
 let requests=0;
 globalThis.fetch=async url=>{
  requests++;assert.match(String(url),/^\/geo-index\/\d{3}\.json$/);
  return new Response(JSON.stringify({version:'fixture-2026',results:[
   {i:'osm:node:27565120',n:'الجيزة',a:'الجيزة',e:'Giza',c:'جزيرة الدهب',
    k:'city',p:[29.9870753,31.2118063],x:false,os:'node',v:['الجيزه','giza']},
   {i:'osm:node:999',n:'الجيزة في الفيوم',a:'الجيزة في الفيوم',e:null,c:'الفيوم',
    k:'city',p:[29.3084,30.8428],x:false,os:'node',v:['الجيزه','الجيزه في الفيوم']}
  ]}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const results=await searchStaticCairo('الجيزة',false,undefined,new AbortController().signal);
  assert.equal(results.length,1);
  assert.equal(results[0].name,'الجيزة');
  assert.equal(results[0].kind,'area');
  assert.equal(results[0].id,'N:27565120');
  assert.equal(requests,1);
 }finally{globalThis.fetch=original;}
});
test('index never selects unverified roads/areas or an external point',()=>{
 const rows=[
  {place_id:'osm:way:100',name:'شارع عام',name_ar:null,name_en:null,
   context_label:'القاهرة',place_type:'road',osm_kind:'way',
   latitude:30.0443934,longitude:31.2357457,is_exact_point:false,source_snapshot:'s',relevance:500},
  {place_id:'osm:node:200',name:'Fayoum',name_ar:null,name_en:null,
   context_label:'Fayoum',place_type:'city',osm_kind:'node',
   latitude:29.3084,longitude:30.8428,is_exact_point:false,source_snapshot:'s',relevance:500}
 ];
 const list=indexedRowsToPlaces(rows,false);
 assert.equal(list.length,1);
 assert.equal(list[0].kind,'road');
});

test('municipality-qualified district names resolve from the packaged OSM data in both languages',async()=>{
 const {readFile}=await import('node:fs/promises');
 const original=globalThis.fetch;
 globalThis.fetch=async path=>new Response(await readFile(new URL('../../public'+path,import.meta.url)));
 try{
  for(const query of ['الحي الاول اكتوبر','First District 6 October','الحي الأول السادس من أكتوبر']){
   const [place]=await searchStaticCairo(query,true,undefined,new AbortController().signal);
   assert.equal(place?.id,'N:1160384365');
   assert.equal(place.kind,'area');
   assert.match(place.detail,/6th of October/);
  }
 }finally{globalThis.fetch=original;}
});
