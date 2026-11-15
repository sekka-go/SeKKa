import {useEffect,useState} from 'react';
import {client} from './api';
import {enrollCaptain} from './captainEnrollment';
import LiveProfile from './LiveProfile';
import LiveVehicles from './LiveVehicles';
import {usePreferences} from './preferences';

const bucket='v31-captain-docs-staging';
const categorySeats:Record<string,number>={PRIME:3,SAVER:4,SPACE:9,MAX:13};
const kinds=[['identity','إثبات الهوية','Identity'],['driving_license','رخصة القيادة','Driving license'],
 ['vehicle_license','رخصة العربية','Vehicle license'],['vehicle_photo','صورة العربية','Vehicle photo']] as const;
type Application={user_id:string;status:string;professional_notes:string;experience_years:number|null;
 rejection_reason:string|null;intended_vehicle_model:string|null;intended_category:string|null;
 intended_seats:number|null;intended_plate:string|null;submitted_at:string|null;reviewed_at:string|null};
type DocumentRow={id:string;kind:string;object_name:string;created_at:string};
export default function CaptainApplicationLive({screen,onNext,onEnrolled}:{
 screen:number;onNext:(screen:number)=>void;onEnrolled?:()=>void;
}){
 const {language}=usePreferences(),en=language==='en',t=(a:string,b:string)=>en?b:a;
 const [uid,setUid]=useState<string|null>(null),[application,setApplication]=useState<Application|null>(null);
 const [docs,setDocs]=useState<DocumentRow[]>([]),[approval,setApproval]=useState('not_enrolled');
 const [fileNames,setFileNames]=useState<Record<string,string>>({});
 const [notes,setNotes]=useState(''),[years,setYears]=useState(''),[model,setModel]=useState(''),
 [category,setCategory]=useState('PRIME'),[seats,setSeats]=useState('3'),[plate,setPlate]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[rev,setRev]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');
  void(async()=>{try{
   if(!client)throw Error('BACKEND_NOT_CONFIGURED');
   const {data:{user},error:ae}=await client.auth.getUser();if(ae||!user)throw Error('AUTH_REQUIRED');
   const [app,files,cp]=await Promise.all([
     client.from('v31_captain_applications').select('user_id,status,professional_notes,experience_years,rejection_reason,intended_vehicle_model,intended_category,intended_seats,intended_plate,submitted_at,reviewed_at').eq('user_id',user.id).maybeSingle(),
     client.from('v31_captain_documents').select('id,kind,object_name,created_at').eq('captain_id',user.id).order('created_at',{ascending:false}),
     client.from('v31_captain_profiles').select('approval_status').eq('user_id',user.id).maybeSingle()
   ]);
   if(app.error||files.error||cp.error)throw Error(app.error?.message||files.error?.message||cp.error?.message||'LOAD_FAILED');
   if(!active)return;
   const row=app.data as Application|null;setUid(user.id);setApplication(row);
   setDocs((files.data||[]) as DocumentRow[]);setApproval(cp.data?.approval_status||'not_enrolled');
   if(row){setNotes(row.professional_notes||'');setYears(row.experience_years===null?'':String(row.experience_years));
     setModel(row.intended_vehicle_model||'');setPlate(row.intended_plate||'');
     setCategory(row.intended_category||'PRIME');setSeats(String(row.intended_seats||3));}
  }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
  finally{if(active)setLoading(false);}
  })();return()=>{active=false;};
 },[rev]);
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');setNotice('');
  try{await action();setRev(n=>n+1);}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const expectRpc=(data:unknown,expected:string)=>{if(data!==expected)throw Error('SERVER_RESPONSE_NOT_VERIFIED');};
 const statusLabel=(status:string|null|undefined)=>{
  const labels:Record<string,[string,string]> = {
   not_enrolled:['لم يبدأ التسجيل','Not enrolled'],draft:['مسودة','Draft'],submitted:['قيد المراجعة','Pending review'],
   pending:['قيد المراجعة','Pending review'],approved:['تم الاعتماد','Approved'],
   changes_requested:['مطلوب تعديل','Changes requested'],rejected:['مرفوض','Rejected'],suspended:['موقوف','Suspended']
  };
  const label=status?labels[status]:undefined;
  return label?t(label[0],label[1]):status||t('غير متاح','Unavailable');
 };
 const begin=()=>void run(async()=>{
  await enrollCaptain();
  if(!application){const {data,error:e}=await client!.rpc('v31_save_captain_application',{p_notes:'',p_experience:null});
   if(e)throw e;expectRpc(data,'draft');}
  onEnrolled?.();setNotice(t('طلبك محفوظ كمسودة.','Draft started.'));onNext(36);
 });
 const savePersonal=()=>void run(async()=>{
  const number=years.trim()===''?null:Number(years);
  if(number!==null&&(!Number.isInteger(number)||number<0||number>80))throw Error('INVALID_YEARS');
  const {data,error:e}=await client!.rpc('v31_save_captain_application',{p_notes:notes,p_experience:number});
  if(e)throw e;expectRpc(data,'draft');onNext(37);
 });
 const saveVehicle=()=>void run(async()=>{
  const number=seats.trim()===''?null:Number(seats);
  if(number!==null&&(!Number.isInteger(number)||number<1||number>(categorySeats[category]||13)))throw Error('INVALID_SEATS_FOR_CATEGORY');
  const {data,error:e}=await client!.rpc('v31_save_captain_vehicle_intent',{
    p_model:model.trim()||null,p_category:category||null,p_seats:number,p_plate:plate.trim()||null});
  if(e)throw e;expectRpc(data,'draft');onNext(38);
 });
 const upload=(kind:string,file:File)=>void run(async()=>{
  if(!uid||!client)throw Error('AUTH_REQUIRED');
  if(!['image/jpeg','image/png','application/pdf'].includes(file.type)||file.size<1||file.size>5242880)
   throw Error(t('استخدم JPG أو PNG أو PDF بحد أقصى 5 ميجابايت.','Use JPG/PNG/PDF up to 5 MB.'));
  const ext=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg';
  const objectName=uid+'/'+crypto.randomUUID()+'.'+ext;
  const {error:storageError}=await client.storage.from(bucket).upload(objectName,file,{upsert:false,contentType:file.type});
  if(storageError)throw storageError;
  const {data,error:e}=await client.rpc('v31_register_captain_document',{p_kind:kind,p_object_name:objectName});
  if(e)throw e;if(typeof data!=='string')throw Error('DOCUMENT_NOT_REGISTERED');
  setNotice(t('اترفع الملف بخصوصية إلى الطلب.','Document uploaded privately.'));
 });
 const submit=()=>void run(async()=>{
  const {data,error:e}=await client!.rpc('v31_submit_captain_application');
  if(e)throw e;expectRpc(data,'submitted');onNext(40);
 });
 const editAgain=()=>void run(async()=>{
  const {data,error:e}=await client!.rpc('v31_save_captain_application',{
    p_notes:notes,p_experience:years===''?null:Number(years)});
  if(e)throw e;expectRpc(data,'draft');onNext(36);
 });
 const editable=application?.status==='draft'||application?.status==='rejected';
 return <section className="c-approval-live" aria-label={t('اعتماد الكابتن','Captain approval')}>
  {loading&&<p role="status">{t('بنحمّل طلب الاعتماد…','Loading approval application…')}</p>}
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!loading&&screen===35&&<div className="d-box">
   <p>{t('طلب الاعتماد بيبدأ كمسودة. لا يتم اعتماد أي حساب تلقائيًا.','Start a draft. Approval always requires an administrator decision.')}</p>
   <p>{t('الحالة:','Status:')} {statusLabel(application?.status)}</p>
   {!application&&<button type="button" className="d-primary" disabled={busy} onClick={begin}>{t('ابدأ التسجيل','Start enrollment')}</button>}
   {application&&<button type="button" className="d-primary" onClick={()=>onNext(application.status==='submitted'?40:36)}>{t('متابعة الطلب','Continue application')}</button>}
  </div>}
  {!loading&&screen>35&&!application&&<div className="d-box">
   <p role="status">{t('ابدأ من تسجيل الكابتن قبل فتح هذه الخطوة.','Start Captain enrollment before opening this step.')}</p>
   <button type="button" className="d-primary" onClick={()=>onNext(35)}>{t('الذهاب لبداية التسجيل','Go to enrollment start')}</button>
  </div>}
  {!loading&&application&&screen===36&&<div className="d-box">
   <LiveProfile/>
   <label>{t('نبذة مهنية (اختياري)','Professional background (optional)')}
    <textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} disabled={!editable}/></label>
   <label>{t('سنوات الخبرة (اختياري)','Years of experience (optional)')}
    <input type="number" min={0} max={80} value={years} onChange={e=>setYears(e.target.value)} disabled={!editable}/></label>
   {editable&&<button type="button" className="d-primary" disabled={busy} onClick={savePersonal}>{t('احفظ وتابع','Save and continue')}</button>}
  </div>}
  {!loading&&application&&screen===37&&<div className="d-box">
   <p>{t('سجّل تفاصيل العربية المتوقعة. تسجيل العربية الفعلي يتم بعد الاعتماد.','Save intended vehicle details. Actual registration follows approval.')}</p>
   <label>{t('الموديل (اختياري)','Model (optional)')}<input value={model} disabled={!editable} onChange={e=>setModel(e.target.value)}/></label>
   <label>{t('الفئة','Category')}<select value={category} disabled={!editable} onChange={e=>{const next=e.target.value;setCategory(next);setSeats(String(Math.min(Number(seats)||1,categorySeats[next]||13)));}}>
    {['PRIME','SAVER','SPACE','MAX'].map(x=><option key={x}>{x}</option>)}</select></label>
   <label>{t('المقاعد المقترحة','Planned seats')}<input type="number" min={1} max={categorySeats[category]||13} value={seats} disabled={!editable} onChange={e=>setSeats(e.target.value)}/></label>
   <label>{t('رقم اللوحة (اختياري)','Plate number (optional)')}<input value={plate} disabled={!editable} onChange={e=>setPlate(e.target.value)}/></label>
   {editable&&<button type="button" className="d-primary" disabled={busy} onClick={saveVehicle}>{t('احفظ وتابع','Save and continue')}</button>}
   {application?.status==='approved'&&<LiveVehicles/>}
  </div>}
  {!loading&&application&&screen===38&&<div className="d-box">
   <p>{t('الأنواع المعروضة للتقديم الاختياري. وثيقة PRD لم تحدد قائمة إلزامية؛ يراجع المسؤول المستندات المقدمة فقط.','These original design categories are optional. The PRD has not specified a mandatory document list.')}</p>
   {kinds.map(([kind,ar,enLabel])=><div className="c-document" key={kind}>
    <span className="c-document-label">{t(ar,enLabel)}</span>
    <label className="c-file-picker">
     <span className="c-file-picker-button">{t('اختيار ملف','Choose file')}</span>
     <span className="c-file-picker-name" aria-live="polite">
      {fileNames[kind]|| (docs.some(d=>d.kind===kind)?t('يوجد ملف محفوظ','A file is saved'):t('لم يتم اختيار ملف','No file selected'))}
     </span>
     <input className="c-file-native" type="file" aria-label={t(ar,enLabel)}
      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" disabled={!editable||busy}
      onChange={e=>{const file=e.target.files?.[0];if(file){setFileNames(current=>({...current,[kind]:file.name}));upload(kind,file);}e.target.value='';}}/>
    </label>
    <small>{docs.filter(d=>d.kind===kind).length} {t('ملفات محفوظة','saved files')}</small>
   </div>)}
   {editable&&<button type="button" className="d-primary" onClick={()=>onNext(39)}>{t('مراجعة الطلب','Review application')}</button>}
  </div>}
  {!loading&&application&&screen===39&&<div className="d-box">
   <h2>{t('راجع طلب الاعتماد','Review your application')}</h2>
   <p>{t('نبذة مهنية:','Professional background:')} {application?.professional_notes||'—'}</p>
   <p>{t('العربية المقترحة:','Intended vehicle:')} {application?.intended_vehicle_model||'—'} · {application?.intended_category||'—'}</p>
   <p>{t('مستندات مرفوعة:','Uploaded documents:')} {docs.length}</p>
   <p>{t('لا تعتبر المستندات معتمدة بمجرد رفعها.','Uploads are not verification or approval.')}</p>
   {editable&&<button type="button" disabled={busy} className="d-primary" onClick={submit}>{t('قدّم الطلب للمراجعة','Submit for review')}</button>}
   {!editable&&<p role="status">{statusLabel(application?.status)}</p>}
  </div>}
  {!loading&&application&&(screen===40||screen===41)&&<div className="d-box">
   <h2>{t('حالة طلب اعتماد الكابتن','Captain approval status')}</h2>
   <p role="status">{t('الحالة من الخادم:','Server status:')} {statusLabel(application?.status)}</p>
   <p>{t('حالة حساب الكابتن:','Captain account status:')} {statusLabel(approval)}</p>
   {application?.status==='rejected'&&<><p role="alert">{t('سبب الرفض:','Rejection reason:')} {application.rejection_reason||'—'}</p>
    <button type="button" disabled={busy} onClick={editAgain}>{t('عدّل الطلب وأعد تقديمه','Edit and resubmit')}</button></>}
   {application?.status==='approved'&&approval==='approved'&&<>
    <button type="button" className="d-primary" onClick={()=>onNext(37)}>{t('سجّل عربيتك المعتمدة','Register your vehicle')}</button>
    <button type="button" className="d-outline" onClick={()=>onNext(42)}>{t('ابدأ إدارة الخطوط','Manage routes')}</button>
   </>}
   <button type="button" onClick={()=>setRev(n=>n+1)}>{t('تحديث الحالة','Refresh status')}</button>
  </div>}
 </section>;
}
