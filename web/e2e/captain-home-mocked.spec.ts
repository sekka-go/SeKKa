import {test,expect} from '@playwright/test';

const endpoint='https://sekka-auth-e2e.supabase.co';
const user={
 id:'00000000-0000-4000-8000-0000000000c1',
 aud:'authenticated',role:'authenticated',
 email:'captain-home@example.test',
 app_metadata:{provider:'google',providers:['google']},
 user_metadata:{full_name:'Captain'},
 created_at:'2026-01-01T00:00:00Z',
 email_confirmed_at:'2026-01-01T00:00:00Z'
};
for(const width of [360,390]){
 test('MOCKED Captain home visual structure and zero-state at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:800});
  await page.addInitScript(({endpoint,user})=>{
   const k='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
   localStorage.setItem(k,JSON.stringify({
    access_token:'fixture-header.fixture-payload.fixture-signature',
    refresh_token:'fixture-refresh',token_type:'bearer',
    expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
   }));
   localStorage.setItem('language_preference','ar');
   localStorage.setItem('theme_preference','light');
  },{endpoint,user});
  await page.route(endpoint+'/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const method=route.request().method();
   const accept=route.request().headers()['accept']||'';
   let result:unknown=[];
   if(path==='/auth/v1/user')result=user;
   else if(path==='/rest/v1/rpc/v31_is_admin')result=false;
   else if(path.startsWith('/rest/v1/v31_captain_profiles'))
    result={user_id:user.id,approval_status:'approved'};
   else if(path.startsWith('/rest/v1/v31_profiles'))
    result={user_id:user.id,role_preference:'captain'};
   else if(path.startsWith('/rest/v1/v31_service_areas'))result=[
    {id:11,name_ar:'المعادي',name_en:'Maadi'}
   ];
   else if(path.startsWith('/rest/v1/v31_routes')){
    if(accept.includes('object+json'))result=null;
    else result=[];
   }
   else if(path.startsWith('/rest/v1/v31_vehicles'))result=[];
   await route.fulfill({contentType:'application/json',body:JSON.stringify(result),
    headers:path.startsWith('/rest/v1/v31_routes')?{'content-range':'0-0/0'}:{}});
  });
  await page.goto('/?tab=routes&view=42');
  const home=page.locator('.cj-home');
  await expect(home).toBeVisible();
  await expect(home.getByRole('heading',{name:/مرحبًا بك/})).toBeVisible();
  await expect(home).toContainText('أنشئ رحلتك وحقق دخل ثابت طول الشهر');
  await expect(home.locator('.cj-home-how-step')).toHaveCount(3);
  await expect(home.getByRole('button',{name:/إنشاء رحلة جديدة/})).toBeVisible();
  await expect(home.locator('.cj-home-metric')).toHaveCount(3);
  await expect(home.locator('.cj-home-metric').first()).toContainText('5.0');
  await expect(home.locator('.cj-home-metric').nth(1)).toContainText('٠');
  await expect(home.locator('.cj-home-metric').nth(2)).toContainText('٠');
  await expect(page.locator('.sekka-captain-header')).toBeVisible();
  const menu=page.getByRole('button',{name:'فتح القائمة'});
  await expect(menu).toBeVisible();
  await menu.click();
  const drawer=page.getByRole('dialog',{name:'القائمة الرئيسية'});
  await expect(drawer.getByRole('button',{name:'خطوطي'})).toBeVisible();
  await expect(drawer.getByRole('button',{name:'تغيير المظهر'})).toBeVisible();
  await drawer.getByRole('button',{name:'إغلاق القائمة'}).click();
  await expect(menu).toBeFocused();
  await expect(page.locator('.sekka-bottom-nav')).toBeHidden();
  await expect(page.locator('.cj-home-driver')).toHaveAttribute('src',/^data:image\/webp;base64,/);
  const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,
   client:document.documentElement.clientWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client+2);
  await home.getByRole('button',{name:/إنشاء رحلة جديدة/}).click();
  await expect(page).toHaveURL(/tab=routes&view=43/);
 });
}
