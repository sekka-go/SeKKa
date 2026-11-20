import test from 'node:test';
import assert from 'node:assert/strict';
import {placeMatchesSearch} from './captainSearchMatch.ts';

test('accepts the intended street, not a nearby unrelated university',()=>{
 assert.equal(placeMatchesSearch({name:'90th Street'},'شارع التسعين'),true);
 assert.equal(placeMatchesSearch({name:'Southern 90th Street'},'شارع التسعين'),true);
 assert.equal(placeMatchesSearch({name:'American University in Cairo'},'شارع التسعين'),false);
 assert.equal(placeMatchesSearch({name:'Cairo Festival City'},'شارع التسعين'),false);
});
test('preserves exact and shortened place-name matching',()=>{
 assert.equal(placeMatchesSearch({name:'Maadi Grand Mall'},'Maadi Grand Mall'),true);
 assert.equal(placeMatchesSearch({name:'Mall of Arabia 6th October'},'Mall of Arabia'),true);
 assert.equal(placeMatchesSearch({name:'Al Hosary Square'},'ميدان الحصري'),true);
 assert.equal(placeMatchesSearch({name:'AUC'},'90th Street'),false);
 assert.equal(placeMatchesSearch({name:'Dokki Square'},''),false);
});