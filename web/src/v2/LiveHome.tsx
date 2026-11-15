import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';

type Identity={name:string;email:string;role:'rider'|'captain';approved:boolean;admin:boolean};
export default function LiveHome({onNavigate}:{onNavigate:(screen:number)=>void}){
 const {language,theme,setThemePreference}=usePreferences(),en=language==='en';
 const t=(ar:string,enText:string)=>en?enText:ar;
 const [identity,setIdentity]=useState<Identity|null>(null);
 const [busy,setBusy]=useState(true),[error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let active=true;
  void(async()=>{
   try{
    if(!client){if(active)setIdentity(null);return;}
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError)throw authError;
    if(!user){if(active)setIdentity(null);return;}
    const [{data:profile,error:profileError},{data:captain,error:captainError},{data:admin,error:adminError}]=await Promise.all([
     client.from('v31_profiles').select('display_name,role_preference').eq('user_id',user.id).maybeSingle(),
     client.from('v31_captain_profiles').select('approval_status').eq('user_id',user.id).maybeSingle(),
     client.rpc('v31_is_admin')
    ]);
    if(profileError||captainError||adminError)throw Error(profileError?.message||captainError?.message||adminError?.message);
    if(active)setIdentity({email:user.email||'',name:profile?.display_name||user.user_metadata?.full_name||user.email||'',role:profile?.role_preference==='captain'?'captain':'rider',approved:captain?.approval_status==='approved',admin:admin===true});
   }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
   finally{if(active)setBusy(false);}
  })();
  return()=>{active=false;};
 },[refresh,language]);
 return <main className="live-home" dir={en?'ltr':'rtl'} style={{maxWidth:680,margin:'0 auto',padding:'24px 18px',minHeight:'70vh'}}>
  <h1>{t('أهلاً بيك في سِكّة','Welcome to seKKa')}</h1>
  {busy&&<p role="status">{t('بنحمّل حسابك الحقيقي…','Loading your real account…')}</p>}
  {error&&<div role="alert"><p>{t('حصلت مشكلة في قراءة حسابك.','Unable to load your account.')}</p><button onClick={()=>{setError('');setBusy(true);setRefresh(x=>x+1);}}>{t('إعادة المحاولة','Try again')}</button></div>}
  {!client&&<p role="status">{t('خدمة تسجيل الدخول غير مهيأة في هذه النسخة.','Sign-in service is not configured for this build.')}</p>}
  {!busy&&!error&&!identity&&<section className="d-box"><h2>{t('ابدأ بجوجل','Sign in with Google')}</h2><p>{t('سجّل دخولك علشان تتابع رحلاتك وبياناتك الحقيقية.','Sign in to access real routes and account data.')}</p><button className="d-primary" onClick={()=>onNavigate(4)}>{t('تسجيل الدخول','Sign in')}</button></section>}
  {identity&&<section className="d-box">
   <h2>{identity.name}</h2><p dir="ltr">{identity.email}</p>
   <p>{identity.admin?t('مسؤول معتمد','Verified administrator'):identity.role==='captain'?(identity.approved?t('كابتن معتمد','Approved captain'):t('كابتن بانتظار الاعتماد','Captain pending approval')):t('راكب','Passenger')}</p>
   <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
    {identity.role==='captain'&&<button className="d-primary" onClick={()=>onNavigate(42)}>{t('خطوطي وإضافة خط','My routes & new route')}</button>}
    {identity.role==='rider'&&<button className="d-primary" onClick={()=>onNavigate(9)}>{t('البحث عن خط حقيقي','Search real routes')}</button>}
    {identity.admin&&<button onClick={()=>onNavigate(62)}>{t('لوحة الإدارة','Admin panel')}</button>}
   </div>
   <p>{t('الحجز والدفع الحقيقيان غير متاحين حتى اكتمال التحقق والاختبارات.','Real bookings and payments remain disabled until verification and testing are complete.')}</p>
  </section>}
  <section className="d-box"><h2>{t('المظهر','Appearance')}</h2><button onClick={()=>setThemePreference(theme==='light'?'dark':'light')}>{theme==='light'?t('تشغيل الداكن','Switch to dark'):t('تشغيل الفاتح','Switch to light')}</button></section>
  {identity&&<button onClick={async()=>{await client?.auth.signOut();setIdentity(null);onNavigate(4);}}>{t('تسجيل الخروج','Sign out')}</button>}
 </main>;
}
