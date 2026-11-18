import {test,expect} from '@playwright/test';

// Browser-only mock. Real Google session, plate uniqueness and Admin review
// remain server-side and are not bypassed by this test.
const endpoint='https://sekka-auth-e2e.supabase.co';
const userId='00000000-0000-4000-8000-0000000000b1';
const user={id:userId,aud:'authenticated',role:'authenticated',email:'captain-plate@example.test',
 email_confirmed_at:'2026-11-01T00:00:00Z',created_at:'2026-11-01T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},user_metadata:{full_name:'Test Captain'}};

for(const width of [320,390]){
 for(const language of ['ar','en'] as const){
 test('Captain no-governorate plate: ordered slots, real duplicate rejection and correction '+width+' '+language,async({page})=>{
  await page.setViewportSize({width,height:width===320?700:844});
  await page.addInitScript(({endpoint,user,language})=>{
   const key='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
   localStorage.setItem(key,JSON.stringify({
    access_token:'fixture-header.fixture-payload.fixture-signature',refresh_token:'fixture-refresh',
    token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
   }));
   localStorage.setItem('language_preference',language);
   localStorage.setItem('theme_preference','light');
   sessionStorage.setItem('sekka.pendingRole','captain');
  },{endpoint,user,language});
  let saved={
   user_id:userId,status:'draft',full_name:'مونا حسن علي',phone_number:'01012345678',
   professional_notes:'Professional driver committed to safe passenger travel',
   experience_years:3,rejection_reason:null,vehicle_type:'private_car',
   vehicle_make_id:1,vehicle_model_id:1,manufacture_year:2010,
   vehicle_color_code:'white',vehicle_color_other:null,intended_plate:null as string|null,
   approved_vehicle_id:null,submitted_at:null,reviewed_at:null
  };
  let rejectDuplicate=true;
  let saves=0;
  await page.route(endpoint+'/**',async route=>{
   const req=route.request();const url=new URL(req.url()),path=url.pathname;
   let result:unknown=[];let status=200;
   if(path==='/auth/v1/user')result=user;
   else if(path==='/rest/v1/rpc/v31_is_admin')result=false;
   else if(path.startsWith('/rest/v1/v31_captain_applications'))result=saved;
   else if(path.startsWith('/rest/v1/v31_captain_profiles'))result={user_id:userId,approval_status:'pending'};
   else if(path.startsWith('/rest/v1/v31_captain_documents'))result=[];
   else if(path.startsWith('/rest/v1/v31_vehicle_makes'))result=[{id:1,name_ar:'بي واي دي',name_en:'BYD',active:true}];
   else if(path.startsWith('/rest/v1/v31_vehicle_models'))result=[{id:1,make_id:1,name_ar:'إف ٣',name_en:'F3',active:true}];
   else if(path.startsWith('/rest/v1/v31_vehicle_colors'))result=[{code:'white',name_ar:'أبيض',name_en:'White',active:true}];
   else if(path==='/rest/v1/rpc/v31_save_captain_vehicle_intent'){
    saves++;
    if(rejectDuplicate){
     status=400;
     result={code:'P0001',message:'DUPLICATE_LICENSE_PLATE'};
    }else{
     const body=req.postDataJSON() as Record<string,unknown>;
     saved={...saved,vehicle_type:String(body.p_vehicle_type),vehicle_make_id:Number(body.p_make_id),
      vehicle_model_id:Number(body.p_model_id),manufacture_year:Number(body.p_year),
      vehicle_color_code:String(body.p_color_code),intended_plate:String(body.p_plate)};
     result='draft';
    }
   }else if(path.startsWith('/rest/v1/v31_profiles'))result=null;
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto('/?tab=captain-onboarding&view=37');
  const group=page.locator('.c-plate-fields');
  await expect(group).toBeVisible();
  await expect(page.locator('#captain-plate-format')).toHaveCount(0);
  const letter=(n:number)=>page.getByRole('textbox',{name:language==='ar'?'حرف اللوحة '+n:'Plate letter '+n});
  const digit=(n:number)=>page.getByRole('textbox',{name:language==='ar'?'رقم اللوحة '+n:'Plate digit '+n});
  await expect(group.locator('.c-plate-segment').first().locator('input')).toHaveCount(3);
  await expect(group.locator('.c-plate-segment').last().locator('input')).toHaveCount(4);
  // Later slots cannot be filled before earlier ones, in either row.
  await expect(letter(2)).toBeDisabled();
  await expect(letter(3)).toBeDisabled();
  await expect(digit(1)).toBeDisabled();
  await letter(1).fill('ي');
  await expect(letter(2)).toBeEnabled();
  await letter(2).fill('ن');
  await expect(digit(1)).toBeEnabled();
  await expect(digit(2)).toBeDisabled();
  await digit(1).fill('٢');
  await expect(digit(1)).toHaveValue('2');
  await expect(digit(2)).toBeEnabled();
  await digit(2).fill('٦');
  await digit(3).fill('٥');
  const submit=page.getByRole('button',{name:language==='ar'?'حفظ ومتابعة':'Save and continue'});
  await submit.click();
  await expect(page.locator('.c-vehicle-save-feedback')).toBeVisible();
  expect(saves).toBe(0); // 2 letters + 3 digits is invalid on the client.
  await digit(4).fill('٦');
  await submit.click();
  await expect(page.locator('.c-vehicle-save-feedback')).toContainText(
   language==='ar'?'مسجل بالفعل على حساب آخر':'already registered to another account');
  expect(saves).toBe(1);
  await expect(page).toHaveURL(/view=37/); // Never bypass uniqueness.
  rejectDuplicate=false;
  await letter(1).fill('م'); // Actual owner corrects a mistyped plate.
  await submit.click();
  await expect(page).toHaveURL(/view=38/);
  expect(saves).toBe(2);
  expect(saved.intended_plate).toBe('من2656');
  await page.goto('/?tab=captain-onboarding&view=37');
  await expect(group).toBeVisible();
  await expect(letter(1)).toHaveValue('م');
  await expect(letter(2)).toHaveValue('ن');
  await expect(digit(4)).toHaveValue('6');
  await expect(letter(3)).toBeEnabled(); // Third letter remains optional.
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
 }
}
