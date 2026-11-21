import test from 'node:test';
import assert from 'node:assert/strict';
import {greaterCairoGeometry} from './greaterCairoGeometry.ts';
import {readFileSync,readdirSync} from 'node:fs';
import {mapPlacesFromPhoton,serviceMatches,placeMatchesArea,stopNearPoint,geoRequestAvailable,inLaunchRegion,normalizedPlace,catalogMatches,rankMapPlaces,selectOperationalMapPlace,inspectPhoton} from './geoPlace.ts';

const areas=[
 {id:1,name_ar:'المعادي',name_en:'Maadi'},
 {id:3,name_ar:'مدينة نصر',name_en:'Nasr City'},
 {id:7,name_ar:'الشيخ زايد',name_en:'Sheikh Zayed'}
];
test('service-area text lookup handles English and Arabic spelling variations',()=>{
 assert.equal(serviceMatches(areas,'nAsr')[0]?.id,3);
 assert.equal(serviceMatches(areas,'مدينة نصر')[0]?.id,3);
 assert.equal(serviceMatches(areas,'المعادِي')[0]?.id,1);
 assert.equal(serviceMatches(areas,'').length,0);
});
test('Photon place parsing accepts verified Greater Cairo coordinates, rejects out-of-region',()=>{
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
test('map stop locality must belong to the explicitly chosen seKKa service area',()=>{
 const maadi={...mapPlacesFromPhoton({features:[{
  geometry:{coordinates:[31.25,29.96]},
  properties:{name:'Maadi Market',district:'Maadi',city:'Cairo',countrycode:'EG',osm_id:101,osm_type:'N'}
 }]})[0]};
 assert.equal(placeMatchesArea(maadi,areas[0]),true);
 assert.equal(placeMatchesArea(maadi,areas[1]),false);
 const ambiguous={...maadi,locality:['Cairo'],detail:'Cairo'};
 assert.equal(placeMatchesArea(ambiguous,areas[0]),false);
 const arabic={...maadi,locality:['مدينة نصر']};
 assert.equal(placeMatchesArea(arabic,areas[1]),true);
 assert.equal(placeMatchesArea(arabic,areas[0]),false);
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

test('Egyptian spelling, numerals, aliases and curated Hosary order are deterministic',()=>{
 assert.equal(normalizedPlace('  ألتّجمُّعُ ـ ۵،٦  '),'التجمع 5 6');
 assert.equal(normalizedPlace('الحصرى'),'الحصري');
 for(const query of ['الحصري','الحصرى','El Hosary']){
  assert.deepEqual(catalogMatches(query).map(x=>x.key),['hosary-square','hosary-mosque']);
 }
 for(const query of ['التجمع 5','Fifth Settlement','التجمع الخامس']){
  assert.equal(catalogMatches(query)[0]?.key,'fifth-settlement');
 }
 const oct={id:8,name_ar:'6 أكتوبر',name_en:'6th of October'};
 for(const query of ['أكتوبر','٦ أكتوبر','6 اكتوبر']){
  assert.equal(serviceMatches([oct],query)[0],oct);
 }
 assert.deepEqual(serviceMatches(areas,'زايد'),[areas[2]]);
 assert.deepEqual(serviceMatches(areas,'Alexandria'),[]);
});

const feature=(coordinates,properties)=>({
 geometry:{type:'Point',coordinates},
 properties:{countrycode:'EG',...properties}
});
test('out-of-scope points, foreign providers and missing OSM references cannot be selected',()=>{
 const check=inspectPhoton({features:[
  feature([30.8428,29.3084],{name:'Fayoum',osm_type:'N',osm_id:210}),
  feature([31.6295623,30.1488541],{name:'Unverified Shorouk fringe',osm_type:'N',osm_id:211}),
  feature([31.2357,30.0444],{name:'Missing OSM reference'}),
  feature([31.2357,30.0444],{name:'Foreign feature',countrycode:'AE',osm_type:'N',osm_id:212}),
 ]});
 assert.equal(check.outside,true);
 assert.deepEqual(check.places,[]);
});

test('Fifth Settlement ranks as a neighborhood and its namesake shop in October is discarded',()=>{
 const canonical=feature([31.4249357,30.0038046],{name:'التجمع الخامس',city:'القاهرة الجديدة',osm_type:'W',osm_id:774635278,osm_key:'place',osm_value:'neighbourhood'});
 const unrelated=feature([30.9459443,29.9731044],{name:'التجمع الخامس',city:'السادس من أكتوبر',osm_type:'N',osm_id:4555939289,osm_key:'shop',osm_value:'bookmaker'});
 const ranked=rankMapPlaces(mapPlacesFromPhoton({features:[unrelated,canonical]}),'التجمع 5');
 assert.deepEqual(ranked.map(r=>[r.id,r.kind]),[['W:774635278','area']]);
 assert.equal(selectOperationalMapPlace(ranked[0]),false);
});

test('a road or a mapped square representative point is never selected as an exact stop',()=>{
 const square=feature([30.9448074,29.9724456],{name:'ميدان الحصري',city:'السادس من أكتوبر',osm_type:'W',osm_id:1393055714,osm_key:'place',osm_value:'square'});
 const points=rankMapPlaces(mapPlacesFromPhoton({features:[square]}),'El Hosary');
 assert.equal(points[0]?.name,'ميدان الحصري');
 assert.equal(selectOperationalMapPlace(points[0]),false);
});

test('browser polygon and PostGIS use the same source geometry and cover outer edges',()=>{
 const migrationDir=new URL('../../../supabase/migrations/',import.meta.url);
 const filename=readdirSync(migrationDir).find(n=>n.endsWith('_v31_operational_geofence.sql'));
 const sql=readFileSync(new URL(filename,migrationDir),'utf8');
 const match=sql.match(/\$geo\$(.+?)\$geo\$/);
 assert.deepEqual(JSON.parse(match[1]),greaterCairoGeometry);
 const [longitude,latitude]=greaterCairoGeometry.coordinates[0][0][0];
 assert.equal(inLaunchRegion({latitude,longitude}),true);
 assert.match(sql,/st_covers\(b.geometry/);
 assert.match(sql,/before insert or update of latitude,longitude/);
 assert.match(sql,/endpoint.covered/);
});
