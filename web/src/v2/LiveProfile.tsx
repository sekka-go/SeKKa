import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
export default function LiveProfile(){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false);
 useEffect(()=>{let active=true;void(async()=>{
   if(!client)return;
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||!user){if(active)setError('AUTH_REQUIRED');return;}
   const {data,error:readError}=await client.from('v31_profiles').select('display_name,phone_number').eq('user_id',user.id).maybeSingle();
   if(!active)return;
   if(readError){setError(readError.message);return;}
   setName(data?.display_name||user.user_metadata?.full_name||'');setPhone(data?.phone_number||'');setLoaded(true);
 })();return()=>{active=false;};},[]);
 const save=async()=>{
  if(!client)return;
  const clean=phone.replace(/\s|-/g,'');
  if(name.trim().length<2|| (clean!==''&&!/^01[0125][0-9]{8}$/.test(clean))){setError(t('اكتب اسم صحيح ورقم مصري 11 رقم لو هتضيف موبايل.','Enter a valid name and an 11-digit Egyptian phone if supplied.'));return;}
  setBusy(true);setError('');setNotice('');
  try{
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||!user)throw Error('AUTH_REQUIRED');
   const {error:writeError}=await client.from('v31_profiles').upsert({user_id:user.id,display_name:name.trim(),phone_number:clean||null},{onConflict:'user_id'});
   if(writeError)throw writeError;setNotice(t('اتحفظت بياناتك. رقم الموبايل غير مؤكد.','Profile saved. Phone number is not verified.'));
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 };
 if(!client)return null;
 return <section className="d-box live-profile">
  <h2>{t('بيانات حسابي','My profile')}</h2>
  {!loaded&&!error&&<p role="status">{t('بنحمّل بياناتك…','Loading your profile…')}</p>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loaded&&<><label>{t('الاسم','Name')}<input maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
   <label>{t('رقم الموبايل (اختياري وغير مؤكد)','Phone (optional, unverified)')}<input type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
   <button type="button" className="d-primary" disabled={busy} onClick={()=>void save()}>{busy?t('جارٍ الحفظ…','Saving…'):t('حفظ بياناتي','Save profile')}</button>
  </>}
 </section>;
}
