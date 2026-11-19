import {test,expect} from '@playwright/test';

// Synthetic GPS permission and published-stop matching. Never real tracking,
// real Google identity, or a claim of live Android location acceptance.
const endpoint='https://sekka-auth-e2e.supabase.co';
const route={id:'11111111-1111-4111-8111-111111111111',title:'Nasr City to Maadi',
 category:'SAVER',seat_capacity:4,period:'monthly',direction:'outbound',
 outbound_time:'07:30:00',return_time:null,price_egp:750,return_supported:false,status:'published'};
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
  else if(url.pathname==='/rest/v1/v31_routes')
   data=url.searchParams.has('id')?route:[route];
  else if(url.pathname==='/rest/v1/v31_route_stops')data=stops;
  else if(url.pathname==='/rest/v1/rpc/v31_published_route_available_seats')data=2;
  else if(url.pathname==='/rest/v1/rpc/v31_is_admin')data=false;
  else if(url.pathname.startsWith('/rest/v1/v31_captain_profiles'))data=null;
  await req.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/?tab=home');
 const nearby=page.getByRole('region',{name:'Routes near me'});
 await expect(nearby.getByRole('button',{name:/Use my GPS location/})).toBeVisible();
 await expect(nearby.getByText('Pickup near me')).toHaveCount(0);
 await nearby.getByRole('button',{name:/Use my GPS location/}).click();
 await expect(nearby.getByText('Pickup near me')).toBeVisible();
 await expect(nearby.getByText(/km from your location/)).toContainText('0.1');
 expect(remoteCalls.some(url=>url.includes('30.04'))).toBe(false);
 await nearby.getByRole('button',{name:'View route details'}).click();
 await expect(page).toHaveURL(/tab=search&view=12/);
 await expect(page.getByText('Pickup near me')).toBeVisible();
});
test('denied GPS permission offers manual search and never lists fabricated routes',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','en');
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
   getCurrentPosition:(_success:unknown,error:(e:{code:number})=>void)=>error({code:1})
  }});
 });
 await page.goto('/?tab=search&view=9');
 const nearby=page.getByRole('region',{name:'Routes near me'});
 await nearby.getByRole('button',{name:/Use my GPS location/}).click();
 await expect(nearby.getByRole('alert')).toContainText('Location permission was denied');
 await expect(page.locator('.d-planner-places select').first()).toBeVisible();
 await expect(nearby.getByRole('button',{name:'View route details'})).toHaveCount(0);
});
