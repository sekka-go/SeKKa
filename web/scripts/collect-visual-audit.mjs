// seKKa PR #185 visual evidence. Read-only, no real auth token or fake booking.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const base=(process.env.AUDIT_BASE_URL||'').replace(/\/+$/,'');
if(!/^https:\/\//.test(base))throw Error('Expected pinned HTTPS staging preview URL');
const commit=process.env.AUDIT_BASE_COMMIT||'UNSPECIFIED';
const root=resolve('visual-audit-73');
const titles=[
'Splash','Welcome','Account type','Phone entry','OTP','Complete profile','Permissions',
'Rider home','Search','Filters','Results','Route details','Favorites','Route request',
'Booking review','Booking security','Booking status','Booking details','Payment confirmation',
'Receipt status','Subscription management','Wallet','Wallet top-up','Top-up result',
'Withdrawal','Transactions','My bookings','Past bookings','Chats','Captain chat',
'Notifications','Profile','Edit profile','Support','Captain registration',
'Captain details','Vehicle intent','Captain documents','Submission review','Approval status',
'Captain activation','Captain routes','Create route','Route stops','Schedule','Direction and period',
'Price and capacity','Review and publish','Manage route','Captain home','New bookings',
'Subscribers','Subscriber details','Daily operations','Payment receipt','Captain chats',
'Rider chat','Captain notifications','Payment records','Captain profile','Captain support',
'Admin dashboard','Admin users','Admin captains','Document review','Admin vehicles',
'Admin routes','Admin bookings','Admin wallet','Admin transactions','Admin support',
'Admin announcements','Admin permissions'
];
if(titles.length!==73)throw Error('Expected 73 original screens, got '+titles.length);
const variants=[];
for(const width of [360,390])for(const language of ['ar','en'])for(const theme of ['light','dark']){
 const height=width===360?800:844;
 variants.push({width,height,language,theme,key:width+'x'+height+'-'+language+'-'+theme});
}
const id=n=>'S'+String(n).padStart(3,'0');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phase=n=>n<=14?'phase2':n<=21?'phase3':n<=34?'phase4':n<=41?'phase5':n<=49?'phase6':n<=61?'phase7':'phase8';
const originalPath=n=>'/dev/screens?screen='+n+(n<=7?'&inspect=1':'&preview='+phase(n));
function integrated(n){
 if(n===2)return{url:'/',state:'comparable_guest',note:'Public welcome screen'};
 if(n===3)return{url:'/',state:'comparable_guest',note:'Welcome button opens role selection',action:'welcome'};
 if(n===4)return{url:'/?tab=profile',state:'auth_flow_changed',note:'Gallery phone screen is not equivalent to production Google OAuth login; do not score as pixel mismatch',action:'login'};
 if(n>=9&&n<=11)return{url:'/?tab=search&view='+n,state:'guest_data_mismatch',note:'Real search empty/loading state; gallery preview uses illustrative examples'};
 if(n===12)return{url:'/?tab=search&view=12',state:'route_required',note:'Published route and valid stops required for equivalent details'};
 if(n===8)return{url:'/',state:'auth_required',note:'Guest home shows welcome, not signed-in Rider home'};
 if(n>=15&&n<=18)return{url:'/?tab=booking&view='+n,state:'booking_required',note:'No authenticated booking and selected route; gate is not equivalent'};
 if(n===27||n===28)return{url:'/?tab=bookings',state:'auth_required',note:'Guest bookings gate only'};
 if(n===31)return{url:'/?tab=notifications',state:'auth_required',note:'Guest notification sign-in gate'};
 if(n===32||n===33)return{url:'/?tab=profile',state:'auth_required',note:'Guest profile sign-in gate'};
 if(n>=35&&n<=41)return{url:'/?tab=captain-onboarding&view='+n,state:'auth_required',note:'Captain onboarding requires an authentic Google session'};
 if(n>=42&&n<=49)return{url:'/?tab=routes&view='+n,state:'captain_approval_required',note:'Captain routes require authenticated approved Captain'};
 if(n>=50&&n<=61)return{url:'/?tab=routes&view='+n,state:'no_integrated_equivalent',note:'No distinct production Captain operations route; captured real fallback only'};
 if(n>=62&&n<=73)return{url:'/?tab=admin&view='+n,state:'admin_session_required',note:'Private Admin UI requires server-authorized Google session; screenshot is access gate'};
 if(n>=22&&n<=26)return{url:'/?tab=wallet&view='+n,state:'feature_postponed',note:'Wallet/payment postponed; route falls back to public welcome'};
 if([1,5,6,7].includes(n))return{url:'/',state:'not_exposed_to_guest',note:'No equivalent guest screen; actual public landing is captured'};
 return{url:'/?tab=home&view='+n,state:'no_integrated_equivalent',note:'No distinct production integrated route; fallback captured'};
}
async function bounds(page){
 return page.evaluate(()=>{
  const w=innerWidth,h=innerHeight;
  // The gallery's developer toolbar is not part of the approved screen canvas.
  // Scope interactive measurements to main; measure the app's persistent nav separately.
  const types={headers:'header,.ad-top,.d-header,.b-header',buttons:'main button,main a[role="button"],main input[type="submit"]',
   fields:'main input:not([type="hidden"]),main select,main textarea',cards:'main article,main .d-box,main .b-box,main .ad-card,main .sekka-mobile-card,main .d-result',
   bottomNavigation:'.sekka-bottom-nav'};
  const inIntentionalScroller=e=>{
   for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){
    const style=getComputedStyle(p);
    if(['scroll','auto'].includes(style.overflowX)&&p.scrollWidth>p.clientWidth+2)return true;
   }
   return false;
  };
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&r.width>1&&r.height>1;};
  const groups={},issues=[],controls=[];
  for(const [type,selector] of Object.entries(types)){
   const arr=[];
   for(const e of document.querySelectorAll(selector)){
    if(!visible(e))continue;
    const r=e.getBoundingClientRect();
    const rect={x:+r.x.toFixed(1),y:+r.y.toFixed(1),width:+r.width.toFixed(1),height:+r.height.toFixed(1)};
    const label=(e.getAttribute('aria-label')||e.textContent||e.getAttribute('placeholder')||'').trim().replace(/\s+/g,' ').slice(0,70);
    arr.push({tag:e.tagName.toLowerCase(),label,rect});
    // Offscreen children inside a deliberately scrollable horizontal navigation
    // are not viewport clipping bugs; the scroller is their access mechanism.
    if((r.left < -2||r.right>w+2)&&!inIntentionalScroller(e))
     issues.push({kind:'element_horizontal_clipping',type,label,rect});
    let p=e.parentElement;
    while(p&&p!==document.body){
     const s=getComputedStyle(p),pr=p.getBoundingClientRect();
     if(['clip','hidden'].includes(s.overflowX)&&Math.max(0,pr.left-r.left)+Math.max(0,r.right-pr.right)>8||
        ['clip','hidden'].includes(s.overflowY)&&Math.max(0,pr.top-r.top)+Math.max(0,r.bottom-pr.bottom)>8){
       issues.push({kind:'possible_parent_clipping',type,label});
       break;
     }
     p=p.parentElement;
    }
    if((type==='buttons'||type==='fields')&&r.top<h&&r.bottom>0&&r.right>0&&r.left<w)
     controls.push({e,r,label});
   }
   groups[type]=arr.slice(0,110);
  }
  for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
   const a=controls[i],b=controls[j];
   if(a.e.contains(b.e)||b.e.contains(a.e))continue;
   const dx=Math.max(0,Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left));
   const dy=Math.max(0,Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top));
   const small=Math.min(a.r.width*a.r.height,b.r.width*b.r.height);
   if(small>100&&dx*dy/small>.18)issues.push({kind:'possible_control_overlap',one:a.label,two:b.label,fraction:+(dx*dy/small).toFixed(3)});
  }
  const scrollWidth=document.documentElement.scrollWidth;
  if(scrollWidth>w+2)issues.push({kind:'horizontal_document_overflow',pixels:scrollWidth-w});
  return{viewport:{width:w,height:h},document:{scrollWidth,scrollHeight:document.documentElement.scrollHeight},
   lang:document.documentElement.lang,dir:document.documentElement.dir,theme:document.documentElement.getAttribute('data-theme'),
   counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),groups,issues:issues.slice(0,65)};
 });
}
async function visit(page,path,action){
 await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('body').waitFor({state:'visible',timeout:10000});
 if(action==='welcome'){
  const b=page.getByRole('button',{name:/ابدأ الآن|Get started/i});
  if(await b.count())await b.first().click({timeout:5000});
 }else if(action==='login'){
  const b=page.locator('button.sekka-action');
  if(await b.count())await b.first().click({timeout:5000});
 }
 await page.waitForTimeout(100);
}
async function screenshot(page,file){
 try{await page.screenshot({path:file,fullPage:true,animations:'disabled',timeout:20000});return null;}
 catch(e){return String(e).slice(0,300);}
}
async function main(){
 await mkdir(root,{recursive:true});
 const health=await fetch(base,{redirect:'follow',signal:AbortSignal.timeout(18000)});
 if(!health.ok)throw Error('STAGING_NOT_ACCESSIBLE HTTP '+health.status);
 const browser=await chromium.launch({headless:true});
 const rows=[],started=new Date().toISOString();
 try{
  for(const v of variants){
   const ctx=await browser.newContext({viewport:{width:v.width,height:v.height},
    locale:v.language==='ar'?'ar-EG':'en-GB',colorScheme:v.theme,reducedMotion:'reduce',serviceWorkers:'block'});
   await ctx.addInitScript(p=>{localStorage.setItem('language_preference',p.language);localStorage.setItem('theme_preference',p.theme);},
    {language:v.language,theme:v.theme});
   const gallery=await ctx.newPage(),app=await ctx.newPage();
   for(let n=1;n<=73;n++){
    await mkdir(join(root,'screens',id(n)),{recursive:true});
    const live=integrated(n);
    const row={screen:n,title:titles[n-1],variant:v.key,originalUrl:originalPath(n),integratedUrl:live.url,
     state:live.state,reason:live.note,
     original:'screens/'+id(n)+'/original-'+v.key+'.png',
     integrated:'screens/'+id(n)+'/integrated-'+v.key+'.png',
     originalMetrics:null,integratedMetrics:null,issues:[],errors:[]};
    try{
     await visit(gallery,row.originalUrl);
     row.originalMetrics=await bounds(gallery);
     const error=await screenshot(gallery,join(root,row.original));
     if(error){row.errors.push('original: '+error);row.original=null;}
    }catch(e){row.original=null;row.errors.push('original: '+String(e).slice(0,300));}
    try{
     await visit(app,row.integratedUrl,live.action);
     row.integratedMetrics=await bounds(app);
     const error=await screenshot(app,join(root,row.integrated));
     if(error){row.errors.push('integrated: '+error);row.integrated=null;}
    }catch(e){row.integrated=null;row.errors.push('integrated: '+String(e).slice(0,300));}
    row.issues=[
      ...(row.originalMetrics?.issues||[]).map(i=>({source:'original',...i})),
      ...(row.integratedMetrics?.issues||[]).map(i=>({source:'integrated',...i}))
    ];
    if(row.state!=='comparable_guest')row.issues.push({kind:'non_equivalent_state',detail:row.reason});
    if(row.errors.length)row.issues.push({kind:'capture_error',detail:row.errors});
    if(row.state==='comparable_guest'&&row.originalMetrics&&row.integratedMetrics){
     for(const kind of ['headers','buttons','fields','cards','bottomNavigation']){
      const a=row.originalMetrics.groups[kind]||[],b=row.integratedMetrics.groups[kind]||[];
      if(a.length!==b.length)row.issues.push({kind:'element_count_difference',group:kind,original:a.length,integrated:b.length});
      // Compare only elements with matching accessible labels and tag.
      // Index alignment paired unrelated gallery navigation with app controls.
      for(const original of a){
       if(!original.label)continue;
       const candidate=b.find(item=>item.tag===original.tag&&item.label===original.label);
       if(!candidate)continue;
       const ar=original.rect,br=candidate.rect;
       if(Math.abs(ar.x-br.x)>24||Math.abs(ar.y-br.y)>40||Math.abs(ar.width-br.width)>32)
        row.issues.push({kind:'matched_element_position_delta_for_review',group:kind,
         label:original.label,original:ar,integrated:br});
      }
     }
    }
    rows.push(row);
   }
   await ctx.close();
   process.stdout.write('CAPTURE '+v.key+' '+rows.length+'/584\n');
  }
 }finally{await browser.close();}
 const summary={started,finished:new Date().toISOString(),stagingUrl:base,stagingFrontendCommit:commit,
  screenIds:73,variants:variants.map(x=>x.key),pairs:rows.length,
  originals:rows.filter(x=>x.original).length,integrated:rows.filter(x=>x.integrated).length,
  captureFailures:rows.filter(x=>x.errors.length).length,nonComparable:rows.filter(x=>x.state!=='comparable_guest').length,
  flagCount:rows.reduce((a,x)=>a+x.issues.length,0),
  status:'EVIDENCE ONLY — HUMAN REVIEW REQUIRED — NO ISSUES RESOLVED',
  authentication:'GUEST ONLY; NO AUTH TOKENS, MOCK ACCOUNTS, OR TRANSACTIONS'};
 await writeFile(join(root,'report.json'),JSON.stringify({summary,rows},null,2));
 const csv=['screen,title,variant,state,original_path,integrated_path,original_scroll_width,integrated_scroll_width,original_button_count,integrated_button_count,flags'];
 for(const r of rows){
  csv.push([r.screen,r.title,r.variant,r.state,r.original,r.integrated,r.originalMetrics?.document.scrollWidth,
    r.integratedMetrics?.document.scrollWidth,r.originalMetrics?.counts.buttons,r.integratedMetrics?.counts.buttons,r.issues.length]
    .map(s=>'"'+String(s??'').replace(/"/g,'""')+'"').join(','));
 }
 await writeFile(join(root,'metrics.csv'),csv.join('\n')+'\n');
 const report=[
  '# seKKa PR #185: 73-screen independent visual evidence','',
  '**Visual approval status: NOT REVIEWED. No issue resolved.**','',
  '- Staging browser URL: '+base,
  '- Frontend preview commit: '+commit,
  '- Gallery: real /dev/screens page with approved design implementation and illustrative preview content.',
  '- Integrated side: real guest browser pages on pinned Staging, not an authenticated test.',
  '- Viewports: 360x800 and 390x844; AR/EN; Light/Dark (eight variants each).',
  '- Original screenshots: '+summary.originals+'; integrated screenshots: '+summary.integrated+'; capture failures: '+summary.captureFailures+'.',
  '- '+summary.nonComparable+' of '+summary.pairs+' pairs have different or unavailable functional states.',
  '- First-party owner PNG references exist only for a subset of the early design system. The gallery is not a substitute for raw owner reference exports.',
  '- See index.html for side-by-side images, metrics.csv for counts, report.json for every visible bounding box and candidate issue.',
  '- Automated clipping and overlap flags are review candidates, never proof that an issue is resolved.','','## Numbered inventory',''
 ];
 for(let n=1;n<=73;n++){
  const list=rows.filter(x=>x.screen===n);
  report.push(String(n).padStart(2,'0')+'. **'+titles[n-1]+'** — '+list[0].state+
   '; flags: '+list.reduce((a,x)=>a+x.issues.length,0)+
   '; capture errors: '+list.filter(x=>x.errors.length).length+
   '. '+list[0].reason);
 }
 report.push('','**Still unavailable:** matching authenticated Captain, Admin and Passenger states; approval/booking/route test data; owner visual sign-off.');
 await writeFile(join(root,'REPORT.md'),report.join('\n')+'\n');
 const style='<style>body{margin:0;background:#121923;color:#f2f4f7;font:14px system-ui}header{position:sticky;top:0;background:#202e40;padding:16px;z-index:3}a{color:#ffd054}.wrap{max-width:1280px;margin:auto;padding:18px}.screen{border:1px solid #627088;background:#1b2737;padding:16px;margin:16px 0;border-radius:12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}.pair div{min-width:0}.pair img{width:100%;height:auto;display:block;border:1px solid #6c7688;border-radius:7px}summary{font-weight:bold;cursor:pointer;margin:12px 0}.meta{color:#c2cedc}.warn{color:#ffbd9a}code{overflow-wrap:anywhere}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>';
 const sections=[];
 for(let n=1;n<=73;n++){
  const members=rows.filter(r=>r.screen===n);
  const detail=members.map(x=>'<details><summary>'+esc(x.variant)+' · '+esc(x.state)+' · '+x.issues.length+' flags</summary>'+
   '<p class="meta">'+esc(x.reason)+'</p><div class="pair"><div><h4>Original gallery (illustrative preview)</h4>'+
   (x.original?'<img loading="lazy" src="'+esc(x.original)+'">':'<p class="warn">Screenshot unavailable</p>')+
   '<code>'+esc(x.originalUrl)+'</code></div><div><h4>Integrated staging browser (unauthenticated)</h4>'+
   (x.integrated?'<img loading="lazy" src="'+esc(x.integrated)+'">':'<p class="warn">Screenshot unavailable</p>')+
   '<code>'+esc(x.integratedUrl)+'</code></div></div><p class="meta">Flags: '+
   esc(x.issues.map(i=>i.kind).join(', ')||'none')+'</p></details>').join('');
  sections.push('<article class="screen" id="s'+n+'"><h2>'+String(n).padStart(2,'0')+
   ' — '+esc(titles[n-1])+'</h2><p class="warn">State: '+esc(members[0].state)+
   ' · Visual review not approved</p>'+detail+'</article>');
 }
 const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>seKKa 73-screen PR185 comparison</title>'+style+
 '<header><b>seKKa | PR #185 | visual evidence</b> · <a href="REPORT.md">Numbered report</a> · <a href="report.json">Bounding boxes JSON</a> · <a href="metrics.csv">Metrics CSV</a></header>'+
 '<div class="wrap"><h1>73 original-vs-integrated screen comparisons</h1>'+
 '<p class="warn"><b>NOT ACCEPTED:</b> screenshots are actual browser output, but no authenticated session is present. Auth gates, preview demo data and unavailable features cannot be judged as matching visual states.</p>'+
 '<p>Staging '+esc(base)+' | frontend commit '+esc(commit)+' | '+summary.originals+' gallery and '+summary.integrated+' integrated screenshots</p>'+
 '<nav>'+titles.map((x,i)=>'<a href="#s'+(i+1)+'">'+String(i+1).padStart(2,'0')+'</a>').join(' · ')+'</nav>'+
 sections.join('\n')+'</div></html>';
 await writeFile(join(root,'index.html'),html);
 process.stdout.write('AUDIT_SUMMARY '+JSON.stringify(summary)+'\n');
 if(rows.length!==584||summary.captureFailures)throw Error('INCOMPLETE_COLLECTION — evidence still saved');
}
main().catch(e=>{console.error('AUDIT_FAILED:',e);process.exitCode=1;});
