import {test,expect,type Page} from '@playwright/test';

// MOCKED browser-only frontend routing regression. NEVER staging Auth or DB evidence.
// All accounts are synthetic, and the server-side role decision is mocked explicitly.
const endpoint='https://sekka-auth-e2e.supabase.co';
const userId='00000000-0000-4000-8000-0000000000a1';
const user={
 id:userId,aud:'authenticated',role:'authenticated',email:'fixture@example.test',
 email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},
 // Prove a user-editable role claim does not grant Admin privileges.
 user_metadata:{role:'admin',full_name:'QA Fixture'}
};
type Fixture={isAdmin:boolean;adminUnavailable?:boolean;userUnavailable?:boolean;delayUserMs?:number};
async function setup(page:Page,fixture:Fixture,language:'ar'|'en',theme:'light'|'dark'){
 await page.addInitScript(({endpoint,user,language,theme})=>{
  const storage='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
  localStorage.setItem(storage,JSON.stringify({
   access_token:'fixture-header.fixture-payload.fixture-signature',
   refresh_token:'local-fixture-refresh',token_type:'bearer',
   expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
  }));
  localStorage.setItem('language_preference',language);
  localStorage.setItem('theme_preference',theme);
 },{endpoint,user,language,theme});
 await page.route(endpoint+'/**',async route=>{
  const url=new URL(route.request().url());
  const path=url.pathname;
  let result:unknown=[];
  let status=200;
  if(path==='/auth/v1/user'){
   if(fixture.delayUserMs)await new Promise(resolve=>setTimeout(resolve,fixture.delayUserMs));
   if(fixture.userUnavailable){status=503;result={code:'TEST_UNAVAILABLE',message:'Fixture identity endpoint offline'};}
   else result=user;
  }
  else if(path==='/rest/v1/rpc/v31_is_admin'){
   if(fixture.adminUnavailable){status=503;result={code:'TEST_UNAVAILABLE',message:'Fixture RPC offline'};}
   else result=fixture.isAdmin;
  }else if(path==='/rest/v1/rpc/v31_admin_overview')result={
    passengers:0,captains_approved:0,vehicles:0,routes_published:0,
    pending_bookings:0,open_requests:0,captain_offers:0,notifications:0
  };
  else if(path.startsWith('/rest/v1/v31_captain_profiles'))result=[];
  else if(path.startsWith('/rest/v1/v31_service_areas'))result=[];
  else if(path.startsWith('/rest/v1/v31_captain_applications'))result=[];
  else if(path.startsWith('/rest/v1/v31_profiles'))result=[];
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
}
for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   test(`mocked verified Admin gets original dashboard ${width}px ${language} ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:844});
    await setup(page,{isAdmin:true},language,theme);
    await page.goto('/');
    const adminButton=page.getByRole('button',{name:language==='ar'?'لوحة الإدارة':'Admin dashboard'});
    await expect(adminButton).toBeVisible();
    await expect(page).toHaveURL(/tab=admin/);
    await expect(page.locator('.admin-stage')).toBeVisible();
    await expect(page.locator('.ad-sidebar')).toBeVisible();
    await expect(page.locator('.ad-layout')).toBeVisible();
    await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
    await expect(page.getByText(/معاينة المرحلة الثامنة|Stage eight preview/)).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/mock-admin-${width}-${language}-${theme}.png`,fullPage:true});
    await page.reload();
    await expect(adminButton).toBeVisible();
    await expect(page).toHaveURL(/tab=admin/);
    await expect(page.locator('.admin-stage')).toBeVisible();
    await page.getByRole('button',{name:language==='ar'?'طلبات الكباتن':'Captain applications'}).click();
    await expect(page).toHaveURL(/view=64/);
    await expect(page.getByRole('heading',{name:language==='ar'?'طلبات اعتماد الكباتن':'Captain applications'})).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/view=64/);
    await expect(page.getByRole('heading',{name:language==='ar'?'طلبات اعتماد الكباتن':'Captain applications'})).toBeVisible();
    await page.locator('.ad-integrated-review').getByRole('button',{name:language==='ar'?'مراجعة المستندات':'Document review'}).click();
    await expect(page).toHaveURL(/view=65/);
    await expect(page.getByRole('heading',{name:language==='ar'?'مراجعة مستندات الكباتن':'Captain documents'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   });
  }
 }
}
test('MOCKED narrow Admin keeps authorized action and preferences in left drawer',async({page})=>{
 await page.setViewportSize({width:320,height:700});
 await setup(page,{isAdmin:true},'en','dark');
 await page.goto('/?tab=admin&view=62');
 await expect(page.locator('.sekka-admin-entry')).toBeVisible();
 await expect(page.locator('.sekka-mobile-header .sekka-approved-logo')).toHaveCount(0);
 const trigger=page.getByRole('button',{name:'Open menu'});
 await expect(trigger).toBeVisible();
 await trigger.click();
 const drawer=page.getByRole('dialog',{name:'Main menu'});
 const theme=drawer.locator('.sekka-theme');
 const language=drawer.getByRole('button',{name:'Switch to Arabic'});
 for(const element of [theme,language]){
  const box=await element.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
 }
 await language.click();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await theme.click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('button',{name:'إغلاق القائمة'}).last().click();
 await expect(page.locator('.sekka-admin-entry')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

for(const language of ['ar','en'] as const){
 test('MOCKED Admin header menu stays physical left with separate Admin entry at 320px '+language,async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await setup(page,{isAdmin:true},language,'dark');
  await page.goto('/?tab=admin&view=62');
  const trigger=page.getByRole('button',{name:language==='ar'?'فتح القائمة':'Open menu'});
  const menu=await trigger.boundingBox();
  const entry=await page.locator('.sekka-mobile-header .sekka-admin-entry').boundingBox();
  expect(menu&&entry).toBeTruthy();
  expect(menu!.x+menu!.width/2).toBeLessThan(160);
  expect(entry!.y).toBeGreaterThanOrEqual(menu!.y+menu!.height);
  await trigger.click();
  const drawer=page.getByRole('dialog',{name:language==='ar'?'القائمة الرئيسية':'Main menu'});
  await expect(drawer.locator('.sekka-language')).toBeVisible();
  await expect(drawer.locator('.sekka-theme')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
 });
}

test('mocked passenger cannot gain Admin via editable metadata or direct URL',async({page})=>{
 await setup(page,{isAdmin:false},'en','light');
 await page.goto('/?tab=admin&view=64');
 await expect(page.getByRole('heading',{name:'Access restricted'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Admin dashboard'})).toHaveCount(0);
 await expect(page.locator('.admin-stage')).toHaveCount(0);
 await page.reload();
 await expect(page.getByRole('heading',{name:'Access restricted'})).toBeVisible();
});
test('mocked failed Admin RPC shows retry, never silently treats permission as false',async({page})=>{
 const fixture={isAdmin:true,adminUnavailable:true};
 await setup(page,fixture,'en','light');
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Retry authorization'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Admin dashboard'})).toHaveCount(0);
 fixture.adminUnavailable=false;
 await page.getByRole('button',{name:'Retry authorization'}).click();
 await expect(page.getByRole('button',{name:'Admin dashboard'})).toBeVisible();
 await expect(page).toHaveURL(/tab=admin/);
});

// Phase 02 routing regression fixtures: this never simulates a real Google
// OAuth callback or asserts server-side permissions. Real Staging E2E is pending.
test('MOCKED verified Admin returning to S006 after Google goes to Admin dashboard',async({page})=>{
 await setup(page,{isAdmin:true},'en','light');
 await page.goto('/?tab=login&view=6&oauth_role=rider');
 await expect(page).toHaveURL(/tab=admin&view=62/);
 await expect(page.locator('.admin-stage')).toBeVisible();
 await expect(page.getByRole('button',{name:'Admin dashboard'})).toBeVisible();
 await page.reload();
 await expect(page).toHaveURL(/tab=admin&view=62/);
 await expect(page.locator('.admin-stage')).toBeVisible();
});

test('MOCKED non-Admin Google completion cannot access Admin dashboard',async({page})=>{
 await setup(page,{isAdmin:false},'en','light');
 await page.goto('/?tab=login&view=6&oauth_role=rider');
 await expect(page.locator('.phase-screen-6')).toBeVisible();
 await expect(page.getByRole('button',{name:'Admin dashboard'})).toHaveCount(0);
});

test('MOCKED verified Admin explicit destination is never replaced by Admin home',async({page})=>{
 await setup(page,{isAdmin:true},'en','light');
 await page.goto('/?tab=bookings');
 await expect(page).toHaveURL(/tab=bookings/);
 await expect(page.locator('.admin-stage')).toHaveCount(0);
 await page.goto('/?tab=admin&view=65');
 await expect(page).toHaveURL(/tab=admin&view=65/);
 await expect(page.locator('.admin-stage')).toBeVisible();
});

test('MOCKED profile gate waits for verified session without showing guest Google CTA',async({page})=>{
 await setup(page,{isAdmin:false,delayUserMs:750},'en','light');
 await page.goto('/?tab=profile');
 await expect(page.getByText('Loading account…')).toBeVisible();
 await expect(page.getByRole('button',{name:'Sign in with Google'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
});

test('MOCKED failed identity verification blocks profile and offers retry',async({page})=>{
 const fixture={isAdmin:false,userUnavailable:true};
 await setup(page,fixture,'en','light');
 await page.goto('/?tab=profile');
 await expect(page.getByRole('button',{name:'Retry session'})).toBeVisible();
 await expect(page.locator('.live-profile')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Sign out'})).toHaveCount(0);
 fixture.userUnavailable=false;
 await page.getByRole('button',{name:'Retry session'}).click();
 await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
 await expect(page.locator('.live-profile')).toBeVisible();
});

// Mocked, not real Supabase: regression for the rider's observed no-match
// flow where a blank subscription period prevented the request from saving.
test('MOCKED rider no-match flow saves selected weekly request and reads it back',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await setup(page,{isAdmin:false},'en','light');
 await page.addInitScript(()=>{
  sessionStorage.setItem('sekka.rider.discoveryDraft.v31',JSON.stringify({
   origin:'التجمع',destination:'الزمالك',outbound:'07:30',returnTime:'17:00',
   period:'monthly',searched:true
  }));
 });
 const areas=[
  {id:21,name_ar:'التجمع',name_en:'New Cairo'},
  {id:22,name_ar:'الزمالك',name_en:'Zamalek'}
 ];
 let saved:null|{id:string;rider_id:string;origin_area_id:number;destination_area_id:number;outbound_time:string|null;return_time:string|null;direction:string;period:string;seats:number;request_key:string;status:string}=null;
 let inserts=0;
 await page.route(endpoint+'/rest/v1/v31_service_areas*',async route=>{
  await route.fulfill({contentType:'application/json',body:JSON.stringify(areas)});
 });
 await page.route(endpoint+'/rest/v1/v31_routes*',async route=>{
  await route.fulfill({contentType:'application/json',body:'[]'});
 });
 await page.route(endpoint+'/rest/v1/v31_trip_requests*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()==='POST'){
   inserts++;
   const v=req.postDataJSON() as NonNullable<typeof saved>;
   saved={...v,id:'33333333-3333-4333-8333-333333333333',status:'open'};
   await route.fulfill({status:201,contentType:'application/json',body:'[]'});
   return;
  }
  const matched=saved&&!url.searchParams.has('request_key')?[saved]:
   saved&&url.searchParams.get('request_key')?.includes(saved.request_key)?[saved]:[];
  const singular=req.headers()['accept']?.includes('vnd.pgrst.object');
  await route.fulfill({contentType:'application/json',body:JSON.stringify(singular?matched[0]||null:matched)});
 });
 await page.goto('/?tab=search&view=11');
 const panel=page.locator('.live-trip-requests');
 await expect(panel.getByRole('heading',{name:'No match? Review your request'})).toBeVisible();
 await expect(panel.getByLabel('Journey direction')).toHaveValue('round_trip');
 await expect(panel.getByLabel('Departure time')).toHaveValue('07:30');
 await expect(panel.getByLabel('Return time')).toHaveValue('17:00');
 await panel.getByLabel('Subscription period').selectOption('weekly');
 const count=panel.getByLabel('Seats needed');
 await expect(count).toHaveAttribute('max','2');
 await count.fill('3');
 await expect(panel.getByRole('button',{name:'Confirm and save trip request'})).toBeDisabled();
 expect(inserts).toBe(0);
 await count.fill('2');
 await expect(panel.getByRole('button',{name:'Confirm and save trip request'})).toBeEnabled();
 await panel.getByRole('button',{name:'Confirm and save trip request'}).click();
 await expect(panel.getByRole('status').filter({hasText:'Your request and journey schedule are saved'})).toBeVisible();
 expect(inserts).toBe(1);
 expect(saved).not.toBeNull();
 expect(saved?.period).toBe('weekly');
 expect(saved?.seats).toBe(2);
 expect(saved?.outbound_time).toBe('07:30');
 expect(saved?.return_time).toBe('17:00');
 expect(saved?.direction).toBe('round_trip');
 await panel.getByRole('button',{name:'Confirm and save trip request'}).click();
 await expect(panel.getByRole('status').filter({hasText:'already open'})).toBeVisible();
 expect(inserts).toBe(1);
 await expect(panel.locator('ul li').first()).toContainText('Weekly');
});

// Simulated PostgREST persistence, not a Staging user-session test.
// Verify both the successful read-after-write contract and the failure path.
for(const verifyReadback of [true,false]){
 test(`MOCKED profile save ${verifyReadback?'verifies persisted values':'rejects unverified writes'}`,async({page})=>{
  await setup(page,{isAdmin:false},'en','light');
  let stored:{display_name:string;phone_number:string|null}|null=null;
  let writes=0;
  await page.route('**/rest/v1/v31_profiles*',async route=>{
   const req=route.request();
   if(req.method()==='POST'){
    writes++;
    const body=req.postDataJSON() as {display_name:string;phone_number:string|null};
    if(verifyReadback)stored={display_name:body.display_name,phone_number:body.phone_number};
    await route.fulfill({status:201,body:''});
    return;
   }
   const single=(req.headers()['accept']||'').includes('vnd.pgrst.object');
   await route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(single?stored:stored?[stored]:[])});
  });
  await page.goto('/?tab=profile');
  const profile=page.locator('.live-profile');
  await expect(profile.getByRole('button',{name:'Save profile'})).toBeVisible();
  await profile.getByRole('textbox',{name:'Name'}).fill('Verified Test Passenger');
  await profile.getByRole('textbox',{name:/Phone/}).fill('01012345678');
  await profile.getByRole('button',{name:'Save profile'}).click();
  if(verifyReadback){
   await expect(profile.getByRole('status')).toContainText('Profile saved');
   await page.reload();
   await expect(page.locator('.live-profile').getByRole('textbox',{name:'Name'})).toHaveValue('Verified Test Passenger');
   await expect(page.locator('.live-profile').getByRole('textbox',{name:/Phone/})).toHaveValue('01012345678');
  }else{
   await expect(profile.getByRole('alert')).toContainText('Could not verify the profile save');
   await expect(profile.getByText('Profile saved')).toHaveCount(0);
  }
  expect(writes).toBe(1);
 });
}

/*
 * S006 authenticated profile requires a signed-in identity. Exercise its
 * layout with the isolated browser fixture, never as staging-auth evidence.
 * Preserve the approved full-width screen and the current Google-only flow.
 */
for(const [width,height] of [[320,700],[360,800],[390,844],[412,915]] as const){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   test(`S006 profile actions are not superimposed ${width}x${height} ${language} ${theme} (MOCKED)`,async({page})=>{
    await page.setViewportSize({width,height});
    await setup(page,{isAdmin:false},language,theme);
    await page.goto('/?tab=login');
    const screen=page.locator('.phase-screen-6');
    const form=screen.locator('.live-profile');
    const continueButton=screen.locator('.phase-live-profile-flow > .phase-primary');
    await expect(screen).toBeVisible();
    await expect(form).toBeVisible();
    await expect(form.getByRole('button',{name:language==='ar'?'حفظ بياناتي':'Save profile'})).toBeVisible();
    await expect(continueButton).toBeVisible();
    const actions=screen.locator('.phase-live-profile-flow button:visible');
    const rectangles=await actions.evaluateAll(nodes=>nodes.map(n=>{
     const r=n.getBoundingClientRect();
     return {x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
    }));
    for(const r of rectangles){
     expect(r.width,'Buttons must not exceed the mobile viewport').toBeLessThanOrEqual(width);
     expect(r.height,'Tap target needs at least 44px height').toBeGreaterThanOrEqual(44);
     expect(r.x,'Button must not be clipped on the left').toBeGreaterThanOrEqual(-1);
     expect(r.right,'Button must not be clipped on the right').toBeLessThanOrEqual(width+1);
    }
    for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){
     const a=rectangles[i],b=rectangles[j];
     const dx=Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x));
     const dy=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));
     expect(dx*dy,'Distinct S006 buttons cannot overlap').toBe(0);
    }
    const logo=await screen.locator('.phase-logo > .phase-wordmark').boundingBox();
    expect(logo).not.toBeNull();
    expect(logo!.width).toBeLessThanOrEqual(width*.3+1);
    expect(logo!.height).toBeLessThanOrEqual(logo!.width*.56);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    await continueButton.scrollIntoViewIfNeeded();
    const last=await continueButton.boundingBox();
    expect(last!.y+last!.height,'Continue action must be reachable with vertical scrolling')
     .toBeLessThanOrEqual(height+1);
    await page.screenshot({
     path:`../docs/audit/layout-after-S006-${width}x${height}-${language}-${theme}-mocked.png`,
     fullPage:true,animations:'disabled'
    });
   });
  }
 }
}

