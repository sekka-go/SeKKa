import {test,expect} from '@playwright/test';

const endpoint='https://sekka-auth-e2e.supabase.co';
const userId='00000000-0000-4000-8000-0000000000b1';
const user={
 id:userId,aud:'authenticated',role:'authenticated',email:'captain-fixture@example.test',
 email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},
 user_metadata:{full_name:'Captain Fixture'}
};

type Draft={
 user_id:string;status:string;full_name:string|null;phone_number:string|null;
 professional_notes:string;experience_years:number|null;rejection_reason:string|null;
 vehicle_type:string|null;vehicle_make_id:number|null;vehicle_model_id:number|null;
 manufacture_year:number|null;vehicle_color_code:string|null;vehicle_color_other:string|null;
 intended_plate:string|null;approved_vehicle_id:string|null;submitted_at:string|null;reviewed_at:string|null
};

const blankDraft=():Draft=>({
 user_id:userId,status:'draft',full_name:null,phone_number:null,
 professional_notes:'',experience_years:null,rejection_reason:null,
 vehicle_type:null,vehicle_make_id:null,vehicle_model_id:null,
 manufacture_year:null,vehicle_color_code:null,vehicle_color_other:null,
 intended_plate:null,approved_vehicle_id:null,submitted_at:null,reviewed_at:null
});

for(const width of [320,360,390,412]){
 for(const {language,theme} of [
  {language:'ar',theme:'light'},
  {language:'ar',theme:'dark'},
  {language:'en',theme:'light'},
  {language:'en',theme:'dark'}
 ] as const){
  test(`Captain form validation and draft resume MOCKED ${width}px ${language} ${theme}`,async({page})=>{
   const height=width===320?700:width===360?800:width===390?844:915;
   await page.setViewportSize({width,height});
   await page.addInitScript(({endpoint,user,language,theme})=>{
    const storage='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
    localStorage.setItem(storage,JSON.stringify({
     access_token:'fixture-header.fixture-payload.fixture-signature',
     refresh_token:'local-fixture-refresh',token_type:'bearer',
     expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
    }));
    localStorage.setItem('language_preference',language);
    localStorage.setItem('theme_preference',theme);
    sessionStorage.setItem('sekka.pendingRole','captain');
   },{endpoint,user,language,theme});

   let application=blankDraft();
   let personalSaveCount=0;
   await page.route(endpoint+'/**',async route=>{
    const request=route.request();
    const path=new URL(request.url()).pathname;
    let result:unknown=[];
    if(path==='/auth/v1/user')result=user;
    else if(path==='/rest/v1/rpc/v31_is_admin')result=false;
    else if(path==='/rest/v1/rpc/v31_save_captain_application'){
     const body=request.postDataJSON() as {
      p_full_name:string|null;p_phone:string|null;p_notes:string;p_experience:number|null
     };
     application={
      ...application,full_name:body.p_full_name,phone_number:body.p_phone,
      professional_notes:body.p_notes,experience_years:body.p_experience
     };
     personalSaveCount++;
     result='draft';
    }else if(path.startsWith('/rest/v1/v31_captain_applications'))result=application;
    else if(path.startsWith('/rest/v1/v31_captain_profiles'))
     result={user_id:userId,approval_status:'pending'};
    else if(path.startsWith('/rest/v1/v31_captain_documents'))result=[];
    else if(path.startsWith('/rest/v1/v31_vehicle_makes'))
     result=[{id:1,name_ar:'تويوتا',name_en:'Toyota',active:true}];
    else if(path.startsWith('/rest/v1/v31_vehicle_colors'))
     result=[{code:'white',name_ar:'أبيض',name_en:'White',active:true}];
    else if(path.startsWith('/rest/v1/v31_vehicle_models'))
     result=[{id:1,make_id:1,name_ar:'كورولا',name_en:'Corolla',active:true}];
    else if(path.startsWith('/rest/v1/v31_profiles'))
     result=request.method==='GET'?null:[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
   });

   await page.goto('/?tab=captain-onboarding&view=36');
   await expect(page.locator('.captain-enrollment-progress')).toBeVisible();
   const continueButton=page.getByRole('button',{
    name:language==='en'?'Save and continue':'حفظ ومتابعة'
   });
   await expect(continueButton).toBeEnabled();
   await continueButton.scrollIntoViewIfNeeded();
   const actionBounds=await continueButton.boundingBox();
   expect(actionBounds).not.toBeNull();
   expect(actionBounds!.y).toBeGreaterThanOrEqual(0);
   expect(actionBounds!.y+actionBounds!.height).toBeLessThanOrEqual(height+1);
   const fullName=page.getByLabel(language==='en'?'Full name (at least 3 names, matching ID)':'الاسم الثلاثي على الأقل — مطابق للبطاقة');
   await fullName.fill('');
   await continueButton.click();
   await expect(page.getByText(
    language==='en'?'Enter your full name.':'اكتب اسمك بالكامل.'
   )).toBeVisible();
   await expect(page.getByRole('alert')).toHaveCount(4);
   expect(personalSaveCount).toBe(0);

   await fullName.fill('Mona Hassan Ali');
   await page.getByLabel(language==='en'?'Egyptian mobile number':'رقم الموبايل المصري')
    .fill('01012345678');
   await page.getByLabel(language==='en'?'Professional background':'الخلفية المهنية')
    .fill('Daily route operations');
   const years=page.getByLabel(language==='en'?'Years of experience':'سنوات الخبرة');
   await years.focus();
   await years.scrollIntoViewIfNeeded();
   const yearsBounds=await years.boundingBox();
   expect(yearsBounds).not.toBeNull();
   expect(yearsBounds!.y).toBeGreaterThanOrEqual(0);
   expect(yearsBounds!.y+yearsBounds!.height).toBeLessThanOrEqual(height+1);
   await years.fill('800000');
   await continueButton.click();
   await expect(page.getByText(
    language==='en'?'Enter a whole number from 0 to 30.':'اكتب عددًا صحيحًا من 0 إلى 30.'
   )).toBeVisible();
   expect(personalSaveCount).toBe(0);

   await years.fill('0');
   await continueButton.scrollIntoViewIfNeeded();
   await continueButton.click();
   await expect(page).toHaveURL(/tab=captain-onboarding&view=37/);
   expect(application.experience_years).toBe(0);
   expect(application.full_name).toBe('Mona Hassan Ali');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);

   await page.reload();
   await expect(page).toHaveURL(/tab=captain-onboarding&view=37/);
   await page.getByRole('button',{name:language==='en'?'Back':'رجوع'}).click();
   await expect(page).toHaveURL(/tab=captain-onboarding&view=36/);
   await expect(page.getByLabel(language==='en'?'Years of experience':'سنوات الخبرة')).toHaveValue('0');

   if(width===390&&(language==='en'&&theme==='light'||language==='ar'&&theme==='dark')){
    await page.screenshot({
     path:`test-results/captain-form-${width}-${language}-${theme}-mocked.png`,
     fullPage:true,animations:'disabled'
    });
   }
  });
 }
}
