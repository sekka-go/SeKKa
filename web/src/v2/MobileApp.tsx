import AppSkeleton from './AppSkeleton';
import type {Session} from '@supabase/supabase-js';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
import {requestSharedPublic} from './sharedPublicRequests';
import Onboarding from './Onboarding';
import Discovery from './Discovery';
import type {Line} from './Discovery';
import {fetchPublishedSelection} from './LiveRouteSearch';
import type {LiveSelection} from './LiveRouteSearch';
// Load role-gated flows only when the user reaches them; public search and
// Google entry must not download Captain/Admin code on the first visit.
const V31BookingJourney=lazy(()=>import('./BookingFlow').then(module=>({default:module.V31BookingJourney})));
const CaptainRoutes=lazy(()=>import('./CaptainRoutes'));
const CaptainOnboarding=lazy(()=>import('./CaptainOnboarding'));
import {internalScreen,publicScreen} from './screenMap';
import LiveProfile from './LiveProfile';
import RiderBookingsV3 from './RiderBookingsV3';
import './rider-extras-v3.css';
import RiderJourneyHome from './RiderJourneyHome';
import RiderTabBar from './RiderTabBar';
import type {RiderTab} from './RiderTabBar';
import LiveTripRequests from './LiveTripRequests';
import LiveNotifications from './LiveNotifications';
import AppTour from './AppTour';
import SessionLoader from './SessionLoader';
const AdminDashboard=lazy(()=>import('./AdminDashboard'));
import {mobileRouteHref,readMobileRoute} from './mobileNavigation';
import type {MobileRoute,RouteSelection} from './mobileNavigation';
import './mobile-app.css';
import './flow-navigation.css';
import './brand-sky-flow.css';
import './sekka-flow-redesign.css';
import './brand-yellow-black.css';
import './stagger-motion.css';
import {useSekkaSliverScroll} from './sliverScroll';
import './sliver-scroll.css';
import './navigation-reference-refresh.css';
import './auth-contrast.css';
import './guest-booking-header.css';
import './wave-home-showcase.css';

