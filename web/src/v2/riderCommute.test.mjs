import test from 'node:test';import assert from 'node:assert/strict';
import {parseSavedCommute,savedCommuteKey,isWeekdays,parseHomeDraft,riderHomeDraftKey} from './riderCommute.ts';
const good={origin:'المعادي',destination:'التجمع',originPlace:null,destinationPlace:null,
 outbound:'07:30',returnTime:'17:00',period:'weekly',direction:'outbound',savedAt:'2026-11-21T00:00:00.000Z'};
test('valid account-scoped commute can be restored without demo data',()=>{
 assert.deepEqual(parseSavedCommute(good),good);
 assert.equal(savedCommuteKey('00000000-0000-4000-8000-000000000001'),
 'sekka.rider.recurringCommute.v1.00000000-0000-4000-8000-000000000001');
});
test('reject invalid times, same-place routes and untrusted coordinates',()=>{
 assert.equal(parseSavedCommute({...good,outbound:'27:90'}),null);
 assert.equal(parseSavedCommute({...good,destination:good.origin}),null);
 assert.equal(parseSavedCommute({...good,originPlace:{kind:'map',place:{id:'x',name:'X',latitude:129,longitude:45}}}),null);
 assert.equal(parseSavedCommute({...good,originPlace:{kind:'map',place:{id:'N:1',kind:'point',source:'map',name:'X',latitude:30.0444,longitude:31.2357}}})?.origin,good.origin);
 assert.throws(()=>savedCommuteKey('../../another-user'),/INVALID_RIDER_ID/);
});

test('weekdays persist as real unique Saturday-to-Friday IDs, 0 through 6',()=>{
 assert.equal(isWeekdays([0,2,4]),true);
 assert.equal(isWeekdays([]),true);
 assert.equal(isWeekdays([7]),false);
 assert.equal(isWeekdays([1,1]),false);
 assert.equal(isWeekdays(['1']),false);
 assert.deepEqual(parseSavedCommute({...good,weekdays:[0,2,4]}).weekdays,[0,2,4]);
 assert.equal(parseSavedCommute({...good,weekdays:[1,1]}),null);
 assert.equal(parseSavedCommute({...good,weekdays:[-1]}),null);
});

test('partial home selections survive navigation and are always scoped by Google UUID',()=>{
 const draft={origin:'',destination:'',originPlace:null,destinationPlace:null,outbound:'',returnTime:'',
  period:'weekly',direction:'outbound',weekdays:[0,2,4]};
 assert.deepEqual(parseHomeDraft(draft),draft);
 assert.equal(parseHomeDraft({...draft,weekdays:[0,0]}),null);
 assert.equal(parseHomeDraft({...draft,outbound:'29:91'}),null);
 assert.equal(parseHomeDraft({...draft,originPlace:{kind:'map',place:{id:'x',name:'X',latitude:120,longitude:31}}}),null);
 assert.notEqual(riderHomeDraftKey('00000000-0000-4000-8000-000000000001'),
  riderHomeDraftKey('00000000-0000-4000-8000-000000000002'));
 assert.throws(()=>riderHomeDraftKey('attacker'),/INVALID_RIDER_ID/);
});

test('two separately selected map pins can share a display label on a saved commute',()=>{
 const pin=(lat,lon)=>({kind:'map',place:{source:'manual_map_pin',kind:'point',name:'Map pin',
  id:'manual:'+lat.toFixed(6)+','+lon.toFixed(6),latitude:lat,longitude:lon}});
 const from=pin(30.044393,31.235746),to=pin(29.972446,30.944807);
 const trip={...good,origin:'Map pin',destination:'Map pin',originPlace:from,destinationPlace:to};
 assert.ok(parseSavedCommute(trip));
 assert.equal(parseSavedCommute({...trip,destinationPlace:from}),null);
});
