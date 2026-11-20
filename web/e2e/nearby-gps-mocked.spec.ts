import {test,expect} from '@playwright/test';

// Synthetic GPS permission and published-stop matching. Never real tracking,
// real Google identity, or a claim of live Android location acceptance.
const endpoint='https://sekka-auth-e2e.supabase.co';
const route={id:'11111111-1111-4111-8111-111111111111',title:'Nasr City to Maadi',
 category:'SAVER',seat_capacity:4,period:'monthly',direction:'outbound',
 outbound_time:'07:30:00',return_time:null,seat_price_egp:188,return_supported:false,status:'published'};
const stops=[
 {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',route_id:route.id,area_id:1,position:0,
 name:'Pickup near me',pickup_allowed:true,dropoff_allowed:false,latitude:30.041,longitude:31.24},
 {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',route_id:route.id,area_id:2,position:1,
 name:'Maadi dropoff',pickup_allowed:false,dropoff_allowed:true,latitude:29.963,longitude:31.25}
];
const areas=[
 {id:1,name_ar:'مدينة نصر',name_en:'Nasr City',active:true},
 {id:2,name_ar:'المعادي',name_en:'Maadi',active:true}
];
test('GPS opt-in finds nearby published pickup, shows straight-line km and opens verified route',async({page,context})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>localStorage.setItem('language_preference','en'));
 await context.grantPermissions(['geolocation']);
 await context.setGeolocation({latitude:30.040,longitude:31.24,accuracy:18});
 const remoteCalls:string[]=[];
 await page.route(endpoint+'/**',async req=>{
  const url=new URL(req.request().url());
  remoteCalls.push(url.toString());
  let data:unknown=[];
  if(url.pathname==='/rest/v1/v31_service_areas')data=areas;
  else if(url.pathname==='/rest/v1/v31_public_route_offers')data=[route];
  else if(url.pathname==='/rest/v1/v31_route_stops')data=stops;
  else if(url.pathname==='/rest/v1/rpc/v31_published_route_available_seats')data=2;
  else if(url.pathname==='/rest/v1/rpc/v31_is_admin')data=false;
  else if(url.pathname.startsWith('/rest/v1/v31_captain_profiles'))data=null;
  await req.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 // Guests see Welcome on /; the actual Rider discovery is under Search.
 // Exercise GPS on the public Search screen, never the guest onboarding screen.
 await page.goto('/?tab=search&view=9');
 await expect(page.getByRole('region',{name:'Routes near me'})).toHaveCount(0);
 expect(remoteCalls.some(url=>url.includes('/v31_public_route_offers'))).toBe(false);
 const nearbyToggle=page.locator('.sekka-gps-inline > summary');
 await expect(nearbyToggle).toContainText('Find rides near my location');
 await nearbyToggle.click();
 const nearby=page.getByRole('region',{name:'Routes near me'});
 await expect(nearby).toBeVisible();
 // Browser already granted GPS on an earlier visit: suggestions load
 // automatically with no new permission prompt and no manual tap.
 await expect(nearby.getByText('Pickup near me')).toBeVisible();
 await nearby.getByRole('button',{name:'Update GPS'}).click();
 await expect(nearby.getByText('Pickup near me')).toBeVisible();
 await expect(nearby.getByText(/km from your location/)).toContainText('0.1');
 expect(remoteCalls.some(url=>url.includes('30.04'))).toBe(false);
 await nearby.getByRole('button',{name:'View route details'}).click();
 await expect(page).toHaveURL(/tab=search&view=12/);
 await expect(page.getByRole('combobox',{name:'Pickup stop'})).toHaveValue(stops[0].id);
 await expect(page.getByRole('combobox',{name:'Drop-off stop'})).toHaveValue(stops[1].id);
});
test('denied GPS permission offers manual search and never lists fabricated routes',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','en');
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
   getCurrentPosition:(_success:unknown,error:(e:{code:number})=>void)=>error({code:1})
  }});
 });
 await page.goto('/?tab=search&view=9');
 await page.locator('.sekka-gps-inline > summary').click();
 const nearby=page.getByRole('region',{name:'Routes near me'});
 await expect(nearby.locator('.sekka-nearby__locate')).toBeVisible();
 await nearby.locator('.sekka-nearby__locate').click();
 await expect(nearby.getByRole('alert')).toContainText('Location permission was denied');
 await expect(nearby.getByText('Location is blocked in your browser')).toBeVisible();
 await expect(nearby.getByRole('button',{name:'Retry location permission'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'From where?'})).toBeVisible();
 await expect(nearby.getByRole('button',{name:'View route details'})).toHaveCount(0);
});

test('map text search finds a real stop within 3km without inventing a service ID',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('language_preference','en'));
 await page.route('https://photon.komoot.io/api/**',async request=>{
  await request.fulfill({contentType:'application/json',body:JSON.stringify({features:[{
   geometry:{coordinates:[31.24,30.04]},
   properties:{osm_id:123,osm_type:'N',countrycode:'EG',name:'City Stars',city:'Cairo'}
  }]})});
 });
 await page.route(endpoint+'/**',async request=>{
  const path=new URL(request.request().url()).pathname;
  if(path==='/rest/v1/rpc/v31_search_published_routes'){
   expect(request.request().postDataJSON()).toMatchObject({
    p_origin_lat:30.04,p_origin_lon:31.24,p_destination_area:'المعادي'
   });
   await request.fulfill({contentType:'application/json',body:JSON.stringify([{
    route_id:route.id,selection:{route,from:stops[0],to:stops[1],reverse:false,stops,remaining:2,
     pickupDistanceKm:0.11,dropoffDistanceKm:null}
   }])});
   return;
  }
  const data=path==='/rest/v1/v31_service_areas'?areas:
   path==='/rest/v1/v31_public_route_offers'?[route]:
   path==='/rest/v1/v31_route_stops'?stops:
   path==='/rest/v1/rpc/v31_published_route_available_seats'?2:[];
  await request.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/?tab=search&view=9');
 await page.getByRole('combobox',{name:'From where?'}).fill('City Stars');
 await page.getByRole('button',{name:'Find this street or place on the map'}).click();
 await page.getByRole('button',{name:/City Stars/}).click();
 await expect(page.getByText(/Verified location selected/)).toBeVisible();
 await page.getByRole('combobox',{name:'Where to?'}).fill('Maadi');
 await page.getByRole('group',{name:'Place search suggestions'}).getByRole('button',{name:/Maadi/}).click();
 await page.locator('.d-planner button[type=submit]').click();
 await expect(page).toHaveURL(/tab=search&view=11/);
 await expect(page.locator('.d-live-search .d-result').first()).toContainText('Pickup near me');
 await expect(page.locator('.d-live-search .d-result').first()).toContainText('Maadi dropoff');
});
