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
 let enrolledAgain=0,created=0;
 let payload:Record<string,unknown>|undefined;
 const routeId='00000000-0000-4000-8000-0000000000f1';
 const savedStops=[
  {id:'00000000-0000-4000-8000-0000000000f2',area_id:11,name:'Maadi Market',position:0,latitude:null as number|null,longitude:null as number|null},
  {id:'00000000-0000-4000-8000-0000000000f3',area_id:22,name:'Nasr City Square',position:1,latitude:null as number|null,longitude:null as number|null}
 ];
 await page.route('https://photon.komoot.io/api/**',async route=>{
  const q=new URL(route.request().url()).searchParams.get('q')||'';
  const maadi=q.toLowerCase().includes('maadi');
  await route.fulfill({contentType:'application/json',body:JSON.stringify({features:[{
   geometry:{coordinates:maadi?[31.25,29.96]:[31.34,30.06]},
   properties:{osm_id:maadi?101:102,osm_type:'N',name:maadi?'Maadi Market':'Nasr City Square',
    city:'Cairo',countrycode:'EG'}
  }]})});
 });
 await page.route(endpoint+'/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const method=route.request().method();
  const body=method==='POST'&&route.request().postData()?route.request().postDataJSON():{};
  let result:unknown=[];
  if(path==='/auth/v1/user')result=user;
  else if(path==='/rest/v1/rpc/v31_is_admin')result=false;
  else if(path.startsWith('/rest/v1/v31_captain_profiles')){
   if(method!=='GET')enrolledAgain++;
   result={user_id:actor,approval_status:'approved'};
  }else if(path.startsWith('/rest/v1/v31_profiles'))
   result={user_id:actor,role_preference:'captain'};
  else if(path.startsWith('/rest/v1/v31_service_areas'))result=[
   {id:11,name_ar:'المعادي',name_en:'Maadi'},
   {id:22,name_ar:'مدينة نصر',name_en:'Nasr City'}
  ];
  else if(path.startsWith('/rest/v1/v31_vehicles'))result=[
   {id:vehicle,model:'Tipo',plate_number:'TEST-123',enabled_categories:['PRIME']}
  ];
  else if(path==='/rest/v1/rpc/v31_create_vehicle_route_draft'){
   created++;payload=body;
   result=routeId;
  }else if(path==='/rest/v1/rpc/v31_set_draft_stop_coordinates'){
   const row=savedStops.find(x=>x.id===(body as {p_stop:string}).p_stop);
   if(row){row.latitude=Number((body as {p_latitude:number}).p_latitude);
    row.longitude=Number((body as {p_longitude:number}).p_longitude);}
   result=(body as {p_stop:string}).p_stop;
  }else if(path.startsWith('/rest/v1/v31_routes'))result={
   id:routeId,status:'draft',vehicle_id:vehicle,category:'PRIME',seat_capacity:3,price_egp:1300
  };
  else if(path.startsWith('/rest/v1/v31_route_stops'))result=savedStops;
  await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/?tab=routes&view=43');
 const form=page.locator('.sekka-captain-route-wizard');
 await expect(form).toBeVisible();
 await expect(form.getByRole('heading',{name:'Create a route'})).toBeVisible();
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
 await expect(entry.getByRole('button',{name:'Add this stop'})).toBeDisabled();
 await entry.getByRole('combobox',{name:'Service area'}).selectOption('11');
 const place=entry.getByRole('combobox',{name:'Search street or landmark'});
 await place.fill('Maadi Market');
 await entry.getByRole('button',{name:'Find this street or place on the map'}).click();
 await entry.getByRole('button',{name:/Maadi Market/}).click();
 await entry.getByRole('button',{name:'Add this stop'}).click();
 await expect(entry.locator('.sekka-route-stop-list>li')).toHaveCount(1);
 await entry.getByRole('combobox',{name:'Service area'}).selectOption('22');
 await place.fill('Nasr City Square');
 await entry.getByRole('button',{name:'Find this street or place on the map'}).click();
 await entry.getByRole('button',{name:/Nasr City Square/}).click();
 await entry.getByRole('button',{name:'Add this stop'}).click();
 await expect(entry.locator('.sekka-route-stop-list>li')).toHaveCount(2);
 await expect(entry.getByText('Automatic route name:')).toContainText('Maadi Market ← Nasr City Square');
 const save=entry.getByRole('button',{name:'Save route draft'});
 const amount=entry.getByRole('spinbutton',{name:'Total vehicle price (EGP)'});
 await amount.fill('0');
 await expect(save).toBeDisabled();
 await amount.fill('1300');
 await expect(save).toBeEnabled();
 await save.click();
 await expect(entry.getByText(/Draft and stop coordinates verified/)).toBeVisible();
 expect(created).toBe(1);
 expect(payload).toMatchObject({
  p_title:'Maadi Market ← Nasr City Square',
  p_vehicle:vehicle,p_category:'PRIME',p_price:1300
 });
 expect((payload?.p_stops as Array<{name:string;area_id:number}>).map(x=>x.name))
  .toEqual(['Maadi Market','Nasr City Square']);
 expect(savedStops.every(x=>x.latitude!==null&&x.longitude!==null)).toBe(true);
 expect(enrolledAgain).toBe(0);
});
