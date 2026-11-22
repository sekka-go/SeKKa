import test from 'node:test';
import assert from 'node:assert/strict';
import {mapProject,mapUnproject,mapMove,mapZoom,visibleTiles} from './geoMapMath.ts';
import {isInsideOperationalRegion,persistableOperationalPoint} from './greaterCairoBoundary.ts';
test('verified Greater Cairo point survives projection across mobile zooms',()=>{
 const target={latitude:29.9724456,longitude:30.9448074};
 for(const zoom of [9,11,13,16,17]){
  const point=mapProject(target,zoom);
  const back=mapUnproject(point.x,point.y,zoom);
  assert.ok(Math.abs(back.latitude-target.latitude)<1e-6);
  assert.ok(Math.abs(back.longitude-target.longitude)<1e-6);
 }
});
test('pan moves the viewport but does not manufacture a source place id',()=>{
 const cairo={latitude:30.0443934,longitude:31.2357457};
 const moved=mapMove(cairo,150,0,13);
 assert.ok(moved.longitude<cairo.longitude);
 assert.equal(mapZoom(0),9);
 assert.equal(mapZoom(99),17);
});
test('tiles are bounded to the visible viewport and a single OSM origin',()=>{
 const center={latitude:30.0443934,longitude:31.2357457};
 const tiles=visibleTiles(center,12,360,440);
 assert.ok(tiles.length>=4&&tiles.length<=16);
 assert.ok(tiles.every(t=>t.url.startsWith('https://tile.openstreetmap.org/12/')));
 assert.equal(new Set(tiles.map(t=>t.id)).size,tiles.length);
});
test('a manually selected point is accepted only if within approved operating polygon',()=>{
 assert.ok(persistableOperationalPoint({latitude:29.9724456,longitude:30.9448074}));
 assert.equal(isInsideOperationalRegion({latitude:29.3084,longitude:30.8428}),false);
 assert.equal(persistableOperationalPoint({latitude:29.3084,longitude:30.8428}),null);
});
