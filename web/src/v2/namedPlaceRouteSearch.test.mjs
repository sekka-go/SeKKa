import test from 'node:test';
import assert from 'node:assert/strict';
import {isSearchableMapPlace,selectOperationalMapPlace} from './geoPlace.ts';
import {parseSavedCommute,parseHomeDraft} from './riderCommute.ts';
import {sortRealRides} from './riderRank.ts';
const street={id:'W:500600700',name:'شارع عبد السلام أمين',detail:'الحي الأول · أكتوبر',
 source:'map',kind:'road',latitude:29.9724456,longitude:30.9448074};
const mall={id:'W:253593226',name:'كايرو فستيفال سيتى مول',detail:'القاهرة الجديدة',
 source:'map',kind:'feature',osmValue:'mall',latitude:30.0279,longitude:31.4082};
const validSaved={origin:street.name,destination:mall.name,
 originPlace:{kind:'search',place:street},destinationPlace:{kind:'search',place:mall},
 outbound:'07:30',returnTime:'',period:'monthly',direction:'outbound',
 savedAt:'2026-11-21T00:00:00.000Z'};
test('named streets and large malls are selectable as search anchors, NOT pickup pins',()=>{
 assert.equal(isSearchableMapPlace(street),true);
 assert.equal(isSearchableMapPlace(mall),true);
 assert.equal(selectOperationalMapPlace(street),false);
 assert.equal(selectOperationalMapPlace(mall),false);
 assert.equal(isSearchableMapPlace({...street,id:'manual:29.972446,30.944807',source:'manual_map_pin'}),false);
 assert.equal(isSearchableMapPlace({...street,id:'W:2222',latitude:29.3}),false);
 assert.equal(isSearchableMapPlace({...street,id:'fake',latitude:30.02}),false);
});
test('named-place choices persist for actual nearby route search after navigation',()=>{
 assert.deepEqual(parseSavedCommute(validSaved),validSaved);
 const draft={origin:street.name,destination:mall.name,
  originPlace:validSaved.originPlace,destinationPlace:validSaved.destinationPlace,
  outbound:'',returnTime:'',period:'monthly',direction:'outbound',weekdays:[]};
 assert.deepEqual(parseHomeDraft(draft),draft);
 assert.equal(parseSavedCommute({...validSaved,originPlace:{kind:'search',place:{...street,latitude:40}}}),null);
});
test('published candidate ranking minimizes Captain pickup AND dropoff distance',()=>{
 const first={route:{seat_price_egp:50,outbound_time:'08:00',return_time:null},reverse:false,
  remaining:2,pickupDistanceKm:0.5,dropoffDistanceKm:2.5};
 const second={route:{seat_price_egp:60,outbound_time:'08:10',return_time:null},reverse:false,
  remaining:1,pickupDistanceKm:1.1,dropoffDistanceKm:0.4};
 assert.deepEqual(sortRealRides([first,second],'recommended',true),[second,first]);
 assert.deepEqual(sortRealRides([first,second],'recommended',false),[first,second]);
});
