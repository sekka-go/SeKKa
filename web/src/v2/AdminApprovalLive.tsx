import AppSkeleton from './AppSkeleton';
import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';

type Application={
 user_id:string;status:string;full_name:string|null;phone_number:string|null;
 professional_notes:string;experience_years:number|null;vehicle_type:string|null;
 vehicle_make_id:number|null;vehicle_model_id:number|null;manufacture_year:number|null;
 vehicle_color_code:string|null;vehicle_color_other:string|null;intended_plate:string|null;
 approved_vehicle_id:string|null;rejection_reason:string|null;submitted_at:string|null
};
type DocumentRow={id:string;kind:string;object_name:string;created_at:string};
type AuditRow={id:string;decision:string;reason:string|null;created_at:string};
const bucket='v31-captain-docs-staging';
const requiredDocumentKinds=['identity','driving_license','vehicle_license','vehicle_photo'];
const documentLabels:Record<string,[string,string]>={
 identity:['إثبات الهوية','Identity proof'],driving_license:['رخصة القيادة','Driving license'],
 vehicle_license:['رخصة المركبة','Vehicle license'],vehicle_photo:['صورة المركبة','Vehicle photo']
};
const categorySeats:Record<string,number>={PRIME:3,SAVER:4,SPACE:9,MAX:13};

