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

for(const width of [320,360,390,412]){
 test('drawer globe switches Arabic and English without changing theme at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:width===320?700:844});
  await page.goto('/?tab=profile');
  await page.evaluate(()=>{
   localStorage.setItem('language_preference','ar');
   localStorage.setItem('theme_preference','dark');
  });
  await page.reload();
  const trigger=page.getByRole('button',{name:'فتح القائمة'});
  await trigger.click();
  const drawer=page.getByRole('dialog',{name:'القائمة الرئيسية'});
  const toggle=drawer.locator('.sekka-language');
  await expect(toggle).toHaveAttribute('aria-label','التبديل إلى الإنجليزية');
  await expect(toggle.locator('.sekka-drawer-pref-icon')).toHaveText('🌐');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.evaluate(()=>localStorage.getItem('language_preference'))).toBe('en');
  // Language switches can recreate the drawer. Reopen it via the current
  // language's button rather than retaining a stale dialog locator.
  const closeAfterChange=page.getByRole('button',{name:'Close menu'});
  if(await closeAfterChange.count())await closeAfterChange.last().click();
  await expect(page.getByRole('heading',{name:'My profile'})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Open menu'}).click();
  await expect(page.getByRole('dialog',{name:'Main menu'}).locator('.sekka-language')).toHaveAttribute('aria-label','Switch to Arabic');
  await page.getByRole('dialog',{name:'Main menu'}).locator('.sekka-language').click();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 });
}

for(const language of ['ar','en'] as const){
 for(const width of [320,360,390,412]){
  test('single drawer menu occupies physical left; header no duplicate logo '+width+'px '+language,async({page})=>{
   await page.setViewportSize({width,height:width===320?700:844});
   await page.addInitScript(language=>{
    localStorage.setItem('language_preference',language);
    localStorage.setItem('theme_preference','light');
   },language);
   await page.goto('/?tab=profile');
   await expect(page.locator('.sekka-mobile-header .sekka-approved-logo')).toHaveCount(0);
   await expect(page.locator('.sekka-bottom-nav')).toHaveCount(0);
   const trigger=page.getByRole('button',{name:language==='ar'?'فتح القائمة':'Open menu'});
   const b=await trigger.boundingBox();
   expect(b).not.toBeNull();
   expect(b!.width).toBeGreaterThanOrEqual(44);
   expect(b!.x+b!.width/2).toBeLessThan(width/2);
   await trigger.click();
   const drawer=page.getByRole('dialog',{name:language==='ar'?'القائمة الرئيسية':'Main menu'});
   await expect(drawer.locator('.sekka-language')).toBeVisible();
   await expect(drawer.locator('.sekka-theme')).toBeVisible();
   for(const pref of [drawer.locator('.sekka-language'),drawer.locator('.sekka-theme')]){
    const rect=await pref.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.height).toBeGreaterThanOrEqual(44);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  });
 }
}

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
 await expect(page.getByRole('button',{name:'Open menu'})).toBeVisible();
 await expect(page.locator('.sekka-bottom-nav')).toHaveCount(0);
 await page.getByRole('button',{name:'Open menu'}).click();
 const leftDrawer=page.getByRole('dialog',{name:'Main menu'});
 await expect(leftDrawer.getByRole('button',{name:'My bookings'})).toBeVisible();
 await expect(leftDrawer.getByRole('button',{name:'My routes'})).toHaveCount(0);
 await leftDrawer.getByRole('button',{name:'My profile'}).click();
 await page.getByRole('button',{name:'Continue Captain application'}).click();
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
 // The native Android file control replaced the old hidden 1px proxy button.
 // Assert an operable accessible input instead of its removed decoration.
 const nativeFile=picker.locator('input[type=file]');
 await expect(nativeFile).toBeVisible();
 await expect(nativeFile).toBeEnabled();
 await expect(nativeFile).toHaveAttribute('aria-label','Choose file for Identity proof');
 await expect(nativeFile).toHaveAttribute('accept',/image\/jpeg/);
 await expect(picker.locator('.c-file-picker-name')).toHaveText('Choose a JPG, PNG or PDF from your device');
 await expect(picker.locator('.c-file-picker-button')).toHaveCount(0);

 await page.evaluate(()=>localStorage.setItem('language_preference','ar'));
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 const arabicPicker=page.locator('.c-file-picker').first();
 await expect(arabicPicker.locator('input[type=file]')).toBeVisible();
 await expect(arabicPicker.locator('input[type=file]')).toHaveAttribute('aria-label','اختيار ملف إثبات الهوية');
 await expect(arabicPicker.locator('.c-file-picker-name')).toHaveText('اختار صورة JPG أو PNG أو PDF من جهازك');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
 await page.screenshot({path:`test-results/mock-captain-document-upload-ar-${width}.png`,fullPage:true,animations:'disabled'});
});
}

