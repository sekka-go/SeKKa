import './app-skeleton.css';

/** Shimmer placeholders follow the geometry of actual content; no fake data,
 * guessed prices, loading timeout, external images or payment state.
 * Render ONLY when the corresponding real backend/data fetch is pending.
 */
export type SkeletonKind='routes'|'bookings'|'requests'|'notifications'|
 'profile'|'vehicles'|'stats'|'session'|'page'|'form'|'stops'|'map';
type Props={kind:SkeletonKind;label:string;count?:number;compact?:boolean};
const lines=(type:'long'|'medium'|'short'|'tiny'='medium')=>
 <span className={'sk-shimmer__line sk-shimmer__line--'+type}/>;
function SkeletonCard({kind}:{kind:SkeletonKind}){
 if(kind==='stats')return <div className="sk-shimmer__stat">
  {lines('medium')}{lines('short')}<span className="sk-shimmer__metric"/>
 </div>;
 if(kind==='notifications')return <div className="sk-shimmer__notice">
  <span className="sk-shimmer__bubble"/>
  <div className="sk-shimmer__notice-copy">{lines('long')}{lines('medium')}{lines('tiny')}</div>
 </div>;
 if(kind==='profile'||kind==='form')return <div className="sk-shimmer__form">
  <div className="sk-shimmer__form-row">{lines('short')}<span className="sk-shimmer__input"/></div>
  <div className="sk-shimmer__form-row">{lines('short')}<span className="sk-shimmer__input"/></div>
  <span className="sk-shimmer__button"/>
 </div>;
 if(kind==='session')return <div className="sk-shimmer__session-card">
  <span className="sk-shimmer__session-logo"/>{lines('medium')}{lines('short')}
  <div className="sk-shimmer__session-row"><span/><span/></div>
 </div>;
 if(kind==='map')return <div className="sk-shimmer__map">
  <span className="sk-shimmer__map-pin"/>{lines('medium')}
 </div>;
 if(kind==='stops')return <div className="sk-shimmer__stops">
  <span className="sk-shimmer__point"/><div>{lines('long')}{lines('medium')}</div>
  <span className="sk-shimmer__point"/><div>{lines('medium')}{lines('short')}</div>
 </div>;
 return <div className="sk-shimmer__card">
  <div className="sk-shimmer__card-main">
   <span className="sk-shimmer__thumb"/>
   <div className="sk-shimmer__copy">
    {lines('long')}{lines('medium')}{lines('short')}
   </div>
  </div>
  {kind==='bookings'||kind==='requests'||kind==='routes'?<div className="sk-shimmer__card-footer">
   {lines('short')}{lines('tiny')}
  </div>:null}
 </div>;
}
export default function AppSkeleton({kind,label,count=3,compact=false}:Props){
 const n=Math.max(1,Math.min(5,Math.floor(count)));
 const isGrid=kind==='stats';
 const effectiveCount=['form','profile','session','map','stops'].includes(kind)?1:n;
 return <div className={'sk-shimmer sk-shimmer--'+kind+(compact?' sk-shimmer--compact':'')}
  role="status" aria-live="polite" aria-busy="true" aria-label={label}>
  <span className="sk-shimmer__accessible">{label}</span>
  {kind==='page'&&<div className="sk-shimmer__page-head" aria-hidden="true">
   {lines('medium')}{lines('short')}
  </div>}
  <div className={isGrid?'sk-shimmer__grid':'sk-shimmer__items'} aria-hidden="true">
   {Array.from({length:effectiveCount},(_,index)=><SkeletonCard kind={kind} key={index}/>)}
  </div>
 </div>;
}
