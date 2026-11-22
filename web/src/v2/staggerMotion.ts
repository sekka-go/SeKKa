import {useCallback,useEffect,useRef} from 'react';

/** Reveal only visible cards, with a short stagger per viewport batch.
 * Absolute list-index delays cause multi-second waits in long scrolled lists. */
export function useStaggeredReveal(){
 const pending=useRef(new Set<HTMLElement>());
 const observer=useRef<IntersectionObserver|null>(null);
 const register=useCallback((node:HTMLElement|null)=>{
  if(!node||node.dataset.sekkaStagger)return;
  if(typeof window==='undefined'||!('IntersectionObserver' in window)||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
   node.dataset.sekkaStagger='done';
   return;
  }
  node.dataset.sekkaStagger='pending';
  pending.current.add(node);
  observer.current?.observe(node);
 },[]);
 useEffect(()=>{
  if(typeof IntersectionObserver==='undefined'){
   pending.current.forEach(node=>{node.dataset.sekkaStagger='done';});
   pending.current.clear();
   return;
  }
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   pending.current.forEach(node=>{node.dataset.sekkaStagger='done';});
   pending.current.clear();
   return;
  }
  const io=new IntersectionObserver(entries=>{
   const onscreen=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>
    a.boundingClientRect.top-b.boundingClientRect.top||
    a.boundingClientRect.left-b.boundingClientRect.left);
   onscreen.forEach((entry,index)=>{
    const node=entry.target as HTMLElement;
    if(node.dataset.sekkaStagger!=='pending')return;
    node.style.setProperty('--sekka-stagger-delay',`${Math.min(index,5)*80}ms`);
    node.dataset.sekkaStagger='shown';
    const onEnd=(event:AnimationEvent)=>{
     if(event.target!==node||event.animationName!=='sekka-stagger-in')return;
     node.dataset.sekkaStagger='done';
     node.style.removeProperty('--sekka-stagger-delay');
     node.removeEventListener('animationend',onEnd);
    };
    node.addEventListener('animationend',onEnd);
    io.unobserve(node);
    pending.current.delete(node);
   });
  },{threshold:0.035,rootMargin:'0px 0px 36px 0px'});
  observer.current=io;
  pending.current.forEach(node=>io.observe(node));
  return ()=>{io.disconnect();observer.current=null;};
 },[]);
 return register;
}
