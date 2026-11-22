import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const front=read('./LiveTripRequests.tsx');
const results=read('./LiveRouteSearch.tsx');
const discovery=read('./Discovery.tsx');
const app=read('./MobileApp.tsx');
const home=read('./RiderJourneyHome.tsx');
const css=read('./ui-quality-hardening.css');
const manifest=JSON.parse(read('../../public/manifest.webmanifest'));
const html=read('../../index.html');

const linear=(h)=>{
 const n=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)
  .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return n[0]*.2126+n[1]*.7152+n[2]*.0722;
};
const contrast=(a,b)=>{
 const x=linear(a),y=linear(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};

test('new header and contextual yellow action pass body-text contrast on declared colors',()=>{
 assert.ok(contrast('#075687','#FFFFFF')>=4.5);
 assert.ok(contrast('#FFCC24','#10344F')>=4.5);
 assert.match(css,/sekka-no-match-action.*sekka-request-yellow-cta/s);
});

test('the installed icon, favicon and Apple icon use the same S monogram family',()=>{
 const pngs=manifest.icons.map(icon=>icon.src);
 assert.deepEqual(pngs,[
  '/brand/sekka-s-icon-192.png',
  '/brand/sekka-s-icon-512.png',
  '/brand/sekka-s-icon.svg'
 ]);
 for(const src of pngs){
  assert.ok(existsSync(new URL('../../public'+src,import.meta.url)));
 }
 assert.match(html,/rel="icon" type="image\/png" sizes="192x192" href="\/brand\/sekka-s-icon-192\.png"/);
 assert.match(html,/apple-touch-icon" href="\/brand\/sekka-s-icon-192\.png"/);
});

test('no-match request never invents time, and discloses unsupported weekday details',()=>{
 assert.match(front,/sekka-request-missing-time/);
 assert.match(front,/!validClock\(requestTime\)/);
 assert.match(front,/!validClock\(requestReturnTime\)/);
 assert.match(front,/search\.weekdays\?\.length/);
 assert.match(results,/weekdays,\n\s*direction:/);
 assert.match(discovery,/weekdays=\{preferredWeekdays\}/);
 assert.match(front,/We could not save your changes/);
});

test('main drawer is native modal and rider subeditor keeps Tab inside',()=>{
 assert.match(app,/dialog\.showModal\(\)/);
 assert.match(app,/onCancel=\{event=>\{event\.preventDefault\(\);closeMenu\(\);\}\}/);
 assert.match(css,/sekka-side-drawer\.sekka-glass-panel::backdrop/);
 assert.match(home,/editorPanel=useRef<HTMLElement>/);
 assert.match(home,/event\.shiftKey&&/);
});

test('small-screen bottom navigation and drawer controls have legible hit area',()=>{
 assert.match(css,/rh-tabs \.rh-tabs__name\{[\s\S]*font-size:12px!important/);
 assert.match(css,/sekka-side-drawer\.sekka-glass-panel \.sekka-glass-rail-toggle/);
 assert.match(css,/min-height:44px!important;min-width:44px!important/);
});