export default function MobileApp(){
 const p=usePreferences(),en=p.language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [route,setRoute]=useState<MobileRoute>(()=>readMobileRoute());
 const [tourReplayToken,setTourReplayToken]=useState(0);
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
 // Unified native scroll surface for Rider, Captain, and Admin routes.
 useSekkaSliverScroll(`${route.tab}:${'view' in route?route.view:''}:${bookingsSection}`,true);
 const adminScreen=route.tab==='admin'?route.view:62;
 const [captainApproved,setCaptainApproved]=useState(false);
 const captainStep=route.tab==='captain-onboarding'?route.view:35;
 const captainScreen=route.tab==='routes'?route.view:42;
 const discoveryScreen=route.tab==='search'?route.view:9;
 const [liveSelection,setLiveSelection]=useState<LiveSelection|null>(null),[bookingOffer,setBookingOffer]=useState<Line|null>(null),[selectionError,setSelectionError]=useState('');
 const [bookingId,setBookingId]=useState<string|null>(()=>new URL(location.href).searchParams.get('booking'));
 const [selectionVersion,setSelectionVersion]=useState(0);
 const selectionParams=new URLSearchParams(location.search);
 const selectedRouteId=selectionParams.get('route')||'',selectedPickupId=selectionParams.get('pickup')||'',selectedDropoffId=selectionParams.get('dropoff')||'',selectedReverse=selectionParams.get('reverse')==='1';
 const matchingSelection=liveSelection?.route.id===selectedRouteId&&liveSelection.from.id===selectedPickupId&&liveSelection.to.id===selectedDropoffId&&liveSelection.reverse===selectedReverse?liveSelection:null;
 const selectionLoading=Boolean(selectedRouteId&&selectedPickupId&&selectedDropoffId&&!matchingSelection&&!selectionError);
 const onboardingScreen=route.tab==='login'?route.view:2;
 const [selectedRole,setSelectedRole]=useState(()=>{
  try{if(sessionStorage.getItem('sekka.pendingRole')==='captain')return 'captain';}catch{/* URL fallback below. */}
  return new URL(location.href).searchParams.get('oauth_role')==='captain'?'captain':'rider';
 });
 const [userId,setUserId]=useState<string|null>(null),[captain,setCaptain]=useState(false),[admin,setAdmin]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('');
 const [accountRole,setAccountRole]=useState<'rider'|'captain'|null>(null);
 const [sessionSlow,setSessionSlow]=useState(false);
 useEffect(()=>{
  if(ready){setSessionSlow(false);return;}
  const id=window.setTimeout(()=>setSessionSlow(true),8500);
  return()=>window.clearTimeout(id);
 },[ready]);

 const [adminLookupError,setAdminLookupError]=useState('');
 const [sessionLookupError,setSessionLookupError]=useState(false);
 const [authCheckRevision,setAuthCheckRevision]=useState(0);
 const sessionReadId=useRef(0);
 const verifiedUserId=useRef<string|null>(null);
 const [areasError,setAreasError]=useState('');
 const [areas,setAreas]=useState<{id:number;name_ar:string;name_en:string}[]>([]);
 const [areasLoaded,setAreasLoaded]=useState(false);
 useEffect(()=>{const back=()=>{setRoute(readMobileRoute());setBookingId(new URL(location.href).searchParams.get('booking'));setSelectionVersion(v=>v+1);};addEventListener('popstate',back);return()=>removeEventListener('popstate',back);},[]);
 useEffect(()=>{
  const canonical=mobileRouteHref(route,location.href);
  const current=location.pathname+location.search+location.hash;
  if(canonical!==current)history.replaceState({route},'',canonical);
 },[route]);
 function navigate(next:MobileRoute,options:{replace?:boolean;selection?:RouteSelection;bookingId?:string}={}){
  setMenuOpen(false);
  const href=mobileRouteHref(next,location.href,options.selection,options.bookingId);
  const current=location.pathname+location.search+location.hash;
  if(href===current){setRoute(next);return;}
  const state={route:next,sekkaNavigation:true,from:route};
  if(options.replace)history.replaceState(state,'',href);
  else history.pushState(state,'',href);
  setRoute(next);
  setBookingId(new URL(href,location.origin).searchParams.get('booking'));
  window.scrollTo(0,0);
 }
 const backToPreviousSection=()=>{
  const state=history.state as {sekkaNavigation?:boolean;from?:MobileRoute}|null;
  if(state?.sekkaNavigation&&state.from){history.back();return;}
  navigate(isCaptainAccount?{tab:'routes',view:42}:{tab:'home'},{replace:true});
 };
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
  if(!route||!pickup||!dropoff){setLiveSelection(null);setBookingOffer(null);setSelectionError('');return;}
  setLiveSelection(null);setBookingOffer(null);setSelectionError('');
  void fetchPublishedSelection(route,pickup,dropoff,u.searchParams.get('reverse')==='1').then(s=>{
    if(!active)return;setLiveSelection(s);
    if(tab==='booking')setBookingOffer({
      id:s.route.id,routeId:s.route.id,origin:areas.find(a=>a.id===s.from.area_id)?.name_ar||s.from.name,
      destination:areas.find(a=>a.id===s.to.area_id)?.name_ar||s.to.name,category:s.route.category,
      available:s.remaining,outbound:s.route.outbound_time?.slice(0,5)||'',returnTime:s.route.return_time?.slice(0,5)||'',
      period:s.route.period,direction:s.reverse?'return':s.route.direction==='round_trip'?'round_trip':'outbound',amount:s.route.seat_price_egp,
      selectedStops:{pickup:{id:s.from.id,name:s.from.name,area:'',pickup:true,dropoff:false},
        dropoff:{id:s.to.id,name:s.to.name,area:'',pickup:false,dropoff:true},
        returnPickup:!s.reverse&&s.route.direction==='round_trip'&&s.route.return_supported
          ?{id:s.to.id,name:s.to.name,area:'',pickup:true,dropoff:false}:null,
        returnDropoff:!s.reverse&&s.route.direction==='round_trip'&&s.route.return_supported
          ?{id:s.from.id,name:s.from.name,area:'',pickup:false,dropoff:true}:null}
    });
  }).catch(e=>{if(active){setLiveSelection(null);setSelectionError(e instanceof Error?e.message:String(e));}});
  return()=>{active=false;};
 },[tab,selectedRouteId,selectedPickupId,selectedDropoffId,selectedReverse,selectionVersion,areas]);

 useEffect(()=>{let active=true;
  let adminLandingHandled=false;
  async function read(supplied?:Session|null){
   const readId=++sessionReadId.current;
   if(!client){if(active)setReady(true);return;}
   // Android opens Files/Photos as a separate activity. On focus return,
   // Supabase may emit SIGNED_IN/TOKEN_REFRESHED for the SAME verified user.
   // Do not unmount their file input mid-selection. Reverify in the background,
   // but fail closed immediately if actor changes or verification fails.
   const sameVerifiedActor=Boolean(supplied?.user?.id&&
    verifiedUserId.current===supplied.user.id);
   if(!sameVerifiedActor){setReady(false);setAdmin(false);}
   setAdminLookupError('');setSessionLookupError(false);
   try{
    const {data:sessionData,error:sessionError}=supplied===undefined
      ?await client.auth.getSession():{data:{session:supplied},error:null};
    if(!active||readId!==sessionReadId.current)return;
    if(sessionError)throw sessionError;
    const session=sessionData.session;
    if(!session){
     verifiedUserId.current=null;
     setUserId(null);setCaptain(false);setCaptainApproved(false);setAccountRole(null);
     setAdmin(false);setAdminLookupError('');setReady(true);return;
    }
    // A saved browser session alone is not proof of the current actor.
    // Resolve and validate the real authenticated identity with Supabase Auth.
    const {data:{user},error:userError}=await client.auth.getUser();
    if(!active||readId!==sessionReadId.current)return;
    if(userError||!user||user.id!==session.user.id)throw Error('AUTH_SESSION_NOT_VERIFIED');
    const [{data:captainRow,error:captainError},{data:adminAccess,error:adminError},{data:profile,error:profileError}]=await Promise.all([
     client.from('v31_captain_profiles').select('user_id,approval_status').eq('user_id',user.id).maybeSingle(),
     client.rpc('v31_is_admin'),
     client.from('v31_profiles').select('user_id,role_preference').eq('user_id',user.id).maybeSingle()
    ]);
    if(!active||readId!==sessionReadId.current)return;
    // Failed Captain authorization lookup must not silently turn a Captain into a Rider.
    if(captainError)throw captainError;
    if(profileError)throw profileError;
    if(adminError||typeof adminAccess!=='boolean'){
      // A network/RPC failure is NOT the same as a server denial of Admin rights.
      setAdminLookupError(t('تعذر التأكد من صلاحية الإدارة. أعد التحقق.', 'Could not verify Admin access. Retry authorization.'));
      setAdmin(false);
    }else{
      setAdmin(adminAccess===true);
    }
    let enrolled=Boolean(captainRow);
    // A server-approved Captain remains a Captain even if a legacy profile
    // says rider; browser state alone never grants Captain permissions.
    const approvedCaptain=captainRow?.approval_status==='approved';
    let resolvedAccountRole:'rider'|'captain'=approvedCaptain?'captain':
      profile?.role_preference==='rider'?'rider':
      profile?.role_preference==='captain'?'captain':enrolled?'captain':'rider';
    // Preserve existing Google identities; role preference is NOT Admin authorization.
    let pendingRole:string|null=null;
    try{pendingRole=sessionStorage.getItem('sekka.pendingRole');}catch{/* private mode */}
    if(pendingRole!=='rider'&&pendingRole!=='captain'){
      const callbackRole=new URL(location.href).searchParams.get('oauth_role');
      pendingRole=callbackRole==='rider'||callbackRole==='captain'?callbackRole:null;
    }
    if(approvedCaptain){
      // An old Rider OAuth intent must never downgrade a real approved Captain.
      try{
       sessionStorage.removeItem('sekka.pendingRole');
       sessionStorage.removeItem('sekka.postAuthPath');
      }catch{/* Approval is read from the server, not storage. */}
      const callbackUrl=new URL(location.href);
      if(callbackUrl.searchParams.has('oauth_role')){
       callbackUrl.searchParams.delete('oauth_role');
       history.replaceState(history.state,'',callbackUrl.pathname+callbackUrl.search+callbackUrl.hash);
      }
    }else if(pendingRole==='rider'||pendingRole==='captain'){
      if(pendingRole==='captain'&&profile?.role_preference==='rider'){
        // A Rider's existing Google identity cannot be upgraded to Captain by
        // a stale OAuth callback or a manually edited pendingRole.
        setError(t('حساب الراكب لا يمكن تحويله إلى كابتن. سجّل الخروج واستخدم حساب جوجل منفصل للكابتن.',
          'A Rider account cannot be converted to Captain. Sign out and use a separate Google account for Captain registration.'));
        setSelectedRole('rider');
        try{
          sessionStorage.removeItem('sekka.pendingRole');
          sessionStorage.removeItem('sekka.postAuthPath');
        }catch{/* Verified account role remains unchanged. */}
        const callbackUrl=new URL(location.href);
        if(callbackUrl.searchParams.has('oauth_role')){
          callbackUrl.searchParams.delete('oauth_role');
          history.replaceState(history.state,'',callbackUrl.pathname+callbackUrl.search+callbackUrl.hash);
        }
      }else{
        const {error:saveError}=profile
          ?await client.from('v31_profiles').update({role_preference:pendingRole}).eq('user_id',user.id)
          :await client.from('v31_profiles').insert({user_id:user.id,role_preference:pendingRole,
            display_name:user.user_metadata?.full_name||''});
        if(!active||readId!==sessionReadId.current)return;
        if(saveError){setError(saveError.message);}
        else{
          resolvedAccountRole=pendingRole;
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
    verifiedUserId.current=user.id;
    setUserId(user.id);setCaptain(enrolled);setAccountRole(resolvedAccountRole);
    setCaptainApproved(approvedCaptain);
    // Admin landing is a navigation preference, not permission assignment.
    // Respect explicit passenger/captain/deep-link destinations.
    if(approvedCaptain&&adminAccess===false){
     // A verified Captain lands in the Captain area on opening the app or
     // finishing Google sign-in, never the Rider discovery screen.
     const destinationFromUrl=readMobileRoute();
     if(['home','search','booking','bookings','login','captain-onboarding'].includes(destinationFromUrl.tab)){
      const captainDestination:MobileRoute={tab:'routes',view:42};
      history.replaceState({route:captainDestination},'',mobileRouteHref(captainDestination));
      setRoute(captainDestination);
     }
    }
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
    verifiedUserId.current=null;
    setUserId(null);setCaptain(false);setCaptainApproved(false);setAccountRole(null);setAdmin(false);
    setAdminLookupError('');setSessionLookupError(true);
    setError(t('تعذر التحقق من جلسة الدخول. افحص اتصالك وحاول تاني.','Could not verify your sign-in session. Check your connection and retry.'));
    setReady(true);
   }
  }
  void read();
  const sub=client?.auth.onAuthStateChange((event,session)=>{
    // getSession is already running; INITIAL_SESSION would duplicate verification.
    if(event==='INITIAL_SESSION')return;
    queueMicrotask(()=>{if(active)void read(session);});
  });
  return()=>{active=false;sessionReadId.current++;sub?.data.subscription.unsubscribe();};
 },[authCheckRevision]);
 useEffect(()=>{
  let active=true;
  if(!client){setAreasLoaded(true);return;}
  const controller=new AbortController();
  void(async()=>{
   try{
    // Non-sensitive public area catalog shared across every role. Changes on
    // the server are revalidated after two minutes or an explicit reload.
    const list=await requestSharedPublic(
     'service-areas:public:v31',controller.signal,async upstream=>{
      const {data,error:readError}=await client!.from('v31_service_areas')
       .select('id,name_ar,name_en').eq('active',true).order('id')
       .abortSignal(upstream);
      if(readError)throw readError;
      return (data||[]) as {id:number;name_ar:string;name_en:string}[];
     },120_000);
    if(active){setAreas(list);setAreasError('');}
   }catch{
    if(active)setAreasError(t('تعذّر تحميل مناطق الخدمة.','Unable to load service areas.'));
   }finally{
    if(active)setAreasLoaded(true);
   }
  })();
  return()=>{active=false;controller.abort();};
 },[]);
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
  else if(id===29){setBookingsSection('bookings');navigate({tab:'bookings'});}
  else navigate({tab:'home'});
 };
 const backFromRideDetails=()=>{
  const state=history.state as {sekkaNavigation?:boolean;from?:MobileRoute}|null;
  if(state?.sekkaNavigation&&(state.from?.tab==='home'||(state.from?.tab==='search'&&[9,11].includes(state.from.view)))){history.back();return;}
  navigate({tab:'search',view:9},{replace:true});
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
 const approvedDiscovery=(screen:number)=><Discovery production riderId={userId} screen={screen} serviceAreas={areas} liveSelection={matchingSelection} selectionLoading={selectionLoading} onLiveSelect={chooseRoute} theme={p.theme}
     onTheme={p.setThemePreference} go={discoveryGo} onDetailBack={backFromRideDetails}
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
  // Only guests can select Captain enrollment; existing Captains can resume.
  if(userId){if(captain&&accountRole==='captain')navigate({tab:'captain-onboarding',view:35});return;}
  setSelectedRole('captain');
  try{
   sessionStorage.setItem('sekka.pendingRole','captain');
   sessionStorage.setItem('sekka.postAuthPath','/?tab=captain-onboarding&view=35');
  }catch{/* Authentication continues in the current page context when storage is disabled. */}
  navigate({tab:'captain-onboarding',view:35});
 };
 const approvedCaptainOnboarding=(step:number)=><Suspense fallback={<AppSkeleton kind="form" label={t('بنحمّل تسجيل الكابتن…','Loading Captain registration…')}/>} ><CaptainOnboarding production screen={internalScreen(step)} journeyScreen={step}
   theme={p.theme} onTheme={p.setThemePreference} go={captainGo} onJourneyGo={captainOnboardingGo}
   onJourneyBack={()=>navigate({tab:'home'})} profile={null} signedIn={Boolean(userId)}
   rows={[]} busy={false} error="" onRefresh={()=>{}} onEnrolled={()=>setCaptain(true)}/></Suspense>;
 const signOut=async(destination:MobileRoute={tab:'home'})=>{
  if(!client)return;
  const {error:e}=await client.auth.signOut();
  if(e){setError(t('تعذّر تسجيل الخروج. حاول تاني.','Unable to sign out. Please try again.'));return;}
  setUserId(null);setCaptain(false);setCaptainApproved(false);setAccountRole(null);setAdmin(false);
  setSelectedRole('rider');
  try{
   sessionStorage.removeItem('sekka.pendingRole');
   sessionStorage.removeItem('sekka.postAuthPath');
  }catch{/* Sign-out still clears the Supabase session. */}
  navigate(destination,{replace:true});
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
    // Role chosen by the person wins over stale deep links.
    const captainIntent=selectedRole==='captain';
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
   try{
    sessionStorage.setItem('sekka.pendingRole',role);
    sessionStorage.removeItem('sekka.postAuthPath');
   }catch{/* Role selection remains in memory. */}
  }
 };

 const menuLink=(label:string,next:MobileRoute)=><button type="button" onClick={()=>{if(next.tab==='bookings')setBookingsSection('bookings');navigate(next)}}
  aria-current={tab===next.tab?'page':undefined}>{label}</button>;
 const isCaptainAccount=ready&&Boolean(userId)&&accountRole==='captain'&&captainApproved&&!admin;
 const blockedRiderTab=isCaptainAccount&&['home','search','bookings','booking','login','captain-onboarding'].includes(tab);
 const captainLanding=isCaptainAccount&&tab==='routes'&&captainScreen===42;
 const showRiderTabs=ready&&Boolean(userId)&&!isCaptainAccount&&!admin&&
  (tab==='home'||tab==='bookings'||tab==='profile'||tab==='notifications'||
   tab==='booking'||tab==='search');
 const onRiderTab=(destination:RiderTab)=>{
  if(destination==='search'){navigate({tab:'search',view:9});return;}
  if(destination==='requests'){
   setBookingsSection('requests');
   navigate({tab:'bookings'});
   return;
  }
  if(destination==='bookings')setBookingsSection('bookings');
  navigate({tab:destination});
 };
 useEffect(()=>{
  if(!blockedRiderTab)return;
  navigate({tab:'routes',view:42},{replace:true});
 },[blockedRiderTab,tab]);
 const fullScreenSearchFilters=tab==='search'&&discoveryScreen===10;
 const fullScreenAuth=(tab==='login'&&(onboardingScreen===3||onboardingScreen===4))||(tab==='captain-onboarding'&&!userId);
 const fullScreenSearch=tab==='search'&&discoveryScreen===9;
 const showFloatingActions=ready&&!(tab==='home'&&!userId)&&tab!=='login'&&tab!=='captain-onboarding';
 const sliverTitle=tab==='home'?t('سِكَّة','seKKa'):
  tab==='search'?(discoveryScreen===9?t('دور على رحلة','Find a ride'):
   discoveryScreen===10?t('الفلاتر','Filters'):
   discoveryScreen===11?t('نتائج البحث','Search results'):t('تفاصيل الرحلة','Trip details')):
  tab==='bookings'?(bookingsSection==='requests'?t('طلبات مشاويري','My trip requests'):t('حجوزاتي','My bookings')):
  tab==='booking'?t('إكمال الحجز','Booking'):
  tab==='notifications'?t('الإشعارات','Notifications'):
  tab==='profile'?t('حسابي','My profile'):
  tab==='routes'?(captainScreen===42?t('الكابتن','Captain'):
   captainScreen===43?t('إنشاء خط','Create route'):t('إدارة الخطوط','Route management')):
  tab==='admin'?t('لوحة الإدارة','Admin dashboard'):
  tab==='captain-onboarding'?t('انضم ككابتن','Become a Captain'):t('سِكَّة','seKKa');
 const menuButton=<button type="button" ref={menuTrigger} className="sekka-fab-menu"
  aria-label={t('فتح القائمة','Open menu')} aria-expanded={menuOpen}
  aria-controls="sekka-side-menu" onClick={()=>setMenuOpen(true)}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
   strokeLinecap="round" aria-hidden="true" focusable="false">
   <path d="M5 6h14M5 12h14M5 18h14"/>
  </svg>
 </button>;
 return <div className={`sekka-mobile sekka-tab-${tab}${fullScreenSearchFilters?' sekka-search-filters':''}${fullScreenAuth?' sekka-fullscreen-auth':''}${fullScreenSearch?' sekka-fullscreen-search':''}${userId&&tab==='captain-onboarding'?' sekka-captain-logged-in':''}${!userId&&tab==='home'?' sekka-guest-welcome':''}${captainLanding?' sekka-captain-home-shell':''}${showRiderTabs?' sekka-rider-navigation':''}`} dir={en?'ltr':'rtl'}>
  <a className="sekka-skip" href="#sekka-content">{t('تخطي للمحتوى','Skip to content')}</a>
  {showFloatingActions&&<div className="sekka-sliver-pin" aria-hidden="true"><span>{sliverTitle}</span></div>}
  {showFloatingActions&&<nav className="sekka-floating-actions" aria-label={t('اختصارات سِكَّة','seKKa shortcuts')}>
   {menuButton}
   <button type="button" className="sekka-fab-bell" onClick={()=>navigate({tab:'notifications'})}
    aria-label={t('الإشعارات','Notifications')} aria-current={tab==='notifications'?'page':undefined}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
     <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4"/>
    </svg>
   </button>
  </nav>}
  <main id="sekka-content" className={`sekka-mobile-content${tab==='admin'&&admin?' sekka-admin-workspace':''}`}>
   {!ready&&<SessionLoader slow={sessionSlow}
    onRetry={()=>{setSessionSlow(false);setAuthCheckRevision(v=>v+1)}}/>}
   {ready&&tab==='notifications'&&<nav className="sekka-screen-back"
     aria-label={t('التنقل بين الصفحات','Page navigation')}>
    <button type="button" onClick={backToPreviousSection}>
     <span aria-hidden="true">‹</span> {t('رجوع للصفحة السابقة','Back to previous page')}
    </button>
   </nav>}
   {ready&&userId&&adminLookupError&&<div role="alert" className="sekka-mobile-alert">
     <p>{adminLookupError}</p>
     <button type="button" onClick={()=>setAuthCheckRevision(v=>v+1)}>{t('إعادة فحص الصلاحيات','Retry authorization')}</button>
   </div>}
   {error&&<div className="sekka-mobile-alert" role="alert">{error}
     {sessionLookupError&&<button type="button" onClick={()=>{setError('');setAuthCheckRevision(v=>v+1)}}>{t('إعادة التحقق من الجلسة','Retry session')}</button>}
     <button type="button" onClick={()=>{setError('');setSessionLookupError(false)}}>{t('إغلاق','Dismiss')}</button></div>}
   {tab==='home'&&ready&&!blockedRiderTab&&(userId?<RiderJourneyHome riderId={userId} serviceAreas={areas} areasLoaded={areasLoaded} areasFailed={Boolean(areasError)} onNavigate={discoveryGo} onSelect={chooseRoute}/>:<Onboarding production screen={2} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={setSelectedRole}/>)}
   {ready&&tab==='login'&&!blockedRiderTab&&<Onboarding production screen={userId?6:!ready?4:onboardingScreen} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={selectRole}/>}
   {ready&&tab==='profile'&&(userId?<section className="sekka-mobile-card"><LiveProfile/>{ready&&admin&&<button type="button" className="sekka-action" onClick={openAdmin}>
     {t('فتح لوحة الإدارة','Open Admin dashboard')}</button>}
   {captain&&accountRole==='captain'&&(captainApproved
    ?<button type="button" className="sekka-action" onClick={()=>navigate({tab:'routes',view:42})}>{t('الذهاب إلى خطوطي','Open my routes')}</button>
    :<button type="button" onClick={startCaptainJourney}>{t('متابعة طلب الكابتن','Continue Captain application')}</button>)}<button type="button" onClick={()=>void signOut()}>{t('تسجيل الخروج','Sign out')}</button></section>:<section className="sekka-mobile-card"><h1>{t('حسابي','My profile')}</h1><p>{t('سجّل بجوجل علشان تكمل بياناتك.','Sign in with Google to complete your profile.')}</p><button className="sekka-action" onClick={()=>signInFor('/?tab=login&view=6')}>{t('تسجيل الدخول بجوجل','Sign in with Google')}</button></section>)}
   {selectionError&&['search','booking'].includes(tab)&&<div role="alert" className="sekka-mobile-alert">{selectionError}<button type="button" onClick={()=>setSelectionVersion(v=>v+1)}>{t('إعادة المحاولة','Retry')}</button></div>}
   {ready&&tab==='search'&&!blockedRiderTab&&approvedDiscovery(discoveryScreen)}
   {ready&&tab==='booking'&&!blockedRiderTab&&<Suspense fallback={<AppSkeleton kind="page" count={3} label={t('بنحمّل الحجز…','Loading booking…')}/>} ><V31BookingJourney offer={matchingSelection?bookingOffer:null} routeId={matchingSelection?.route.id||''} selectionLoading={selectionLoading||Boolean(!bookingId&&matchingSelection&&!bookingOffer&&!selectionError)}
     pickupId={new URL(location.href).searchParams.get('pickup')||''} dropoffId={new URL(location.href).searchParams.get('dropoff')||''}
     reverse={new URL(location.href).searchParams.get('reverse')==='1'} bookingId={bookingId}
     onBack={()=>{if(bookingId){setBookingsSection('bookings');navigate({tab:'bookings'},{replace:true});}else{const state=history.state as {sekkaNavigation?:boolean;from?:MobileRoute}|null;if(state?.sekkaNavigation&&state.from?.tab==='search'&&state.from.view===12){history.back();}else navigate({tab:'search',view:12},{replace:true});}}}
     onLogin={()=>signInFor(location.pathname+location.search+location.hash)}
     onBooked={bookingSaved}/></Suspense>}

   {ready&&!blockedRiderTab&&tab==='captain-onboarding'&&(userId&&(!captain||accountRole!=='captain')
    ?<section className="sekka-mobile-card"><h1>{t('غير مسموح','Access restricted')}</h1>
      <p>{t('تسجيل الكابتن غير متاح من حساب راكب. سجّل الخروج واختار كابتن عند إنشاء حساب منفصل.',
        'Captain enrollment is not available from a Rider account. Sign out and select Captain with a separate account.')}</p>
      <button type="button" onClick={()=>navigate({tab:'profile'},{replace:true})}>{t('العودة لحسابي','Back to profile')}</button>
      <button type="button" className="sekka-action" onClick={()=>void signOut({tab:'login',view:3})}>
       {t('تسجيل الخروج واختيار حساب كابتن منفصل','Sign out and select a separate Captain account')}</button></section>
    :userId?approvedCaptainOnboarding(captainStep):<Onboarding production screen={4} theme={p.theme} onTheme={p.setThemePreference} go={onboardingGo} role={selectedRole} onRole={selectRole}/>)}
   {ready&&tab==='routes'&&(captain&&accountRole==='captain'&&captainApproved?<Suspense fallback={<AppSkeleton kind="page" count={3} label={t('بنحمّل الخطوط…','Loading routes…')}/>} ><CaptainRoutes production screen={internalScreen(captainScreen)} theme={p.theme} onTheme={p.setThemePreference} go={captainGo}/></Suspense> :<section className="sekka-mobile-card"><h1>{t('خطوط الكابتن','Captain routes')}</h1><p>{userId&&accountRole!=='captain'?t('خطوط الكابتن مخصصة لحسابات الكباتن فقط.','Captain routes are only available to Captain accounts.'):captain?t('حساب الكابتن لم يُعتمد بعد.','Captain access is not approved yet.'):t('اختار حساب كابتن من البداية لتقديم طلب الاعتماد.','Select Captain before sign-in to apply for approval.')}</p>{!userId?<button className="sekka-action" onClick={startCaptainJourney}>{t('ابدأ تسجيل الكابتن','Start Captain enrollment')}</button>:captain&&accountRole==='captain'&&<button className="sekka-action" onClick={()=>navigate({tab:'captain-onboarding',view:40})}>{t('متابعة حالة الطلب','View application status')}</button>}</section>)}
   {ready&&tab==='bookings'&&!blockedRiderTab&&(userId?<section className="sekka-bookings-workspace">
    <nav className="sekka-bookings-section-tabs" aria-label={t('إدارة الحجوزات والطلبات','Bookings and requests')}>
     <button type="button" aria-pressed={bookingsSection==='bookings'} onClick={()=>setBookingsSection('bookings')}>{t('حجوزاتي المؤكدة وقيد الانتظار','My seat bookings')}</button>
     <button type="button" aria-pressed={bookingsSection==='requests'} onClick={()=>setBookingsSection('requests')}>{t('طلبات رحلاتي','My trip requests')}</button>
    </nav>
    {bookingsSection==='bookings'?<RiderBookingsV3 onFindRide={()=>navigate({tab:'search',view:9})} onOpenBooking={id=>navigate({tab:'booking'},{bookingId:id})}/>:<LiveTripRequests mode="rider"/>}
   </section>:<section className="sekka-mobile-card"><h1>{t('حجوزاتي','My bookings')}</h1><p>{t('سجّل دخولك علشان تشوف حجوزاتك الحقيقية.','Sign in to view your bookings.')}</p><button className="sekka-action" onClick={()=>signInFor('/?tab=bookings')}>{t('تسجيل الدخول','Sign in')}</button></section>)}
   {ready&&tab==='notifications'&&(userId?<LiveNotifications
    mode={isCaptainAccount?'captain':'rider'}
    onOpenRides={()=>{if(isCaptainAccount)navigate({tab:'routes',view:44});
     else{setBookingsSection('bookings');navigate({tab:'bookings'});}}}
   />:<section className="sekka-mobile-card"><h1>{t('الإشعارات','Notifications')}</h1><button className="sekka-action" onClick={()=>signInFor('/?tab=notifications')}>{t('تسجيل الدخول','Sign in')}</button></section>)}
   {tab==='admin'&&(!ready?<AppSkeleton kind="stats" count={3} label={t('بنتأكد من صلاحية الإدارة…','Checking Admin authorization…')}/>:admin?<Suspense fallback={<AppSkeleton kind="stats" count={4} label={t('بنحمّل لوحة الإدارة…','Loading Admin dashboard…')}/>} ><AdminDashboard production screen={internalScreen(adminScreen)} theme={p.theme}
      onTheme={p.setThemePreference} go={id=>{const n=publicScreen(id);if(n>=62&&n<=73)navigate({tab:'admin',view:n as 62|63|64|65|66|67|68|69|70|71|72|73});}}/></Suspense>:<section className="sekka-mobile-card"><h1>{t('غير مسموح','Access restricted')}</h1><p>{adminLookupError||t('لوحة الإدارة للحسابات المصرح لها فقط.','The admin dashboard requires authorization.')}</p>
   {adminLookupError&&<button type="button" onClick={()=>setAuthCheckRevision(v=>v+1)}>{t('إعادة فحص الصلاحيات','Retry authorization')}</button>}
   <button onClick={()=>navigate({tab:'home'})}>{t('العودة','Back')}</button></section>)}
  </main>
  {ready&&tab!=='login'&&!(tab==='home'&&!userId)&&<AppTour
   page={{
    tab,
    view:tab==='search'?discoveryScreen:tab==='routes'?captainScreen:
     tab==='captain-onboarding'?captainStep:tab==='admin'?adminScreen:0,
    section:tab==='bookings'?bookingsSection:undefined
   }}
   actor={userId||'guest'}
   role={tab==='admin'&&admin?'admin':
    (accountRole==='captain'||tab==='captain-onboarding')?'captain':'rider'}
   language={p.language}
   active={!menuOpen&&!blockedRiderTab}
   replayToken={tourReplayToken}
   autoStart={tab==='home'&&Boolean(userId)}
  />}
  {showRiderTabs&&<RiderTabBar
   active={tab==='search'?'search':tab==='bookings'?(bookingsSection==='requests'?'requests':'bookings'):tab==='booking'?'bookings':tab==='profile'?'profile':tab==='home'?'home':null}
   onNavigate={onRiderTab}/>}
  {menuOpen&&<div className="sekka-menu-layer">
   <button type="button" className="sekka-menu-backdrop" aria-label={t('إغلاق القائمة','Close menu')} onClick={closeMenu}/>
   <dialog open id="sekka-side-menu" className="sekka-side-drawer" aria-modal="true"
    aria-label={t('القائمة الرئيسية','Main menu')} dir={en?'ltr':'rtl'}>
    <header className="sekka-side-drawer__header"><strong>{t('القائمة','Menu')}</strong>
     <button type="button" className="sekka-side-drawer__close" onClick={closeMenu}
      aria-label={t('إغلاق القائمة','Close menu')}>
       <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18"/>
       </svg>
      </button></header>
    <nav aria-label={t('الأقسام','Sections')}>
     <h2>{t('التنقل','Navigation')}</h2>
     {!isCaptainAccount&&<>
      {menuLink(t('الرئيسية','Home'),{tab:'home'})}
      {menuLink(t('البحث عن خط','Find a route'),{tab:'search',view:9})}
      {menuLink(t('حجوزاتي','My bookings'),{tab:'bookings'})}
      {ready&&userId&&<button type="button" aria-current={tab==='bookings'&&bookingsSection==='requests'?'page':undefined}
        onClick={()=>{navigate({tab:'bookings'});setBookingsSection('requests');}}>{t('طلبات رحلاتي','My trip requests')}</button>}
     </>}
     {menuLink(t('الإشعارات','Notifications'),{tab:'notifications'})}
     {menuLink(t('حسابي','My profile'),{tab:'profile'})}
     {ready&&userId&&captain&&accountRole==='captain'&&<><h2>{t('الكابتن','Captain')}</h2>
      {!captainApproved&&<button type="button" onClick={startCaptainJourney}>{t('متابعة طلب الاعتماد','Review Captain application')}</button>}</>}
     {ready&&captain&&accountRole==='captain'&&captainApproved&&menuLink(t('خطوطي','My routes'),{tab:'routes',view:42})}
     {ready&&admin&&<><h2>{t('الإدارة','Administration')}</h2>
      {menuLink(t('لوحة الإدارة','Admin dashboard'),{tab:'admin',view:62})}</>}
     {ready&&<button type="button" className="sekka-menu-tour" onClick={()=>{
      setMenuOpen(false);setTourReplayToken(value=>value+1);
     }}>{t('اشرحلي الشاشة دي','Guide me through this screen')}</button>}
     <h2>{t('اللغة والمظهر','Language & appearance')}</h2>
     <div className="sekka-preference-controls">
      <label htmlFor="sekka-language-pref">{t('لغة التطبيق','App language')}
       <select id="sekka-language-pref" value={p.languagePreference}
        onChange={event=>p.setLanguagePreference(event.target.value as 'system'|'ar'|'en')}>
        <option value="system">{t('تلقائي حسب لغة الموبايل','Follow phone language')}</option>
        <option value="ar">{t('العربية','Arabic')}</option>
        <option value="en">{t('الإنجليزية','English')}</option>
       </select>
      </label>
      <label htmlFor="sekka-appearance-pref">{t('مظهر التطبيق','App appearance')}
       <select id="sekka-appearance-pref" value={p.themePreference}
        onChange={event=>p.setThemePreference(event.target.value as 'system'|'light'|'dark')}>
        <option value="system">{t('تلقائي حسب الموبايل','Follow phone appearance')}</option>
        <option value="light">{t('فاتح','Light')}</option>
        <option value="dark">{t('غامق','Dark')}</option>
       </select>
      </label>
     </div>
     {ready&&userId&&<><h2>{t('الحساب','Account')}</h2>
      <button type="button" onClick={()=>void signOut()}>{t('تسجيل الخروج','Sign out')}</button></>}
    </nav>
   </dialog>
  </div>}
 </div>;
}
