import test from 'node:test';
import assert from 'node:assert/strict';
import {filterPopularPlaces,popularPlacesForArea,popularPlaceCount,popularPlaceTypes} from './popularCaptainPlaces.ts';

test('all current nine Cairo/Giza service areas have landmark suggestions',()=>{
 for(const key of ['Maadi','New Cairo','Nasr City','Dokki','Mohandessin','Zamalek',
  'Sheikh Zayed','6th of October','Heliopolis']){
  const places=popularPlacesForArea(key);
  assert.ok(places.length>=6,key+' has fewer than six choices');
  assert.ok(places.some(x=>x.type==='neighborhood'),key+' must include a neighborhood');
  assert.ok(places.some(x=>x.type==='gathering'),key+' must include a gathering point');
  assert.ok(places.every(x=>x.name_ar&&x.name_en&&popularPlaceTypes.includes(x.type)));
 }
 assert.ok(popularPlaceCount>=60);
});
test('district and type filters are stable in Arabic and English',()=>{
 const october=popularPlacesForArea('6th of October');
 assert.ok(filterPopularPlaces(october,'all','الحصري').length>=1);
 assert.ok(filterPopularPlaces(october,'mall','مول').length>=1);
 assert.ok(filterPopularPlaces(october,'university','University').length>=1);
 assert.deepEqual(filterPopularPlaces(october,'university','Mall'),[]);
 assert.deepEqual(popularPlacesForArea('Some unapproved area'),[]);
});
test('popular-place suggestions do not embed trusted coordinates or service-area IDs',()=>{
 for(const name of ['Maadi','New Cairo','Nasr City','Dokki','Mohandessin','Zamalek',
  'Sheikh Zayed','6th of October','Heliopolis']){
  for(const choice of popularPlacesForArea(name)){
   assert.equal('latitude' in choice,false);
   assert.equal('longitude' in choice,false);
   assert.equal('area_id' in choice,false);
  }
 }
});
