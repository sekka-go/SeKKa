import test from 'node:test';
import assert from 'node:assert/strict';
import {inferCaptainArea,resolveCaptainRoutingArea,validClock,validStopSchedule} from './captainStopPlanning.ts';
const areas=[{id:8,name_ar:'6 أكتوبر',name_en:'6th of October'},
 {id:2,name_ar:'التجمع',name_en:'New Cairo'},
 {id:1,name_ar:'المعادي',name_en:'Maadi'}];
const origin={id:'N:8888',name:'El Hosary',detail:'6th of October',locality:['6th of October'],
 source:'map',kind:'point',latitude:29.972,longitude:30.942};
test('Captain origin chooses service area only from verified locality, not a guessed nearest city',()=>{
 assert.equal(inferCaptainArea(origin,areas)?.id,8);
 assert.equal(inferCaptainArea({...origin,detail:'Unknown',locality:['Unknown']},areas),null);
 assert.equal(inferCaptainArea({...origin,detail:'New Cairo',locality:['New Cairo']},areas)?.id,2);
});
test('optional Captain stop times accept blanks, validate clock and overnight sequence',()=>{
 assert.equal(validClock(''),true);assert.equal(validClock('07:30'),true);
 for(const bad of ['7:30','24:00','12:67','09:45:00','hello'])assert.equal(validClock(bad),false);
 const stops=[{outboundStopTime:'07:30',returnStopTime:'18:20'},
  {outboundStopTime:'',returnStopTime:''},{outboundStopTime:'08:00',returnStopTime:'17:10'}];
 assert.equal(validStopSchedule(stops),true);
 assert.equal(validStopSchedule([{outboundStopTime:'23:45',returnStopTime:''},
  {outboundStopTime:'00:15',returnStopTime:''}]),true);
 assert.equal(validStopSchedule([{outboundStopTime:'23:30',returnStopTime:''},
  {outboundStopTime:'00:10',returnStopTime:''},{outboundStopTime:'23:40',returnStopTime:''},
  {outboundStopTime:'00:20',returnStopTime:''}]),false);
});

test('a known Cairo place is added directly even if Photon omits its district',()=>{
 const hosary={...origin,name:'ميدان الحصري',detail:'Giza',locality:['Giza']};
 assert.equal(inferCaptainArea(hosary,areas),null);
 assert.equal(resolveCaptainRoutingArea(hosary,areas)?.id,8);
 const cfc={...origin,name:'Cairo Festival City Mall',
  latitude:30.028,longitude:31.408,detail:'Cairo',locality:['Cairo']};
 assert.equal(inferCaptainArea(cfc,areas),null);
 assert.equal(resolveCaptainRoutingArea(cfc,areas)?.id,2);
});
test('verified locality wins over nearest routing anchor and no unsupported area is invented',()=>{
 assert.equal(resolveCaptainRoutingArea({...origin,locality:['New Cairo'],detail:'New Cairo'},areas)?.id,2);
 assert.equal(resolveCaptainRoutingArea({...origin,latitude:Number.NaN},areas),null);
 assert.equal(resolveCaptainRoutingArea({...origin,detail:'none',locality:['none']},[]),null);
});
