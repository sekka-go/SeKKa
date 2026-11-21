import {greaterCairoGeometry} from './greaterCairoGeometry.ts';
import {validCoordinates} from './nearbyRoutes.ts';
import type {GeoPoint} from './nearbyRoutes.ts';

// Photon receives this envelope only as a search hint.
export const greaterCairoEnvelope = '30.8438534661,29.7536947702,31.5344637106,30.2980187935';
export const greaterCairoAttribution = '© European Union, 2024 · GHSL / JRC · Built Environment Observatory';

function ringPosition(x: number, y: number, ring: number[][]): 'edge' | 'inside' | 'outside' {
 let inside = false;
 for (let i = 1; i < ring.length; i++) {
  const [ax, ay] = ring[i-1];
  const [bx, by] = ring[i];
  const cross = (x-ax)*(by-ay)-(y-ay)*(bx-ax);
  if (Math.abs(cross)<=1e-13 && x>=Math.min(ax,bx) && x<=Math.max(ax,bx) &&
     y>=Math.min(ay,by) && y<=Math.max(ay,by)) return 'edge';
  if ((ay>y)!==(by>y) && x<ax+(bx-ax)*(y-ay)/(by-ay)) inside=!inside;
 }
 return inside?'inside':'outside';
}

export function isInsideOperationalRegion(point: GeoPoint): boolean {
 if (!validCoordinates(point)) return false;
 const {latitude,longitude}=point;
 return greaterCairoGeometry.coordinates.some(([outer,...holes]) =>
  ringPosition(longitude,latitude,outer)!=='outside' &&
  holes.every(ring=>ringPosition(longitude,latitude,ring)!=='inside'));
}

export function persistableOperationalPoint(point:GeoPoint|null|undefined):GeoPoint|null {
 if(!validCoordinates(point)||!isInsideOperationalRegion(point))return null;
 const rounded={latitude:Number(point.latitude.toFixed(6)),longitude:Number(point.longitude.toFixed(6))};
 return isInsideOperationalRegion(rounded)?rounded:null;
}

export function isPersistableOperationalPoint(point:GeoPoint|null|undefined):boolean {
 return persistableOperationalPoint(point)!==null;
}
