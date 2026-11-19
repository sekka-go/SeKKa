import {test,expect} from '@playwright/test';

// Synthetic Android-width regression for the owner's no-match request journey.
// This is NOT real Google OAuth or live Staging acceptance.
const endpoint='https://sekka-auth-e2e.supabase.co';
const userId='00000000-0000-4000-8000-0000000000b1';
const user={
 id:userId,aud:'authenticated',role:'authenticated',email:'passenger-fixture@example.test',
 email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},
 user_metadata:{full_name:'Passenger Fixture'}
};
const areas=[
 {id:11,name_ar:'المعادي',name_en:'Maadi',active:true},
 {id:22,name_ar:'مدينة نصر',name_en:'Nasr City',active:true}
];
type RequestRecord={
 id:string;rider_id:string;origin_area_id:number;destination_area_id:number;
 outbound_time:string|null;return_time:string|null;direction:string;period:string;
 seats:number;status:string;request_key:string;created_at:string
};

test('MOCKED Rider no-match journey saves the selected period and re-reads the owned request',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(({endpoint,user})=>{
  const key='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
  localStorage.setItem(key,JSON.stringify({
   access_token:'fixture-header.fixture-payload.fixture-signature',
   refresh_token:'fixture-refresh',token_type:'bearer',
   expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
  }));
  localStorage.setItem('language_preference','en');
  localStorage.setItem('theme_preference','light');
 },{endpoint,user});
 let saved:RequestRecord|null=null;
 let insertCount=0;
 await page.route(endpoint+'/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  let data:unknown=[];
  let status=200;
  if(path==='/auth/v1/user')data=user;
  else if(path==='/rest/v1/rpc/v31_is_admin')data=false;
  else if(path.startsWith('/rest/v1/v31_captain_profiles'))data=null;
  else if(path.startsWith('/rest/v1/v31_service_areas'))data=areas;
  else if(path.startsWith('/rest/v1/v31_routes'))data=[];
  else if(path.startsWith('/rest/v1/v31_trip_offers'))data=[];
  else if(path.startsWith('/rest/v1/v31_trip_requests')){
   if(req.method()==='POST'){
    insertCount++;
    const body=req.postDataJSON() as Omit<RequestRecord,'id'|'status'|'created_at'>;
    saved={...body,id:'11111111-1111-4111-8111-111111111111',
     status:'open',created_at:'2026-11-19T00:00:00Z'};
    status=201;
   }else if(url.searchParams.has('request_key')){
    const key=url.searchParams.get('request_key')?.replace(/^eq\./,'');
    data=saved?.request_key===key?saved:null;
   }else if(url.searchParams.has('origin_area_id')&&url.searchParams.has('status')){
    data=saved?[{id:saved.id}]:[];
   }else data=saved?[saved]:[];
  }
  else if(path.startsWith('/rest/v1/v31_profiles'))data=null;
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/?tab=search&view=9');
 const placeSelects=page.locator('.d-planner-places select');
 await expect(placeSelects.first().locator('option[value="المعادي"]')).toHaveCount(1);
 await placeSelects.nth(0).selectOption('المعادي');
 await placeSelects.nth(1).selectOption('مدينة نصر');
 await page.locator('.d-planner button[type=submit]').click();
 await expect(page).toHaveURL(/tab=search&view=11/);
 await expect(page.getByText('No suitable route yet.')).toBeVisible();
 const request=page.locator('.d-live-search .live-trip-requests');
 await expect(request.getByRole('heading',{name:'No match? Review your request'})).toBeVisible();
 // An unfiltered route search must still carry a valid request period.
 await request.getByRole('combobox',{name:'Subscription period'}).selectOption('weekly');
 await request.getByRole('combobox',{name:'Journey direction'}).selectOption('outbound');
 await request.getByRole('button',{name:'Confirm and save trip request'}).click();
 await expect(request.getByText('Your request and journey schedule are saved. Follow it here.')).toBeVisible();
 expect(insertCount).toBe(1);
 expect(saved).toMatchObject({
  rider_id:userId,origin_area_id:11,destination_area_id:22,
  direction:'outbound',period:'weekly',outbound_time:'07:30',return_time:null,seats:1
 });
 await page.reload();
 await expect(page).toHaveURL(/tab=search&view=11/);
 await expect(page.locator('.live-trip-requests ul li').first()).toContainText('Weekly');
 expect(insertCount).toBe(1);
});
