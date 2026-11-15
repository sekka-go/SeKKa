import {test,expect} from '@playwright/test';

const endpoint='https://sekka-navigation-e2e.supabase.co';
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
 await page.route(endpoint+'/**',async request=>{
  const url=new URL(request.request().url());
  const path=url.pathname;
  let result:unknown=[];
  if(path==='/auth/v1/user')result=user;
  else if(path==='/rest/v1/rpc/v31_is_admin')result=false;
  else if(path.startsWith('/rest/v1/v31_captain_profiles'))
   result={user_id:userId,approval_status:'pending'};
  else if(path.startsWith('/rest/v1/v31_captain_applications'))result=hasApplication?{
   user_id:userId,status:'draft',professional_notes:'',experience_years:null,rejection_reason:null,
   intended_vehicle_model:'',intended_category:'PRIME',intended_seats:3,intended_plate:'',
   submitted_at:null,reviewed_at:null
  }:null;
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
 await expect(page.getByRole('button',{name:'Start enrollment'})).toBeVisible();
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
 await expect(page.getByText('Start Captain enrollment before opening this step.')).toBeVisible();
 await expect(page.locator('.c-file-picker')).toHaveCount(0);
 hasApplication=true;
 await page.goto('/?tab=captain-onboarding&view=38');
 const picker=page.locator('.c-file-picker').first();
 await expect(picker.locator('.c-file-picker-button')).toHaveText('Choose file');
 await expect(picker.locator('.c-file-picker-name')).toHaveText('No file selected');
 await expect(picker.locator('input[type=file]')).toHaveAttribute('aria-label','Identity');

 await page.evaluate(()=>localStorage.setItem('language_preference','ar'));
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('.c-file-picker').first().locator('.c-file-picker-button')).toHaveText('اختيار ملف');
 await expect(page.locator('.c-file-picker').first().locator('.c-file-picker-name')).toHaveText('لم يتم اختيار ملف');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 await page.screenshot({path:`test-results/mock-captain-document-upload-ar-${width}.png`,fullPage:true,animations:'disabled'});
});
}
