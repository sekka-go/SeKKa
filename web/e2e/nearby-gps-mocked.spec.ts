import {test,expect} from '@playwright/test';

// Mock GPS + public published-stop data only; no actual Google account, live
// location, Captain pricing mutation or payment.
const endpoint='https://sekka-auth-e2e.supabase.co';
const ride={
 id:'11111111-1111-4111-8111-111111111111',title:'Nasr City to Maadi',
 category:'SAVER',seat_capacity:4,period:'monthly',direction:'outbound',
 outbound_time:'07:30:00',return_time:null,seat_price_egp:188,
 return_supported:false,status:'published'
};
const stops=[
 {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',route_id:ride.id,area_id:1,position:0,
  name:'Pickup near me',pickup_allowed:true,dropoff_allowed:false,latitude:30.041,longitude:31.24},
 {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',route_id:ride.id,area_id:2,position:1,
  name:'Maadi dropoff',pickup_allowed:false,dropoff_allowed:true,latitude:29.963,longitude:31.25}
];
const areas=[
 {id:1,name_ar:'مدينة نصر',name_en:'Nasr City',active:true},
 {id:2,name_ar:'المعادي',name_en:'Maadi',active:true}
];
async function intercept(page:import('@playwright/test').Page,calls:string[]){
 await page.route(endpoint+'/**',async request=>{
  const url=new URL(request.request().url());
  calls.push(url.toString());
  let data:unknown=[];
  if(url.pathname==='/rest/v1/v31_service_areas')data=areas;
  else if(url.pathname==='/rest/v1/v31_public_route_offers')
   data=url.searchParams.has('id')?ride:[ride];
  else if(url.pathname==='/rest/v1/v31_route_stops')data=stops;
  else if(url.pathname==='/rest/v1/rpc/v31_published_route_available_seats')data=2;
  else if(url.pathname==='/rest/v1/rpc/v31_is_admin')data=false;
  else if(url.pathname.startsWith('/rest/v1/v31_captain_profiles'))data=null;
  await request.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
}
test('pickup explorer uses opt-in GPS, published stops, map and verified route details',async({page,context})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>localStorage.setItem('language_preference','en'));
 await context.grantPermissions(['geolocation']);
 await context.setGeolocation({latitude:30.040,longitude:31.24,accuracy:18});
 const calls:string[]=[];
 await intercept(page,calls);
 await page.goto('/?tab=search&view=9');
 await expect(page.locator('.np4')).toHaveCount(0);
 expect(calls.some(url=>url.includes('/v31_public_route_offers'))).toBe(false);
 await page.locator('.rs3__pickup-link>button').click();
 const explorer=page.getByRole('dialog',{name:'Explore pickup stops'});
 await expect(explorer).toBeVisible();
 await expect(explorer.locator('.np4__hero')).toContainText('Where will you board?');
 const card=explorer.locator('.np4__card').first();
 await expect(card.getByText('Pickup near me')).toBeVisible();
 await expect(explorer.locator('.np4__radius')).toHaveCount(0);
 await expect(explorer.getByRole('group',{name:'Maximum pickup distance'})).toHaveCount(0);
 await expect(explorer.getByRole('button',{name:/Search within/})).toHaveCount(0);
 await expect(card.locator('.np4__metrics')).toContainText('110 m');
 await expect(card).toContainText('188');
 await expect(card).toContainText('2');
 expect(calls.some(url=>url.includes('30.040'))).toBe(false);
 await card.getByRole('button',{name:'Map'}).click();
 await expect(card.locator('iframe[title^="Pickup point map"]')).toBeVisible();
 await page.screenshot({path:'test-results/pickup-explorer-v4-en.png',fullPage:true,animations:'disabled'});
 await card.getByRole('button',{name:'View ride details'}).click();
 await expect(page).toHaveURL(/tab=search&view=12/);
 await expect(page.locator('.rd3__stops select').first()).toHaveValue(stops[0].id);
 await expect(page.locator('.rd3__stops select').last()).toHaveValue(stops[1].id);
 await page.locator('.rd3__back').click();
 await expect(page).toHaveURL(/tab=search&view=9$/);
 await expect(page.locator('.rs3')).toBeVisible();
 await expect(page.locator('.rr3-hero')).toHaveCount(0);
});
test('denied GPS keeps manual search accessible, never invents points and closes cleanly',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','en');
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
   getCurrentPosition:(_success:unknown,error:(issue:{code:number})=>void)=>error({code:1})
  }});
 });
 await page.goto('/?tab=search&view=9');
 await page.locator('.rs3__pickup-link>button').click();
 const explorer=page.getByRole('dialog',{name:'Explore pickup stops'});
 await explorer.locator('.np4__locate').click();
 await expect(explorer.getByText('Location is blocked')).toBeVisible();
 await expect(explorer.getByRole('button',{name:'Try location again'})).toBeVisible();
 await expect(explorer.locator('.np4__card')).toHaveCount(0);
 await explorer.getByRole('button',{name:'Choose origin and destination manually'}).click();
 await expect(explorer).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Starting point'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Destination'})).toBeVisible();
});
test('map search remains usable without GPS and real stops remain server-matched',async({page})=>{
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
    route_id:ride.id,selection:{route:ride,from:stops[0],to:stops[1],
     reverse:false,stops,remaining:2,pickupDistanceKm:0.11,dropoffDistanceKm:null}
   }])});return;
  }
  const data=path==='/rest/v1/v31_service_areas'?areas:
   path==='/rest/v1/v31_public_route_offers'?[ride]:
   path==='/rest/v1/v31_route_stops'?stops:
   path==='/rest/v1/rpc/v31_published_route_available_seats'?2:[];
  await request.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/?tab=search&view=9');
 await page.getByRole('combobox',{name:'Starting point'}).fill('City Stars');
 await page.getByRole('button',{name:'Find this street or place on the map'}).click();
 await page.getByRole('option',{name:/City Stars/}).click();
 await expect(page.getByText(/OpenStreetMap location selected/)).toBeVisible();
 await page.getByRole('combobox',{name:'Destination'}).fill('Maadi');
 await page.getByRole('group',{name:'Place search suggestions'}).getByRole('option',{name:/Maadi/}).first().click();
 await page.locator('.rs3__submit').click();
 await expect(page).toHaveURL(/tab=search&view=11/);
 await expect(page.locator('.sekka-live-result').first()).toContainText('Pickup near me');
 await expect(page.locator('.sekka-live-result').first()).toContainText('Maadi dropoff');
});

