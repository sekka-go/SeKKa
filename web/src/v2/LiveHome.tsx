import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
import {Wordmark} from './Onboarding';
import './live-home.css';

type Identity={name:string;email:string;role:'rider'|'captain';approved:boolean;admin:boolean};
export default function LiveHome({onNavigate}:{onNavigate:(screen:number)=>void}){
 const {language,theme,setThemePreference}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
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
    // Role display must be resilient: a permission lookup failure must not erase the user's signed-in identity.
    const [{data:profile,error:profileError},{data:captain,error:captainError},{data:admin,error:adminError}]=await Promise.all([
     client.from('v31_profiles').select('display_name,role_preference').eq('user_id',user.id).maybeSingle(),
     client.from('v31_captain_profiles').select('approval_status').eq('user_id',user.id).maybeSingle(),
     client.rpc('v31_is_admin')
    ]);
    if(!active)return;
    setIdentity({
     email:user.email||'',name:profile?.display_name||user.user_metadata?.full_name||user.email||'',
     role:profile?.role_preference==='captain'?'captain':'rider',
     approved:captain?.approval_status==='approved',admin:!adminError&&admin===true
    });
    if(profileError||captainError||adminError)setError(t('تعذّر تحديث بعض الصلاحيات. جرّب تحديث البيانات.','Some account permissions could not be refreshed.'));
   }catch{
    if(active)setError(t('تعذر الاتصال بحسابك. تقدر تعيد المحاولة أو تسجّل دخولك.','Unable to connect to your account. Retry or sign in.'));
   }finally{if(active)setBusy(false);}
  })();
  return()=>{active=false;};
 },[refresh,language]);
 const retry=()=>{setError('');setBusy(true);setRefresh(n=>n+1);};
 return <main className={`live-home live-home--${theme}`} dir={en?'ltr':'rtl'}>
  <header className="live-home__header">
   <div className="live-home__brand"><Wordmark/><span>{t('معاك في السِكّة','Your daily route, sorted')}</span></div>
   <button type="button" className="live-home__theme" onClick={()=>setThemePreference(theme==='light'?'dark':'light')} aria-label={t('تغيير المظهر','Switch appearance')}>{theme==='light'?'☾':'☀'}</button>
  </header>
  <section className="live-home__hero">
   <div className="live-home__eyebrow"><span className="live-home__signal"/> {t('القاهرة والجيزة','CAIRO & GIZA')}</div>
   <h1>{identity?t('أهلاً، '+identity.name.split(' ')[0], 'Welcome, '+identity.name.split(' ')[0]):t('مشوارك اليومي، متظبّط.','Your daily commute, sorted.')}</h1>
   <p>{t('خط واضح. ميعاد ثابت. وسِكّة أسهل كل يوم.','A clear route, reliable schedule and an easier daily commute.')}</p>
   <div className="live-home__road" aria-hidden="true"><span/><span/><span/></div>
  </section>
  <section className="live-home__body" aria-label={t('البدء في التطبيق','Get started')}>
   {busy&&<div className="live-home__panel" role="status">{t('بنجهّز بيانات حسابك…','Getting your account ready…')}</div>}
   {error&&<div className="live-home__notice" role="alert"><span>{error}</span><button onClick={retry}>{t('حاول تاني','Retry')}</button></div>}
   {!busy&&!identity&&<section className="live-home__panel">
    <div className="live-home__panel-icon" aria-hidden="true">↗</div>
    <h2>{t('يلا نبدأ مشوارك','Ready to get moving?')}</h2>
    <p>{t('سجّل بجوجل علشان تلاقي خطك وتتابع بياناتك الحقيقية.','Sign in with Google to find routes and manage your real account.')}</p>
    <button className="live-home__primary" onClick={()=>onNavigate(4)}>{t('التسجيل باستخدام جوجل','Continue with Google')} <span aria-hidden="true">←</span></button>
   </section>}
   {identity&&<section className="live-home__panel">
    <div className="live-home__identity"><span className="live-home__avatar">{identity.name.slice(0,1).toUpperCase()}</span><div><strong>{identity.name}</strong><small dir="ltr">{identity.email}</small></div></div>
    <span className="live-home__role">{identity.admin?t('أدمن معتمد','Verified admin'):identity.role==='captain'?(identity.approved?t('كابتن معتمد','Approved captain'):t('كابتن بانتظار الاعتماد','Captain under review')):t('حساب راكب','Passenger account')}</span>
    <h2>{identity.role==='captain'?t('خطوطك، في إيدك','Manage your routes'):t('رايح فين النهارده؟','Where are you headed?')}</h2>
    <p>{identity.role==='captain'?t('ابدأ إضافة خط وشوف خطوطك المنشورة.','Create and manage your routes.'):t('دور على الخط المناسب لمعادك ومكانك.','Find routes that fit your schedule.')}</p>
    <button className="live-home__primary" onClick={()=>onNavigate(identity.role==='captain'?42:9)}>{identity.role==='captain'?t('إدارة خطوطي','Manage my routes'):t('ابحث عن خط','Find a route')} <span aria-hidden="true">←</span></button>
    {identity.admin&&<button className="live-home__secondary" onClick={()=>onNavigate(62)}>{t('لوحة الإدارة','Admin dashboard')}</button>}
   </section>}
   <div className="live-home__info"><span aria-hidden="true">ⓘ</span>{t('الحجز والدفع الفعلي لسه تحت التجهيز. مفيش فلوس هتتخصم.','Real bookings and payments are not enabled yet. No money will be charged.')}</div>
   {identity&&<button className="live-home__logout" onClick={async()=>{if(!client)return;const {error:signOutError}=await client.auth.signOut();if(signOutError){setError(t('تعذّر تسجيل الخروج.','Unable to sign out.'));return;}setIdentity(null);onNavigate(4);}}>{t('تسجيل الخروج','Sign out')}</button>}
  </section>
 </main>;
}
