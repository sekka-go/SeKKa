import test from 'node:test';
import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {TextEncoder} from 'node:util';
import {prepareCaptainDocument,MAX_CAPTAIN_DOCUMENT_BYTES} from './captainUpload.ts';

test('private Captain upload uses actual verified JPEG Blob despite generic Android MIME',async()=>{
 const input=new File([new Uint8Array([0xff,0xd8,0xff,0xe0,0x01,0x02,0x03,0xd9])],
  'gallery-item',{type:'application/octet-stream'});
 const result=await prepareCaptainDocument(input);
 assert.equal(result.contentType,'image/jpeg');
 assert.equal(result.body.type,'image/jpeg');
 assert.equal(result.extension,'jpg');
 assert.equal(result.compressed,false);
 assert.ok(result.body.size>0);
 assert.ok(result.body.size<=MAX_CAPTAIN_DOCUMENT_BYTES);
});
test('private Captain upload preserves valid PDF and rejects forged MIME',async()=>{
 const pdf=new File([new TextEncoder().encode('%PDF-1.7 body')],'doc.pdf',{type:'application/octet-stream'});
 const saved=await prepareCaptainDocument(pdf);
 assert.equal(saved.extension,'pdf');
 assert.equal(saved.contentType,'application/pdf');
 assert.equal(await saved.body.text(),'%PDF-1.7 body');
 const forged=new File(['NOT_AN_IMAGE'],'photo.jpg',{type:'image/jpeg'});
 await assert.rejects(()=>prepareCaptainDocument(forged),/FILE_INVALID_SIGNATURE/);
});
test('oversized provider bytes cannot bypass five-megabyte document limit',async()=>{
 const bytes=new Uint8Array(MAX_CAPTAIN_DOCUMENT_BYTES+1);bytes.set([0xff,0xd8,0xff]);
 const fake={size:12,arrayBuffer:async()=>bytes.buffer};
 await assert.rejects(()=>prepareCaptainDocument(fake),/FILE_INVALID_SIZE/);
});
