import {test,expect} from '@playwright/test';

const endpoint='https://sekka-auth-e2e.supabase.co';
const userId='00000000-0000-4000-8000-0000000000b1';
const user={
 id:userId,aud:'authenticated',role:'authenticated',email:'captain-fixture@example.test',
 email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},
 user_metadata:{full_name:'Captain Fixture'}
};

test('explicit Captain selection survives route history and prepares its own OAuth return path',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
  localStorage.setItem('language_preference','en');
  localStorage.setItem('theme_preference','light');
 });
 await page.goto('/');
 await page.locator('.phase-screen-2 .phase-start').click();
 const captain=page.getByRole('radio',{name:/Captain/});
 await captain.click();
 await page.locator('.phase-screen-3 .phase-role-next').click();
 await expect(page).toHaveURL(/tab=login&view=4/);
 expect(await page.evaluate(()=>sessionStorage.getItem('sekka.pendingRole'))).toBe('captain');
 expect(await page.evaluate(()=>sessionStorage.getItem('sekka.postAuthPath')))
  .toBe('/?tab=captain-onboarding&view=35');

 await page.goBack();
 await expect(page).toHaveURL(/tab=login&view=3/);
 await expect(page.getByRole('radio',{name:/Captain/})).toHaveAttribute('aria-checked','true');
 await page.goForward();
 await expect(page).toHaveURL(/tab=login&view=4/);
});

test('direct profile-completion links require Google authentication first',async({page})=>{
 await page.goto('/?tab=login&view=6');
 await expect(page.locator('.phase-google-auth')).toBeVisible();
 await expect(page).toHaveURL(/tab=login&view=4/);
});

test('guest account prerequisites preserve the actual Google return destination',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('language_preference','en'));
 const cases=[
  {tab:'bookings',button:'Sign in',returnPath:'/?tab=bookings'},
  {tab:'notifications',button:'Sign in',returnPath:'/?tab=notifications'},
  {tab:'profile',button:'Sign in with Google',returnPath:'/?tab=login&view=6'}
 ] as const;
 for(const item of cases){
  await page.goto('/?tab='+item.tab);
  await page.getByRole('button',{name:item.button,exact:true}).click();
  await expect(page).toHaveURL(/tab=login&view=4/);
  expect(await page.evaluate(()=>sessionStorage.getItem('sekka.pendingRole'))).toBe('rider');
  expect(await page.evaluate(()=>sessionStorage.getItem('sekka.postAuthPath'))).toBe(item.returnPath);
 }
});

test('cancelled Google OAuth on guest Bookings preserves return path and permits retry',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('language_preference','en'));
 await page.goto('/?tab=bookings&error=access_denied&error_description=provider-private-detail&oauth_role=rider');
 await expect(page).toHaveURL(/tab=login&view=4/);
 await expect(page.getByRole('alert')).toContainText('Google sign-in did not complete');
 expect(await page.evaluate(()=>sessionStorage.getItem('sekka.pendingRole'))).toBe('rider');
 expect(await page.evaluate(()=>sessionStorage.getItem('sekka.postAuthPath'))).toBe('/?tab=bookings');
 await expect(page).not.toHaveURL(/access_denied|provider-private-detail/);
 await expect(page.getByRole('button',{name:'Continue with Google'})).toBeVisible();
});

test('cancelled Google OAuth preserves exact booking stop selection',async({page})=>{
 const original='/?tab=booking&route=route-a&pickup=pickup-a&dropoff=dropoff-b&reverse=1';
 await page.goto(original+'&error=access_denied&oauth_role=rider');
 await expect(page).toHaveURL(/tab=login&view=4/);
 expect(await page.evaluate(()=>sessionStorage.getItem('sekka.postAuthPath'))).toBe(original);
 await expect(page).not.toHaveURL(/access_denied/);
});

