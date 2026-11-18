import test from 'node:test';
import assert from 'node:assert/strict';
import {
 parseEgyptianPlate,cleanPlateChars,editPlateSlot,pastePlate,isCompletePlate
} from './plateSegments.ts';
import {captainVehicleErrors} from './captainValidation.ts';

const validDetails=(plate)=>({
 vehicleType:'private_car',makeId:'1',modelId:'2',year:'2010',
 colorCode:'white',colorOther:'',plate
});

test('fixed plate slots support only 2+4, 3+3 or 3+4, with no governorate choice',()=>{
 for(const plate of ['مس6587','أبج123','أبج1234']){
  const {letters,digits}=parseEgyptianPlate(plate);
  assert.equal(isCompletePlate(letters,digits),true);
  assert.equal(captainVehicleErrors(validDetails(plate),2026).plate,undefined,plate);
 }
 for(const plate of ['م','م2','مس','مس1','مس12','مس123','أبج1','أبج12']){
  const {letters,digits}=parseEgyptianPlate(plate);
  assert.equal(isCompletePlate(letters,digits),false,plate);
  assert.ok(captainVehicleErrors(validDetails(plate),2026).plate,plate);
 }
});

test('slots enforce start-first, no middle or last slot before prior one',()=>{
 let plate='';
 assert.equal(editPlateSlot(plate,'letter',2,'ج'),'');
 assert.equal(editPlateSlot(plate,'letter',1,'س'),'');
 assert.equal(editPlateSlot(plate,'digit',0,'1'),'');
 plate=editPlateSlot(plate,'letter',0,'م');
 assert.equal(plate,'م');
 assert.equal(editPlateSlot(plate,'digit',0,'1'),'م');
 assert.equal(editPlateSlot(plate,'letter',2,'ج'),'م');
 plate=editPlateSlot(plate,'letter',1,'س');
 assert.equal(plate,'مس');
 assert.equal(editPlateSlot(plate,'digit',2,'3'),'مس');
 plate=editPlateSlot(plate,'digit',0,'6');
 assert.equal(plate,'مس6');
 assert.equal(editPlateSlot(plate,'digit',3,'7'),'مس6');
 plate=editPlateSlot(plate,'digit',1,'5');
 plate=editPlateSlot(plate,'digit',2,'8');
 plate=editPlateSlot(plate,'digit',3,'7');
 assert.equal(plate,'مس6587');
 assert.ok(isCompletePlate(parseEgyptianPlate(plate).letters,parseEgyptianPlate(plate).digits));
});

test('editing an earlier slot does not leave holes or stale digits',()=>{
 assert.equal(editPlateSlot('مس6587','letter',0,'ي'),'يس6587');
 assert.equal(editPlateSlot('مس6587','digit',1,'9'),'مس6987');
 assert.equal(editPlateSlot('مس6587','digit',1,''),'مس6');
 assert.equal(editPlateSlot('مس6587','letter',0,''),'');
 assert.equal(editPlateSlot('أبج1234','letter',2,''),'أب1234');
 assert.equal(editPlateSlot('أبج1234','digit',2,''),'أبج12');
});

test('Arabic and Persian digits normalize, invalid chars do not enter boxes',()=>{
 assert.deepEqual(cleanPlateChars('٥۶8','digit'),['5','6','8']);
 assert.deepEqual(cleanPlateChars('AB س-ج','letter'),['س','ج']);
 assert.equal(editPlateSlot('مس65','digit',2,'٢'),'مس652');
 assert.equal(editPlateSlot('مس65','digit',2,'A'),'مس65');
 assert.equal(editPlateSlot('مس65','letter',2,'7'),'مس65');
});

test('full-plate paste allows only supported complete patterns',()=>{
 assert.equal(pastePlate('','م س ٦٥٨٧','letter',0),'مس6587');
 assert.equal(pastePlate('','أ ب ج ١٢٣','letter',0),'أبج123');
 assert.equal(pastePlate('','أبج1234','letter',0),'أبج1234');
 assert.equal(pastePlate('','مس123','letter',0),'');
 assert.equal(pastePlate('','ABCD1234','letter',0),'');
 assert.equal(pastePlate('مس6587','م1234','letter',0),'مس6587');
});

test('whole-plate paste is restricted to first letter slot and rejects extra symbols',()=>{
 assert.equal(pastePlate('م','مس6587','letter',1),'م');
 assert.equal(pastePlate('مس','أبج123','digit',0),'مس');
 assert.equal(pastePlate('مس6587','أبج1234','letter',1),'مس6587');
 assert.equal(pastePlate('','م س ٦٥٨٧ xyz','letter',0),'');
 assert.equal(pastePlate('','أبج123@','letter',0),'');
 assert.equal(pastePlate('','أبج12345','letter',0),'');
 assert.equal(pastePlate('','٦٥٨٧ م س','letter',0),'مس6587');
 assert.equal(pastePlate('مس6587','أ ب ج ١٢٣','letter',0),'أبج123');
});
