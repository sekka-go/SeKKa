// Curated lookup vocabulary. Aliases and popularity are editorial search hints.
export type CatalogReference = {
 osmId:string; longitude:number; latitude:number; source:string; checkedOn:string;
};
export type CatalogPlace = {
 key:string; ar:string; en:string; area:string; aliases:string[];
 kind:'area'|'square'|'mosque'|'road'; popularity?:number; reference?:CatalogReference;
};
export const serviceAreaAliases:Record<string,string[]>={
 'maadi':['el maadi','al maadi','المعادى'],
 'new cairo':['القاهرة الجديدة','القاهره الجديده','التجمع'],
 'nasr city':['madinet nasr','madinat nasr','nasr'],
 'dokki':['الدقى','el dokki','doqqi'],
 'mohandessin':['mohandiseen','mohandeseen'],
 'zamalek':['el zamalek','al zamalek'],
 'sheikh zayed':['الشيخ زايد','sheikh zayed city','zayed city'],
 '6th of october':['أكتوبر','٦ أكتوبر','مدينة 6 أكتوبر','السادس من أكتوبر','6 october','6th october','sixth of october','october city','6th of october city'],
 'heliopolis':['مصر الجديدة','masr el gedida','misr el gedida']
};
export const localPlaceCatalog:CatalogPlace[]=[
 {key:'hosary-square',ar:'ميدان الحصري',en:'Hosary Square',area:'6th of october',kind:'square',popularity:2,
  reference:{osmId:'W:1393055714',longitude:30.9448074,latitude:29.9724456,
   source:'https://www.openstreetmap.org/way/1393055714',checkedOn:'2026-11-21'},
  aliases:['الحصري','Hosary','El Hosary','Al Hosary','El Hosary Square','Al Hosary Square','ميدان الحصرى']},
 {key:'hosary-mosque',ar:'مسجد الحصري',en:'Hosary Mosque',area:'6th of october',kind:'mosque',popularity:1,
  reference:{osmId:'R:15576635',longitude:30.9437447,latitude:29.9727635,
   source:'https://www.openstreetmap.org/relation/15576635',checkedOn:'2026-11-21'},
  aliases:['الحصري','Hosary','El Hosary','Al Hosary','جامع الحصري','El Hosary Mosque','Al Hosary Mosque']},
 {key:'fifth-settlement',ar:'التجمع الخامس',en:'Fifth Settlement',area:'new cairo',kind:'area',
  reference:{osmId:'W:774635278',longitude:31.4249357,latitude:30.0038046,
   source:'https://www.openstreetmap.org/way/774635278',checkedOn:'2026-11-21'},
  aliases:['التجمع 5','5th Settlement','التجمع']},
 {key:'ninetieth-street',ar:'شارع التسعين',en:'90th Street',area:'new cairo',kind:'road',
  aliases:['التسعين','90 street','90th st','north 90','south 90','northern 90th street','southern 90th street','التسعين الشمالي','التسعين الجنوبي']}
];
