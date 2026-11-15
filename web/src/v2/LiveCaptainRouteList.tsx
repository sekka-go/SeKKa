import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';

type RouteRow={id:string;title:string;category:string;status:string;price_egp:number;seat_capacity:number};
export default function LiveCaptainRouteList(){
 const {language}=usePreferences(),en=language==='en';
 const t=(a:string,b:string)=>en?b:a;
 const [uid,setUid]=useState<string|null>(null);
 const [approval,setApproval]=useState('pending');
 const [routes,setRoutes]=useState<RouteRow[]>([]);
 const [busy,setBusy]=useState<string|null>(null);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!client)return;
  let active=true;
  void (async()=>{
   const {data:identity,error:authError}=await client.auth.getUser();
   if(!active)return;
   if(authError){setError(authError.message);return;}
   const userId=identity.user?.id||null;setUid(userId);
   if(!userId)return;
   const [{data:captain,error:approvalError},{data:rows,error:listError}]=await Promise.all([
    client.from('v31_captain_profiles').select('approval_status').eq('user_id',userId).maybeSingle(),
    client.from('v31_routes').select('id,title,category,status,price_egp,seat_capacity').eq('captain_id',userId).order('created_at',{ascending:false}).limit(50)
   ]);
   if(!active)return;
   if(approvalError||listError){setError(approvalError?.message||listError?.message||'');return;}
   setApproval(captain?.approval_status||'pending');
   setRoutes((rows||[]) as RouteRow[]);
  })();
  return ()=>{active=false;};
 },[revision]);
 const publish=async(id:string)=>{
  if(!client||approval!=='approved')return;
  setBusy(id);setError('');setNotice('');
  try{
   const {data,error:publishError}=await client.rpc('v31_set_route_status',{p_route:id,p_status:'published'});
   if(publishError)throw publishError;
   if(data!=='published')throw new Error('ROUTE_PUBLICATION_NOT_CONFIRMED');
   const {data:route,error:verifyError}=await client.from('v31_routes')
    .select('id,status').eq('id',id).eq('captain_id',uid).maybeSingle();
   if(verifyError)throw verifyError;
   if(!route||route.id!==id||route.status!=='published')throw new Error('ROUTE_PUBLICATION_NOT_VERIFIED');
   setNotice(t('تم نشر الخط بنجاح.','Route published successfully.'));
   setRevision(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(null);}
 };
 const changeStatus=async(id:string,status:'paused'|'published'|'archived')=>{
  if(!client)return;setBusy(id);setError('');setNotice('');
  try{
   const {data,error:rpcError}=await client.rpc('v31_set_route_status',{p_route:id,p_status:status});
   if(rpcError||data!==status)throw Error(rpcError?.message||'STATUS_UPDATE_NOT_CONFIRMED');
   setNotice(t('تم تحديث حالة الخط.','Route status updated.'));setRevision(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(null);}
 };
 if(!client||!uid)return null;
 return <section className="d-box live-route-list">
  <h2>{t('الخطوط المحفوظة','Saved routes')}</h2>
  <p role="status">{approval==='approved'?t('حساب الكابتن معتمد.','Captain account approved.'):t('نشر الخطوط متوقف لحين اعتماد حساب الكابتن.','Publishing is unavailable until captain approval.')}</p>
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!routes.length&&<p>{t('مفيش مسودات محفوظة لسه.','No saved route drafts yet.')}</p>}
  <ul>{routes.map(route=><li key={route.id}>
   <strong>{route.title}</strong>
   <span>{route.category} · {route.seat_capacity} {t('مقاعد','seats')} · {route.price_egp} {t('جنيه','EGP')}</span>
   <span>{route.status==='published'?t('منشور','Published'):route.status==='paused'?t('متوقف مؤقتًا','Paused'):route.status==='archived'?t('مؤرشف','Archived'):t('مسودة','Draft')}</span>
   {route.status==='published'&&<button type="button" disabled={busy!==null} onClick={()=>void changeStatus(route.id,'paused')}>{t('إيقاف الخط مؤقتًا','Pause route')}</button>}
   {route.status==='paused'&&<button type="button" disabled={busy!==null||approval!=='approved'} onClick={()=>void changeStatus(route.id,'published')}>{t('استئناف الخط','Resume route')}</button>}
   {(route.status==='paused'||route.status==='published')&&<button type="button" disabled={busy!==null} onClick={()=>void changeStatus(route.id,'archived')}>{t('أرشفة الخط','Archive route')}</button>}
   {route.status==='draft'&&<button type="button" disabled={busy!==null||approval!=='approved'} onClick={()=>void publish(route.id)}>
    {busy===route.id?t('جاري النشر…','Publishing…'):t('راجع وانشر','Review and publish')}
   </button>}
  </li>)}</ul>
 </section>;
}