test('MOCKED rider menu separates trip requests from saved seat bookings and survives refresh',async({page})=>{
 await setup(page,{isAdmin:false},'en','light');
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?tab=bookings');
 await expect(page.locator('.live-bookings')).toBeVisible();
 await page.getByRole('button',{name:'Open menu'}).click();
 const drawer=page.getByRole('dialog',{name:'Main menu'});
 await expect(drawer.getByRole('button',{name:'My trip requests'})).toBeVisible();
 await drawer.getByRole('button',{name:'My trip requests'}).click();
 await expect(drawer).toHaveCount(0);
 await expect(page.locator('.live-trip-requests')).toBeVisible();
 await expect(page.locator('.live-bookings')).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Bookings and requests'}).getByRole('button',{name:'My trip requests'})).toHaveAttribute('aria-pressed','true');
 await page.reload();
 await expect(page.locator('.live-trip-requests')).toBeVisible();
 await page.getByRole('navigation',{name:'Bookings and requests'}).getByRole('button',{name:'My seat bookings'}).click();
 await expect(page.locator('.live-bookings')).toBeVisible();
 await expect(page.locator('.live-trip-requests')).toHaveCount(0);
});

test('MOCKED signed-in rider saves validated Home/Work shortcuts and recent searches per account',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await setup(page,{isAdmin:false},'en','light');
 // Only genuine service areas from a server response are offered as shortcuts.
 await page.route(endpoint+'/rest/v1/v31_service_areas*',route=>route.fulfill({
  contentType:'application/json',body:JSON.stringify([
   {id:1,name_ar:'المعادي',name_en:'Maadi'},
   {id:2,name_ar:'التجمع',name_en:'New Cairo'},
  ])
 }));
 await page.goto('/?tab=search&view=9');
 const shortcuts=page.locator('.sekka-search-shortcuts');
 await expect(shortcuts).toBeVisible();
 const from=page.locator('.d-planner-places .d-place select').first();
 const to=page.locator('.d-planner-places .d-place select').last();
 await expect(from.locator('option[value="المعادي"]')).toHaveText('Maadi');
 await from.selectOption('المعادي');
 await to.selectOption('التجمع');
 await shortcuts.getByRole('button',{name:'Save origin as Home'}).click();
 await shortcuts.getByRole('button',{name:'Save destination as Work'}).click();
 await expect(shortcuts.getByRole('button',{name:'Home to Work'})).toBeVisible();
 await expect(shortcuts.getByRole('button',{name:'Work to Home'})).toBeVisible();
 await shortcuts.getByRole('button',{name:'Work to Home'}).click();
 await expect(from).toHaveValue('التجمع');
 await expect(to).toHaveValue('المعادي');
 await page.locator('.d-screen-9 .d-planner > .d-primary').click();
 await page.goto('/?tab=search&view=9');
 await expect(shortcuts.getByText('Recent searches')).toBeVisible();
 await expect(shortcuts.getByRole('button',{name:'Reuse route التجمع - المعادي'})).toBeVisible();
 const key='sekka.rider.savedAreas.v1.'+userId;
 const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),key);
 expect(stored.home).toBe('المعادي');
 expect(stored.work).toBe('التجمع');
 expect(stored.recent[0]).toEqual({origin:'التجمع',destination:'المعادي'});
 await page.reload();
 await expect(shortcuts.getByRole('button',{name:'Home to Work'})).toBeVisible();
 await shortcuts.getByRole('button',{name:'Home to Work'}).click();
 await expect(from).toHaveValue('المعادي');
 await expect(to).toHaveValue('التجمع');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('MOCKED published search sorts genuine route data and enforces both round-trip times',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await setup(page,{isAdmin:false},'en','light');
 const areaRows=[
  {id:1,name_ar:'المعادي',name_en:'Maadi'},
  {id:2,name_ar:'التجمع',name_en:'New Cairo'}
 ];
 const routes=[
  {id:'route-a',title:'Round A',category:'SAVER',seat_capacity:4,period:'monthly',direction:'round_trip',outbound_time:'07:30:00',return_time:'17:00:00',price_egp:1200,return_supported:true},
  {id:'route-b',title:'Outbound only',category:'SAVER',seat_capacity:4,period:'monthly',direction:'outbound',outbound_time:'07:30:00',return_time:null,price_egp:700,return_supported:false},
  {id:'route-c',title:'Round C',category:'SPACE',seat_capacity:9,period:'monthly',direction:'round_trip',outbound_time:'07:30:00',return_time:'17:00:00',price_egp:900,return_supported:true},
  {id:'route-d',title:'Wrong return time',category:'SAVER',seat_capacity:4,period:'monthly',direction:'round_trip',outbound_time:'07:30:00',return_time:'18:00:00',price_egp:500,return_supported:true}
 ];
 const stops=routes.flatMap(route=>[
  {id:route.id+'-1',route_id:route.id,area_id:1,position:1,name:'Maadi',pickup_allowed:true,dropoff_allowed:true},
  {id:route.id+'-2',route_id:route.id,area_id:2,position:2,name:'New Cairo',pickup_allowed:true,dropoff_allowed:true}
 ]);
 await page.route(endpoint+'/rest/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let result:unknown;
  if(path.endsWith('/v31_service_areas'))result=areaRows;
  else if(path.endsWith('/v31_routes'))result=routes;
  else if(path.endsWith('/v31_route_stops'))result=stops;
  else if(path.endsWith('/rpc/v31_published_route_available_seats'))result=3;
  else{return route.fallback();}
  await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/?tab=search&view=9');
 const origin=page.locator('.d-planner-places .d-place select').first();
 const dest=page.locator('.d-planner-places .d-place select').last();
 await expect(origin.locator('option[value="المعادي"]')).toBeAttached();
 await origin.selectOption('المعادي');
 await dest.selectOption('التجمع');
 await page.locator('.d-screen-9 .d-planner > .d-primary').click();
 const list=page.locator('.d-live-search article.d-result');
 await expect(list).toHaveCount(4);
 await page.getByRole('combobox',{name:'Sort routes by'}).selectOption('price');
 await expect(list.first().getByRole('heading',{name:'Wrong return time'})).toBeVisible();
 await page.goto('/?tab=search&view=10');
 await page.locator('.d-screen-10 select').selectOption('round_trip');
 await page.getByRole('button',{name:'Show results'}).click();
 await expect(list).toHaveCount(2);
 await expect(page.getByText('Round A',{exact:true})).toBeVisible();
 await expect(page.getByText('Round C',{exact:true})).toBeVisible();
 await expect(page.getByText('Outbound only',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Wrong return time',{exact:true})).toHaveCount(0);
 const cards=await list.allTextContents();
 expect(cards.every(card=>card.includes('17:00'))).toBe(true);
 expect(cards.every(card=>card.includes('Listed price'))).toBe(true);
});
