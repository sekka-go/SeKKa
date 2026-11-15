import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
type Vehicle={id:string;model:string;plate_number:string;category:string;seats:number;status:string};
const maxSeats:Record<string,number>={PRIME:3,SAVER:4,SPACE:9,MAX:13};
export default function LiveVehicles(){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [items,setItems]=useState<Vehicle[]>([]),[model,setModel]=useState(''),[plate,setPlate]=useState(''),[category,setCategory]=useState('PRIME'),[seats,setSeats]=useState(3);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{if(!client)return;let active=true;void (async()=>{
  const {data:{user},error:authError}=await client!.auth.getUser();
  if(!active)return;
  if(authError||!user){setError('AUTH_REQUIRED');return;}
  const {data,error:readError}=await client!.from('v31_vehicles').select('id,model,plate_number,category,seats,status').eq('captain_id',user.id).order('created_at',{ascending:false});
  if(!active)return;
  if(readError)setError(readError.message);else setItems((data||[]) as Vehicle[]);
 })();return()=>{active=false;};},[revision]);
 const save=async()=>{if(!client)return;setError('');setNotice('');
  if(model.trim().length<2||plate.trim().length<3||!Number.isInteger(seats)||seats<1||seats>maxSeats[category]){setError(t('راجع بيانات العربية والمقاعد.','Check vehicle details and seat count.'));return;}
  setBusy(true);try{
   const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)throw Error('AUTH_REQUIRED');
   const {error:writeError}=await client.from('v31_vehicles').insert({captain_id:user.id,model:model.trim(),plate_number:plate.trim(),category,seats});
   if(writeError)throw writeError;setModel('');setPlate('');setNotice(t('العربية اتحفظت في حسابك.','Vehicle saved to your account.'));setRevision(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 };
 const toggle=async(v:Vehicle)=>{if(!client)return;setBusy(true);setError('');
  const {data,error:updateError}=await client.from('v31_vehicles').update({status:v.status==='active'?'inactive':'active'}).eq('id',v.id).select('id').single();
  if(updateError||!data)setError(updateError?.message||'UPDATE_NOT_CONFIRMED');else setRevision(x=>x+1);
  setBusy(false);
 };
 return <section className="d-box live-vehicles">
  <h2>{t('عربياتي','My vehicles')}</h2>
  <p>{t('بيانات العربيات الحقيقية بتتحفظ على Supabase.','Vehicle records are stored in Supabase.')}</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <ul>{items.map(v=><li key={v.id}><strong>{v.model}</strong> — {v.plate_number} · {v.category} · {v.seats} {t('مقاعد','seats')} · {v.status}
   <button type="button" disabled={busy} onClick={()=>void toggle(v)}>{v.status==='active'?t('إيقاف العربية','Deactivate'):t('تفعيل العربية','Activate')}</button></li>)}</ul>
  <h3>{t('إضافة عربية','Add a vehicle')}</h3>
  <label>{t('الموديل','Model')}<input value={model} maxLength={100} onChange={e=>setModel(e.target.value)}/></label>
  <label>{t('رقم اللوحة','Plate number')}<input value={plate} maxLength={24} onChange={e=>setPlate(e.target.value)}/></label>
  <label>{t('الفئة','Category')}<select value={category} onChange={e=>{setCategory(e.target.value);setSeats(Math.min(seats,maxSeats[e.target.value]));}}>{Object.keys(maxSeats).map(c=><option key={c}>{c}</option>)}</select></label>
  <label>{t('المقاعد','Seats')}<input type="number" min="1" max={maxSeats[category]} value={seats} onChange={e=>setSeats(Number(e.target.value))}/></label>
  <button type="button" className="d-primary" disabled={busy} onClick={()=>void save()}>{busy?t('جارٍ الحفظ…','Saving…'):t('حفظ العربية','Save vehicle')}</button>
 </section>;
}
