import {useEffect,useState} from 'react';
import {client} from './api';
import {enrollCaptain} from './captainEnrollment';
import {usePreferences} from './preferences';
import type {Category} from '../../../packages/domain/subscriptions';

type Area={id:number;name_ar:string;name_en:string};
type StopInput={areaId:number;name:string;pickup:boolean;dropoff:boolean};
const seats:Record<Category,number>={PRIME:3,SAVER:4,SPACE:9,MAX:13};

/** Authenticated draft creation only. Publishing requires a separate audited server operation. */
export default function LiveCaptainDraft(){
 const {language}=usePreferences(),en=language==='en';
 const t=(ar:string,english:string)=>en?english:ar;
 const [uid,setUid]=useState<string|null>(null);
 const [areas,setAreas]=useState<Area[]>([]);
 const [title,setTitle]=useState('');
 const [areaId,setAreaId]=useState('');
 const [stopName,setStopName]=useState('');
 const [stops,setStops]=useState<StopInput[]>([]);
 const [category,setCategory]=useState<Category>('PRIME');
 const [capacity,setCapacity]=useState(3);
 const [period,setPeriod]=useState('monthly');
 const [direction,setDirection]=useState('outbound');
 const [departure,setDeparture]=useState('07:30');
 const [arrival,setArrival]=useState('17:00');
 const [returnSupported,setReturnSupported]=useState(false);
 const [price,setPrice]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
   if(!client)return;
   let live=true;
   void client.auth.getUser().then(({data})=>{if(live)setUid(data.user?.id??null);});
   void client.from('v31_service_areas').select('id,name_ar,name_en').order('id').then(({data,error})=>{
     if(!live)return;
     if(error)setError(error.message);
     else {setAreas((data||[]) as Area[]);setAreaId(String(data?.[0]?.id||''));}
   });
   const {data:listener}=client.auth.onAuthStateChange((_event,session)=>setUid(session?.user.id??null));
   return ()=>{live=false;listener.subscription.unsubscribe();};
 },[]);
 const addStop=()=>{
   if(!areaId||stopName.trim().length<2)return;
   const next={areaId:Number(areaId),name:stopName.trim(),pickup:true,dropoff:true};
   if(stops.some(s=>s.areaId===next.areaId&&s.name.toLocaleLowerCase()===next.name.toLocaleLowerCase())){
     setError(t('النقطة موجودة بالفعل في نفس المنطقة.','That stop already exists in this area.'));return;
   }
   setError('');setStops(v=>[...v,next]);setStopName('');
 };
 const save=async()=>{
   if(!client||!uid)return;
   setMessage('');setError('');
   if(title.trim().length<3||stops.length<2||stops[0].areaId===stops.at(-1)?.areaId||
      !Number.isInteger(capacity)||capacity<1||capacity>seats[category]||
      !Number.isInteger(Number(price))||Number(price)<=0||
      (direction==='round_trip'&&!returnSupported)){
     setError(t('راجع العنوان والسعر والمقاعد؛ يلزم نقطتان في منطقتين مختلفتين.','Check title, price, capacity and at least two stops in distinct areas.'));return;
   }
   setBusy(true);
   try{
     await enrollCaptain();
     const {data:routeId,error:routeError}=await client.rpc('v31_create_route_draft',{
       p_title:title.trim(),p_category:category,p_capacity:capacity,
       p_direction:direction,p_period:period,
       p_outbound:direction==='return'?null:departure,
       p_return:direction==='outbound'?null:arrival,
       p_return_supported:direction==='round_trip'?returnSupported:false,
       p_price:Number(price),p_stops:stops.map(s=>({
         area_id:s.areaId,name:s.name,pickup:s.pickup,dropoff:s.dropoff
       }))
     });
     if(routeError)throw routeError;
     if(typeof routeId!=='string')throw Error('DRAFT_NOT_CONFIRMED');
     const [{data:saved,error:savedError},{data:savedStops,error:stopsError}]=await Promise.all([
       client.from('v31_routes').select('id,status,seat_capacity,price_egp').eq('id',routeId).eq('captain_id',uid).maybeSingle(),
       client.from('v31_route_stops').select('id,area_id,name,position').eq('route_id',routeId).order('position')
     ]);
     if(savedError||stopsError)throw Error(savedError?.message||stopsError?.message||'DRAFT_READ_FAILED');
     if(!saved||saved.status!=='draft'||saved.seat_capacity!==capacity||saved.price_egp!==Number(price)||
        savedStops?.length!==stops.length||savedStops.some((s,i)=>s.area_id!==stops[i].areaId||s.position!==i||s.name!==stops[i].name)){
       throw Error('DRAFT_PERSISTENCE_NOT_VERIFIED');
     }
     setMessage(t('اتحفظت مسودة الخط الحقيقية بنجاح. النشر متوقف لحين اعتماد الكابتن وتفعيل التحقق من المسار.','Your real route draft was saved. Publishing is disabled pending captain approval and server route validation.'));
     setStops([]);setTitle('');setPrice('');
   }catch(e){setError(e instanceof Error?e.message:String(e));}
   finally{setBusy(false);}
 };
 if(!client)return <section className="d-box"><p>{t('ربط Supabase العام لم يكتمل بعد.','Public Supabase configuration is not ready yet.')}</p></section>;
 if(!uid)return <section className="d-box"><p>{t('سجّل دخولك بجوجل قبل حفظ خط حقيقي.','Sign in with Google to create a real route draft.')}</p><a href="?screen=4">{t('الدخول بجوجل','Google sign-in')}</a></section>;
 return <section className="d-box live-route-form">
  <h2>{t('إنشاء مسودة خط حقيقية','Create a real route draft')}</h2>
  <p>{t('المسودة لا تظهر للركاب، ولن تُنشر قبل اعتماد الكابتن.','Drafts are private and cannot be published before captain approval.')}</p>
  <label>{t('اسم الخط','Route title')}<input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)}/></label>
  <label>{t('المنطقة','Area')}<select value={areaId} onChange={e=>setAreaId(e.target.value)}>{areas.map(a=><option key={a.id} value={a.id}>{en?a.name_en:a.name_ar}</option>)}</select></label>
  <label>{t('اسم نقطة الوقوف','Stop name')}<input value={stopName} maxLength={100} onChange={e=>setStopName(e.target.value)}/></label>
  <button type="button" disabled={!areaId||stopName.trim().length<2} onClick={addStop}>{t('أضف نقطة','Add stop')}</button>
  <ol className="live-route-stops">{stops.map((s,i)=><li key={i}>
    <strong>{i+1}. {s.name} — {en?areas.find(a=>a.id===s.areaId)?.name_en:areas.find(a=>a.id===s.areaId)?.name_ar}</strong>
    <div className="live-route-controls">
      <button type="button" disabled={i===0} onClick={()=>setStops(v=>{const n=[...v];[n[i-1],n[i]]=[n[i],n[i-1]];return n;})}>{t('لأعلى','Up')}</button>
      <button type="button" disabled={i===stops.length-1} onClick={()=>setStops(v=>{const n=[...v];[n[i+1],n[i]]=[n[i],n[i+1]];return n;})}>{t('لأسفل','Down')}</button>
      <button type="button" onClick={()=>setStops(v=>v.filter((_,j)=>j!==i))}>{t('حذف','Remove')}</button>
    </div>
  </li>)}</ol>
  <label>{t('الفئة','Category')}<select value={category} onChange={e=>{const c=e.target.value as Category;setCategory(c);setCapacity(Math.min(capacity,seats[c]));}}>{Object.keys(seats).map(c=><option key={c}>{c}</option>)}</select></label>
  <label>{t('عدد المقاعد','Seats')}<input type="number" min={1} max={seats[category]} value={capacity} onChange={e=>setCapacity(Number(e.target.value))}/></label>
  <label>{t('مدة الاشتراك','Period')}<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="weekly">{t('أسبوعي','Weekly')}</option><option value="monthly">{t('شهري','Monthly')}</option></select></label>
  <label>{t('الاتجاه','Direction')}<select value={direction} onChange={e=>setDirection(e.target.value)}><option value="outbound">{t('ذهاب','Outbound')}</option><option value="return">{t('عودة','Return')}</option><option value="round_trip">{t('ذهاب وعودة','Round trip')}</option></select></label>
  {direction!=='return'&&<label>{t('وقت الذهاب','Outbound departure')}<input type="time" value={departure} onChange={e=>setDeparture(e.target.value)}/></label>}
  {direction!=='outbound'&&<label>{t('وقت العودة','Return departure')}<input type="time" value={arrival} onChange={e=>setArrival(e.target.value)}/></label>}
  {direction==='round_trip'&&<label className="live-route-check"><input type="checkbox" checked={returnSupported} onChange={e=>setReturnSupported(e.target.checked)}/>{t('العودة بنفس النقاط بالترتيب العكسي','Return visits the same stops in reverse order')}</label>}
  <label>{t('سعر الاشتراك بالجنيه','Subscription price (EGP)')}<input type="number" min={1} step={1} value={price} onChange={e=>setPrice(e.target.value)}/></label>
  {error&&<p role="alert">{error}</p>}
  {message&&<p role="status">{message}</p>}
  <button type="button" className="d-primary" disabled={busy} onClick={()=>void save()}>{busy?t('جارٍ الحفظ...','Saving…'):t('حفظ مسودة حقيقية','Save real draft')}</button>
 </section>;
}
