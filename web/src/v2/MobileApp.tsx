import type {Session} from '@supabase/supabase-js';
import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
import LiveHome from './LiveHome';
import Onboarding from './Onboarding';
import LiveProfile from './LiveProfile';
import LiveRouteSearch from './LiveRouteSearch';
import LiveVehicles from './LiveVehicles';
import LiveCaptainRouteList from './LiveCaptainRouteList';
import LiveCaptainDraft from './LiveCaptainDraft';
import LiveBookings from './LiveBookings';
import LiveTripRequests from './LiveTripRequests';
import LiveNotifications from './LiveNotifications';
import LiveAdminOverview from './LiveAdminOverview';
import './mobile-app.css';
type Tab='home'|'search'|'routes'|'bookings'|'notifications'|'admin'|'login'|'profile';
const validTabs:Tab[]=['home','search','routes','bookings','notifications','admin','login','profile'];
const tabFromUrl=():Tab=>{const key=new URL(location.href).searchParams.get('tab') as Tab;return validTabs.includes(key)?key:'home';};
export default function MobileApp(){
 const p=usePreferences(),en=p.language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [onboardingScreen,setOnboardingScreen]=useState(2),[selectedRole,setSelectedRole]=useState('rider');
 const [tab,setTab]=useState<Tab>(tabFromUrl),[userId,setUserId]=useState<string|null>(null),[captain,setCaptain]=useState(false),[admin,setAdmin]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('');
 const [origin,setOrigin]=useState(''),[destination,setDestination]=useState(''),[outbound,setOutbound]=useState('07:30'),[returnTime,setReturnTime]=useState(''),[period,setPeriod]=useState('monthly'),[category,setCategory]=useState('PRIME'),[search,setSearch]=useState(false);
 const [areasError,setAreasError]=useState('');
 const [areas,setAreas]=useState<{id:number;name_ar:string;name_en:string}[]>([]);
 useEffect(()=>{const back=()=>setTab(tabFromUrl());addEventListener('popstate',back);return()=>removeEventListener('popstate',back);},[]);
 useEffect(()=>{let active=true;
  async function read(supplied?:Session|null){
   if(!client){if(active)setReady(true);return;}
   const session=supplied===undefined?(await client.auth.getSession()).data.session:supplied;
   if(!active)return;
   if(!session){setUserId(null);setCaptain(false);setAdmin(false);setReady(true);return;}
   const [{data:captainRow},{data:adminAccess}]=await Promise.all([
    client.from('v31_captain_profiles').select('user_id').eq('user_id',session.user.id).maybeSingle(),
    client.rpc('v31_is_admin')
   ]);
   if(!active)return;
   setUserId(session.user.id);setCaptain(Boolean(captainRow));setAdmin(adminAccess===true);setReady(true);
  }
  void read();
  const sub=client?.auth.onAuthStateChange((_event,session)=>{queueMicrotask(()=>{if(active)void read(session);});});
  return()=>{active=false;sub?.data.subscription.unsubscribe();};
 },[]);
 useEffect(()=>{if(!client)return;void client.from('v31_service_areas').select('id,name_ar,name_en').eq('active',true).order('id').then(({data,error:e})=>{if(e)setAreasError(e.message);else if(data){setAreas(data);setAreasError('');}});},[]);
 const navigate=(next:Tab)=>{setTab(next);const u=new URL(location.href);u.searchParams.delete('screen');u.searchParams.delete('preview');u.searchParams.delete('inspect');if(next==='home')u.searchParams.delete('tab');else u.searchParams.set('tab',next);history.pushState({},'',u.pathname+u.search);window.scrollTo(0,0);};
 const signOut=async()=>{if(!client)return;const {error:e}=await client.auth.signOut();if(e)setError(e.message);else navigate('home');};
 const onboardingGo=(n:number)=>{
  if(n===8){navigate('home');return;}
  // Legacy SMS screens are intentionally unreachable outside /dev/screens.
  if(n===5||n===7)n=6;
  if(n>=1&&n<=6){setOnboardingScreen(n);navigate('login');}
 };
 const onLegacyNavigate=(n:number)=>{if(n===4)setOnboardingScreen(4);navigate(n===4?'login':n===9?'search':n===42?'routes':n===62?'admin':n===34?'profile':n===32?'notifications':n===27?'bookings':'home');};
 return <div className="sekka-mobile" dir={en?'ltr':'rtl'}>
  <a className="sekka-skip" href="#sekka-content">{t('تخطي للمحتوى','Skip to content')}</a>
  <header className="sekka-mobile-header">
   <button className="sekka-brand-button" onClick={()=>navigate('home')} aria-label={t('الرئيسية','Home')}><img className="sekka-approved-logo" src="/brand/approved/app-icon-yellow.png" alt="سِكّة — seKKa"/></button>
   <span>{t('مشوارك، على سِكّة','Your ride, your route')}</span>
   <button className="sekka-theme" aria-label={t('تغيير المظهر','Switch appearance')} onClick={()=>p.setThemePreference(p.theme==='dark'?'light':'dark')}>{p.theme==='dark'?'☀':'☾'}</button>
  </header>
  <main id="sekka-content" className="sekka-mobile-content">
   {!ready&&<p role="status">{t('بنجهز حسابك…','Loading account…')}</p>}
   {error&&<div className="sekka-mobile-alert" role="alert">{error}<button onClick={()=>setError('')}>{t('إغلاق','Dismiss')}</button></div>}
   {tab==='home'&&(!ready?<p role="status">{t('بنجهز حسابك…','Loading account…')}</p>:userId?<LiveHome onNavigate={onLegacyNavigate}/>:<Onboarding production screen={2} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={setSelectedRole}/>)}
   {tab==='login'&&<Onboarding production screen={userId?6:onboardingScreen} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={setSelectedRole}/>}
   {tab==='profile'&&(userId?<section className="sekka-mobile-card"><LiveProfile/><button type="button" onClick={()=>void signOut()}>{t('تسجيل الخروج','Sign out')}</button></section>:<section className="sekka-mobile-card"><h1>{t('حسابي','My profile')}</h1><p>{t('سجّل بجوجل علشان تكمل بياناتك.','Sign in with Google to complete your profile.')}</p><button className="sekka-action" onClick={()=>{setOnboardingScreen(4);navigate('login');}}>{t('تسجيل الدخول بجوجل','Sign in with Google')}</button></section>)}
   {tab==='search'&&<section className="sekka-mobile-card"><h1>{t('دور على خط','Find a route')}</h1><p>{t('اختار مكانك وميعادك عشان تشوف الخطوط الحقيقية.','Choose your stops and schedule to find real routes.')}</p>{areasError&&<p role="alert">{areasError}</p>}<div className="sekka-fields">
    <label>{t('من','From')}<select value={origin} onChange={e=>{setOrigin(e.target.value);setSearch(false);}}><option value="">{t('اختار المنطقة','Select area')}</option>{areas.map(a=><option key={a.id} value={a.name_ar}>{en?a.name_en:a.name_ar}</option>)}</select></label>
    <label>{t('إلى','To')}<select value={destination} onChange={e=>{setDestination(e.target.value);setSearch(false);}}><option value="">{t('اختار المنطقة','Select area')}</option>{areas.map(a=><option key={a.id} value={a.name_ar}>{en?a.name_en:a.name_ar}</option>)}</select></label>
    <label>{t('وقت الذهاب','Departure time')}<input type="time" value={outbound} onChange={e=>{setOutbound(e.target.value);setSearch(false);}}/></label>
    <label>{t('وقت العودة (اختياري)','Return time (optional)')}<input type="time" value={returnTime} onChange={e=>{setReturnTime(e.target.value);setSearch(false);}}/></label>
    <label>{t('الاشتراك','Period')}<select value={period} onChange={e=>{setPeriod(e.target.value);setSearch(false);}}><option value="monthly">{t('شهري','Monthly')}</option><option value="weekly">{t('أسبوعي','Weekly')}</option></select></label>
    <label>{t('الفئة','Category')}<select value={category} onChange={e=>{setCategory(e.target.value);setSearch(false);}}>{['PRIME','SAVER','SPACE','MAX'].map(c=><option key={c}>{c}</option>)}</select></label>
   </div><button className="sekka-action" disabled={!origin||!destination||origin===destination} onClick={()=>setSearch(true)}>{t('عرض الخطوط المتاحة','Search available routes')}</button>
   {search&&<LiveRouteSearch origin={origin} destination={destination} outbound={outbound} returnTime={returnTime} period={period} categories={[category]}/>}</section>}
   {tab==='routes'&&(captain?<><LiveVehicles/><LiveCaptainRouteList/><LiveCaptainDraft/><LiveTripRequests mode="captain"/></>:<section className="sekka-mobile-card"><h1>{t('خطوط الكابتن','Captain routes')}</h1><p>{userId?t('حسابك مش كابتن معتمد في النظام حاليًا.','This account is not enrolled as a captain.'):t('سجّل الدخول الأول.','Sign in first.')}</p><button className="sekka-action" onClick={()=>navigate(userId?'home':'login')}>{t('متابعة','Continue')}</button></section>)}
   {tab==='bookings'&&(userId?<LiveBookings mode={captain?'captain':'rider'}/>:<section className="sekka-mobile-card"><h1>{t('حجوزاتي','My bookings')}</h1><p>{t('سجّل دخولك علشان تشوف حجوزاتك الحقيقية.','Sign in to view your bookings.')}</p><button className="sekka-action" onClick={()=>navigate('login')}>{t('تسجيل الدخول','Sign in')}</button></section>)}
   {tab==='notifications'&&(userId?<LiveNotifications/>:<section className="sekka-mobile-card"><h1>{t('الإشعارات','Notifications')}</h1><button className="sekka-action" onClick={()=>navigate('login')}>{t('تسجيل الدخول','Sign in')}</button></section>)}
   {tab==='admin'&&(admin?<LiveAdminOverview/>:<section className="sekka-mobile-card"><h1>{t('غير مسموح','Access restricted')}</h1><p>{t('لوحة الإدارة للحسابات المصرح لها فقط.','The admin dashboard requires authorization.')}</p><button onClick={()=>navigate('home')}>{t('العودة','Back')}</button></section>)}
  </main>
  <nav className="sekka-bottom-nav" aria-label={t('التنقل الرئيسي','Main navigation')}>
   {([['home','⌂','الرئيسية','Home'],['search','⌕','بحث','Search'],[captain? 'routes':'bookings','▦',captain?'خطوطي':'حجوزاتي',captain?'Routes':'Bookings'],['notifications','♧','الإشعارات','Alerts'],['profile','◉','حسابي','Account']] as [Tab,string,string,string][]).map(([id,icon,ar,english])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>navigate(id)}><span aria-hidden="true">{icon}</span><small>{t(ar,english)}</small></button>)}
  </nav>
 </div>;
}
