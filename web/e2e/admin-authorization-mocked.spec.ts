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
type Fixture={isAdmin:boolean;adminUnavailable?:boolean;userUnavailable?:boolean;userResponseGate?:Promise<void>};
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
   sessionStorage.setItem('sekka.launch.seen.v1','1');
 },{endpoint,user,language,theme});
 await page.route(endpoint+'/**',async route=>{
  const url=new URL(route.request().url());
  const path=url.pathname;
  let result:unknown=[];
  let status=200;
  if(path==='/auth/v1/user'){
   if(fixture.userResponseGate)await fixture.userResponseGate;
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
async function pickSearchArea(page:Page,field:'Starting point'|'Destination',name:string){
 await page.getByRole('combobox',{name:field}).fill(name);
 await page.getByRole('group',{name:'Place search suggestions'})
  .getByRole('option',{name:name+' Search the whole service area',exact:true}).click();
}
for(const width of [360,390]){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   test(`mocked verified Admin gets original dashboard ${width}px ${language} ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:844});
    await setup(page,{isAdmin:true},language,theme);
    await page.goto('/');
    await expect(page.locator('.admin-stage')).toBeVisible();
    await expect(page).toHaveURL(/tab=admin/);
    await expect(page.locator('.admin-stage')).toBeVisible();
    await expect(page.locator('.ad-sidebar')).toBeVisible();
    await expect(page.locator('.ad-layout')).toBeVisible();
    await expect(page.locator('.phase-review-bar,.phase-preview-note')).toHaveCount(0);
    await expect(page.getByText(/معاينة المرحلة الثامنة|Stage eight preview/)).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/mock-admin-${width}-${language}-${theme}.png`,fullPage:true});
    await page.reload();
    await expect(page.locator('.admin-stage')).toBeVisible();
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
 await expect(page.locator('.admin-stage')).toBeVisible();
 await expect(page.locator('.sekka-mobile-header .sekka-approved-logo')).toHaveCount(0);
 const trigger=page.getByRole('button',{name:'Open menu'});
 await expect(trigger).toBeVisible();
 await trigger.click();
 const drawer=page.getByRole('dialog',{name:'Main menu'});
 await drawer.getByRole('button',{name:'Expand menu'}).click();
 const theme=drawer.getByRole('switch',{name:'Toggle dark mode'});
 const language=drawer.locator('#sekka-language-pref');
 for(const element of [theme,language]){
  await expect(element).toBeVisible();
  const box=await element.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
 }
 await expect(drawer.getByRole('button',{name:'Admin dashboard'})).toBeVisible();
 await language.selectOption('ar');
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 const closeChanged=page.getByRole('button',{name:'إغلاق القائمة'});
 if(await closeChanged.count())await closeChanged.last().click();
 await page.getByRole('button',{name:'فتح القائمة'}).click();
 const currentDrawer=page.getByRole('dialog',{name:'القائمة الرئيسية'});
 await currentDrawer.getByRole('button',{name:'توسيع القائمة'}).click();
 await currentDrawer.getByRole('switch',{name:'تشغيل أو إيقاف الوضع الليلي'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 const closeThemed=page.getByRole('button',{name:'إغلاق القائمة'});
 if(await closeThemed.count())await closeThemed.last().click();
 await expect(page.locator('.admin-stage')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

for(const language of ['ar','en'] as const){
 test('MOCKED Admin menu stays physical left and shows protected route at 320px '+language,async({page})=>{
  await page.setViewportSize({width:320,height:700});
  await setup(page,{isAdmin:true},language,'dark');
  await page.goto('/?tab=admin&view=62');
  const trigger=page.getByRole('button',{name:language==='ar'?'فتح القائمة':'Open menu'});
  const menu=await trigger.boundingBox();
  expect(menu).not.toBeNull();
  // Arabic uses the RTL edge; English uses the LTR edge.
  if(language==='ar')expect(menu!.x+menu!.width/2).toBeGreaterThan(160);
  else expect(menu!.x+menu!.width/2).toBeLessThan(160);
  await trigger.click();
  const drawer=page.getByRole('dialog',{name:language==='ar'?'القائمة الرئيسية':'Main menu'});
  await drawer.getByRole('button',{name:language==='ar'?'توسيع القائمة':'Expand menu'}).click();
  await expect(drawer.getByRole('button',{name:language==='ar'?'لوحة الإدارة':'Admin dashboard'})).toBeVisible();
  await expect(drawer.locator('#sekka-language-pref')).toBeVisible();
  await expect(drawer.getByRole('switch',{name:language==='ar'?'تشغيل أو إيقاف الوضع الليلي':'Toggle dark mode'})).toBeVisible();
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
 await expect(page.locator('.admin-stage')).toBeVisible();
 await expect(page).toHaveURL(/tab=admin/);
});

// Phase 02 routing regression fixtures: this never simulates a real Google
// OAuth callback or asserts server-side permissions. Real Staging E2E is pending.
test('MOCKED verified Admin returning to S006 after Google goes to Admin dashboard',async({page})=>{
 await setup(page,{isAdmin:true},'en','light');
 await page.goto('/?tab=login&view=6&oauth_role=rider');
 await expect(page).toHaveURL(/tab=admin&view=62/);
 await expect(page.locator('.admin-stage')).toBeVisible();
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
 let releaseUser!:()=>void;
 const userResponseGate=new Promise<void>(resolve=>{releaseUser=resolve;});
 await setup(page,{isAdmin:false,userResponseGate},'en','light');
 try{
  await page.goto('/?tab=profile');
  await expect(page.locator('.sekka-launch')).toHaveCount(0);
  await expect(page.locator('.sekka-session-loader[role="status"]')).toBeVisible();
  await expect(page.getByRole('button',{name:'Sign in with Google'})).toHaveCount(0);
 }finally{releaseUser();}
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
    await expect(screen.locator('.phase-wordmark:visible')).toHaveCount(0);
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
 await expect(page.locator('.rb3')).toBeVisible();
 await page.getByRole('button',{name:'Open menu'}).click();
 const drawer=page.getByRole('dialog',{name:'Main menu'});
 await expect(drawer.getByRole('button',{name:'My trip requests'})).toBeVisible();
 await drawer.getByRole('button',{name:'My trip requests'}).click();
 await expect(drawer).toHaveCount(0);
 await expect(page.locator('.live-trip-requests')).toBeVisible();
 await expect(page.locator('.rb3')).toHaveCount(0);
 await expect(page.getByRole('navigation',{name:'Bookings and requests'}).getByRole('button',{name:'My trip requests'})).toHaveAttribute('aria-pressed','true');
 await page.reload();
 await expect(page.locator('.live-trip-requests')).toBeVisible();
 await page.getByRole('navigation',{name:'Bookings and requests'}).getByRole('button',{name:'My seat bookings'}).click();
 await expect(page.locator('.rb3')).toBeVisible();
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
 await page.locator('.rs3__saved>summary').click();
 await expect(shortcuts).toBeVisible();
 const from=page.getByRole('combobox',{name:'Starting point'});
 const to=page.getByRole('combobox',{name:'Destination'});
 await pickSearchArea(page,'Starting point','Maadi');
 await pickSearchArea(page,'Destination','New Cairo');
 await shortcuts.getByRole('button',{name:'Save origin as Home'}).click();
 await shortcuts.getByRole('button',{name:'Save destination as Work'}).click();
 await expect(shortcuts.getByRole('button',{name:'Home to Work'})).toBeVisible();
 await expect(shortcuts.getByRole('button',{name:'Work to Home'})).toBeVisible();
 await shortcuts.getByRole('button',{name:'Work to Home'}).click();
 await expect(from).toHaveValue('التجمع');
 await expect(to).toHaveValue('المعادي');
 await page.getByRole('button',{name:'See available rides'}).click();
 await page.goto('/?tab=search&view=9');
 await page.locator('.rs3__saved>summary').click();
 await expect(shortcuts.getByText('Recent searches')).toBeVisible();
 await expect(shortcuts.getByRole('button',{name:'Reuse route New Cairo - Maadi'})).toBeVisible();
 const key='sekka.rider.savedAreas.v1.'+userId;
 const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),key);
 expect(stored.home).toBe('المعادي');
 expect(stored.work).toBe('التجمع');
 expect(stored.recent[0]).toEqual({origin:'التجمع',destination:'المعادي'});
 await page.reload();
 await page.locator('.rs3__saved>summary').click();
 await expect(shortcuts.getByRole('button',{name:'Home to Work'})).toBeVisible();
 await shortcuts.getByRole('button',{name:'Home to Work'}).click();
 await expect(from).toHaveValue('المعادي');
 await expect(to).toHaveValue('التجمع');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('MOCKED published search delegates round-trip filters and sorts projected prices',async({page})=>{
 await page.route('https://photon.komoot.io/api/**',route=>route.fulfill({json:{features:[]}}));
 await page.setViewportSize({width:390,height:844});
 await setup(page,{isAdmin:false},'en','light');
 const areaRows=[
  {id:1,name_ar:'المعادي',name_en:'Maadi'},
  {id:2,name_ar:'التجمع',name_en:'New Cairo'}
 ];
 const routes=[
  {id:'route-a',title:'Round A',category:'SAVER',seat_capacity:4,period:'monthly',direction:'round_trip',outbound_time:'07:30:00',return_time:'17:00:00',seat_price_egp:1200,return_supported:true},
  {id:'route-b',title:'Outbound only',category:'SAVER',seat_capacity:4,period:'monthly',direction:'outbound',outbound_time:'07:30:00',return_time:null,seat_price_egp:700,return_supported:false},
  {id:'route-c',title:'Round C',category:'SPACE',seat_capacity:9,period:'monthly',direction:'round_trip',outbound_time:'07:30:00',return_time:'17:00:00',seat_price_egp:900,return_supported:true},
  {id:'route-d',title:'Wrong return time',category:'SAVER',seat_capacity:4,period:'monthly',direction:'round_trip',outbound_time:'07:30:00',return_time:'18:00:00',seat_price_egp:500,return_supported:true}
 ];
 const stops=routes.flatMap(route=>[
  {id:route.id+'-1',route_id:route.id,area_id:1,position:1,name:'Maadi',pickup_allowed:true,dropoff_allowed:true},
  {id:route.id+'-2',route_id:route.id,area_id:2,position:2,name:'New Cairo',pickup_allowed:true,dropoff_allowed:true}
 ]);
 const searchInputs:Array<{p_direction:string;p_outbound:string;p_return:string}>=[];
 await page.route(endpoint+'/rest/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  let result:unknown;
  if(path.endsWith('/v31_service_areas'))result=areaRows;
  else if(path.endsWith('/rpc/v31_search_published_routes')){
   const input=route.request().postDataJSON();
   searchInputs.push(input);
   const matches=input.p_direction==='round_trip'?[routes[0],routes[2]]:routes;
   result=matches.map(offer=>{
    const ordered=stops.filter(stop=>stop.route_id===offer.id);
    return {route_id:offer.id,selection:{
     route:offer,from:ordered[0],to:ordered[1],reverse:false,stops:ordered,remaining:offer.id==='route-c'?0:3,
     pickupDistanceKm:null,dropoffDistanceKm:null
    }};
   });
  }
  else if(path.endsWith('/v31_route_stops'))result=stops;
  else if(path.endsWith('/rpc/v31_published_route_available_seats'))result=3;
  else{return route.fallback();}
  await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/?tab=search&view=9');
 await pickSearchArea(page,'Starting point','Maadi');
 await pickSearchArea(page,'Destination','New Cairo');
 await page.locator('.rs3 input[type=time]').first().fill('07:30');
 await page.getByRole('button',{name:'See available rides'}).click();
 const list=page.locator('.d-live-search article.d-result');
 await expect(list).toHaveCount(4);
 await page.getByRole('combobox',{name:'Sort routes by'}).selectOption('price');
 await expect(list.first().getByRole('heading',{name:'Wrong return time'})).toBeVisible();
 await page.getByRole('button',{name:'Edit search'}).click();
 await page.locator('.rs3__return-toggle').click();
 await page.locator('.rs3 input[type=time]').last().fill('17:00');
 await page.getByRole('button',{name:'See available rides'}).click();
 await expect(list).toHaveCount(2);
 await page.getByRole('button',{name:'Edit filters'}).click();
 await page.locator('.rf3').getByRole('button',{name:'Round trip',exact:true}).click();
 await page.getByRole('button',{name:'Show rides'}).click();
 await expect(list).toHaveCount(2);
 await expect(page.getByText('Round A',{exact:true})).toBeVisible();
 await expect(page.getByText('Round C',{exact:true})).toBeVisible();
 await expect(page.getByText('Outbound only',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Wrong return time',{exact:true})).toHaveCount(0);
 const cards=await list.allTextContents();
 expect(cards.every(card=>card.includes('07:30'))).toBe(true);
 expect(cards.every(card=>card.includes('Round trip supported'))).toBe(true);
 expect(cards.every(card=>card.includes('Indicative seat price'))).toBe(true);
 expect(searchInputs).toContainEqual(expect.objectContaining({
  p_direction:'round_trip',p_outbound:'07:30',p_return:'17:00'
 }));
 await page.getByRole('button',{name:'Edit filters'}).click();
 await page.getByLabel('Max seat price (EGP)').fill('800');
 await page.getByRole('button',{name:'Show rides'}).click();
 await expect(list).toHaveCount(0);
 await expect(page.getByText('Routes serve your selected places.',{exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:/Request a trip using this search|Sign in to request this trip/})).toHaveCount(0);
 await page.getByRole('button',{name:'Edit filters'}).click();
 await page.getByLabel('Max seat price (EGP)').fill('950');
 await page.getByRole('button',{name:'Show rides'}).click();
 await expect(list).toHaveCount(1);
 await expect(list.getByRole('heading',{name:'Round C'})).toBeVisible();
 await expect(list.getByText('Sold out')).toBeVisible();
 await page.getByRole('button',{name:'Edit filters'}).click();
 await page.getByRole('checkbox',{name:/Only rides with seats/}).check();
 await page.getByRole('button',{name:'Show rides'}).click();
 await expect(list).toHaveCount(0);
 await expect(page.getByText('Routes serve your selected places.',{exact:false})).toBeVisible();
});

test('MOCKED genuine round-trip offer reaches transparent one-or-two person booking review',async({page})=>{
 await page.route('https://photon.komoot.io/api/**',route=>route.fulfill({json:{features:[]}}));
 await page.setViewportSize({width:390,height:844});
 await setup(page,{isAdmin:false},'en','light');
 const routeId='11111111-1111-4111-8111-111111111111';
 const fromStop='22222222-2222-4222-8222-222222222221';
 const toStop='22222222-2222-4222-8222-222222222222';
 const published={
  id:routeId,title:'Verified Round Trip',category:'SAVER',seat_capacity:4,
  period:'monthly',direction:'round_trip',outbound_time:'07:30:00',
  return_time:'17:00:00',seat_price_egp:1200,return_supported:true
 };
 const stops=[
  {id:fromStop,route_id:routeId,area_id:1,position:1,name:'Maadi pickup',pickup_allowed:true,dropoff_allowed:true},
  {id:toStop,route_id:routeId,area_id:2,position:2,name:'New Cairo pickup',pickup_allowed:true,dropoff_allowed:true}
 ];
 let reserveRequests=0;
 await page.route(endpoint+'/rest/v1/**',async request=>{
  const url=new URL(request.request().url());
  const path=url.pathname;
  let result:unknown;
  if(path.endsWith('/v31_service_areas'))result=[
   {id:1,name_ar:'المعادي',name_en:'Maadi'},
   {id:2,name_ar:'التجمع',name_en:'New Cairo'}
  ];
  else if(path.endsWith('/rpc/v31_search_published_routes'))result=[{
   route_id:routeId,selection:{
    route:published,from:stops[0],to:stops[1],reverse:false,stops,remaining:3,
    pickupDistanceKm:null,dropoffDistanceKm:null
   }
  }];
  else if(path.endsWith('/v31_public_route_offers')){
   const matched=url.searchParams.has('id');
   result=matched?[published]:[published];
   if(matched&&request.request().headers()['accept']?.includes('vnd.pgrst.object+json'))
    result=published;
  }
  else if(path.endsWith('/v31_route_stops'))result=stops;
  else if(path.endsWith('/rpc/v31_published_route_available_seats'))result=3;
  else if(path.endsWith('/rpc/v31_reserve_seats_with_stops')){reserveRequests++;result='33333333-3333-4333-8333-333333333333';}
  else return request.fallback();
  await request.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/?tab=search&view=9');
 await pickSearchArea(page,'Starting point','Maadi');
 await pickSearchArea(page,'Destination','New Cairo');
 await page.getByRole('button',{name:'See available rides'}).click();
 await expect(page.getByRole('heading',{name:'Verified Round Trip'})).toBeVisible();
 await page.getByRole('button',{name:'View ride details'}).click();
 await expect(page.getByText('Verified Round Trip',{exact:true})).toHaveCount(0);
 await expect(page.locator('.d-screen-12')).toBeVisible();
 const pickup=page.getByRole('combobox',{name:'Pickup point'});
 await expect(pickup).toHaveValue(fromStop);
 await expect(page.getByRole('combobox',{name:'Drop-off point'})).toHaveValue(toStop);
 await expect(page.getByText('Seats available now',{exact:true})).toBeVisible();
 await expect(pickup.locator('option[value="'+toStop+'"]')).toHaveCount(0);
 await page.getByRole('button',{name:'Continue to booking'}).click();
 await expect(page).toHaveURL(/tab=booking/);
 await expect(page.locator('.booking-stage')).toBeVisible();
 await expect(page.getByText('Round trip',{exact:false}).first()).toBeVisible();
 const controls=page.getByRole('group',{name:'Number of people'});
 await expect(controls).toContainText('1');
 await controls.getByRole('button',{name:'Add one person'}).click();
 await expect(controls).toContainText('2');
 await expect(controls.getByRole('button',{name:'Add one person'})).toBeDisabled();
 await controls.getByRole('button',{name:'Remove one person'}).click();
 await expect(controls).toContainText('1');
 await expect(page.getByText(/No payment or deposit is collected in the app at present/i)).toBeVisible();
 await expect(page.getByText(/indicative per seat, not a final invoice/i)).toBeVisible();
 expect(reserveRequests).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('MOCKED approved Admin can see Google sign-in email for selected Captain only',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await setup(page,{isAdmin:true},'en','light');
 const captainIds=['00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000b2'];
 const applications=captainIds.map((id,index)=>({
  user_id:id,status:'submitted',full_name:index?'Second Captain':'First Captain',
  phone_number:null,professional_notes:'Test only',experience_years:1,
  vehicle_type:'private_car',vehicle_make_id:null,vehicle_model_id:null,
  manufacture_year:null,vehicle_color_code:null,vehicle_color_other:null,
  intended_plate:null,approved_vehicle_id:null,rejection_reason:null,submitted_at:null
 }));
 const requestedIds:string[]=[];
 await page.route(endpoint+'/rest/v1/v31_captain_applications*',async route=>{
  await route.fulfill({contentType:'application/json',body:JSON.stringify(applications)});
 });
 await page.route(endpoint+'/rest/v1/rpc/v31_admin_captain_login_email',async route=>{
  const id=(route.request().postDataJSON() as {p_captain:string}).p_captain;
  requestedIds.push(id);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(
   id===captainIds[0]?'first.captain@example.test':'second.captain@example.test'
  )});
 });
 await page.goto('/?tab=admin&view=64');
 const review=page.locator('.ad-integrated-review');
 await review.getByRole('button',{name:/First Captain/}).click();
 await expect(review.getByTestId('captain-admin-login-email')).toContainText('first.captain@example.test');
 await review.getByRole('button',{name:/Second Captain/}).click();
 await expect(review.getByTestId('captain-admin-login-email')).toContainText('second.captain@example.test');
 await expect(review.getByTestId('captain-admin-login-email')).not.toContainText('first.captain@example.test');
 expect(requestedIds).toEqual(captainIds);
 await expect(review.getByText('Google sign-in email:')).toBeVisible();
});

test('MOCKED non-Admin never requests Captain Auth email even on Admin deep link',async({page})=>{
 await setup(page,{isAdmin:false},'en','light');
 let privateEmailReads=0;
 await page.route(endpoint+'/rest/v1/rpc/v31_admin_captain_login_email',async route=>{
  privateEmailReads++;
  await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'ADMIN_REQUIRED'})});
 });
 await page.goto('/?tab=admin&view=64');
 await expect(page.getByRole('heading',{name:'Access restricted'})).toBeVisible();
 await expect(page.locator('.ad-integrated-review')).toHaveCount(0);
 expect(privateEmailReads).toBe(0);
});
