/** Proven spelling/abbreviation navigation for named places.
 * Names are only rewritten to queries against existing sourced OSM results:
 * NO coordinates or invented businesses are generated here.
 */
const namedPlaces=[
 {name:'Cairo Festival City Mall',aliases:['cfc','cfc mall','cfcm','cairo festival city','كايرو فستيفال سيتي','كايرو فستيفال سيتي مول','كايرو فيستيفال سيتي','فستيفال سيتي','سي اف سي','سى اف سى','كايرو فيستيفال']},
 {name:'Smart Village',aliases:['القرية الذكية','القريه الذكيه','قرية ذكية','قريه ذكيه','سمارت فيلدج','سمارت فيليدج']},
 {name:'Cairo Mall',aliases:['كايرو مول','وكايرو مول','مول كايرو','cairo mall']},
 {name:'Talaat Harb Mall',aliases:['مول طلعت حرب','طلعت حرب مول','طلعت حرب مال','talaat harb mall','talat harb mall']},
 {name:'Mall of Arabia',aliases:['مول العرب','مول اوف ارابيا','مول أوف أرابيا','mall of arabia']},
 {name:'Mall of Egypt',aliases:['مول مصر','مول اوف ايجيبت','مول أوف إيجيبت','mall of egypt']},
 {name:'American University in Cairo',aliases:['auc','auc new cairo','الجامعة الامريكية التجمع','الجامعه الامريكيه التجمع']},
 {name:'German University in Cairo',aliases:['guc','الجامعة الالمانية بالقاهرة','الجامعه الالمانيه بالقاهره']},
];
export function normalizeNamedQuery(q:string):string {
 return q.normalize('NFKC').toLowerCase().replace(/ـ/g,'')
  .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660))
  .replace(/[^\p{Letter}\p{Number}]+/gu,' ').trim();
}
const dictionary=new Map(namedPlaces.flatMap(item=>
 [item.name,...item.aliases].map(alias=>[normalizeNamedQuery(alias),item.name] as const)));
export function canonicalNamedQuery(query:string):string|null {
 return dictionary.get(normalizeNamedQuery(query))??null;
}
