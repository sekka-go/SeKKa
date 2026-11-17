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
type Fixture={isAdmin:boolean;adminUnavailable?:boolean;delayUserMs?:number};
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
   result=user;
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
test('MOCKED narrow Admin header preserves both preference toggles and 44px hit targets',async({page})=>{
 await page.setViewportSize({width:320,height:700});
 await setup(page,{isAdmin:true},'en','dark');
 await page.goto('/?tab=admin&view=62');
 await expect(page.locator('.sekka-admin-entry')).toBeVisible();
 await expect(page.locator('.sekka-mobile-header .sekka-language')).toBeVisible();
 const theme=page.getByRole('button',{name:'Switch appearance'});
 const language=page.getByRole('button',{name:'Switch to Arabic'});
 for(const element of [theme,language]){
  const box=await element.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
 await language.click();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await theme.click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('.sekka-admin-entry')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

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
