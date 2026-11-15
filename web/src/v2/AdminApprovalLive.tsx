import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';

type Application={user_id:string;status:string;professional_notes:string;experience_years:number|null;
 intended_vehicle_model:string|null;intended_category:string|null;intended_seats:number|null;
 intended_plate:string|null;rejection_reason:string|null;submitted_at:string|null};
type DocumentRow={id:string;kind:string;object_name:string;created_at:string};
type AuditRow={id:string;decision:string;reason:string|null;created_at:string};
const bucket='v31-captain-docs-staging';
export default function AdminApprovalLive({screen,onGo}: {screen:number;onGo:(screen:number)=>void}){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [authorized,setAuthorized]=useState<boolean|null>(null),[apps,setApps]=useState<Application[]>([]);
 const [selected,setSelected]=useState<string|null>(null),[docs,setDocs]=useState<DocumentRow[]>([]),
 [audit,setAudit]=useState<AuditRow[]>([]),[reason,setReason]=useState(''),[reviewed,setReviewed]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[rev,setRev]=useState(0);
 const active=apps.find(a=>a.user_id===selected)||null;
 useEffect(()=>{let live=true;setLoading(true);setError('');
  void(async()=>{try{
   if(!client)throw Error('BACKEND_NOT_CONFIGURED');
   const {data:admin,error:roleError}=await client.rpc('v31_is_admin');
   if(roleError)throw roleError;if(admin!==true){if(live){setAuthorized(false);setApps([]);}return;}
   const {data,error:e}=await client.from('v31_captain_applications')
     .select('user_id,status,professional_notes,experience_years,intended_vehicle_model,intended_category,intended_seats,intended_plate,rejection_reason,submitted_at')
     .order('updated_at',{ascending:false}).limit(100);
   if(e)throw e;if(live){setAuthorized(true);setApps((data||[]) as Application[]);}
  }catch(e){if(live)setError(e instanceof Error?e.message:String(e));}
  finally{if(live)setLoading(false);}
  })();return()=>{live=false;};
 },[rev]);
 useEffect(()=>{let live=true;setDocs([]);setAudit([]);
  if(!selected||!authorized||!client)return;
  void(async()=>{try{
   const [d,a]=await Promise.all([
    client!.from('v31_captain_documents').select('id,kind,object_name,created_at').eq('captain_id',selected).order('created_at',{ascending:false}),
    client!.from('v31_captain_approval_audit').select('id,decision,reason,created_at').eq('captain_id',selected).order('created_at',{ascending:false})
   ]);
   if(d.error||a.error)throw Error(d.error?.message||a.error?.message||'REVIEW_LOAD_FAILED');
   if(live){setDocs((d.data||[]) as DocumentRow[]);setAudit((a.data||[]) as AuditRow[]);}
  }catch(e){if(live)setError(e instanceof Error?e.message:String(e));}
  })();return()=>{live=false;};
 },[selected,authorized,rev]);
 const download=async(doc:DocumentRow)=>{
  if(!client)return;
  setBusy(true);setError('');
  try{
   // Authenticated download from private bucket: no public or persistent signed URL.
   const {data,error:e}=await client.storage.from(bucket).download(doc.object_name);
   if(e||!data)throw Error(e?.message||'DOCUMENT_DOWNLOAD_FAILED');
   const url=URL.createObjectURL(data),a=document.createElement('a');
   a.href=url;a.download=doc.kind+'-'+doc.id.slice(0,8);a.click();
   setTimeout(()=>URL.revokeObjectURL(url),20000);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const decide=(decision:'approved'|'rejected')=>{if(!selected||!reviewed)return;
  if(decision==='rejected'&&reason.trim().length<5){setError(t('اكتب سبب رفض واضح من 5 أحرف على الأقل.','Provide a clear rejection reason (at least 5 characters).'));return;}
  setBusy(true);setError('');setNotice('');
  void(async()=>{try{
    if(!client)throw Error('BACKEND_NOT_CONFIGURED');
    const {data,error:e}=await client.rpc('v31_admin_decide_captain',{
      p_captain:selected,p_decision:decision,p_reason:decision==='rejected'?reason.trim():null});
    if(e)throw e;if(data!==decision)throw Error('ADMIN_DECISION_NOT_VERIFIED');
    const {data:record,error:verify}=await client.from('v31_captain_applications').select('status').eq('user_id',selected).single();
    if(verify||record?.status!==decision)throw Error('ADMIN_DECISION_NOT_PERSISTED');
    setNotice(t('اتسجل القرار في قاعدة البيانات وسجل التدقيق.','Decision persisted with an audit record.'));
    setReviewed(false);setReason('');setRev(v=>v+1);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}})();
 };
 return <section className="ad-content" aria-label={t('إدارة طلبات الكباتن','Captain application review')}>
  <h2>{screen===64?t('طلبات اعتماد الكباتن','Captain applications'):t('مراجعة مستندات الكباتن','Captain documents')}</h2>
  {loading&&<p role="status">{t('جارٍ تحميل الطلبات…','Loading applications…')}</p>}
  {authorized===false&&<p role="alert">{t('الصلاحية الإدارية غير متاحة.','Admin access denied.')}</p>}
  {error&&<div role="alert" className="ad-card"><p>{error}</p><button onClick={()=>setRev(v=>v+1)}>{t('إعادة المحاولة','Retry')}</button></div>}
  {notice&&<p role="status">{notice}</p>}
  {authorized&&<><nav className="ad-tools" aria-label={t('أقسام مراجعة الكباتن','Review navigation')}>
   <button onClick={()=>onGo(64)}>{t('طلبات الكباتن','Captain applications')}</button>
   <button onClick={()=>onGo(65)}>{t('مراجعة المستندات','Document review')}</button>
   <button onClick={()=>setRev(v=>v+1)}>{t('تحديث','Refresh')}</button>
  </nav>
  {apps.length===0&&<p role="status">{t('مفيش طلبات محفوظة حاليًا.','No applications on record.')}</p>}
  <div className="ad-layout">
   <section className="ad-card">
    <h3>{t('الطلبات','Applications')}</h3>
    <ul>{apps.map(a=><li key={a.user_id}>
     <button type="button" aria-pressed={selected===a.user_id} onClick={()=>{setSelected(a.user_id);setReviewed(false);setReason('');}}>
       {t('كابتن','Captain')} #{a.user_id.slice(0,8)} — {a.status}
     </button>
    </li>)}</ul>
   </section>
   {active&&<section className="ad-card">
    <h3>{t('تفاصيل طلب الكابتن','Captain application details')}</h3>
    <p>{t('الحالة:','Status:')} {active.status}</p>
    <p>{t('الخبرة:','Experience:')} {active.experience_years??'—'}</p>
    <p>{t('النبذة المهنية:','Professional notes:')} {active.professional_notes||'—'}</p>
    <p>{t('العربية المقترحة:','Intended vehicle:')} {active.intended_vehicle_model||'—'} · {active.intended_category||'—'} · {active.intended_seats??'—'}</p>
    <p>{t('الوثائق في التخزين الخاص:','Documents in private storage:')} {docs.length}</p>
    <ul>{docs.map(d=><li key={d.id}>{d.kind} <button type="button" disabled={busy} onClick={()=>void download(d)}>{t('تنزيل للمراجعة','Download for review')}</button></li>)}</ul>
    {docs.length===0&&<p>{t('مفيش مستندات مرفوعة. قائمة المستندات الإلزامية غير محسومة في PRD.','No uploaded documents; mandatory document policy is unresolved in the PRD.')}</p>}
    {active.status==='submitted'&&<>
      <label><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>{t('راجعت الطلب واتخذ قراري بصفتي مسؤولًا مخولًا','I reviewed this application as an authorized administrator')}</label>
      <button type="button" disabled={!reviewed||busy} onClick={()=>decide('approved')}>{t('اعتماد الكابتن','Approve captain')}</button>
      <label>{t('سبب الرفض','Rejection reason')}<textarea maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
      <button type="button" disabled={!reviewed||busy||reason.trim().length<5} onClick={()=>decide('rejected')}>{t('رفض مع توضيح السبب','Reject with reason')}</button>
    </>}
    {active.rejection_reason&&<p role="status">{t('سبب الرفض المسجل:','Recorded reason:')} {active.rejection_reason}</p>}
    <h3>{t('سجل القرارات','Decision audit trail')}</h3>
    <ol>{audit.map(a=><li key={a.id}>{a.decision} — {a.reason||'—'} · {new Date(a.created_at).toLocaleString(en?'en-GB':'ar-EG')}</li>)}</ol>
   </section>}
  </div></>}
 </section>;
}
