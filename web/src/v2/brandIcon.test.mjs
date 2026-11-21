import test from 'node:test';
import assert from 'node:assert/strict';
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
