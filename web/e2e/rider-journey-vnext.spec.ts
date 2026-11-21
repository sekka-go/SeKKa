import {test,expect} from '@playwright/test';
const endpoint='https://sekka-auth-e2e.supabase.co';
const riderId='00000000-0000-4000-8000-0000000000b2';
const user={id:riderId,aud:'authenticated',role:'authenticated',email:'rider-fixture@example.test',
 email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},user_metadata:{full_name:'Rider Fixture'}};
const commute={origin:'المعادي',destination:'التجمع',originPlace:null,destinationPlace:null,
 outbound:'07:30',returnTime:'17:00',period:'monthly',direction:'outbound',
 savedAt:'2026-11-21T00:00:00.000Z'};
for(const width of [320,390]){
 for(const variant of [{language:'en',theme:'light'},{language:'ar',theme:'dark'}] as const){
 test('returning verified Rider one-tap commute '+width+'px '+variant.language+' '+variant.theme,async({page})=>{
  await page.setViewportSize({width,height:width===320?700:844});
  await page.addInitScript(({endpoint,user,commute,variant})=>{
   const id=new URL(endpoint).hostname.split('.')[0];
   localStorage.setItem('sb-'+id+'-auth-token',JSON.stringify({
    access_token:'fixture-header.fixture-payload.fixture-signature',refresh_token:'local-fixture',
    token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}));
   localStorage.setItem('sekka.rider.recurringCommute.v1.'+user.id,JSON.stringify(commute));
   localStorage.setItem('language_preference',variant.language);
   localStorage.setItem('theme_preference',variant.theme);
  },{endpoint,user,commute,variant});
  let searchCount=0;
  await page.route(endpoint+'/**',async req=>{
   const path=new URL(req.request().url()).pathname;
   let data:unknown=[];
   if(path==='/auth/v1/user')data=user;
   else if(path.startsWith('/rest/v1/v31_profiles'))data={user_id:riderId,role_preference:'rider',display_name:'Rider Fixture'};
   else if(path.startsWith('/rest/v1/v31_captain_profiles'))data=null;
   else if(path==='/rest/v1/rpc/v31_is_admin')data=false;
   else if(path.startsWith('/rest/v1/v31_service_areas'))data=[
     {id:1,name_ar:'المعادي',name_en:'Maadi'},
     {id:2,name_ar:'التجمع',name_en:'New Cairo'}];
   else if(path==='/rest/v1/rpc/v31_search_published_routes'){
    searchCount++;
    const args=req.request().postDataJSON();
    expect(args.p_origin_area).toBe('المعادي');
    expect(args.p_destination_area).toBe('التجمع');
    expect(args.p_outbound).toBe('08:15');
    expect(args.p_return).toBe('18:20');
    data=[];
   }
   await req.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/');
  await expect(page.locator('.sekka-rider-home.rh-home')).toBeVisible();
  // Approved first screen: hero illustration + four truthful commute rows + quick actions.
  await expect(page.locator('.rh-hero__artwork')).toHaveAttribute('src','/brand/sekka-rider-hero-scene.svg');
  await expect(page.locator('.rh-journey__field')).toHaveCount(4);
  await expect(page.locator('.rh-journey__ribbon')).toBeVisible();
  await expect(page.locator('.rh-journey__fields')).toContainText(variant.language==='en'?'Maadi':'المعادي');
  await expect(page.locator('.rh-journey__fields')).toContainText(variant.language==='en'?'New Cairo':'التجمع');
  // Both location rows open the real place picker rather than being inert text.
  await page.locator('.rh-journey__field').nth(0).click();
  await expect(page.getByRole('dialog').getByRole('combobox')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:variant.language==='en'?'Close':'إغلاق'}).click();
  await page.locator('.rh-journey__field').nth(1).click();
  await expect(page.getByRole('dialog').getByRole('combobox')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:variant.language==='en'?'Close':'إغلاق'}).click();
  // Pick both times directly on Home; the return time must reach the real search.
  await page.locator('.rh-journey__field').nth(2).click();
  const timeDialog=page.getByRole('dialog');
  await expect(timeDialog).toBeVisible();
  await timeDialog.locator('input[type="time"]').nth(0).fill('08:15');
  await timeDialog.locator('input[type="time"]').nth(1).fill('18:20');
  await timeDialog.getByRole('button',{name:variant.language==='en'?'Done':'تم'}).click();
  await expect(page.locator('.rh-journey__field').nth(2)).toContainText('8');
  // Pick weekdays individually; the day count is derived, not a fake default.
  await page.locator('.rh-journey__field').nth(3).click();
  const daysDialog=page.getByRole('dialog');
  const dayNames=variant.language==='en'?['Sunday','Tuesday','Thursday']:['الأحد','الثلاثاء','الخميس'];
  for(const day of dayNames){
   await daysDialog.getByRole('button',{name:day,exact:true}).click();
   await expect(daysDialog.getByRole('button',{name:day,exact:true})).toHaveAttribute('aria-pressed','true');
  }
  await expect(daysDialog.locator('.rh-picker__count')).toBeVisible();
  await daysDialog.getByRole('button',{name:variant.language==='en'?'Done':'تم'}).click();
  await expect(page.locator('.rh-journey__field').nth(3)).toContainText(variant.language==='en'?'3 days':'أيام');
  await expect(page.locator('.rh-shortcut--nearby')).toBeVisible();
  await expect(page.locator('.rh-shortcut--bookings')).toBeVisible();
  await expect(page.locator('.rh-hero h1')).toBeVisible();
  const tabs=page.getByRole('navigation',{name:variant.language==='en'?'Passenger navigation':'التنقل للراكب'});
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole('button',{name:variant.language==='en'?'Home':'الرئيسية'})).toHaveAttribute('aria-current','page');
  await expect(tabs.getByRole('button',{name:variant.language==='en'?'Search':'ابحث'})).toBeVisible();
  await expect(tabs.getByRole('button',{name:variant.language==='en'?'Bookings':'رحلاتي'})).toBeVisible();
  await expect(tabs.getByRole('button',{name:variant.language==='en'?'Account':'حسابي'})).toBeVisible();
  await page.screenshot({path:'test-results/rider-home-v3-'+width+'-'+variant.language+'-'+variant.theme+'.png',animations:'disabled',fullPage:true});
  await tabs.getByRole('button',{name:variant.language==='en'?'Search':'ابحث'}).click();
  await expect(page).toHaveURL(/tab=search&view=9/);
  await expect(page.getByRole('navigation',{name:variant.language==='en'?'Passenger navigation':'التنقل للراكب'}).getByRole('button',{name:variant.language==='en'?'Search':'ابحث'}))
   .toHaveAttribute('aria-current','page');
  await page.getByRole('navigation',{name:variant.language==='en'?'Passenger navigation':'التنقل للراكب'}).getByRole('button',{name:variant.language==='en'?'Home':'الرئيسية'}).click();
  await expect(page.locator('.rh-home')).toBeVisible();
  await expect(page.locator('.rh-button--primary')).toHaveText(variant.language==='en'?'Search':'ابحث');
  await page.locator('.rh-button--primary').click();
  await expect(page).toHaveURL(/tab=search&view=11/);
  await expect(page.locator('.sekka-no-match')).toBeVisible();
  await expect(page.locator('.sekka-weekdays-disclaimer')).toBeVisible();
  expect(searchCount).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await expect(page.getByText(/Booking confirmed|تم الحجز بنجاح/)).toHaveCount(0);
 });
 }
}
