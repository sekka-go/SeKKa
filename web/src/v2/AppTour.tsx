import {useEffect,useRef,useState} from 'react';
import {specsForPage,type GuidedRole,type TourPage,type TourSpec} from './appTourContent';
import './app-tour.css';

type Resolved={step:TourSpec;nodes:HTMLElement[]};
type TourState={storageKey:string;steps:Resolved[];index:number};
type Rect={top:number;left:number;width:number;height:number};
type Props={
 page:TourPage;role:GuidedRole;actor:string;language:'ar'|'en';
 active:boolean;replayToken:number;
};
const VISIT_PREFIX='sekka.tour.v1';
const matchVisible=(node:HTMLElement)=>{
 if(!node.isConnected)return false;
 const r=node.getBoundingClientRect();
 if(r.width<12||r.height<8)return false;
 const style=window.getComputedStyle(node);
 return style.display!=='none'&&style.visibility!=='hidden';
};
function resolveSpecs(steps:TourSpec[]):Resolved[]{
 const root=document.querySelector<HTMLElement>('.sekka-mobile');
 if(!root)return [];
 const used=new Set<HTMLElement>();
 return steps.flatMap(step=>{
  let nodes:HTMLElement[]=[];
  for(const selector of step.selectors){
   const candidates=Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter(node=>matchVisible(node)&&!node.closest('.sekka-app-tour'));
   if(!candidates.length)continue;
   nodes=step.group?candidates.slice(0,5):[candidates[0]];
   break;
  }
  if(!nodes.length||nodes.every(node=>used.has(node)))return [];
  nodes.forEach(node=>used.add(node));
  return [{step,nodes}];
 });
}
function measure(nodes:HTMLElement[]):Rect|null{
 const rectangles=nodes.filter(matchVisible).map(node=>node.getBoundingClientRect());
 if(!rectangles.length)return null;
 const minX=Math.min(...rectangles.map(r=>r.left));
 const maxX=Math.max(...rectangles.map(r=>r.right));
 const minY=Math.min(...rectangles.map(r=>r.top));
 const maxY=Math.max(...rectangles.map(r=>r.bottom));
 const w=window.innerWidth,h=window.innerHeight;
 const top=Math.max(4,Math.min(minY-5,h-18));
 const left=Math.max(4,Math.min(minX-5,w-18));
 return {top,left,width:Math.max(14,Math.min(maxX+5,w-4)-left),
  height:Math.max(14,Math.min(maxY+5,h-4)-top)};
}
const readStorage=(key:string)=>{
 try{return window.localStorage.getItem(key)==='done';}catch{return false;}
};
const writeStorage=(key:string)=>{
 try{window.localStorage.setItem(key,'done');}catch{/* Private mode permits the current tour. */}
};
const readAutoDisabled=(actor:string)=>{
 try{return window.localStorage.getItem('sekka.tour.disable-auto.'+actor)==='1';}
 catch{return false;}
};
export default function AppTour({page,role,actor,language,active,replayToken}:Props){
 const en=language==='en';
 const [tour,setTour]=useState<TourState|null>(null);
 const [rect,setRect]=useState<Rect|null>(null);
 const [tooltip,setTooltip]=useState({top:14,left:12,width:336});
 const panel=useRef<HTMLDivElement>(null);
 const replaySeen=useRef(replayToken);
 const pageKey=[role,page.tab,page.view,page.section||''].join(':');
 const storageKey=VISIT_PREFIX+':'+actor+':'+pageKey;
 const t=(ar:string,english:string)=>en?english:ar;
 useEffect(()=>{
  if(!active){setTour(null);setRect(null);return;}
  const forced=replayToken!==replaySeen.current;
  replaySeen.current=replayToken;
  if(!forced&&(readStorage(storageKey)||readAutoDisabled(actor))){
   setTour(null);setRect(null);return;
  }
  let live=true;
  let task:number|null=null;
  const launch=(attempt:number)=>{
   if(!live)return;
   const found=resolveSpecs(specsForPage(page,role));
   const mainSteps=found.filter(item=>item.step.id!=='menu');
   // Wait for lazy-loaded screen content rather than showing an empty shell.
   if(!mainSteps.length&&attempt<8){
    task=window.setTimeout(()=>launch(attempt+1),210);
    return;
   }
   if(!mainSteps.length){setTour(null);return;}
   setTour({storageKey,steps:found,index:0});
  };
  setTour(null);setRect(null);
  task=window.setTimeout(()=>launch(0),370);
  return()=>{live=false;if(task!==null)window.clearTimeout(task);};
 },[active,pageKey,role,actor,storageKey,replayToken]);
 const current=tour?.steps[tour.index]??null;
 useEffect(()=>{
  if(!tour||!current){setRect(null);return;}
  const node=current.nodes[0];
  // Keep the spotlight centered even after responsive layout or a scroll.
  let frame=0;
  const update=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const bounds=measure(current.nodes);
    if(!bounds){setRect(null);return;}
    setRect(bounds);
    const viewportW=window.innerWidth,viewportH=window.innerHeight;
    const width=Math.min(360,Math.max(240,viewportW-24));
    const safeLeft=Math.min(Math.max(12,bounds.left+(bounds.width-width)/2),
     Math.max(12,viewportW-width-12));
    const cardHeight=226;
    const below=bounds.top+bounds.height+15;
    const above=bounds.top-cardHeight-15;
    const top=below+cardHeight<=viewportH-12?below:
     above>=12?above:Math.max(12,Math.min(viewportH-cardHeight-12,
      viewportH*0.5-cardHeight*0.5));
    setTooltip({top,left:safeLeft,width});
   });
  };
  if(node&&matchVisible(node)){
   const r=node.getBoundingClientRect();
   if(r.top<55||r.bottom>window.innerHeight-65){
    node.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});
   }
  }
  update();
  window.addEventListener('resize',update);
  window.addEventListener('scroll',update,true);
  window.visualViewport?.addEventListener('resize',update);
  return()=>{
   cancelAnimationFrame(frame);
   window.removeEventListener('resize',update);
   window.removeEventListener('scroll',update,true);
   window.visualViewport?.removeEventListener('resize',update);
  };
 },[tour?.storageKey,tour?.index,current]);
 useEffect(()=>{
  if(tour&&panel.current)panel.current.focus({preventScroll:true});
 },[tour?.storageKey,tour?.index]);
 const finish=(disableAll=false)=>{
  if(!tour)return;
  writeStorage(tour.storageKey);
  if(disableAll){
   try{window.localStorage.setItem('sekka.tour.disable-auto.'+actor,'1');}catch{/* Optional */}
  }
  setTour(null);setRect(null);
 };
 const move=(delta:number)=>{
  if(!tour)return;
  const next=tour.index+delta;
  if(next>=tour.steps.length){finish();return;}
  if(next<0)return;
  setTour({...tour,index:next});
 };
 useEffect(()=>{
  if(!tour)return;
  const handle=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();finish();return;}
   if(event.key==='ArrowRight'&&event.altKey){event.preventDefault();move(en?1:-1);return;}
   if(event.key==='ArrowLeft'&&event.altKey){event.preventDefault();move(en?-1:1);return;}
   if(event.key!=='Tab'||!panel.current)return;
   const focusable=Array.from(panel.current.querySelectorAll<HTMLElement>(
    'button:not([disabled]),[href],select,input,[tabindex="0"]'))
    .filter(matchVisible);
   if(focusable.length<2)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){
    event.preventDefault();last.focus();
   }else if(!event.shiftKey&&document.activeElement===last){
    event.preventDefault();first.focus();
   }
  };
  document.addEventListener('keydown',handle,true);
  return()=>document.removeEventListener('keydown',handle,true);
 },[tour,en]);
 // Only completed step data is persisted. Screens remain fully functional if
 // localStorage is blocked or browser tour APIs aren't supported.
 if(!tour||!current||!rect)return null;
 const isLast=tour.index===tour.steps.length-1;
 const title=en?current.step.enTitle:current.step.arTitle;
 const body=en?current.step.enBody:current.step.arBody;
 return <div className="sekka-app-tour" dir={en?'ltr':'rtl'}>
  <div className="sekka-app-tour__spotlight" aria-hidden="true"
   style={{top:rect.top,left:rect.left,width:rect.width,height:rect.height}}/>
  <div className="sekka-app-tour__card" role="dialog" aria-modal="true"
   aria-labelledby="sekka-tour-heading" aria-describedby="sekka-tour-description"
   ref={panel} tabIndex={-1}
   style={{top:tooltip.top,left:tooltip.left,width:tooltip.width}}>
   <div className="sekka-app-tour__topline">
    <span className="sekka-app-tour__name">{t('دليلك في سِكَّة','Your seKKa guide')}</span>
    <span className="sekka-app-tour__counter" aria-label={t('الخطوة','Step')+' '+(tour.index+1)+' / '+tour.steps.length}>
     {tour.index+1} / {tour.steps.length}
    </span>
   </div>
   <h2 id="sekka-tour-heading">{title}</h2>
   <p id="sekka-tour-description">{body}</p>
   <div className="sekka-app-tour__dots" aria-hidden="true">
    {tour.steps.map((step,index)=><span key={step.step.id+index} className={index===tour.index?'is-current':''}/>)}
   </div>
   <div className="sekka-app-tour__actions">
    <button type="button" className="sekka-app-tour__skip" onClick={()=>finish()}>
     {t('تخطي','Skip')}
    </button>
    {tour.index>0&&<button type="button" className="sekka-app-tour__previous" onClick={()=>move(-1)}>
     {t('السابق','Previous')}
    </button>}
    <button type="button" className="sekka-app-tour__next" onClick={()=>move(1)}>
     {isLast?t('تمام','Done'):t('التالي','Next')}
     <span aria-hidden="true">{en?'→':'←'}</span>
    </button>
   </div>
   <button type="button" className="sekka-app-tour__optout"
    onClick={()=>finish(true)}>
    {t('إيقاف الشرح التلقائي','Turn off automatic tips')}
   </button>
  </div>
 </div>;
}
