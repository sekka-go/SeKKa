import {test,expect} from '@playwright/test';

const endpoint='https://sekka-auth-e2e.supabase.co';
const actor='00000000-0000-4000-8000-0000000000c1';
const vehicle='00000000-0000-4000-8000-0000000000e1';
const user={
 id:actor,aud:'authenticated',role:'authenticated',
 email:'approved.captain@example.test',
 app_metadata:{provider:'google',providers:['google']},
 user_metadata:{full_name:'Captain Test Account'},
 created_at:'2026-01-01T00:00:00Z',email_confirmed_at:'2026-01-01T00:00:00Z'
};
test('MOCKED approved Captain creates geocoded route with automatic name and no re-enrollment',async({page})=>{
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(({endpoint,user})=>{
  const key='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
  localStorage.setItem(key,JSON.stringify({
   access_token:'fixture-header.fixture-payload.fixture-signature',
   refresh_token:'local-fixture-refresh',token_type:'bearer',
   expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
  }));
  localStorage.setItem('language_preference','en');
  localStorage.setItem('theme_preference','light');
 },{endpoint,user});
 let enrolledAgain=0,created=0,legacyGpsCalls=0;
 let payload:Record<string,unknown>|undefined;
 let firstAttempt:unknown;
 let status='draft',publishCalls=0,reviewReads=0;
 const routeId='00000000-0000-4000-8000-0000000000f1';
 const savedStops=[
  {id:'00000000-0000-4000-8000-0000000000f2',area_id:11,name:'Maadi Grand Mall',position:0,pickup_allowed:true,dropoff_allowed:true,latitude:null as number|null,longitude:null as number|null,outbound_stop_time:null as string|null,return_stop_time:null as string|null},
  {id:'00000000-0000-4000-8000-0000000000f3',area_id:22,name:'Nasr City Square',position:1,pickup_allowed:true,dropoff_allowed:true,latitude:null as number|null,longitude:null as number|null,outbound_stop_time:null as string|null,return_stop_time:null as string|null}
 ];
 await page.route('https://www.openstreetmap.org/export/embed.html?*',route=>route.fulfill({body:'Map frame fixture'}));
 await page.route('https://photon.komoot.io/api/**',async route=>{
  const q=new URL(route.request().url()).searchParams.get('q')||'';
  const maadi=q.toLowerCase().includes('maadi')&&!q.toLowerCase().includes('outside');
  const mall=q.toLowerCase().includes('maadi grand mall');
  const newCairo=q.toLowerCase().includes('cairo festival city');
  await route.fulfill({contentType:'application/json',body:JSON.stringify({features:[{
   geometry:{coordinates:newCairo?[31.4082,30.0279]:maadi?[31.25,29.96]:[31.34,30.06]},
   properties:{osm_id:newCairo?103:maadi?101:102,osm_type:'N',name:newCairo?'Cairo Festival City Mall':maadi?(mall?'Maadi Grand Mall':'Maadi Market'):'Nasr City Square',
    district:newCairo?'New Cairo':maadi?'Maadi':'Nasr City',city:'Cairo',countrycode:'EG'}
  }]})});
 });
 await page.route(endpoint+'/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const method=route.request().method();
  const body=method==='POST'&&route.request().postData()?route.request().postDataJSON():{};
  let result:unknown=[];
  if(path==='/auth/v1/user')result=user;
  else if(path==='/rest/v1/rpc/v31_is_admin')result=false;
  else if(path==='/rest/v1/rpc/v31_captain_private_prices')result=[{route_id:routeId,price_egp:1300}];
  else if(path.startsWith('/rest/v1/v31_captain_profiles')){
   if(method!=='GET')enrolledAgain++;
   result={user_id:actor,approval_status:'approved'};
  }else if(path.startsWith('/rest/v1/v31_profiles'))
   result={user_id:actor,role_preference:'captain'};
  else if(path.startsWith('/rest/v1/v31_service_areas'))result=[
   {id:11,name_ar:'المعادي',name_en:'Maadi'},
   {id:22,name_ar:'مدينة نصر',name_en:'Nasr City'},
   {id:33,name_ar:'التجمع',name_en:'New Cairo'}
  ];
  else if(path.startsWith('/rest/v1/v31_vehicles'))result=[
   {id:vehicle,model:'Tipo',plate_number:'TEST-123',enabled_categories:['PRIME']}
  ];
  else if(path==='/rest/v1/rpc/v31_create_geolocated_route_draft'){
   created++;payload=body;
   const input=(body as {p_stops:Array<{latitude:number;longitude:number}>}).p_stops;
   input.forEach((stop,i)=>{savedStops[i].latitude=stop.latitude;savedStops[i].longitude=stop.longitude;
    savedStops[i].outbound_stop_time=(stop as {outbound_stop_time?:string|null}).outbound_stop_time??null;
    savedStops[i].return_stop_time=(stop as {return_stop_time?:string|null}).return_stop_time??null;});
   if(created===1){
    firstAttempt=body.p_attempt;
    await route.abort('failed');
    return;
   }
   result=routeId;
  }else if(path==='/rest/v1/rpc/v31_set_route_status'){
   expect(body).toEqual({p_route:routeId,p_status:'published'});
   publishCalls++;
   status='published';
   result=status;
  }else if(path==='/rest/v1/rpc/v31_set_draft_stop_coordinates'){
   legacyGpsCalls++;
   result=null;
  }else if(path.startsWith('/rest/v1/v31_routes')){
   const row={id:routeId,title:'Maadi Grand Mall ← Nasr City Square',status,vehicle_id:vehicle,
    category:'PRIME',seat_capacity:3,price_egp:1300,direction:'return',period:'monthly',
    outbound_time:null,return_time:'17:00:00'};
   result=(route.request().headers()['accept']||'').includes('object+json')?row:[row];
  }
  else if(path.startsWith('/rest/v1/v31_route_stops')){
   if(new URL(route.request().url()).searchParams.get('select')==='id,name,position,outbound_stop_time,return_stop_time'&&++reviewReads===1){
    // Use a non-retryable response so this exercises the app's retry button.
    await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Fixture review unavailable'})});
    return;
   }
   result=savedStops;
  }
  await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/?tab=routes&view=43');
 const form=page.locator('.sekka-captain-route-wizard');
 await expect(form).toBeVisible();
 await expect(form.getByRole('heading',{name:'Create a new trip'})).toBeVisible();
 await expect(form.getByRole('textbox',{name:'Route title'})).toHaveCount(0);
 await expect(form.getByText(/Latitude|Longitude|خط العرض|خط الطول/)).toHaveCount(0);
 await page.getByRole('button',{name:'Open menu'}).click();
 const drawer=page.getByRole('dialog',{name:'Main menu'});
 await expect(drawer.getByRole('button',{name:/Captain registration|Review Captain application/})).toHaveCount(0);
 await drawer.getByRole('button',{name:'My routes'}).click();
 await page.goto('/?tab=captain-onboarding&view=35');
 await expect(page).toHaveURL(/tab=routes&view=42/);
 await page.goto('/?tab=routes&view=43');
 const entry=page.locator('.sekka-captain-route-wizard');
 // Name-first search with no area prerequisite, same as the Rider.
 await expect(entry.getByRole('group',{name:'Main areas'})).toHaveCount(0);
 await expect(entry.getByText('Choose stop service area')).toHaveCount(0);
 const place=entry.getByRole('combobox',{name:'Search for a stop'});
 await expect(place).toBeVisible();
 await place.fill('Outside street');
 await expect(entry.getByRole('button',{name:'Find',exact:true})).toHaveCount(0);
 await expect(entry.getByText(/This name is not in our current place data/)).toBeVisible();
 await expect(entry.locator('.cj-easy-selected-stops>li')).toHaveCount(0);
 await place.fill('Maadi Grand Mall');
 await expect(entry.locator('.cj-easy-results').getByRole('option',{name:/Maadi Grand Mall/})).toBeVisible();
 await entry.locator('.cj-easy-results').getByRole('option',{name:/Maadi Grand Mall/}).click();
 await expect(entry.locator('.cj-easy-selected-stops>li')).toHaveCount(1);
 await expect(page.getByRole('dialog',{name:'Choose point on map'})).toHaveCount(0);
 const destination=entry.getByRole('combobox',{name:'Search for a stop'});
 await destination.fill('Nasr City Square');
 await expect(entry.locator('.cj-easy-results').getByRole('option',{name:/Nasr City Square/})).toBeVisible();
 await entry.locator('.cj-easy-results').getByRole('option',{name:/Nasr City Square/}).click();
 await expect(entry.locator('.cj-easy-selected-stops>li')).toHaveCount(2);
 // A third waypoint is inserted by name only; its removal must not
 // change the already selected first two stops or force the map.
 await destination.fill('Cairo Festival City Mall');
 await expect(entry.locator('.cj-easy-results').getByRole('option',{name:/Cairo Festival City Mall/})).toBeVisible();
 await entry.locator('.cj-easy-results').getByRole('option',{name:/Cairo Festival City Mall/}).click();
 await expect(entry.locator('.cj-easy-selected-stops>li')).toHaveCount(3);
 await expect(page.getByRole('dialog',{name:'Choose point on map'})).toHaveCount(0);
 await entry.getByRole('button',{name:'Remove Cairo Festival City Mall'}).click();
 await expect(entry.locator('.cj-easy-selected-stops>li')).toHaveCount(2);
 await entry.getByText('Preview route on map (optional)').click();
 await expect(entry.getByTitle('OpenStreetMap route stop map')).toBeVisible();
 await entry.getByRole('button',{name:'Move earlier: Nasr City Square'}).click();
 await expect(entry.locator('.cj-easy-selected-stops>li').first()).toContainText('Nasr City Square');
 await entry.getByRole('button',{name:'Move later: Nasr City Square'}).click();
 await entry.getByText('Check driving directions on OpenStreetMap',{exact:true}).click();
 await expect(entry.getByRole('link',{name:'From Maadi Grand Mall to Nasr City Square'})).toHaveAttribute('href',/openstreetmap\.org\/directions\?engine=fossgis_osrm_car&route=/);
 await entry.getByRole('button',{name:'Continue'}).click();
 await expect(entry.getByRole('combobox',{name:'Approved vehicle'})).toBeVisible();
 await entry.getByRole('button',{name:'Back'}).click();
 await expect(entry.locator('.cj-easy-selected-stops>li')).toHaveCount(2);
 await entry.getByRole('button',{name:'Continue'}).click();
 await expect(entry.getByRole('combobox',{name:'Approved vehicle'})).toBeVisible();
 await expect(entry.getByRole('button',{name:'Add this stop'})).toHaveCount(0);
 await expect(entry.locator('iframe.sekka-route-map-card__frame')).toHaveCount(0);
 await expect(entry.getByRole('combobox',{name:'Approved vehicle'})).toBeVisible();
 await expect(entry.getByRole('button',{name:/PRIME/})).toBeEnabled();
 await expect(entry.getByRole('button',{name:/SAVER/})).toBeDisabled();
 await entry.getByRole('button',{name:'Continue'}).click();
 await entry.getByRole('combobox',{name:'Journey direction'}).selectOption('return');
 await expect(entry.getByText('For return only, the first stop served is the last stop in your list.')).toBeVisible();
 // Return direction serves the listed stops in reverse; each has its own
 // optional estimated time. This must persist through the atomic draft RPC.
 await entry.locator('input[aria-label="Return time at Maadi Grand Mall"]').fill('17:45');
 await entry.locator('input[aria-label="Return time at Nasr City Square"]').fill('17:00');
 await entry.getByRole('button',{name:'Continue'}).click();
 await expect(entry.getByText('Trip review and price')).toBeVisible();
 const save=entry.getByRole('button',{name:'Save draft for publishing'});
 const amount=entry.getByRole('spinbutton',{name:'Total vehicle price (EGP)'});
 await amount.fill('0');
 await expect(save).toBeDisabled();
 await amount.fill('1300');
 await expect(save).toBeEnabled();
 await save.click();
 await expect(entry.getByRole('alert').filter({hasText:'The action could not be completed'})).toBeVisible();
 await expect(save).toBeEnabled();
 await save.click();
 await expect(page.getByRole('status').filter({hasText:'Draft saved.'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Captain route management'})).toBeVisible();
 const review=page.getByRole('region',{name:'Route details'});
 const confirm=review.getByRole('button',{name:'Confirm and publish'});
 await expect(review.getByRole('heading',{name:'Review your route before publishing'})).toBeFocused();
 await expect(review.getByRole('alert')).toContainText('Could not load the stops');
 await expect(confirm).toBeDisabled();
 expect(publishCalls).toBe(0);
 await review.getByRole('button',{name:'Retry loading stops'}).click();
 await expect(review.getByText('Return time')).toBeVisible();
 await expect(review.getByText('17:00')).toBeVisible();
 await expect(review.getByRole('list',{name:'Stop order'}).getByRole('listitem').first()).toContainText('Nasr City Square');
 await expect(confirm).toBeEnabled();
 expect(publishCalls).toBe(0);
 await confirm.click();
 await expect(page.getByRole('status').filter({hasText:'Route published and available to riders.'})).toBeVisible();
 expect(publishCalls).toBe(1);
 expect(created).toBe(2);
 expect(firstAttempt).toMatch(/^[0-9a-f-]{36}$/);
 expect(payload?.p_attempt).toBe(firstAttempt);
 expect(payload).toMatchObject({
  p_title:'Maadi Grand Mall ← Nasr City Square',
  p_vehicle:vehicle,p_category:'PRIME',p_price:1300,
  p_direction:'return',p_outbound:null,p_return:'17:00',p_return_supported:true
 });
 expect((payload?.p_stops as Array<{name:string;area_id:number}>).map(x=>x.name))
  .toEqual(['Maadi Grand Mall','Nasr City Square']);
 expect(savedStops.every(x=>x.latitude!==null&&x.longitude!==null)).toBe(true);
 expect(savedStops.map(x=>x.return_stop_time)).toEqual(['17:45','17:00']);
 expect(savedStops.every(x=>x.outbound_stop_time===null)).toBe(true);
 expect((payload?.p_stops as Array<{return_stop_time:string|null}>).map(x=>x.return_stop_time))
  .toEqual(['17:45','17:00']);
 expect(legacyGpsCalls).toBe(0);
 expect(enrolledAgain).toBe(0);
});
