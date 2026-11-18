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
import LiveTripRequests from './LiveTripRequests';
import LiveNotifications from './LiveNotifications';
import AdminDashboard from './AdminDashboard';
import {mobileRouteHref,readMobileRoute} from './mobileNavigation';
import type {MobileRoute,RouteSelection} from './mobileNavigation';
import './mobile-app.css';

export default function MobileApp(){
 const p=usePreferences(),en=p.language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [route,setRoute]=useState<MobileRoute>(()=>readMobileRoute());
 const [menuOpen,setMenuOpen]=useState(false);
 const [bookingsSection,setBookingsSection]=useState<'bookings'|'requests'>(()=>{try{return sessionStorage.getItem('sekka.bookingsSection')==='requests'?'requests':'bookings';}catch{return 'bookings';}});
 useEffect(()=>{try{sessionStorage.setItem('sekka.bookingsSection',bookingsSection);}catch{/* Private browsing still works. */}},[bookingsSection]);
 const menuTrigger=useRef<HTMLButtonElement>(null);
 const closeMenu=()=>{setMenuOpen(false);menuTrigger.current?.focus();};
 useEffect(()=>{
  if(!menuOpen)return;
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')closeMenu();};
  document.addEventListener('keydown',onKey);
  return()=>document.removeEventListener('keydown',onKey);
 },[menuOpen]);
 const tab=route.tab;
 const adminScreen=route.tab==='admin'?route.view:62;
 const [captainApproved,setCaptainApproved]=useState(false);
 const captainStep=route.tab==='captain-onboarding'?route.view:35;
 const captainScreen=route.tab==='routes'?route.view:42;
 const discoveryScreen=route.tab==='search'?route.view:9;
 const [liveSelection,setLiveSelection]=useState<LiveSelection|null>(null),[bookingOffer,setBookingOffer]=useState<Line|null>(null),[selectionError,setSelectionError]=useState('');
 const [bookingId,setBookingId]=useState<string|null>(()=>new URL(location.href).searchParams.get('booking'));
 const [selectionVersion,setSelectionVersion]=useState(0);
 const onboardingScreen=route.tab==='login'?route.view:2;
 const [selectedRole,setSelectedRole]=useState(()=>{
  try{if(sessionStorage.getItem('sekka.pendingRole')==='captain')return 'captain';}catch{/* URL fallback below. */}
  return new URL(location.href).searchParams.get('oauth_role')==='captain'?'captain':'rider';
 });
 const [userId,setUserId]=useState<string|null>(null),[captain,setCaptain]=useState(false),[admin,setAdmin]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('');

 const [adminLookupError,setAdminLookupError]=useState('');
 const [sessionLookupError,setSessionLookupError]=useState(false);
 const [authCheckRevision,setAuthCheckRevision]=useState(0);
 const sessionReadId=useRef(0);
 const [areasError,setAreasError]=useState('');
 const [areas,setAreas]=useState<{id:number;name_ar:string;name_en:string}[]>([]);
 useEffect(()=>{const back=()=>{setRoute(readMobileRoute());setBookingId(new URL(location.href).searchParams.get('booking'));setSelectionVersion(v=>v+1);};addEventListener('popstate',back);return()=>removeEventListener('popstate',back);},[]);
 useEffect(()=>{
  const canonical=mobileRouteHref(route);
  const current=location.pathname+location.search+location.hash;
  if(canonical!==current)history.replaceState({route},'',canonical);
 },[route]);
 function navigate(next:MobileRoute,options:{replace?:boolean;selection?:RouteSelection}={}){
  setMenuOpen(false);
  const href=mobileRouteHref(next,location.href,options.selection);
  if(options.replace)history.replaceState({route:next},'',href);
  else history.pushState({route:next},'',href);
  setRoute(next);
  setBookingId(new URL(href,location.origin).searchParams.get('booking'));
  if(!options.replace)window.scrollTo(0,0);
 }
 // Google cancellation can return to a protected deep link rather than the
 // login screen. Keep the user's destination, scrub provider error details and
 // offer a real retry instead of silently displaying an unrelated guest gate.
 useEffect(()=>{
  const callback=new URL(location.href);
  const hash=new URLSearchParams(callback.hash.replace(/^#/,''));
  const failed=callback.searchParams.has('error')||callback.searchParams.has('error_code')||
    hash.has('error')||hash.has('error_code');
  if(!failed||tab==='login'||tab==='captain-onboarding')return;
  const role=callback.searchParams.get('oauth_role')==='captain'?'captain':'rider';
  for(const key of ['error','error_code','error_description','oauth_role','code'])
    callback.searchParams.delete(key);
  if(hash.has('error')||hash.has('error_code'))callback.hash='';
  const intended=callback.pathname+callback.search+callback.hash;
  try{
   sessionStorage.setItem('sekka.pendingRole',role);
   sessionStorage.setItem('sekka.postAuthPath',intended);
  }catch{/* Callback still supports a new sign-in attempt. */}
  setSelectedRole(role);
  setError(t('تسجيل الدخول بجوجل ما اكتملش. تقدر تحاول تاني.','Google sign-in did not complete. You can try again.'));
  history.replaceState(history.state,'',intended);
  navigate({tab:'login',view:4},{replace:true});
 // OAuth failure is handled on entry; avoid rerunning on language/theme changes.
 },[]);
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
      period:s.route.period,direction:s.reverse?'return':s.route.direction==='round_trip'?'round_trip':'outbound',amount:s.route.price_egp,
      selectedStops:{pickup:{id:s.from.id,name:s.from.name,area:'',pickup:true,dropoff:false},
        dropoff:{id:s.to.id,name:s.to.name,area:'',pickup:false,dropoff:true},
        returnPickup:!s.reverse&&s.route.direction==='round_trip'&&s.route.return_supported
          ?{id:s.to.id,name:s.to.name,area:'',pickup:true,dropoff:false}:null,
        returnDropoff:!s.reverse&&s.route.direction==='round_trip'&&s.route.return_supported
          ?{id:s.from.id,name:s.from.name,area:'',pickup:false,dropoff:true}:null}
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
   setAdmin(false);setAdminLookupError('');setSessionLookupError(false);
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
    if(pendingRole!=='rider'&&pendingRole!=='captain'){
      const callbackRole=new URL(location.href).searchParams.get('oauth_role');
      pendingRole=callbackRole==='rider'||callbackRole==='captain'?callbackRole:null;
    }
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
          try{
           sessionStorage.removeItem('sekka.pendingRole');
           sessionStorage.removeItem('sekka.postAuthPath');
          }catch{/* private mode */}
          const callbackUrl=new URL(location.href);
          if(callbackUrl.searchParams.has('oauth_role')){
            callbackUrl.searchParams.delete('oauth_role');
            history.replaceState(history.state,'',callbackUrl.pathname+callbackUrl.search+callbackUrl.hash);
          }
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
      // The Google callback commonly lands on S006 rather than the root.
      // Route a verified Admin to the real dashboard after that specific
      // completion screen, but NEVER override explicit user deep links.
      const finishingGoogleLogin=u.searchParams.get('tab')==='login'&&u.searchParams.get('view')==='6';
      if(!u.searchParams.has('tab')||finishingGoogleLogin){
        const destination:MobileRoute={tab:'admin',view:62};
        history.replaceState({route:destination},'',mobileRouteHref(destination));
        setRoute(destination);
      }
    }
    setReady(true);
   }catch{
    if(!active||readId!==sessionReadId.current)return;
    setUserId(null);setCaptain(false);setCaptainApproved(false);setAdmin(false);
    setAdminLookupError('');setSessionLookupError(true);
    setError(t('تعذر التحقق من جلسة الدخول. افحص اتصالك وحاول تاني.','Could not verify your sign-in session. Check your connection and retry.'));
    setReady(true);
   }
  }
  void read();
  const sub=client?.auth.onAuthStateChange((_event,session)=>{
    queueMicrotask(()=>{if(active)void read(session);});
  });
  return()=>{active=false;sessionReadId.current++;sub?.data.subscription.unsubscribe();};
 },[authCheckRevision]);
 useEffect(()=>{if(!client)return;void client.from('v31_service_areas').select('id,name_ar,name_en').eq('active',true).order('id').then(({data,error:e})=>{if(e)setAreasError(e.message);else if(data){setAreas(data);setAreasError('');}});},[]);
 useEffect(()=>{
  if(tab!=='captain-onboarding'||!ready||userId)return;
  setSelectedRole('captain');
  try{
   sessionStorage.setItem('sekka.pendingRole','captain');
   sessionStorage.setItem('sekka.postAuthPath',mobileRouteHref(route));
  }catch{/* The Captain entry remains available without session storage. */}
 },[tab,captainStep,ready,userId,route]);
 useEffect(()=>{
  if(tab!=='login'||onboardingScreen!==6||!ready||userId)return;
  try{sessionStorage.setItem('sekka.postAuthPath','/?tab=login&view=6');}catch{/* Optional callback storage. */}
  navigate({tab:'login',view:4},{replace:true});
 },[tab,onboardingScreen,ready,userId]);
 const openAdmin=()=>{
  if(!admin||!ready)return;
  navigate({tab:'admin',view:62});
 };
 const discoveryGo=(id:number)=>{
  if([9,10,11,12].includes(id))navigate({tab:'search',view:id as 9|10|11|12});
  else if(id===4)signInFor(mobileRouteHref({tab:'search',view:discoveryScreen}));
  else if(id===33)navigate({tab:'notifications'});
  else if(id===29)navigate({tab:'bookings'});
  else navigate({tab:'home'});
 };
 const chooseRoute=(s:LiveSelection)=>{
  setLiveSelection(s);setSelectionError('');
  navigate({tab:'search',view:12},{selection:{routeId:s.route.id,pickupId:s.from.id,dropoffId:s.to.id,reverse:s.reverse}});
 };
 const beginBooking=(offer:Line)=>{
  if(!liveSelection||!offer.selectedStops){setSelectionError(t('اختار نقطتي ركوب ونزول صحيحتين.','Select valid pickup and drop-off stops.'));return;}
  setBookingOffer(offer);setBookingId(null);
  navigate({tab:'booking'},{selection:{routeId:liveSelection.route.id,pickupId:offer.selectedStops.pickup.id,
    dropoffId:offer.selectedStops.dropoff.id,reverse:liveSelection.reverse}});
 };
 const bookingSaved=(id:string)=>{
   setBookingId(id);const u=new URL(location.href);u.searchParams.set('tab','booking');u.searchParams.set('booking',id);
   history.replaceState({route:{tab:'booking'}},'',u.pathname+u.search);
 };
 const approvedDiscovery=(screen:number)=><Discovery production riderId={userId} screen={screen} serviceAreas={areas} liveSelection={liveSelection} onLiveSelect={chooseRoute} theme={p.theme}
     onTheme={p.setThemePreference} go={discoveryGo}
     routes={[]} route={null} bookings={[]} signedIn={Boolean(userId)} busy={false} error={areasError}
     onSearch={()=>{}} onSelect={()=>{}}
     onRequest={async()=>{throw Error(t('طلبات الخطوط متاحة من نتائج البحث الحقيقية فقط.','Submit requests through live search results.'));}}
     onFavorite={async()=>{throw Error(t('المفضلة غير متاحة حاليًا.','Favorites are not available yet.'));}}
     onBook={beginBooking} onBooking={()=>navigate({tab:'bookings'})}
   />;
 const captainGo=(id:number)=>{
   const n=publicScreen(id);
   if(n>=42&&n<=49)navigate({tab:'routes',view:n as 42|43|44|45|46|47|48|49});
   else if(n>=35&&n<=41)captainOnboardingGo(n);
 };
 const captainOnboardingGo=(step:number)=>{
  if(step>=35&&step<=41)navigate({tab:'captain-onboarding',view:step as 35|36|37|38|39|40|41});
 };
 // A guest entering a prerequisite must return to that exact destination.
 // Do not inherit an unrelated Captain role or an old OAuth return path.
 const signInFor=(returnPath:string)=>{
  setSelectedRole('rider');
  try{
   sessionStorage.setItem('sekka.pendingRole','rider');
   sessionStorage.setItem('sekka.postAuthPath',returnPath);
  }catch{/* The callback URL also preserves the Rider role. */}
  navigate({tab:'login',view:4});
 };
 const startCaptainJourney=()=>{
  setSelectedRole('captain');
  if(userId){navigate({tab:'captain-onboarding',view:35});return;}
  try{
   sessionStorage.setItem('sekka.pendingRole','captain');
   sessionStorage.setItem('sekka.postAuthPath','/?tab=captain-onboarding&view=35');
  }catch{/* Authentication continues in the current page context when storage is disabled. */}
  navigate({tab:'captain-onboarding',view:35});
 };
 const approvedCaptainOnboarding=(step:number)=><CaptainOnboarding production screen={internalScreen(step)} journeyScreen={step}
   theme={p.theme} onTheme={p.setThemePreference} go={captainGo} onJourneyGo={captainOnboardingGo}
   onJourneyBack={()=>navigate({tab:'home'})} profile={null} signedIn={Boolean(userId)}
   rows={[]} busy={false} error="" onRefresh={()=>{}} onEnrolled={()=>setCaptain(true)}/>;
 const signOut=async()=>{
  if(!client)return;
  const {error:e}=await client.auth.signOut();
  if(e){setError(t('تعذّر تسجيل الخروج. حاول تاني.','Unable to sign out. Please try again.'));return;}
  setUserId(null);setCaptain(false);setCaptainApproved(false);setAdmin(false);
  setSelectedRole('rider');
  try{
   sessionStorage.removeItem('sekka.pendingRole');
   sessionStorage.removeItem('sekka.postAuthPath');
  }catch{/* Sign-out still clears the Supabase session. */}
  navigate({tab:'home'},{replace:true});
 };
 const onboardingGo=(n:number)=>{
  // The signed-out onboarding sequence is Welcome (root) -> Role -> Google.
  // Both the in-app Back control and browser Back can return to Welcome.
  // Only a verified Google session allows the real Rider Home.
  if(n===2){
   navigate({tab:'home'},{replace:true});
   return;
  }
  if(n===8){navigate({tab:'home'});return;}
  if(n===37){startCaptainJourney();return;}
  // Legacy SMS screens are intentionally unreachable outside /dev/screens.
  if(n===5||n===7)n=6;
  if(n>=1&&n<=6){
   if(n===4){
    const captainIntent=selectedRole==='captain'||tab==='captain-onboarding';
    try{
     if(captainIntent)sessionStorage.setItem('sekka.pendingRole','captain');
     else sessionStorage.setItem('sekka.pendingRole','rider');
     sessionStorage.setItem('sekka.postAuthPath',captainIntent
       ?'/?tab=captain-onboarding&view=35':'/?tab=login&view=6');
    }catch{/* The current-page fallback remains available without session storage. */}
   }
   navigate({tab:'login',view:n===1||n===2?2:n===3?3:n===4?4:6});
  }
 };
 const selectRole=(role:string)=>{
  setSelectedRole(role);
  if(role==='rider'||role==='captain'){
   try{sessionStorage.setItem('sekka.pendingRole',role);}catch{/* Role selection remains in memory. */}
  }
 };

 const menuLink=(label:string,next:MobileRoute)=><button type="button" onClick={()=>{if(next.tab==='bookings')setBookingsSection('bookings');navigate(next)}}
  aria-current={tab===next.tab?'page':undefined}>{label}</button>;
 const fullScreenSearchFilters=tab==='search'&&discoveryScreen===10;
 const fullScreenAuth=(tab==='login'&&(onboardingScreen===3||onboardingScreen===4))||(tab==='captain-onboarding'&&!userId);
 const fullScreenSearch=tab==='search'&&discoveryScreen===9;
 return <div className={`sekka-mobile sekka-tab-${tab}${fullScreenSearchFilters?' sekka-search-filters':''}${fullScreenAuth?' sekka-fullscreen-auth':''}${fullScreenSearch?' sekka-fullscreen-search':''}${userId&&tab==='captain-onboarding'?' sekka-captain-logged-in':''}${!userId&&tab==='home'?' sekka-guest-welcome':''}`} dir={en?'ltr':'rtl'}>
  <a className="sekka-skip" href="#sekka-content">{t('تخطي للمحتوى','Skip to content')}</a>
  <header className={`sekka-mobile-header${ready&&admin?' sekka-mobile-header-admin':''}`}>
   <button type="button" ref={menuTrigger} className="sekka-shell-menu" aria-label={t('فتح القائمة','Open menu')}
    aria-expanded={menuOpen} aria-controls="sekka-side-menu" onClick={()=>setMenuOpen(true)}>
    <span aria-hidden="true">☰</span>
   </button>
   <span className="sekka-current-section">{tab==='home'?t('الرئيسية','Home'):tab==='search'?t('البحث','Search'):
    tab==='booking'?t('الحجز','Booking'):tab==='bookings'?t('حجوزاتي','My bookings'):
    tab==='notifications'?t('الإشعارات','Notifications'):tab==='profile'?t('حسابي','My profile'):
    tab==='routes'?t('خطوط الكابتن','Captain routes'):tab==='captain-onboarding'?t('ملف الكابتن','Captain application'):tab==='admin'?t('الإدارة','Admin'):t('سِكّة','seKKa')}</span>
   {ready&&admin&&<button type="button" className="sekka-admin-entry" aria-current={tab==='admin'?'page':undefined}
     onClick={openAdmin}>{t('لوحة الإدارة','Admin dashboard')}</button>}
  </header>
  <main id="sekka-content" className={`sekka-mobile-content${tab==='admin'&&admin?' sekka-admin-workspace':''}`}>
   {!ready&&<p role="status">{t('بنجهز حسابك…','Loading account…')}</p>}
   {ready&&userId&&adminLookupError&&<div role="alert" className="sekka-mobile-alert">
     <p>{adminLookupError}</p>
     <button type="button" onClick={()=>setAuthCheckRevision(v=>v+1)}>{t('إعادة فحص الصلاحيات','Retry authorization')}</button>
   </div>}
   {error&&<div className="sekka-mobile-alert" role="alert">{error}
     {sessionLookupError&&<button type="button" onClick={()=>{setError('');setAuthCheckRevision(v=>v+1)}}>{t('إعادة التحقق من الجلسة','Retry session')}</button>}
     <button type="button" onClick={()=>{setError('');setSessionLookupError(false)}}>{t('إغلاق','Dismiss')}</button></div>}
   {tab==='home'&&(!ready?<p role="status">{t('بنجهز حسابك…','Loading account…')}</p>:userId?approvedDiscovery(8):<Onboarding production screen={2} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={setSelectedRole}/>)}
   {ready&&tab==='login'&&<Onboarding production screen={userId?6:!ready?4:onboardingScreen} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={selectRole}/>}
   {ready&&tab==='profile'&&(userId?<section className="sekka-mobile-card"><LiveProfile/>{ready&&admin&&<button type="button" className="sekka-action" onClick={openAdmin}>
     {t('فتح لوحة الإدارة','Open Admin dashboard')}</button>}
   <button type="button" onClick={startCaptainJourney}>{captainApproved?t('فتح حساب الكابتن','Open Captain journey'):t('ابدأ ككابتن','Enter Captain journey')}</button><button type="button" onClick={()=>void signOut()}>{t('تسجيل الخروج','Sign out')}</button></section>:<section className="sekka-mobile-card"><h1>{t('حسابي','My profile')}</h1><p>{t('سجّل بجوجل علشان تكمل بياناتك.','Sign in with Google to complete your profile.')}</p><button className="sekka-action" onClick={()=>signInFor('/?tab=login&view=6')}>{t('تسجيل الدخول بجوجل','Sign in with Google')}</button></section>)}
   {selectionError&&['search','booking'].includes(tab)&&<div role="alert" className="sekka-mobile-alert">{selectionError}<button type="button" onClick={()=>setSelectionVersion(v=>v+1)}>{t('إعادة المحاولة','Retry')}</button></div>}
   {tab==='search'&&approvedDiscovery(discoveryScreen)}
   {ready&&tab==='booking'&&<V31BookingJourney offer={bookingOffer} routeId={liveSelection?.route.id||''}
     pickupId={new URL(location.href).searchParams.get('pickup')||''} dropoffId={new URL(location.href).searchParams.get('dropoff')||''}
     reverse={new URL(location.href).searchParams.get('reverse')==='1'} bookingId={bookingId}
     onBack={()=>{if(bookingId)navigate({tab:'bookings'});else navigate({tab:'search',view:12});}}
     onLogin={()=>signInFor(location.pathname+location.search+location.hash)}
     onBooked={bookingSaved}/>}

   {ready&&tab==='captain-onboarding'&&(userId?approvedCaptainOnboarding(captainStep):<Onboarding production screen={4} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={selectRole}/>)}
   {ready&&tab==='routes'&&(captain&&captainApproved?<CaptainRoutes production screen={internalScreen(captainScreen)} theme={p.theme} onTheme={p.setThemePreference} go={captainGo}/> :<section className="sekka-mobile-card"><h1>{t('خطوط الكابتن','Captain routes')}</h1><p>{captain?t('حساب الكابتن لم يُعتمد بعد.','Captain access is not approved yet.'):t('ابدأ تسجيل الكابتن لمتابعة طلب الاعتماد.','Start Captain enrollment to continue.')}</p><button className="sekka-action" onClick={()=>captain?navigate({tab:'captain-onboarding',view:40}):startCaptainJourney()}>{captain?t('متابعة حالة الطلب','View application status'):t('بدء تسجيل الكابتن','Start Captain enrollment')}</button></section>)}
   {ready&&tab==='bookings'&&(userId?<section className="sekka-bookings-workspace">
    <nav className="sekka-bookings-section-tabs" aria-label={t('إدارة الحجوزات والطلبات','Bookings and requests')}>
     <button type="button" aria-pressed={bookingsSection==='bookings'} onClick={()=>setBookingsSection('bookings')}>{t('حجوزاتي المؤكدة وقيد الانتظار','My seat bookings')}</button>
     <button type="button" aria-pressed={bookingsSection==='requests'} onClick={()=>setBookingsSection('requests')}>{t('طلبات رحلاتي','My trip requests')}</button>
    </nav>
    {bookingsSection==='bookings'?<LiveBookings mode="rider" onFindRide={()=>navigate({tab:'search',view:9})}/>:<LiveTripRequests mode="rider"/>}
   </section>:<section className="sekka-mobile-card"><h1>{t('حجوزاتي','My bookings')}</h1><p>{t('سجّل دخولك علشان تشوف حجوزاتك الحقيقية.','Sign in to view your bookings.')}</p><button className="sekka-action" onClick={()=>signInFor('/?tab=bookings')}>{t('تسجيل الدخول','Sign in')}</button></section>)}
   {ready&&tab==='notifications'&&(userId?<LiveNotifications/>:<section className="sekka-mobile-card"><h1>{t('الإشعارات','Notifications')}</h1><button className="sekka-action" onClick={()=>signInFor('/?tab=notifications')}>{t('تسجيل الدخول','Sign in')}</button></section>)}
   {tab==='admin'&&(!ready?<p role="status">{t('بنتأكد من صلاحية الإدارة…','Checking Admin authorization…')}</p>:admin?<AdminDashboard production screen={internalScreen(adminScreen)} theme={p.theme}
      onTheme={p.setThemePreference} go={id=>{const n=publicScreen(id);if(n>=62&&n<=73)navigate({tab:'admin',view:n as 62|63|64|65|66|67|68|69|70|71|72|73});}}/>:<section className="sekka-mobile-card"><h1>{t('غير مسموح','Access restricted')}</h1><p>{adminLookupError||t('لوحة الإدارة للحسابات المصرح لها فقط.','The admin dashboard requires authorization.')}</p>
   {adminLookupError&&<button type="button" onClick={()=>setAuthCheckRevision(v=>v+1)}>{t('إعادة فحص الصلاحيات','Retry authorization')}</button>}
   <button onClick={()=>navigate({tab:'home'})}>{t('العودة','Back')}</button></section>)}
  </main>
  {menuOpen&&<div className="sekka-menu-layer">
   <button type="button" className="sekka-menu-backdrop" aria-label={t('إغلاق القائمة','Close menu')} onClick={closeMenu}/>
   <dialog open id="sekka-side-menu" className="sekka-side-drawer" aria-modal="true"
    aria-label={t('القائمة الرئيسية','Main menu')} dir={en?'ltr':'rtl'}>
    <header className="sekka-side-drawer__header"><strong>{t('القائمة','Menu')}</strong>
     <button type="button" className="sekka-side-drawer__close" onClick={closeMenu}
      aria-label={t('إغلاق القائمة','Close menu')}>×</button></header>
    <nav aria-label={t('الأقسام','Sections')}>
     <h2>{t('التنقل','Navigation')}</h2>
     {menuLink(t('الرئيسية','Home'),{tab:'home'})}
     {menuLink(t('البحث عن خط','Find a route'),{tab:'search',view:9})}
     {menuLink(t('حجوزاتي','My bookings'),{tab:'bookings'})}
     {ready&&userId&&<button type="button" aria-current={tab==='bookings'&&bookingsSection==='requests'?'page':undefined}
       onClick={()=>{navigate({tab:'bookings'});setBookingsSection('requests');}}>{t('طلبات رحلاتي','My trip requests')}</button>}
     {menuLink(t('الإشعارات','Notifications'),{tab:'notifications'})}
     {menuLink(t('حسابي','My profile'),{tab:'profile'})}
     <h2>{t('الكابتن','Captain')}</h2>
     <button type="button" onClick={startCaptainJourney}>{t('تسجيل / متابعة طلب الكابتن','Captain registration / application')}</button>
     {ready&&captain&&captainApproved&&menuLink(t('خطوطي','My routes'),{tab:'routes',view:42})}
     {ready&&admin&&<><h2>{t('الإدارة','Administration')}</h2>
      {menuLink(t('لوحة الإدارة','Admin dashboard'),{tab:'admin',view:62})}</>}
     <h2>{t('اللغة والمظهر','Language & appearance')}</h2>
     <button type="button" className="sekka-drawer-preference sekka-language" aria-label={en?'Switch to Arabic':'التبديل إلى الإنجليزية'}
       onClick={()=>p.setLanguagePreference(en?'ar':'en')}>
      <span aria-hidden="true" className="sekka-drawer-pref-icon">🌐</span><span>{t('اللغة','Language')} · {en?'العربية':'English'}</span>
     </button>
     <button type="button" className="sekka-drawer-preference sekka-theme" aria-label={t('تغيير المظهر','Switch appearance')}
       onClick={()=>p.setThemePreference(p.theme==='dark'?'light':'dark')}>
      <span aria-hidden="true" className="sekka-drawer-pref-icon">☾</span>
      <span>{p.theme==='dark'?t('الوضع الفاتح','Light mode'):t('الوضع الداكن','Dark mode')}</span>
     </button>
     {ready&&userId&&<><h2>{t('الحساب','Account')}</h2>
      <button type="button" onClick={()=>void signOut()}>{t('تسجيل الخروج','Sign out')}</button></>}
    </nav>
   </dialog>
  </div>}
 </div>;
}
