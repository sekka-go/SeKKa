import type {Session} from '@supabase/supabase-js';
import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
import LiveHome from './LiveHome';
import Onboarding from './Onboarding';
import Discovery from './Discovery';
import type {Line} from './Discovery';
import {fetchPublishedSelection} from './LiveRouteSearch';
import type {LiveSelection} from './LiveRouteSearch';
import {V31BookingJourney} from './BookingFlow';
import LiveProfile from './LiveProfile';
import LiveVehicles from './LiveVehicles';
import LiveCaptainRouteList from './LiveCaptainRouteList';
import LiveCaptainDraft from './LiveCaptainDraft';
import LiveBookings from './LiveBookings';
import LiveTripRequests from './LiveTripRequests';
import LiveNotifications from './LiveNotifications';
import LiveAdminOverview from './LiveAdminOverview';
import './mobile-app.css';
type Tab='home'|'search'|'booking'|'routes'|'bookings'|'notifications'|'admin'|'login'|'profile';
const validTabs:Tab[]=['home','search','booking','routes','bookings','notifications','admin','login','profile'];
const tabFromUrl=():Tab=>{const key=new URL(location.href).searchParams.get('tab') as Tab;return validTabs.includes(key)?key:'home';};
export default function MobileApp(){
 const p=usePreferences(),en=p.language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [discoveryScreen,setDiscoveryScreen]=useState(()=>{const n=Number(new URL(location.href).searchParams.get('view'));return [8,9,10,11,12].includes(n)?n:9;});
 const [liveSelection,setLiveSelection]=useState<LiveSelection|null>(null),[bookingOffer,setBookingOffer]=useState<Line|null>(null),[selectionError,setSelectionError]=useState('');
 const [bookingId,setBookingId]=useState<string|null>(()=>new URL(location.href).searchParams.get('booking'));
 const [selectionVersion,setSelectionVersion]=useState(0);
 const [onboardingScreen,setOnboardingScreen]=useState(2),[selectedRole,setSelectedRole]=useState('rider');
 const [tab,setTab]=useState<Tab>(tabFromUrl),[userId,setUserId]=useState<string|null>(null),[captain,setCaptain]=useState(false),[admin,setAdmin]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('');

 const [areasError,setAreasError]=useState('');
 const [areas,setAreas]=useState<{id:number;name_ar:string;name_en:string}[]>([]);
 useEffect(()=>{const back=()=>{setTab(tabFromUrl());const u=new URL(location.href);const screen=Number(u.searchParams.get('view'));setDiscoveryScreen([8,9,10,11,12].includes(screen)?screen:9);setBookingId(u.searchParams.get('booking'));setSelectionVersion(v=>v+1);};addEventListener('popstate',back);return()=>removeEventListener('popstate',back);},[]);
 useEffect(()=>{let active=true;const u=new URL(location.href);
  const route=u.searchParams.get('route'),pickup=u.searchParams.get('pickup'),dropoff=u.searchParams.get('dropoff');
  if(!['search','booking'].includes(tab)||!route||!pickup||!dropoff)return;
  setSelectionError('');
  void fetchPublishedSelection(route,pickup,dropoff,u.searchParams.get('reverse')==='1').then(s=>{
    if(!active)return;setLiveSelection(s);
    if(tab==='booking')setBookingOffer({
      id:s.route.id,routeId:s.route.id,origin:areas.find(a=>a.id===s.from.area_id)?.name_ar||s.from.name,
      destination:areas.find(a=>a.id===s.to.area_id)?.name_ar||s.to.name,category:s.route.category,
      available:s.route.seat_capacity,outbound:s.route.outbound_time?.slice(0,5)||'',returnTime:s.route.return_time?.slice(0,5)||'',
      period:s.route.period,direction:s.reverse?'return':'outbound',amount:s.route.price_egp,
      selectedStops:{pickup:{id:s.from.id,name:s.from.name,area:'',pickup:true,dropoff:false},
        dropoff:{id:s.to.id,name:s.to.name,area:'',pickup:false,dropoff:true},returnPickup:null,returnDropoff:null}
    });
  }).catch(e=>{if(active){setLiveSelection(null);setSelectionError(e instanceof Error?e.message:String(e));}});
  return()=>{active=false;};
 },[tab,selectionVersion,areas]);

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
 const discoveryGo=(id:number)=>{
  if([8,9,10,11,12].includes(id)){setDiscoveryScreen(id);const u=new URL(location.href);u.searchParams.set('tab','search');u.searchParams.set('view',String(id));history.pushState({},'',u.pathname+u.search);window.scrollTo(0,0);}
  else if(id===4){setOnboardingScreen(4);navigate('login');}
  else if(id===33)navigate('notifications');
  else if(id===29)navigate('bookings');
  else navigate('home');
 };
 const chooseRoute=(s:LiveSelection)=>{
  setLiveSelection(s);setSelectionError('');setDiscoveryScreen(12);
  const u=new URL(location.href);u.searchParams.set('tab','search');u.searchParams.set('view','12');u.searchParams.set('route',s.route.id);u.searchParams.set('pickup',s.from.id);u.searchParams.set('dropoff',s.to.id);u.searchParams.set('reverse',s.reverse?'1':'0');u.searchParams.delete('booking');
  history.pushState({},'',u.pathname+u.search);window.scrollTo(0,0);
 };
 const beginBooking=(offer:Line)=>{
  if(!liveSelection||!offer.selectedStops){setSelectionError(t('اختار نقطتي ركوب ونزول صحيحتين.','Select valid pickup and drop-off stops.'));return;}
  setBookingOffer(offer);setBookingId(null);
  const u=new URL(location.href);u.searchParams.set('tab','booking');u.searchParams.set('pickup',offer.selectedStops.pickup.id);u.searchParams.set('dropoff',offer.selectedStops.dropoff.id);u.searchParams.delete('booking');
  history.pushState({},'',u.pathname+u.search);setTab('booking');window.scrollTo(0,0);
 };
 const bookingSaved=(id:string)=>{
   setBookingId(id);const u=new URL(location.href);u.searchParams.set('tab','booking');u.searchParams.set('booking',id);history.replaceState({},'',u.pathname+u.search);
 };
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
   {selectionError&&['search','booking'].includes(tab)&&<div role="alert" className="sekka-mobile-alert">{selectionError}<button type="button" onClick={()=>setSelectionVersion(v=>v+1)}>{t('إعادة المحاولة','Retry')}</button></div>}
   {tab==='search'&&<Discovery production screen={discoveryScreen} serviceAreas={areas} liveSelection={liveSelection} onLiveSelect={chooseRoute} theme={p.theme}
     onTheme={p.setThemePreference} go={discoveryGo}
     routes={[]} route={null} bookings={[]} signedIn={Boolean(userId)} busy={false} error={areasError}
     onSearch={()=>{}} onSelect={()=>{}}
     onRequest={async()=>{throw Error(t('طلبات الخطوط متاحة من نتائج البحث الحقيقية فقط.','Submit requests through live search results.'));}}
     onFavorite={async()=>{throw Error(t('المفضلة غير متاحة حاليًا.','Favorites are not available yet.'));}}
     onBook={beginBooking} onBooking={()=>navigate('bookings')}
   />}
   {tab==='booking'&&<V31BookingJourney offer={bookingOffer} routeId={liveSelection?.route.id||''}
     pickupId={new URL(location.href).searchParams.get('pickup')||''} dropoffId={new URL(location.href).searchParams.get('dropoff')||''}
     reverse={new URL(location.href).searchParams.get('reverse')==='1'} bookingId={bookingId}
     onBack={()=>{if(bookingId)navigate('bookings');else{navigate('search');discoveryGo(12);}}}
     onLogin={()=>{try{sessionStorage.setItem('sekka.postAuthPath',location.pathname+location.search);}catch{ /* Safari privacy storage */ }setOnboardingScreen(4);navigate('login');}}
     onBooked={bookingSaved}/>}

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
