/** Public UI translations for Captain route failures.
 * Never expose raw Postgres/PostgREST errors or internal identifiers to users.
 * Unknown errors remain in logs/diagnostics, not in the public UI.
 */
const messages:Record<string,{ar:string;en:string}>={
 VEHICLE_HAS_ACTIVE_SERVICE:{
  ar:'العربية دي مرتبطة بخط منشور أو متوقف مؤقتًا. افتح «رحلاتي» وراجع الخط الحالي، أو اختار عربية تانية.',
  en:'This vehicle already has a published or paused route. Review it in My routes or choose another vehicle.'
 },
 VEHICLE_CATEGORY_NOT_ENABLED:{
  ar:'العربية أو الفئة دي مش معتمدة للنشر. راجع بيانات العربية واختار فئة متاحة.',
  en:'This vehicle or category is not approved for publication. Choose an eligible category.'
 },
 CATEGORY_CAPACITY_MISMATCH:{
  ar:'عدد المقاعد مش مطابق للسعة المعتمدة للعربية.',
  en:'The seat count does not match the vehicle-approved capacity.'
 },
 CAPTAIN_NOT_APPROVED:{
  ar:'حساب الكابتن لسه مش معتمد. لازم تراجع حالة الاعتماد قبل النشر.',
  en:'Your Captain account must be approved before publishing.'
 },
 INVALID_ROUTE_STOPS:{
  ar:'راجع نقط البداية والنهاية؛ لازم يكونوا منطقتين مختلفتين ونقاط ركوب واضحة.',
  en:'Review the origin and destination; use two distinct areas and valid stops.'
 },
 SAME_ORIGIN_DESTINATION:{
  ar:'نقطة البداية والنهاية لازم تكون في منطقتين مختلفتين.',
  en:'Origin and destination must be in different areas.'
 },
 STOP_COORDINATES_REQUIRED:{
  ar:'في نقطة موقعها مش متأكد منه. اختارها من نتائج الخريطة مرة تانية.',
  en:'A stop is missing a verified map location. Choose it again.'
 },
 STOP_OUTSIDE_OPERATIONAL_REGION:{
  ar:'في نقطة خارج نطاق تشغيل سِكّة. بنخدم القاهرة الكبرى فقط.',
  en:'A stop is outside seKKa’s Greater Cairo service area.'
 },
 STOP_OUTSIDE_LAUNCH_REGION:{
  ar:'في نقطة خارج نطاق خدمة القاهرة والجيزة الحالي.',
  en:'One of the stops is outside the current Cairo/Giza service region.'
 },
 INVALID_STOP_COORDINATES:{
  ar:'في إحداثيات غير صحيحة. اختار المكان تاني.',
  en:'A stop has invalid coordinates. Select its location again.'
 },
 INVALID_STOPS_COUNT:{
  ar:'حدد نقطتين على الأقل للبداية والنهاية.',
  en:'Add at least an origin and a destination.'
 },
 INVALID_ROUTE_DETAILS:{
  ar:'راجع تفاصيل الرحلة والعربية والمواعيد والسعر قبل الحفظ.',
  en:'Review the route details, vehicle, time preferences and price.'
 },
 ROUTE_NOT_OWNED:{
  ar:'الرحلة دي مش متاحة لحساب الكابتن الحالي.',
  en:'This route is not available to the signed-in Captain.'
 },
 INVALID_TRANSITION:{
  ar:'حالة الرحلة اتغيّرت. حدّث الصفحة وراجع حالتها قبل الإجراء.',
  en:'The route status has changed. Refresh and review it before continuing.'
 },
 ACTIVE_BOOKINGS_PREVENT_ARCHIVE:{
  ar:'في حجوزات نشطة على الخط. لازم تتعامل معاها قبل الأرشفة.',
  en:'This route has active bookings. Resolve them before archiving.'
 },
 AUTH_REQUIRED:{
  ar:'الجلسة انتهت. سجّل دخولك بجوجل تاني.',
  en:'Your session expired. Sign in with Google again.'
 },
 DRAFT_PERSISTENCE_NOT_VERIFIED:{
  ar:'مش قادرين نأكد حفظ المسودة. راجع «رحلاتي» قبل ما تحاول الحفظ مرة تانية.',
  en:'Could not verify the saved draft. Check My routes before retrying.'
 },
 STOP_COORDINATE_READBACK_FAILED:{
  ar:'مش قادرين نأكد إحداثيات المسودة. جرّب الحفظ تاني بنفس التفاصيل.',
  en:'Could not verify the draft coordinates. Retry with the same details.'
 },
 DRAFT_ATTEMPT_MISMATCH:{
  ar:'محاولة الحفظ مرتبطة بتفاصيل مختلفة. افتح «رحلاتي» وراجع المسودة.',
  en:'This save attempt used different details. Open My routes to review the draft.'
 },
 DRAFT_STOP_NOT_CREATED:{
  ar:'تعذر حفظ محطة من محطات المسار. البيانات ما اتحفظتش جزئيًا.',
  en:'A route stop could not be saved. No partial draft was kept.'
 }
};
const safeCode=(e:unknown)=>{
 const message=e instanceof Error?e.message:typeof e==='string'?e:
  e&&typeof e==='object'&&'message' in e?String((e as {message:unknown}).message):'';
 return Object.keys(messages).find(k=>new RegExp('(?:^|[^A-Z_])'+k+'(?:[^A-Z_]|$)').test(message))||'';
};
export function captainRouteError(e:unknown,language:'ar'|'en'='ar'){
 const code=safeCode(e);
 return code?messages[code][language]:language==='en'
  ?'The action could not be completed. Please check your connection or contact support.'
  :'تعذر إكمال العملية. راجع اتصالك أو تواصل مع الدعم لو المشكلة مستمرة.';
}
