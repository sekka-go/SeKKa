import {test,expect} from '@playwright/test';

const endpoint='https://sekka-auth-e2e.supabase.co';
const actor='00000000-0000-4000-8000-0000000000c1';
const vehicle='00000000-0000-4000-8000-0000000000e1';
const user={id:actor,aud:'authenticated',role:'authenticated',
 email:'approved.captain@example.test',
 app_metadata:{provider:'google',providers:['google']},
 user_metadata:{full_name:'Captain Test Account'},
 created_at:'2026-01-01T00:00:00Z',
 email_confirmed_at:'2026-01-01T00:00:00Z'};
test('MOCKED: already-published vehicle is blocked before price, existing route remains available',async({page})=>{
 let booked=2;
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(({endpoint,user})=>{
  const key='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
  localStorage.setItem(key,JSON.stringify({access_token:'fixture-header.fixture-payload.fixture-signature',
   refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,
   expires_at:Math.floor(Date.now()/1000)+3600,user}));
  localStorage.setItem('language_preference','en');
  localStorage.setItem('theme_preference','light');
 },{endpoint,user});
 await page.route('https://photon.komoot.io/api/**',async route=>{
  const q=(new URL(route.request().url()).searchParams.get('q')||'').toLowerCase();
  const maadi=q.includes('maadi');
  await route.fulfill({contentType:'application/json',body:JSON.stringify({features:[{
   geometry:{coordinates:maadi?[31.25,29.96]:[31.34,30.06]},
   properties:{osm_id:maadi?401:402,osm_type:'N',
    name:maadi?'Maadi Grand Mall':'Nasr City Square',
    district:maadi?'Maadi':'Nasr City',city:'Cairo',countrycode:'EG'}
  }]})});
 });
 await page.route(endpoint+'/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const accept=route.request().headers()['accept']||'';
  let result:unknown=[];
  if(path==='/auth/v1/user')result=user;
  else if(path==='/rest/v1/rpc/v31_is_admin')result=false;
  else if(path==='/rest/v1/rpc/v31_captain_private_prices')
   result=[{route_id:'00000000-0000-4000-8000-0000000000d5',price_egp:1300}];
  else if(path==='/rest/v1/rpc/v31_captain_route_capacity_summary')
   result=[{route_id:'00000000-0000-4000-8000-0000000000d5',
    capacity:3,booked,remaining:3-booked,is_full:booked===3}];
  else if(path.startsWith('/rest/v1/v31_captain_profiles'))
   result={user_id:actor,approval_status:'approved'};
  else if(path.startsWith('/rest/v1/v31_profiles'))
   result={user_id:actor,role_preference:'captain'};
  else if(path.startsWith('/rest/v1/v31_service_areas'))
   result=[{id:11,name_ar:'المعادي',name_en:'Maadi'},
    {id:22,name_ar:'مدينة نصر',name_en:'Nasr City'}];
  else if(path.startsWith('/rest/v1/v31_vehicles'))
   result=[{id:vehicle,model:'Tipo',plate_number:'TEST-123',enabled_categories:['PRIME']}];
  else if(path.startsWith('/rest/v1/v31_routes')){
   const row={id:'00000000-0000-4000-8000-0000000000d5',captain_id:actor,vehicle_id:vehicle,
    title:'Current published service',status:'published',category:'PRIME',
    price_egp:1300,seat_capacity:3};
   result=accept.includes('object+json')?row:[row];
  }
  await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.route('https://www.openstreetmap.org/export/embed.html?*',route=>route.fulfill({body:'Map frame fixture'}));
 await page.goto('/?tab=routes&view=43');
 const form=page.locator('.sekka-captain-route-wizard');
 await expect(form).toBeVisible();
 await form.getByRole('button',{name:'Maadi'}).click();
 await form.getByRole('button',{name:'Find Maadi Grand Mall'}).click();
 await expect(form.locator('.cj-easy-selected-stops>li')).toHaveCount(0);
 await form.locator('.cj-easy-results').getByRole('option',{name:/Maadi Grand Mall/}).click();
 await expect(form.locator('.cj-easy-selected-stops>li')).toHaveCount(1);
 await form.getByRole('button',{name:'Nasr City'}).click();
 await form.getByRole('combobox',{name:'Search street or landmark'}).fill('Nasr City Square');
 await form.getByRole('button',{name:'Find',exact:true}).click();
 await form.locator('.cj-easy-results').getByRole('option',{name:/Nasr City Square/}).click();
 await form.getByRole('button',{name:'Continue'}).click();
 await expect(form.getByRole('combobox',{name:'Approved vehicle'})).toBeVisible();
 await expect(form.getByText(/already has a published or paused route/)).toBeVisible();
 await expect(form.getByRole('button',{name:'Continue'})).toBeDisabled();
 await form.getByRole('button',{name:'Open My routes'}).click();
 await expect(page).toHaveURL(/tab=routes&view=44/);
 await expect(page.getByText('Current published service').first()).toBeVisible();
 await expect(page.locator('.cj-progress-note')).toContainText('Seats remaining');
 await expect(page.locator('.cj-progress-note')).toContainText('1');
 booked=3;
 await page.reload();
 await expect(page.getByText('Current published service').first()).toBeVisible();
 await expect(page.getByText(/Capacity reached/)).toBeVisible();
 await expect(page.locator('.cj-progress-note')).toHaveCount(0);
});
