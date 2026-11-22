import {usePreferences} from './preferences';
import SekkaMenuIcon from './SekkaMenuIcon';
import './rider-tabbar.css';

export type RiderTab='home'|'search'|'bookings'|'requests'|'profile';

const tabs:RiderTab[]=['home','bookings','search','requests','profile'];
export default function RiderTabBar({active,onNavigate}:{active:RiderTab|null;onNavigate:(tab:RiderTab)=>void}){
 const {language}=usePreferences(),en=language==='en';
 const names=en?
  {home:'Home',search:'Search',bookings:'Bookings',requests:'Requests',profile:'Account'}:
  {home:'الرئيسية',search:'بحث',bookings:'حجوزاتي',requests:'طلباتي',profile:'حسابي'};
 return <nav className="rh-tabs" aria-label={en?'Passenger navigation':'التنقل للراكب'}>
  <div className="rh-tabs__inner">
    <span className="rh-tabs__glass" aria-hidden="true"/>
   {tabs.map(tab=><button type="button" key={tab} className={tab==='search'?'rh-tabs__primary':undefined}
      aria-label={tab==='search'?(en?'Find a ride':'دور على مشوار'):undefined}
     aria-current={active===tab?'page':undefined}
     onClick={()=>onNavigate(tab)}>
     <span className="rh-tabs__icon"><SekkaMenuIcon name={tab}/></span>
     <span className="rh-tabs__name">{names[tab]}</span>
    </button>)}
  </div>
 </nav>;
}
