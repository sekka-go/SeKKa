import {normalizedPlace} from './geoPlace.ts';

export const municipalities=[
 {key:'october',ar:'مدينة 6 أكتوبر',en:'6th of October',aliases:['مدينة السادس من أكتوبر','السادس من أكتوبر','٦ أكتوبر','أكتوبر','6 October','October City','October']},
 {key:'newCairo',ar:'القاهرة الجديدة',en:'New Cairo',aliases:[]},
 {key:'zayed',ar:'الشيخ زايد',en:'Sheikh Zayed',aliases:['زايد','Zayed']},
 {key:'obour',ar:'العبور',en:'Obour',aliases:['El Obour','Al Obour']},
 {key:'shubra',ar:'شبرا الخيمة',en:'Shubra El Kheima',aliases:[]},
 {key:'shorouk',ar:'الشروق',en:'Shorouk',aliases:['El Shorouk','Shorouk City']}
];
const qualifiers=municipalities.flatMap(city=>[city.ar,city.en,...city.aliases].map(name=>({city,name:normalizedPlace(name)})))
 .sort((a,b)=>b.name.length-a.name.length);
export function qualifiedPlace(query:string){
 for(const {city,name} of qualifiers){
  if(query.endsWith(' '+name))return {city,term:query.slice(0,-name.length).trim()};
  if(query.startsWith(name+' '))return {city,term:query.slice(name.length).trim()};
 }
 return null;
}
const ordinals=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth'];
export function districtName(name:string){
 return normalizedPlace(name).replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) district\b/g,
  (_,n:string)=>'district '+String(ordinals.indexOf(n)+1)).replace(/\b(\d+)(st|nd|rd|th) district\b/g,'district $1');
}
