import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {URL} from 'node:url';

function readChunks(filename){
 const bytes=readFileSync(new URL('../../public/brand/'+filename,import.meta.url));
 assert.equal(bytes.subarray(1,4).toString(),'PNG');
 let index=8;
 const result=[];
 while(index<bytes.length){
  const length=bytes.readUInt32BE(index);
  const type=bytes.toString('ascii',index+4,index+8);
  result.push({type,data:bytes.subarray(index+8,index+8+length)});
  index+=length+12;
  if(type==='IEND')break;
 }
 return result;
}
for(const size of [192,512]){
 test(`classic Arabic mark ${size}px is palette-only recolored, not redrawn`,()=>{
  const original=readChunks(`sekka-icon-${size}.png`);
  const refreshed=readChunks(`sekka-go-${size}.png`);
  assert.deepEqual(original.map(x=>x.type),refreshed.map(x=>x.type));
  for(let i=0;i<original.length;i++){
   if(original[i].type==='PLTE')assert.notDeepEqual(original[i].data,refreshed[i].data);
   else assert.deepEqual(original[i].data,refreshed[i].data,
    `PNG ${original[i].type} data changed; the legacy silhouette must remain identical`);
  }
 });
}

const SELECTED_ICON_SHA256={
 192:'778825703ef284be34405911bf6e693edc2188219f1023ef5b488a35c42e1435',
 512:'95c7e6799aca806db1a48db6e32416fbaa7ba4168d8015f302cf3cda2553d6e0'
};
for(const size of [192,512]){
 test(`owner-selected seKKa white wordmark/yellow road icon is installed at ${size}px`,()=>{
  const data=readFileSync(new URL(`../../public/brand/sekka-go-road-${size}.png`,import.meta.url));
  assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16),size);
  assert.equal(data.readUInt32BE(20),size);
  assert.equal(createHash('sha256').update(data).digest('hex'),SELECTED_ICON_SHA256[size]);
  assert.notDeepEqual(data,readFileSync(new URL(`../../public/brand/sekka-go-${size}.png`,import.meta.url)));
 });
}
test('PWA prefers new sky icon while legacy PNG icons remain compatibility fallbacks',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../../public/manifest.webmanifest',import.meta.url),'utf8'));
 const index=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 const splash=readFileSync(new URL('./LaunchSplash.tsx',import.meta.url),'utf8');
 assert.equal(manifest.name,'Sekka Go');
 assert.deepEqual(manifest.icons.map(x=>x.src),[
  '/brand/sekka-sky-mark.svg','/brand/sekka-go-road-192.png','/brand/sekka-go-road-512.png'
 ]);
 assert.match(index,/sekka-sky-mark\.svg/);
 assert.match(index,/sekka-go-road-192\.png/);
 assert.match(splash,/approvedSplashSceneUri/);
 assert.match(splash,/sekka-launch__road-flow/);
 assert.match(splash,/سِكَّة/);
 assert.doesNotMatch(splash,/HiaceArtwork|sekka-launch__black-wipe|sekka-launch__hiace/);
 assert.equal(splash.includes('sekka-go-road-512.png'),false);
});
