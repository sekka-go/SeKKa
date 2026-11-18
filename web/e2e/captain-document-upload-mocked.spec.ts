import {test,expect} from '@playwright/test';

// Synthetic browser regression ONLY. Real Google login and real Staging Storage
// still require an authorized user/device test. No real documents are uploaded.
const endpoint='https://sekka-auth-e2e.supabase.co';
const userId='00000000-0000-4000-8000-0000000000b1';
const user={
 id:userId,aud:'authenticated',role:'authenticated',email:'captain-fixture@example.test',
 email_confirmed_at:'2026-01-01T00:00:00Z',created_at:'2026-01-01T00:00:00Z',
 app_metadata:{provider:'google',providers:['google']},
 user_metadata:{full_name:'Captain Fixture'}
};
const application={
 user_id:userId,status:'draft',full_name:'مونا حسن علي',phone_number:'01012345678',
 professional_notes:'Professional driver committed to safe passenger transport',
 experience_years:3,rejection_reason:null,
 vehicle_type:'private_car',vehicle_make_id:1,vehicle_model_id:1,
 manufacture_year:2020,vehicle_color_code:'white',vehicle_color_other:null,
 intended_plate:'أبج123',approved_vehicle_id:null,submitted_at:null,reviewed_at:null
};
type MockDocument={id:string;kind:string;object_name:string;created_at:string};

test('MOCKED Android-width private document upload: denied, retry, verified persistence',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(({endpoint,user})=>{
  const storage='sb-'+new URL(endpoint).hostname.split('.')[0]+'-auth-token';
  localStorage.setItem(storage,JSON.stringify({
   access_token:'fixture-header.fixture-payload.fixture-signature',
   refresh_token:'local-fixture-refresh',token_type:'bearer',
   expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user
  }));
  localStorage.setItem('language_preference','en');
  localStorage.setItem('theme_preference','light');
  sessionStorage.setItem('sekka.pendingRole','captain');
 },{endpoint,user});
 const docs:MockDocument[]=[];
 const uploaded=new Set<string>();
 let failNextUpload=true;
 await page.route(endpoint+'/**',async route=>{
  const request=route.request();
  const url=new URL(request.url());
  const pathname=url.pathname;
  let result:unknown=[];
  let status=200;
  if(pathname==='/auth/v1/user')result=user;
  else if(pathname==='/rest/v1/rpc/v31_is_admin')result=false;
  else if(pathname.startsWith('/rest/v1/v31_captain_profiles'))
   result={user_id:userId,approval_status:'pending'};
  else if(pathname.startsWith('/rest/v1/v31_captain_applications'))
   result=application;
  else if(pathname.startsWith('/rest/v1/v31_captain_documents')){
   const item=docs.find(d=>url.searchParams.get('object_name')?.includes(d.object_name));
   result=request.headers()['accept']?.includes('vnd.pgrst.object+json')?item||null:docs;
  }
  else if(pathname.startsWith('/rest/v1/v31_vehicle_makes'))
   result=[{id:1,name_ar:'تويوتا',name_en:'Toyota',active:true}];
  else if(pathname.startsWith('/rest/v1/v31_vehicle_models'))
   result=[{id:1,make_id:1,name_ar:'كورولا',name_en:'Corolla',active:true}];
  else if(pathname.startsWith('/rest/v1/v31_vehicle_colors'))
   result=[{code:'white',name_ar:'أبيض',name_en:'White',active:true}];
  else if(pathname.startsWith('/storage/v1/object/')){
   const objectName=pathname.split('/v31-captain-docs-staging/')[1]||'';
   if(failNextUpload){
    failNextUpload=false;
    status=403;
    result={statusCode:'403',error:'AccessDenied',message:'Mocked Storage policy denial'};
   }else{
    uploaded.add(objectName);
    result={Key:'v31-captain-docs-staging/'+objectName};
   }
  }
  else if(pathname==='/rest/v1/rpc/v31_register_captain_document'){
   const body=request.postDataJSON() as {p_kind:string;p_object_name:string};
   if(!uploaded.has(body.p_object_name)){
    status=400;
    result={code:'DOCUMENT_NOT_UPLOADED',message:'Missing file'};
   }else{
    const doc:MockDocument={
     id:'22222222-2222-4222-8222-'+String(docs.length+1).padStart(12,'0'),kind:body.p_kind,
     object_name:body.p_object_name,created_at:'2026-11-17T00:00:00Z'
    };
    docs.push(doc);
    result=doc.id;
   }
  }
  else if(pathname.startsWith('/rest/v1/v31_profiles'))
   result=request.method()==='GET'?null:[];
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto('/?tab=captain-onboarding&view=38');
 const picker=page.locator('.c-file-picker').first();
 await expect(picker.locator('input[type=file]')).toBeEnabled();
 await expect(page.getByText('0/4 required documents complete')).toBeVisible();
 const input=picker.locator('input[type=file]');
 // Android document providers sometimes send a generic MIME type. Validated JPEG signature still uploads.
 const mockFile={name:'synthetic-test.jpg',mimeType:'application/octet-stream',buffer:Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0xff,0xd9])};
 const firstChooser=page.waitForEvent('filechooser');
 await picker.click();
 await (await firstChooser).setFiles(mockFile);
 await expect(page.locator('.c-document').first().getByRole('alert')).toContainText('Document was not saved while uploading the file');
 await expect(page.getByText('0/4 required documents complete')).toBeVisible();
 const retryChooser=page.waitForEvent('filechooser');
 await picker.click();
 await (await retryChooser).setFiles(mockFile);
 await expect(page.getByText('1/4 required documents complete')).toBeVisible();
 await expect(page.locator('.c-document').first().locator('.c-document-label')).toContainText('Uploaded');
 expect(docs).toHaveLength(1);
 await page.reload();
 await expect(page.getByText('1/4 required documents complete')).toBeVisible();
 await expect(page.locator('.c-file-picker').first().locator('.c-file-picker-name')).toHaveText('A file is saved');
 await expect(page.getByRole('button',{name:'Review application'})).toBeDisabled();
 // Four different documents must be present after reloading, not just an
 // optimistic client counter. Use realistic chooser clicks on all four rows.
 for(let i=1;i<4;i++){
  const chooser=page.waitForEvent('filechooser');
  await page.locator('.c-file-picker').nth(i).click();
  await (await chooser).setFiles(mockFile);
  await expect(page.getByText((i+1)+'/4 required documents complete')).toBeVisible();
 }
 expect(docs).toHaveLength(4);
 expect(uploaded.size).toBe(4);
 await page.reload();
 await expect(page.getByText('4/4 required documents complete')).toBeVisible();
 await expect(page.getByRole('button',{name:'Review application'})).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
