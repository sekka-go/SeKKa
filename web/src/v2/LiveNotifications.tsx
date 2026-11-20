import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
type Notification={id:string;kind:string;message_ar:string;message_en:string;read_at:string|null;created_at:string};
export default function LiveNotifications(){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [items,setItems]=useState<Notification[]>([]),[busy,setBusy]=useState(''),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;void(async()=>{
   if(!client)return;
   const {data:{user},error:authError}=await client.auth.getUser();
   if(authError||!user){if(active)setError('AUTH_REQUIRED');return;}
   const {data,error:readError}=await client.from('v31_notifications').select('id,kind,message_ar,message_en,read_at,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
   if(!active)return;
   if(readError)setError(readError.message);else setItems((data||[]) as Notification[]);
 })();return()=>{active=false;};},[revision]);
 const mark=async(id:string)=>{if(!client)return;setBusy(id);setError('');
   const {data,error:writeError}=await client.from('v31_notifications').update({read_at:new Date().toISOString()}).eq('id',id).is('read_at',null).select('id').single();
   if(writeError||!data)setError(writeError?.message||'UPDATE_NOT_CONFIRMED');else setRevision(v=>v+1);setBusy('');
 };
 return <section className="d-box live-notifications">
  <h2>{t('إشعاراتي','My notifications')}</h2>
  {error&&<p role="alert">{error} <button type="button" onClick={()=>{setError('');setRevision(v=>v+1);}}>{t('إعادة المحاولة','Retry')}</button></p>}
  {!items.length&&!error&&<p>{t('مفيش إشعارات حاليًا.','No notifications yet.')}</p>}
  <ul>{items.map(n=><li key={n.id}><p>{en?n.message_en:n.message_ar}</p><small>{new Date(n.created_at).toLocaleString(en?'en-GB':'ar-EG')}</small>
   {(n.kind==='route_capacity_full'||n.kind==='route_seat_reopened')&&
    <a className="d-outline" href="/?tab=routes&view=44">
     {n.kind==='route_capacity_full'
      ?t('راجع الرحلة المكتملة في رحلاتي','Review the full trip in My trips')
      :t('راجع المقاعد المتاحة في رحلاتي','Review available seats in My trips')}
    </a>}
   {!n.read_at&&<button type="button" disabled={busy!==''} onClick={()=>void mark(n.id)}>{t('تمت القراءة','Mark as read')}</button>}
  </li>)}</ul>
  <button type="button" onClick={()=>setRevision(v=>v+1)}>{t('تحديث الإشعارات','Refresh notifications')}</button>
 </section>;
}
