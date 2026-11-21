import {test,expect} from '@playwright/test';

// Every server response below is deliberately mocked. The test checks wiring,
// readability and state boundaries, NOT a real Google/Supabase production booking.
const endpoint='https://sekka-auth-e2e.supabase.co';
const riderId='00000000-0000-4000-8000-0000000000c1';
const routeId='11111111-1111-4111-8111-111111111111';
const fromId='22222222-2222-4222-8222-222222222221';
const toId='22222222-2222-4222-8222-222222222222';
const bookingId='33333333-3333-4333-8333-333333333333';
const user={id:riderId,aud:'authenticated',role:'authenticated',email:'rider-v3@example.test',
 email_confirmed_at:'2026-11-21T00:00:00Z',created_at:'2026-11-21T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},user_metadata:{full_name:'Rider V3'}};
const areaList=[
 {id:11,name_ar:'المعادي',name_en:'Maadi',active:true},
 {id:22,name_ar:'التجمع',name_en:'New Cairo',active:true}
];
const route={id:routeId,title:'المعادي – التجمع',category:'DAILY',
 seat_capacity:4,period:'weekly',direction:'outbound',
 outbound_time:'08:15:00',return_time:null,seat_price_egp:130,return_supported:false};
const stops=[
 {id:fromId,route_id:routeId,area_id:11,position:1,name:'ميدان الجزائر',
  pickup_allowed:true,dropoff_allowed:false},
 {id:toId,route_id:routeId,area_id:22,position:2,name:'شارع التسعين',
  pickup_allowed:false,dropoff_allowed:true}
];
const item={route,from:stops[0],to:stops[1],reverse:false,
 stops,remaining:2,pickupDistanceKm:null,dropoffDistanceKm:null};
async function setup(page:import('@playwright/test').Page,language:'ar'|'en',theme:'light'|'dark'){
 await page.addInitScript(({endpoint,user,language,theme})=>{
  const key='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
  localStorage.setItem(key,JSON.stringify({access_token:'fixture.header.signature',
   refresh_token:'fixture-refresh',token_type:'bearer',
   expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}));
  localStorage.setItem('language_preference',language);
  localStorage.setItem('theme_preference',theme);
 },{endpoint,user,language,theme});
 let queries=0;
 await page.route(endpoint+'/**',async req=>{
  const path=new URL(req.request().url()).pathname;
  let data:unknown=[];
  if(path==='/auth/v1/user')data=user;
  else if(path.startsWith('/rest/v1/v31_profiles'))data={user_id:riderId,role_preference:'rider',display_name:'Rider V3'};
  else if(path.startsWith('/rest/v1/v31_captain_profiles'))data=null;
  else if(path==='/rest/v1/rpc/v31_is_admin')data=false;
  else if(path.startsWith('/rest/v1/v31_service_areas'))data=areaList;
  else if(path==='/rest/v1/rpc/v31_search_published_routes'){
   queries++;
   const search=req.request().postDataJSON();
   expect(search.p_origin_area).toBe('المعادي');
   expect(search.p_destination_area).toBe('التجمع');
   expect(search.p_outbound).toBe('08:15');
   data=[{route_id:routeId,selection:item}];
  }
  else if(path.startsWith('/rest/v1/v31_bookings'))data=[{
   id:bookingId,route_id:routeId,rider_id:riderId,seats:1,status:'pending',
   created_at:'2026-11-21T12:00:00Z'}];
  else if(path.startsWith('/rest/v1/v31_public_route_offers'))data=[route];
  else if(path.startsWith('/rest/v1/v31_route_stops'))data=stops;
  else if(path==='/rest/v1/rpc/v31_published_route_available_seats')data=2;
  await req.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 return ()=>queries;
}
for(const variant of [
 {language:'ar',theme:'light',width:390},
 {language:'en',theme:'dark',width:320}
] as const){
 test('production Rider search -> published result -> stop review -> booking '+variant.language,async({page})=>{
  await page.setViewportSize({width:variant.width,height:844});
  const count=await setup(page,variant.language,variant.theme);
  await page.goto('/?tab=search&view=9');
  const form=page.locator('.rs3');
  await expect(form).toBeVisible();
  const from=form.getByRole('combobox',{name:variant.language==='ar'?'نقطة الانطلاق':'Starting point'});
  await from.fill('Maadi');
  await form.getByRole('group',{name:variant.language==='ar'?'نتائج البحث عن المكان':'Place search suggestions'})
   .getByRole('button',{name:/Maadi|المعادي/}).first().click();
  const to=form.getByRole('combobox',{name:variant.language==='ar'?'الوجهة':'Destination'});
  await to.fill('New Cairo');
  await form.getByRole('group',{name:variant.language==='ar'?'نتائج البحث عن المكان':'Place search suggestions'})
   .getByRole('button',{name:/New Cairo|التجمع/}).first().click();
  await form.locator('input[type=time]').first().fill('08:15');
  await form.locator('.rs3__days-toggle').click();
  const sunday=variant.language==='ar'?'الأحد':'Sun';
  await form.getByRole('button',{name:sunday,exact:true}).click();
  await expect(form.getByRole('button',{name:sunday,exact:true})).toHaveAttribute('aria-pressed','true');
  await form.locator('.rs3__submit').click();
  await expect(page).toHaveURL(/tab=search&view=11/);
  await expect(page.locator('.rr3-hero')).toBeVisible();
  await expect(page.locator('.sekka-live-result')).toHaveCount(1);
  await expect(page.locator('.sekka-live-price')).toContainText(variant.language==='ar'?'١٣٠':'130');
  await expect(page.locator('.sekka-weekdays-disclaimer')).toBeVisible();
  // Refine results in the new dedicated filter page and preserve the same route.
  await page.locator('.sekka-live-results-toolbar .d-outline').click();
  await expect(page).toHaveURL(/tab=search&view=10/);
  const filters=page.locator('.rf3');
  await expect(filters).toBeVisible();
  const weekly=filters.getByRole('group',{name:variant.language==='ar'?'مدة الاشتراك':'Subscription period'})
   .getByRole('button',{name:variant.language==='ar'?'أسبوعي':'Weekly'});
  await weekly.click();
  await expect(weekly).toHaveAttribute('aria-pressed','true');
  await filters.locator('.rf3__apply').click();
  await expect(page).toHaveURL(/tab=search&view=11/);
  await expect(page.locator('.sekka-live-result')).toHaveCount(1);
  await page.screenshot({path:'test-results/rider-v3-results-'+variant.language+'.png',fullPage:true,animations:'disabled'});
  expect(count()).toBeGreaterThan(0);
  await page.locator('.sekka-live-result .d-offer-select').click();
  await expect(page).toHaveURL(/tab=search&view=12/);
  await expect(page.locator('.rd3')).toBeVisible();
  // The current stop selection must survive internal navigation and browser Back.
  await expect(page).toHaveURL(/route=11111111-1111-4111-8111-111111111111/);
  await expect(page).toHaveURL(/pickup=22222222-2222-4222-8222-222222222221/);
  await expect(page).toHaveURL(/dropoff=22222222-2222-4222-8222-222222222222/);
  const detailUrl=page.url();
  await page.getByRole('button',{name:variant.language==='ar'?'فتح القائمة':'Open menu'}).click();
  await page.getByRole('dialog',{name:variant.language==='ar'?'القائمة الرئيسية':'Main menu'})
    .getByRole('button',{name:variant.language==='ar'?'الإشعارات':'Notifications'}).click();
  await expect(page.locator('.live-notifications')).toBeVisible();
  await expect(page.locator('.rh-tabs')).toBeVisible();
  await page.getByRole('button',{name:variant.language==='ar'?'رجوع للصفحة السابقة':'Back to previous page'}).click();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.locator('.rd3')).toBeVisible();
  await expect(page.locator('.rd3__stops select')).toHaveCount(2);
  await expect(page.locator('.rd3__primary')).toBeEnabled();
  await page.screenshot({path:'test-results/rider-v3-details-'+variant.language+'.png',fullPage:true,animations:'disabled'});
  await page.locator('.rd3__primary').click();
  await expect(page).toHaveURL(/tab=booking/);
  await expect(page.locator('.sekka-rider-booking-v3 .rbk3-hero')).toBeVisible();
  await expect(page.locator('.b-seat-chooser')).toBeVisible();
  await expect(page.getByText(/Booking confirmed|تم تأكيد الحجز/)).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(variant.width+1);
 });
 test('production Rider bookings use real statuses and require cancel confirmation '+variant.language,async({page})=>{
  await page.setViewportSize({width:variant.width,height:844});
  await setup(page,variant.language,variant.theme);
  await page.goto('/?tab=bookings');
  const bookings=page.locator('.rb3');
  await expect(bookings).toBeVisible();
  await expect(bookings.locator('.rb3__card')).toHaveCount(1);
  await expect(bookings.locator('.rb3__status--pending')).toBeVisible();
  await bookings.locator('.rb3__cancel-trigger').click();
  await expect(bookings.locator('.rb3__confirm')).toBeVisible();
  await expect(bookings.getByRole('button',{name:variant.language==='en'?'Keep booking':'تراجع'})).toBeVisible();
  await page.screenshot({path:'test-results/rider-v3-bookings-'+variant.language+'.png',fullPage:true,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(variant.width+1);
 });
}
