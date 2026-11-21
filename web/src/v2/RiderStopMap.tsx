import {usePreferences} from './preferences';
import type {GeoPoint} from './nearbyRoutes';
import {validCoordinates} from './nearbyRoutes';
import './rider-stop-map.css';
export default function RiderStopMap({pickup,name}:{pickup:GeoPoint;name:string}){
 const {language}=usePreferences();
 if(!validCoordinates(pickup))return null;
 // The marker is a public Captain pickup stop, NOT the Rider's private GPS.
 const map=new URL('https://www.openstreetmap.org/export/embed.html');
 map.searchParams.set('bbox',[
  pickup.longitude-.018,pickup.latitude-.012,
  pickup.longitude+.018,pickup.latitude+.012
 ].map(v=>v.toFixed(6)).join(','));
 map.searchParams.set('layer','mapnik');
 map.searchParams.set('marker',pickup.latitude.toFixed(6)+','+pickup.longitude.toFixed(6));
 const title=language==='en'?'Pickup point map: '+name:'خريطة نقطة الركوب: '+name;
 return <div className="sekka-rider-stop-map">
  <div className="sekka-rider-stop-map__frame">
   <iframe src={map.toString()} title={title} loading="lazy"
    referrerPolicy="strict-origin-when-cross-origin"
    sandbox="allow-scripts allow-same-origin"/>
  </div>
  <p>{language==='en'?'Showing the published pickup point; not your live position.':'الخريطة بتعرض نقطة الركوب المنشورة، مش موقعك الشخصي.'}</p>
  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
 </div>;
}
