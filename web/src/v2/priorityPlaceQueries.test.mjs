/* global Response, AbortController */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalNamedQuery} from './priorityPlaceQueries.ts';
import {isInsideCairoDiscovery} from './discoveryCairo.ts';
import {isInsideOperationalRegion} from './greaterCairoBoundary.ts';
import {searchStaticCairo} from './staticCairoSearch.ts';

test('major malls, business hubs and institutions resolve familiar Cairo spelling',()=>{
 assert.equal(canonicalNamedQuery('CFC'),'Cairo Festival City Mall');
 assert.equal(canonicalNamedQuery('مول طلعت حرب'),'Talaat Harb Mall');
 assert.equal(canonicalNamedQuery('القرية الذكية'),'Smart Village');
 assert.equal(canonicalNamedQuery('كايرو مول'),'Cairo Mall');
 assert.equal(canonicalNamedQuery('مول العرب'),'Mall of Arabia');
 assert.equal(canonicalNamedQuery('مول مصر'),'Mall of Egypt');
 assert.equal(canonicalNamedQuery('AUC'),'American University in Cairo');
 assert.equal(canonicalNamedQuery('GUC'),'German University in Cairo');
 assert.equal(canonicalNamedQuery('مدرسة الوفاء'),null);
});

test('businesses outside old operational footprint are discoverable but not authorized stops',()=>{
 const mall={latitude:30.0067645,longitude:30.9761146};
 const egypt={latitude:29.9721325,longitude:31.0170639};
 assert.equal(isInsideCairoDiscovery(mall),true);
 assert.equal(isInsideCairoDiscovery(egypt),true);
 assert.equal(isInsideOperationalRegion(mall),false);
 assert.equal(isInsideOperationalRegion(egypt),false);
 assert.equal(isInsideCairoDiscovery({latitude:29.3084,longitude:30.8428}),false);
});

test('CFC alias yields sourced OSM mall context with no made-up entrance',async()=>{
 const original=globalThis.fetch;
 const calls=[];
 globalThis.fetch=async url=>{
  calls.push(String(url));
  return new Response(JSON.stringify({version:'OSM-fixture',results:[
   {i:'osm:way:253593226',n:'كايرو فستيفال سيتى مول',a:'كايرو فستيفال سيتى مول',
    e:'Cairo Festival City Mall',c:'القاهرة الجديدة',k:'mall',
    p:[30.0279098,31.4082202],x:false,os:'way',
    v:['cairo festival city mall','كايرو فستيفال سيتي مول']}
  ]}),{status:200});
 };
 try{
  const results=await searchStaticCairo('CFC',false,undefined,new AbortController().signal);
  assert.equal(results.length,1);
  assert.equal(results[0].id,'W:253593226');
  assert.equal(results[0].kind,'feature');
  assert.equal(results[0].osmValue,'mall');
  assert.match(calls[0],/^\/geo-index\/\d{3}\.json$/);
 }finally{globalThis.fetch=original;}
});

test('mapped Smart Village business park outranks transport stops with equal name match',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({version:'OSM-fixture',results:[
  {i:'osm:node:6372330852',n:'Smart Village',a:null,e:null,c:'قريه أبو رواش',
   k:'stop_position',p:[30.0645326,31.0235273],x:true,os:'node',v:['smart village']},
  {i:'osm:way:545580264',n:'Smart Village',a:'القرية الذكية',e:'Smart Village',
   c:'أبو رواش · الجيزة',k:'commercial',p:[30.07671,31.02174],x:false,os:'way',
   v:['smart village','القريه الذكيه']}
 ]}),{status:200});
 try{
  const results=await searchStaticCairo('القرية الذكية',false,undefined,new AbortController().signal);
  assert.equal(results[0].id,'W:545580264');
  assert.equal(results[0].kind,'feature');
  assert.equal(results[0].osmValue,'commercial');
 }finally{globalThis.fetch=original;}
});
