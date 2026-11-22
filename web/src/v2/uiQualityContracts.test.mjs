import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {URL} from 'node:url';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const front=read('./LiveTripRequests.tsx');
const results=read('./LiveRouteSearch.tsx');
const discovery=read('./Discovery.tsx');
const app=read('./MobileApp.tsx');
const home=read('./RiderJourneyHome.tsx');
const css=read('./ui-quality-hardening.css');
const urban=read('./urban-mobility-palette.css');
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

test('urban headers and yellow contextual action pass WCAG body text contrast',()=>{
 assert.ok(contrast('#1753E8','#FFFFFF')>=4.5);
 assert.ok(contrast('#17253A','#FFFFFF')>=4.5);
 assert.ok(contrast('#FFD02A','#17253A')>=4.5);
 assert.match(css,/sekka-no-match-action.*sekka-request-yellow-cta/s);
});

test('PoNo installed icon, favicon and Apple icon share owner-approved P mark',()=>{
 const pngs=manifest.icons.map(icon=>icon.src);
 assert.deepEqual(pngs,[
  '/brand/pono-icon-192.png',
  '/brand/pono-icon-512.png',
  '/brand/pono-icon.svg'
 ]);
 for(const src of pngs){
  assert.ok(existsSync(new URL('../../public'+src,import.meta.url)));
 }
 assert.match(html,/rel="icon" type="image\/png" sizes="192x192" href="\/brand\/pono-icon-192\.png"/);
 assert.match(html,/apple-touch-icon" href="\/brand\/pono-icon-192\.png"/);
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

test('Urban Mobility palette is retained while approved PoNo P becomes the identity',()=>{
 assert.match(urban,/--urban-blue:#1753E8/);
 assert.match(urban,/--urban-navy:#17253A/);
 assert.match(urban,/--urban-paper:#F5F3ED/);
 assert.match(urban,/--urban-yellow:#FFD02A/);
 assert.match(urban,/color:#17253A!important/);
 assert.match(urban,/Dark mode retains dark lettering on high-visibility yellow actions/);
 assert.match(urban,/rh-showcase-hero__top-wave/);
 assert.match(urban,/display:none!important/);
 assert.match(read('./MobileApp.tsx'),/import '\.\/urban-mobility-palette\.css'/);
 assert.match(read('../../public/brand/pono-icon.svg'),/fill-rule="evenodd"/);
 assert.equal(manifest.theme_color,'#0648F5');
 assert.match(html,/selectedTheme === 'dark' \? '#101827' : '#0648F5'/);
});

test('PoNo is installed in the actual PWA entry, never the 73-screen developer gallery',()=>{
 const entry=read('../main.tsx');
 const splash=read('./LaunchSplash.tsx');
 const onboarding=read('./Onboarding.tsx');
 const guest=read('./GuestEntry.tsx');
 assert.match(entry,/<LaunchSplash><MobileApp\/><\/LaunchSplash>/);
 assert.match(entry,/\["\/dev\/screens", "\/dev\/screens\/"\]/);
 assert.equal(manifest.name,'PoNo');
 assert.equal(manifest.short_name,'PoNo');
 assert.match(html,/<title>PoNo<\/title>/);
 assert.match(splash,/pono-wordmark-white\.svg/);
 assert.match(onboarding,/pono-wordmark\.svg/);
 assert.match(guest,/pono-wordmark\.svg/);
 assert.match(app,/pono-icon\.svg/);
 assert.match(app,/pono-wordmark\.svg/);
});
