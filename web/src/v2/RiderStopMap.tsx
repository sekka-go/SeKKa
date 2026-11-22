import {useEffect,useState} from 'react';
import AppSkeleton from './AppSkeleton';
import {usePreferences} from './preferences';
import type {GeoPoint} from './nearbyRoutes';
import {validCoordinates} from './nearbyRoutes';
import './rider-stop-map.css';
export default function RiderStopMap({pickup,name}:{pickup:GeoPoint;name:string}){
 const {language}=usePreferences();
 const [loaded,setLoaded]=useState(false);
 if(!validCoordinates(pickup))return null;
 // The marker is a public Captain pickup stop, NOT the Rider's private GPS.
 const map=new URL('https://www.openstreetmap.org/export/embed.html');
 map.searchParams.set('bbox',[
  pickup.longitude-.018,pickup.latitude-.012,
  pickup.longitude+.018,pickup.latitude+.012
 ].map(v=>v.toFixed(6)).join(','));
 map.searchParams.set('layer','mapnik');
 map.searchParams.set('marker',pickup.latitude.toFixed(6)+','+pickup.longitude.toFixed(6));
 const mapUrl=map.toString();
 useEffect(()=>{setLoaded(false);},[mapUrl]);
 const title=language==='en'?'Pickup point map: '+name:'خريطة نقطة الركوب: '+name;
 return <div className="sekka-rider-stop-map">
  <div className="sekka-rider-stop-map__frame" style={{position:'relative'}}>
   {!loaded&&<div className="sekka-map-shimmer"><AppSkeleton kind="map" label={language==='en'?'Loading pickup map…':'بنحمّل خريطة نقطة الركوب…'}/></div>}
   <iframe src={mapUrl} title={title} loading="lazy" onLoad={()=>setLoaded(true)}
    style={{visibility:loaded?'visible':'hidden'}}
    referrerPolicy="strict-origin-when-cross-origin"
    sandbox="allow-scripts allow-same-origin"/>
  </div>
  <p>{language==='en'?'Showing the published pickup point; not your live position.':'الخريطة بتعرض نقطة الركوب المنشورة، مش موقعك الشخصي.'}</p>
  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
 </div>;
}
