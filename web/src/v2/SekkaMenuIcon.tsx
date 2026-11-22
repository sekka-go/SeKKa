/** The reference video's icon language: consistent 24px outline strokes
 * contained in rounded color-tinted tiles. Purely presentational: menu
 * actions remain the same authenticated, routed actions as before. */
export type MenuGlyph='home'|'search'|'bookings'|'requests'|'notifications'|'profile'|
 'captain'|'admin'|'guide'|'language'|'appearance'|'signout';
export function menuGlyphForTab(tab:string):MenuGlyph{
 switch(tab){
  case 'search':return 'search';
  case 'bookings':return 'bookings';
  case 'notifications':return 'notifications';
  case 'profile':return 'profile';
  case 'routes':case 'captain-onboarding':return 'captain';
  case 'admin':return 'admin';
  default:return 'home';
 }
}
export default function SekkaMenuIcon({name}:{name:MenuGlyph}){
 return <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
  stroke="currentColor" strokeWidth="1.85" strokeLinecap="round"
  strokeLinejoin="round" focusable="false" aria-hidden="true">
  {name==='home'&&<><path d="m3.4 10 8.6-7 8.6 7V20a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1Z"/><path d="M9 21v-8h6v8"/></>}
  {name==='search'&&<><circle cx="10.6" cy="10.6" r="6.9"/><path d="m16.2 16.2 4.6 4.6"/></>}
  {name==='bookings'&&<><rect x="3.4" y="5" width="17.2" height="16" rx="2.5"/><path d="M7.7 3v4M16.3 3v4M3.4 10h17.2M7.5 14h3.2m3.2 0h2.4"/></>}
  {name==='requests'&&<><rect x="5" y="3.5" width="14" height="17.5" rx="2.5"/><path d="M9 8.5h6M9 12.5h6M9 16.5h3"/><path d="m14 16.2 1.2 1.2 2.3-2.5"/></>}
  {name==='notifications'&&<><path d="M18 8.5a6 6 0 0 0-12 0c0 6.7-2.7 7.5-2.7 9h17.4c0-1.5-2.7-2.3-2.7-9Z"/><path d="M10 21h4"/></>}
  {name==='profile'&&<><circle cx="12" cy="8.2" r="4"/><path d="M4.2 20v-1a7.8 7.8 0 0 1 15.6 0v1"/></>}
  {name==='captain'&&<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><path d="m3.7 8.5 6.4 3.3m10.2-3.3-6.4 3.3M12 14.3V21"/></>}
  {name==='admin'&&<><path d="M12 2.7 20 6v6c0 5.2-3.7 8-8 9.3-4.3-1.3-8-4.1-8-9.3V6Z"/><path d="m8.7 12.2 2.1 2.1 4.8-4.8"/></>}
  {name==='guide'&&<><path d="M12 2.8 14.1 9.9 21.2 12l-7.1 2.1L12 21.2l-2.1-7.1L2.8 12l7.1-2.1Z"/><path d="m19 3 .6 1.9L21.5 5.5l-1.9.6L19 8"/></>}
  {name==='language'&&<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>}
  {name==='appearance'&&<><path d="M20.5 14.6A8.8 8.8 0 0 1 9.4 3.5a8.8 8.8 0 1 0 11.1 11.1Z"/><path d="m17 3 .7 1.8 1.8.7-1.8.7L17 8l-.7-1.8-1.8-.7 1.8-.7Z"/></>}
  {name==='signout'&&<><path d="M10.2 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4.2"/><path d="M13 8.5 17 12l-4 3.5M8 12h9"/></>}
 </svg>;
}
