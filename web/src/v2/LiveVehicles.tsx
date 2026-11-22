import AppSkeleton from './AppSkeleton';
import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';

type Vehicle={
 id:string;model:string;plate_number:string;category:string;seats:number;status:string;
 vehicle_type:string|null;manufacture_year:number|null;enabled_categories:string[];
};
const capacities:Record<string,number>={PRIME:3,SAVER:4,SPACE:9,MAX:13};

export default function LiveVehicles(){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [items,setItems]=useState<Vehicle[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  if(!client){setError(t('الاتصال بالخادم غير متاح.','Backend configuration is unavailable.'));setLoading(false);return;}
  let active=true;setLoading(true);setError('');
  void(async()=>{
   try{
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)throw Error('AUTH_REQUIRED');
    const {data,error:readError}=await client.from('v31_vehicles')
     .select('id,model,plate_number,category,seats,status,vehicle_type,manufacture_year,enabled_categories')
     .eq('captain_id',user.id).order('created_at',{ascending:false});
    if(readError)throw readError;
    if(active)setItems((data||[]) as Vehicle[]);
   }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false;};
 },[revision,language]);
 return <section className="d-box live-vehicles">
  <h2>{t('مركباتي المعتمدة','My approved vehicles')}</h2>
  {loading&&<AppSkeleton kind="vehicles" count={2} label={t('بنحمّل المركبات…','Loading vehicles…')}/>}
  {error&&<p role="alert">{error}</p>}
  {!loading&&!error&&items.length===0&&<p role="status">{t('لا توجد مركبات معتمدة حتى الآن.','No approved vehicles yet.')}</p>}
  <ul>{items.map(vehicle=><li key={vehicle.id}>
   <strong>{vehicle.model}</strong> — {vehicle.plate_number}
   {vehicle.vehicle_type&&<span> · {vehicle.vehicle_type==='private_car'?t('ملاكي','Private car'):t('هايس','Hiace')}</span>}
   {vehicle.manufacture_year&&<span> · {vehicle.manufacture_year}</span>}
   <ul>{(vehicle.enabled_categories||[]).map(category=><li key={category}>
    {category} · {capacities[category]||'—'} {t('مقاعد ركاب ثابتة','fixed passenger seats')}
   </li>)}</ul>
   <span>{t('الحالة:','Status:')} {vehicle.status}</span>
  </li>)}</ul>
  <p>{t('تُفعّل المركبات وتُحدد أهليتها بواسطة مسؤول مخوّل فقط.','Only an authorized administrator can activate vehicles and set their eligibility.')}</p>
  <button type="button" onClick={()=>setRevision(value=>value+1)}>{t('تحديث المركبات','Refresh vehicles')}</button>
 </section>;
}
