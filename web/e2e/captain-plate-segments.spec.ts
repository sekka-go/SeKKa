import {test,expect} from '@playwright/test';

const endpoint='https://sekka-auth-e2e.supabase.co';
const id='00000000-0000-4000-8000-0000000000b1';
const user={id,aud:'authenticated',role:'authenticated',email:'captain-plate@example.test',
 email_confirmed_at:'2026-11-01T00:00:00Z',created_at:'2026-11-01T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},user_metadata:{full_name:'Test Captain'}};

for(const width of [320,390]){
 for(const language of ['ar','en'] as const){
 test('Captain plate boxes: Giza 2 letters and 4 digits, inline failure, persistence '+width+' '+language,async({page})=>{
  await page.setViewportSize({width,height:width===320?700:844});
  await page.addInitScript(({endpoint,user,language})=>{
   const key='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
   localStorage.setItem(key,JSON.stringify({
    access_token:'fake-header.fake-payload.fake-signature',refresh_token:'fixture-refresh',
    token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
   }));
   localStorage.setItem('language_preference',language);
   localStorage.setItem('theme_preference','light');
   sessionStorage.setItem('sekka.pendingRole','captain');
  },{endpoint,user,language});
  let saved={
   user_id:id,status:'draft',full_name:'مونا حسن علي',phone_number:'01012345678',
   professional_notes:'Professional driver committed to safe passenger travel',
   experience_years:3,rejection_reason:null,vehicle_type:'private_car',
   vehicle_make_id:1,vehicle_model_id:1,manufacture_year:2010,
   vehicle_color_code:'white',vehicle_color_other:null,intended_plate:null as string|null,
   approved_vehicle_id:null,submitted_at:null,reviewed_at:null
  };
  let failSave=true,saves=0;
  await page.route(endpoint+'/**',async route=>{
   const request=route.request();const path=new URL(request.url()).pathname;
   let result:unknown=[];let status=200;
   if(path==='/auth/v1/user')result=user;
   else if(path==='/rest/v1/rpc/v31_is_admin')result=false;
   else if(path.startsWith('/rest/v1/v31_captain_applications'))result=saved;
   else if(path.startsWith('/rest/v1/v31_captain_profiles'))result={user_id:id,approval_status:'pending'};
   else if(path.startsWith('/rest/v1/v31_captain_documents'))result=[];
   else if(path.startsWith('/rest/v1/v31_vehicle_makes'))result=[{id:1,name_ar:'بي واي دي',name_en:'BYD',active:true}];
   else if(path.startsWith('/rest/v1/v31_vehicle_models'))result=[{id:1,make_id:1,name_ar:'إف ٣',name_en:'F3',active:true}];
   else if(path.startsWith('/rest/v1/v31_vehicle_colors'))result=[{code:'white',name_ar:'أبيض',name_en:'White',active:true}];
   else if(path==='/rest/v1/rpc/v31_save_captain_vehicle_intent'){
    saves++;
    if(failSave){status=400;result={code:'INVALID_VEHICLE_DETAILS',message:'INVALID_VEHICLE_DETAILS'};}
    else {
     const body=request.postDataJSON() as Record<string,unknown>;
     saved={...saved,vehicle_type:String(body.p_vehicle_type),vehicle_make_id:Number(body.p_make_id),
      vehicle_model_id:Number(body.p_model_id),manufacture_year:Number(body.p_year),
      vehicle_color_code:String(body.p_color_code),intended_plate:String(body.p_plate)};
     result='draft';
    }
   }else if(path.startsWith('/rest/v1/v31_profiles'))result=null;
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto('/?tab=captain-onboarding&view=37');
  const submit=page.getByRole('button',{name:language==='ar'?'حفظ ومتابعة':'Save and continue'});
  const layout=page.getByLabel(language==='ar'?'نمط اللوحة حسب المحافظة':'Plate layout by governorate');
  await layout.selectOption('giza');
  const letter=(n:number)=>page.getByRole('textbox',{name:language==='ar'?'حرف اللوحة '+n:'Plate letter '+n});
  const digit=(n:number)=>page.getByRole('textbox',{name:language==='ar'?'رقم اللوحة '+n:'Plate digit '+n});
  expect(await page.locator('.c-plate-segment').first().locator('input').count()).toBe(2);
  expect(await page.locator('.c-plate-segment').last().locator('input').count()).toBe(4);
  await letter(1).fill('م');await letter(2).fill('س');
  await digit(1).fill('٦');await digit(2).fill('٥');await digit(3).fill('٨');
  await submit.click();
  await expect(page.locator('.c-vehicle-save-feedback')).toBeVisible();
  expect(saves).toBe(0); // Incomplete plate never hits server.
  await digit(4).fill('٧');
  await expect(digit(4)).toHaveValue('7');
  await submit.click();
  await expect(page.locator('.c-vehicle-save-feedback')).toContainText(
   language==='ar'?'راجع بيانات المركبة':'Check the vehicle details');
  expect(saves).toBe(1);
  failSave=false;
  await submit.click();
  await expect(page).toHaveURL(/tab=captain-onboarding&view=38/);
  expect(saves).toBe(2);
  expect(saved.intended_plate).toBe('مس6587');
  await page.goto('/?tab=captain-onboarding&view=37');
  await expect(layout).toHaveValue('giza');
  await expect(letter(1)).toHaveValue('م');
  await expect(letter(2)).toHaveValue('س');
  await expect(digit(4)).toHaveValue('7');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
 }
}
