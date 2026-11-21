import {usePreferences} from './preferences';
import './rider-tabbar.css';

export type RiderTab='home'|'search'|'bookings'|'profile';

function TabIcon({name}:{name:RiderTab}){
 return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"
  width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.85"
  strokeLinecap="round" strokeLinejoin="round">
  {name==='home'&&<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-7h6v7"/></>}
  {name==='search'&&<><circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 5 5"/><path d="M8 11h6" strokeWidth="1.6"/></>}
  {name==='bookings'&&<><path d="M4 5h16v5a2.4 2.4 0 0 0 0 4v5H4v-5a2.4 2.4 0 0 0 0-4Z"/><path d="M12 5v14" strokeDasharray="2 3"/></>}
  {name==='profile'&&<><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></>}
 </svg>;
}
const tabs:RiderTab[]=['home','search','bookings','profile'];
export default function RiderTabBar({active,onNavigate}:{active:RiderTab;onNavigate:(tab:RiderTab)=>void}){
 const {language}=usePreferences(),en=language==='en';
 const names=en?
  {home:'Home',search:'Search',bookings:'Bookings',profile:'Account'}:
  {home:'الرئيسية',search:'ابحث',bookings:'رحلاتي',profile:'حسابي'};
 return <nav className="rh-tabs" aria-label={en?'Passenger navigation':'التنقل للراكب'}>
  <div className="rh-tabs__inner">
   {tabs.map(tab=><button type="button" key={tab}
     aria-current={active===tab?'page':undefined}
     onClick={()=>onNavigate(tab)}>
     <span className="rh-tabs__icon"><TabIcon name={tab}/></span>
     <span className="rh-tabs__name">{names[tab]}</span>
    </button>)}
  </div>
 </nav>;
}
