import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
export default function LiveProfile(){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false),[reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setLoaded(false);setError('');void(async()=>{
   if(!client){if(active)setError(t('خدمة الحساب غير مهيأة.','Account service is not configured.'));return;}
   try{
   const {data:{user},error:authError}=await client.auth.getUser();
   if(!active)return;
   if(authError||!user){setError(t('انتهت جلسة الدخول. سجّل الدخول مرة تانية.','Your session has expired. Please sign in again.'));return;}
   const {data,error:readError}=await client.from('v31_profiles').select('display_name,phone_number').eq('user_id',user.id).maybeSingle();
   if(!active)return;
   if(readError){setError(t('تعذر تحميل بيانات الحساب. حاول تاني.','Could not load your profile. Please retry.'));return;}
   setName(data?.display_name||user.user_metadata?.full_name||'');setPhone(data?.phone_number||'');setLoaded(true);
   }catch{if(active)setError(t('تعذر تحميل بيانات الحساب. حاول تاني.','Could not load your profile. Please retry.'));}
 })();return()=>{active=false;};},[reload]);
 const save=async()=>{
  if(!client)return;
  const clean=phone.replace(/\s|-/g,'');
  if(name.trim().length<2|| (clean!==''&&!/^01[0125][0-9]{8}$/.test(clean))){setError(t('اكتب اسم صحيح ورقم مصري 11 رقم لو هتضيف موبايل.','Enter a valid name and an 11-digit Egyptian phone if supplied.'));return;}
  setBusy(true);setError('');setNotice('');
  try{
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||!user)throw Error('AUTH_REQUIRED');
   const {error:writeError}=await client.from('v31_profiles').upsert({user_id:user.id,display_name:name.trim(),phone_number:clean||null},{onConflict:'user_id'});
   if(writeError)throw writeError;
   // A successful HTTP write alone is not proof that the intended profile
   // persisted. Read it back under the same verified user's RLS context.
   const {data:stored,error:verifyError}=await client.from('v31_profiles')
    .select('display_name,phone_number').eq('user_id',user.id).single();
   if(verifyError||!stored||stored.display_name!==name.trim()||(stored.phone_number||'')!==clean)
    throw Error('PROFILE_SAVE_NOT_VERIFIED');
   setNotice(t('اتحفظت بياناتك. تأكيد رقم الموبايل برسالة SMS مؤجل حاليًا.','Profile saved. SMS phone verification is currently postponed.'));
  }catch{setError(t('ما قدرناش نتأكد من حفظ البيانات. حاول تاني.','Could not verify the profile save. Please retry.'));}finally{setBusy(false);}
 };
 if(!client)return null;
 return <section className="d-box live-profile">
  <h2>{t('بيانات حسابي','My profile')}</h2>
  {!loaded&&!error&&<p role="status">{t('بنحمّل بياناتك…','Loading your profile…')}</p>}
  {error&&<><p role="alert">{error}</p>}{!loaded&&<button type="button" onClick={()=>setReload(n=>n+1)}>{t('إعادة المحاولة','Retry')}</button>}</>}{notice&&<p role="status">{notice}</p>}
  {loaded&&<><label>{t('الاسم','Name')}<input maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
   <label>{t('رقم الموبايل (اختياري)','Phone (optional)')}<input type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
   <p>{t('الرقم للتواصل فقط. بنراجع صيغته؛ تأكيد ملكيته برسالة SMS مؤجل دلوقتي.','Phone is for contact only. Its format is checked; SMS verification of ownership is postponed.')}</p>
   <button type="button" className="d-primary" disabled={busy} onClick={()=>void save()}>{busy?t('جارٍ الحفظ…','Saving…'):t('حفظ بياناتي','Save profile')}</button>
  </>}
 </section>;
}