for(const language of ['ar','en'] as const){
 test('authenticated Rider cannot enroll as Captain via menu, profile, or direct link '+language,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(({endpoint,user,language})=>{
   const key='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
   localStorage.setItem(key,JSON.stringify({
    access_token:'fixture-header.fixture-payload.fixture-signature',
    refresh_token:'local-fixture-refresh',token_type:'bearer',
    expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
   }));
   localStorage.setItem('language_preference',language);
   localStorage.setItem('theme_preference','light');
  },{endpoint,user,language});
  let captainWrites=0;
  let legacyCaptainProfile=false;
  await page.route(endpoint+'/**',async request=>{
   const pathname=new URL(request.request().url()).pathname;
   let result:unknown=[];
   if(pathname==='/auth/v1/user')result=user;
   else if(pathname==='/rest/v1/rpc/v31_is_admin')result=false;
   else if(pathname.startsWith('/rest/v1/v31_captain_profiles')){
    if(request.request().method()!=='GET')captainWrites++;
    result=legacyCaptainProfile?{user_id:userId,approval_status:'pending'}:null;
   }
   else if(pathname.startsWith('/rest/v1/v31_profiles'))
    result={user_id:userId,role_preference:'rider'};
   await request.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  });
  const t=(ar:string,en:string)=>language==='ar'?ar:en;
  await page.goto('/?tab=profile');
  await expect(page.getByRole('heading',{name:t('بيانات حسابي','My profile')})).toBeVisible();
  await expect(page.getByRole('button',{name:/Enter Captain journey|Continue Captain application|ابدأ ككابتن|متابعة طلب الكابتن/})).toHaveCount(0);
  await page.getByRole('button',{name:t('فتح القائمة','Open menu')}).click();
  const drawer=page.getByRole('dialog',{name:t('القائمة الرئيسية','Main menu')});
  await expect(drawer.getByRole('button',{name:t('تسجيل / متابعة طلب الكابتن','Captain registration / application')})).toHaveCount(0);
  await page.goto('/?tab=captain-onboarding&view=35');
  await expect(page.getByRole('heading',{name:t('غير مسموح','Access restricted')})).toBeVisible();
  await expect(page.locator('.c-approval-live')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading',{name:t('غير مسموح','Access restricted')})).toBeVisible();
  await page.goto('/?tab=routes&view=42');
  await expect(page.getByText(t('خطوط الكابتن مخصصة لحسابات الكباتن فقط.','Captain routes are only available to Captain accounts.'))).toBeVisible();
  await expect(page.getByRole('button',{name:t('بدء تسجيل الكابتن','Start Captain enrollment')})).toHaveCount(0);

  // A Rider who tried Captain enrollment in an older build may have a
  // leftover Captain profile. The saved Rider role remains authoritative.
  legacyCaptainProfile=true;
  await page.goto('/?tab=profile');
  await expect(page.getByRole('heading',{name:t('بيانات حسابي','My profile')})).toBeVisible();
  await expect(page.getByRole('button',{name:/Enter Captain journey|Continue Captain application|ابدأ ككابتن|متابعة طلب الكابتن/})).toHaveCount(0);
  await page.getByRole('button',{name:t('فتح القائمة','Open menu')}).click();
  const legacyDrawer=page.getByRole('dialog',{name:t('القائمة الرئيسية','Main menu')});
  await expect(legacyDrawer.getByRole('button',{name:t('تسجيل / متابعة طلب الكابتن','Captain registration / application')})).toHaveCount(0);
  await page.goto('/?tab=captain-onboarding&view=35');
  await expect(page.getByRole('heading',{name:t('غير مسموح','Access restricted')})).toBeVisible();

  // Even a forged/stale Captain OAuth intent cannot convert an existing Rider.
  await page.evaluate(()=>{
   sessionStorage.setItem('sekka.pendingRole','captain');
   sessionStorage.setItem('sekka.postAuthPath','/?tab=captain-onboarding&view=35');
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText(t(
   'حساب الراكب لا يمكن تحويله إلى كابتن.',
   'A Rider account cannot be converted to Captain.'
  ));
  expect(await page.evaluate(()=>sessionStorage.getItem('sekka.pendingRole'))).toBeNull();
  expect(captainWrites).toBe(0);
 });
}
