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
  // The Rider had already chosen the weekly schedule before looking at results.
  sessionStorage.setItem('sekka.rider.discoveryDraft.v31',JSON.stringify({
   period:'weekly',outbound:'08:15',returnTime:'18:45'
  }));
 },{endpoint,user});
 let saved:RequestRecord|null=null;
 let insertCount=0,editCount=0,cancelCount=0;
 await page.route(endpoint+'/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  let data:unknown=[];
  let status=200;
  if(path==='/auth/v1/user')data=user;
  else if(path==='/rest/v1/rpc/v31_is_admin')data=false;
  else if(path.startsWith('/rest/v1/v31_captain_profiles'))data=null;
  else if(path.startsWith('/rest/v1/v31_service_areas'))data=areas;
  else if(path.endsWith('/rpc/v31_search_published_routes'))data=[];
  else if(path.startsWith('/rest/v1/v31_public_route_offers'))data=[];
  else if(path.startsWith('/rest/v1/v31_trip_offers'))data=[];
  else if(path==='/rest/v1/rpc/v31_edit_open_trip_request'){
   const body=req.postDataJSON() as {
    p_request:string;p_direction:string;p_outbound_time:string|null;p_return_time:string|null;p_period:string;p_seats:number
   };
   if(!saved||saved.id!==body.p_request||saved.status!=='open'){
    status=400;data={message:'REQUEST_NOT_EDITABLE'};
   }else{
    editCount++;
    saved={...saved,seats:body.p_seats,period:body.p_period,direction:body.p_direction,
     outbound_time:body.p_outbound_time,return_time:body.p_return_time};
    data=saved.id;
   }
  }
  else if(path==='/rest/v1/rpc/v31_cancel_trip_request'){
   cancelCount++;
   if(saved)saved.status='cancelled';
   data=null;
  }
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
    data=saved?.status==='open'?[{id:saved.id}]:[];
   }else data=saved?[saved]:[];
  }
  else if(path.startsWith('/rest/v1/v31_profiles'))data=null;
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/?tab=search&view=9');
 const origin=page.getByRole('combobox',{name:'From where?'});
 await origin.fill('Maadi');
 await page.getByRole('group',{name:'Place search suggestions'}).getByRole('button',{name:/Maadi/}).click();
 const destination=page.getByRole('combobox',{name:'Where to?'});
 await destination.fill('Nasr');
 await page.getByRole('group',{name:'Place search suggestions'}).getByRole('button',{name:/Nasr City/}).click();
 await page.locator('.d-planner button[type=submit]').click();
 await expect(page).toHaveURL(/tab=search&view=11/);

 const result=page.getByRole('group',{name:'Search result'});
 await expect(result.getByText('No matching trip available right now.')).toBeVisible();
 const request=result.locator('.sekka-no-match-action');
 await expect(request.getByRole('button',{name:'Request a trip using this search'})).toBeVisible();
 await expect(request.locator('input,select,textarea')).toHaveCount(0);
 await expect(result.locator('.live-trip-requests')).toHaveCount(0);
 await request.getByRole('button',{name:'Request a trip using this search'}).click();
 await expect(request.getByText('Your request was saved using your search details. Follow it in My bookings → My trip requests.')).toBeVisible();
 expect(insertCount).toBe(1);
 expect(saved).toMatchObject({
  rider_id:userId,origin_area_id:11,destination_area_id:22,
  direction:'round_trip',period:'weekly',outbound_time:'08:15',return_time:'18:45',seats:1
 });
 // The same submitted details persist through reload, with no second form.
 await page.reload();
 await expect(page).toHaveURL(/tab=search&view=11/);
 const again=page.locator('.sekka-no-match-action');
 await expect(again.locator('input,select,textarea')).toHaveCount(0);
 await again.getByRole('button',{name:'Request a trip using this search'}).click();
 await expect(again.getByText('You already have this trip request. Find it in My bookings → My trip requests.')).toBeVisible();
 expect(insertCount).toBe(1);
 // Existing requests are managed from My bookings, not duplicated under no-match.
 await page.goto('/?tab=bookings');
 await page.getByRole('button',{name:'My trip requests'}).click();
 const full=page.locator('.sekka-bookings-workspace .live-trip-requests');
 await expect(full.getByRole('heading',{name:'Active requests (1)'})).toBeVisible();
 await expect(full.locator('ul li').first()).toContainText('Weekly');
 await full.getByRole('button',{name:'Edit request'}).click();
 const editPanel=full.getByLabel('Edit request details');
 await editPanel.getByRole('spinbutton',{name:'Seats needed'}).fill('2');
 await editPanel.getByRole('button',{name:'Save changes'}).click();
 await expect(full.getByText('Request updated and verified.')).toBeVisible();
 expect(editCount).toBe(1);
 expect(saved?.seats).toBe(2);
 expect(insertCount).toBe(1);
 // Cancelled records must leave the active section and remain readable as history.
 await full.getByRole('button',{name:'Cancel request'}).click();
 await expect(full.getByRole('heading',{name:'Active requests (0)'})).toBeVisible();
 await expect(full.getByText('No active requests right now.')).toBeVisible();
 const archived=full.locator('details.d-request-history');
 await expect(archived.getByText('Previous and cancelled requests (1)')).toBeVisible();
 await archived.locator('summary').click();
 await expect(archived.locator('li')).toContainText('Cancelled');
 expect(cancelCount).toBe(1);
});

test('MOCKED guest can review empty search and return with the same areas',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>localStorage.setItem('language_preference','en'));
 await page.route(endpoint+'/**',route=>{
  const path=new URL(route.request().url()).pathname;
  return route.fulfill({contentType:'application/json',body:JSON.stringify(path.endsWith('/v31_service_areas')?areas:[])});
 });
 await page.goto('/?tab=search&view=9');
 const from=page.getByRole('combobox',{name:'From where?'});
 const to=page.getByRole('combobox',{name:'Where to?'});
 await from.fill('Maadi');
 await page.getByRole('button',{name:'Maadi Service area'}).click();
 await to.fill('Nasr City');
 await page.getByRole('button',{name:'Nasr City Service area'}).click();
 await page.getByRole('button',{name:'Search for routes'}).click();
 await expect(page.getByRole('button',{name:'Sign in to request this trip'})).toBeVisible();
 await expect(page.getByText('Auth session missing!')).toHaveCount(0);
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await expect(from).toHaveValue('Maadi');
 await expect(to).toHaveValue('Nasr City');
});
