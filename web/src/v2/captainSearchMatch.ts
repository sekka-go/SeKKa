import {normalizedPlace} from './geoPlace.ts';
import type {MapPlace} from './geoPlace.ts';

/** Manual map lookup must match the requested landmark name, not merely the
 * selected district. This guards against accepting an unrelated nearby POI
 * (for example, an AUC result when the Captain asked for 90th Street).
 * Known local street aliases are search terms only, never stored GPS points.
 */
const namedAliases:Record<string,string[]>={
 'شارع التسعين':['90th street','90 street','90th st','north 90','south 90','northern 90th street','southern 90th street'],
 'التسعين':['90th street','90 street','90th st','north 90','south 90','northern 90th street','southern 90th street'],
 'ميدان الحصري':['al hosary square','al hosary','el hosary square','hosary square'],
 'مسجد الحصري':['al hosary mosque','el hosary mosque','hosary mosque']
};
const digits=(s:string)=>s.replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x)))
 .replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x)));
const clean=(s:string)=>digits(normalizedPlace(s)).replace(/[.,،;:()-]/g,' ').replace(/\s+/g,' ').trim();
const isPhrase=(text:string,query:string):boolean=>{
 return Boolean(text&&query&&(text===query||
  text.startsWith(query+' ')||text.endsWith(' '+query)||text.includes(' '+query+' ')));
};
export function placeMatchesSearch(place:Pick<MapPlace,'name'>,query:string):boolean{
 const target=clean(place.name);
 const input=clean(query);
 if(input.length<3)return false;
 // Query must be a distinct phrase within the result name (or vice versa for
 // an explicitly shortened POI name), not just any other result in the area.
 if(isPhrase(target,input)||input.length>=5&&isPhrase(input,target))return true;
 const known=Object.entries(namedAliases).find(([q])=>clean(q)===input)?.[1]||[];
 return known.some(alias=>isPhrase(target,clean(alias)));
}
