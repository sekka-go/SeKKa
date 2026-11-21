/** Booking errors from the server mapped to actionable, user-safe Arabic/English.
 * Never surface SQL strings or implementation details in the passenger UI.
 */
const bookingErrors:Record<string,{ar:string;en:string}>={
 INSUFFICIENT_SEATS:{
  ar:'المقاعد المتاحة خلصت قبل ما الحجز يتأكد. ارجع للبحث واختار رحلة تانية.',
  en:'The available seats filled before booking was confirmed. Return to search for another trip.'
 },
 VEHICLE_SEAT_CAPACITY_EXCEEDED:{
  ar:'العربية وصلت للسعة القصوى. ارجع للبحث واختار رحلة فيها مقاعد.',
  en:'This vehicle has reached full capacity. Choose another trip with available seats.'
 },
 ROUTE_NOT_AVAILABLE:{
  ar:'الرحلة دي مش متاحة للحجز دلوقتي. ارجع للبحث وحدّث النتائج.',
  en:'This trip is no longer available for booking. Return to search and refresh.'
 },
 RIDER_MAX_TWO_SEATS:{
  ar:'حاليًا الحد الأقصى لكل حساب مقعدين على نفس الخط.',
  en:'Currently, one account can reserve at most two seats on the same route.'
 },
 RIDER_MAX_TWO_SEATS_PER_ROUTE:{
  ar:'وصلت للحد الأقصى للمقاعد المحجوزة على الخط ده.',
  en:'You already have the maximum seats reserved on this route.'
 },
 IDEMPOTENCY_CONFLICT:{
  ar:'اتغيرت تفاصيل محاولة الحجز السابقة. حدّث الحجز قبل ما تحاول تاني.',
  en:'Your previous booking attempt had different details. Refresh before retrying.'
 },
 IDEMPOTENCY_STOPS_CONFLICT:{
  ar:'نقاط الركوب والنزول اتغيرت بعد محاولة الحجز السابقة. ارجع وراجع اختيارك.',
  en:'Your pickup or drop-off changed since the previous attempt. Review your choices.'
 },
 BOOKING_ALREADY_CANCELLED:{
  ar:'الحجز اتلغى بالفعل، ومش ممكن تأكيده بنفس الطلب.',
  en:'This booking was already cancelled and cannot be confirmed again.'
 },
 ONLY_PENDING_BOOKINGS_CAN_BE_CANCELLED:{
  ar:'الحجز ما عادش في حالة تسمح بالإلغاء من الشاشة دي.',
  en:'This booking can no longer be cancelled from this screen.'
 },
 BOOKING_NOT_FOUND:{
  ar:'مش قادرين نلاقي الحجز على حسابك. راجع حجوزاتك أو تواصل مع الدعم.',
  en:'This booking is not available on your account. Check your bookings or contact support.'
 },
 BOOKING_NOT_VERIFIED:{
  ar:'الحجز اتبعت لكن ما قدرناش نأكد بياناته. راجع «حجوزاتي» قبل ما تحجز تاني.',
  en:'The request was sent but could not be verified. Check My bookings before trying again.'
 },
 INVALID_BOOKING_STOPS:{
  ar:'نقطة الركوب أو النزول مش متاحة على الخط ده. اختار نقط صحيحة.',
  en:'The selected pickup or drop-off is not available on this route.'
 },
 INVALID_OUTBOUND_STOPS:{
  ar:'نقط الذهاب مش متوافقة مع اتجاه الرحلة. راجع المسار.',
  en:'Your pickup and drop-off do not match the trip direction.'
 },
 INVALID_REVERSE_STOPS:{
  ar:'نقط العودة مش متوافقة مع اتجاه الرحلة. راجع المسار.',
  en:'Your return stops do not match the route direction.'
 },
 ROUND_TRIP_RETURN_STOPS_UNSUPPORTED:{
  ar:'الخط ده ما بيدعمش نقط العودة المطلوبة. راجع تفاصيل الرحلة.',
  en:'This route does not support the requested return stops.'
 },
 AUTH_REQUIRED:{
  ar:'سجّل دخولك بجوجل علشان تكمّل الحجز.',
  en:'Sign in with Google to continue booking.'
 }
};
const rawError=(e:unknown):string=>{
 if(e instanceof Error)return e.message;
 if(typeof e==='string')return e;
 if(e&&typeof e==='object'&&'message' in e)return String((e as {message:unknown}).message);
 return '';
};
export function v31BookingError(e:unknown,language:'ar'|'en'='ar'){
 const raw=rawError(e);
 const key=Object.keys(bookingErrors).find(k=>
  new RegExp('(?:^|[^A-Z_])'+k+'(?:[^A-Z_]|$)').test(raw));
 return key?bookingErrors[key][language]:(language==='ar'
  ?'تعذر إكمال الحجز. راجع اتصالك وحجوزاتك قبل ما تحاول مرة تانية.'
  :'Booking could not be completed. Check your connection and My bookings before retrying.');
}
