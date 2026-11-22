import AppSkeleton from './AppSkeleton';
import {useEffect,useState} from 'react';
import {usePreferences} from './preferences';

type MapStop={name:string;latitude:number|null;longitude:number|null};
type LocatedStop=MapStop&{latitude:number;longitude:number};
const osm='https://www.openstreetmap.org';

export default function CaptainRouteMap({stops}:{stops:MapStop[]}){
 const {language}=usePreferences();
 const t=(ar:string,en:string)=>language==='en'?en:ar;
 const [focused,setFocused]=useState<string|null>(null);
 const [mapLoaded,setMapLoaded]=useState(false);
 const located=stops.filter((stop):stop is LocatedStop=>stop.latitude!==null&&stop.longitude!==null);
 const coordinateKey=(stop:LocatedStop)=>stop.latitude+':'+stop.longitude;
 const marker=located.find(stop=>coordinateKey(stop)===focused)??located.at(-1);
 const bounds=located.length
  ? [
     Math.min(...located.map(stop=>stop.longitude))-.012,Math.min(...located.map(stop=>stop.latitude))-.010,
     Math.max(...located.map(stop=>stop.longitude))+.012,Math.max(...located.map(stop=>stop.latitude))+.010
    ]
  : [30.82,29.84,31.64,30.27];
 const map=new URL('/export/embed.html',osm);
 map.searchParams.set('bbox',bounds.map(value=>value.toFixed(5)).join(','));
 map.searchParams.set('layer','mapnik');
 if(marker)map.searchParams.set('marker',marker.latitude+','+marker.longitude);
 const mapUrl=map.toString();
 useEffect(()=>{setMapLoaded(false);},[mapUrl]);

 return <section className="sekka-route-map-card" aria-label={t('خريطة محطات الخط','Route stop map')}>
  {!mapLoaded&&<div className="sekka-map-shimmer"><AppSkeleton kind="map" label={t('بنحمّل خريطة المحطات…','Loading route stops map…')}/>}</div>}
  <iframe className="sekka-route-map-card__frame" src={mapUrl} loading="lazy"
   onLoad={()=>setMapLoaded(true)}
   style={{visibility:mapLoaded?'visible':'hidden'}}
   title={t('خريطة OpenStreetMap لمحطات الخط','OpenStreetMap route stop map')}
   sandbox="allow-scripts allow-same-origin" referrerPolicy="strict-origin-when-cross-origin"/>
  <a className="sekka-route-map-card__credit" href={osm+'/copyright'} target="_blank" rel="noopener noreferrer">
   © OpenStreetMap contributors
  </a>
  {located.length>0&&<div className="sekka-route-map-card__stops" role="group" aria-label={t('اعرض محطة على الخريطة','Show a stop on the map')}>
   {located.map((stop,index)=><button key={coordinateKey(stop)} type="button"
    aria-pressed={marker===stop} onClick={()=>setFocused(coordinateKey(stop))}>
    {index+1}. {stop.name}
   </button>)}
  </div>}
  {located.length>1&&<details>
   <summary>{t('راجع اتجاهات القيادة على OpenStreetMap','Check driving directions on OpenStreetMap')}</summary>
   <ol>
    {located.slice(0,-1).map((from,index)=>{
     const to=located[index+1];
     const directions=new URL('/directions',osm);
     directions.searchParams.set('engine','fossgis_osrm_car');
     directions.searchParams.set('route',from.latitude+','+from.longitude+';'+to.latitude+','+to.longitude);
     return <li key={coordinateKey(from)}>
      <a href={directions.toString()} target="_blank" rel="noopener noreferrer">
       {t('من','From')} {from.name} {t('إلى','to')} {to.name}
      </a>
     </li>;
    })}
   </ol>
  </details>}
 </section>;
}
