import {useEffect,useRef} from 'react';
import {approvedSplashSceneUri} from './approvedSplashScene';

/** Keeps the approved SUV raster untouched. Extract its *actual* rim texture
 * into two feathered circular sprites, unskews each rim to a circle, rotates
 * the sprite, then projects it back to the original wheel perspective.
 * That means the spokes match the real art instead of drawing fake wheels. */
const SCENE={width:700,height:697};
const RIMS=[
 {cx:394,cy:447,rx:12.5,ry:36.5},
 {cx:530,cy:407,rx:9.5,ry:29}
] as const;
const REVOLUTION_MS=1600;

type WheelSprite={image:HTMLCanvasElement;cx:number;cy:number;rx:number;ry:number};
function makeSprite(scene:HTMLImageElement,wheel:typeof RIMS[number]):WheelSprite{
 const {cx,cy,rx,ry}=wheel;
 const size=Math.ceil(ry*2);
 const image=document.createElement('canvas');
 image.width=size;image.height=size;
 const ctx=image.getContext('2d');
 if(ctx){
  const radius=size/2;
  // Wheel appears elliptical because the car is seen in perspective.
  // Undo that horizontal compression *before* rotating the spokes.
  ctx.save();
  ctx.beginPath();ctx.arc(radius,radius,radius,0,Math.PI*2);ctx.clip();
  ctx.translate(radius,radius);
  ctx.scale(ry/rx,1);
  ctx.drawImage(scene,-cx,-cy,SCENE.width,SCENE.height);
  ctx.restore();
  // The subtle feather preserves the photographed rubber and hub outer ring.
  ctx.globalCompositeOperation='destination-in';
  const edge=ctx.createRadialGradient(radius,radius,radius*.70,
   radius,radius,radius);
  edge.addColorStop(0,'rgba(0,0,0,1)');
  edge.addColorStop(.72,'rgba(0,0,0,1)');
  edge.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=edge;
  ctx.fillRect(0,0,size,size);
  ctx.globalCompositeOperation='source-over';
 }
 return {image,cx,cy,rx,ry};
}
export default function LaunchWheelMotion(){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=canvasRef.current;
  if(!canvas)return;
  const context=canvas.getContext('2d',{alpha:true});
  if(!context)return;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(media.matches)return;
  let alive=true;
  let raf=0;
  let startTime:number|null=null;
  let sprites:WheelSprite[]=[];
  let width=0,height=0,ratio=1;
  const source=new Image();
  const resize=()=>{
   const size=canvas.getBoundingClientRect();
   width=size.width;height=size.height;
   ratio=Math.min(window.devicePixelRatio||1,2);
   canvas.width=Math.round(width*ratio);
   canvas.height=Math.round(height*ratio);
   if(startTime!==null)render(performance.now());
  };
  const render=(timestamp:number)=>{
   if(!alive||media.matches)return;
   if(startTime===null)startTime=timestamp;
   context.setTransform(ratio,0,0,ratio,0,0);
   context.clearRect(0,0,width,height);
   // CSS object-fit:cover / object-position:center bottom on the background
   // image is exactly the same projection used by the transparent canvas.
   const scale=Math.max(width/SCENE.width,height/SCENE.height);
   const originX=(width-SCENE.width*scale)/2;
   const originY=height-SCENE.height*scale;
   const angle=(timestamp-startTime)*Math.PI*2/REVOLUTION_MS;
   for(const {image,cx,cy,rx,ry} of sprites){
    context.save();
    context.translate(originX+cx*scale,originY+cy*scale);
    context.scale(scale*rx/ry,scale);
    context.rotate(angle);
    context.drawImage(image,-ry,-ry,2*ry,2*ry);
    context.restore();
   }
   raf=window.requestAnimationFrame(render);
  };
  const onImage=()=>{
   if(!alive||!source.naturalWidth)return;
   sprites=RIMS.map(wheel=>makeSprite(source,wheel));
   resize();
   raf=window.requestAnimationFrame(render);
  };
  const observer=new ResizeObserver(resize);
  observer.observe(canvas);
  source.addEventListener('load',onImage);
  source.src=approvedSplashSceneUri;
  if(source.complete&&source.naturalWidth)onImage();
  return()=>{
   alive=false;
   window.cancelAnimationFrame(raf);
   observer.disconnect();
   source.removeEventListener('load',onImage);
  };
 },[]);
 return <canvas ref={canvasRef} className="sekka-launch__wheel-motion"
  aria-hidden="true" role="presentation"/>;
}