export default function AdminApprovalLive({screen,onGo}: {screen:number;onGo:(screen:number)=>void}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [authorized,setAuthorized]=useState<boolean|null>(null),[apps,setApps]=useState<Application[]>([]);
 const [selected,setSelected]=useState<string|null>(null),[docs,setDocs]=useState<DocumentRow[]>([]);
 const [audit,setAudit]=useState<AuditRow[]>([]),[reason,setReason]=useState('');
 const [reviewed,setReviewed]=useState(false),[hiaceCategories,setHiaceCategories]=useState<string[]>([]);
 const [vehicleLabels,setVehicleLabels]=useState({make:'',model:'',color:''});
 const [loginEmail,setLoginEmail]=useState<string|null>(null);
 const [emailLoading,setEmailLoading]=useState(false),[emailError,setEmailError]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const active=apps.find(application=>application.user_id===selected)||null;

 useEffect(()=>{
  let live=true;setLoading(true);setError('');
  void(async()=>{
   try{
    if(!client)throw Error('BACKEND_NOT_CONFIGURED');
    const {data:isAdmin,error:roleError}=await client.rpc('v31_is_admin');
    if(roleError)throw roleError;
    if(isAdmin!==true){if(live){setAuthorized(false);setApps([]);}return;}
    const {data,error:queryError}=await client.from('v31_captain_applications')
     .select('user_id,status,full_name,phone_number,professional_notes,experience_years,vehicle_type,vehicle_make_id,vehicle_model_id,manufacture_year,vehicle_color_code,vehicle_color_other,intended_plate,approved_vehicle_id,rejection_reason,submitted_at')
     .order('updated_at',{ascending:false}).limit(100);
    if(queryError)throw queryError;
    if(live){setAuthorized(true);setApps((data||[]) as Application[]);}
   }catch(e){if(live)setError(e instanceof Error?e.message:String(e));}
   finally{if(live)setLoading(false);}
  })();
  return()=>{live=false;};
 },[revision]);

 useEffect(()=>{
  let live=true;setDocs([]);setAudit([]);setVehicleLabels({make:'',model:'',color:''});
  const application=apps.find(row=>row.user_id===selected);
  if(!selected||!authorized||!client)return;
  void(async()=>{
   try{
    const [documents,auditRows,make,model,color]=await Promise.all([
     client.from('v31_captain_documents').select('id,kind,object_name,created_at')
      .eq('captain_id',selected).order('created_at',{ascending:false}),
     client.from('v31_captain_approval_audit').select('id,decision,reason,created_at')
      .eq('captain_id',selected).order('created_at',{ascending:false}),
     client.from('v31_vehicle_makes').select('name_ar,name_en')
      .eq('id',application?.vehicle_make_id||0).maybeSingle(),
     client.from('v31_vehicle_models').select('name_ar,name_en')
      .eq('id',application?.vehicle_model_id||0).maybeSingle(),
     client.from('v31_vehicle_colors').select('name_ar,name_en')
      .eq('code',application?.vehicle_color_code||'').maybeSingle()
    ]);
    const failure=documents.error||auditRows.error||make.error||model.error||color.error;
    if(failure)throw failure;
    if(live){
     setDocs((documents.data||[]) as DocumentRow[]);setAudit((auditRows.data||[]) as AuditRow[]);
     setVehicleLabels({
      make:en?make.data?.name_en||'':make.data?.name_ar||'',
      model:en?model.data?.name_en||'':model.data?.name_ar||'',
      color:application?.vehicle_color_code==='other'
       ?application.vehicle_color_other||''
       :en?color.data?.name_en||'':color.data?.name_ar||''
     });
     setHiaceCategories([]);
    }
   }catch(e){if(live)setError(e instanceof Error?e.message:String(e));}
  })();
  return()=>{live=false;};
 },[selected,authorized,revision,apps,language]);

 // Email is private Auth account data. Load it only for the selected
 // Captain, after the server-confirmed Admin check. The SQL RPC enforces
 // the same authorization independently, so hiding this UI is not security.
 useEffect(()=>{
  let live=true;
  setLoginEmail(null);setEmailError(false);setEmailLoading(false);
  if(!selected||authorized!==true||!client)return;
  setEmailLoading(true);
  void(async()=>{
   try{
    if(!client)throw Error('BACKEND_NOT_CONFIGURED');
    const {data,error:lookupError}=await client.rpc('v31_admin_captain_login_email',{p_captain:selected});
    if(lookupError)throw lookupError;
    if(live)setLoginEmail(typeof data==='string'&&data.trim()?data.trim():null);
   }catch{if(live)setEmailError(true);}
   finally{if(live)setEmailLoading(false);}
  })();
  return()=>{live=false;};
 },[selected,authorized,revision]);

 const requiredDocumentsComplete=requiredDocumentKinds.every(kind=>docs.some(doc=>doc.kind===kind));
 const applicationComplete=!!active?.full_name&&active.full_name.trim().split(/\s+/).length>=2&&
  !!active.phone_number&&/^01[0125]\d{8}$/.test(active.phone_number)&&
  active.professional_notes.trim().length>=3&&active.experience_years!==null&&
  !!active.vehicle_type&&!!active.vehicle_make_id&&!!active.vehicle_model_id&&
  !!active.manufacture_year&&!!active.vehicle_color_code&&!!active.intended_plate;

 const download=async(doc:DocumentRow)=>{
  if(!client)return;
  setBusy(true);setError('');
  try{
   const {data,error:downloadError}=await client.storage.from(bucket).download(doc.object_name);
   if(downloadError||!data)throw Error(downloadError?.message||'DOCUMENT_DOWNLOAD_FAILED');
   const url=URL.createObjectURL(data),anchor=document.createElement('a');
   anchor.href=url;anchor.download=doc.kind+'-'+doc.id.slice(0,8);anchor.click();
   setTimeout(()=>URL.revokeObjectURL(url),20000);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };

 const decide=(decision:'approved'|'rejected')=>{
  if(!selected||!reviewed)return;
  if(decision==='rejected'&&reason.trim().length<5){
   setError(t('اكتب سبب رفض واضح من 5 أحرف على الأقل.','Provide a clear rejection reason (at least 5 characters).'));return;
  }
  if(decision==='approved'&&(!applicationComplete||!requiredDocumentsComplete||
     (active?.vehicle_type==='hiace'&&!hiaceCategories.length))){
   setError(t('لا يمكن اعتماد طلب غير مكتمل أو مركبة لم تُراجع فئاتها.','Cannot approve an incomplete application or a Hiace without reviewed categories.'));return;
  }
  setBusy(true);setError('');setNotice('');
  void(async()=>{
   try{
    if(!client)throw Error('BACKEND_NOT_CONFIGURED');
    const {data,error:decisionError}=await client.rpc('v31_admin_decide_captain',{
     p_captain:selected,p_decision:decision,p_reason:decision==='rejected'?reason.trim():null,
     p_hiace_categories:active?.vehicle_type==='hiace'?hiaceCategories:null
    });
    if(decisionError)throw decisionError;
    if(data!==decision)throw Error('ADMIN_DECISION_NOT_VERIFIED');
    const {data:record,error:verifyError}=await client.from('v31_captain_applications')
     .select('status').eq('user_id',selected).single();
    if(verifyError||record?.status!==decision)throw Error('ADMIN_DECISION_NOT_PERSISTED');
    setNotice(t('اتسجل القرار وتفعيل المركبة في قاعدة البيانات وسجل التدقيق.','Decision and vehicle activation were persisted with an audit record.'));
    setReviewed(false);setReason('');setRevision(value=>value+1);
   }catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{setBusy(false);}
  })();
 };

 return <section className="ad-content" aria-label={t('إدارة طلبات الكباتن','Captain application review')}>
  <h2>{screen===64?t('طلبات اعتماد الكباتن','Captain applications'):t('مراجعة مستندات الكباتن','Captain documents')}</h2>
  {loading&&<AppSkeleton kind="requests" count={3} label={t('جارٍ تحميل الطلبات…','Loading applications…')}/>}
  {authorized===false&&<p role="alert">{t('الصلاحية الإدارية غير متاحة.','Admin access denied.')}</p>}
  {error&&<div role="alert" className="ad-card"><p>{error}</p><button onClick={()=>setRevision(value=>value+1)}>{t('إعادة المحاولة','Retry')}</button></div>}
  {notice&&<p role="status">{notice}</p>}
  {authorized&&<><nav className="ad-tools" aria-label={t('أقسام مراجعة الكباتن','Review navigation')}>
   <button onClick={()=>onGo(64)}>{t('طلبات الكباتن','Captain applications')}</button>
   <button onClick={()=>onGo(65)}>{t('مراجعة المستندات','Document review')}</button>
   <button onClick={()=>setRevision(value=>value+1)}>{t('تحديث','Refresh')}</button>
  </nav>
  {apps.length===0&&<p role="status">{t('لا توجد طلبات محفوظة حاليًا.','No applications on record.')}</p>}
  <div className="ad-layout">
   <section className="ad-card">
    <h3>{t('الطلبات','Applications')}</h3>
    <ul>{apps.map(application=><li key={application.user_id}>
     <button type="button" aria-pressed={selected===application.user_id}
      onClick={()=>{setSelected(application.user_id);setReviewed(false);setReason('');}}>
      {application.full_name||t('كابتن','Captain')} — {application.status}
     </button>
    </li>)}</ul>
   </section>
   {active&&<section className="ad-card">
    <h3>{t('تفاصيل طلب الكابتن','Captain application details')}</h3>
    <p>{t('الحالة:','Status:')} {active.status}</p>
    <p>{t('الاسم بالكامل:','Full name:')} {active.full_name||'—'}</p>
    <p data-testid="captain-admin-login-email">{t('البريد الإلكتروني لحساب Google:','Google sign-in email:')}{' '}
     {emailLoading?t('جارٍ التحميل…','Loading…'):emailError
      ?t('تعذر تحميل البريد الإلكتروني. استخدم تحديث للمحاولة مجددًا.','Could not load the email. Use Refresh to retry.')
      :loginEmail?<bdi dir="ltr" style={{overflowWrap:'anywhere',wordBreak:'break-word'}}>{loginEmail}</bdi>:'—'}
    </p>
    <p>{t('الهاتف (غير مؤكد):','Phone (unverified):')} {active.phone_number||'—'}</p>
    <p>{t('سنوات الخبرة:','Years of experience:')} {active.experience_years??'—'}</p>
    <p>{t('الخلفية المهنية:','Professional background:')} {active.professional_notes||'—'}</p>
    <p>{t('نوع المركبة:','Physical vehicle type:')} {active.vehicle_type==='private_car'
     ?t('ملاكي','Private car'):active.vehicle_type==='hiace'?t('هايس','Hiace'):'—'}</p>
    <p>{t('الشركة والموديل:','Make and model:')} {vehicleLabels.make} {vehicleLabels.model}</p>
    <p>{t('سنة الصنع:','Manufacture year:')} {active.manufacture_year||'—'}</p>
    <p>{t('اللون:','Color:')} {vehicleLabels.color||'—'}</p>
    <p>{t('رقم اللوحة:','License plate:')} {active.intended_plate||'—'}</p>
    {active.vehicle_type==='private_car'&&<p>PRIME · 3 {t('مقاعد ركاب ثابتة','fixed passenger seats')} / SAVER · 4 {t('مقاعد ركاب ثابتة','fixed passenger seats')} — {t('أهلية تلقائية','automatically eligible')}</p>}
    {active.vehicle_type==='hiace'&&<fieldset>
     <legend>{t('فئات هايس التي تعتمدها للمركبة','Hiace categories approved for this vehicle')}</legend>
     {(['SPACE','MAX'] as const).map(category=><label key={category}>
      <input type="checkbox" checked={hiaceCategories.includes(category)}
       onChange={event=>setHiaceCategories(current=>event.target.checked
        ?[...current,category]:current.filter(value=>value!==category))}/>
      {category} · {categorySeats[category]} {t('مقاعد ركاب ثابتة','fixed passenger seats')}
     </label>)}
    </fieldset>}
    <p>{t('المستندات الخاصة المطلوبة:','Required private documents:')}
     {requiredDocumentKinds.filter(kind=>docs.some(document=>document.kind===kind)).length}/4</p>
    <ul>{docs.map(document=><li key={document.id}>
     {t(...(documentLabels[document.kind]||[document.kind,document.kind] as [string,string]))}
     <button type="button" disabled={busy} onClick={()=>void download(document)}>{t('تنزيل للمراجعة','Download for review')}</button>
    </li>)}</ul>
    {!requiredDocumentsComplete&&<p role="alert">{t('المستندات الإلزامية غير مكتملة.','Required documents are incomplete.')}</p>}
    {active.status==='submitted'&&<>
     <label><input type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/>
      {t('راجعت الطلب والمستندات بصفتي مسؤولًا مخولًا','I reviewed this application and documents as an authorized administrator')}</label>
     <button type="button" disabled={!reviewed||busy||!applicationComplete||!requiredDocumentsComplete||
       (active.vehicle_type==='hiace'&&!hiaceCategories.length)} onClick={()=>decide('approved')}>
      {t('اعتماد الكابتن وتفعيل المركبة','Approve Captain and activate vehicle')}
     </button>
     <label>{t('سبب الرفض','Rejection reason')}<textarea maxLength={1000} value={reason}
      onChange={event=>setReason(event.target.value)}/></label>
     <button type="button" disabled={!reviewed||busy||reason.trim().length<5}
      onClick={()=>decide('rejected')}>{t('رفض مع توضيح السبب','Reject with reason')}</button>
    </>}
    {active.rejection_reason&&<p role="status">{t('سبب الرفض المسجل:','Recorded rejection reason:')} {active.rejection_reason}</p>}
    <h3>{t('سجل القرارات','Decision audit trail')}</h3>
    <ol>{audit.map(row=><li key={row.id}>{row.decision} — {row.reason||'—'} ·
     {new Date(row.created_at).toLocaleString(en?'en-GB':'ar-EG')}</li>)}</ol>
   </section>}
  </div></>}
 </section>;
}
