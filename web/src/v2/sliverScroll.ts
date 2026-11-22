import {useEffect} from 'react';

/** Native-scroll-powered counterpart of Flutter SliverAppBar/FlexibleSpaceBar.
 * This adds presentation only: it never owns scroll position, blocks touch,
 * modifies route records, or changes navigation/auth/booking state.
 *
 * Uses passive event listeners and requestAnimationFrame. WebKit bounce stays
 * native on iOS; Android's clamping stays native. Stretch is decorative only.
 */
const HERO_SELECTORS=[
 '.rh-hero','.rs3__head','.rf3__hero','.rr3-hero','.rd3__hero',
 '.rb3__hero','.rbk3-hero','.cj-home-welcome','.cj-hero',
 '.captain-onboarding-header','.ad-heading','.ad-top',
 '.live-home__hero','.sekka-route-intro','.sekka-entry__header',
 '.phase-screen-2 .phase-hero','.phase-screen-3 .phase-hero',
 '.cj-home','.live-route-list>h2','.live-trip-requests>h2',
 '.live-notifications>h2','.live-profile>h2',
 '.sekka-mobile-card h1','.d-canvas > .d-header',
 '.b-canvas>.b-title','.ad-content>h1'
];
const visible=(el:HTMLElement)=>{
 const box=el.getBoundingClientRect();
 if(box.width<10||box.height<10)return false;
 const css=window.getComputedStyle(el);
 return css.display!=='none'&&css.visibility!=='hidden';
};
const clamp=(n:number,min=0,max=1)=>Math.min(max,Math.max(min,n));

/** pageKey changes for both top-level routes and internal screen/section tabs. */
export function useSekkaSliverScroll(pageKey:string,enabled:boolean){
 useEffect(()=>{
  if(!enabled||typeof window==='undefined')return;
  const shell=document.querySelector<HTMLElement>('.sekka-mobile');
  const content=shell?.querySelector<HTMLElement>('#sekka-content');
  if(!shell||!content)return;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const getHero=()=>HERO_SELECTORS
   .map(selector=>content.querySelector<HTMLElement>(selector))
   .find(node=>node&&visible(node))||null;
  let hero:HTMLElement|null=null;
  let heroTop=0;
  let frame=0;
  let initialScroll=0;
  let startTouchY:number|null=null;
   let observer:MutationObserver|null=null;
  const reset=()=>{
   if(hero)hero.removeAttribute('data-sekka-scroll-hero');
   hero=null;
   const scrollSource=document.scrollingElement?.scrollTop||window.scrollY||0;
   initialScroll=scrollSource;
   shell.style.removeProperty('--sekka-scroll-shift');
   shell.style.removeProperty('--sekka-scroll-scale');
   shell.style.removeProperty('--sekka-scroll-progress');
   shell.style.removeProperty('--sekka-stretch-scale');
   shell.removeAttribute('data-sekka-scrolled');
   shell.removeAttribute('data-sekka-sliver-active');
  };
  const update=()=>{
   frame=0;
   if(!content.isConnected)return;
   const reduced=media.matches;
   if(!hero||!hero.isConnected||!visible(hero)){
    if(hero)hero.removeAttribute('data-sekka-scroll-hero');
    hero=getHero();
    if(hero){
     hero.setAttribute('data-sekka-scroll-hero','true');
     const source=document.scrollingElement?.scrollTop||window.scrollY||0;
     heroTop=hero.getBoundingClientRect().top+source;
     initialScroll=source;
    }
   }
   const source=document.scrollingElement?.scrollTop||window.scrollY||0;
   let distance=Math.max(0,source-initialScroll);
   let heroBottom=Infinity;
   if(hero){
    const bounds=hero.getBoundingClientRect();
    heroBottom=bounds.bottom;
    distance=Math.max(distance,heroTop-bounds.top);
   }
   // All roles use the same 160px collapsing travel. There is no scroll snap.
   const progress=reduced?0:clamp(distance/160);
   const pinned=Boolean(hero&&heroBottom<Math.max(94,0.16*window.innerHeight))
    ||source>190;
   shell.style.setProperty('--sekka-scroll-progress',progress.toFixed(3));
   shell.style.setProperty('--sekka-scroll-shift',(-11*progress).toFixed(1)+'px');
   shell.style.setProperty('--sekka-scroll-scale',(1-.055*progress).toFixed(3));
   shell.dataset.sekkaSliverActive=hero?'true':'false';
   shell.dataset.sekkaScrolled=pinned?'true':'false';
  };
  const schedule=()=>{
   if(!frame)frame=window.requestAnimationFrame(update);
  };
  // Listens to inner scroll areas (Admin tables, forms, Captain steps) too.
  const onScroll=()=>schedule();
  const onTouchStart=(event:TouchEvent)=>{
   if(event.touches.length!==1){startTouchY=null;return;}
   const target=event.target as HTMLElement|null;
   if(target?.closest('input,textarea,select,[contenteditable],.rh-picker,.sekka-side-drawer,.sekka-app-tour')){
    startTouchY=null;return;
   }
   startTouchY=event.touches[0].clientY;
  };
  const onTouchMove=(event:TouchEvent)=>{
   if(startTouchY===null||!hero||media.matches)return;
   const delta=event.touches[0].clientY-startTouchY;
   const source=document.scrollingElement?.scrollTop||window.scrollY||0;
   if(source<3&&delta>0){
    const factor=1+clamp(delta/520)*.055;
    shell.style.setProperty('--sekka-stretch-scale',factor.toFixed(3));
   }else if(shell.style.getPropertyValue('--sekka-stretch-scale')){
    shell.style.removeProperty('--sekka-stretch-scale');
   }
  };
  const onTouchEnd=()=>{
   startTouchY=null;
   shell.style.removeProperty('--sekka-stretch-scale');
  };
  const onMutation=()=>{
   // React swaps real route views asynchronously; find the new hero by identity.
   const next=getHero();
   if(next!==hero){
    if(hero)hero.removeAttribute('data-sekka-scroll-hero');
    hero=null;
    schedule();
   }
  };
  reset();
  observer=new MutationObserver(onMutation);
  observer.observe(content,{childList:true,subtree:true});
  document.addEventListener('scroll',onScroll,{passive:true,capture:true});
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('touchstart',onTouchStart,{passive:true,capture:true});
  document.addEventListener('touchmove',onTouchMove,{passive:true,capture:true});
  document.addEventListener('touchend',onTouchEnd,{passive:true,capture:true});
  document.addEventListener('touchcancel',onTouchEnd,{passive:true,capture:true});
  media.addEventListener?.('change',schedule);
  schedule();
  return()=>{
   if(frame)window.cancelAnimationFrame(frame);
   observer?.disconnect();
   document.removeEventListener('scroll',onScroll,true);
   window.removeEventListener('scroll',onScroll);
   window.removeEventListener('resize',schedule);
   document.removeEventListener('touchstart',onTouchStart,true);
   document.removeEventListener('touchmove',onTouchMove,true);
   document.removeEventListener('touchend',onTouchEnd,true);
   document.removeEventListener('touchcancel',onTouchEnd,true);
   media.removeEventListener?.('change',schedule);
   reset();
  };
 },[pageKey,enabled]);
}
