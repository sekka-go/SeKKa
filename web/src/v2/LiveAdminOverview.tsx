import AppSkeleton from './AppSkeleton';
import {useEffect,useState} from 'react';
import {client} from './api';
import {usePreferences} from './preferences';
type Stats={passengers:number;captains_approved:number;vehicles:number;routes_published:number;pending_bookings:number;open_requests:number;captain_offers:number;notifications:number};
export default function LiveAdminOverview(){
 const {language}=usePreferences(),en=language==='en',t=(ar:string,english:string)=>en?english:ar;
 const [stats,setStats]=useState<Stats|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;void(async()=>{
  try{
   if(!client)throw Error('BACKEND_NOT_CONFIGURED');
   const {data,error:readError}=await client.rpc('v31_admin_overview');
   if(readError)throw readError;
   if(!active)return;setStats(data as Stats);
  }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false;};},[revision]);
 const items: [keyof Stats,string,string][]=[
  ['passengers','الركاب','Passengers'],['captains_approved','الكباتن المعتمدون','Approved captains'],
  ['vehicles','العربيات النشطة','Active vehicles'],['routes_published','الخطوط المنشورة','Published routes'],
  ['pending_bookings','الحجوزات المعلقة','Pending bookings'],['open_requests','طلبات الرحلات المفتوحة','Open trip requests'],
  ['captain_offers','عروض الكباتن المفتوحة','Open captain offers'],['notifications','الإشعارات','Notifications']
 ];
 return <main className="live-admin-overview" dir={en?'ltr':'rtl'} style={{maxWidth:920,margin:'auto',padding:'28px 18px'}}>
  <h1>{t('لوحة PoNo — البيانات الحقيقية','PoNo Admin — live data')}</h1>
  <p>{t('الأرقام دي بتتقرأ من قاعدة البيانات بعد التحقق من صلاحيات الأدمن على السيرفر.','Counts are read from Supabase after server-side admin authorization.')}</p>
  {loading&&<AppSkeleton kind="stats" count={4} label={t('جارٍ تحميل البيانات…','Loading live data…')}/>}
  {error&&<div role="alert"><p>{error}</p><button type="button" onClick={()=>{setError('');setLoading(true);setRevision(x=>x+1);}}>{t('إعادة المحاولة','Retry')}</button></div>}
  {stats&&<div className="ad-metrics" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:14}}>
   {items.map(([key,ar,english])=><section key={key} className="ad-card" style={{padding:18}}><h2 style={{fontSize:15}}>{t(ar,english)}</h2><strong style={{fontSize:30}}>{stats[key]}</strong></section>)}
  </div>}
  <button type="button" onClick={()=>{setLoading(true);setRevision(x=>x+1);}}>{t('تحديث البيانات','Refresh live data')}</button>
 </main>;
}
