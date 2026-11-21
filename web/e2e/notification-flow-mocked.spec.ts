import {test,expect} from '@playwright/test';

// Mock-only navigation evidence; no live accounts or real bookings are touched.
const endpoint='https://sekka-auth-e2e.supabase.co';
const user={
 id:'00000000-0000-4000-8000-0000000000f4',aud:'authenticated',
 role:'authenticated',email:'rider-flow@example.test',
 email_confirmed_at:'2026-11-21T00:00:00Z',created_at:'2026-11-21T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},
 user_metadata:{full_name:'Flow Rider'}
};
for(const language of ['ar','en'] as const){
 test('Rider notification always opens Rider bookings and returns to the same screen '+language,async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.addInitScript(({user,language,endpoint})=>{
   const key='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
   localStorage.setItem(key,JSON.stringify({
    access_token:'fixture.header.signature',refresh_token:'fixture-refresh',
    token_type:'bearer',expires_in:3600,
    expires_at:Math.floor(Date.now()/1000)+3600,user
   }));
   localStorage.setItem('language_preference',language);
   localStorage.setItem('theme_preference','light');
  },{user,language,endpoint});
  await page.route(endpoint+'/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   let data:unknown=[];
   if(path==='/auth/v1/user')data=user;
   else if(path.startsWith('/rest/v1/v31_captain_profiles'))data=null;
   else if(path==='/rest/v1/rpc/v31_is_admin')data=false;
   else if(path.startsWith('/rest/v1/v31_profiles'))data={
    user_id:user.id,role_preference:'rider',display_name:'Flow Rider',phone_number:null};
   else if(path.startsWith('/rest/v1/v31_notifications'))data=[{
    id:'77777777-7777-4777-8777-777777777777',
    kind:'route_capacity_full',message_ar:'اكتملت المقاعد في الرحلة',
    message_en:'The ride is now full',read_at:null,
    created_at:'2026-11-21T12:00:00Z'
   }];
   else if(path.startsWith('/rest/v1/v31_bookings'))data=[];
   else if(path.startsWith('/rest/v1/v31_service_areas'))data=[];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const t=(ar:string,en:string)=>language==='ar'?ar:en;
  await page.goto('/?tab=profile');
  await expect(page.locator('.live-profile')).toBeVisible();
  await expect(page.locator('.sekka-session-loader')).toHaveCount(0);
  await page.getByRole('button',{name:t('فتح القائمة','Open menu')}).click();
  await page.getByRole('dialog',{name:t('القائمة الرئيسية','Main menu')})
   .getByRole('button',{name:t('الإشعارات','Notifications')}).click();
  await expect(page).toHaveURL(/tab=notifications/);
  await expect(page.locator('.live-notifications li')).toHaveCount(1);
  await expect(page.locator('.rh-tabs')).toBeVisible();
  await page.getByRole('button',{name:t('رجوع للصفحة السابقة','Back to previous page')}).click();
  await expect(page).toHaveURL(/tab=profile/);
  await expect(page.locator('.live-profile')).toBeVisible();
  await page.getByRole('button',{name:t('فتح القائمة','Open menu')}).click();
  await page.getByRole('dialog',{name:t('القائمة الرئيسية','Main menu')})
   .getByRole('button',{name:t('الإشعارات','Notifications')}).click();
  await page.getByRole('button',{name:t('افتح رحلاتي','Open My rides')}).click();
  await expect(page).toHaveURL(/tab=bookings/);
  await expect(page).not.toHaveURL(/tab=routes|tab=admin/);
  await expect(page.locator('.rb3')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth))
   .toBeLessThanOrEqual(361);
 });
}
