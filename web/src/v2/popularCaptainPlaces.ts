/** Suggested, human-readable search prompts for real places in the current
 * nine seKKa service areas. These are NOT GPS points and do not authorize an
 * area assignment: every choice is geocoded and locality-checked with OSM.
 * Additional user-entered streets/places remain supported.
 */
import {normalizedPlace} from './geoPlace';

export type PopularPlaceType='neighborhood'|'square'|'university'|'mall'|'mosque'|'gathering';
export type PopularPlace={name_ar:string;name_en:string;type:PopularPlaceType};
export const popularPlaceTypes:PopularPlaceType[]=['neighborhood','square','university','mall','mosque','gathering'];
const p=(type:PopularPlaceType,name_ar:string,name_en:string):PopularPlace=>({type,name_ar,name_en});
const catalog:Record<string,PopularPlace[]>={
 '6th of october':[
  p('neighborhood','الحي السابع','7th District 6th of October'),
  p('neighborhood','الحي الثامن','8th District 6th of October'),
  p('square','ميدان الحصري','Al Hosary Square'),
  p('university','جامعة 6 أكتوبر','October 6 University'),
  p('university','جامعة مصر للعلوم والتكنولوجيا','Misr University for Science and Technology'),
  p('mall','مول العرب','Mall of Arabia'),
  p('mall','مول مصر','Mall of Egypt'),
  p('mosque','مسجد الحصري','Al Hosary Mosque'),
  p('gathering','المحور المركزي','Central Axis 6th of October')
 ],
 'new cairo':[
  p('neighborhood','التجمع الأول','First Settlement New Cairo'),
  p('neighborhood','التجمع الثالث','Third Settlement New Cairo'),
  p('neighborhood','التجمع الخامس','Fifth Settlement New Cairo'),
  p('square','شارع التسعين','90th Street New Cairo'),
  p('university','الجامعة الأمريكية بالقاهرة','American University in Cairo New Cairo'),
  p('university','الجامعة الألمانية بالقاهرة','German University in Cairo'),
  p('mall','كايرو فيستيفال سيتي','Cairo Festival City Mall'),
  p('mall','بوينت 90 مول','Point 90 Mall'),
  p('mosque','مسجد فاطمة الشربتلي','Fatma Al Sharbatly Mosque'),
  p('gathering','داون تاون القطامية','Downtown Katameya')
 ],
 'dokki':[
  p('neighborhood','شارع مصدق','Mossadak Street Dokki'),
  p('neighborhood','شارع التحرير','Tahrir Street Dokki'),
  p('square','ميدان الدقي','Dokki Square'),
  p('square','ميدان المساحة','Mesaha Square Dokki'),
  p('university','كلية التربية النوعية بالدقي','Faculty of Specific Education Dokki'),
  p('mall','مول الدقي','Dokki Mall'),
  p('mosque','مسجد أسد بن الفرات','Asad Ibn Al Furat Mosque'),
  p('gathering','محطة مترو الدقي','Dokki Metro Station'),
  p('gathering','نادي الصيد المصري','Egyptian Shooting Club Dokki')
 ],
 'maadi':[
  p('neighborhood','دجلة المعادي','Degla Maadi'),
  p('neighborhood','المعادي الجديدة','New Maadi'),
  p('square','ميدان المحطة','Maadi Station Square'),
  p('square','ميدان الحرية','Freedom Square Maadi'),
  p('university','الأكاديمية الحديثة بالمعادي','Modern Academy Maadi'),
  p('mall','جراند مول المعادي','Maadi Grand Mall'),
  p('mosque','مسجد الفاروق بالمعادي','Al Farouk Mosque Maadi'),
  p('gathering','محطة مترو المعادي','Maadi Metro Station')
 ],
 'nasr city':[
  p('neighborhood','الحي السابع','7th District Nasr City'),
  p('neighborhood','الحي الثامن','8th District Nasr City'),
  p('square','ميدان الساعة','Clock Square Nasr City'),
  p('square','ميدان رابعة العدوية','Rabaa Al Adawiya Square'),
  p('university','جامعة الأزهر بمدينة نصر','Al Azhar University Nasr City'),
  p('mall','سيتي ستارز','Citystars Mall'),
  p('mall','جنينة مول','Genena Mall'),
  p('mosque','مسجد رابعة العدوية','Rabaa Al Adawiya Mosque'),
  p('gathering','الحديقة الدولية','International Park Nasr City')
 ],
 'mohandessin':[
  p('neighborhood','شارع جامعة الدول العربية','Gameat Al Dewal Al Arabeya Street'),
  p('neighborhood','شارع شهاب','Shehab Street Mohandessin'),
  p('square','ميدان لبنان','Lebanon Square Mohandessin'),
  p('square','ميدان مصطفى محمود','Mostafa Mahmoud Square'),
  p('square','ميدان سفنكس','Sphinx Square Mohandessin'),
  p('mosque','مسجد مصطفى محمود','Mostafa Mahmoud Mosque'),
  p('gathering','نادي الترسانة','Tersana Sporting Club')
 ],
 'zamalek':[
  p('neighborhood','شارع 26 يوليو','26 July Street Zamalek'),
  p('neighborhood','شارع محمد مظهر','Mohamed Mazhar Street Zamalek'),
  p('square','ميدان الجزيرة','Gezira Square Zamalek'),
  p('university','كلية الفنون الجميلة بالزمالك','Faculty of Fine Arts Zamalek'),
  p('mosque','مسجد عمر مكرم بالزمالك','Omar Makram Mosque Zamalek'),
  p('gathering','نادي الجزيرة الرياضي','Gezira Sporting Club'),
  p('gathering','دار الأوبرا المصرية','Cairo Opera House'),
  p('gathering','برج القاهرة','Cairo Tower')
 ],
 'sheikh zayed':[
  p('neighborhood','الحي الأول','First District Sheikh Zayed'),
  p('neighborhood','الحي الثالث','Third District Sheikh Zayed'),
  p('square','المحور المركزي بالشيخ زايد','Central Axis Sheikh Zayed'),
  p('university','جامعة النيل','Nile University Sheikh Zayed'),
  p('mall','أركان بلازا','Arkan Plaza'),
  p('mall','أمريكانا بلازا','Americana Plaza Sheikh Zayed'),
  p('mosque','مسجد الشرطة بالشيخ زايد','Police Mosque Sheikh Zayed'),
  p('gathering','هايبر وان الشيخ زايد','Hyper One Sheikh Zayed')
 ],
 'heliopolis':[
  p('neighborhood','الكوربة','Korba Heliopolis'),
  p('neighborhood','أرض الجولف','Ard El Golf Heliopolis'),
  p('square','ميدان روكسي','Roxy Square Heliopolis'),
  p('square','ميدان سفير','Safir Square Heliopolis'),
  p('square','ميدان المحكمة','Mahkama Square Heliopolis'),
  p('mall','سيتي سنتر ألماظة','City Centre Almaza'),
  p('mosque','مسجد الثورة بمصر الجديدة','Al Thawra Mosque Heliopolis'),
  p('gathering','حديقة الميريلاند','Merryland Park Heliopolis')
 ]
};
export function popularPlacesForArea(areaEnglish:string):PopularPlace[]{
 return catalog[normalizedPlace(areaEnglish)]||[];
}
export function filterPopularPlaces(items:PopularPlace[],type:PopularPlaceType|'all',search=''):PopularPlace[]{
 const q=normalizedPlace(search);
 return items.filter(item=>(type==='all'||item.type===type)&&
  (!q||normalizedPlace(item.name_ar).includes(q)||normalizedPlace(item.name_en).includes(q)));
}
export const popularPlaceCount=Object.values(catalog).reduce((n,a)=>n+a.length,0);
