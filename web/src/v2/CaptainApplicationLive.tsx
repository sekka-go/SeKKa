import {useEffect,useMemo,useState} from 'react';
import {client} from './api';
import {enrollCaptain} from './captainEnrollment';
import LiveVehicles from './LiveVehicles';
import {usePreferences} from './preferences';

const bucket='v31-captain-docs-staging';
const documentKinds=[
 ['identity','إثبات الهوية','Identity proof'],
 ['driving_license','رخصة القيادة','Driving license'],
 ['vehicle_license','رخصة المركبة','Vehicle license'],
 ['vehicle_photo','صورة المركبة','Vehicle photo']
] as const;
type Category='PRIME'|'SAVER'|'SPACE'|'MAX';
const capacities:Record<Category,number>={PRIME:3,SAVER:4,SPACE:9,MAX:13};
const egyptianPhone=/^01[0125]\d{8}$/;
type Application={
 user_id:string;status:string;full_name:string|null;phone_number:string|null;
 professional_notes:string;experience_years:number|null;rejection_reason:string|null;
 vehicle_type:'private_car'|'hiace'|null;vehicle_make_id:number|null;vehicle_model_id:number|null;
 manufacture_year:number|null;vehicle_color_code:string|null;vehicle_color_other:string|null;
 intended_plate:string|null;approved_vehicle_id:string|null;submitted_at:string|null;reviewed_at:string|null
};
type CatalogItem={id:number;name_ar:string;name_en:string;active?:boolean};
type ColorItem={code:string;name_ar:string;name_en:string};
type DocumentRow={id:string;kind:string;object_name:string;created_at:string};

function messageFor(error:unknown,t:(ar:string,en:string)=>string){
 const message=error instanceof Error?error.message:String(error);
 const translations:Record<string,[string,string]>={
  AUTH_REQUIRED:['سجّل الدخول للمتابعة.','Sign in to continue.'],
  BACKEND_NOT_CONFIGURED:['الاتصال بالخادم غير متاح.','The backend is not configured.'],
  INVALID_PROFESSIONAL_DETAILS:['راجع الاسم ورقم الهاتف والخلفية المهنية وسنوات الخبرة.','Check your full name, Egyptian mobile number, professional background, and experience.'],
  INVALID_VEHICLE_DETAILS:['راجع بيانات المركبة واختر قيمًا صالحة من القوائم.','Check the vehicle details and choose valid catalog values.'],
  DUPLICATE_LICENSE_PLATE:['رقم اللوحة مستخدم بالفعل.','This license plate is already registered.'],
  CAPTAIN_PROFILE_INCOMPLETE:['أكمل البيانات الشخصية المطلوبة قبل الإرسال.','Complete the required personal details before submitting.'],
  CAPTAIN_VEHICLE_INCOMPLETE:['أكمل بيانات المركبة المطلوبة قبل الإرسال.','Complete the required vehicle details before submitting.'],
  CAPTAIN_DOCUMENTS_INCOMPLETE:['ارفع المستندات الأربعة المطلوبة قبل الإرسال.','Upload all four required documents before submitting.'],
  INVALID_VEHICLE_CATALOG_SELECTION:['اختيار الشركة أو الموديل غير صالح.','The selected make or model is invalid.'],
  HIACE_CATEGORY_REVIEW_REQUIRED:['يجب على المسؤول تحديد فئات خدمة الهايس عند المراجعة.','An administrator must select the Hiace service categories during review.']
 };
 const code=Object.keys(translations).find(key=>message.includes(key));
 return code?t(...translations[code]):message;
}