test('Greater Cairo search rejects external results, preserves neighborhood context and requires an explicit selection',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(()=>localStorage.setItem('language_preference','en'));
 const feature=(coordinates:number[],properties:Record<string,unknown>)=>({
  geometry:{type:'Point',coordinates},properties:{countrycode:'EG',...properties}
 });
 await page.route('https://photon.komoot.io/api/**',async request=>{
  const query=new URL(request.request().url()).searchParams.get('q')||'';
  const features=query.includes('Fayoum')?[feature([30.8428,29.3084],{name:'Fayoum',osm_type:'N',osm_id:210})]:
   [feature([30.9459443,29.9731044],{name:'التجمع الخامس',city:'السادس من أكتوبر',osm_type:'N',osm_id:4555939289,osm_key:'shop',osm_value:'bookmaker'}),
    feature([31.4249357,30.0038046],{name:'Fifth Settlement',city:'New Cairo',osm_type:'W',osm_id:774635278,osm_key:'place',osm_value:'neighbourhood'})];
  await request.fulfill({json:{features}});
 });
 await page.route(endpoint+'/**',async request=>{
  const path=new URL(request.request().url()).pathname;
  await request.fulfill({json:path==='/rest/v1/v31_service_areas'?
   [...areas,{id:2,name_ar:'التجمع',name_en:'New Cairo'}]:[]});
 });
 await page.goto('/?tab=search&view=9');
 const input=page.getByRole('combobox',{name:'Starting point'});
 await input.fill('Fayoum');
 await expect(page.getByText(/outside seKKa's current service area/)).toBeVisible();
 await expect(page.getByRole('option',{name:/Fayoum/})).toHaveCount(0);
 await input.fill('التجمع 5');
 await input.press('Enter');
 const context=page.locator('.sekka-location-context');
 await expect(context).toContainText('Fifth Settlement');
 await expect(page.getByRole('option',{name:/Fifth Settlement/})).toHaveCount(0);
 await expect(page.getByText(/Registered service area/)).toHaveCount(0);
 await input.press('ArrowDown');
 await expect(page.getByRole('option',{name:/New Cairo/})).toHaveAttribute('aria-selected','true');
 await input.press('Enter');
 await expect(page.getByText(/Registered service area/)).toBeVisible();
});

test('verified Hosary context remains available during a Photon outage without adding a stop',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(()=>localStorage.setItem('language_preference','en'));
 await page.route('https://photon.komoot.io/api/**',request=>request.fulfill({status:503,json:{}}));
 await page.route(endpoint+'/**',request=>request.fulfill({json:
  new URL(request.request().url()).pathname==='/rest/v1/v31_service_areas'?
   [...areas,{id:8,name_ar:'6 أكتوبر',name_en:'6th of October'}]:[]}));
 await page.goto('/?tab=search&view=9');
 const input=page.getByRole('combobox',{name:'Starting point'});
 await input.fill('الحصرى');
 const context=page.locator('.sekka-location-context');
 await expect(context.locator('li').first()).toContainText('Hosary Square');
 await expect(context.locator('li').nth(1)).toContainText('Hosary Mosque');
 await expect(page.getByText('Map search is temporarily unavailable. Try again.')).toBeVisible();
 await expect(page.getByRole('option',{name:/Hosary/})).toHaveCount(0);
 await input.press('Enter');
 await expect(input).toHaveValue('الحصرى');
 await page.getByRole('option',{name:'6th of October Search the whole service area',exact:true}).click();
 await expect(input).toHaveValue('6th of October');
 await expect(page.getByText(/Registered service area/)).toBeVisible();
});

for(const [width,height] of [[320,700],[360,800],[390,844],[412,915]] as const){
 for(const language of ['ar','en'] as const){
  for(const theme of ['light','dark'] as const){
   test(`registered area stays operable after Photon results at ${width}px ${language} ${theme}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.addInitScript(({language,theme})=>{
     localStorage.setItem('language_preference',language);
     localStorage.setItem('theme_preference',theme);
    },{language,theme});
    await intercept(page,[]);
    await page.route('https://photon.komoot.io/api/**',route=>route.fulfill({json:{features:
     Array.from({length:12},(_,i)=>({
      geometry:{type:'Point',coordinates:[31.25,29.96]},
      properties:{osm_id:7701+i,osm_type:i<6?'N':'W',countrycode:'EG',name:'Maadi '+(i+1),district:'Maadi'}
     }))
    }}));
    await page.goto('/?tab=search&view=9');
    const origin=page.getByRole('combobox',{name:language==='en'?'Starting point':'نقطة الانطلاق'});
    await origin.fill('Maadi');
    await expect(page.getByRole('option',{name:/Maadi 1 Maadi/})).toBeVisible();
    const area=page.getByRole('option',{name:language==='en'?'Maadi Search the whole service area':'المعادي بحث في منطقة الخدمة بالكامل',exact:true});
    await area.click();
    await expect(origin).toHaveValue(language==='en'?'Maadi':'المعادي');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
   });
  }
 }
}
