import type {Session} from '@supabase/supabase-js';
import {useEffect,useRef,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
import Onboarding from './Onboarding';
import Discovery from './Discovery';
import type {Line} from './Discovery';
import {fetchPublishedSelection} from './LiveRouteSearch';
import type {LiveSelection} from './LiveRouteSearch';
import {V31BookingJourney} from './BookingFlow';
import CaptainRoutes from './CaptainRoutes';
import CaptainOnboarding from './CaptainOnboarding';
import {internalScreen,publicScreen} from './screenMap';
import LiveProfile from './LiveProfile';
import LiveBookings from './LiveBookings';
import LiveNotifications from './LiveNotifications';
import AdminDashboard from './AdminDashboard';
import './mobile-app.css';
type Tab='home'|'search'|'booking'|'captain-onboarding'|'routes'|'bookings'|'notifications'|'admin'|'login'|'profile';
const validTabs:Tab[]=['home','search','booking','captain-onboarding','routes','bookings','notifications','admin','login','profile'];
const tabFromUrl=():Tab=>{const key=new URL(location.href).searchParams.get('tab') as Tab;return validTabs.includes(key)?key:'home';};
export default function MobileApp(){
 const p=usePreferences(),en=p.language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [adminScreen,setAdminScreen]=useState(()=>{const n=Number(new URL(location.href).searchParams.get('view'));return n>=62&&n<=73?n:62;});
 const [captainApproved,setCaptainApproved]=useState(false);
 const [captainStep,setCaptainStep]=useState(()=>{const n=Number(new URL(location.href).searchParams.get('view'));return n>=35&&n<=41?n:35;});
 const [captainScreen,setCaptainScreen]=useState(()=>{const n=Number(new URL(location.href).searchParams.get('view'));return n>=42&&n<=49?n:42;});
 const [discoveryScreen,setDiscoveryScreen]=useState(()=>{const n=Number(new URL(location.href).searchParams.get('view'));return [8,9,10,11,12].includes(n)?n:9;});
 const [liveSelection,setLiveSelection]=useState<LiveSelection|null>(null),[bookingOffer,setBookingOffer]=useState<Line|null>(null),[selectionError,setSelectionError]=useState('');
 const [bookingId,setBookingId]=useState<string|null>(()=>new URL(location.href).searchParams.get('booking'));
 const [selectionVersion,setSelectionVersion]=useState(0);
 const [onboardingScreen,setOnboardingScreen]=useState(2),[selectedRole,setSelectedRole]=useState('rider');
 const [tab,setTab]=useState<Tab>(tabFromUrl),[userId,setUserId]=useState<string|null>(null),[captain,setCaptain]=useState(false),[admin,setAdmin]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('');

 const [adminLookupError,setAdminLookupError]=useState('');
 const [authCheckRevision,setAuthCheckRevision]=useState(0);
 const sessionReadId=useRef(0);
 const [areasError,setAreasError]=useState('');
 const [areas,setAreas]=useState<{id:number;name_ar:string;name_en:string}[]>([]);
 useEffect(()=>{const back=()=>{setTab(tabFromUrl());const u=new URL(location.href);const screen=Number(u.searchParams.get('view'));if(tabFromUrl()==='admin')setAdminScreen(screen>=62&&screen<=73?screen:62);if(tabFromUrl()==='routes')setCaptainScreen(screen>=42&&screen<=49?screen:42);if(tabFromUrl()==='captain-onboarding')setCaptainStep(screen>=35&&screen<=41?screen:35);setDiscoveryScreen([8,9,10,11,12].includes(screen)?screen:9);setBookingId(u.searchParams.get('booking'));setSelectionVersion(v=>v+1);};addEventListener('popstate',back);return()=>removeEventListener('popstate',back);},[]);
 useEffect(()=>{let active=true;const u=new URL(location.href);
  const route=u.searchParams.get('route'),pickup=u.searchParams.get('pickup'),dropoff=u.searchParams.get('dropoff');
  if(!['search','booking'].includes(tab))return;
  if(!route||!pickup||!dropoff){setLiveSelection(null);setBookingOffer(null);return;}
  setLiveSelection(null);setBookingOffer(null);setSelectionError('');
  void fetchPublishedSelection(route,pickup,dropoff,u.searchParams.get('reverse')==='1').then(s=>{
    if(!active)return;setLiveSelection(s);
    if(tab==='booking')setBookingOffer({
      id:s.route.id,routeId:s.route.id,origin:areas.find(a=>a.id===s.from.area_id)?.name_ar||s.from.name,
      destination:areas.find(a=>a.id===s.to.area_id)?.name_ar||s.to.name,category:s.route.category,
      available:s.remaining,outbound:s.route.outbound_time?.slice(0,5)||'',returnTime:s.route.return_time?.slice(0,5)||'',
      period:s.route.period,direction:s.reverse?'return':'outbound',amount:s.route.price_egp,
      selectedStops:{pickup:{id:s.from.id,name:s.from.name,area:'',pickup:true,dropoff:false},
        dropoff:{id:s.to.id,name:s.to.name,area:'',pickup:false,dropoff:true},returnPickup:null,returnDropoff:null}
    });
  }).catch(e=>{if(active){setLiveSelection(null);setSelectionError(e instanceof Error?e.message:String(e));}});
  return()=>{active=false;};
 },[tab,selectionVersion,areas]);

 useEffect(()=>{let active=true;
  let adminLandingHandled=false;
  async function read(supplied?:Session|null){
   const readId=++sessionReadId.current;
   if(!client){if(active)setReady(true);return;}
   setReady(false);
   setAdmin(false);setAdminLookupError('');
   try{
    const {data:sessionData,error:sessionError}=supplied===undefined
      ?await client.auth.getSession():{data:{session:supplied},error:null};
    if(!active||readId!==sessionReadId.current)return;
    if(sessionError)throw sessionError;
    const session=sessionData.session;
    if(!session){
     setUserId(null);setCaptain(false);setCaptainApproved(false);
     setAdmin(false);setAdminLookupError('');setReady(true);return;
    }
    // A saved browser session alone is not proof of the current actor.
    // Resolve and validate the real authenticated identity with Supabase Auth.
    const {data:{user},error:userError}=await client.auth.getUser();
    if(!active||readId!==sessionReadId.current)return;
    if(userError||!user||user.id!==session.user.id)throw Error('AUTH_SESSION_NOT_VERIFIED');
    const [{data:captainRow,error:captainError},{data:adminAccess,error:adminError}]=await Promise.all([
     client.from('v31_captain_profiles').select('user_id,approval_status').eq('user_id',user.id).maybeSingle(),
     client.rpc('v31_is_admin')
    ]);
    if(!active||readId!==sessionReadId.current)return;
    if(captainError)setError(captainError.message);
    if(adminError||typeof adminAccess!=='boolean'){
      // A network/RPC failure is NOT the same as a server denial of Admin rights.
      setAdminLookupError(t('تعذر التأكد من صلاحية الإدارة. أعد التحقق.', 'Could not verify Admin access. Retry authorization.'));
      setAdmin(false);
    }else{
      setAdmin(adminAccess===true);
    }
    let enrolled=Boolean(captainRow);
    // Preserve existing Google identities; role preference is NOT Admin authorization.
    let pendingRole:string|null=null;
    try{pendingRole=sessionStorage.getItem('sekka.pendingRole');}catch{/* private mode */}
    if(pendingRole==='rider'||pendingRole==='captain'){
      const {data:profile,error:profileError}=await client.from('v31_profiles')
        .select('user_id,role_preference').eq('user_id',user.id).maybeSingle();
      if(!active||readId!==sessionReadId.current)return;
      if(profileError){setError(profileError.message);}
      else{
        const {error:saveError}=profile
          ?await client.from('v31_profiles').update({role_preference:pendingRole}).eq('user_id',user.id)
          :await client.from('v31_profiles').insert({user_id:user.id,role_preference:pendingRole,
            display_name:user.user_metadata?.full_name||''});
        if(!active||readId!==sessionReadId.current)return;
        if(saveError){setError(saveError.message);}
        else{
          if(pendingRole==='captain'&&!enrolled){
            const {error:enrollError}=await client.from('v31_captain_profiles')
              .insert({user_id:user.id,approval_status:'pending'});
            if(!active||readId!==sessionReadId.current)return;
            if(enrollError&&enrollError.code!=='23505')setError(enrollError.message);
            else enrolled=true;
          }
          try{sessionStorage.removeItem('sekka.pendingRole');}catch{/* private mode */}
        }
      }
    }
    if(!active||readId!==sessionReadId.current)return;
    setUserId(user.id);setCaptain(enrolled);
    setCaptainApproved(captainRow?.approval_status==='approved');
    // Admin landing is a navigation preference, not permission assignment.
    // Respect explicit passenger/captain/deep-link destinations.
    if(adminAccess===true&&!adminError&&!adminLandingHandled){
      adminLandingHandled=true;
      const u=new URL(location.href);
      if(!u.searchParams.has('tab')){
        setAdminScreen(62);u.searchParams.set('tab','admin');u.searchParams.set('view','62');
        history.replaceState({},'',u.pathname+u.search);setTab('admin');
      }
    }
    setReady(true);
   }catch(e){
    if(!active||readId!==sessionReadId.current)return;
    setUserId(null);setCaptain(false);setCaptainApproved(false);setAdmin(false);
    setAdminLookupError('');setError(e instanceof Error?e.message:String(e));setReady(true);
   }
  }
  void read();
  const sub=client?.auth.onAuthStateChange((_event,session)=>{
    queueMicrotask(()=>{if(active)void read(session);});
  });
  return()=>{active=false;sessionReadId.current++;sub?.data.subscription.unsubscribe();};
 },[authCheckRevision]);
 useEffect(()=>{if(!client)return;void client.from('v31_service_areas').select('id,name_ar,name_en').eq('active',true).order('id').then(({data,error:e})=>{if(e)setAreasError(e.message);else if(data){setAreas(data);setAreasError('');}});},[]);
 const navigate=(next:Tab)=>{setTab(next);const u=new URL(location.href);u.searchParams.delete('screen');u.searchParams.delete('preview');u.searchParams.delete('inspect');if(next==='home')u.searchParams.delete('tab');else u.searchParams.set('tab',next);history.pushState({},'',u.pathname+u.search);window.scrollTo(0,0);};
 const openAdmin=()=>{
  if(!admin||!ready)return;
  setAdminScreen(62);
  navigate('admin');
  const u=new URL(location.href);u.searchParams.set('view','62');
  history.replaceState({},'',u.pathname+u.search);
 };
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
 const approvedDiscovery=(screen:number)=><Discovery production screen={screen} serviceAreas={areas} liveSelection={liveSelection} onLiveSelect={chooseRoute} theme={p.theme}
     onTheme={p.setThemePreference} go={discoveryGo}
     routes={[]} route={null} bookings={[]} signedIn={Boolean(userId)} busy={false} error={areasError}
     onSearch={()=>{}} onSelect={()=>{}}
     onRequest={async()=>{throw Error(t('طلبات الخطوط متاحة من نتائج البحث الحقيقية فقط.','Submit requests through live search results.'));}}
     onFavorite={async()=>{throw Error(t('المفضلة غير متاحة حاليًا.','Favorites are not available yet.'));}}
     onBook={beginBooking} onBooking={()=>navigate('bookings')}
   />;
 const captainGo=(id:number)=>{
   const n=publicScreen(id);
   if(n===3||n===4){setOnboardingScreen(4);navigate('login');return;}
   if(n>=42&&n<=49){setCaptainScreen(n);setTab('routes');
     const u=new URL(location.href);u.searchParams.set('tab','routes');u.searchParams.set('view',String(n));
     history.pushState({},'',u.pathname+u.search);window.scrollTo(0,0);return;}
   if(n<35||n>41)return;
   setCaptainStep(n);const u=new URL(location.href);u.searchParams.set('tab','captain-onboarding');u.searchParams.set('view',String(n));history.pushState({},'',u.pathname+u.search);setTab('captain-onboarding');window.scrollTo(0,0);
 };
 const approvedCaptainOnboarding=(step:number)=><CaptainOnboarding production screen={internalScreen(step)} theme={p.theme}
   onTheme={p.setThemePreference} go={captainGo} profile={null} signedIn={Boolean(userId)}
   rows={[]} busy={false} error="" onRefresh={()=>{}} onEnrolled={()=>setCaptain(true)}/>;
 const signOut=async()=>{if(!client)return;const {error:e}=await client.auth.signOut();if(e)setError(e.message);else navigate('home');};
 const onboardingGo=(n:number)=>{
  if(n===8){navigate('home');return;}
  // Legacy SMS screens are intentionally unreachable outside /dev/screens.
  if(n===5||n===7)n=6;
  if(n>=1&&n<=6){if(n===4&&onboardingScreen===3){try{sessionStorage.setItem('sekka.pendingRole',selectedRole);}catch{/* no session storage */}}setOnboardingScreen(n);navigate('login');}
 };

 return <div className="sekka-mobile" dir={en?'ltr':'rtl'}>
  <a className="sekka-skip" href="#sekka-content">{t('تخطي للمحتوى','Skip to content')}</a>
  <header className="sekka-mobile-header">
   <button className="sekka-brand-button" onClick={()=>navigate('home')} aria-label={t('الرئيسية','Home')}><img className="sekka-approved-logo" src="/brand/approved/app-icon-yellow.png" alt="سِكّة — seKKa"/></button>
   <span>{t('مشوارك، على سِكّة','Your ride, your route')}</span>
   {ready&&admin&&<button type="button" className="sekka-admin-entry" aria-current={tab==='admin'?'page':undefined}
     onClick={openAdmin}>{t('لوحة الإدارة','Admin dashboard')}</button>}
   <button className="sekka-theme" aria-label={t('تغيير المظهر','Switch appearance')} onClick={()=>p.setThemePreference(p.theme==='dark'?'light':'dark')}>{p.theme==='dark'?'☀':'☾'}</button>
  </header>
  <main id="sekka-content" className={`sekka-mobile-content${tab==='admin'&&admin?' sekka-admin-workspace':''}`}>
   {!ready&&<p role="status">{t('بنجهز حسابك…','Loading account…')}</p>}
   {ready&&userId&&adminLookupError&&<div role="alert" className="sekka-mobile-alert">
     <p>{adminLookupError}</p>
     <button type="button" onClick={()=>setAuthCheckRevision(v=>v+1)}>{t('إعادة فحص الصلاحيات','Retry authorization')}</button>
   </div>}
   {error&&<div className="sekka-mobile-alert" role="alert">{error}<button onClick={()=>setError('')}>{t('إغلاق','Dismiss')}</button></div>}
   {tab==='home'&&(!ready?<p role="status">{t('بنجهز حسابك…','Loading account…')}</p>:userId?(captain?(captainApproved?<CaptainRoutes production screen={internalScreen(42)} theme={p.theme} onTheme={p.setThemePreference} go={captainGo}/>:approvedCaptainOnboarding(40)):approvedDiscovery(8)):<Onboarding production screen={2} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={setSelectedRole}/>)}
   {tab==='login'&&<Onboarding production screen={userId?6:onboardingScreen} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={setSelectedRole}/>}
   {tab==='profile'&&(userId?<section className="sekka-mobile-card"><LiveProfile/>{ready&&admin&&<button type="button" className="sekka-action" onClick={openAdmin}>
     {t('فتح لوحة الإدارة','Open Admin dashboard')}</button>}
   <button type="button" onClick={()=>{setCaptainStep(35);navigate('captain-onboarding');}}>{t('ابدأ ككابتن','Become a captain')}</button><button type="button" onClick={()=>void signOut()}>{t('تسجيل الخروج','Sign out')}</button></section>:<section className="sekka-mobile-card"><h1>{t('حسابي','My profile')}</h1><p>{t('سجّل بجوجل علشان تكمل بياناتك.','Sign in with Google to complete your profile.')}</p><button className="sekka-action" onClick={()=>{setOnboardingScreen(4);navigate('login');}}>{t('تسجيل الدخول بجوجل','Sign in with Google')}</button></section>)}
   {selectionError&&['search','booking'].includes(tab)&&<div role="alert" className="sekka-mobile-alert">{selectionError}<button type="button" onClick={()=>setSelectionVersion(v=>v+1)}>{t('إعادة المحاولة','Retry')}</button></div>}
   {tab==='search'&&approvedDiscovery(discoveryScreen)}
   {tab==='booking'&&<V31BookingJourney offer={bookingOffer} routeId={liveSelection?.route.id||''}
     pickupId={new URL(location.href).searchParams.get('pickup')||''} dropoffId={new URL(location.href).searchParams.get('dropoff')||''}
     reverse={new URL(location.href).searchParams.get('reverse')==='1'} bookingId={bookingId}
     onBack={()=>{if(bookingId)navigate('bookings');else{navigate('search');discoveryGo(12);}}}
     onLogin={()=>{try{sessionStorage.setItem('sekka.postAuthPath',location.pathname+location.search);}catch{ /* Safari privacy storage */ }setOnboardingScreen(4);navigate('login');}}
     onBooked={bookingSaved}/>}

   {tab==='captain-onboarding'&&(userId?approvedCaptainOnboarding(captainStep):<Onboarding production screen={4} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={setSelectedRole}/>)}
   {tab==='routes'&&(captain?<CaptainRoutes production screen={internalScreen(captainScreen)} theme={p.theme} onTheme={p.setThemePreference} go={id=>{
      const n=publicScreen(id);setCaptainScreen(n);const u=new URL(location.href);u.searchParams.set('tab','routes');u.searchParams.set('view',String(n));history.pushState({},'',u.pathname+u.search);window.scrollTo(0,0);
   }}/> :<section className="sekka-mobile-card"><h1>{t('خطوط الكابتن','Captain routes')}</h1><p>{userId?t('حسابك مش كابتن معتمد في النظام حاليًا.','This account is not enrolled as a captain.'):t('سجّل الدخول الأول.','Sign in first.')}</p><button className="sekka-action" onClick={()=>{setCaptainStep(35);navigate(userId?'captain-onboarding':'login');}}>{t('بدء تسجيل الكابتن','Start captain onboarding')}</button></section>)}
   {tab==='bookings'&&(userId?<LiveBookings mode={captain?'captain':'rider'}/>:<section className="sekka-mobile-card"><h1>{t('حجوزاتي','My bookings')}</h1><p>{t('سجّل دخولك علشان تشوف حجوزاتك الحقيقية.','Sign in to view your bookings.')}</p><button className="sekka-action" onClick={()=>navigate('login')}>{t('تسجيل الدخول','Sign in')}</button></section>)}
   {tab==='notifications'&&(userId?<LiveNotifications/>:<section className="sekka-mobile-card"><h1>{t('الإشعارات','Notifications')}</h1><button className="sekka-action" onClick={()=>navigate('login')}>{t('تسجيل الدخول','Sign in')}</button></section>)}
   {tab==='admin'&&(!ready?<p role="status">{t('بنتأكد من صلاحية الإدارة…','Checking Admin authorization…')}</p>:admin?<AdminDashboard production screen={internalScreen(adminScreen)} theme={p.theme}
      onTheme={p.setThemePreference} go={id=>{const n=publicScreen(id);setAdminScreen(n);
        const u=new URL(location.href);u.searchParams.set('tab','admin');u.searchParams.set('view',String(n));
        history.pushState({},'',u.pathname+u.search);window.scrollTo(0,0);}}/>:<section className="sekka-mobile-card"><h1>{t('غير مسموح','Access restricted')}</h1><p>{adminLookupError||t('لوحة الإدارة للحسابات المصرح لها فقط.','The admin dashboard requires authorization.')}</p>
   {adminLookupError&&<button type="button" onClick={()=>setAuthCheckRevision(v=>v+1)}>{t('إعادة فحص الصلاحيات','Retry authorization')}</button>}
   <button onClick={()=>navigate('home')}>{t('العودة','Back')}</button></section>)}
  </main>
  <nav className="sekka-bottom-nav" aria-label={t('التنقل الرئيسي','Main navigation')}>
   {([['home','⌂','الرئيسية','Home'],['search','⌕','بحث','Search'],[captain? 'routes':'bookings','▦',captain?'خطوطي':'حجوزاتي',captain?'Routes':'Bookings'],['notifications','♧','الإشعارات','Alerts'],['profile','◉','حسابي','Account']] as [Tab,string,string,string][]).map(([id,icon,ar,english])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>navigate(id)}><span aria-hidden="true">{icon}</span><small>{t(ar,english)}</small></button>)}
  </nav>
 </div>;
}
