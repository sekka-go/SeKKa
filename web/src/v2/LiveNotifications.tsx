import AppSkeleton from './AppSkeleton';
import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
import {useStaggeredReveal} from './staggerMotion';

type Notification={id:string;kind:string;message_ar:string;message_en:string;read_at:string|null;created_at:string};
export default function LiveNotifications({mode='rider',onOpenRides}:{
 mode?:'rider'|'captain';onOpenRides?:()=>void;
}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const revealNotification=useStaggeredReveal();
 const [items,setItems]=useState<Notification[]>([]);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const refresh=()=>{setError('');setLoading(true);setRevision(v=>v+1);};
 useEffect(()=>{
  let active=true;
  setLoading(true);setError('');
  void(async()=>{
   try{
    if(!client)throw Error('BACKEND_NOT_CONFIGURED');
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)throw Error('AUTH_REQUIRED');
    const {data,error:readError}=await client.from('v31_notifications')
     .select('id,kind,message_ar,message_en,read_at,created_at')
     .eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
    if(readError)throw readError;
    if(active)setItems((data||[]) as Notification[]);
   }catch{
    if(active)setError(t('ما قدرناش نحمّل إشعاراتك حاليًا. جرّب تاني.','Unable to load your notifications. Please retry.'));
   }finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[revision]);
 const mark=async(id:string)=>{
  if(!client||busy)return;
  setBusy(id);setError('');
  try{
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||!user)throw Error('AUTH_REQUIRED');
   const {data,error:writeError}=await client.from('v31_notifications')
    .update({read_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id)
    .is('read_at',null).select('id').maybeSingle();
   if(writeError||!data)throw Error('UPDATE_NOT_CONFIRMED');
   refresh();
  }catch{
   setError(t('ما قدرناش نحدّث الإشعار. جرّب تاني.','Could not update the notification. Try again.'));
  }finally{setBusy('');}
 };
 return <section className="d-box live-notifications">
  <h2>{t('إشعاراتي','My notifications')}</h2>
  {loading&&<AppSkeleton kind="notifications" count={4} label={t('بنحمّل إشعاراتك…','Loading notifications…')}/>}
  {error&&<div role="alert"><p>{error}</p><button type="button" onClick={refresh}>
   {t('إعادة المحاولة','Retry')}</button></div>}
  {!loading&&!error&&items.length===0&&<p>{t('مفيش إشعارات حاليًا.','No notifications yet.')}</p>}
  <ul>{items.map(n=><li ref={revealNotification} key={n.id}>
   <p>{en?n.message_en:n.message_ar}</p>
   <small>{new Date(n.created_at).toLocaleString(en?'en-GB':'ar-EG')}</small>
   {(n.kind==='route_capacity_full'||n.kind==='route_seat_reopened')&&onOpenRides&&
    <button type="button" className="d-outline" onClick={onOpenRides}>
     {mode==='captain'?t('افتح خطوطك','Open your routes'):t('افتح رحلاتي','Open My rides')}
    </button>}
   {!n.read_at&&<button type="button" disabled={busy!==''} onClick={()=>void mark(n.id)}>
    {busy===n.id?t('جارٍ التحديث…','Updating…'):t('تمت القراءة','Mark as read')}
   </button>}
  </li>)}</ul>
  {!loading&&<button type="button" onClick={refresh}>{t('تحديث الإشعارات','Refresh notifications')}</button>}
 </section>;
}