for(const [width,height] of [[320,700],[360,800],[390,844],[412,915]] as const){
test(`pending Captain profile stays in Passenger journey until explicit entry at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height});
 await page.addInitScript(({endpoint,user})=>{
  const storage='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
  localStorage.setItem(storage,JSON.stringify({
   access_token:'fixture-header.fixture-payload.fixture-signature',
   refresh_token:'local-fixture-refresh',token_type:'bearer',
   expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
  }));
  if(!localStorage.getItem('language_preference'))localStorage.setItem('language_preference','en');
  if(!localStorage.getItem('theme_preference'))localStorage.setItem('theme_preference','light');
 },{endpoint,user});
 let hasApplication=false;
 let validApplication=false;
 await page.route(endpoint+'/**',async request=>{
  const url=new URL(request.request().url());
  const path=url.pathname;
  let result:unknown=[];
  if(path==='/auth/v1/user')result=user;
  else if(path==='/rest/v1/rpc/v31_is_admin')result=false;
  else if(path.startsWith('/rest/v1/v31_captain_profiles'))
   result={user_id:userId,approval_status:'pending'};
  else if(path.startsWith('/rest/v1/v31_captain_applications'))result=hasApplication?{
   user_id:userId,status:'draft',full_name:validApplication?'مونا حسن علي':'Captain Fixture',phone_number:'01012345678',
   professional_notes:validApplication?'Professional driver committed to safe passenger transport':'Safe travel',experience_years:0,rejection_reason:null,
   vehicle_type:'private_car',vehicle_make_id:1,vehicle_model_id:1,
   manufacture_year:2020,vehicle_color_code:'white',vehicle_color_other:null,
   intended_plate:validApplication?'أبج123':'ABC123',
   submitted_at:null,reviewed_at:null
  }:null;
  else if(path.startsWith('/rest/v1/v31_vehicle_makes'))
   result=[{id:1,name_ar:'تويوتا',name_en:'Toyota',active:true}];
  else if(path.startsWith('/rest/v1/v31_vehicle_models'))
   result=[{id:1,make_id:1,name_ar:'كورولا',name_en:'Corolla',active:true}];
  else if(path.startsWith('/rest/v1/v31_vehicle_colors'))
   result=[{code:'white',name_ar:'أبيض',name_en:'White'}];
  await request.fulfill({contentType:'application/json',body:JSON.stringify(result)});
 });

 await page.goto('/');
 await expect(page.locator('.d-screen-8')).toBeVisible();
 await expect(page).not.toHaveURL(/tab=captain-onboarding|tab=routes/);
 await page.screenshot({path:`test-results/mock-pending-captain-passenger-home-${width}.png`,fullPage:true,animations:'disabled'});
 await expect(page.getByRole('button',{name:'Bookings'})).toBeVisible();
 await expect(page.locator('.sekka-bottom-nav').getByRole('button',{name:'Routes'})).toHaveCount(0);

 await page.getByRole('button',{name:'Account'}).click();
 await page.getByRole('button',{name:'Enter Captain journey'}).click();
 await expect(page).toHaveURL(/tab=captain-onboarding&view=35/);
 await expect(page.locator('.c-approval-live')).toBeVisible();
 await expect(page.getByRole('button',{name:'Start registration'})).toBeVisible();
 await expect(page.locator('.captain-onboarding-header')).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Enrollment steps'})).toHaveCount(0);
 await page.screenshot({path:`test-results/mock-captain-enrollment-start-${width}.png`,fullPage:true,animations:'disabled'});

 await page.reload();
 await expect(page).toHaveURL(/tab=captain-onboarding&view=35/);
 await expect(page.locator('.c-approval-live')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 const logo=await page.locator('.captain-onboarding-header .phase-wordmark').boundingBox();
 expect(logo).not.toBeNull();
 expect(logo!.width).toBeLessThanOrEqual(width*.32+1);

 await page.goto('/?tab=captain-onboarding&view=38');
 await expect(page.getByText('Start your registration before opening this step.')).toBeVisible();
 await expect(page.locator('.c-file-picker')).toHaveCount(0);
 hasApplication=true;
 await page.goto('/?tab=captain-onboarding&view=38');
 // A saved old draft does NOT bypass newly required name/experience/plate rules.
 await expect(page.getByText('Complete the required personal details first.')).toBeVisible();
 await expect(page.locator('.c-file-picker')).toHaveCount(0);
 validApplication=true;
 await page.goto('/?tab=captain-onboarding&view=38');
 const picker=page.locator('.c-file-picker').first();
 await expect(picker.locator('.c-file-picker-button')).toHaveText('Choose file');
 await expect(picker.locator('.c-file-picker-name')).toHaveText('Tap to select a file');
 await expect(picker.locator('input[type=file]')).toHaveAttribute('aria-label','Identity proof');

 await page.evaluate(()=>localStorage.setItem('language_preference','ar'));
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('.c-file-picker').first().locator('.c-file-picker-button')).toHaveText('اختيار ملف');
 await expect(page.locator('.c-file-picker').first().locator('.c-file-picker-name')).toHaveText('اضغط لاختيار ملف');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 await page.screenshot({path:`test-results/mock-captain-document-upload-ar-${width}.png`,fullPage:true,animations:'disabled'});
});
}
