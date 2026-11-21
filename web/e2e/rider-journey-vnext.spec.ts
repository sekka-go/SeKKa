import {test,expect} from '@playwright/test';
const endpoint='https://sekka-auth-e2e.supabase.co';
const riderId='00000000-0000-4000-8000-0000000000b2';
const user={id:riderId,aud:'authenticated',role:'authenticated',email:'rider-fixture@example.test',
 email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},user_metadata:{full_name:'Rider Fixture'}};
const commute={origin:'المعادي',destination:'التجمع',originPlace:null,destinationPlace:null,
 outbound:'07:30',returnTime:'17:00',period:'monthly',direction:'outbound',
 savedAt:'2026-11-21T00:00:00.000Z'};
for(const width of [320,390]){
 test('returning verified Rider can repeat a real saved commute with one tap at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:width===320?700:844});
  await page.addInitScript(({endpoint,user,commute})=>{
   const id=new URL(endpoint).hostname.split('.')[0];
   localStorage.setItem('sb-'+id+'-auth-token',JSON.stringify({
    access_token:'fixture-header.fixture-payload.fixture-signature',refresh_token:'local-fixture',
    token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}));
   localStorage.setItem('sekka.rider.recurringCommute.v1.'+user.id,JSON.stringify(commute));
   localStorage.setItem('language_preference','en');
   localStorage.setItem('theme_preference','light');
  },{endpoint,user,commute});
  let searchCount=0;
  await page.route(endpoint+'/**',async req=>{
   const path=new URL(req.request().url()).pathname;
   let data:unknown=[];
   if(path==='/auth/v1/user')data=user;
   else if(path.startsWith('/rest/v1/v31_profiles'))data={user_id:riderId,role_preference:'rider',display_name:'Rider Fixture'};
   else if(path.startsWith('/rest/v1/v31_captain_profiles'))data=null;
   else if(path==='/rest/v1/rpc/v31_is_admin')data=false;
   else if(path.startsWith('/rest/v1/v31_service_areas'))data=[
     {id:1,name_ar:'المعادي',name_en:'Maadi'},
     {id:2,name_ar:'التجمع',name_en:'New Cairo'}];
   else if(path==='/rest/v1/rpc/v31_search_published_routes'){
    searchCount++;
    const args=req.request().postDataJSON();
    expect(args.p_origin_area).toBe('المعادي');
    expect(args.p_destination_area).toBe('التجمع');
    data=[];
   }
   await req.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/');
  await expect(page.locator('.sekka-rider-home')).toBeVisible();
  await expect(page.getByRole('button',{name:/Find rides on my route/})).toBeVisible();
  await page.getByRole('button',{name:/Find rides on my route/}).click();
  await expect(page).toHaveURL(/tab=search&view=11/);
  await expect(page.locator('.sekka-no-match')).toBeVisible();
  expect(searchCount).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  await expect(page.getByText(/Booking confirmed|تم الحجز بنجاح/)).toHaveCount(0);
 });
}