export default function CaptainApplicationLive({screen,onNext,onEnrolled}:{
 screen:number;onNext:(screen:number)=>void;onEnrolled?:()=>void;
}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [uid,setUid]=useState<string|null>(null),[application,setApplication]=useState<Application|null>(null);
 const [docs,setDocs]=useState<DocumentRow[]>([]),[approval,setApproval]=useState('not_enrolled');
 const [makes,setMakes]=useState<CatalogItem[]>([]),[models,setModels]=useState<CatalogItem[]>([]);
 const [colors,setColors]=useState<ColorItem[]>([]);
 const [fullName,setFullName]=useState(''),[phone,setPhone]=useState('');
 const [notes,setNotes]=useState(''),[years,setYears]=useState('');
 const [vehicleType,setVehicleType]=useState<'private_car'|'hiace'|''>('');
 const [makeId,setMakeId]=useState(''),[modelId,setModelId]=useState('');
 const [year,setYear]=useState(''),[colorCode,setColorCode]=useState('');
 const [colorOther,setColorOther]=useState(''),[plate,setPlate]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const currentYear=new Date().getFullYear();
 const availableYears=useMemo(()=>Array.from({length:currentYear-1979},(_,i)=>String(currentYear-i)),[currentYear]);
 const requiredKinds=documentKinds.map(([kind])=>kind);
 const hasDocuments=requiredKinds.every(kind=>docs.some(doc=>doc.kind===kind));
 const personalComplete=fullName.trim().split(/\s+/).length>=2&&fullName.trim().length>=5&&
   egyptianPhone.test(phone.replace(/[\s-]/g,''))&&notes.trim().length>=3&&
   years!==''&&Number.isInteger(Number(years))&&Number(years)>=0&&Number(years)<=80;
 const vehicleComplete=!!vehicleType&&!!makeId&&!!modelId&&!!year&&!!colorCode&&
   (colorCode!=='other'||colorOther.trim().length>=2)&&plate.trim().length>=3;
 const editable=application?.status==='draft'||application?.status==='rejected';

 useEffect(()=>{
  let active=true;setLoading(true);setError('');
  void(async()=>{
   try{
    if(!client)throw Error('BACKEND_NOT_CONFIGURED');
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)throw Error('AUTH_REQUIRED');
    const [appResult,docsResult,profileResult,makesResult,colorsResult]=await Promise.all([
     client.from('v31_captain_applications').select(
      'user_id,status,full_name,phone_number,professional_notes,experience_years,rejection_reason,vehicle_type,vehicle_make_id,vehicle_model_id,manufacture_year,vehicle_color_code,vehicle_color_other,intended_plate,approved_vehicle_id,submitted_at,reviewed_at'
     ).eq('user_id',user.id).maybeSingle(),
     client.from('v31_captain_documents').select('id,kind,object_name,created_at')
      .eq('captain_id',user.id).order('created_at',{ascending:false}),
     client.from('v31_captain_profiles').select('approval_status')
      .eq('user_id',user.id).maybeSingle(),
     client.from('v31_vehicle_makes').select('id,name_ar,name_en,active')
      .eq('active',true).order('name_en'),
     client.from('v31_vehicle_colors').select('code,name_ar,name_en')
      .eq('active',true).order('code')
    ]);
    const failure=appResult.error||docsResult.error||profileResult.error||makesResult.error||colorsResult.error;
    if(failure)throw failure;
    if(!active)return;
    const app=appResult.data as Application|null;
    setUid(user.id);setApplication(app);setDocs((docsResult.data||[]) as DocumentRow[]);
    setApproval(profileResult.data?.approval_status||'not_enrolled');
    setMakes((makesResult.data||[]) as CatalogItem[]);setColors((colorsResult.data||[]) as ColorItem[]);
    if(app){
     setFullName(app.full_name||'');setPhone(app.phone_number||'');
     setNotes(app.professional_notes||'');setYears(app.experience_years===null?'':String(app.experience_years));
     setVehicleType(app.vehicle_type||'');setMakeId(app.vehicle_make_id===null?'':String(app.vehicle_make_id));
     setModelId(app.vehicle_model_id===null?'':String(app.vehicle_model_id));
     setYear(app.manufacture_year===null?'':String(app.manufacture_year));
     setColorCode(app.vehicle_color_code||'');setColorOther(app.vehicle_color_other||'');
     setPlate(app.intended_plate||'');
    }
   }catch(e){if(active)setError(messageFor(e,t));}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[revision]);

 useEffect(()=>{
  let active=true;
  if(!client||!makeId){setModels([]);return()=>{active=false;};}
  void client.from('v31_vehicle_models').select('id,name_ar,name_en,active')
   .eq('make_id',Number(makeId)).eq('active',true).order('name_en')
   .then(({data,error:queryError})=>{
    if(!active)return;
    if(queryError){setError(messageFor(queryError,t));return;}
    setModels((data||[]) as CatalogItem[]);
    if(modelId&&!data?.some(row=>String(row.id)===modelId))setModelId('');
   });
  return()=>{active=false;};
 },[makeId,modelId]);

 const run=async(action:()=>Promise<void>)=>{
  setBusy(true);setError('');setNotice('');
  try{await action();setRevision(n=>n+1);}
  catch(e){setError(messageFor(e,t));}
  finally{setBusy(false);}
 };
 const expectRpc=(data:unknown,expected:string)=>{
  if(data!==expected)throw Error('SERVER_RESPONSE_NOT_VERIFIED');
 };
 const statusLabel=(status:string|null|undefined)=>{
  const labels:Record<string,[string,string]>={
   not_enrolled:['لم يبدأ التسجيل','Not enrolled'],draft:['مسودة','Draft'],
   submitted:['قيد المراجعة','Pending review'],pending:['قيد المراجعة','Pending review'],
   approved:['تم الاعتماد','Approved'],rejected:['مرفوض','Rejected'],
   suspended:['موقوف','Suspended']
  };
  const label=status?labels[status]:undefined;
  return label?t(label[0],label[1]):status||t('غير متاح','Unavailable');
 };
 const savePersonal=async(next:boolean)=>{
  if(next&&!personalComplete){
   setError(t('أكمل الاسم بالكامل ورقمًا مصريًا صالحًا والخلفية المهنية وسنوات الخبرة. أدخل 0 صراحةً إذا لم تكن لديك خبرة.',
    'Enter your full name, valid Egyptian mobile, professional background, and years of experience. Enter 0 explicitly if you have no experience.'));
   return;
  }
  await run(async()=>{
   if(!client)throw Error('BACKEND_NOT_CONFIGURED');
   const experience=years.trim()===''?null:Number(years);
   if(experience!==null&&(!Number.isInteger(experience)||experience<0||experience>80))
    throw Error('INVALID_PROFESSIONAL_DETAILS');
   const {data,error:saveError}=await client.rpc('v31_save_captain_application',{
    p_full_name:fullName.trim()||null,p_phone:phone.replace(/[\s-]/g,'')||null,
    p_notes:notes.trim(),p_experience:experience
   });
   if(saveError)throw saveError;expectRpc(data,'draft');
   if(next)onNext(37);else setNotice(t('اتحفظت المسودة. رقم الهاتف مطلوب لكنه غير مؤكد.','Draft saved. The phone number is required but remains unverified.'));
  });
 };
 const saveVehicle=async(next:boolean)=>{
  if(next&&!vehicleComplete){
   setError(t('أكمل نوع المركبة والشركة والموديل وسنة الصنع واللون ورقم اللوحة.','Complete vehicle type, make, model, manufacture year, color, and license plate.'));
   return;
  }
  await run(async()=>{
   if(!client)throw Error('BACKEND_NOT_CONFIGURED');
   const {data,error:saveError}=await client.rpc('v31_save_captain_vehicle_intent',{
    p_vehicle_type:vehicleType||null,p_make_id:makeId?Number(makeId):null,
    p_model_id:modelId?Number(modelId):null,p_year:year?Number(year):null,
    p_color_code:colorCode||null,p_color_other:colorCode==='other'?colorOther.trim():null,
    p_plate:plate.trim()||null
   });
   if(saveError)throw saveError;expectRpc(data,'draft');
   if(next)onNext(38);else setNotice(t('اتحفظت مسودة المركبة.','Vehicle draft saved.'));
  });
 };
 const begin=()=>void run(async()=>{
  await enrollCaptain();
  if(!application){
   const {data,error:saveError}=await client!.rpc('v31_save_captain_application',{
    p_full_name:null,p_phone:null,p_notes:'',p_experience:null
   });
   if(saveError)throw saveError;expectRpc(data,'draft');
  }
  onEnrolled?.();onNext(36);
 });
 const upload=(kind:string,file:File)=>void run(async()=>{
  if(!uid||!client)throw Error('AUTH_REQUIRED');
  if(!['image/jpeg','image/png','application/pdf'].includes(file.type)||file.size<1||file.size>5242880)
   throw Error(t('استخدم JPG أو PNG أو PDF بحد أقصى 5 ميجابايت.','Use JPG, PNG, or PDF up to 5 MB.'));
  const extension=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg';
  const objectName=`${uid}/${crypto.randomUUID()}.${extension}`;
  const {error:storageError}=await client.storage.from(bucket).upload(objectName,file,{
   upsert:false,contentType:file.type
  });
  if(storageError)throw storageError;
  const {data,error:registerError}=await client.rpc('v31_register_captain_document',{
   p_kind:kind,p_object_name:objectName
  });
  if(registerError)throw registerError;
  if(typeof data!=='string')throw Error('DOCUMENT_NOT_REGISTERED');
  setNotice(t('اترفع المستند في مساحة خاصة.','Document uploaded to private storage.'));
 });
 const submit=()=>void run(async()=>{
  if(!personalComplete||!vehicleComplete||!hasDocuments)
   throw Error(!personalComplete?'CAPTAIN_PROFILE_INCOMPLETE':!vehicleComplete?'CAPTAIN_VEHICLE_INCOMPLETE':'CAPTAIN_DOCUMENTS_INCOMPLETE');
  const {data,error:submitError}=await client!.rpc('v31_submit_captain_application');
  if(submitError)throw submitError;expectRpc(data,'submitted');onNext(40);
 });
 const editAgain=()=>void run(async()=>{
  const {data,error:saveError}=await client!.rpc('v31_save_captain_application',{
   p_full_name:fullName.trim()||null,p_phone:phone.replace(/[\s-]/g,'')||null,
   p_notes:notes.trim(),p_experience:years===''?null:Number(years)
  });
  if(saveError)throw saveError;expectRpc(data,'draft');onNext(36);
 });
 const makeName=makes.find(m=>String(m.id)===makeId);
 const modelName=models.find(m=>String(m.id)===modelId);
 const colorName=colors.find(color=>color.code===colorCode);
 const documentProgress=documentKinds.filter(([kind])=>docs.some(doc=>doc.kind===kind)).length;
 const yearOptions=availableYears.map(value=><option key={value} value={value}>{value}</option>);
 return <section className="c-approval-live" dir={en?'ltr':'rtl'} aria-label={t('تسجيل الكابتن','Captain registration')}>
  {loading&&<p role="status">{t('بنحمّل طلب التسجيل…','Loading your registration…')}</p>}
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!loading&&screen===35&&<div className="d-box">
   <p>{t('يبدأ التسجيل كمسودة. رقم الهاتف لا يُعد مؤكدًا، ولا يتم اعتماد أي حساب تلقائيًا.','Registration starts as a draft. Phone numbers are not verified and approval is never automatic.')}</p>
   <p>{t('الحالة:','Status:')} {statusLabel(application?.status)}</p>
   {!application&&<button type="button" className="d-primary" disabled={busy} onClick={begin}>{t('ابدأ التسجيل','Start registration')}</button>}
   {application&&<button type="button" className="d-primary" disabled={busy}
    onClick={()=>onNext(application.status==='submitted'?40:36)}>{t('متابعة الطلب','Continue application')}</button>}
  </div>}
  {!loading&&screen>35&&!application&&<div className="d-box">
   <p role="status">{t('ابدأ طلب التسجيل قبل فتح هذه الخطوة.','Start your registration before opening this step.')}</p>
   <button type="button" className="d-primary" onClick={()=>onNext(35)}>{t('الذهاب لبداية التسجيل','Go to registration start')}</button>
  </div>}
  {!loading&&application&&screen===36&&<div className="d-box c-registration-form">
   <h2>{t('البيانات الشخصية والخبرة','Personal details and experience')}</h2>
   <label>{t('الاسم بالكامل','Full name')}
    <input autoComplete="name" maxLength={100} value={fullName} disabled={!editable}
     onChange={event=>setFullName(event.target.value)}/>
   </label>
   <label>{t('رقم الهاتف المصري (غير مؤكد)','Egyptian mobile number (unverified)')}
    <input type="tel" inputMode="tel" autoComplete="tel-national" maxLength={16}
     value={phone} disabled={!editable} onChange={event=>setPhone(event.target.value)}/>
   </label>
   <p>{t('التحقق برمز OTP مؤجل؛ لن نعرض الرقم كأنه مؤكد.','OTP verification is deferred; this number will not be shown as verified.')}</p>
   <label>{t('الخلفية المهنية','Professional background')}
    <textarea maxLength={1000} value={notes} disabled={!editable} onChange={event=>setNotes(event.target.value)}/>
   </label>
   <label>{t('سنوات الخبرة','Years of experience')}
    <input type="number" min={0} max={80} step={1} value={years} disabled={!editable}
     onChange={event=>setYears(event.target.value)}/>
   </label>
   {editable&&<div className="c-registration-actions">
    <button type="button" disabled={busy} onClick={()=>void savePersonal(false)}>{t('حفظ المسودة','Save draft')}</button>
    <button type="button" className="d-primary" disabled={busy||!personalComplete}
     onClick={()=>void savePersonal(true)}>{t('حفظ ومتابعة','Save and continue')}</button>
   </div>}
  </div>}
  {!loading&&application&&screen>36&&screen<40&&!personalComplete&&
   <div className="d-box" role="alert">
    <p>{t('أكمل البيانات الشخصية المطلوبة أولًا.','Complete the required personal details first.')}</p>
    <button type="button" className="d-primary" onClick={()=>onNext(36)}>{t('العودة للبيانات الشخصية','Back to personal details')}</button>
   </div>}
  {!loading&&application&&screen===37&&personalComplete&&<div className="d-box c-registration-form">
   <h2>{t('المركبة والخدمات المتاحة','Vehicle and eligible services')}</h2>
   <label>{t('نوع المركبة الفعلي','Physical vehicle type')}
    <select value={vehicleType} disabled={!editable} onChange={event=>{
     setVehicleType(event.target.value as 'private_car'|'hiace'|'');
    }}>
     <option value="">{t('اختر نوع المركبة','Select vehicle type')}</option>
     <option value="private_car">{t('سيارة ملاكي','Private car')}</option>
     <option value="hiace">{t('هايس','Hiace')}</option>
    </select>
   </label>
   {vehicleType==='private_car'&&<div className="c-category-summary" role="status">
    <p>{t('السيارة الملاكي تتيح تلقائيًا الفئتين:','A private car automatically enables both:')}</p>
    {(['PRIME','SAVER'] as const).map(category=><span key={category}>
     {category} · {capacities[category]} {t('مقاعد ركاب ثابتة','fixed passenger seats')}
    </span>)}
   </div>}
   {vehicleType==='hiace'&&<p>{t('تُراجع أهلية SPACE وMAX ويحددها المسؤول عند الاعتماد. السعات ثابتة: SPACE 9 وMAX 13.',
    'SPACE/MAX eligibility is selected by an administrator during review. Capacities are fixed: SPACE 9, MAX 13.')}</p>}
   <label>{t('الشركة المصنعة','Manufacturer / make')}
    <select value={makeId} disabled={!editable} onChange={event=>{
     setMakeId(event.target.value);setModelId('');
    }}>
     <option value="">{t('اختر الشركة','Select manufacturer')}</option>
     {makes.map(make=><option key={make.id} value={make.id}>{en?make.name_en:make.name_ar}</option>)}
    </select>
   </label>
   <label>{t('الموديل','Model')}
    <select value={modelId} disabled={!editable||!makeId} onChange={event=>setModelId(event.target.value)}>
     <option value="">{t('اختر الموديل','Select model')}</option>
     {models.map(model=><option key={model.id} value={model.id}>{en?model.name_en:model.name_ar}</option>)}
    </select>
   </label>
   <label>{t('سنة الصنع','Manufacture year')}
    <select value={year} disabled={!editable} onChange={event=>setYear(event.target.value)}>
     <option value="">{t('اختر سنة الصنع','Select year')}</option>{yearOptions}
    </select>
   </label>
   <label>{t('لون المركبة','Vehicle color')}
    <select value={colorCode} disabled={!editable} onChange={event=>{
     setColorCode(event.target.value);if(event.target.value!=='other')setColorOther('');
    }}>
     <option value="">{t('اختر اللون','Select color')}</option>
     {colors.map(color=><option key={color.code} value={color.code}>{en?color.name_en:color.name_ar}</option>)}
    </select>
   </label>
   {colorCode==='other'&&<label>{t('اكتب اللون','Specify color')}
    <input maxLength={40} value={colorOther} disabled={!editable} onChange={event=>setColorOther(event.target.value)}/>
   </label>}
   <label>{t('رقم لوحة المركبة','License plate number')}
    <input autoCapitalize="characters" maxLength={24} value={plate} disabled={!editable}
     onChange={event=>setPlate(event.target.value)}/>
   </label>
   {editable&&<div className="c-registration-actions">
    <button type="button" disabled={busy} onClick={()=>void saveVehicle(false)}>{t('حفظ المسودة','Save draft')}</button>
    <button type="button" className="d-primary" disabled={busy||!vehicleComplete}
     onClick={()=>void saveVehicle(true)}>{t('حفظ ومتابعة','Save and continue')}</button>
   </div>}
   {application.status==='approved'&&<LiveVehicles/>}
  </div>}
  {!loading&&application&&screen>37&&screen<40&&!vehicleComplete&&personalComplete&&
   <div className="d-box" role="alert">
    <p>{t('أكمل بيانات المركبة المطلوبة أولًا.','Complete the required vehicle details first.')}</p>
    <button type="button" className="d-primary" onClick={()=>onNext(37)}>{t('العودة لبيانات المركبة','Back to vehicle details')}</button>
   </div>}
  {!loading&&application&&screen===38&&personalComplete&&vehicleComplete&&<div className="d-box c-registration-form">
   <h2>{t('المستندات المطلوبة','Required documents')}</h2>
   <p>{t('ارفع المستندات الأربعة قبل الانتقال للمراجعة. الملفات خاصة ولا تُعد موافقة أو تحققًا.',
    'Upload all four documents before review. Files are private and do not imply verification or approval.')}</p>
   {documentKinds.map(([kind,ar,label])=>{
    const saved=docs.some(doc=>doc.kind===kind);
    return <div className="c-document" key={kind}>
     <span className="c-document-label">{t(ar,label)} · {saved?t('تم الرفع','Uploaded'):t('مطلوب','Required')}</span>
     <label className="c-file-picker">
      <span className="c-file-picker-button">{t('اختيار ملف','Choose file')}</span>
      <span className="c-file-picker-name" aria-live="polite">
       {saved?t('يوجد ملف محفوظ','A file is saved'):t('لم يتم اختيار ملف','No file selected')}
      </span>
      <input className="c-file-native" type="file" aria-label={t(ar,label)}
       accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
       disabled={!editable||busy} onChange={event=>{
        const file=event.target.files?.[0];if(file)upload(kind,file);event.target.value='';
       }}/>
     </label>
    </div>;
   })}
   <p role="status">{documentProgress}/4 {t('مستندات مطلوبة مكتملة','required documents complete')}</p>
   {editable&&<button type="button" className="d-primary" disabled={busy||!hasDocuments}
    onClick={()=>onNext(39)}>{t('مراجعة الطلب','Review application')}</button>}
  </div>}
  {!loading&&application&&screen===39&&<div className="d-box c-registration-form">
   <h2>{t('مراجعة طلب التسجيل','Review your registration')}</h2>
   <h3>{t('البيانات الشخصية','Personal details')}</h3>
   <p>{t('الاسم بالكامل:','Full name:')} {fullName||'—'}</p>
   <p>{t('الهاتف (غير مؤكد):','Phone (unverified):')} {phone||'—'}</p>
   <p>{t('الخلفية المهنية:','Professional background:')} {notes||'—'}</p>
   <p>{t('سنوات الخبرة:','Years of experience:')} {years===''?'—':years}</p>
   <h3>{t('بيانات المركبة','Vehicle details')}</h3>
   <p>{t('النوع:','Type:')} {vehicleType==='private_car'?t('ملاكي','Private car'):vehicleType==='hiace'?t('هايس','Hiace'):'—'}</p>
   <p>{t('الشركة والموديل:','Make and model:')} {en?`${makeName?.name_en||'—'} ${modelName?.name_en||''}`:`${makeName?.name_ar||'—'} ${modelName?.name_ar||''}`}</p>
   <p>{t('سنة الصنع:','Manufacture year:')} {year||'—'}</p>
   <p>{t('اللون:','Color:')} {colorCode==='other'?colorOther:(en?colorName?.name_en:colorName?.name_ar)||'—'}</p>
   <p>{t('رقم اللوحة:','License plate:')} {plate||'—'}</p>
   {vehicleType==='private_car'&&<p>PRIME · 3 {t('مقاعد','seats')} / SAVER · 4 {t('مقاعد','seats')}</p>}
   {vehicleType==='hiace'&&<p>SPACE · 9 {t('مقاعد','seats')} / MAX · 13 {t('مقاعد','seats')} · {t('تحديد المسؤول','Admin selected')}</p>}
   <h3>{t('المستندات','Documents')}</h3>
   <ul>{documentKinds.map(([kind,ar,label])=><li key={kind}>
    {t(ar,label)} — {docs.some(doc=>doc.kind===kind)?t('مكتمل','Complete'):t('ناقص','Missing')}
   </li>)}</ul>
   <p>{t('لا يتم تأكيد رقم الهاتف أو اعتماد المركبة تلقائيًا.','Phone verification and vehicle approval are not automatic.')}</p>
   {editable&&<button type="button" disabled={busy||!personalComplete||!vehicleComplete||!hasDocuments}
    className="d-primary" onClick={submit}>{t('إرسال للمراجعة الإدارية','Submit for Admin review')}</button>}
   {!editable&&<p role="status">{statusLabel(application.status)}</p>}
  </div>}
  {!loading&&application&&(screen===40||screen===41)&&<div className="d-box c-registration-form">
   <h2>{t('حالة طلب التسجيل','Registration status')}</h2>
   <p role="status">{t('حالة الطلب من الخادم:','Application status from server:')} {statusLabel(application.status)}</p>
   <p>{t('حالة حساب الكابتن:','Captain account status:')} {statusLabel(approval)}</p>
   {application.status==='rejected'&&<>
    <p role="alert">{t('سبب الرفض:','Rejection reason:')} {application.rejection_reason||'—'}</p>
    <button type="button" disabled={busy} onClick={editAgain}>{t('تعديل البيانات وإعادة التقديم','Edit details and resubmit')}</button>
   </>}
   {application.status==='approved'&&approval==='approved'&&<>
    <p>{t('تم اعتماد الطلب وتفعيل المركبة بواسطة المسؤول.','The application was approved and the vehicle activated by an administrator.')}</p>
    <LiveVehicles/>
    <button type="button" className="d-primary" onClick={()=>onNext(42)}>{t('إنشاء خط','Create a route')}</button>
   </>}
   <button type="button" disabled={busy} onClick={()=>setRevision(n=>n+1)}>{t('تحديث الحالة','Refresh status')}</button>
  </div>}
 </section>;
}
