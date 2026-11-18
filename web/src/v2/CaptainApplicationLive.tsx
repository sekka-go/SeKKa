import {useEffect,useMemo,useState} from 'react';
import {client} from './api';
import {enrollCaptain} from './captainEnrollment';
import LiveVehicles from './LiveVehicles';
import {usePreferences} from './preferences';
import {
 captainPersonalErrors,captainVehicleErrors,normalizeNumerals,canonicalEgyptianPlate
} from './captainValidation';
import type {
 CaptainFieldError,CaptainPersonalField,CaptainVehicleField
} from './captainValidation';

const bucket='v31-captain-docs-staging';
const documentKinds=[
 ['identity','إثبات الهوية','Identity proof'],
 ['driving_license','رخصة القيادة','Driving license'],
 ['vehicle_license','رخصة المركبة','Vehicle license'],
 ['vehicle_photo','صورة المركبة','Vehicle photo']
] as const;
type Category='PRIME'|'SAVER'|'SPACE'|'MAX';
const capacities:Record<Category,number>={PRIME:3,SAVER:4,SPACE:9,MAX:13};
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
  HIACE_CATEGORY_REVIEW_REQUIRED:['يجب على المسؤول تحديد فئات خدمة الهايس عند المراجعة.','An administrator must select the Hiace service categories during review.'],
  DRAFT_SAVE_NOT_VERIFIED:['ما قدرناش نتأكد من حفظ بياناتك. حاول تاني.','We could not verify that your draft was saved. Please retry.'],
  SERVER_RESPONSE_NOT_VERIFIED:['ما قدرناش نتأكد من حالة الطلب. حاول تاني.','We could not verify the application status. Please retry.'],
  DOCUMENT_NOT_REGISTERED:['ما قدرناش نتأكد من حفظ المستند. حاول تاني.','We could not verify that the document was saved. Please retry.'],
  UPLOAD_NOT_VERIFIED:['التخزين ما أكدش رفع الملف. حاول تاني.','Storage did not verify the upload. Retry.'],
  FILE_READ_FAILED:['الموبايل ما قدرش يقرأ الملف. افتحه من الملفات أو الصور وحاول تاني.','The device could not read the file. Choose it again from Files or Photos.'],
  APPLICATION_LOCKED:['الطلب في حالة لا تسمح بالرفع. راجع حالته.','The application is not editable. Review its status.']
 };
 if(/row.level security|permission denied|\b403\b|AccessDenied|not authorized/i.test(message))
  return t('التخزين رفض العملية. تأكد إن طلب الكابتن مسودة وإنك داخل بنفس حساب Google، ثم جرّب تاني.','Storage denied the operation. Check that your Captain application is a draft and you are signed into the same Google account, then retry.');
 if(/failed to fetch|networkerror|network request failed|timeout/i.test(message))
  return t('الاتصال اتقطع أثناء الحفظ. راجع الإنترنت وجرب تاني.','The connection was interrupted. Check your internet connection and retry.');
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
 const [loadError,setLoadError]=useState(''),[showPersonalErrors,setShowPersonalErrors]=useState(false);
 const [showVehicleErrors,setShowVehicleErrors]=useState(false);
 const [notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const [uploadingKind,setUploadingKind]=useState<string|null>(null),[uploadError,setUploadError]=useState(''),[uploadErrorKind,setUploadErrorKind]=useState<string|null>(null);
 const [uploadingFileName,setUploadingFileName]=useState('');
 const [uploadStage,setUploadStage]=useState<'idle'|'reading'|'uploading'|'registering'|'verifying'>('idle');
 const currentYear=new Date().getFullYear();
 const availableYears=useMemo(()=>Array.from({length:currentYear-1979},(_,i)=>String(currentYear-i)),[currentYear]);
 const requiredKinds=documentKinds.map(([kind])=>kind);
 const hasDocuments=requiredKinds.every(kind=>docs.some(doc=>doc.kind===kind));
 const personalErrors=captainPersonalErrors({
  fullName,phone,professionalBackground:notes,experienceYears:years
 });
 const vehicleErrors=captainVehicleErrors({
  vehicleType,makeId,modelId,year,colorCode,colorOther,plate
 },currentYear);
 const personalComplete=Object.keys(personalErrors).length===0;
 const vehicleComplete=Object.keys(vehicleErrors).length===0;
 const visiblePersonalErrors=showPersonalErrors?personalErrors:{};
 const visibleVehicleErrors=showVehicleErrors?vehicleErrors:{};
 const editable=application?.status==='draft'||application?.status==='rejected';

 useEffect(()=>{
  let active=true;setLoading(true);setError('');setLoadError('');
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
    setMakes((makesResult.data||[]) as CatalogItem[]);
    setColors(((colorsResult.data||[]) as ColorItem[]).sort((a,b)=>Number(a.code==='other')-Number(b.code==='other')));
    if(app){
     setFullName(app.full_name||'');setPhone(app.phone_number||'');
     setNotes(app.professional_notes||'');setYears(app.experience_years===null?'':String(app.experience_years));
     setVehicleType(app.vehicle_type||'');setMakeId(app.vehicle_make_id===null?'':String(app.vehicle_make_id));
     setModelId(app.vehicle_model_id===null?'':String(app.vehicle_model_id));
     setYear(app.manufacture_year===null?'':String(app.manufacture_year));
     setColorCode(app.vehicle_color_code||'');setColorOther(app.vehicle_color_other||'');
     setPlate(app.intended_plate||'');
    }
   }catch{if(active){
    const loadMessage=t('تعذّر تحميل طلب التسجيل. حاول تاني.','We could not load your application. Please retry.');
    setLoadError(loadMessage);setError(loadMessage);
   }}
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
 const readSavedApplication=async()=>{
  if(!client||!uid)throw Error('AUTH_REQUIRED');
  const {data,error:readError}=await client.from('v31_captain_applications').select(
   'user_id,status,full_name,phone_number,professional_notes,experience_years,rejection_reason,vehicle_type,vehicle_make_id,vehicle_model_id,manufacture_year,vehicle_color_code,vehicle_color_other,intended_plate,approved_vehicle_id,submitted_at,reviewed_at'
  ).eq('user_id',uid).maybeSingle();
  if(readError)throw readError;
  return data as Application|null;
 };
 const focusField=(name:string)=>{
  const field=document.getElementById(`captain-${name}`);
  field?.scrollIntoView({block:'center',behavior:'smooth'});
  field?.focus({preventScroll:true});
 };
 const personalErrorText=(field:CaptainPersonalField,error:CaptainFieldError)=>{
  const messages:Record<CaptainPersonalField,Record<CaptainFieldError,[string,string]>>={
   fullName:{
    required:['اكتب اسمك بالكامل.','Enter your full name.'],
    invalid:['اكتب 3 أسماء على الأقل زي المكتوب في البطاقة.','Enter at least three names matching your ID.']
   },
   phone:{
    required:['اكتب رقم موبايلك.','Enter your mobile number.'],
    invalid:['اكتب رقم موبايل مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015.','Enter a valid Egyptian mobile number (010, 011, 012 or 015).']
   },
   professionalBackground:{
    required:['اكتب نبذة قصيرة عن خبرتك المهنية.','Add a short professional background.'],
    invalid:['اكتب وصفًا واضحًا من 3 كلمات و15 حرفًا على الأقل، مش حروف عشوائية.','Write a meaningful description of at least three words and 15 characters.']
   },
   experienceYears:{
    required:['اكتب عدد سنين الخبرة؛ ينفع 0.','Enter your years of experience; 0 is valid.'],
    invalid:['اكتب عددًا صحيحًا من 0 إلى 30.','Enter a whole number from 0 to 30.']
   }
  };
  const [ar,enMessage]=messages[field][error];
  return t(ar,enMessage);
 };
 const vehicleErrorText=(field:CaptainVehicleField,error:CaptainFieldError)=>{
  const messages:Record<CaptainVehicleField,Record<CaptainFieldError,[string,string]>>={
   vehicleType:{required:['اختار نوع المركبة.','Select a vehicle type.'],invalid:['اختار نوع مركبة صحيح.','Choose a valid vehicle type.']},
   makeId:{required:['اختار الشركة المصنعة.','Select a manufacturer.'],invalid:['اختار شركة مصنعة صحيحة.','Select a valid manufacturer.']},
   modelId:{required:['اختار موديل العربية.','Select a vehicle model.'],invalid:['اختار موديلًا تابعًا للشركة المحددة.','Choose a model from the selected manufacturer.']},
   year:{required:['اختار سنة الصنع.','Select the manufacture year.'],invalid:['اختار سنة من 1980 لحد السنة الحالية.','Choose a year from 1980 through the current year.']},
   colorCode:{required:['اختار لون العربية.','Select a vehicle color.'],invalid:['اختار لونًا من القائمة.','Choose a color from the list.']},
   colorOther:{required:['اكتب لون العربية.','Enter the vehicle color.'],invalid:['اكتب لونًا من حرفين على الأقل.','Enter a color with at least 2 characters.']},
   plate:{required:['اكتب رقم لوحة العربية.','Enter the license plate number.'],invalid:['لوحة عادية: القاهرة 3 حروف و3 أرقام، الجيزة حرفين و4 أرقام، وباقي المحافظات 3 حروف و4 أرقام.','Standard plate: Cairo 3 letters/3 digits, Giza 2 letters/4 digits, other governorates 3 letters/4 digits.']}
  };
  const [ar,enMessage]=messages[field][error];
  return t(ar,enMessage);
 };
 const statusLabel=(status:string|null|undefined)=>{
  const labels:Record<string,[string,string]>={
   not_enrolled:['لم يبدأ التسجيل','Not enrolled'],draft:['مسودة','Draft'],
   submitted:['قيد المراجعة','Pending review'],pending:['قيد المراجعة','Pending review'],
   approved:['تم الاعتماد','Approved'],rejected:['مرفوض','Rejected'],
   suspended:['موقوف','Suspended']
  };
  const label=status?labels[status]:undefined;
  return label?t(label[0],label[1]):status||t('حالة غير معروفة','Unknown status');
 };
 const savePersonal=async(next:boolean)=>{
 const fieldErrors=personalErrors;
 const invalidDraft=Object.values(fieldErrors).some(value=>value==='invalid');
 if((next&&Object.keys(fieldErrors).length>0)||(!next&&invalidDraft)){
  setError('');
  setShowPersonalErrors(true);
  const firstField=Object.keys(fieldErrors)[0];
  if(firstField)focusField(firstField);
   return;
  }
  await run(async()=>{
   if(!client)throw Error('BACKEND_NOT_CONFIGURED');
  const experience=years.trim()===''?null:Number(normalizeNumerals(years));
  const normalizedPhone=normalizeNumerals(phone).replace(/[\s-]/g,'');
   const {data,error:saveError}=await client.rpc('v31_save_captain_application',{
   p_full_name:fullName.trim()||null,p_phone:normalizedPhone||null,
    p_notes:notes.trim(),p_experience:experience
   });
   if(saveError)throw saveError;expectRpc(data,'draft');
  const saved=await readSavedApplication();
  if(!saved||saved.status!=='draft'||saved.full_name!==(fullName.trim()||null)||
     saved.phone_number!==(normalizedPhone||null)||saved.professional_notes!==notes.trim()||
     saved.experience_years!==experience)throw Error('DRAFT_SAVE_NOT_VERIFIED');
   if(next)onNext(37);else setNotice(t('اتحفظت، وتقدر تكمّل بعدين.','Saved. You can continue later.'));
  });
 };
 const saveVehicle=async(next:boolean)=>{
 const fieldErrors=vehicleErrors;
 const invalidDraft=Object.values(fieldErrors).some(value=>value==='invalid');
 if((next&&Object.keys(fieldErrors).length>0)||(!next&&invalidDraft)){
  setError('');
  setShowVehicleErrors(true);
  const firstField=Object.keys(fieldErrors)[0];
  if(firstField)focusField(firstField);
   return;
  }
  await run(async()=>{
   if(!client)throw Error('BACKEND_NOT_CONFIGURED');
   const {data,error:saveError}=await client.rpc('v31_save_captain_vehicle_intent',{
    p_vehicle_type:vehicleType||null,p_make_id:makeId?Number(makeId):null,
    p_model_id:modelId?Number(modelId):null,p_year:year?Number(year):null,
    p_color_code:colorCode||null,p_color_other:colorCode==='other'?colorOther.trim():null,
    p_plate:plate.trim()?canonicalEgyptianPlate(plate):null
   });
   if(saveError)throw saveError;expectRpc(data,'draft');
   const saved=await readSavedApplication();
   const normalizedColorOther=colorCode==='other'?colorOther.trim()||null:null;
   if(!saved||saved.status!=='draft'||saved.vehicle_type!==(vehicleType||null)||
      saved.vehicle_make_id!==(makeId?Number(makeId):null)||
      saved.vehicle_model_id!==(modelId?Number(modelId):null)||
      saved.manufacture_year!==(year?Number(year):null)||
      saved.vehicle_color_code!==(colorCode||null)||
      saved.vehicle_color_other!==normalizedColorOther||
      saved.intended_plate!==(plate.trim()?canonicalEgyptianPlate(plate):null))throw Error('DRAFT_SAVE_NOT_VERIFIED');
   if(next)onNext(38);else setNotice(t('اتحفظت بيانات العربية، وتقدر تكمّل بعدين.','Vehicle details saved. You can continue later.'));
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
  const saved=await readSavedApplication();
  if(!saved||saved.status!=='draft')throw Error('DRAFT_SAVE_NOT_VERIFIED');
  onEnrolled?.();onNext(36);
 });
 const upload=(kind:string,file:File)=>{
  if(!editable||uploadingKind||busy)return;
  setUploadingKind(kind);setUploadingFileName(file.name);
  setUploadStage('reading');setUploadError('');setUploadErrorKind(kind);
  void run(async()=>{
   let stage:'reading'|'uploading'|'registering'|'verifying'='reading';
   try{
    if(!uid||!client)throw Error('AUTH_REQUIRED');
    if(!editable)throw Error('APPLICATION_LOCKED');
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||user?.id!==uid)throw Error('AUTH_REQUIRED');
    if(file.size<1||file.size>5242880)
     throw Error(t('اختار ملف أكبر من صفر ولحد 5 ميجابايت.','Choose a non-empty file up to 5 MB.'));
    // Android document providers often return generic MIME types. Verify
    // magic bytes and upload the exact ArrayBuffer with an explicit type.
    let buffer:ArrayBuffer;
    try{buffer=await file.arrayBuffer();}catch{throw Error('FILE_READ_FAILED');}
    const bytes=new Uint8Array(buffer,0,Math.min(8,buffer.byteLength));
    const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
    const png=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a;
    const pdf=bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d;
    if(!jpeg&&!png&&!pdf)throw Error(t('صيغة الملف غير مدعومة. اختار JPG أو PNG أو PDF حقيقي.','Unsupported format. Select a genuine JPG, PNG, or PDF.'));
    const extension=pdf?'pdf':png?'png':'jpg';
    const verifiedMime=pdf?'application/pdf':png?'image/png':'image/jpeg';
    const objectName=uid+'/'+crypto.randomUUID()+'.'+extension;
    stage='uploading';setUploadStage(stage);
    const {data:uploaded,error:storageError}=await client.storage.from(bucket)
     .upload(objectName,buffer,{upsert:false,contentType:verifiedMime});
    if(storageError)throw storageError;
    if(uploaded?.path!==objectName)throw Error('UPLOAD_NOT_VERIFIED');
    stage='registering';setUploadStage(stage);
    const {data,error:registerError}=await client.rpc('v31_register_captain_document',{
     p_kind:kind,p_object_name:objectName
    });
    if(registerError)throw registerError;
    if(typeof data!=='string')throw Error('DOCUMENT_NOT_REGISTERED');
    stage='verifying';setUploadStage(stage);
    const {data:registered,error:readError}=await client.from('v31_captain_documents')
     .select('id,kind,object_name,created_at').eq('captain_id',uid).eq('kind',kind)
     .eq('object_name',objectName).maybeSingle();
    if(readError)throw readError;
    if(!registered||registered.id!==data)throw Error('DOCUMENT_NOT_REGISTERED');
    setDocs(current=>[registered as DocumentRow,...current.filter(doc=>doc.id!==registered.id)]);
    setNotice(t('المستند اتحفظ واتأكدنا منه على الخادم.','Document uploaded and verified on the server.'));
   }catch(e){
    const stageLabel:Record<typeof stage,[string,string]>={
     reading:['قراءة الملف','reading the file'],uploading:['رفع الملف','uploading the file'],
     registering:['تسجيل المستند','registering the document'],verifying:['التحقق من الحفظ','verifying the saved document']
    };
    setUploadError(t('المستند ما اتحفظش أثناء ','Document was not saved while ')+t(...stageLabel[stage])+'. '+messageFor(e,t));
    throw e;
   }
  }).finally(()=>{setUploadingKind(null);setUploadingFileName('');setUploadStage('idle');});
 };
 const submit=()=>void run(async()=>{
  if(!personalComplete||!vehicleComplete||!hasDocuments)
   throw Error(!personalComplete?'CAPTAIN_PROFILE_INCOMPLETE':!vehicleComplete?'CAPTAIN_VEHICLE_INCOMPLETE':'CAPTAIN_DOCUMENTS_INCOMPLETE');
  const {data,error:submitError}=await client!.rpc('v31_submit_captain_application');
  if(submitError)throw submitError;expectRpc(data,'submitted');
  const saved=await readSavedApplication();
  if(!saved||saved.status!=='submitted')throw Error('SERVER_RESPONSE_NOT_VERIFIED');
  onNext(40);
 });
 const editAgain=()=>void run(async()=>{
  const {data,error:saveError}=await client!.rpc('v31_save_captain_application',{
   p_full_name:fullName.trim()||null,
   p_phone:normalizeNumerals(phone).replace(/[\s-]/g,'')||null,
   p_notes:notes.trim(),p_experience:years===''?null:Number(normalizeNumerals(years))
  });
  if(saveError)throw saveError;expectRpc(data,'draft');
  const saved=await readSavedApplication();
  if(!saved||saved.status!=='draft')throw Error('DRAFT_SAVE_NOT_VERIFIED');
  onNext(36);
 });
 const makeName=makes.find(m=>String(m.id)===makeId);
 const modelName=models.find(m=>String(m.id)===modelId);
 const colorName=colors.find(color=>color.code===colorCode);
 const documentProgress=documentKinds.filter(([kind])=>docs.some(doc=>doc.kind===kind)).length;
 const yearOptions=availableYears.map(value=><option key={value} value={value}>{value}</option>);
 return <section className="c-approval-live" dir={en?'ltr':'rtl'} aria-label={t('تسجيل الكابتن','Captain registration')}>
  {loading&&<p role="status">{t('بنحمّل طلب التسجيل…','Loading your registration…')}</p>}
  {error&&<p role="alert">{error}</p>}
  {loadError&&!loading&&<button type="button" className="d-primary" onClick={()=>setRevision(n=>n+1)}>
   {t('إعادة المحاولة','Retry')}
  </button>}
  {notice&&<p role="status">{notice}</p>}
  {!loading&&!loadError&&screen===35&&<div className="d-box">
   <p>{t('ابدأ بياناتك واحفظها عشان تقدر تكمّل وقت ما تحب. هنراجع طلبك قبل تفعيل الحساب.','Start your details and save them to continue later. We review every application before activation.')}</p>
   <p>{t('تسجيلك:','Application:')} {statusLabel(application?.status||'not_enrolled')}
    {application?.status==='draft'&&' · '+t('المسودة محفوظة','Draft saved')}</p>
   {!application&&<button type="button" className="d-primary" disabled={busy} onClick={begin}>{t('ابدأ التسجيل','Start registration')}</button>}
   {application&&<button type="button" className="d-primary" disabled={busy}
    onClick={()=>onNext(application.status==='submitted'?40:36)}>{t('متابعة الطلب','Continue application')}</button>}
  </div>}
  {!loading&&!loadError&&screen>35&&!application&&<div className="d-box">
   <p role="status">{t('ابدأ طلب التسجيل قبل فتح هذه الخطوة.','Start your registration before opening this step.')}</p>
   <button type="button" className="d-primary" onClick={()=>onNext(35)}>{t('الذهاب لبداية التسجيل','Go to registration start')}</button>
  </div>}
  {!loading&&!loadError&&application&&screen===36&&<div className="d-box c-registration-form">
   <h2>{t('البيانات الشخصية والخبرة','Personal details and experience')}</h2>
   <label htmlFor="captain-fullName">{t('الاسم الثلاثي على الأقل — مطابق للبطاقة','Full name (at least 3 names, matching ID)')}
    <input id="captain-fullName" autoComplete="name" maxLength={100} value={fullName} disabled={!editable}
     aria-invalid={Boolean(visiblePersonalErrors.fullName)}
     aria-describedby={visiblePersonalErrors.fullName?'captain-fullName-error':undefined}
     onChange={event=>setFullName(event.target.value)} onBlur={()=>setShowPersonalErrors(true)}/>
    {visiblePersonalErrors.fullName&&<span id="captain-fullName-error" className="c-field-error" role="alert">
     {personalErrorText('fullName',visiblePersonalErrors.fullName)}</span>}
   </label>
   <label htmlFor="captain-phone">{t('رقم الموبايل المصري','Egyptian mobile number')}
    <input id="captain-phone" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={16}
     value={phone} disabled={!editable} aria-invalid={Boolean(visiblePersonalErrors.phone)}
     aria-describedby={visiblePersonalErrors.phone?'captain-phone-error':undefined}
     onChange={event=>setPhone(event.target.value)} onBlur={()=>setShowPersonalErrors(true)}/>
    {visiblePersonalErrors.phone&&<span id="captain-phone-error" className="c-field-error" role="alert">
     {personalErrorText('phone',visiblePersonalErrors.phone)}</span>}
   </label>
   <p className="c-form-hint">{t('الرقم مطلوب للتواصل. بنراجع صيغته فقط؛ تأكيد ملكيته برسالة SMS مؤجّل حاليًا.','The phone is for contact. Its format is checked, but SMS ownership verification is postponed; the number is unverified.')}</p>
   <label htmlFor="captain-professionalBackground">{t('الخلفية المهنية','Professional background')}
    <textarea id="captain-professionalBackground" maxLength={1000} value={notes} disabled={!editable}
     aria-invalid={Boolean(visiblePersonalErrors.professionalBackground)}
     aria-describedby={visiblePersonalErrors.professionalBackground?'captain-professionalBackground-error':undefined}
     onChange={event=>setNotes(event.target.value)} onBlur={()=>setShowPersonalErrors(true)}/>
    {visiblePersonalErrors.professionalBackground&&<span id="captain-professionalBackground-error" className="c-field-error" role="alert">
     {personalErrorText('professionalBackground',visiblePersonalErrors.professionalBackground)}</span>}
   </label>
   <p className="c-form-hint">{t('اكتب جملة عن خبرتك في القيادة؛ مثال: بشتغل في نقل الركاب وبحافظ على المواعيد وسلامة الركاب.','Write one sentence about your work and driving experience; e.g. I drive passengers on regular routes and prioritize safety and punctuality.')}</p>
   <label htmlFor="captain-experienceYears">{t('سنوات الخبرة','Years of experience')}
    <input id="captain-experienceYears" type="number" inputMode="numeric" min={0} max={30} step={1}
     value={years} disabled={!editable} aria-invalid={Boolean(visiblePersonalErrors.experienceYears)}
     aria-describedby={visiblePersonalErrors.experienceYears?'captain-experienceYears-error':undefined}
     onChange={event=>setYears(normalizeNumerals(event.target.value))} onBlur={()=>setShowPersonalErrors(true)}/>
    {visiblePersonalErrors.experienceYears&&<span id="captain-experienceYears-error" className="c-field-error" role="alert">
     {personalErrorText('experienceYears',visiblePersonalErrors.experienceYears)}</span>}
   </label>
   {editable&&<div className="c-registration-actions">
    <button type="button" disabled={busy} onClick={()=>void savePersonal(false)}>{t('حفظ واستكمال لاحقًا','Save for later')}</button>
    <button type="button" className="d-primary" disabled={busy}
     onClick={()=>void savePersonal(true)}>{t('حفظ ومتابعة','Save and continue')}</button>
   </div>}
  </div>}
  {!loading&&!loadError&&application&&screen>36&&screen<40&&!personalComplete&&
   <div className="d-box" role="alert">
    <p>{t('أكمل البيانات الشخصية المطلوبة أولًا.','Complete the required personal details first.')}</p>
    <button type="button" className="d-primary" onClick={()=>onNext(36)}>{t('العودة للبيانات الشخصية','Back to personal details')}</button>
   </div>}
  {!loading&&!loadError&&application&&screen===37&&personalComplete&&<div className="d-box c-registration-form">
   <h2>{t('المركبة والخدمات المتاحة','Vehicle and eligible services')}</h2>
   <label htmlFor="captain-vehicleType">{t('نوع المركبة الفعلي','Physical vehicle type')}
    <select id="captain-vehicleType" value={vehicleType} disabled={!editable}
     aria-invalid={Boolean(visibleVehicleErrors.vehicleType)}
     aria-describedby={visibleVehicleErrors.vehicleType?'captain-vehicleType-error':undefined}
     onChange={event=>{
     setVehicleType(event.target.value as 'private_car'|'hiace'|'');
    }}>
     <option value="">{t('اختر نوع المركبة','Select vehicle type')}</option>
     <option value="private_car">{t('سيارة ملاكي','Private car')}</option>
     <option value="hiace">{t('هايس','Hiace')}</option>
    </select>
    {visibleVehicleErrors.vehicleType&&<span id="captain-vehicleType-error" className="c-field-error" role="alert">
     {vehicleErrorText('vehicleType',visibleVehicleErrors.vehicleType)}</span>}
   </label>
   {vehicleType==='private_car'&&<div className="c-category-summary" role="status">
    <p>{t('السيارة الملاكي تتيح تلقائيًا الفئتين:','A private car automatically enables both:')}</p>
    {(['PRIME','SAVER'] as const).map(category=><span key={category}>
     {category} · {capacities[category]} {t('مقاعد ركاب ثابتة','fixed passenger seats')}
    </span>)}
   </div>}
   {vehicleType==='hiace'&&<p>{t('تُراجع أهلية SPACE وMAX ويحددها المسؤول عند الاعتماد. السعات ثابتة: SPACE 9 وMAX 13.',
    'SPACE/MAX eligibility is selected by an administrator during review. Capacities are fixed: SPACE 9, MAX 13.')}</p>}
   <label htmlFor="captain-makeId">{t('الشركة المصنعة','Manufacturer / make')}
    <select id="captain-makeId" value={makeId} disabled={!editable}
     aria-invalid={Boolean(visibleVehicleErrors.makeId)}
     aria-describedby={visibleVehicleErrors.makeId?'captain-makeId-error':undefined}
     onChange={event=>{
     setMakeId(event.target.value);setModelId('');
    }}>
     <option value="">{t('اختر الشركة','Select manufacturer')}</option>
     {makes.map(make=><option key={make.id} value={make.id}>{en?make.name_en:make.name_ar}</option>)}
    </select>
    {visibleVehicleErrors.makeId&&<span id="captain-makeId-error" className="c-field-error" role="alert">
     {vehicleErrorText('makeId',visibleVehicleErrors.makeId)}</span>}
   </label>
   <label htmlFor="captain-modelId">{t('الموديل','Model')}
    <select id="captain-modelId" value={modelId} disabled={!editable||!makeId}
     aria-invalid={Boolean(visibleVehicleErrors.modelId)}
     aria-describedby={visibleVehicleErrors.modelId?'captain-modelId-error':undefined}
     onChange={event=>setModelId(event.target.value)}>
     <option value="">{t('اختر الموديل','Select model')}</option>
     {models.map(model=><option key={model.id} value={model.id}>{en?model.name_en:model.name_ar}</option>)}
    </select>
    {visibleVehicleErrors.modelId&&<span id="captain-modelId-error" className="c-field-error" role="alert">
     {vehicleErrorText('modelId',visibleVehicleErrors.modelId)}</span>}
   </label>
   <label htmlFor="captain-year">{t('سنة الصنع','Manufacture year')}
    <select id="captain-year" value={year} disabled={!editable}
     aria-invalid={Boolean(visibleVehicleErrors.year)}
     aria-describedby={visibleVehicleErrors.year?'captain-year-error':undefined}
     onChange={event=>setYear(event.target.value)}>
     <option value="">{t('اختر سنة الصنع','Select year')}</option>{yearOptions}
    </select>
    {visibleVehicleErrors.year&&<span id="captain-year-error" className="c-field-error" role="alert">
     {vehicleErrorText('year',visibleVehicleErrors.year)}</span>}
   </label>
   <label htmlFor="captain-colorCode">{t('لون المركبة','Vehicle color')}
    <select id="captain-colorCode" value={colorCode} disabled={!editable}
     aria-invalid={Boolean(visibleVehicleErrors.colorCode)}
     aria-describedby={visibleVehicleErrors.colorCode?'captain-colorCode-error':undefined}
     onChange={event=>{
     setColorCode(event.target.value);if(event.target.value!=='other')setColorOther('');
    }}>
     <option value="">{t('اختر اللون','Select color')}</option>
     {colors.map(color=><option key={color.code} value={color.code}>{en?color.name_en:color.name_ar}</option>)}
    </select>
    {visibleVehicleErrors.colorCode&&<span id="captain-colorCode-error" className="c-field-error" role="alert">
     {vehicleErrorText('colorCode',visibleVehicleErrors.colorCode)}</span>}
   </label>
   {colorCode==='other'&&<label htmlFor="captain-colorOther">{t('اكتب اللون','Specify color')}
    <input id="captain-colorOther" maxLength={40} value={colorOther} disabled={!editable}
     aria-invalid={Boolean(visibleVehicleErrors.colorOther)}
     aria-describedby={visibleVehicleErrors.colorOther?'captain-colorOther-error':undefined}
     onChange={event=>setColorOther(event.target.value)}/>
    {visibleVehicleErrors.colorOther&&<span id="captain-colorOther-error" className="c-field-error" role="alert">
     {vehicleErrorText('colorOther',visibleVehicleErrors.colorOther)}</span>}
   </label>}
   <label htmlFor="captain-plate">{t('لوحة العربية (حروف وأرقام)','License plate number (letters and digits)')}
    <input id="captain-plate" autoCapitalize="characters" maxLength={24} value={plate} disabled={!editable}
     aria-invalid={Boolean(visibleVehicleErrors.plate)}
     aria-describedby={visibleVehicleErrors.plate?'captain-plate-error':undefined}
     onChange={event=>setPlate(normalizeNumerals(event.target.value))} onBlur={()=>setShowVehicleErrors(true)}/>
    {visibleVehicleErrors.plate&&<span id="captain-plate-error" className="c-field-error" role="alert">
     {vehicleErrorText('plate',visibleVehicleErrors.plate)}</span>}
   </label>
   <p className="c-form-hint">{t('مثال: القاهرة أ ب ج 123، الجيزة م س 6587. تقدر تكتب من غير مسافات.','Examples: Cairo أ ب ج 123, Giza م س 6587. You can omit spaces.')}</p>
   {editable&&<div className="c-registration-actions">
    <button type="button" disabled={busy} onClick={()=>void saveVehicle(false)}>{t('حفظ واستكمال لاحقًا','Save for later')}</button>
    <button type="button" className="d-primary" disabled={busy}
     onClick={()=>void saveVehicle(true)}>{t('حفظ ومتابعة','Save and continue')}</button>
   </div>}
   {application.status==='approved'&&<LiveVehicles/>}
  </div>}
  {!loading&&!loadError&&application&&screen>37&&screen<40&&!vehicleComplete&&personalComplete&&
   <div className="d-box" role="alert">
    <p>{t('أكمل بيانات المركبة المطلوبة أولًا.','Complete the required vehicle details first.')}</p>
    <button type="button" className="d-primary" onClick={()=>onNext(37)}>{t('العودة لبيانات المركبة','Back to vehicle details')}</button>
   </div>}
  {!loading&&!loadError&&application&&screen===38&&personalComplete&&vehicleComplete&&<div className="d-box c-registration-form">
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
       {uploadingKind===kind
       ?(uploadStage==='reading'?t('بنقرأ الملف… ','Reading file… '):uploadStage==='uploading'?t('بنرفع الملف… ','Uploading file… '):uploadStage==='registering'?t('بنسجّل المستند… ','Registering document… '):t('بنتأكد من الحفظ… ','Verifying saved document… '))+uploadingFileName
       :saved?t('يوجد ملف محفوظ','A file is saved'):t('اضغط لاختيار ملف','Tap to select a file')}
      </span>
      <input id={'captain-document-'+kind} className="c-file-native" type="file" aria-label={t(ar,label)}
       accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
       disabled={!editable||busy} onChange={event=>{
        const file=event.currentTarget.files?.[0];
        if(file)upload(kind,file);
        else{setUploadErrorKind(kind);setUploadError(t('لم يتم اختيار ملف. حاول تاني.','No file selected. Please retry.'));}
        event.currentTarget.value='';
       }}/>
     </label>
     {uploadError&&uploadErrorKind===kind&&uploadingKind===null&&<div className="c-document-upload-error">
      <p className="c-field-error" role="alert">{uploadError}</p>
      {editable&&<button type="button" onClick={()=>{
       setUploadError('');
       document.getElementById('captain-document-'+kind)?.click();
      }}>{t('اختيار الملف والمحاولة تاني','Choose file and retry')}</button>}
     </div>}
    </div>;
   })}
   <p role="status">{documentProgress}/4 {t('مستندات مطلوبة مكتملة','required documents complete')}</p>
   {!hasDocuments&&<p className="c-form-hint">{t('ارفع المستندات الأربعة المطلوبة قبل المتابعة.','Upload all four required documents before continuing.')}</p>}
   {editable&&<button type="button" className="d-primary" disabled={busy||!hasDocuments}
    onClick={()=>onNext(39)}>{t('مراجعة الطلب','Review application')}</button>}
  </div>}
  {!loading&&!loadError&&application&&screen===39&&<div className="d-box c-registration-form">
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
   <p>{t('رقم الموبايل محتاج تأكيد بعدين، والعربية مش هتتفعل غير بعد المراجعة.','We will verify your phone later; your vehicle is activated only after review.')}</p>
   {editable&&<button type="button" disabled={busy||!personalComplete||!vehicleComplete||!hasDocuments}
    className="d-primary" onClick={submit}>{t('إرسال للمراجعة الإدارية','Submit for Admin review')}</button>}
   {!editable&&<p role="status">{statusLabel(application.status)}</p>}
  </div>}
  {!loading&&!loadError&&application&&(screen===40||screen===41)&&<div className="d-box c-registration-form">
   <h2>{t('حالة طلب التسجيل','Registration status')}</h2>
   <p role="status">{t('تسجيلك:','Application:')} {statusLabel(application.status)}</p>
   <p>{t('حساب الكابتن:','Captain account:')} {statusLabel(approval)}</p>
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
