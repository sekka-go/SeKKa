import test from 'node:test';
import assert from 'node:assert/strict';
import {draftPriceGuidance,outsideDraftPriceGuidance} from './draftPriceGuidance.ts';

const a={latitude:30.0,longitude:31.0},b={latitude:30.1,longitude:31.0},c={latitude:30.2,longitude:31.0};
test('estimated pricing uses all segments and 1.35 Haversine fallback, not a verified road route',()=>{
 const band=draftPriceGuidance([a,b,c]);
 assert.ok(band);
 assert.equal(band.source,'haversine_estimate');
 assert.ok(band.distanceKm>29 && band.distanceKm<31);
 assert.ok(band.minimumEgp>200&&band.maximumEgp>350);
 assert.equal(outsideDraftPriceGuidance(6,band),true);
 assert.equal(outsideDraftPriceGuidance(300,band),false);
});
test('no estimate for malformed or non-finite coordinates, no invented price',()=>{
 assert.equal(draftPriceGuidance([a]),null);
 assert.equal(draftPriceGuidance([a,{latitude:NaN,longitude:31}]),null);
 assert.equal(draftPriceGuidance([a,b],12,7),null);
 assert.equal(draftPriceGuidance([a,b],0,12),null);
 assert.equal(draftPriceGuidance([a,a]),null);
 assert.equal(outsideDraftPriceGuidance(Number.NaN,null),false);
});
