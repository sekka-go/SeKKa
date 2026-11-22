import {test,expect} from '@playwright/test';

const endpoint='https://sekka-auth-e2e.supabase.co';
const actor='00000000-0000-4000-8000-0000000000c1';
const draftId='00000000-0000-4000-8000-0000000000d1';
const publishedId='00000000-0000-4000-8000-0000000000d2';
const user={id:actor,aud:'authenticated',role:'authenticated',
 email:'approved.captain@example.test',
 app_metadata:{provider:'google',providers:['google']},user_metadata:{full_name:'Captain Test'},
 created_at:'2026-01-01T00:00:00Z',email_confirmed_at:'2026-01-01T00:00:00Z'};
type MockRoute={id:string;captain_id:string;title:string;status:string;seat_capacity:number;category:string;
 direction:string;period:string;outbound_time:string|null;return_time:string|null};
const routesFixture=():MockRoute[]=>[
 {id:draftId,captain_id:actor,title:'Unused draft',status:'draft',seat_capacity:3,
 category:'PRIME',direction:'outbound',period:'monthly',outbound_time:'07:30',return_time:null},
 {id:publishedId,captain_id:actor,title:'Published commute',status:'published',seat_capacity:3,
 category:'PRIME',direction:'outbound',period:'monthly',outbound_time:'07:30',return_time:null}
];
async function setup(page:import('@playwright/test').Page,booked:number){
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(({endpoint,user})=>{
  const key='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
  localStorage.setItem(key,JSON.stringify({
   access_token:'fixture-header.fixture-payload.fixture-signature',refresh_token:'fixture-refresh',
   token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
  }));
  localStorage.setItem('language_preference','en');
  localStorage.setItem('theme_preference','light');
 },{endpoint,user});
 let rows=routesFixture();
 let removalCalls=0;
 await page.route(endpoint+'/**',async request=>{
  const url=new URL(request.request().url()),path=url.pathname;
  const accept=request.request().headers()['accept']||'';
  const json=request.request().method()==='POST'?request.request().postDataJSON()||{}:{};
  let data:unknown=[];
  if(path==='/auth/v1/user')data=user;
  else if(path==='/rest/v1/rpc/v31_is_admin')data=false;
  else if(path==='/rest/v1/rpc/v31_captain_private_prices')
   data=rows.map(r=>({route_id:r.id,price_egp:1300}));
  else if(path==='/rest/v1/rpc/v31_captain_route_capacity_summary')
   data=rows.map(r=>({route_id:r.id,capacity:3,booked:r.status==='draft'?0:booked,
     remaining:r.status==='draft'?3:3-booked,is_full:false}));
  else if(path==='/rest/v1/rpc/v31_remove_captain_route'){
   removalCalls++;
   const chosen=rows.find(r=>r.id===json.p_route);
   if(chosen?.status==='draft'){rows=rows.filter(r=>r.id!==chosen.id);data='deleted';}
   else if(chosen?.status==='published'&&booked===0){chosen.status='archived';data='archived';}
   else {await request.fulfill({status:400,contentType:'application/json',
    body:JSON.stringify({message:'ACTIVE_BOOKINGS_PREVENT_ARCHIVE'})});return;}
  }else if(path.startsWith('/rest/v1/v31_captain_profiles'))data={user_id:actor,approval_status:'approved'};
  else if(path.startsWith('/rest/v1/v31_profiles'))data={user_id:actor,role_preference:'captain'};
  else if(path.startsWith('/rest/v1/v31_routes')){
   const id=url.searchParams.get('id')?.replace(/^eq\./,'');
   const isArchived=url.searchParams.get('status')==='eq.archived';
   const filtered=rows.filter(r=>(!id||r.id===id)&&
    (id|| (isArchived?r.status==='archived':r.status!=='archived')));
   data=accept.includes('object+json')?filtered[0]??null:filtered;
  }else if(path.startsWith('/rest/v1/v31_route_stops'))data=[];
  else if(path.startsWith('/rest/v1/v31_notifications'))data=[];
  await request.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('/?tab=routes&view=44');
 await expect(page.getByRole('heading',{name:'My trips'})).toBeVisible();
 await expect(page.getByText('Unused draft',{exact:true})).toBeVisible();
 await expect(page.getByText('Published commute',{exact:true})).toBeVisible();
 return {getCalls:()=>removalCalls};
}
test('Captain deletes only an unused draft after explicit confirmation',async({page})=>{
 const state=await setup(page,0);
 const card=page.locator('.live-route-list>ul>li').filter({hasText:'Unused draft'});
 await card.getByRole('button',{name:'Delete draft',exact:true}).click();
 await expect(card.getByText(/permanently deleted/)).toBeVisible();
 await expect(state.getCalls()).toBe(0);
 await card.getByRole('button',{name:'Keep trip'}).click();
 await expect(card.getByText(/permanently deleted/)).toHaveCount(0);
 await card.getByRole('button',{name:'Delete draft',exact:true}).click();
 await card.getByRole('button',{name:'Delete draft permanently'}).click();
 await expect(page.getByText('Draft deleted.')).toBeVisible();
 await expect(card).toHaveCount(0);
 expect(state.getCalls()).toBe(1);
});
test('Published trip with no bookings is archived, hidden from current routes, and retrievable',async({page})=>{
 const state=await setup(page,0);
 const card=page.locator('.live-route-list>ul>li').filter({hasText:'Published commute'});
 await card.getByRole('button',{name:'Remove trip'}).click();
 await expect(card.getByText(/will archive the trip/)).toBeVisible();
 await card.getByRole('button',{name:'Confirm archive'}).click();
 await expect(page.getByText(/Trip moved from active routes/)).toBeVisible();
 await expect(card).toHaveCount(0);
 expect(state.getCalls()).toBe(1);
 await page.getByRole('button',{name:'Archive',exact:true}).click();
 await expect(page.getByText('Published commute',{exact:true})).toBeVisible();
 await expect(page.getByText('Archived',{exact:true})).toBeVisible();
});
test('Trip with active bookings cannot be deleted or archived from Captain UI',async({page})=>{
 const state=await setup(page,2);
 const card=page.locator('.live-route-list>ul>li').filter({hasText:'Published commute'});
 await card.getByRole('button',{name:'Remove trip'}).click();
 await expect(card.getByRole('status')).toHaveText('This trip has active bookings. Pause it instead of removing it.');
 await expect(card.getByRole('button',{name:'Confirm archive'})).toBeDisabled();
 expect(state.getCalls()).toBe(0);
 await expect(page.getByText('Published commute',{exact:true})).toBeVisible();
});
