import test from 'node:test';
import assert from 'node:assert/strict';
import {mapPlacesFromPhoton,serviceMatches,stopNearPoint,geoRequestAvailable,inLaunchRegion} from './geoPlace.ts';

const areas=[
 {id:1,name_ar:'المعادي',name_en:'Maadi'},
 {id:3,name_ar:'مدينة نصر',name_en:'Nasr City'},
 {id:7,name_ar:'الشيخ زايد',name_en:'Sheikh Zayed'}
];
test('service-area text lookup handles English and Arabic spelling variations',()=>{
 assert.equal(serviceMatches(areas,'nAsr')[0]?.id,3);
 assert.equal(serviceMatches(areas,'مدينة نصر')[0]?.id,3);
 assert.equal(serviceMatches(areas,'المعادِي')[0]?.id,1);
 assert.equal(serviceMatches(areas,'')->length,0);
});
test('Photon place parsing accepts Cairo/Giza Egypt coordinates, rejects out-of-region',()=>{
 const geo={features:[
  {geometry:{coordinates:[31.2357,30.0444]},properties:{osm_id:10,osm_type:'N',name:'Downtown Cairo',city:'Cairo',countrycode:'EG'}},
  {geometry:{coordinates:[31.2357,30.0444]},properties:{osm_id:10,osm_type:'N',name:'Duplicate',countrycode:'EG'}},
  {geometry:{coordinates:[31.2357,30.0444]},properties:{osm_id:11,osm_type:'N',name:'Other country',countrycode:'FR'}},
  {geometry:{coordinates:[35.93,31.95]},properties:{osm_id:12,name:'Amman',countrycode:'JO'}}
 ]};
 const result=mapPlacesFromPhoton(geo);
 assert.equal(result.length,1);
 assert.equal(result[0]?.name,'Downtown Cairo');
 assert.equal(result[0]?.latitude,30.0444);
 assert.ok(inLaunchRegion(result[0]));
 assert.equal(mapPlacesFromPhoton({features:[]}).length,0);
});
test('spatial matching uses real stop coordinates with a 3km cap',()=>{
 const stop={latitude:30.048,longitude:31.2357},near={latitude:30.045,longitude:31.2357},
  far={latitude:29.9,longitude:31.2357};
 assert.equal(stopNearPoint(stop,near,3),true);
 assert.equal(stopNearPoint(stop,far,3),false);
 assert.equal(stopNearPoint({latitude:NaN,longitude:31.2},near,3),false);
});
test('new trip requests may not silently map an arbitrary GPS point into service area IDs',()=>{
 const first={kind:'service',area:areas[0]},other={kind:'service',area:areas[2]};
 const map={kind:'map',place:{id:'osm',name:'Street',detail:'Cairo',source:'map',latitude:30.04,longitude:31.23}};
 assert.equal(geoRequestAvailable(first,other),true);
 assert.equal(geoRequestAvailable(first,first),false);
 assert.equal(geoRequestAvailable(map,other),false);
 assert.equal(geoRequestAvailable(null,other),false);
});
